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

export default router;
