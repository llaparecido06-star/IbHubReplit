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

async function sendExpoPushChunks(messages: ExpoPushMessage[]): Promise<void> {
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
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
      }
    } catch (err) {
      logger.error({ err }, "Failed to send Expo push chunk");
    }
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

    await sendExpoPushChunks(messages);
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

    await sendExpoPushChunks(messages);
    logger.info({ count: messages.length, title: opts.title }, "broadcastPush: sent");
  } catch (err) {
    logger.error({ err }, "broadcastPush: unexpected error");
  }
}
