import { supabase } from "@/context/AuthContext";
import { Post } from "@/components/feed/PostCard";
import { compressPostImage } from "@/utils/compressImage";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { getSessionSafe, API_URL, COMMENT_SELECT_BASE, POST_SELECT_BASE, attachAuthorsToPosts, fetchCommentProfilesForIds, fetchCompanyPagesForIds, fetchProfilesForIds, guardedFetch, VIDEO_UPLOAD_FETCH_TIMEOUT_MS, isNetworkError, normaliseAuthor, normalizePollIndices } from "./_shared";
import type { AppComment, RawPostRow } from "./types";

type LikeRow = { post_id: string; reaction_type?: string | null };
type BookmarkRow = { post_id: string };
type CommentLikeRow = { comment_id: string };

/**
 * Fire-and-forget social push dispatcher (parallels web's `_dispatchSocialPush`).
 *
 * The server endpoint /push/social is the single source of truth for the
 * notification copy (wine name in title, /post/<id> deep-link), so both
 * web and mobile call it instead of building Expo messages on their own.
 * Skipped silently when the user is acting on behalf of a company page —
 * the like/comment is then attributed to the company, not to the actor,
 * and the recipient's inbox shows the company message.
 */
async function _dispatchSocialPush(opts: {
  type: "like" | "comment";
  postId: string;
  userId: string;
  commentText?: string;
  companyPageId?: string | null;
}): Promise<void> {
  if (!API_URL) return;
  if (opts.companyPageId) return;
  try {
    const { data: { session } } = await getSessionSafe();
    const token = session?.access_token;
    if (!token) return;

    let actorName = (session?.user?.user_metadata as { full_name?: string } | undefined)?.full_name?.trim() || "";
    if (!actorName) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", opts.userId)
        .maybeSingle();
      actorName = (profileRow?.full_name as string | undefined)?.trim() || "Alguém";
    }

    await guardedFetch(`${API_URL}/push/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: opts.type,
        postId: opts.postId,
        actorName,
        commentText: opts.commentText,
      }),
    });
  } catch {
    // fire-and-forget — push failure must not break the like/comment write
  }
}

/**
 * Generic fire-and-forget push dispatcher for posts-related events.
 * The server resolves actor name from the auth token — no need to pass it.
 */
async function _dispatchPush(path: string, body: Record<string, string>): Promise<void> {
  if (!API_URL) return;
  try {
    const { data: { session } } = await getSessionSafe();
    const token = session?.access_token;
    if (!token) return;
    await guardedFetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
  }
}

export async function fetchFeedPosts(
  currentUserId: string,
  activeCompanyId?: string | null,
  offset = 0,
  limit = 15,
  accessToken?: string,
): Promise<Post[]> {
  try {
    // Use the authoritative API server endpoint for shadowban enforcement.
    // The server filters using the admin Supabase client; clients cannot bypass this.
    //
    // Prefer the caller-supplied accessToken (already in React state) over
    // calling getSession() here. On first login, getSession() is invoked from
    // within code triggered by onAuthStateChange, which still holds the
    // supabase-js internal auth lock — causing a deadlock / indefinite hang
    // that leaves the feed skeleton visible forever.
    const token = accessToken ?? (await getSessionSafe()).data.session?.access_token;
    if (!token) return [];

    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const res = await guardedFetch(`${API_URL}/feed/posts?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];

    const { posts: rawPosts } = await res.json() as { posts: RawPostRow[] };
    if (!rawPosts?.length) return [];

    const postIds = rawPosts.map((p) => p.id);
    const userIds = [...new Set(rawPosts.map((p) => p.user_id).filter(Boolean))];
    const companyIds = [...new Set(rawPosts.map((p) => p.company_page_id).filter((v): v is string => Boolean(v)))];

    const likedQuery = activeCompanyId
      ? supabase.from("likes").select("post_id, reaction_type").eq("company_page_id", activeCompanyId).in("post_id", postIds)
      : supabase.from("likes").select("post_id, reaction_type").eq("user_id", currentUserId).is("company_page_id", null).in("post_id", postIds);

    const [profileMap, companyMap, likedRes, bookmarkRes] = await Promise.all([
      fetchProfilesForIds(userIds),
      fetchCompanyPagesForIds(companyIds),
      likedQuery,
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);

    const likedMap = new Map(((likedRes.data ?? []) as LikeRow[]).map((l) => [l.post_id, l.reaction_type ?? null] as const));
    const bookmarkedIds = new Set(((bookmarkRes.data ?? []) as BookmarkRow[]).map((b) => b.post_id));

    return (await attachAuthorsToPosts(rawPosts, profileMap, companyMap)).map((post) => {
      let poll = post.poll ?? null;
      if (poll) {
        const indices = normalizePollIndices(poll.user_votes, currentUserId);
        poll = { ...poll, user_voted_indices: indices, user_voted_index: indices[0] ?? null };
      }
      return { ...post, poll, is_liked: likedMap.has(post.id), reaction_type: likedMap.get(post.id) ?? null, is_bookmarked: bookmarkedIds.has(post.id) } as unknown as Post;
    });
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.warn("fetchFeedPosts:", e);
    return [];
  }
}

