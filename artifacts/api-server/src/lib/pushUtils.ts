import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

interface SendResult {
  dead: Set<string>;
  receiptIds: string[];
  errorCount: number;
}

/**
 * Maps a ticket/receipt error code to a human-readable log message.
 * `InvalidCredentials` is the error that surfaces when the APNs p8 key is
 * missing or wrong in EAS — this is the most common silent failure for iOS.
 */
function describeExpoError(code: string | undefined): string {
  switch (code) {
    case "DeviceNotRegistered":
      return "Token no longer valid — device uninstalled or token rotated";
    case "InvalidCredentials":
      return "APNs credentials invalid or missing — add the .p8 key via `eas credentials -p ios`";
    case "MessageRateExceeded":
      return "Too many messages sent to this device — throttled by APNs/FCM";
    case "MessageTooBig":
      return "Payload too large (>4 KB for APNs, >4 KB for FCM)";
    case "MismatchSenderId":
      return "FCM sender ID mismatch — check google-services.json";
    default:
      return code ?? "unknown error";
  }
}

/**
 * Sends push messages to Expo in chunks of 100.
 * Returns dead tokens (DeviceNotRegistered), receipt IDs (for async receipt
 * checking), and a count of non-recoverable errors.
 *
 * All ticket-level errors are logged with full detail so they appear in the
 * API server logs even when the Expo Push Service accepts the request.
 */
async function sendExpoPushChunks(messages: ExpoPushMessage[]): Promise<SendResult> {
  const dead = new Set<string>();
  const receiptIds: string[] = [];
  let errorCount = 0;

  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  let offset = 0;
  for (const chunk of chunks) {
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, "push: Expo API returned non-OK status");
        errorCount += chunk.length;
      } else {
        const json = await res.json() as { data?: ExpoTicket[] };
        const tickets = json.data ?? [];

        tickets.forEach((ticket, idx) => {
          const token = messages[offset + idx]?.to ?? "unknown";
          const errCode = ticket.details?.error;

          if (ticket.status === "ok") {
            if (ticket.id) receiptIds.push(ticket.id);
            return;
          }

          // Every error ticket is logged — previously only DeviceNotRegistered
          // was acted on; all others were silently swallowed.
          errorCount++;

          if (errCode === "DeviceNotRegistered") {
            // Expected during normal operation (app uninstall, token rotation).
            // Logged at debug level — token will be purged automatically.
            logger.debug(
              { token: token.slice(-12), reason: describeExpoError(errCode) },
              "push: dead token detected — will purge",
            );
            dead.add(token);
          } else if (errCode === "InvalidCredentials") {
            // This is the critical iOS failure: APNs p8 key missing/wrong in EAS.
            // Logged at error level so it's immediately visible in production logs.
            logger.error(
              {
                token: token.slice(-12),
                expoMessage: ticket.message,
                action: "Run `eas credentials -p ios` and add a Push Notifications Key (.p8)",
              },
              "push: InvalidCredentials — APNs key not configured in EAS",
            );
          } else {
            logger.warn(
              {
                token: token.slice(-12),
                errorCode: errCode,
                reason: describeExpoError(errCode),
                expoMessage: ticket.message,
              },
              "push: ticket error",
            );
          }
        });
      }
    } catch (err) {
      logger.error({ err }, "push: failed to send chunk to Expo API");
      errorCount += chunk.length;
    }
    offset += chunk.length;
  }

  return { dead, receiptIds, errorCount };
}

/**
 * Checks Expo push receipts 30 seconds after the initial send.
 * Receipts reveal the final APNs/FCM delivery status — errors that pass
 * the initial ticket check (status: "ok") but fail at delivery surface here.
 * This is where iOS `InvalidCredentials` most commonly appears when the
 * APNs p8 key is missing from EAS credentials.
 */
