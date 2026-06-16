import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import { resolveUserId } from "../lib/planCheck.js";
import { extractWineName, truncate } from "../lib/winePost.js";
import { sendPushToUser } from "../lib/pushUtils.js";
import { sendWebPushToUser } from "../lib/webPushUtils.js";

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

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Sends Expo push messages in chunks, parses tickets, and purges
 * `DeviceNotRegistered` tokens from the database automatically.
 */
async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  const deadTokens: string[] = [];
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
        (json.data ?? []).forEach((ticket, idx) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            const token = messages[offset + idx]?.to;
            if (token) deadTokens.push(token);
          }
        });
      }
    } catch (err) {
      logger.error({ err }, "Failed to send Expo push notification");
    }
    offset += chunk.length;
  }
  if (deadTokens.length > 0) {
    void supabaseAdmin.from("push_tokens").delete().in("token", deadTokens).then(({ error }) => {
      if (error) logger.warn({ err: error, count: deadTokens.length }, "push.ts: failed to purge dead tokens");
      else logger.info({ count: deadTokens.length }, "push.ts: purged dead tokens");
    });
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

// ─── Helper: resolve actor display name from DB ───────────────────────────────
async function resolveActorName(actorId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", actorId)
    .maybeSingle() as { data: { full_name: string | null } | null };
  return data?.full_name ?? "Alguém";
}

// ─── POST /push/connection ────────────────────────────────────────────────────
/**
 * Sends a push notification to the target user when the caller sends them a
 * connection request. The actor's display name is resolved server-side from
 * their auth token — clients don't supply it.
 *
 * Body: { targetId: string }
 * Auth: Bearer token (resolves actorId)
 */
router.post("/push/connection", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { targetId } = req.body as { targetId?: string };

  if (!targetId) {
    res.status(400).json({ error: "targetId é obrigatório" });
    return;
  }

  if (targetId === actorId) {
    res.json({ sent: 0, skipped: "actor is target" });
    return;
  }

  const actorName = await resolveActorName(actorId);

  await sendPushToUser({
    userId: targetId,
    title: "🤝 Novo pedido de conexão",
    body: `${actorName} quer se conectar com você`,
    data: { type: "connection", actorId, deepLink: `/profile/${actorId}` },
  });

  logger.info({ actorId, targetId }, "Connection request push dispatched");
  res.json({ sent: 1 });
});

// ─── POST /push/connection-accepted ──────────────────────────────────────────
/**
 * Sends a push notification to the original requester when their connection
 * request is accepted. The acceptor's name is resolved server-side.
 *
 * Body: { requesterId: string }
 * Auth: Bearer token (resolves acceptorId — the person who accepted)
 */
router.post("/push/connection-accepted", async (req: Request, res: Response): Promise<void> => {
  const acceptorId = await resolveUserId(req, res);
  if (!acceptorId) return;

  if (!checkRateLimit(acceptorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { requesterId } = req.body as { requesterId?: string };

  if (!requesterId) {
    res.status(400).json({ error: "requesterId é obrigatório" });
    return;
  }

  if (requesterId === acceptorId) {
    res.json({ sent: 0, skipped: "actor is requester" });
    return;
  }

  const actorName = await resolveActorName(acceptorId);

  await sendPushToUser({
    userId: requesterId,
    title: "✅ Conexão aceita!",
    body: `${actorName} aceitou seu pedido de conexão`,
    data: { type: "connection_accepted", actorId: acceptorId, deepLink: `/profile/${acceptorId}` },
  });

  logger.info({ acceptorId, requesterId }, "Connection accepted push dispatched");
  res.json({ sent: 1 });
});

// ─── POST /push/follow ────────────────────────────────────────────────────────
/**
 * Sends a push notification to the target user when the caller starts following them.
 * The follower's name is resolved server-side.
 *
 * Body: { targetId: string }
 * Auth: Bearer token (resolves actorId)
 */
router.post("/push/follow", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { targetId } = req.body as { targetId?: string };

  if (!targetId) {
    res.status(400).json({ error: "targetId é obrigatório" });
    return;
  }

  if (targetId === actorId) {
    res.json({ sent: 0, skipped: "actor is target" });
    return;
  }

  const actorName = await resolveActorName(actorId);

  await sendPushToUser({
    userId: targetId,
    title: "👤 Novo seguidor",
    body: `${actorName} começou a seguir você`,
    data: { type: "follow", actorId, deepLink: `/profile/${actorId}` },
  });

  logger.info({ actorId, targetId }, "Follow push dispatched");
  res.json({ sent: 1 });
});

// ─── POST /push/comment-reply ─────────────────────────────────────────────────
/**
 * Sends a push + creates an in-app-style push when someone replies to a comment.
 * The parent comment author is looked up server-side.
 *
 * Body: { parentCommentId: string, commentText?: string }
 * Auth: Bearer token (resolves actorId — the person replying)
 */
router.post("/push/comment-reply", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { parentCommentId, commentText } = req.body as {
    parentCommentId?: string;
    commentText?: string;
  };

  if (!parentCommentId) {
    res.status(400).json({ error: "parentCommentId é obrigatório" });
    return;
  }

  interface CommentRow { user_id: string; post_id: string }
  const { data: parentComment } = await supabaseAdmin
    .from("comments")
    .select("user_id, post_id")
    .eq("id", parentCommentId)
    .maybeSingle() as { data: CommentRow | null };

  if (!parentComment) {
    res.status(404).json({ error: "Comentário pai não encontrado." });
    return;
  }

  const targetId = parentComment.user_id;
  if (targetId === actorId) {
    res.json({ sent: 0, skipped: "actor is comment author" });
    return;
  }

  const actorName = await resolveActorName(actorId);
  const body = commentText
    ? (commentText.length > 80 ? commentText.slice(0, 80) + "…" : commentText)
    : "Toque para ver a resposta.";

  await sendPushToUser({
    userId: targetId,
    title: `💬 ${actorName} respondeu seu comentário`,
    body,
    data: {
      type: "comment_reply",
      postId: parentComment.post_id,
      parentCommentId,
      actorId,
      deepLink: `/post/${parentComment.post_id}`,
    },
  });

  logger.info({ actorId, targetId, parentCommentId }, "Comment reply push dispatched");
  res.json({ sent: 1 });
});