export async function uploadPostImage(imageUri: string, userId: string): Promise<string | null> {
  let compressed: string = imageUri;
  try {
    compressed = await compressPostImage(imageUri);
    const ext = "jpg";
    const mime = "image/jpeg";
    const filename = `${userId}/${Date.now()}.${ext}`;

    const response = await fetch(compressed);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(filename, bytes, { contentType: mime, upsert: false });

    if (error) { console.error("uploadPostImage storage error:", error); return null; }

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(data.path);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadPostImage:", e);
    return null;
  } finally {
    // Delete the compressed temp file from local cache (native only).
    // The original picker URI is managed by the OS; only clean up our own copy.
    if (Platform.OS !== "web" && compressed !== imageUri) {
      FileSystem.deleteAsync(compressed, { idempotent: true }).catch(() => {});
    }
  }
}

export async function uploadPostVideo(videoUri: string, userId: string): Promise<string | null> {
  try {
    const ext = videoUri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "mp4";
    const mime = ext === "mov" ? "video/quicktime" : "video/mp4";

    const { data: sessionData } = await getSessionSafe();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    // On native: copy ph:// or content:// URIs to a local file:// path first
    let localUri = videoUri;
    if (Platform.OS !== "web" && (localUri.startsWith("ph://") || localUri.startsWith("content://"))) {
      const tmpPath = `${(FileSystem as any).cacheDirectory}tmp_video_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: localUri, to: tmpPath });
      localUri = tmpPath;
    }

    // Use FormData with the file URI — React Native's native HTTP layer streams
    // the file without ever loading it into the JS heap, preventing OOM on Android.
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("mimeType", mime);
    if (Platform.OS === "web") {
      const blobRes = await fetch(localUri);
      const blob = await blobRes.blob();
      formData.append("file", blob, `video.${ext}`);
    } else {
      formData.append("file", { uri: localUri, name: `video.${ext}`, type: mime } as any);
    }

    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
    const res = await guardedFetch(`${apiUrl}/uploads/post-video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }, VIDEO_UPLOAD_FETCH_TIMEOUT_MS);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("uploadPostVideo error:", res.status, body);
      return null;
    }

    const json = await res.json() as { url?: string };
    return json.url ?? null;
  } catch (e) {
    console.error("uploadPostVideo:", e);
    return null;
  }
}

export async function createPost(params: {
  user_id: string;
  content: string;
  image_url?: string | null;
  image_urls?: string[] | null;
  video_url?: string | null;
  location?: string | null;
  poll?: { options: { text: string; votes: number }[]; total_votes: number; closed: boolean; expires_at?: string; allow_multiple?: boolean };
  hashtags?: string[];
  company_page_id?: string | null;
}): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .insert({ ...params, likes_count: 0, comments_count: 0, shares_count: 0, view_count: 0 })
      .select(POST_SELECT_BASE)
      .single();

    if (error) { console.error("createPost:", error); return null; }

    const [profileMap, companyMap] = await Promise.all([
      fetchProfilesForIds([params.user_id]),
      params.company_page_id ? fetchCompanyPagesForIds([params.company_page_id]) : Promise.resolve(new Map()),
    ]);

    return {
      ...(data as any),
      author: normaliseAuthor(profileMap.get(params.user_id)),
      company_page: params.company_page_id ? (companyMap.get(params.company_page_id) ?? null) : null,
      is_liked: false,
      is_bookmarked: false,
    } as Post;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("createPost:", e);
    return null;
  }
}

