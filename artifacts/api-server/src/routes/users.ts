import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
  throw new Error(
    "Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and/or EXPO_PUBLIC_SUPABASE_ANON_KEY"
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

router.delete("/users/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const userId = userData.user.id;

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    res.status(500).json({ error: deleteError.message ?? "Failed to delete user" });
    return;
  }

  res.status(200).json({ success: true });
});

/**
 * GET /feed/posts
 * Authoritative server-side feed endpoint: shadowban filtering is enforced here
 * using the admin Supabase client. Clients cannot bypass this filtering.
 */
router.get("/feed/posts", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization" });
    return;
  }
  const token = authHeader.slice(7);
  const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const currentUserId = userData.user.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

  // Fetch shadowbanned IDs using admin client (authoritative, server-side)
  const { data: shadowbanned } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_shadowbanned", true);
  const bannedIds = (shadowbanned ?? [])
    .map((p: { id: string }) => p.id)
    .filter((id: string) => id !== currentUserId);

  // Query posts with admin client, excluding shadowbanned authors
  let postsQuery = supabaseAdmin
    .from("posts")
    .select("id, user_id, company_page_id, content, image_url, image_urls, video_url, likes_count, comments_count, shares_count, view_count, location, hashtags, poll, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (bannedIds.length > 0) {
    postsQuery = postsQuery.not("user_id", "in", `(${bannedIds.map((id: string) => `"${id}"`).join(",")})`);
  }

  const { data: posts, error: postsError } = await postsQuery;
  if (postsError) {
    res.status(500).json({ error: postsError.message });
    return;
  }

  res.json({ posts: posts ?? [] });
});

export default router;
