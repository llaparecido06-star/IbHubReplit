import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId, requirePlanFeature } from "../lib/planCheck.js";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * GET /market/posts
 * Returns Ideal.BI market posts. Requires mercado:idealbi plan feature.
 * Query params: limit (default 30, max 100), since (ISO timestamp for pagination)
 */
router.get("/market/posts", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const since = req.query.since as string | undefined;

  let query = supabaseAdmin
    .from("market_posts")
    .select("id, user_id, content, image_url, image_urls, video_url, likes_count, comments_count, poll, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

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
 * Creates an Ideal.BI market post. Requires mercado:idealbi plan feature.
 */
router.post("/market/posts", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "mercado:idealbi");
  if (!allowed) return;

  const { content, image_url, video_url, poll_options } = req.body as {
    content?: string;
    image_url?: string | null;
    video_url?: string | null;
    poll_options?: unknown;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("market_posts")
    .insert({
      author_id: userId,
      content: content.trim(),
      image_url: image_url ?? null,
      video_url: video_url ?? null,
      poll_options: poll_options ?? null,
      likes_count: 0,
      comments_count: 0,
    })
    .select("id, content, image_url, video_url, poll_options, created_at, author_id, likes_count, comments_count")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ post: data });
});

export default router;