// ─── POST /push/comment-like ──────────────────────────────────────────────────
/**
 * Sends a push when someone likes a comment.
 * The comment author is looked up server-side.
 *
 * Body: { commentId: string }
 * Auth: Bearer token (resolves actorId)
 */
router.post("/push/comment-like", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { commentId } = req.body as { commentId?: string };

  if (!commentId) {
    res.status(400).json({ error: "commentId é obrigatório" });
    return;
  }

  interface CommentRow { user_id: string; post_id: string }
  const { data: comment } = await supabaseAdmin
    .from("comments")
    .select("user_id, post_id")
    .eq("id", commentId)
    .maybeSingle() as { data: CommentRow | null };

  if (!comment) {
    res.status(404).json({ error: "Comentário não encontrado." });
    return;
  }

  const targetId = comment.user_id;
  if (targetId === actorId) {
    res.json({ sent: 0, skipped: "actor is comment author" });
    return;
  }

  const actorName = await resolveActorName(actorId);

  await sendPushToUser({
    userId: targetId,
    title: `❤️ ${actorName} curtiu seu comentário`,
    body: "Toque para ver.",
    data: {
      type: "comment_like",
      postId: comment.post_id,
      commentId,
      actorId,
      deepLink: `/post/${comment.post_id}`,
    },
  });

  logger.info({ actorId, targetId, commentId }, "Comment like push dispatched");
  res.json({ sent: 1 });
});

// ─── POST /push/company-follow ────────────────────────────────────────────────
/**
 * Sends a push to the company owner when someone follows their company page.
 * The company owner is resolved server-side from the companyId.
 *
 * Body: { companyId: string }
 * Auth: Bearer token (resolves actorId — the follower)
 */
router.post("/push/company-follow", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { companyId } = req.body as { companyId?: string };

  if (!companyId) {
    res.status(400).json({ error: "companyId é obrigatório" });
    return;
  }

  interface CompanyRow { owner_id: string; name: string }
  const { data: company } = await supabaseAdmin
    .from("company_pages")
    .select("owner_id, name")
    .eq("id", companyId)
    .maybeSingle() as { data: CompanyRow | null };

  if (!company) {
    res.status(404).json({ error: "Empresa não encontrada." });
    return;
  }

  const targetId = company.owner_id;
  if (targetId === actorId) {
    res.json({ sent: 0, skipped: "actor is company owner" });
    return;
  }

  const actorName = await resolveActorName(actorId);

  await sendPushToUser({
    userId: targetId,
    title: `👤 Novo seguidor na empresa`,
    body: `${actorName} começou a seguir ${company.name}`,
    data: {
      type: "company_follow",
      companyId,
      actorId,
      deepLink: `/empresa/${companyId}`,
    },
  });

  logger.info({ actorId, targetId, companyId }, "Company follow push dispatched");
  res.json({ sent: 1 });
});

// ─── POST /push/event-rsvp ────────────────────────────────────────────────────
/**
 * Sends a push to the event organizer when someone confirms attendance.
 * Event title and organizer are resolved server-side from eventId.
 *
 * Body: { eventId: string }
 * Auth: Bearer token (resolves actorId — the attendee)
 */