export async function fetchPostById(postId: string, currentUserId?: string): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .eq("id", postId)
      .single();

    if (error || !data) return null;

    const [profileMap, companyMap] = await Promise.all([
      fetchProfilesForIds([(data as any).user_id]),
      (data as any).company_page_id ? fetchCompanyPagesForIds([(data as any).company_page_id]) : Promise.resolve(new Map()),
    ]);

    const post: any = {
      ...(data as any),
      author: normaliseAuthor(profileMap.get((data as any).user_id)),
      company_page: (data as any).company_page_id ? (companyMap.get((data as any).company_page_id) ?? null) : null,
      is_liked: false,
      is_bookmarked: false,
    };

    if (post.poll && currentUserId) {
      const indices = normalizePollIndices(post.poll.user_votes, currentUserId);
      post.poll = { ...post.poll, user_voted_indices: indices, user_voted_index: indices[0] ?? null };
    }

    if (currentUserId) {
      const [l, b] = await Promise.all([
        supabase.from("likes").select("id, reaction_type").match({ post_id: postId, user_id: currentUserId }).maybeSingle(),
        supabase.from("bookmarks").select("id").match({ post_id: postId, user_id: currentUserId }).maybeSingle(),
      ]);
      return {
        ...post,
        is_liked: !!l.data,
        reaction_type: (l.data as any)?.reaction_type ?? null,
        is_bookmarked: !!b.data,
      } as Post;
    }
    return post as Post;
  } catch (e) {
    console.warn("fetchPostById:", e);
    return null;
  }
}

export async function toggleLike(postId: string, userId: string, isCurrentlyLiked: boolean, companyPageId?: string | null): Promise<boolean> {
  try {
    if (isCurrentlyLiked) {
      // Unlike
      const deleteQuery = companyPageId
        ? supabase.from("likes").delete().match({ post_id: postId, company_page_id: companyPageId })
        : supabase.from("likes").delete().match({ post_id: postId, user_id: userId }).is("company_page_id", null);
      const { error } = await deleteQuery;
      if (error) { console.error("toggleLike delete:", JSON.stringify(error)); return false; }
      // Decrement count via RPC (bypasses RLS)
      await supabase.rpc("decrement_post_likes", { p_post_id: postId });
    } else {
      // Like
      const insertPayload: any = { post_id: postId, user_id: userId };
      if (companyPageId) insertPayload.company_page_id = companyPageId;
      const { error } = await supabase.from("likes").insert(insertPayload);
      if (error) { console.error("toggleLike insert:", JSON.stringify(error)); return false; }
      // Increment count via RPC (bypasses RLS)
      await supabase.rpc("increment_post_likes", { p_post_id: postId });
      // In-app row is created by DB trigger notify_on_like; the push banner
      // (with wine context + deep-link) is dispatched here so the post
      // author gets a tap-to-open notification on mobile and web.
      void _dispatchSocialPush({ type: "like", postId, userId, companyPageId });
    }
    return true;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("toggleLike:", e);
    return false;
  }
}

export async function toggleReaction(
  postId: string,
  userId: string,
  reactionType: string,
  currentReaction: string | null,
  companyPageId?: string | null,
): Promise<boolean> {
  try {
    const hadPrevious = !!currentReaction;
    const isSame = currentReaction === reactionType;

    // Always remove existing like/reaction row first
    const deleteQuery = companyPageId
      ? supabase.from("likes").delete().match({ post_id: postId, company_page_id: companyPageId })
      : supabase.from("likes").delete().match({ post_id: postId, user_id: userId }).is("company_page_id", null);
    await deleteQuery;

    if (isSame) {
      // Removing reaction → decrement
      await supabase.rpc("decrement_post_likes", { p_post_id: postId });
      return true;
    }

    // Insert new reaction
    const insertPayload: any = { post_id: postId, user_id: userId, reaction_type: reactionType };
    if (companyPageId) insertPayload.company_page_id = companyPageId;
    const { error } = await supabase.from("likes").insert(insertPayload);
    if (error) { console.error("toggleReaction insert:", JSON.stringify(error)); return false; }

    if (!hadPrevious) {
      // Fresh reaction (no previous) → increment
      await supabase.rpc("increment_post_likes", { p_post_id: postId });
      // Trigger creates the in-app notification; mobile fires the push so
      // the wine-aware title and deep-link reach the post author.
      void _dispatchSocialPush({ type: "like", postId, userId, companyPageId });
    }
    // Changed reaction type (delete old, insert new) → count unchanged

    return true;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("toggleReaction:", e);
    return false;
  }
}

export async function incrementViewCount(postId: string): Promise<void> {
  try {
    await supabase.rpc("increment_view_count", { post_id: postId });
  } catch (e) {
    // Silently ignore — view count increment is best-effort
  }
}

