import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "../lib/pushUtils.js";

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
  async function deleteTable(table: string, query: () => PromiseLike<{ error: { message: string } | null }>): Promise<string | null> {
    try {
      const { error } = await query();
      return error ? `delete ${table}: ${error.message}` : null;
    } catch (e: unknown) {
      return `delete ${table}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const dbResults = await Promise.all([
    deleteTable("comment_likes",  () => supabaseAdmin.from("comment_likes").delete().eq("user_id", userId)),
    deleteTable("likes",          () => supabaseAdmin.from("likes").delete().eq("user_id", userId)),
    deleteTable("bookmarks",      () => supabaseAdmin.from("bookmarks").delete().eq("user_id", userId)),
    deleteTable("wine_cellar",    () => supabaseAdmin.from("wine_cellar").delete().eq("user_id", userId)),
    deleteTable("post_hidden",    () => supabaseAdmin.from("post_hidden").delete().eq("user_id", userId)),
    deleteTable("user_blocks",    () => supabaseAdmin.from("user_blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)),
    deleteTable("comments",       () => supabaseAdmin.from("comments").delete().eq("user_id", userId)),
    deleteTable("stories",        () => supabaseAdmin.from("stories").delete().eq("user_id", userId)),
    deleteTable("posts",          () => supabaseAdmin.from("posts").delete().eq("user_id", userId)),
    deleteTable("bi_reveal_credits", () => supabaseAdmin.from("bi_reveal_credits").delete().eq("user_id", userId)),
    deleteTable("push_tokens",    () => supabaseAdmin.from("push_tokens").delete().eq("user_id", userId)),
    deleteTable("follows",        () => supabaseAdmin.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`)),
    deleteTable("connections",    () => supabaseAdmin.from("connections").delete().or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)),
    deleteTable("company_pages",  () => supabaseAdmin.from("company_pages").delete().eq("owner_id", userId)),
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
    req.log.error({ warnings: allWarnings }, "[deleteUser] cleanup failures, aborting auth deletion");
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
 * Authoritative server-side feed endpoint with tiered relevance algorithm.
 * Tier 1 — accepted connections (score 1000+freshness)
 * Tier 2 — followed users (score 500+freshness)
 * Tier 3 — users sharing areas/company (score 200+freshness)
 * Tier 4 — everyone else (freshness only)
 * Shadowban filtering is enforced server-side via admin client.
 * Post queries use the user's JWT so that existing RLS policies are still respected.
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

  // Fetch only the shadowban list — no scoring data needed for chronological feed.
  const shadowbannedRes = await supabaseAdmin.from("profiles").select("id").eq("is_shadowbanned", true);
  const bannedIds = (shadowbannedRes.data ?? [])
    .map((p: { id: string }) => p.id)
    .filter((id: string) => id !== currentUserId);

  // Create a per-request client scoped to the user's JWT so RLS is respected.
  const userClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Fetch posts in chronological order — newest first.
  let postsQuery = userClient
    .from("posts")
    .select("id, user_id, company_page_id, content, image_url, image_urls, video_url, likes_count, comments_count, shares_count, view_count, location, hashtags, poll, is_pinned, created_at")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (since) {
    postsQuery = postsQuery.gt("created_at", since);
  }

  if (bannedIds.length > 0) {
    postsQuery = postsQuery.not("user_id", "in", `(${bannedIds.map((id: string) => `"${id}"`).join(",")})`);
  }

  const { data: rawPosts, error: postsError } = await postsQuery;
  if (postsError) {
    res.status(500).json({ error: postsError.message });
    return;
  }

  res.json({ posts: rawPosts ?? [] });
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

/**
 * POST /posts/:postId/poll/vote
 * Casts or retracts a vote on a post's inline poll.
 * Uses the admin client to bypass RLS — the poll JSONB must be updatable
 * by any authenticated user, not just the post owner.
 * Body: { optionIndex: number }
 */
