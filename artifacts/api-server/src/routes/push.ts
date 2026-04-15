import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import { resolveUserId } from "../lib/planCheck.js";

const router = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
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
      logger.error({ err }, "Failed to send Expo push notification");
    }
  }
}

/**
 * POST /api/push/send
 * Requires authentication (Bearer token).
 *
 * Body (option A — direct tokens): { tokens: string[], title, body, data?, activeConversationId? }
 * Body (option B — server-side lookup): { recipientUserIds: string[], title, body, data?, activeConversationId? }
 *
 * Option B is preferred: the server looks up push tokens via service role so
 * clients never need RLS access to other users' push_tokens rows.
 */
router.post("/push/send", async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const { tokens: rawTokens, recipientUserIds, title, body, data, activeConversationId } = req.body as {
    tokens?: string[];
    recipientUserIds?: string[];
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    activeConversationId?: string;
  };

  let validTokens: string[] = [];

  if (recipientUserIds && Array.isArray(recipientUserIds) && recipientUserIds.length > 0) {
    // Server-side token lookup via service role — clients never need push_tokens SELECT
    const { data: tokenRows } = await supabaseAdmin
      .from("push_tokens")
      .select("token")
      .in("user_id", recipientUserIds);
    validTokens = (tokenRows ?? [])
      .map((r: { token: string }) => r.token)
      .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));
  } else if (rawTokens && Array.isArray(rawTokens)) {
    // Legacy path: client supplies tokens directly (still validated)
    validTokens = rawTokens.filter(
      (t) => typeof t === "string" && t.startsWith("ExponentPushToken["),
    );
  }

  if (validTokens.length === 0) {
    res.status(200).json({ sent: 0, skipped: "no valid expo push tokens" });
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: title ?? "Nova mensagem",
    body: body ?? "Você tem uma nova mensagem",
    data: { ...data, activeConversationId },
    sound: "default",
  }));

  await sendExpoPushNotifications(messages);
  logger.info({ count: messages.length, caller: callerId }, "Push notifications dispatched");
  res.json({ sent: messages.length });
});

export default router;
