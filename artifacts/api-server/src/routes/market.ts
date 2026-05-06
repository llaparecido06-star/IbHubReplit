import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId, requirePlanFeature, requireAdmin } from "../lib/planCheck.js";
import { broadcastPushToAllUsers } from "../lib/pushUtils.js";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Cache the Ideal.BI company page ID ─────────────────────────────────────
// All market posts are published on behalf of the Ideal.BI company page.
// We cache this at runtime so we don't query on every POST.
let idealbiCompanyPageId: string | null | undefined = undefined; // undefined = not yet fetched

async function getIdealbiCompanyPageId(): Promise<string | null> {
  if (idealbiCompanyPageId !== undefined) return idealbiCompanyPageId;
  const { data } = await supabaseAdmin
    .from("company_pages")
    .select("id")
    .ilike("name", "Ideal.BI")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const resolved: string | null = (data as { id?: string } | null)?.id ?? null;
  idealbiCompanyPageId = resolved;
  return resolved;
}

/**
 * GET /market/posts
 * Returns Ideal.BI market posts. Requires mercado:idealbi plan feature.
 * Query params: limit (default 15, max 100), offset=N (infinite scroll), since (ISO timestamp for new-post polling)
 */
router.get("/market/posts", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const limit = Math.min(parseInt(req.query.limit as string) || 15, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const since = req.query.since as string | undefined;

  let query = supabaseAdmin
    .from("market_posts")
    .select("id, author_id, company_page_id, content, image_url, video_url, poll_options, poll_allow_multiple, likes_count, comments_count, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (since) {
    query = query.gt("created_at", since);
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ posts: data ?? [] });
});

/**
 * POST /market/posts
 * Creates an Ideal.BI market post. ADMIN ONLY.
 * Only users with is_admin = true in their profile may create posts.
 * The post is always stored with the Ideal.BI company page as the owner
 * (company_page_id), regardless of which admin published it.
 */
router.post("/market/posts", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  // Only ibhub admins can publish to the Ideal.BI feed
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;

  const { content, image_url, video_url, poll_options, poll_allow_multiple } = req.body as {
    content?: string;
    image_url?: string | null;
    video_url?: string | null;
    poll_options?: unknown;
    poll_allow_multiple?: boolean;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  // Always attribute the post to the Ideal.BI company page
  const companyPageId = await getIdealbiCompanyPageId();

  const { data, error } = await supabaseAdmin
    .from("market_posts")
    .insert({
      author_id: userId,          // who physically published (for audit / notifications)
      company_page_id: companyPageId, // the company the post belongs to (always Ideal.BI)
      content: content.trim(),
      image_url: image_url ?? null,
      video_url: video_url ?? null,
      poll_options: poll_options ?? null,
      poll_allow_multiple: poll_allow_multiple ?? false,
      likes_count: 0,
      comments_count: 0,
    })
    .select("id, content, image_url, video_url, poll_options, poll_allow_multiple, created_at, author_id, company_page_id, likes_count, comments_count")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Fire-and-forget: notify all users about the new Ideal.BI post
  const previewBody = (data as any).content?.slice(0, 100) ?? "Novo conteúdo disponível";
  broadcastPushToAllUsers({
    title: "📡 Novo post Ideal.BI",
    body: previewBody,
    data: {
      type: "market_post",
      postId: (data as any).id,
      deepLink: "/(tabs)/mercado",
    },
    excludeUserId: userId,
  });

  res.status(201).json({ post: data });
});

const REPLY_PREFIX_RE = /^\[R:([0-9a-f-]{36})\]/i;

/**
 * POST /market/posts/:id/like
 * Toggle / change a reaction on a market post.
 * Body: { reaction_type: string }
 * - Same reaction as existing → unlike (remove)
 * - Different reaction → swap reaction (count unchanged)
 * - No previous reaction → add (count +1)
 * Returns: { user_liked, reaction_type, likes_count }
 */