export async function fetchNewPostsSince(since: string, currentUserId: string, activeCompanyId?: string | null): Promise<Post[]> {
  try {
    // Use the authoritative API server endpoint (same as fetchFeedPosts) with a `since` filter.
    const session = (await getSessionSafe()).data.session;
    if (!session?.access_token) return [];

    const params = new URLSearchParams({ limit: "20", since });
    const res = await guardedFetch(`${API_URL}/feed/posts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];

    const { posts: rawPosts } = await res.json() as { posts: any[] };
    if (!rawPosts?.length) return [];

    const postIds = rawPosts.map((p: any) => p.id as string);
    const userIds = [...new Set(rawPosts.map((p: any) => p.user_id as string).filter(Boolean))];
    const companyIds = [...new Set(rawPosts.map((p: any) => p.company_page_id as string).filter(Boolean))];

    const likedQuery = activeCompanyId
      ? supabase.from("likes").select("post_id, reaction_type").eq("company_page_id", activeCompanyId).in("post_id", postIds)
      : supabase.from("likes").select("post_id, reaction_type").eq("user_id", currentUserId).is("company_page_id", null).in("post_id", postIds);

    const [profileMap, companyMap, likedRes, bookmarkRes] = await Promise.all([
      fetchProfilesForIds(userIds),
      fetchCompanyPagesForIds(companyIds),
      likedQuery,
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);

    const likedMap = new Map((likedRes.data ?? []).map((l: any) => [l.post_id, l.reaction_type ?? null]));
    const bookmarkedIds = new Set((bookmarkRes.data ?? []).map((b: any) => b.post_id));

    return (await attachAuthorsToPosts(rawPosts, profileMap, companyMap)).map((post: any) => {
      let poll = post.poll ?? null;
      if (poll) {
        const indices = normalizePollIndices(poll.user_votes, currentUserId);
        poll = { ...poll, user_voted_indices: indices, user_voted_index: indices[0] ?? null };
      }
      return { ...post, poll, is_liked: likedMap.has(post.id), reaction_type: likedMap.get(post.id) ?? null, is_bookmarked: bookmarkedIds.has(post.id) };
    });
  } catch (e) {
    console.warn("fetchNewPostsSince:", e);
    return [];
  }
}

export async function toggleBookmark(postId: string, userId: string, isCurrentlyBookmarked: boolean): Promise<void> {
  try {
    if (isCurrentlyBookmarked) {
      await supabase.from("bookmarks").delete().match({ post_id: postId, user_id: userId });
    } else {
      await supabase.from("bookmarks").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id" });
    }
  } catch (e) {
    console.warn("toggleBookmark:", e);
  }
}


// ─── COMMENTS ────────────────────────────────────────────────────────────────

export async function fetchComments(postId: string, currentUserId?: string): Promise<AppComment[]> {
  try {
    const { data, error } = await supabase
      .from("comments")
      .select(COMMENT_SELECT_BASE)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) return [];

    const userIds = [...new Set((data as any[]).map(c => c.user_id).filter(Boolean))];
    const companyIds = [...new Set((data as any[]).map(c => c.company_page_id).filter(Boolean))];
    const commentIds = (data as any[]).map(c => c.id);

    const [profileMap, companyMap] = await Promise.all([
      fetchCommentProfilesForIds(userIds),
      fetchCompanyPagesForIds(companyIds),
    ]);

    let likedSet = new Set<string>();
    if (currentUserId && commentIds.length > 0) {
      const { data: myLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", currentUserId)
        .in("comment_id", commentIds);
      likedSet = new Set((myLikes ?? []).map((l: any) => l.comment_id));
    }

    const flat: AppComment[] = (data as any[]).map(c => ({
      ...c,
      parent_comment_id: c.parent_comment_id ?? null,
      likes_count: c.likes_count ?? 0,
      is_liked: likedSet.has(c.id),
      author: normaliseAuthor(profileMap.get(c.user_id)),
      company_page: c.company_page_id ? (companyMap.get(c.company_page_id) ?? null) : null,
      replies: [] as AppComment[],
    }));

    // Build threaded tree: top-level comments + their replies nested
    const byId = new Map(flat.map(c => [c.id, c]));
    const roots: AppComment[] = [];
    for (const c of flat) {
      if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
        byId.get(c.parent_comment_id)!.replies!.push(c);
      } else {
        roots.push(c);
      }
    }
    return roots;
  } catch (e) {
    console.warn("fetchComments:", e);
    return [];
  }
}

export async function fetchCommentById(commentId: string, currentUserId?: string): Promise<AppComment | null> {
  try {
    const { data, error } = await supabase
      .from("comments")
      .select(COMMENT_SELECT_BASE)
      .eq("id", commentId)
      .single();

    if (error || !data) return null;

    const profileMap = await fetchCommentProfilesForIds([(data as any).user_id]);

    let is_liked = false;
    if (currentUserId) {
      const { data: like } = await supabase
        .from("comment_likes")
        .select("id")
        .match({ comment_id: commentId, user_id: currentUserId })
        .maybeSingle();
      is_liked = !!like;
    }

    return {
      ...(data as any),
      likes_count: (data as any).likes_count ?? 0,
      is_liked,
      author: normaliseAuthor(profileMap.get((data as any).user_id)),
    } as AppComment;
  } catch (e) {
    console.warn("fetchCommentById:", e);
    return null;
  }
}

export async function addComment(
  postId: string,
  userId: string,
  content: string,
  companyPageId?: string | null,
  parentCommentId?: string | null,
): Promise<AppComment | null> {
  try {
    const insertData: any = { post_id: postId, user_id: userId, content };
    if (companyPageId) insertData.company_page_id = companyPageId;
    if (parentCommentId) insertData.parent_comment_id = parentCommentId;

    const { data, error } = await supabase
      .from("comments")
      .insert(insertData)
      .select(COMMENT_SELECT_BASE)
      .single();

    if (error) { console.error("addComment:", JSON.stringify(error)); return null; }

    const [profileMap, companyMap] = await Promise.all([
      fetchCommentProfilesForIds([userId]),
      companyPageId ? fetchCompanyPagesForIds([companyPageId]) : Promise.resolve(new Map()),
    ]);

    // Increment comments_count via RPC (bypasses RLS)
    await supabase.rpc("increment_post_comments", { p_post_id: postId });

    // In-app row is created by DB trigger notify_on_comment; the push banner
    // is dispatched here so wine context + deep-link reach the author.
    if (!parentCommentId) {
      // Top-level comment → notify the post author
      void _dispatchSocialPush({ type: "comment", postId, userId, commentText: content, companyPageId });
    } else {
      // Reply → notify the parent comment author
      void _dispatchPush("/push/comment-reply", { parentCommentId, ...(content ? { commentText: content } : {}) });
    }

    return {
      ...(data as any),
      parent_comment_id: parentCommentId ?? null,
      replies: [],
      author: normaliseAuthor(profileMap.get(userId)),
      company_page: companyPageId ? (companyMap.get(companyPageId) ?? null) : null,
    } as AppComment;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("addComment:", e);
    return null;
  }
}


// ─── USER POSTS ──────────────────────────────────────────────────────────────

export async function fetchUserPosts(targetUserId: string, currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .eq("user_id", targetUserId)
      .is("company_page_id", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return [];

    const postIds = data.map((p: any) => p.id);
    const companyIds = [...new Set(data.map((p: any) => p.company_page_id).filter(Boolean))];
    const [profileMap, companyMap, likedRes, bookmarkRes] = await Promise.all([
      fetchProfilesForIds([targetUserId]),
      fetchCompanyPagesForIds(companyIds),
      supabase.from("likes").select("post_id").eq("user_id", currentUserId).is("company_page_id", null).in("post_id", postIds),
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);
    const likedIds = new Set((likedRes.data ?? []).map((l: any) => l.post_id));
    const bookmarkedIds = new Set((bookmarkRes.data ?? []).map((b: any) => b.post_id));

    return (await attachAuthorsToPosts(data, profileMap, companyMap)).map((post: any) => ({
      ...post,
      is_liked: likedIds.has(post.id),
      is_bookmarked: bookmarkedIds.has(post.id),
    }));
  } catch (e) {
    console.warn("fetchUserPosts:", e);
    return [];
  }
}


// ─── POLL VOTING ─────────────────────────────────────────────────────────────

export async function voteOnPoll(
  postId: string,
  _userId: string,
  optionIndex: number,
): Promise<{ indices: number[]; options: { text: string; votes: number }[]; total_votes: number; user_votes: Record<string, number | number[]> } | null> {
  try {
    const { data: { session } } = await getSessionSafe();
    if (!session?.access_token) return null;
    const res = await guardedFetch(`${API_URL}/posts/${postId}/poll/vote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ optionIndex }),
    });
    if (!res.ok) return null;
    const { poll: updatedPoll, indices } = await res.json() as {
      poll: { options: { text: string; votes: number }[]; total_votes: number; user_votes: Record<string, number | number[]> };
      indices: number[];
    };
    return { indices, options: updatedPoll.options, total_votes: updatedPoll.total_votes, user_votes: updatedPoll.user_votes };
  } catch (e) {
    console.warn("voteOnPoll:", e);
    return null;
  }
}

