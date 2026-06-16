import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId, requirePlanFeature, requireAnyPlanFeature, requireAdmin } from "../lib/planCheck.js";
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

  const allowed = await requireAnyPlanFeature(req, res, userId, ["mercado:idealbi", "mercado:feed"]);
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
 * Creates a market feed post.
 * Allowed for:
 *   - ibhub admins (is_admin = true) → post attributed to the Ideal.BI company page
 *   - owners of a company page with can_post_market = true → post attributed to their company
 * Body: { content, image_url?, video_url?, poll_options?, poll_allow_multiple? }
 */
router.post("/market/posts", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  // Fetch profile to check admin flag
  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  const isAdmin = !!(profileRow as { is_admin?: boolean } | null)?.is_admin;

  // If not admin, check if user is owner OR member (company_page_admins) of a
  // company page with can_post_market = true.
  let authorizedCompanyPageId: string | null = null;
  if (isAdmin) {
    authorizedCompanyPageId = await getIdealbiCompanyPageId();
  } else {
    // Check ownership first
    const { data: ownedRow } = await supabaseAdmin
      .from("company_pages")
      .select("id")
      .eq("owner_id", userId)
      .eq("can_post_market", true)
      .limit(1)
      .maybeSingle();
    authorizedCompanyPageId = (ownedRow as { id?: string } | null)?.id ?? null;

    // If not owner, check company_page_admins membership
    if (!authorizedCompanyPageId) {
      const { data: memberRow } = await supabaseAdmin
        .from("company_page_admins")
        .select("company_id, company_pages!inner(id, can_post_market)")
        .eq("user_id", userId)
        .eq("company_pages.can_post_market", true)
        .limit(1)
        .maybeSingle();
      const row = memberRow as { company_id?: string } | null;
      authorizedCompanyPageId = row?.company_id ?? null;
    }

    if (!authorizedCompanyPageId) {
      res.status(403).json({ error: "Sua empresa não tem permissão para publicar no feed de mercado." });
      return;
    }
  }

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

  const { data, error } = await supabaseAdmin
    .from("market_posts")
    .insert({
      author_id: userId,
      company_page_id: authorizedCompanyPageId,
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

  // Fire-and-forget: notify all users about the new market post
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

  const allowed = await requireAnyPlanFeature(req, res, userId, ["mercado:idealbi", "mercado:feed"]);
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

  const allowed = await requireAnyPlanFeature(req, res, userId, ["mercado:idealbi", "mercado:feed"]);
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

  const allowed = await requireAnyPlanFeature(req, res, userId, ["mercado:idealbi", "mercado:feed"]);
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

  const allowed = await requireAnyPlanFeature(req, res, userId, ["mercado:idealbi", "mercado:busca"]);
  if (!allowed) return;

  const q = sanitizeBiQuery((req.query.q as string | undefined)?.trim() ?? "");
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  let query = supabaseAdmin
    .from("bi_importadores")
    .select("id, name, pais, segmentos, estado, exportador, created_at", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,pais.ilike.%${q}%,segmentos.ilike.%${q}%,estado.ilike.%${q}%,exportador.ilike.%${q}%`);
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

  const allowed = await requireAnyPlanFeature(req, res, userId, ["mercado:idealbi", "mercado:busca"]);
  if (!allowed) return;

  const q = sanitizeBiQuery((req.query.q as string | undefined)?.trim() ?? "");
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  let query = supabaseAdmin
    .from("bi_exportadores")
    .select("id, name, origem_exportador, distribuidor, fob_usd, cx9l, usd_por_cx9l, created_at", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,origem_exportador.ilike.%${q}%,distribuidor.ilike.%${q}%`);
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

  const allowed = await requireAnyPlanFeature(req, res, userId, ["mercado:idealbi", "mercado:busca"]);
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
  const { name, pais, segmentos, estado, exportador } = req.body as Record<string, string | undefined>;
  if (!name?.trim() || !pais?.trim() || !segmentos?.trim()) {
    res.status(400).json({ error: "name, pais e segmentos são obrigatórios" }); return;
  }
  const { data, error } = await supabaseAdmin.from("bi_importadores")
    .insert({ name: name.trim(), pais: pais.trim(), segmentos: segmentos.trim(), estado: estado?.trim() ?? "", exportador: exportador?.trim() || null })
    .select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/market/bi/importadores/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const { name, pais, segmentos, estado, exportador } = req.body as Record<string, string | undefined>;
  const updates: Record<string, string | null> = {};
  if (name?.trim()) updates.name = name.trim();
  if (pais?.trim()) updates.pais = pais.trim();
  if (segmentos?.trim()) updates.segmentos = segmentos.trim();
  if (estado?.trim()) updates.estado = estado.trim();
  if (exportador !== undefined) updates.exportador = exportador?.trim() || null;
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
  const { name, origem_exportador, distribuidor, fob_usd, cx9l, usd_por_cx9l } = req.body as {
    name?: string; origem_exportador?: string; distribuidor?: string | null;
    fob_usd?: number | null; cx9l?: number | null; usd_por_cx9l?: number | null;
  };
  if (!name?.trim() || !origem_exportador?.trim()) {
    res.status(400).json({ error: "name e origem_exportador são obrigatórios" }); return;
  }
  const { data, error } = await supabaseAdmin.from("bi_exportadores").insert({
    name: name.trim(), origem_exportador: origem_exportador.trim(),
    distribuidor: typeof distribuidor === "string" ? distribuidor.trim() || null : null,
    fob_usd: fob_usd ?? null, cx9l: cx9l ?? null, usd_por_cx9l: usd_por_cx9l ?? null,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/market/bi/exportadores/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;
  const allowed = await requireAdmin(req, res, userId);
  if (!allowed) return;
  const body = req.body as Record<string, string | number | null | undefined>;
  const updates: Record<string, string | number | null> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.origem_exportador === "string" && body.origem_exportador.trim()) updates.origem_exportador = body.origem_exportador.trim();
  if (body.distribuidor !== undefined) updates.distribuidor = typeof body.distribuidor === "string" ? body.distribuidor.trim() || null : null;
  if (body.fob_usd !== undefined) updates.fob_usd = typeof body.fob_usd === "number" ? body.fob_usd : null;
  if (body.cx9l !== undefined) updates.cx9l = typeof body.cx9l === "number" ? body.cx9l : null;
  if (body.usd_por_cx9l !== undefined) updates.usd_por_cx9l = typeof body.usd_por_cx9l === "number" ? body.usd_por_cx9l : null;
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

