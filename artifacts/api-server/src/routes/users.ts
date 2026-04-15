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
  const storageWarnings: string[] = [];

  // ── 1. Delete Storage objects ────────────────────────────────────────────
  // User-owned objects are stored under various prefixes across multiple buckets.
  // Always re-list from offset=0 after each batch delete to avoid index-shift skips.
  // bucket → list of folder prefixes where user files may be stored
  const STORAGE_TARGETS: Array<{ bucket: string; prefix: string }> = [
    // avatars:           ${userId}/avatar.jpg
    { bucket: "avatars",          prefix: userId },
    // post-images:       ${userId}/${timestamp}.jpg
    { bucket: "post-images",      prefix: userId },
    // post-videos:       ${userId}/${timestamp}.*
    { bucket: "post-videos",      prefix: userId },
    // stories:           ${userId}/${timestamp}.*
    { bucket: "stories",          prefix: userId },
    // chat-attachments:  chat/${userId}/...  AND  portfolio/${userId}/...
    { bucket: "chat-attachments", prefix: `chat/${userId}` },
    { bucket: "chat-attachments", prefix: `portfolio/${userId}` },
    // cvs:               cvs/${userId}/${timestamp}.*
    { bucket: "cvs",              prefix: `cvs/${userId}` },
  ];

  // Errors caused by a non-existent bucket or empty folder are not failures —
  // it simply means the user never uploaded to that bucket.
  const BUCKET_NOT_FOUND_PATTERNS = ["not found", "does not exist", "The resource was not found"];
  const isBucketMissing = (msg: string) =>
    BUCKET_NOT_FOUND_PATTERNS.some((p) => msg.toLowerCase().includes(p.toLowerCase()));

  async function deleteStoragePrefix(bucket: string, prefix: string): Promise<void> {
    const PAGE = 1000;
    for (;;) {
      const { data: files, error: listErr } = await supabaseAdmin.storage
        .from(bucket)
        .list(prefix, { limit: PAGE, offset: 0 });
      if (listErr) {
        // Bucket or folder not found → nothing to delete, not a real failure.
        if (isBucketMissing(listErr.message)) break;
        storageWarnings.push(`list ${bucket}/${prefix}: ${listErr.message}`);
        break;
      }
      if (!files || files.length === 0) break;
      const paths = files.map((f: { name: string }) => `${prefix}/${f.name}`);
      const { error: removeErr } = await supabaseAdmin.storage
        .from(bucket)
        .remove(paths);
      if (removeErr) {
        storageWarnings.push(`remove ${bucket}/${prefix}: ${removeErr.message}`);
        break;
      }
      if (files.length < PAGE) break;
    }
  }

  await Promise.all(
    STORAGE_TARGETS.map(async ({ bucket, prefix }) => {
      try {
        await deleteStoragePrefix(bucket, prefix);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        storageWarnings.push(`${bucket}/${prefix}: ${msg}`);
      }
    })
  );

  // ── 2. Delete database rows (fail-logged; CASCADE handles any leftovers) ─
  // Leaf rows first to avoid FK constraint violations.
  // Supabase resolves (never rejects) — check { error } in the resolved value.
  async function deleteTable(table: string, query: () => Promise<{ error: { message: string } | null }>): Promise<string | null> {
    try {
      const { error } = await query();
      return error ? `delete ${table}: ${error.message}` : null;
    } catch (e: unknown) {
      return `delete ${table}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const dbResults = await Promise.all([
    deleteTable("comment_likes",            () => supabaseAdmin.from("comment_likes").delete().eq("user_id", userId)),
    deleteTable("likes",                    () => supabaseAdmin.from("likes").delete().eq("user_id", userId)),
    deleteTable("bookmarks",               () => supabaseAdmin.from("bookmarks").delete().eq("user_id", userId)),
    deleteTable("notification_preferences", () => supabaseAdmin.from("notification_preferences").delete().eq("user_id", userId)),
    deleteTable("wine_cellar",             () => supabaseAdmin.from("wine_cellar").delete().eq("user_id", userId)),
    deleteTable("post_hidden",             () => supabaseAdmin.from("post_hidden").delete().eq("user_id", userId)),
    deleteTable("user_blocks",             () => supabaseAdmin.from("user_blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)),
    deleteTable("comments",                () => supabaseAdmin.from("comments").delete().eq("user_id", userId)),
    deleteTable("stories",                 () => supabaseAdmin.from("stories").delete().eq("user_id", userId)),
    deleteTable("posts",                   () => supabaseAdmin.from("posts").delete().eq("user_id", userId)),
  ]);
  const dbWarnings = dbResults.filter((w): w is string => w !== null);

  // ── 3. Anonymize profile ─────────────────────────────────────────────────
  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: "Conta Removida",
      username:  null,
      bio:       null,
      avatar_url: null,
      headline:  null,
      location:  null,
      phone:     null,
    })
    .eq("id", userId);

  if (profileErr) {
    // Non-fatal — CASCADE will remove the profile row when auth user is deleted.
    storageWarnings.push(`profile anonymize: ${profileErr.message}`);
  }

  // ── 4. Fail-closed: abort if any cleanup step failed ─────────────────────
  // Auth user is deleted ONLY when storage + DB cleanup are fully clean.
  // This ensures no orphaned user data is left behind on a partial failure
  // and allows the user to retry account deletion.
  const allWarnings = [...storageWarnings, ...dbWarnings];
  if (allWarnings.length > 0) {
    console.error("[deleteUser] cleanup failures, aborting auth deletion:", allWarnings);
    res.status(500).json({
      error: "Não foi possível excluir todos os seus dados. Tente novamente.",
      warnings: allWarnings,
    });
    return;
  }

  // ── 5. Delete auth user (CASCADE handles remaining FK rows) ──────────────
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    res.status(500).json({ error: deleteError.message ?? "Failed to delete user" });
    return;
  }

  res.status(200).json({ success: true });
});

/**
 * GET /feed/posts
 * Authoritative server-side feed endpoint: shadowban filtering is enforced here.
 * Admin client is used only to fetch banned IDs; post queries use the user's JWT
 * so that existing RLS policies (privacy, blocks) are still respected.
 * Supports ?limit=N, ?offset=N (for infinite scroll), and ?since=ISO_TIMESTAMP for polling.
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
  const limit = Math.min(parseInt(req.query.limit as string) || 15, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const since = req.query.since as string | undefined;

  // Fetch shadowbanned IDs using admin client only (authoritative, server-side).
  // This is the only place the service role is used — post queries use the user JWT below.
  const { data: shadowbanned } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_shadowbanned", true);
  const bannedIds = (shadowbanned ?? [])
    .map((p: { id: string }) => p.id)
    .filter((id: string) => id !== currentUserId);

  // Create a per-request client scoped to the user's JWT so RLS is respected.
  const userClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  let postsQuery = userClient
    .from("posts")
    .select("id, user_id, company_page_id, content, image_url, image_urls, video_url, likes_count, comments_count, shares_count, view_count, location, hashtags, poll, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (since) {
    postsQuery = postsQuery.gt("created_at", since);
  }

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

/**
 * GET /search/posts?q=...&limit=N
 * Authoritative server-side post search with shadowban filtering.
 * Admin client used only for banned IDs; post queries use user JWT to respect RLS.
 */
router.get("/search/posts", async (req: Request, res: Response) => {
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
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  if (!q) {
    res.json({ posts: [] });
    return;
  }

  // Fetch shadowbanned IDs using admin client (authoritative, server-side).
  const { data: shadowbanned } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_shadowbanned", true);
  const bannedIds = (shadowbanned ?? [])
    .map((p: { id: string }) => p.id)
    .filter((id: string) => id !== currentUserId);

  // User-scoped client to respect RLS.
  const userClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  let postsQuery = userClient
    .from("posts")
    .select("id, user_id, company_page_id, content, image_url, image_urls, video_url, likes_count, comments_count, shares_count, view_count, location, hashtags, poll, created_at")
    .ilike("content", `%${q}%`)
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
