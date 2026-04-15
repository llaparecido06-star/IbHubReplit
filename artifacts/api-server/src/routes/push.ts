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

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Max 20 push dispatches per user per 60 seconds.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count += 1;
  return true;
}

// Periodically purge expired entries to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 120_000);

// ─── POST /push/send ─────────────────────────────────────────────────────────
/**
 * Dispatches Expo push notifications to conversation participants.
 * Requires authentication. The caller MUST be a participant in the conversation.
 *
 * Body: { conversationId: string, title: string, body: string, data?: object }
 *
 * The server resolves recipient user IDs from `conversation_participants`
 * and looks up their push tokens via service role. Clients never directly
 * supply token lists or recipient IDs — authorization is derived from
 * the conversation relationship.
 */
router.post("/push/send", async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  // Rate limit: 20 dispatches per user per minute
  if (!checkRateLimit(callerId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { conversationId, title, body, data } = req.body as {
    conversationId?: string;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };

  if (!conversationId || typeof conversationId !== "string") {
    res.status(400).json({ error: "conversationId is required" });
    return;
  }

  // Verify caller is a participant in this conversation (authorization check)
  const { data: callerParticipant, error: participantErr } = await supabaseAdmin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", callerId)
    .maybeSingle();

  if (participantErr) {
    logger.error({ err: participantErr, conversationId, callerId }, "DB error verifying participant");
    res.status(500).json({ error: "Erro ao verificar participação na conversa." });
    return;
  }
  if (!callerParticipant) {
    res.status(403).json({ error: "Você não é participante desta conversa." });
    return;
  }

  // Resolve all other participants server-side (service role — no RLS bypass risk)
  const { data: participants, error: participantsErr } = await supabaseAdmin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", callerId);

  if (participantsErr) {
    logger.error({ err: participantsErr, conversationId }, "DB error fetching participants");
    res.status(500).json({ error: "Erro ao buscar participantes da conversa." });
    return;
  }

  if (!participants || participants.length === 0) {
    res.status(200).json({ sent: 0, skipped: "no other participants" });
    return;
  }

  const recipientIds = participants.map((p: { user_id: string }) => p.user_id);

  // Look up push tokens for recipients
  const { data: tokenRows, error: tokensErr } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .in("user_id", recipientIds);

  if (tokensErr) {
    logger.error({ err: tokensErr, conversationId }, "DB error fetching push tokens");
    res.status(500).json({ error: "Erro ao buscar tokens de notificação." });
    return;
  }

  const validTokens = (tokenRows ?? [])
    .map((r: { token: string }) => r.token)
    .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));

  if (validTokens.length === 0) {
    res.status(200).json({ sent: 0, skipped: "no valid expo push tokens" });
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: title ?? "Nova mensagem",
    body: body ?? "Você tem uma nova mensagem",
    data: { ...data, conversationId },
    sound: "default",
  }));

  await sendExpoPushNotifications(messages);
  logger.info({ count: messages.length, conversationId, caller: callerId }, "Push notifications dispatched");
  res.json({ sent: messages.length });
});

export default router;