router.post("/market/posts/:id/like", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const postId = req.params.id;
  const { reaction_type: reactionType = "saude" } = req.body as { reaction_type?: string };

  // Fetch current like state
  const { data: existing } = await supabaseAdmin
    .from("market_post_likes")
    .select("reaction_type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: postData } = await supabaseAdmin
    .from("market_posts")
    .select("likes_count")
    .eq("id", postId)
    .single();
  const currentCount = (postData as any)?.likes_count ?? 0;

  if (existing) {
    const existingReaction = (existing as any).reaction_type as string;
    if (existingReaction === reactionType) {
      // Same reaction → unlike
      await supabaseAdmin.from("market_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
      const newCount = Math.max(0, currentCount - 1);
      await supabaseAdmin.from("market_posts").update({ likes_count: newCount }).eq("id", postId);
      res.json({ user_liked: false, reaction_type: null, likes_count: newCount });
    } else {
      // Different reaction → swap (count unchanged)
      await supabaseAdmin.from("market_post_likes").update({ reaction_type: reactionType }).eq("post_id", postId).eq("user_id", userId);
      res.json({ user_liked: true, reaction_type: reactionType, likes_count: currentCount });
    }
  } else {
    // New reaction
    await supabaseAdmin.from("market_post_likes").insert({ post_id: postId, user_id: userId, reaction_type: reactionType });
    const newCount = currentCount + 1;
    await supabaseAdmin.from("market_posts").update({ likes_count: newCount }).eq("id", postId);
    res.json({ user_liked: true, reaction_type: reactionType, likes_count: newCount });
  }
});

/**
 * POST /market/posts/:id/comments
 * Add a comment to a market post.
 * Body: { content: string, reply_to_id?: string | null }
 * Returns: { comment }
 */
router.post("/market/posts/:id/comments", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const postId = req.params.id;
  const { content, reply_to_id: replyToId = null } = req.body as { content?: string; reply_to_id?: string | null };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const storedContent = replyToId ? `[R:${replyToId}]${content.trim()}` : content.trim();

  const { data: comment, error } = await supabaseAdmin
    .from("market_post_comments")
    .insert({ post_id: postId, author_id: userId, content: storedContent })
    .select("id, post_id, author_id, content, created_at")
    .single();

  if (error || !comment) {
    res.status(500).json({ error: error?.message ?? "insert failed" });
    return;
  }

  // Only increment comments_count for top-level comments (not replies)
  if (!replyToId) {
    const { data: postRow } = await supabaseAdmin.from("market_posts").select("comments_count").eq("id", postId).single();
    await supabaseAdmin.from("market_posts").update({ comments_count: ((postRow as any)?.comments_count ?? 0) + 1 }).eq("id", postId);
  }

  // Resolve author profile
  const { data: authorProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, user_id, full_name, avatar_url, position, company")
    .eq("user_id", userId)
    .maybeSingle();

  const match = REPLY_PREFIX_RE.exec((comment as any).content ?? "");
  const cleanContent = match ? (comment as any).content.slice(match[0].length) : (comment as any).content;

  res.status(201).json({
    comment: {
      ...(comment as any),
      reply_to_id: replyToId ?? null,
      content: cleanContent,
      replies: [],
      likes_count: 0,
      is_liked: false,
      author: authorProfile ?? undefined,
    },
  });
});

/**
 * POST /market/comments/:id/like
 * Toggle a like on a market comment.
 * Returns: { is_liked, likes_count }
 */
router.post("/market/comments/:id/like", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const commentId = req.params.id;

  const { data: existing } = await supabaseAdmin
    .from("market_comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: commentRow } = await supabaseAdmin
    .from("market_post_comments")
    .select("likes_count")
    .eq("id", commentId)
    .single();
  const currentCount = (commentRow as any)?.likes_count ?? 0;

  if (existing) {
    // Unlike
    await supabaseAdmin.from("market_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
    const newCount = Math.max(0, currentCount - 1);
    await supabaseAdmin.from("market_post_comments").update({ likes_count: newCount }).eq("id", commentId);
    res.json({ is_liked: false, likes_count: newCount });
  } else {
    // Like
    await supabaseAdmin.from("market_comment_likes").insert({ comment_id: commentId, user_id: userId });
    const newCount = currentCount + 1;
    await supabaseAdmin.from("market_post_comments").update({ likes_count: newCount }).eq("id", commentId);
    res.json({ is_liked: true, likes_count: newCount });
  }
});

/* ─── Ideal.BI — query sanitizer ────────────────────────────────────────── */
/**
 * Strip characters that break PostgREST's `.or()` filter DSL.
 * Keeps letters (incl. accented), digits, spaces, and hyphens.
 */
function sanitizeBiQuery(raw: string): string {
  return raw.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ0-9 \-]/g, "").slice(0, 100);
}