export async function fetchPollVoters(postId: string): Promise<{
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  optionIndex: number;
}[]> {
  try {
    const { data: post } = await supabase.from("posts").select("poll").eq("id", postId).single();
    if (!post?.poll?.user_votes) return [];
    const userVotesMap = post.poll.user_votes as Record<string, number | number[]>;
    const userIds = Object.keys(userVotesMap);
    if (!userIds.length) return [];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, username").in("id", userIds);
    if (!profiles) return [];
    type ProfileRow = { id: string; full_name: string | null; avatar_url: string | null; username: string | null };
    const expanded: { id: string; full_name: string | null; avatar_url: string | null; username: string | null; optionIndex: number }[] = [];
    for (const p of profiles as ProfileRow[]) {
      const vote = userVotesMap[p.id];
      const indices = Array.isArray(vote) ? vote : (typeof vote === "number" ? [vote] : []);
      for (const idx of indices) {
        expanded.push({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, username: p.username, optionIndex: idx });
      }
    }
    return expanded;
  } catch {
    return [];
  }
}

// ─── COMMENT LIKES ───────────────────────────────────────────────────────────

export async function toggleCommentLike(commentId: string, userId: string, isCurrentlyLiked: boolean): Promise<boolean> {
  try {
    if (isCurrentlyLiked) {
      await supabase.from("comment_likes").delete().match({ comment_id: commentId, user_id: userId });
      return false;
    } else {
      const { error } = await supabase
        .from("comment_likes")
        .upsert({ comment_id: commentId, user_id: userId }, { onConflict: "comment_id,user_id", ignoreDuplicates: true });
      if (error) { console.warn("toggleCommentLike:", JSON.stringify(error)); return false; }

      // Fetch the comment to create an in-app notification for the author
      const { data: commentRow } = await supabase
        .from("comments")
        .select("user_id, post_id")
        .eq("id", commentId)
        .maybeSingle();
      if (commentRow && (commentRow as any).user_id !== userId) {
        void supabase.from("notifications").insert({
          user_id: (commentRow as any).user_id,
          actor_id: userId,
          type: "comment_like",
          post_id: (commentRow as any).post_id,
          comment_id: commentId,
          message: "curtiu seu comentário",
        });
        void _dispatchPush("/push/comment-like", { commentId });
      }
      return true;
    }
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.warn("toggleCommentLike:", e);
    return false;
  }
}