router.post("/posts/:postId/poll/vote", async (req: Request, res: Response): Promise<void> => {
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
  const userId = userData.user.id;
  const { postId } = req.params;
  const { optionIndex } = req.body as { optionIndex: number };

  if (typeof optionIndex !== "number" || !Number.isInteger(optionIndex) || optionIndex < 0) {
    res.status(400).json({ error: "optionIndex must be a non-negative integer" });
    return;
  }

  const { data: row, error: fetchError } = await supabaseAdmin
    .from("posts")
    .select("poll, user_id, company_page_id")
    .eq("id", postId)
    .single();

  if (fetchError || !row?.poll) {
    res.status(404).json({ error: "Post or poll not found" });
    return;
  }

  const postAuthorId: string = row.user_id;
  const postCompanyId: string | null = row.company_page_id ?? null;

  const poll = row.poll as {
    options: { text: string; votes: number }[];
    total_votes: number;
    closed: boolean;
    expires_at?: string | null;
    allow_multiple?: boolean;
    user_votes?: Record<string, number | number[]>;
  };

  if (poll.closed) { res.status(400).json({ error: "Poll is closed" }); return; }
  if (poll.expires_at && new Date(poll.expires_at) < new Date()) { res.status(400).json({ error: "Poll has expired" }); return; }
  if (optionIndex >= poll.options.length) { res.status(400).json({ error: "Invalid option index" }); return; }

  const prevVote = poll.user_votes?.[userId];
  const prevIndices: number[] = prevVote == null ? [] : Array.isArray(prevVote) ? prevVote : [prevVote];
  const alreadyVotedThis = prevIndices.includes(optionIndex);
  const newOptions = poll.options.map((o) => ({ ...o }));
  let newTotal = poll.total_votes;
  let newIndices: number[];

  if (poll.allow_multiple) {
    if (alreadyVotedThis) {
      newOptions[optionIndex].votes = Math.max(0, newOptions[optionIndex].votes - 1);
      newTotal = Math.max(0, newTotal - 1);
      newIndices = prevIndices.filter((i) => i !== optionIndex);
    } else {
      newOptions[optionIndex].votes += 1;
      newTotal += 1;
      newIndices = [...prevIndices, optionIndex];
    }
  } else {
    if (alreadyVotedThis) {
      newOptions[optionIndex].votes = Math.max(0, newOptions[optionIndex].votes - 1);
      newTotal = Math.max(0, newTotal - 1);
      newIndices = [];
    } else if (prevIndices.length > 0) {
      const old = prevIndices[0];
      newOptions[old].votes = Math.max(0, newOptions[old].votes - 1);
      newOptions[optionIndex].votes += 1;
      newIndices = [optionIndex];
    } else {
      newOptions[optionIndex].votes += 1;
      newTotal += 1;
      newIndices = [optionIndex];
    }
  }

  const storedValue: number | number[] =
    newIndices.length === 0 ? [] : newIndices.length === 1 ? newIndices[0] : newIndices;
  const userVotes: Record<string, number | number[]> = { ...(poll.user_votes ?? {}), [userId]: storedValue };
  if (newIndices.length === 0) delete userVotes[userId];

  const updatedPoll = { ...poll, options: newOptions, total_votes: newTotal, user_votes: userVotes };

  const { error: updateError } = await supabaseAdmin
    .from("posts")
    .update({ poll: updatedPoll })
    .eq("id", postId);

  if (updateError) { res.status(500).json({ error: updateError.message }); return; }

  // Notify the poll author when a NEW vote was added (i.e. newIndices contains
  // an index that wasn't in prevIndices). Skip when the voter is the author.
  // Insert an in-app notification of type "poll_vote" and dispatch a push.
  // For company-page posts, route to the company owner (matching the trigger
  // pattern used by notify_on_like).
  const addedIndex = newIndices.find((i) => !prevIndices.includes(i));
  if (addedIndex !== undefined) {
    let recipientUserId: string = postAuthorId;
    let targetCompanyId: string | null = null;
    if (postCompanyId) {
      const { data: company } = await supabaseAdmin
        .from("company_pages")
        .select("owner_id")
        .eq("id", postCompanyId)
        .maybeSingle();
      if (company?.owner_id) {
        recipientUserId = company.owner_id as string;
        targetCompanyId = postCompanyId;
      }
    }

    if (recipientUserId && recipientUserId !== userId) {
      const chosenOptionText = poll.options[addedIndex]?.text ?? "";

      // Fetch voter's display name for the push body.
      const { data: voterProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, username")
        .eq("id", userId)
        .maybeSingle();
      const voterName: string =
        voterProfile?.full_name ??
        voterProfile?.username ??
        "Alguém";

      const { error: notifErr } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: recipientUserId,
          actor_id: userId,
          type: "poll_vote",
          post_id: postId,
          message: "votou na sua enquete",
          target_company_id: targetCompanyId,
          metadata: { option_index: addedIndex, option_text: chosenOptionText },
        });
      if (notifErr) {
        req.log.warn({ err: notifErr, postId, userId }, "poll_vote notification insert failed");
      }

      // Fire-and-forget push notification (won't block the response).
      void sendPushToUser({
        userId: recipientUserId,
        title: "Novo voto na sua enquete",
        body: `${voterName} votou em "${chosenOptionText}"`,
        data: { type: "poll_vote", postId },
      });
    }
  }

  res.json({ poll: updatedPoll, indices: newIndices });
});

/**
 * POST /posts/:postId/poll/close
 * Closes a poll immediately. Only the post author may do this.
 */
