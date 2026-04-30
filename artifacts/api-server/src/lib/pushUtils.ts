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

/**
 * Sends push messages to Expo in chunks of 100 and returns the set of tokens
 * that came back as `DeviceNotRegistered` so callers can purge them.
 */
async function sendExpoPushChunks(messages: ExpoPushMessage[]): Promise<Set<string>> {
  const deadTokens = new Set<string>();
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
        logger.warn({ status: res.status }, "Expo push API returned non-OK");
      } else {
        const json = await res.json() as { data?: ExpoTicket[] };
        const tickets = json.data ?? [];
        tickets.forEach((ticket, idx) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            const token = messages[offset + idx]?.to;
            if (token) deadTokens.add(token);
          }
        });
      }
    } catch (err) {
      logger.error({ err }, "Failed to send Expo push chunk");
    }
    offset += chunk.length;
  }
  return deadTokens;
}

/** Removes expired/unregistered device tokens from the push_tokens table. */
async function purgeDeadTokens(tokens: Set<string>): Promise<void> {
  if (tokens.size === 0) return;
  const list = Array.from(tokens);
  const { error } = await supabaseAdmin.from("push_tokens").delete().in("token", list);
  if (error) {
    logger.warn({ err: error, count: list.length }, "pushUtils: failed to purge dead tokens");
  } else {
    logger.info({ count: list.length }, "pushUtils: purged dead tokens");
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
      logger.error({ err: error, userId: opts.userId }, "sendPushToUser: failed to fetch push_tokens");
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

    const dead = await sendExpoPushChunks(messages);
    void purgeDeadTokens(dead);

    logger.info(
      { count: messages.length, userId: opts.userId, title: opts.title },
      "sendPushToUser: sent",
    );
  } catch (err) {
    logger.error({ err, userId: opts.userId }, "sendPushToUser: unexpected error");
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
      logger.error({ err: error }, "broadcastPush: failed to fetch push_tokens");
      return;
    }

    const validTokens = (tokenRows ?? [])
      .map((r: { token: string }) => r.token)
      .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));

    if (validTokens.length === 0) {
      logger.info("broadcastPush: no valid tokens found — skipping");
      return;
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
      sound: "default",
    }));

    const dead = await sendExpoPushChunks(messages);
    void purgeDeadTokens(dead);

    logger.info({ count: messages.length, title: opts.title }, "broadcastPush: sent");
  } catch (err) {
    logger.error({ err }, "broadcastPush: unexpected error");
  }
}