/* ─── Ideal.BI — Busca Importadores ──────────────────────────────────────── */

/**
 * GET /market/bi/importadores
 * Returns paginated list of wine importers.
 * Query: q (search), limit (default 20, max 100), offset (default 0)
 * Requires mercado:idealbi plan feature.
 */
router.get("/market/bi/importadores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const q = sanitizeBiQuery((req.query.q as string | undefined)?.trim() ?? "");
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  let query = supabaseAdmin
    .from("bi_importadores")
    .select("id, name, pais, segmentos, estado, created_at", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,pais.ilike.%${q}%,segmentos.ilike.%${q}%,estado.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ items: data ?? [], total: count ?? 0, limit, offset });
});

/* ─── Ideal.BI — Busca Exportadores ──────────────────────────────────────── */

/**
 * GET /market/bi/exportadores
 * Returns paginated list of wine exporters.
 * Commercial data (caixas, valor, preço) is included only for users with mercado:idealbi feature.
 * Query: q (search), limit (default 20, max 100), offset (default 0)
 * Requires mercado:idealbi plan feature.
 */
router.get("/market/bi/exportadores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const q = sanitizeBiQuery((req.query.q as string | undefined)?.trim() ?? "");
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  let query = supabaseAdmin
    .from("bi_exportadores")
    .select("id, name, pais_destino, produtos, caixas_exportadas, valor_vendido_cents, preco_medio_cents, created_at", { count: "exact" })
    .order("caixas_exportadas", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,pais_destino.ilike.%${q}%,produtos.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ items: data ?? [], total: count ?? 0, limit, offset });
});

/* ─── Ideal.BI — Busca Produtores Nacionais ──────────────────────────────── */

/**
 * GET /market/bi/produtores
 * Returns paginated list of national wine producers.
 * Query: q (search), limit (default 20, max 100), offset (default 0)
 * Requires mercado:idealbi plan feature.
 */
router.get("/market/bi/produtores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const q = sanitizeBiQuery((req.query.q as string | undefined)?.trim() ?? "");
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  let query = supabaseAdmin
    .from("bi_produtores")
    .select("id, name, name_fantasia, regiao, estado, tipos, fundado, created_at", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,name_fantasia.ilike.%${q}%,regiao.ilike.%${q}%,estado.ilike.%${q}%,tipos.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ items: data ?? [], total: count ?? 0, limit, offset });
});

/* ─── Ideal.BI Admin — Importadores (POST / PATCH / DELETE) ─────────────── */

router.post("/market/bi/importadores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { name, pais, segmentos, estado } = req.body as Record<string, string | undefined>;
  if (!name?.trim() || !pais?.trim() || !segmentos?.trim() || !estado?.trim()) {
    res.status(400).json({ error: "name, pais, segmentos e estado são obrigatórios" }); return;
  }
  const { data, error } = await supabaseAdmin.from("bi_importadores")
    .insert({ name: name.trim(), pais: pais.trim(), segmentos: segmentos.trim(), estado: estado.trim() })
    .select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/market/bi/importadores/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { name, pais, segmentos, estado } = req.body as Record<string, string | undefined>;
  const updates: Record<string, string> = {};
  if (name?.trim()) updates.name = name.trim();
  if (pais?.trim()) updates.pais = pais.trim();
  if (segmentos?.trim()) updates.segmentos = segmentos.trim();
  if (estado?.trim()) updates.estado = estado.trim();
  if (!Object.keys(updates).length) { res.status(400).json({ error: "Nenhum campo enviado" }); return; }
  const { data, error } = await supabaseAdmin.from("bi_importadores").update(updates).eq("id", req.params.id).select().maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Importador não encontrado" }); return; }
  res.json(data);
});