export interface LikeUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  headline?: string | null;
  company_page_id?: string | null;
  company_name?: string | null;
  company_avatar?: string | null;
  reaction_type?: string | null;
}

export async function fetchPostLikes(postId: string): Promise<LikeUser[]> {
  try {
    const { data, error } = await supabase
      .from("likes")
      .select("user_id, company_page_id, reaction_type")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) return [];

    const userIds = [...new Set((data as any[]).map(l => l.user_id).filter(Boolean))];
    const companyIds = [...new Set((data as any[]).map(l => l.company_page_id).filter(Boolean))];

    const [profileMap, companyMap] = await Promise.all([
      fetchProfilesForIds(userIds),
      fetchCompanyPagesForIds(companyIds),
    ]);

    return (data as any[]).map(l => {
      if (l.company_page_id) {
        const c = companyMap.get(l.company_page_id);
        const p = profileMap.get(l.user_id);
        return {
          id: l.user_id,
          full_name: c?.name ?? p?.full_name ?? "Empresa",
          avatar_url: c?.avatar_url ?? null,
          headline: c?.industry ?? null,
          company_page_id: l.company_page_id,
          reaction_type: l.reaction_type ?? null,
        } as LikeUser;
      }
      const p = profileMap.get(l.user_id);
      return {
        id: l.user_id,
        full_name: p?.full_name ?? "Usuário",
        avatar_url: p?.avatar_url ?? null,
        headline: p?.headline ?? null,
        company_page_id: null,
        reaction_type: l.reaction_type ?? null,
      } as LikeUser;
    });
  } catch (e) {
    console.warn("fetchPostLikes:", e);
    return [];
  }
}