router.post("/push/event-rsvp", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { eventId } = req.body as { eventId?: string };

  if (!eventId) {
    res.status(400).json({ error: "eventId é obrigatório" });
    return;
  }

  interface EventRow { organizer_id: string; title: string }
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("organizer_id, title")
    .eq("id", eventId)
    .maybeSingle() as { data: EventRow | null };

  if (!event) {
    res.status(404).json({ error: "Evento não encontrado." });
    return;
  }

  const targetId = event.organizer_id;
  if (targetId === actorId) {
    res.json({ sent: 0, skipped: "actor is organizer" });
    return;
  }

  const actorName = await resolveActorName(actorId);
  const eventLabel = event.title.length > 50 ? event.title.slice(0, 50) + "…" : event.title;

  await sendPushToUser({
    userId: targetId,
    title: `🎉 Nova confirmação de presença`,
    body: `${actorName} vai ao seu evento "${eventLabel}"`,
    data: {
      type: "event_rsvp",
      eventId,
      actorId,
      deepLink: `/event/${eventId}`,
    },
  });

  logger.info({ actorId, targetId, eventId }, "Event RSVP push dispatched");
  res.json({ sent: 1 });
});

// ─── POST /push/story-tag ─────────────────────────────────────────────────────
/**
 * Sends push notifications to users that were tagged (marcados) in a Story (Momento).
 * Body: { taggedUserIds: string[], actorName: string, storyId?: string }
 * Auth: Bearer token (resolves actorId — the story creator)
 */
router.post("/push/story-tag", async (req: Request, res: Response): Promise<void> => {
  const actorId = await resolveUserId(req, res);
  if (!actorId) return;

  if (!checkRateLimit(actorId)) {
    res.status(429).json({ error: "Muitas solicitações — tente novamente em breve." });
    return;
  }

  const { taggedUserIds, actorName, storyId } = req.body as {
    taggedUserIds?: string[];
    actorName?: string;
    storyId?: string;
  };

  if (!taggedUserIds?.length || !actorName) {
    res.status(400).json({ error: "taggedUserIds e actorName são obrigatórios" });
    return;
  }

  const recipientIds = taggedUserIds.filter(id => id !== actorId);
  if (!recipientIds.length) {
    res.json({ sent: 0, skipped: "actor is the only tagged user" });
    return;
  }

  const { data: tokenRows, error: tokensErr } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .in("user_id", recipientIds);

  if (tokensErr) {
    logger.error({ err: tokensErr }, "DB error fetching push tokens for story-tag");
    res.status(500).json({ error: "Erro ao buscar tokens." });
    return;
  }

  const validTokens = (tokenRows ?? [])
    .map((r: { token: string }) => r.token)
    .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken["));

  if (validTokens.length === 0) {
    res.json({ sent: 0, skipped: "no valid tokens for tagged users" });
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: `📍 ${actorName} marcou você em um Momento`,
    body: "Toque para ver o Momento.",
    data: { storyId, type: "story_tag", deepLink: storyId ? `/story/${storyId}` : "/" },
    sound: "default" as const,
  }));

  await sendExpoPushNotifications(messages);
  logger.info({ count: messages.length, actorId, recipientCount: recipientIds.length }, "Story-tag push dispatched");
  res.json({ sent: messages.length });
});

// ─── POST /push/web/subscribe ─────────────────────────────────────────────────
/**
 * Saves a browser Web Push subscription for the authenticated user.
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 */
router.post("/push/web/subscribe", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const { endpoint, keys } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "endpoint, keys.p256dh e keys.auth são obrigatórios" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("web_push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    logger.error({ err: error, userId }, "web push: failed to save subscription");
    res.status(500).json({ error: "Erro ao salvar subscription." });
    return;
  }

  logger.info({ userId, endpoint: endpoint.slice(-20) }, "web push: subscription saved");
  res.json({ ok: true });
});

// ─── DELETE /push/web/unsubscribe ─────────────────────────────────────────────
/**
 * Removes a browser Web Push subscription.
 * Body: { endpoint: string }
 */
router.delete("/push/web/unsubscribe", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const { endpoint } = req.body as { endpoint?: string };

  if (!endpoint) {
    res.status(400).json({ error: "endpoint é obrigatório" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("web_push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    logger.error({ err: error, userId }, "web push: failed to delete subscription");
    res.status(500).json({ error: "Erro ao remover subscription." });
    return;
  }

  logger.info({ userId, endpoint: endpoint.slice(-20) }, "web push: subscription removed");
  res.json({ ok: true });
});

export default router;