router.delete("/market/bi/importadores/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { error } = await supabaseAdmin.from("bi_importadores").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).end();
});

/* ─── Ideal.BI Admin — Exportadores (POST / PATCH / DELETE) ─────────────── */

router.post("/market/bi/exportadores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { name, pais_destino, produtos, caixas_exportadas, valor_vendido_cents, preco_medio_cents } = req.body as {
    name?: string; pais_destino?: string; produtos?: string;
    caixas_exportadas?: number; valor_vendido_cents?: number; preco_medio_cents?: number;
  };
  if (!name?.trim() || !pais_destino?.trim() || !produtos?.trim()) {
    res.status(400).json({ error: "name, pais_destino e produtos são obrigatórios" }); return;
  }
  const { data, error } = await supabaseAdmin.from("bi_exportadores").insert({
    name: name.trim(), pais_destino: pais_destino.trim(), produtos: produtos.trim(),
    caixas_exportadas: caixas_exportadas ?? 0,
    valor_vendido_cents: valor_vendido_cents ?? 0,
    preco_medio_cents: preco_medio_cents ?? 0,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/market/bi/exportadores/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const body = req.body as Record<string, string | number | undefined>;
  const updates: Record<string, string | number> = {};
  const strings = ["name", "pais_destino", "produtos"] as const;
  const numbers = ["caixas_exportadas", "valor_vendido_cents", "preco_medio_cents"] as const;
  strings.forEach(k => { if (typeof body[k] === "string" && (body[k] as string).trim()) updates[k] = (body[k] as string).trim(); });
  numbers.forEach(k => { if (typeof body[k] === "number") updates[k] = body[k] as number; });
  if (!Object.keys(updates).length) { res.status(400).json({ error: "Nenhum campo enviado" }); return; }
  const { data, error } = await supabaseAdmin.from("bi_exportadores").update(updates).eq("id", req.params.id).select().maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Exportador não encontrado" }); return; }
  res.json(data);
});

router.delete("/market/bi/exportadores/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { error } = await supabaseAdmin.from("bi_exportadores").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).end();
});

/* ─── Ideal.BI Admin — Produtores (POST / PATCH / DELETE) ───────────────── */

router.post("/market/bi/produtores", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { name, name_fantasia, regiao, estado, tipos, fundado } = req.body as { name?: string; name_fantasia?: string | null; regiao?: string; estado?: string | null; tipos?: string; fundado?: number | null };
  if (!name?.trim() || !regiao?.trim() || !tipos?.trim()) {
    res.status(400).json({ error: "name, regiao e tipos são obrigatórios" }); return;
  }
  const { data, error } = await supabaseAdmin.from("bi_produtores").insert({
    name: name.trim(), name_fantasia: name_fantasia?.trim() || null,
    regiao: regiao.trim(), estado: estado?.trim() || null,
    tipos: tipos.trim(), fundado: fundado ?? null,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/market/bi/produtores/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { name, name_fantasia, regiao, estado, tipos, fundado } = req.body as { name?: string; name_fantasia?: string | null; regiao?: string; estado?: string | null; tipos?: string; fundado?: number | null };
  const updates: Record<string, string | number | null> = {};
  if (name?.trim()) updates.name = name.trim();
  if (name_fantasia !== undefined) updates.name_fantasia = name_fantasia?.trim() || null;
  if (regiao?.trim()) updates.regiao = regiao.trim();
  if (estado !== undefined) updates.estado = estado?.trim() || null;
  if (tipos?.trim()) updates.tipos = tipos.trim();
  if (fundado !== undefined) updates.fundado = fundado;
  if (!Object.keys(updates).length) { res.status(400).json({ error: "Nenhum campo enviado" }); return; }
  const { data, error } = await supabaseAdmin.from("bi_produtores").update(updates).eq("id", req.params.id).select().maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Produtor não encontrado" }); return; }
  res.json(data);
});

router.delete("/market/bi/produtores/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { error } = await supabaseAdmin.from("bi_produtores").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).end();
});

export default router;