function scheduleReceiptCheck(receiptIds: string[], context: string): void {
  if (receiptIds.length === 0) return;

  setTimeout(async () => {
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: receiptIds }),
      });

      if (!res.ok) {
        logger.warn({ status: res.status, context }, "push receipts: Expo API non-OK");
        return;
      }

      const json = await res.json() as { data?: Record<string, ExpoReceipt> };
      const receipts = json.data ?? {};

      let ok = 0;
      let errors = 0;
      const errorsByCode: Record<string, number> = {};

      for (const [id, receipt] of Object.entries(receipts)) {
        if (receipt.status === "ok") {
          ok++;
          continue;
        }

        errors++;
        const errCode = receipt.details?.error ?? "unknown";
        errorsByCode[errCode] = (errorsByCode[errCode] ?? 0) + 1;

        if (errCode === "InvalidCredentials") {
          logger.error(
            {
              receiptId: id,
              expoMessage: receipt.message,
              context,
              action: "Run `eas credentials -p ios` and add a Push Notifications Key (.p8)",
            },
            "push receipt: InvalidCredentials — APNs key not configured in EAS",
          );
        } else if (errCode === "DeviceNotRegistered") {
          // Already handled at ticket level; log at debug only
          logger.debug({ receiptId: id, context }, "push receipt: DeviceNotRegistered");
        } else {
          logger.warn(
            {
              receiptId: id,
              errorCode: errCode,
              reason: describeExpoError(errCode),
              expoMessage: receipt.message,
              context,
            },
            "push receipt: delivery error",
          );
        }
      }

      logger.info(
        { context, checked: receiptIds.length, ok, errors, errorsByCode },
        "push receipts: check complete",
      );
    } catch (err) {
      logger.error({ err, context }, "push receipts: unexpected error");
    }
  }, 30_000);
}

/** Removes expired/unregistered device tokens from the push_tokens table. */
async function purgeDeadTokens(tokens: Set<string>): Promise<void> {
  if (tokens.size === 0) return;
  const list = Array.from(tokens);
  const { error } = await supabaseAdmin.from("push_tokens").delete().in("token", list);
  if (error) {
    logger.warn({ err: error, count: list.length }, "push: failed to purge dead tokens");
  } else {
    logger.info({ count: list.length }, "push: purged dead tokens");
  }
}

/**
 * Sends a push notification to a single user (across all of their registered
 * devices/tokens). Fire-and-forget — does not throw. Silently skips when the
 * user has no registered push tokens.
 */
export async function sendPushToUser(opts: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: tokenRows, error } = await supabaseAdmin
      .from("push_tokens")
      .select("token")
      .eq("user_id", opts.userId);

    if (error) {
      logger.error({ err: error, userId: opts.userId }, "push: failed to fetch push_tokens");
      return;
    }

    const validTokens = (tokenRows ?? [])
      .map((r: { token: string }) => r.token)
      .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));

    if (validTokens.length === 0) return;

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
      sound: "default",
    }));

    const { dead, receiptIds, errorCount } = await sendExpoPushChunks(messages);

    void purgeDeadTokens(dead);
    scheduleReceiptCheck(receiptIds, `sendPushToUser:${opts.userId}`);

    logger.info(
      {
        userId: opts.userId,
        title: opts.title,
        sent: messages.length,
        errors: errorCount,
        receiptsScheduled: receiptIds.length,
      },
      "push: dispatched to user",
    );
  } catch (err) {
    logger.error({ err, userId: opts.userId }, "push: sendPushToUser unexpected error");
  }
}

/**
 * Sends a push notification to ALL registered users (broadcast).
 * Excludes the `excludeUserId` (typically the author so they don't notify themselves).
 * Fire-and-forget — does not throw.
 */
export async function broadcastPushToAllUsers(opts: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  excludeUserId?: string;
}): Promise<void> {
  try {
    const query = supabaseAdmin
      .from("push_tokens")
      .select("token");

    if (opts.excludeUserId) {
      query.neq("user_id", opts.excludeUserId);
    }

    const { data: tokenRows, error } = await query;
    if (error) {
      logger.error({ err: error }, "push: broadcastPush failed to fetch push_tokens");
      return;
    }

    const validTokens = (tokenRows ?? [])
      .map((r: { token: string }) => r.token)
      .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));

    if (validTokens.length === 0) {
      logger.info("push: broadcastPush — no valid tokens, skipping");
      return;
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
      sound: "default",
    }));

    const { dead, receiptIds, errorCount } = await sendExpoPushChunks(messages);

    void purgeDeadTokens(dead);
    scheduleReceiptCheck(receiptIds, "broadcastPushToAllUsers");

    logger.info(
      {
        sent: messages.length,
        title: opts.title,
        errors: errorCount,
        receiptsScheduled: receiptIds.length,
      },
      "push: broadcastPush dispatched",
    );
  } catch (err) {
    logger.error({ err }, "push: broadcastPush unexpected error");
  }
}