router.post("/posts/:postId/poll/close", async (req: Request, res: Response): Promise<void> => {
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
  const userId = userData.user.id;
  const { postId } = req.params;

  const { data: row, error: fetchError } = await supabaseAdmin
    .from("posts")
    .select("poll, user_id")
    .eq("id", postId)
    .single();

  if (fetchError || !row?.poll) {
    res.status(404).json({ error: "Post or poll not found" });
    return;
  }

  if (row.user_id !== userId) {
    res.status(403).json({ error: "Only the post author can close this poll" });
    return;
  }

  const poll = row.poll as { closed: boolean };
  if (poll.closed) {
    res.status(400).json({ error: "Poll is already closed" });
    return;
  }

  const updatedPoll = { ...poll, closed: true };

  const { error: updateError } = await supabaseAdmin
    .from("posts")
    .update({ poll: updatedPoll })
    .eq("id", postId);

  if (updateError) { res.status(500).json({ error: updateError.message }); return; }

  res.json({ poll: updatedPoll });
});

/**
 * POST /market-posts/:postId/poll/vote
 * Casts, changes, or removes a vote on an Ideal.BI market post poll.
 * Uses the admin client to bypass RLS.
 * Body: { optionId: string }
 * Behaviour:
 *   - allow_multiple=false: clicking the already-voted option → unvote; clicking a
 *     different option → swap vote (remove old, add new).
 *   - allow_multiple=true: clicking an already-selected option → deselect it;
 *     clicking a new option → add it.
 * Response: { poll_options, user_poll_votes: string[] }
 */
router.post("/market-posts/:postId/poll/vote", async (req: Request, res: Response): Promise<void> => {
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
  const userId = userData.user.id;
  const { postId } = req.params;
  const { optionId } = req.body as { optionId: string };

  if (!optionId || typeof optionId !== "string") {
    res.status(400).json({ error: "optionId is required" });
    return;
  }

  const { data: row, error: fetchError } = await supabaseAdmin
    .from("market_posts")
    .select("poll_options, poll_allow_multiple")
    .eq("id", postId)
    .single();

  if (fetchError || !row?.poll_options) {
    res.status(404).json({ error: "Post or poll not found" });
    return;
  }

  const opts = row.poll_options as { id: string; text: string; votes_count: number }[];
  const allowMultiple: boolean = (row as any).poll_allow_multiple ?? false;

  if (!opts.find((o) => o.id === optionId)) {
    res.status(400).json({ error: "Invalid optionId" });
    return;
  }

  const { data: existingRows } = await supabaseAdmin
    .from("market_post_poll_votes")
    .select("option_id")
    .eq("post_id", postId)
    .eq("user_id", userId);

  const existingVotes: string[] = (existingRows ?? []).map((r: any) => r.option_id as string);
  const alreadyVotedThis = existingVotes.includes(optionId);

  let updated = [...opts];

  if (allowMultiple) {
    if (alreadyVotedThis) {
      // Deselect this option
      updated = updated.map((o) =>
        o.id === optionId ? { ...o, votes_count: Math.max(0, o.votes_count - 1) } : o
      );
      await supabaseAdmin
        .from("market_post_poll_votes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId)
        .eq("option_id", optionId);
    } else {
      // Add this option to the selection
      updated = updated.map((o) =>
        o.id === optionId ? { ...o, votes_count: o.votes_count + 1 } : o
      );
      await supabaseAdmin
        .from("market_post_poll_votes")
        .insert({ post_id: postId, user_id: userId, option_id: optionId });
    }
  } else {
    if (alreadyVotedThis) {
      // Unvote: remove the existing vote
      updated = updated.map((o) =>
        o.id === optionId ? { ...o, votes_count: Math.max(0, o.votes_count - 1) } : o
      );
      await supabaseAdmin
        .from("market_post_poll_votes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId)
        .eq("option_id", optionId);
    } else {
      // Change vote: remove old vote(s), add new
      for (const oldId of existingVotes) {
        updated = updated.map((o) =>
          o.id === oldId ? { ...o, votes_count: Math.max(0, o.votes_count - 1) } : o
        );
        await supabaseAdmin
          .from("market_post_poll_votes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId)
          .eq("option_id", oldId);
      }
      updated = updated.map((o) =>
        o.id === optionId ? { ...o, votes_count: o.votes_count + 1 } : o
      );
      await supabaseAdmin
        .from("market_post_poll_votes")
        .insert({ post_id: postId, user_id: userId, option_id: optionId });
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("market_posts")
    .update({ poll_options: updated })
    .eq("id", postId);

  if (updateError) { res.status(500).json({ error: updateError.message }); return; }

  // Recalculate the user's current votes after the operation
  const { data: newVoteRows } = await supabaseAdmin
    .from("market_post_poll_votes")
    .select("option_id")
    .eq("post_id", postId)
    .eq("user_id", userId);

  const userPollVotes: string[] = (newVoteRows ?? []).map((r: any) => r.option_id as string);

  res.json({ poll_options: updated, user_poll_votes: userPollVotes });
});

export default router;
