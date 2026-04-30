import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import { resolveUserId } from "../lib/planCheck.js";
import { extractWineName, truncate } from "../lib/winePost.js";

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

// ─── POST /push/social ────────────────────────────────────────────────────────
/**
 * Sends a push notification to the post author when someone likes or comments
 * on their post from the web app.
 *
 * Body: { type: "like"|"comment", postId: string, actorName: string, commentText?: string }
 * Auth: Bearer token (resolves actorId — the person who acted)
 */
router.post("/push/social", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { type, postId, actorName, commentText } = req.body as {
    type?: string;
    postId?: string;
    actorName?: string;
    commentText?: string;
  };

  if (!type || !postId || !actorName) {
    res.status(400).json({ error: "type, postId e actorName são obrigatórios" });
    return;
  }

  if (type !== "like" && type !== "comment") {
    res.status(400).json({ error: "type deve ser 'like' ou 'comment'" });
    return;
  }

  interface PostRow {
    user_id: string;
    company_page_id: string | null;
    content: string | null;
  }

  interface CompanyRow {
    owner_id: string;
  }

  // Fetch the post to get its author, company ownership, and content.
  // Wine reviews surface their wine name in the notification preview.
  const { data: postRow, error: postErr } = await supabaseAdmin
    .from("posts")
    .select("user_id, company_page_id, content")
    .eq("id", postId)
    .maybeSingle() as { data: PostRow | null; error: unknown };

  if (postErr || !postRow) {
    res.status(404).json({ error: "Post não encontrado." });
    return;
  }

  const wineName = extractWineName(postRow.content);
  // Cap the wine name length so it stays legible on a notification banner.
  const wineLabel = wineName ? truncate(wineName, 60) : null;

  const companyPageId: string | null = postRow.company_page_id;

  // ── Company post: find the company owner and notify them ──────────────────
  if (companyPageId) {
    const { data: companyRow, error: companyErr } = await supabaseAdmin
      .from("company_pages")
      .select("owner_id")
      .eq("id", companyPageId)
      .maybeSingle() as { data: CompanyRow | null; error: unknown };

    if (companyErr) {
      logger.error({ err: companyErr, postId, companyPageId }, "DB error fetching company owner for social push");
      res.status(500).json({ error: "Erro ao buscar dados da empresa." });
      return;
    }

    const companyOwnerId: string | null = companyRow?.owner_id ?? null;

    // Skip if the actor is the company owner (they acted on their own post)
    if (!companyOwnerId || companyOwnerId === actorId) {
      res.json({ sent: 0, skipped: "actor is company owner or owner not found" });
      return;
    }

    const { data: tokenRows, error: tokensErr } = await supabaseAdmin
      .from("push_tokens")
      .select("token")
      .eq("user_id", companyOwnerId);

    if (tokensErr) {
      logger.error({ err: tokensErr, postId, companyOwnerId }, "DB error fetching push tokens for company social push");
      res.status(500).json({ error: "Erro ao buscar tokens." });
      return;
    }

    const validTokens = (tokenRows ?? [])
      .map((r: { token: string }) => r.token)
      .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));

    if (validTokens.length === 0) {
      res.json({ sent: 0, skipped: "no valid tokens for company owner" });
      return;
    }

    let title: string;
    let body: string;

    if (type === "comment") {
      title = wineLabel
        ? `💬 ${actorName} comentou a avaliação do ${wineLabel}`
        : `💬 ${actorName} comentou na publicação da empresa`;
      body = commentText ? truncate(commentText, 80) : "Veja o que disseram.";
    } else {
      title = wineLabel
        ? `❤️ ${actorName} curtiu a avaliação do ${wineLabel}`
        : `❤️ ${actorName} curtiu a publicação da empresa`;
      body = wineLabel ? "Toque para ver a ficha do vinho." : "Toque para ver.";
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      title,
      body,
      data: { postId, type, deepLink: `/post/${postId}` },
      sound: "default",
    }));

    await sendExpoPushNotifications(messages);
    logger.info({ count: messages.length, postId, type, actorId, companyOwnerId }, "Company social push dispatched");
    res.json({ sent: messages.length });
    return;
  }

  // ── Personal post: notify the post author ─────────────────────────────────
  const authorId: string = postRow.user_id;

  // Don't notify if actor is the post author
  if (authorId === actorId) {
    res.json({ sent: 0, skipped: "actor is author" });
    return;
  }

  // Fetch push tokens for the post author
  const { data: tokenRows, error: tokensErr } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .eq("user_id", authorId);

  if (tokensErr) {
    logger.error({ err: tokensErr, postId, authorId }, "DB error fetching push tokens for social push");
    res.status(500).json({ error: "Erro ao buscar tokens." });
    return;
  }

  const validTokens = (tokenRows ?? [])
    .map((r: { token: string }) => r.token)
    .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));

  if (validTokens.length === 0) {
    res.json({ sent: 0, skipped: "no valid tokens for author" });
    return;
  }

  let title: string;
  let body: string;

  if (type === "comment") {
    title = wineLabel
      ? `💬 ${actorName} comentou sua avaliação do ${wineLabel}`
      : `💬 ${actorName} comentou na sua publicação`;
    body = commentText ? truncate(commentText, 80) : "Veja o que disseram.";
  } else {
    title = wineLabel
      ? `❤️ ${actorName} curtiu sua avaliação do ${wineLabel}`
      : `❤️ ${actorName} curtiu sua publicação`;
    body = wineLabel ? "Toque para ver a ficha do vinho." : "Toque para ver.";
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title,
    body,
    // `deepLink` is read by the Expo app's notification-response handler
    // (artifacts/ibhub/app/_layout.tsx) and routed via expo-router. Pointing
    // at /post/<id> opens the structured wine card on mobile; the web app's
    // in-app notification list deep-links to the same canonical id.
    data: { postId, type, deepLink: `/post/${postId}` },
    sound: "default",
  }));

  await sendExpoPushNotifications(messages);
  logger.info({ count: messages.length, postId, type, actorId }, "Social push dispatched");
  res.json({ sent: messages.length });
});

// ─── POST /push/mention ───────────────────────────────────────────────────────
/**
 * Sends push notifications to all users/companies mentioned via @ in a post or comment.
 * Body: { mentionedUserIds: string[], actorName: string, postId?: string, commentId?: string, contextText?: string }
 */
router.post("/push/mention", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { mentionedUserIds, actorName, postId, commentId, contextText } = req.body as {
    mentionedUserIds?: string[];
    actorName?: string;
    postId?: string;
    commentId?: string;
    contextText?: string;
  };

  if (!mentionedUserIds?.length || !actorName) {
    res.status(400).json({ error: "mentionedUserIds e actorName são obrigatórios" });
    return;
  }

  // Exclude actor from recipients
  const recipientIds = mentionedUserIds.filter(id => id !== actorId);
  if (!recipientIds.length) {
    res.json({ sent: 0, skipped: "actor is the only mentionee" });
    return;
  }

  const { data: tokenRows, error: tokensErr } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .in("user_id", recipientIds);

  if (tokensErr) {
    logger.error({ err: tokensErr }, "DB error fetching push tokens for mention");
    res.status(500).json({ error: "Erro ao buscar tokens." });
    return;
  }

  const validTokens = (tokenRows ?? [])
    .map((r: { token: string }) => r.token)
    .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));

  if (validTokens.length === 0) {
    res.json({ sent: 0, skipped: "no valid tokens for mentioned users" });
    return;
  }

  const where = commentId ? "comentário" : "publicação";
  const body = contextText
    ? (contextText.length > 80 ? contextText.slice(0, 80) + "…" : contextText)
    : `Toque para ver o ${where}.`;

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: `@ ${actorName} mencionou você em um ${where}`,
    body,
    data: { postId, commentId, type: "mention" },
    sound: "default" as const,
  }));

  await sendExpoPushNotifications(messages);
  logger.info({ count: messages.length, actorId, postId, commentId }, "Mention push dispatched");
  res.json({ sent: messages.length });
});

export default router;
