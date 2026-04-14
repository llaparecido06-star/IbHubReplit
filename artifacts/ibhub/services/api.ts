import { supabase } from "@/context/AuthContext";
import { Post } from "@/components/feed/PostCard";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export async function deleteAccount(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error ?? "Erro ao excluir conta." };
    return { success: true };
  } catch (e) {
    console.error("deleteAccount:", e);
    return { success: false, error: "Erro de conexão. Tente novamente." };
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: string;
  post_id?: string | null;
  message?: string | null;
  read: boolean;
  created_at: string;
  actor?: { id: string; full_name: string; avatar_url?: string | null } | null;
  connection_id?: string | null;
  connection_status?: "pending" | "accepted" | "rejected" | null;
}

export interface AppComment {
  id: string;
  post_id: string;
  parent_comment_id?: string | null;
  user_id: string;
  company_page_id?: string | null;
  content: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
  author?: { id: string; full_name: string; avatar_url?: string | null; headline?: string | null } | null;
  company_page?: { id: string; name: string; avatar_url?: string | null } | null;
  replies?: AppComment[];
}

export interface AppStory {
  id: string;
  user_id: string;
  image_url?: string | null;
  text?: string | null;
  tagged_users?: string[] | null;
  created_at: string;
  expires_at: string;
  author?: { id: string; full_name: string; avatar_url?: string | null } | null;
  company_page_id?: string | null;
  company_page?: { id: string; name: string; avatar_url?: string | null } | null;
  viewed?: boolean;
}

export interface StoryGroup {
  userId: string;
  author: { id: string; full_name: string; avatar_url?: string | null };
  companyPageId?: string | null;
  companyPage?: { id: string; name: string; avatar_url?: string | null } | null;
  stories: AppStory[];
  hasUnseen: boolean;
}

export interface AppMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  from_company_page_id?: string | null;
  from_company_page?: { id: string; name: string; avatar_url?: string | null } | null;
  content: string;
  created_at: string;
  message_type?: "text" | "image" | "video" | "audio" | "file" | "post_share" | "wine_card";
  media_url?: string | null;
  reply_to_id?: string | null;
  reply_to?: { content: string; sender_id: string } | null;
  read_at?: string | null;
  metadata?: Record<string, any> | null;
  reactions?: AppMessageReaction[];
}

export interface AppMessageReaction {
  emoji: string;
  count: number;
  mine: boolean;
  users?: string[];
}

export interface AppConversation {
  id: string;
  is_group: boolean;
  name?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  participant?: { id: string; full_name: string; avatar_url?: string | null } | null;
  participant_company?: { id: string; name: string; avatar_url?: string | null } | null;
  accepted?: boolean;
}

// ─── POSTS ───────────────────────────────────────────────────────────────────

// Helper: normalise the `author` object returned by Supabase embedded selects
// (profiles table uses `position` + `company`, not `headline`)
function normaliseAuthor(author: any): any {
  if (!author) return author;
  const headline =
    author.headline ??
    ([author.position, author.company].filter(Boolean).join(" · ") || null);
  return { ...author, headline };
}

// Common embedded author select string (uses real column names)
const AUTHOR_SELECT = "id, full_name, username, avatar_url, position, company, plan";
const COMMENT_AUTHOR_SELECT = "id, full_name, avatar_url, position, company";

// Base post select WITHOUT the broken profiles FK join (posts.user_id → auth.users, not profiles)
const POST_SELECT_BASE = `id, user_id, company_page_id, content, image_url, image_urls, video_url,
  likes_count, comments_count, shares_count, view_count, location, hashtags, poll, created_at`;
const COMMENT_SELECT_BASE = `id, post_id, parent_comment_id, user_id, company_page_id, content, created_at, likes_count`;

// Fetch profiles by IDs (workaround: avoids broken FK join posts→auth.users)
async function fetchProfilesForIds(userIds: string[]): Promise<Map<string, any>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select(AUTHOR_SELECT).in("id", userIds);
  return new Map((data ?? []).map((p: any) => [p.id, p]));
}
async function fetchCommentProfilesForIds(userIds: string[]): Promise<Map<string, any>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select(COMMENT_AUTHOR_SELECT).in("id", userIds);
  return new Map((data ?? []).map((p: any) => [p.id, p]));
}
async function fetchCompanyPagesForIds(companyIds: string[]): Promise<Map<string, any>> {
  if (companyIds.length === 0) return new Map();
  const { data } = await supabase.from("company_pages").select("id, name, avatar_url").in("id", companyIds);
  return new Map((data ?? []).map((c: any) => [c.id, c]));
}
async function attachAuthorsToPosts(rawPosts: any[], profileMap: Map<string, any>, companyMap: Map<string, any>): Promise<any[]> {
  return rawPosts.map((p: any) => ({
    ...p,
    author: normaliseAuthor(profileMap.get(p.user_id)),
    company_page: p.company_page_id ? (companyMap.get(p.company_page_id) ?? null) : null,
  }));
}

export async function fetchFeedPosts(currentUserId: string, activeCompanyId?: string | null): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) return [];

    const postIds = data.map((p: any) => p.id);
    const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))];
    const companyIds = [...new Set(data.map((p: any) => p.company_page_id).filter(Boolean))];

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

    return (await attachAuthorsToPosts(data, profileMap, companyMap)).map((post: any) => ({
      ...post,
      is_liked: likedMap.has(post.id),
      reaction_type: likedMap.get(post.id) ?? null,
      is_bookmarked: bookmarkedIds.has(post.id),
    }));
  } catch (e) {
    console.warn("fetchFeedPosts:", e);
    return [];
  }
}

export async function uploadPostImage(imageUri: string, userId: string): Promise<string | null> {
  try {
    const ext = imageUri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
    const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    const filename = `${userId}/${Date.now()}.${ext}`;

    const response = await fetch(imageUri);
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
  }
}

export async function uploadPostVideo(videoUri: string, userId: string): Promise<string | null> {
  try {
    const ext = videoUri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "mp4";
    const mime = ext === "mov" ? "video/quicktime" : "video/mp4";
    const filename = `${userId}/${Date.now()}.${ext}`;

    const response = await fetch(videoUri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from("post-videos")
      .upload(filename, bytes, { contentType: mime, upsert: false });

    if (error) { console.error("uploadPostVideo storage error:", error); return null; }

    const { data: urlData } = supabase.storage.from("post-videos").getPublicUrl(data.path);
    return urlData.publicUrl ?? null;
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
  poll?: { options: { text: string; votes: number }[]; total_votes: number; closed: boolean };
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
      // Notify post author via RPC (bypasses RLS, skips self-notification)
      const { data: authorData, error: authorErr } = await supabase.rpc("get_post_author", { p_post_id: postId });
      if (authorErr) console.error("get_post_author error:", JSON.stringify(authorErr));
      if (authorData && authorData !== userId) {
        const { error: notifErr } = await supabase.rpc("create_notification", {
          p_user_id: authorData,
          p_actor_id: userId,
          p_type: "like",
          p_post_id: postId,
          p_message: "curtiu sua publicação",
        });
        if (notifErr) console.error("create_notification(like) error:", JSON.stringify(notifErr));
      }
    }
    return true;
  } catch (e) {
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
      // Notify post author
      const { data: authorId, error: authorErr2 } = await supabase.rpc("get_post_author", { p_post_id: postId });
      if (authorErr2) console.error("get_post_author(reaction) error:", JSON.stringify(authorErr2));
      if (authorId && authorId !== userId) {
        const { error: notifErr2 } = await supabase.rpc("create_notification", {
          p_user_id: authorId,
          p_actor_id: userId,
          p_type: "like",
          p_post_id: postId,
          p_message: "reagiu à sua publicação",
        });
        if (notifErr2) console.error("create_notification(reaction) error:", JSON.stringify(notifErr2));
      }
    }
    // Changed reaction type (delete old, insert new) → count unchanged

    return true;
  } catch (e) {
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
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return [];

    const postIds = data.map((p: any) => p.id);
    const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))];
    const companyIds = [...new Set(data.map((p: any) => p.company_page_id).filter(Boolean))];

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

    return (await attachAuthorsToPosts(data, profileMap, companyMap)).map((post: any) => ({
      ...post,
      is_liked: likedMap.has(post.id),
      reaction_type: likedMap.get(post.id) ?? null,
      is_bookmarked: bookmarkedIds.has(post.id),
    }));
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

    if (parentCommentId) {
      // Notify the parent comment author (reply notification)
      await supabase.rpc("notify_comment_reply", {
        p_parent_comment_id: parentCommentId,
        p_actor_id: userId,
        p_post_id: postId,
      });
    } else {
      // Notify post author via RPC
      const { data: authorId } = await supabase.rpc("get_post_author", { p_post_id: postId });
      if (authorId && authorId !== userId) {
        await supabase.rpc("create_notification", {
          p_user_id: authorId,
          p_actor_id: userId,
          p_type: "comment",
          p_post_id: postId,
          p_message: "comentou na sua publicação",
        });
      }
    }

    return {
      ...(data as any),
      parent_comment_id: parentCommentId ?? null,
      replies: [],
      author: normaliseAuthor(profileMap.get(userId)),
      company_page: companyPageId ? (companyMap.get(companyPageId) ?? null) : null,
    } as AppComment;
  } catch (e) {
    console.error("addComment:", e);
    return null;
  }
}

// ─── UPDATE PROFILE ─────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  full_name?: string;
  username?: string;
  bio?: string;
  areas_of_expertise?: string[];
  company?: string | null;
  position?: string | null;
  website?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  headline?: string | null;
  certifications?: string[];
  avatar_url?: string | null;
  is_public?: boolean;
}

export async function updateProfile(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<boolean> {
  try {
    // `areas_of_expertise` is the app-side name; the actual DB column is `areas`
    const { areas_of_expertise, ...rest } = payload as any;
    const dbPayload: Record<string, unknown> = { ...rest };
    if (areas_of_expertise !== undefined) {
      dbPayload.areas = areas_of_expertise;
    }
    const { error } = await supabase
      .from("profiles")
      .update(dbPayload)
      .or(`id.eq.${userId},user_id.eq.${userId}`);
    if (error) { console.error("updateProfile:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateProfile:", e);
    return false;
  }
}

// ─── SUGGESTED CONNECTIONS ─────────────────────────────────────────────────────

export interface SuggestedProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  plan: string;
  areas: string[];
  connection_status: "none" | "pending" | "connected";
  match_score: number;
  is_following: boolean;
}

export async function fetchSuggestedConnections(
  currentUserId: string,
  userAreas: string[],
  limit = 10,
): Promise<SuggestedProfile[]> {
  try {
    // 1. Get IDs already connected or pending (by profile id or user_id)
    const { data: conns } = await supabase
      .from("connections")
      .select("requester_id, receiver_id, status")
      .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    const excludedIds = new Set<string>([currentUserId]);
    const statusMap = new Map<string, "pending" | "connected">();

    (conns ?? []).forEach((c: any) => {
      const otherId = c.requester_id === currentUserId ? c.receiver_id : c.requester_id;
      excludedIds.add(otherId);
      statusMap.set(otherId, c.status === "accepted" ? "connected" : "pending");
    });

    // 2. Fetch candidate profiles and current user's follows in parallel
    const [profilesRes, followsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, full_name, username, avatar_url, position, company, plan, areas")
        .limit(80),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId),
    ]);

    const { data: profiles } = profilesRes;
    if (!profiles) return [];

    const followingIds = new Set<string>((followsRes.data ?? []).map((f: any) => f.following_id));

    const lowerUserAreas = userAreas.map(a => a.toLowerCase());

    // 3. Score and rank
    const scored = (profiles as any[])
      .filter((p: any) => !excludedIds.has(p.id) && p.id !== currentUserId && p.user_id !== currentUserId)
      .map((p: any) => {
        const pAreas: string[] = Array.isArray(p.areas) ? p.areas : [];
        const match_score = pAreas.filter(a => lowerUserAreas.includes(a.toLowerCase())).length;
        const headline = [p.position, p.company].filter(Boolean).join(" · ") || null;
        return {
          id: p.id,
          full_name: p.full_name,
          username: p.username,
          avatar_url: p.avatar_url,
          headline,
          plan: p.plan ?? "gratuito",
          areas: pAreas,
          connection_status: statusMap.get(p.id) ?? "none",
          match_score,
          is_following: followingIds.has(p.id),
        } as SuggestedProfile;
      })
      .sort((a, b) => {
        if (b.match_score !== a.match_score) return b.match_score - a.match_score;
        const planOrder: Record<string, number> = { exclusive: 3, business: 2, premium: 1, basico: 0, gratuito: 0 };
        return (planOrder[b.plan] ?? 0) - (planOrder[a.plan] ?? 0);
      });

    return scored.slice(0, limit);
  } catch (e) {
    console.warn("fetchSuggestedConnections:", e);
    return [];
  }
}

// ─── USER POSTS ──────────────────────────────────────────────────────────────

export async function fetchUserPosts(targetUserId: string, currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .eq("user_id", targetUserId)
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

// ─── FOLLOWERS / FOLLOWING ────────────────────────────────────────────────────

export interface FollowProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  position: string | null;
  company: string | null;
}

export async function fetchFollowers(userId: string): Promise<FollowProfile[]> {
  try {
    const { data, error } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", userId)
      .limit(100);
    if (error || !data || data.length === 0) return [];
    const ids = (data as any[]).map(r => r.follower_id).filter(Boolean);
    const profileMap = await fetchProfilesForIds(ids);
    return ids.map(id => profileMap.get(id)).filter(Boolean) as FollowProfile[];
  } catch (e) {
    console.warn("fetchFollowers:", e);
    return [];
  }
}

export async function fetchFollowing(userId: string): Promise<FollowProfile[]> {
  try {
    const { data, error } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .limit(100);
    if (error || !data || data.length === 0) return [];
    const ids = (data as any[]).map(r => r.following_id).filter(Boolean);
    const profileMap = await fetchProfilesForIds(ids);
    return ids.map(id => profileMap.get(id)).filter(Boolean) as FollowProfile[];
  } catch (e) {
    console.warn("fetchFollowing:", e);
    return [];
  }
}

export async function fetchConnectionSuggestions(userId: string, limit = 5): Promise<FollowProfile[]> {
  try {
    // Get IDs already followed
    const { data: followedData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const excludeIds = new Set<string>([(followedData ?? []).map((f: any) => f.following_id), userId].flat());

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .not("id", "in", `(${[...excludeIds].join(",")})`)
      .limit(limit);

    if (error || !data) return [];
    return data as FollowProfile[];
  } catch (e) {
    console.warn("fetchConnectionSuggestions:", e);
    return [];
  }
}

// ─── FOLLOWS & CONNECTIONS ────────────────────────────────────────────────────

export async function toggleFollow(
  targetId: string,
  currentUserId: string,
  isFollowing: boolean,
): Promise<void> {
  try {
    if (isFollowing) {
      await supabase.from("follows").delete().match({ follower_id: currentUserId, following_id: targetId });
    } else {
      await supabase.from("follows").upsert(
        { follower_id: currentUserId, following_id: targetId },
        { onConflict: "follower_id,following_id" },
      );
      // Notify target
      await supabase.from("notifications").insert({
        user_id: targetId, actor_id: currentUserId, type: "follow",
        message: "começou a seguir você",
      });
    }
  } catch (e) {
    console.warn("toggleFollow:", e);
  }
}

export async function checkIsFollowing(targetId: string, currentUserId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("follows").select("id")
      .match({ follower_id: currentUserId, following_id: targetId })
      .maybeSingle();
    return !!data;
  } catch { return false; }
}

export async function sendConnectionRequest(targetId: string, currentUserId: string): Promise<void> {
  try {
    await supabase.from("connections").upsert(
      { requester_id: currentUserId, receiver_id: targetId, status: "pending" },
      { onConflict: "requester_id,receiver_id" },
    );
    await supabase.from("notifications").insert({
      user_id: targetId, actor_id: currentUserId, type: "connection",
      message: "enviou um pedido de conexão",
    });
  } catch (e) {
    console.error("sendConnectionRequest:", e);
  }
}

export async function checkConnectionStatus(
  targetId: string,
  currentUserId: string,
): Promise<"none" | "pending" | "connected"> {
  try {
    const { data } = await supabase
      .from("connections")
      .select("status")
      .or(
        `and(requester_id.eq.${currentUserId},receiver_id.eq.${targetId}),` +
        `and(requester_id.eq.${targetId},receiver_id.eq.${currentUserId})`,
      )
      .maybeSingle();
    if (!data) return "none";
    return data.status === "accepted" ? "connected" : "pending";
  } catch { return "none"; }
}

export interface ConnectionProfile {
  connectionId: string;
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  position: string | null;
  company: string | null;
  created_at: string;
}

export async function fetchPendingConnectionsReceived(userId: string): Promise<ConnectionProfile[]> {
  try {
    const { data, error } = await supabase
      .from("connections")
      .select("id, created_at, requester_id")
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return [];
    const requesterIds = (data as any[]).map(r => r.requester_id).filter(Boolean);
    const profileMap = await fetchProfilesForIds(requesterIds);
    return (data as any[]).map((row) => {
      const p = profileMap.get(row.requester_id) ?? {};
      return { connectionId: row.id, id: row.requester_id, full_name: p.full_name ?? null, username: p.username ?? null, avatar_url: p.avatar_url ?? null, position: p.position ?? null, company: p.company ?? null, created_at: row.created_at };
    });
  } catch (e) { console.warn("fetchPendingConnectionsReceived:", e); return []; }
}

export async function fetchPendingConnectionsSent(userId: string): Promise<ConnectionProfile[]> {
  try {
    const { data, error } = await supabase
      .from("connections")
      .select("id, created_at, receiver_id")
      .eq("requester_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return [];
    const receiverIds = (data as any[]).map(r => r.receiver_id).filter(Boolean);
    const profileMap = await fetchProfilesForIds(receiverIds);
    return (data as any[]).map((row) => {
      const p = profileMap.get(row.receiver_id) ?? {};
      return { connectionId: row.id, id: row.receiver_id, full_name: p.full_name ?? null, username: p.username ?? null, avatar_url: p.avatar_url ?? null, position: p.position ?? null, company: p.company ?? null, created_at: row.created_at };
    });
  } catch (e) { console.warn("fetchPendingConnectionsSent:", e); return []; }
}

export async function respondToConnection(
  connectionId: string,
  action: "accepted" | "rejected",
): Promise<boolean> {
  try {
    if (action === "rejected") {
      const { error } = await supabase.from("connections").delete().eq("id", connectionId);
      return !error;
    }
    const { data: connRow, error: fetchErr } = await supabase
      .from("connections")
      .select("requester_id, receiver_id")
      .eq("id", connectionId)
      .single();
    if (fetchErr || !connRow) return false;

    const { error } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .eq("id", connectionId);
    if (error) return false;

    // Unlock any existing direct conversations between these two users
    const userId1 = (connRow as any).requester_id as string;
    const userId2 = (connRow as any).receiver_id as string;
    try {
      // Find all conversation_ids where userId1 is a participant
      const { data: convos1 } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId1);
      if (convos1 && convos1.length > 0) {
        const convoIds1 = (convos1 as any[]).map((c) => c.conversation_id);
        // Find which of those conversations userId2 also participates in
        const { data: shared } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", userId2)
          .in("conversation_id", convoIds1);
        if (shared && shared.length > 0) {
          const sharedConvoIds = (shared as any[]).map((c) => c.conversation_id);
          // Unlock both participants in those shared conversations
          await supabase
            .from("conversation_participants")
            .update({ accepted: true })
            .in("conversation_id", sharedConvoIds)
            .in("user_id", [userId1, userId2]);
        }
      }
    } catch (e) {
      console.error("respondToConnection: failed to unlock conversation", e);
    }

    return true;
  } catch (e) { console.error("respondToConnection:", e); return false; }
}

export async function fetchConnectedUsers(userId: string): Promise<ConnectionProfile[]> {
  try {
    const [sent, received] = await Promise.all([
      supabase.from("connections").select("id, created_at, receiver_id").eq("requester_id", userId).eq("status", "accepted"),
      supabase.from("connections").select("id, created_at, requester_id").eq("receiver_id", userId).eq("status", "accepted"),
    ]);
    const allIds = [
      ...(sent.data ?? []).map((r: any) => r.receiver_id),
      ...(received.data ?? []).map((r: any) => r.requester_id),
    ].filter(Boolean);
    const profileMap = await fetchProfilesForIds([...new Set(allIds)]);
    const s: ConnectionProfile[] = ((sent.data ?? []) as any[]).map((row) => {
      const p = profileMap.get(row.receiver_id) ?? {};
      return { connectionId: row.id, id: row.receiver_id, full_name: (p as any).full_name ?? null, username: (p as any).username ?? null, avatar_url: (p as any).avatar_url ?? null, position: (p as any).position ?? null, company: (p as any).company ?? null, created_at: row.created_at };
    });
    const r: ConnectionProfile[] = ((received.data ?? []) as any[]).map((row) => {
      const p = profileMap.get(row.requester_id) ?? {};
      return { connectionId: row.id, id: row.requester_id, full_name: (p as any).full_name ?? null, username: (p as any).username ?? null, avatar_url: (p as any).avatar_url ?? null, position: (p as any).position ?? null, company: (p as any).company ?? null, created_at: row.created_at };
    });
    return [...s, ...r].sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (e) { console.warn("fetchConnectedUsers:", e); return []; }
}

export interface UserListItem {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export async function fetchUserListForModal(
  userId: string,
  type: "followers" | "following" | "connections",
  limit = 50,
): Promise<UserListItem[]> {
  try {
    if (type === "followers") {
      const { data, error } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId)
        .limit(limit);
      if (error || !data || data.length === 0) return [];
      const ids = (data as any[]).map(r => r.follower_id).filter(Boolean);
      const profileMap = await fetchProfilesForIds(ids);
      return ids.map(id => {
        const p = profileMap.get(id);
        return p ? { id, full_name: p.full_name ?? null, username: p.username ?? null, avatar_url: p.avatar_url ?? null } : null;
      }).filter(Boolean) as UserListItem[];
    }
    if (type === "following") {
      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .limit(limit);
      if (error || !data || data.length === 0) return [];
      const ids = (data as any[]).map(r => r.following_id).filter(Boolean);
      const profileMap = await fetchProfilesForIds(ids);
      return ids.map(id => {
        const p = profileMap.get(id);
        return p ? { id, full_name: p.full_name ?? null, username: p.username ?? null, avatar_url: p.avatar_url ?? null } : null;
      }).filter(Boolean) as UserListItem[];
    }
    // connections
    const [sent, received] = await Promise.all([
      supabase.from("connections").select("receiver_id").eq("requester_id", userId).eq("status", "accepted").limit(limit),
      supabase.from("connections").select("requester_id").eq("receiver_id", userId).eq("status", "accepted").limit(limit),
    ]);
    const allIds = [
      ...(sent.data ?? []).map((r: any) => r.receiver_id),
      ...(received.data ?? []).map((r: any) => r.requester_id),
    ].filter(Boolean);
    const uniqueIds = [...new Set(allIds)];
    if (uniqueIds.length === 0) return [];
    const profileMap = await fetchProfilesForIds(uniqueIds);
    return uniqueIds.map(id => {
      const p = profileMap.get(id);
      return p ? { id, full_name: p.full_name ?? null, username: p.username ?? null, avatar_url: p.avatar_url ?? null } : null;
    }).filter(Boolean) as UserListItem[];
  } catch (e) {
    console.warn("fetchUserListForModal:", e);
    return [];
  }
}

export async function fetchBookmarkedPosts(userId: string): Promise<Post[]> {
  try {
    const { data: bookmarks, error } = await supabase
      .from("bookmarks")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !bookmarks || bookmarks.length === 0) return [];
    const postIds = bookmarks.map((b: any) => b.post_id);
    const { data: rawPosts, error: postsError } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .in("id", postIds);
    if (postsError || !rawPosts) return [];
    const rawUserIds = [...new Set((rawPosts as any[]).map(p => p.user_id).filter(Boolean))];
    const rawCompanyIds = [...new Set((rawPosts as any[]).map(p => p.company_page_id).filter(Boolean))];
    const [profileMap, companyMap] = await Promise.all([
      fetchProfilesForIds(rawUserIds),
      fetchCompanyPagesForIds(rawCompanyIds),
    ]);
    const idOrder = new Map(postIds.map((id: string, i: number) => [id, i]));
    return (await attachAuthorsToPosts(rawPosts as any[], profileMap, companyMap))
      .map((p) => ({ ...p, likes_count: p.likes_count ?? 0, comments_count: p.comments_count ?? 0, is_liked: false, is_bookmarked: true } as Post))
      .sort((a, b) => (idOrder.get(a.id) ?? 99) - (idOrder.get(b.id) ?? 99));
  } catch (e) { console.warn("fetchBookmarkedPosts:", e); return []; }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, type, post_id, message, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("fetchNotifications DB error:", JSON.stringify(error));
      return [];
    }
    if (!data) return [];

    const actorIds = [...new Set((data as any[]).map(n => n.actor_id).filter(Boolean))];

    // For connection notifications, fetch the corresponding connection record
    const connectionActorIds = (data as any[])
      .filter(n => n.type === "connection" && n.actor_id)
      .map(n => n.actor_id);

    const [profileMap, connectionsRes] = await Promise.all([
      fetchCommentProfilesForIds(actorIds),
      connectionActorIds.length > 0
        ? supabase
            .from("connections")
            .select("id, requester_id, receiver_id, status")
            .eq("receiver_id", userId)
            .in("requester_id", connectionActorIds)
        : Promise.resolve({ data: [] }),
    ]);

    const connectionMap = new Map<string, { id: string; status: string }>();
    ((connectionsRes as any).data ?? []).forEach((c: any) => {
      connectionMap.set(c.requester_id, { id: c.id, status: c.status });
    });

    return (data as any[]).map(n => {
      const base = {
        ...n,
        actor: profileMap.get(n.actor_id) ?? null,
      };
      if (n.type === "connection" && n.actor_id) {
        const conn = connectionMap.get(n.actor_id);
        return {
          ...base,
          connection_id: conn?.id ?? null,
          connection_status: (conn?.status as any) ?? null,
        };
      }
      return base;
    }) as unknown as AppNotification[];
  } catch (e) {
    console.warn("fetchNotifications:", e);
    return [];
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", notifId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export async function getUnreadNotifCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);
    return count ?? 0;
  } catch { return 0; }
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUUID = (s: string) => UUID_REGEX.test(s);

export async function fetchPublicProfile(userId: string) {
  try {
    let data: any = null;
    if (isValidUUID(userId)) {
      // Standard UUID lookup (id or legacy user_id column)
      const res = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${userId},user_id.eq.${userId}`)
        .maybeSingle();
      data = res.data;
    } else {
      // Treat as username
      const res = await supabase
        .from("profiles")
        .select("*")
        .eq("username", userId)
        .maybeSingle();
      data = res.data;
    }
    if (!data) return null;
    const d = data as any;
    // Normalise to the names the rest of the app expects
    const headline = d.headline ?? ([d.position, d.company].filter(Boolean).join(" · ") || null);
    const areas_of_expertise: string[] =
      Array.isArray(d.areas_of_expertise) ? d.areas_of_expertise :
      Array.isArray(d.areas) ? d.areas : [];
    return { ...d, headline, areas_of_expertise };
  } catch { return null; }
}

export async function fetchProfilePosts(userId: string, currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return [];

    const postIds = data.map((p: any) => p.id);
    const companyIds = [...new Set(data.map((p: any) => p.company_page_id).filter(Boolean))];
    const [profileMap, companyMap, likedRes, bookmarkRes] = await Promise.all([
      fetchProfilesForIds([userId]),
      fetchCompanyPagesForIds(companyIds),
      supabase.from("likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
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
    console.warn("fetchProfilePosts:", e);
    return [];
  }
}

// ─── STORIES ─────────────────────────────────────────────────────────────────

export async function fetchActiveStories(): Promise<AppStory[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("id, user_id, company_page_id, image_url, text, tagged_users, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return [];

    const sUserIds = [...new Set((data as any[]).map(s => s.user_id).filter(Boolean))];
    const sCompanyIds = [...new Set((data as any[]).map(s => s.company_page_id).filter(Boolean))];
    const [sProfileMap, sCompanyMap] = await Promise.all([
      fetchCommentProfilesForIds(sUserIds),
      fetchCompanyPagesForIds(sCompanyIds),
    ]);

    return (data as any[]).map(s => ({
      ...s,
      author: sProfileMap.get(s.user_id) ?? null,
      company_page: s.company_page_id ? (sCompanyMap.get(s.company_page_id) ?? null) : null,
    })) as unknown as AppStory[];
  } catch (e) {
    console.warn("fetchActiveStories:", e);
    return [];
  }
}

export async function fetchActiveStoriesForUser(currentUserId: string): Promise<StoryGroup[]> {
  try {
    const { data: storiesRaw, error } = await supabase
      .from("stories")
      .select("id, user_id, company_page_id, image_url, text, tagged_users, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (error || !storiesRaw || storiesRaw.length === 0) return [];

    const gsUserIds = [...new Set((storiesRaw as any[]).map(s => s.user_id).filter(Boolean))];
    const gsCompanyIds = [...new Set((storiesRaw as any[]).map(s => s.company_page_id).filter(Boolean))];
    const [gsProfileMap, gsCompanyMap, viewsRes] = await Promise.all([
      fetchCommentProfilesForIds(gsUserIds),
      fetchCompanyPagesForIds(gsCompanyIds),
      supabase.from("story_views").select("story_id").eq("user_id", currentUserId),
    ]);

    const viewedIds = new Set((viewsRes.data ?? []).map((v: { story_id: string }) => v.story_id));

    const stories = (storiesRaw as any[]).map(s => ({
      ...s,
      author: gsProfileMap.get(s.user_id) ?? null,
      company_page: s.company_page_id ? (gsCompanyMap.get(s.company_page_id) ?? null) : null,
    }));

    const storiesWithViewed = (stories as unknown as AppStory[]).map(s => ({
      ...s,
      viewed: viewedIds.has(s.id),
    }));

    // Group by company_page_id (if set) or user_id
    const groupMap = new Map<string, StoryGroup>();
    for (const story of storiesWithViewed) {
      const groupKey = story.company_page_id ? `company_${story.company_page_id}` : story.user_id;
      if (!groupMap.has(groupKey)) {
        if (story.company_page_id && story.company_page) {
          groupMap.set(groupKey, {
            userId: story.user_id,
            companyPageId: story.company_page_id,
            companyPage: story.company_page,
            author: {
              id: story.company_page.id,
              full_name: story.company_page.name,
              avatar_url: story.company_page.avatar_url ?? null,
            },
            stories: [],
            hasUnseen: false,
          });
        } else {
          groupMap.set(groupKey, {
            userId: story.user_id,
            author: story.author ?? { id: story.user_id, full_name: "Usuário", avatar_url: null },
            stories: [],
            hasUnseen: false,
          });
        }
      }
      const group = groupMap.get(groupKey)!;
      group.stories.push(story);
      if (!story.viewed) group.hasUnseen = true;
    }

    const ownGroup = groupMap.get(currentUserId);
    const otherGroups = [...groupMap.values()].filter(g => g.userId !== currentUserId || g.companyPageId);
    const result: StoryGroup[] = [];
    if (ownGroup) result.push(ownGroup);
    result.push(...otherGroups.sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0)));
    return result;
  } catch (e) {
    console.warn("fetchActiveStoriesForUser:", e);
    return [];
  }
}

export async function markStoryViewed(storyId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from("story_views")
      .upsert(
        { story_id: storyId, user_id: userId },
        { onConflict: "story_id,user_id", ignoreDuplicates: true }
      );
  } catch (e) {
    console.warn("markStoryViewed:", e);
  }
}

export async function fetchStoryViewers(storyId: string): Promise<{ id: string; full_name: string; avatar_url?: string | null }[]> {
  try {
    const { data, error } = await supabase
      .from("story_views")
      .select("user_id")
      .eq("story_id", storyId);

    if (error || !data || data.length === 0) return [];
    const viewerIds = (data as any[]).map(d => d.user_id).filter(Boolean);
    const profileMap = await fetchCommentProfilesForIds(viewerIds);
    return viewerIds.map(id => profileMap.get(id)).filter((v): v is { id: string; full_name: string; avatar_url?: string | null } => v !== null);
  } catch (e) {
    console.warn("fetchStoryViewers:", e);
    return [];
  }
}

export async function uploadStoryImage(userId: string, uri: string): Promise<string | null> {
  try {
    const ext = uri.split(".").pop()?.split("?")[0] ?? "jpg";
    const fileName = `${userId}/${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from("stories")
      .upload(fileName, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: true });

    if (error) { console.error("uploadStoryImage:", error); return null; }

    const { data: urlData } = supabase.storage.from("stories").getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("uploadStoryImage:", e);
    return null;
  }
}

export async function createStory(
  userId: string,
  options: { text?: string; imageUri?: string; taggedUsers?: string[]; companyPageId?: string | null }
): Promise<AppStory | null> {
  try {
    let imageUrl: string | null = null;
    if (options.imageUri) {
      imageUrl = await uploadStoryImage(userId, options.imageUri);
      if (!imageUrl) {
        console.error("createStory: image upload failed, aborting story creation");
        return null;
      }
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const insertPayload: any = {
      user_id: userId,
      text: options.text ?? null,
      image_url: imageUrl,
      tagged_users: options.taggedUsers ?? [],
      expires_at: expiresAt,
    };
    if (options.companyPageId) insertPayload.company_page_id = options.companyPageId;

    const { data, error } = await supabase
      .from("stories")
      .insert(insertPayload)
      .select("id, user_id, company_page_id, image_url, text, tagged_users, created_at, expires_at")
      .single();

    if (error) { console.error("createStory:", error); return null; }

    const csUserId = (data as any).user_id;
    const csCompanyId = (data as any).company_page_id;
    const [csProfileMap, csCompanyMap] = await Promise.all([
      fetchCommentProfilesForIds([csUserId]),
      csCompanyId ? fetchCompanyPagesForIds([csCompanyId]) : Promise.resolve(new Map()),
    ]);

    return {
      ...(data as any),
      author: csProfileMap.get(csUserId) ?? null,
      company_page: csCompanyId ? (csCompanyMap.get(csCompanyId) ?? null) : null,
    } as unknown as AppStory;
  } catch (e) {
    console.error("createStory:", e);
    return null;
  }
}

// ─── POLL VOTING ─────────────────────────────────────────────────────────────

export async function voteOnPoll(postId: string, userId: string, optionIndex: number): Promise<void> {
  try {
    const { data: post } = await supabase.from("posts").select("poll").eq("id", postId).single();
    if (!post?.poll) return;

    const poll = post.poll as { options: { text: string; votes: number }[]; total_votes: number; closed: boolean; user_votes?: Record<string, number> };
    if (poll.closed) return;
    if (poll.user_votes?.[userId] != null) return; // already voted

    const newOptions = poll.options.map((opt: any, i: number) =>
      i === optionIndex ? { ...opt, votes: opt.votes + 1 } : opt
    );
    const userVotes = { ...(poll.user_votes ?? {}), [userId]: optionIndex };

    await supabase.from("posts").update({
      poll: {
        ...poll,
        options: newOptions,
        total_votes: poll.total_votes + 1,
        user_votes: userVotes,
      },
    }).eq("id", postId);
  } catch (e) {
    console.warn("voteOnPoll:", e);
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
      return true;
    }
  } catch (e) {
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
}

export async function fetchPostLikes(postId: string): Promise<LikeUser[]> {
  try {
    const { data, error } = await supabase
      .from("likes")
      .select("user_id, company_page_id")
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
        } as LikeUser;
      }
      const p = profileMap.get(l.user_id);
      return {
        id: l.user_id,
        full_name: p?.full_name ?? "Usuário",
        avatar_url: p?.avatar_url ?? null,
        headline: p?.headline ?? null,
        company_page_id: null,
      } as LikeUser;
    });
  } catch (e) {
    console.warn("fetchPostLikes:", e);
    return [];
  }
}

// ─── PROFILE SEARCH ──────────────────────────────────────────────────────────

export async function searchProfiles(
  query: string,
  currentUserId: string,
  limit = 10,
): Promise<{ id: string; full_name: string; username: string; avatar_url: string | null; headline: string | null }[]> {
  if (!query.trim()) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .neq("id", currentUserId)
      .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(limit);
    if (error || !data) return [];
    return (data as any[]).map(p => ({
      ...p,
      headline: [p.position, p.company].filter(Boolean).join(" · ") || null,
    }));
  } catch { return []; }
}

// Search only users who are connections OR people the current user follows
export async function searchChatContacts(
  query: string,
  currentUserId: string,
  limit = 15,
): Promise<{ id: string; full_name: string; username: string; avatar_url: string | null; headline: string | null }[]> {
  if (!query.trim()) return [];
  try {
    const [connRes, followRes] = await Promise.all([
      supabase
        .from("connections")
        .select("requester_id, receiver_id")
        .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId),
    ]);

    const connectedIds = (connRes.data ?? []).map((c: any) =>
      c.requester_id === currentUserId ? c.receiver_id : c.requester_id,
    );
    const followingIds = (followRes.data ?? []).map((f: any) => f.following_id);
    const allowedIds = [...new Set([...connectedIds, ...followingIds])];
    if (allowedIds.length === 0) return [];

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .in("id", allowedIds)
      .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(limit);
    if (error || !data) return [];
    return (data as any[]).map((p) => ({
      ...p,
      headline: [p.position, p.company].filter(Boolean).join(" · ") || null,
    }));
  } catch { return []; }
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────

export async function fetchMessages(conversationId: string, currentUserId?: string): Promise<AppMessage[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select(`
        id, conversation_id, sender_id, from_company_page_id, content, created_at,
        message_type, media_url, reply_to_id, read_at, metadata,
        from_company_page:company_pages(id, name, avatar_url)
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];

    const msgs = data as any[];

    // Fetch reply-to content for quoted messages
    const replyIds = msgs.filter(m => m.reply_to_id).map(m => m.reply_to_id as string);
    let replyMap: Record<string, { content: string; sender_id: string }> = {};
    if (replyIds.length > 0) {
      const { data: replies } = await supabase
        .from("messages")
        .select("id, content, sender_id")
        .in("id", replyIds);
      (replies ?? []).forEach((r: any) => { replyMap[r.id] = { content: r.content, sender_id: r.sender_id }; });
    }

    // Fetch reactions
    const msgIds = msgs.map(m => m.id);
    let reactionsMap: Record<string, AppMessageReaction[]> = {};
    if (msgIds.length > 0) {
      const { data: rxns } = await supabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", msgIds);
      if (rxns) {
        for (const r of rxns as any[]) {
          if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
          const existing = reactionsMap[r.message_id].find(x => x.emoji === r.emoji);
          if (existing) {
            existing.count++;
            if (r.user_id === currentUserId) existing.mine = true;
            existing.users?.push(r.user_id);
          } else {
            reactionsMap[r.message_id].push({
              emoji: r.emoji,
              count: 1,
              mine: r.user_id === currentUserId,
              users: [r.user_id],
            });
          }
        }
      }
    }

    return msgs.map(m => ({
      ...m,
      reply_to: m.reply_to_id ? (replyMap[m.reply_to_id] ?? null) : null,
      reactions: reactionsMap[m.id] ?? [],
    })) as AppMessage[];
  } catch (e) {
    console.error("fetchMessages:", e);
    return [];
  }
}

// ─── READ RECEIPTS ─────────────────────────────────────────────────────────────

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from("conversation_participants")
        .update({ last_read_at: now })
        .match({ conversation_id: conversationId, user_id: userId }),
      supabase
        .from("messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId)
        .is("read_at", null),
    ]);
  } catch (e) {
    console.error("markConversationRead:", e);
  }
}

// ─── REACTIONS ─────────────────────────────────────────────────────────────────

export async function toggleMessageReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from("message_reactions")
      .select("id")
      .match({ message_id: messageId, user_id: userId, emoji })
      .maybeSingle();

    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      // Remove any other emoji from this user on this message first (one reaction per message)
      await supabase.from("message_reactions").delete().match({ message_id: messageId, user_id: userId });
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
    }
    return true;
  } catch (e) {
    console.error("toggleMessageReaction:", e);
    return false;
  }
}

// ─── PUSH TOKENS ──────────────────────────────────────────────────────────────

export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    await supabase
      .from("push_tokens")
      .upsert({ user_id: userId, token, updated_at: new Date().toISOString() }, { onConflict: "user_id,token" });
  } catch (e) {
    console.warn("savePushToken:", e);
  }
}

/**
 * Fetches push tokens for all conversation participants except the sender,
 * then calls the API server to dispatch Expo push notifications.
 */
export async function dispatchPushToConversation(
  conversationId: string,
  senderId: string,
  senderName: string,
  messageBody: string,
): Promise<void> {
  if (!API_URL) return;
  try {
    // Get all participants except sender
    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", senderId);

    if (!participants || participants.length === 0) return;
    const recipientIds = participants.map((p: any) => p.user_id);

    // Fetch their push tokens
    const { data: tokenRows } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", recipientIds);

    if (!tokenRows || tokenRows.length === 0) return;
    const tokens = tokenRows.map((r: any) => r.token).filter(Boolean);
    if (tokens.length === 0) return;

    await fetch(`${API_URL}/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokens,
        title: senderName,
        body: messageBody,
        data: { conversationId },
      }),
    });
  } catch (e) {
    console.error("dispatchPushToConversation:", e);
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  opts?: { reply_to_id?: string; message_type?: string; metadata?: Record<string, any>; companyPageId?: string | null },
): Promise<AppMessage | null> {
  try {
    const payload: any = {
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: opts?.message_type ?? "text",
    };
    if (opts?.reply_to_id) payload.reply_to_id = opts.reply_to_id;
    if (opts?.metadata) payload.metadata = opts.metadata;
    if (opts?.companyPageId) payload.from_company_page_id = opts.companyPageId;

    const { data, error } = await supabase
      .from("messages")
      .insert(payload)
      .select()
      .single();

    if (error) { console.error("sendMessage:", error); return null; }
    return data as AppMessage;
  } catch (e) {
    console.error("sendMessage:", e);
    return null;
  }
}

export async function fetchUserWines(userId: string): Promise<{ id: string; name: string; vintage?: string | null; region?: string | null; notes?: string | null; image_url?: string | null }[]> {
  try {
    const { data, error } = await supabase
      .from("wines")
      .select("id, name, vintage, region, notes, image_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data) return [];
    return data as any[];
  } catch {
    return [];
  }
}

export async function fetchConversations(userId: string, activeCompanyId?: string | null): Promise<AppConversation[]> {
  try {
    // Use SECURITY DEFINER RPC to get all my conversations + the other participant's user_id
    // (cp_select RLS only shows own row, so a plain JOIN would fail)
    const [participantsRes, convosRes] = await Promise.all([
      supabase.rpc("get_my_conversations_participants", { p_user_id: userId }),
      supabase
        .from("conversation_participants")
        .select(`conversation_id, accepted, last_read_at, conversation:conversations(id, is_group, name, created_at)`)
        .eq("user_id", userId),
    ]);

    if (convosRes.error || !convosRes.data) return [];

    // Build a map: conversation_id → { other_user_id, my_accepted }
    const participantMap = new Map<string, { other_user_id: string | null; my_accepted: boolean }>();
    for (const row of (participantsRes.data ?? []) as any[]) {
      participantMap.set(row.conversation_id, {
        other_user_id: row.other_user_id ?? null,
        my_accepted: row.my_accepted ?? true,
      });
    }

    // Collect all other participant user IDs for bulk profile fetch
    const allOtherIds = [...new Set(
      [...participantMap.values()].map(v => v.other_user_id).filter(Boolean) as string[]
    )];
    const profileMap = allOtherIds.length > 0 ? await fetchCommentProfilesForIds(allOtherIds) : new Map();

    const results: AppConversation[] = [];
    for (const row of convosRes.data as any[]) {
      const convo = row.conversation;
      if (!convo) continue;

      const pInfo = participantMap.get(convo.id);
      const participant = pInfo?.other_user_id ? (profileMap.get(pInfo.other_user_id) ?? null) : null;

      let unreadQuery = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convo.id)
        .neq("sender_id", userId)
        .is("read_at", null);

      if (row.last_read_at) {
        unreadQuery = unreadQuery.gt("created_at", row.last_read_at);
      }

      const [lastMsgRes, unreadRes] = await Promise.all([
        supabase
          .from("messages")
          .select("content, created_at, message_type, sender_id, from_company_page_id")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        unreadQuery,
      ]);

      const lastMsg = lastMsgRes.data;
      const lastContent =
        lastMsg?.message_type === "image" ? "📷 Foto"
        : lastMsg?.message_type === "video" ? "🎬 Vídeo"
        : lastMsg?.message_type === "audio" ? "🎤 Áudio"
        : lastMsg?.message_type === "file"  ? "📎 Arquivo"
        : (lastMsg?.content ?? null);

      const otherSenderCompanyId =
        lastMsg && (lastMsg as any).sender_id !== userId
          ? ((lastMsg as any).from_company_page_id ?? null)
          : null;

      results.push({
        id: convo.id,
        is_group: convo.is_group,
        name: convo.name,
        last_message: lastContent,
        last_message_at: lastMsg?.created_at ?? convo.created_at,
        unread_count: unreadRes.count ?? 0,
        participant,
        participant_company: otherSenderCompanyId ? { id: otherSenderCompanyId, name: "", avatar_url: null } : null,
        accepted: pInfo?.my_accepted ?? (row.accepted ?? true),
      });
    }

    // Bulk-fetch company info for conversations where last message was from a company
    const companyIds = [...new Set(results.map(r => r.participant_company?.id).filter(Boolean) as string[])];
    if (companyIds.length > 0) {
      const { data: companyData } = await supabase
        .from("company_pages")
        .select("id, name, avatar_url")
        .in("id", companyIds);
      if (companyData) {
        const companyMap = new Map((companyData as any[]).map(c => [c.id, c]));
        for (const r of results) {
          if (r.participant_company?.id) {
            const cp = companyMap.get(r.participant_company.id);
            if (cp) r.participant_company = { id: cp.id, name: cp.name, avatar_url: cp.avatar_url ?? null };
          }
        }
      }
    }

    // ── Identity filter ────────────────────────────────────────────────────────
    // When in company mode, only show conversations that have at least one
    // message sent by the current user acting as that company.
    if (activeCompanyId) {
      const { data: companyMsgs } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("sender_id", userId)
        .eq("from_company_page_id", activeCompanyId);
      const companyConvIds = new Set((companyMsgs ?? []).map((m: any) => m.conversation_id as string));
      return results
        .filter(r => companyConvIds.has(r.id))
        .sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime());
    }

    return results.sort(
      (a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime(),
    );
  } catch (e) {
    console.error("fetchConversations:", e);
    return [];
  }
}

export async function acceptConversation(conversationId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("conversation_participants")
      .update({ accepted: true })
      .match({ conversation_id: conversationId, user_id: userId });
    return !error;
  } catch { return false; }
}

export async function declineConversation(conversationId: string, userId: string): Promise<boolean> {
  try {
    await supabase
      .from("conversation_participants")
      .delete()
      .match({ conversation_id: conversationId, user_id: userId });
    return true;
  } catch { return false; }
}

export async function fetchConversationParticipant(
  conversationId: string,
  currentUserId: string,
): Promise<{ id: string; full_name: string; avatar_url: string | null } | null> {
  try {
    // Use SECURITY DEFINER RPC to bypass cp_select RLS (which only shows own row)
    const { data, error } = await supabase.rpc("get_conversation_other_participant", {
      p_conversation_id: conversationId,
      p_current_user_id: currentUserId,
    });
    if (error) { console.warn("fetchConversationParticipant rpc:", error); return null; }
    if (!data || (data as any[]).length === 0) return null;
    const otherId = (data as any[])[0]?.user_id ?? (data as any).user_id;
    if (!otherId) return null;
    const pMap = await fetchCommentProfilesForIds([otherId]);
    return pMap.get(otherId) ?? null;
  } catch { return null; }
}

export async function fetchConversationAccepted(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("conversation_participants")
      .select("accepted")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .single();
    if (error) {
      console.warn("fetchConversationAccepted error:", error);
      return true;
    }
    const accepted = (data as any)?.accepted;
    return accepted === false ? false : true;
  } catch (e) {
    console.warn("fetchConversationAccepted threw:", e);
    return true;
  }
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────

export interface AppReportPost {
  id: string;
  content: string;
  user_id: string;
}

export interface AppReportReporter {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

export interface AppReport {
  id: string;
  post_id: string;
  reported_by: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reporter?: AppReportReporter | null;
  post?: AppReportPost | null;
}

export async function createReport(params: {
  post_id: string;
  reported_by: string;
  reason: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("reports")
      .insert({ ...params, status: "pending" });
    if (error) { console.error("createReport:", error); return false; }
    return true;
  } catch (e) {
    console.error("createReport:", e);
    return false;
  }
}

// ── "Não tenho interesse" ─────────────────────────────────────────────────────
// Stores client-side via AsyncStorage (table may not exist yet) +
// best-effort Supabase insert into `post_hidden`
export async function hidePost(userId: string, postId: string): Promise<void> {
  try {
    await supabase.from("post_hidden").insert({ user_id: userId, post_id: postId });
  } catch {
    // silently ignore if table doesn't exist — feed filters it out locally
  }
}

// ── Block user ────────────────────────────────────────────────────────────────
export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_blocks")
      .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
    if (error) { console.error("blockUser:", error); return false; }
    return true;
  } catch (e) {
    console.error("blockUser:", e);
    return false;
  }
}

// ── Unblock user ──────────────────────────────────────────────────────────────
export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .match({ blocker_id: blockerId, blocked_id: blockedId });
    if (error) { console.error("unblockUser:", error); return false; }
    return true;
  } catch (e) {
    console.error("unblockUser:", e);
    return false;
  }
}

export interface BlockedUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface BlockedUserRow {
  blocked_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export async function fetchBlockedUsers(userId: string): Promise<BlockedUser[]> {
  try {
    const { data, error } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", userId)
      .order("created_at", { ascending: false });
    
    if (error || !data || data.length === 0) return [];
    const blockedIds = (data as any[]).map(r => r.blocked_id).filter(Boolean);
    const profileMap = await fetchProfilesForIds(blockedIds);
    return blockedIds.map(id => {
      const p = profileMap.get(id) as any;
      return { id, full_name: p?.full_name ?? null, username: p?.username ?? null, avatar_url: p?.avatar_url ?? null };
    });
  } catch (e) {
    console.warn("fetchBlockedUsers:", e);
    return [];
  }
}
// ── Fetch IDs blocked by user (for feed filtering) ──────────────────────────
export async function fetchBlockedIds(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", userId);
    return (data ?? []).map((r: any) => r.blocked_id);
  } catch {
    return [];
  }
}

export async function fetchPendingReports(): Promise<AppReport[]> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, post_id, reported_by, reason, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return [];

    const reporterIds = [...new Set((data as any[]).map(r => r.reported_by).filter(Boolean))];
    const postIds = [...new Set((data as any[]).map(r => r.post_id).filter(Boolean))];

    const [profileMap, postsRes] = await Promise.all([
      fetchCommentProfilesForIds(reporterIds),
      postIds.length > 0
        ? supabase.from("posts").select("id, content, user_id").in("id", postIds)
        : Promise.resolve({ data: [] }),
    ]);
    const postMap = new Map(((postsRes as any).data ?? []).map((p: any) => [p.id, p]));

    return (data as any[]).map(r => ({
      ...r,
      reporter: r.reported_by ? (profileMap.get(r.reported_by) ?? null) : null,
      post: r.post_id ? (postMap.get(r.post_id) ?? null) : null,
    })) as unknown as AppReport[];
  } catch (e) {
    console.warn("fetchPendingReports:", e);
    return [];
  }
}

export async function updateReportStatus(
  reportId: string,
  status: "approved" | "rejected",
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", reportId)
      .select("id");
    if (error) { console.error("updateReportStatus:", error); return false; }
    // Verify at least one row was actually updated
    if (!data || data.length === 0) {
      console.error("updateReportStatus: no rows updated for id", reportId);
      return false;
    }
    return true;
  } catch (e) {
    console.error("updateReportStatus:", e);
    return false;
  }
}

export async function deletePost(postId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) { console.error("deletePost:", error); return false; }
    return true;
  } catch (e) {
    console.error("deletePost:", e);
    return false;
  }
}

export async function countPendingReports(): Promise<number> {
  try {
    const { count } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return count ?? 0;
  } catch { return 0; }
}

export async function getOrCreateDirectConversation(userId1: string, userId2: string, forceAccepted = false): Promise<string | null> {
  try {
    // Use SECURITY DEFINER RPC to find existing conversation (bypasses cp_select RLS)
    const { data: existing } = await supabase.rpc("get_direct_conversation", {
      p_user1: userId1,
      p_user2: userId2,
    });
    if (existing) return existing as string;

    // Only an accepted connection unlocks the chat immediately (goes to Mensagens).
    // Following only → recipient's accepted=false → goes to Solicitações tab.
    const connCheck = await supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .or(
        `and(requester_id.eq.${userId1},receiver_id.eq.${userId2}),and(requester_id.eq.${userId2},receiver_id.eq.${userId1})`,
      )
      .eq("status", "accepted");
    // forceAccepted=true for company profiles (no messaging restrictions)
    const recipientAccepted = forceAccepted || (connCheck.count ?? 0) > 0;

    // Generate UUID client-side to avoid the RLS SELECT-after-INSERT issue
    // (convos_select requires being a participant, but participants don't exist yet at INSERT time)
    const convoId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });

    const { error: convErr } = await supabase
      .from("conversations")
      .insert({ id: convoId, is_group: false });
    if (convErr) { console.error("getOrCreateDirectConversation insert:", convErr); return null; }

    await supabase.from("conversation_participants").insert([
      { conversation_id: convoId, user_id: userId1, accepted: true },
      { conversation_id: convoId, user_id: userId2, accepted: recipientAccepted },
    ]);

    return convoId;
  } catch (e) {
    console.error("getOrCreateDirectConversation:", e);
    return null;
  }
}

export async function uploadChatMedia(
  conversationId: string,
  uri: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const safeMime = mimeType || "image/jpeg";
    const ext = safeMime.includes("/")
      ? safeMime.split("/")[1]?.replace("jpeg", "jpg").replace("quicktime", "mov") ?? "jpg"
      : "jpg";
    const fileName = `upload_${Date.now()}.${ext}`;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL!;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const userId = sessionData?.session?.user?.id;
    if (!token || !userId) return null;

    // Read the local file URI as a blob then convert to base64.
    // This is the most reliable approach in React Native without expo-file-system:
    // fetch() handles file://, content:// and ph:// URIs natively.
    const fileResponse = await fetch(uri);
    const blob = await fileResponse.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // result = "data:<mime>;base64,<data>" — extract only the data part
        const b64 = result.split(",")[1];
        if (b64) resolve(b64);
        else reject(new Error("FileReader empty result"));
      };
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });

    // POST to API server which uses service role key — bypasses Supabase RLS
    const res = await fetch(`${apiUrl}/uploads/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fileBase64: base64, fileName, mimeType: safeMime, userId }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.status.toString());
      console.error("uploadChatMedia API error:", text);
      return null;
    }

    const json = await res.json();
    return json.url ?? null;
  } catch (e) {
    console.error("uploadChatMedia:", e);
    return null;
  }
}

export async function sendMediaMessage(
  conversationId: string,
  senderId: string,
  mediaUrl: string,
  messageType: "image" | "video" | "audio" | "file",
  caption = "",
): Promise<AppMessage | null> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: caption,
        message_type: messageType,
        media_url: mediaUrl,
      })
      .select()
      .single();
    if (error) { console.error("sendMediaMessage:", error); return null; }
    return data as AppMessage;
  } catch (e) {
    console.error("sendMediaMessage:", e);
    return null;
  }
}

// ─── COMPANY PAGES ────────────────────────────────────────────────────────────

export interface CompanyPage {
  id: string;
  owner_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  plan: string;
  created_at: string;
}

const COMPANY_PAGE_SELECT = "id, owner_id, name, username, avatar_url, bio, website, industry, location, plan, created_at";

export async function fetchUserCompanyPages(userId: string): Promise<CompanyPage[]> {
  try {
    // Pages owned by the user
    const { data: owned, error: ownedErr } = await supabase
      .from("company_pages")
      .select(COMPANY_PAGE_SELECT)
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    if (ownedErr) console.warn("fetchUserCompanyPages owned:", ownedErr.message ?? ownedErr);

    // Pages where user is an admin/member
    const { data: memberships } = await supabase
      .from("company_page_admins")
      .select("company_id")
      .eq("user_id", userId);

    const adminIds = (memberships ?? []).map((m: any) => m.company_id);
    let adminPages: CompanyPage[] = [];
    if (adminIds.length > 0) {
      const { data: adminData } = await supabase
        .from("company_pages")
        .select(COMPANY_PAGE_SELECT)
        .in("id", adminIds)
        .order("created_at", { ascending: true });
      adminPages = (adminData ?? []) as CompanyPage[];
    }

    // Merge, deduplicate by id
    const ownedPages = (owned ?? []) as CompanyPage[];
    const ownedIds = new Set(ownedPages.map(p => p.id));
    const merged = [...ownedPages, ...adminPages.filter(p => !ownedIds.has(p.id))];
    return merged;
  } catch (e) {
    console.error("fetchUserCompanyPages:", e);
    return [];
  }
}

export async function checkUserCompanyRole(
  companyId: string,
  userId: string,
): Promise<{ isOwner: boolean; role: string | null }> {
  try {
    const { data: page } = await supabase
      .from("company_pages")
      .select("owner_id")
      .eq("id", companyId)
      .single();

    if (page?.owner_id === userId) return { isOwner: true, role: "owner" };

    const { data: adminRow } = await supabase
      .from("company_page_admins")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .single();

    if (adminRow) return { isOwner: false, role: adminRow.role };
    return { isOwner: false, role: null };
  } catch (e) {
    return { isOwner: false, role: null };
  }
}

export async function createCompanyPage(params: {
  owner_id: string;
  name: string;
  username?: string;
  bio?: string;
  website?: string;
  industry?: string;
  location?: string;
}): Promise<CompanyPage | null> {
  try {
    const { data, error } = await supabase
      .from("company_pages")
      .insert(params)
      .select()
      .single();
    if (error) { console.error("createCompanyPage:", error); return null; }
    return data as CompanyPage;
  } catch (e) {
    console.error("createCompanyPage:", e);
    return null;
  }
}

export async function fetchCompanyPageById(id: string): Promise<CompanyPage | null> {
  try {
    const { data, error } = await supabase
      .from("company_pages")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return data as CompanyPage;
  } catch (e) {
    console.error("fetchCompanyPageById:", e);
    return null;
  }
}

export async function updateCompanyPage(
  id: string,
  updates: Partial<Pick<CompanyPage, "name" | "username" | "bio" | "website" | "industry" | "location" | "avatar_url">>,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("company_pages").update(updates).eq("id", id);
    if (error) { console.error("updateCompanyPage:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateCompanyPage:", e);
    return false;
  }
}

export async function deleteCompanyPage(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("company_pages").delete().eq("id", id);
    if (error) { console.error("deleteCompanyPage:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteCompanyPage:", e);
    return false;
  }
}

export interface CompanyPageAdmin {
  company_id: string;
  user_id: string;
  role: string;
  added_at: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    position: string | null;
    company: string | null;
  };
}

export async function fetchCompanyPageAdmins(companyId: string): Promise<CompanyPageAdmin[]> {
  try {
    const { data, error } = await supabase
      .from("company_page_admins")
      .select("company_id, user_id, role, added_at")
      .eq("company_id", companyId)
      .order("added_at", { ascending: true });
    if (error || !data || data.length === 0) return [];
    const adminUserIds = [...new Set((data as any[]).map(r => r.user_id).filter(Boolean))];
    const profileMap = await fetchProfilesForIds(adminUserIds);
    return (data as any[]).map(row => ({
      ...row,
      profile: row.user_id ? (profileMap.get(row.user_id) ?? null) : null,
    }));
  } catch (e) {
    console.error("fetchCompanyPageAdmins:", e);
    return [];
  }
}

export async function addCompanyPageAdmin(
  companyId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("company_page_admins").upsert(
      { company_id: companyId, user_id: userId, role },
      { onConflict: "company_id,user_id" },
    );
    if (error) { console.error("addCompanyPageAdmin:", error); return false; }
    return true;
  } catch (e) {
    console.error("addCompanyPageAdmin:", e);
    return false;
  }
}

export async function removeCompanyPageAdmin(companyId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("company_page_admins")
      .delete()
      .eq("company_id", companyId)
      .eq("user_id", userId);
    if (error) { console.error("removeCompanyPageAdmin:", error); return false; }
    return true;
  } catch (e) {
    console.error("removeCompanyPageAdmin:", e);
    return false;
  }
}

export async function uploadCompanyLogo(companyId: string, uri: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { console.error("uploadCompanyLogo: no session"); return null; }

    const rawExt = (uri.split(".").pop()?.split("?")[0] ?? "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
    const mime = safeExt === "png" ? "image/png" : safeExt === "webp" ? "image/webp" : "image/jpeg";
    const path = `${userId}/company-logos/${companyId}.${safeExt}`;

    const resp = await fetch(uri);
    const arrayBuffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, bytes, { contentType: mime, upsert: true });

    if (error) { console.error("uploadCompanyLogo:", error); return null; }

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadCompanyLogo:", e);
    return null;
  }
}

// ─── WINE CELLAR ─────────────────────────────────────────────────────────────

export interface WineEntry {
  id: string;
  user_id: string;
  name: string;
  producer?: string | null;
  vintage?: string | null;
  region?: string | null;
  country?: string | null;
  grape?: string | null;
  ean?: string | null;
  qty: number;
  price?: number | null;
  buy_date?: string | null;
  drink_by?: string | null;
  storage?: string | null;
  notes?: string | null;
  aroma?: string | null;
  sabor?: string | null;
  harmonizacao?: string | null;
  score_100?: number | null;
  rating: number;
  status: "adega" | "consumido" | "presenteado" | "wishlist";
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface WineCommunityRating {
  ean: string;
  name: string;
  producer: string | null;
  vintage: string | null;
  grape: string | null;
  avg_rating: number;
  avg_score: number | null;
  total_ratings: number;
}

export async function fetchWineCellar(userId: string): Promise<WineEntry[]> {
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) { console.error("fetchWineCellar:", error); return []; }
    return (data ?? []) as WineEntry[];
  } catch (e) {
    console.error("fetchWineCellar:", e);
    return [];
  }
}

export async function fetchPublicWineCellar(userId: string): Promise<WineEntry[]> {
  if (!isValidUUID(userId)) return [];
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .select("*")
      .eq("user_id", userId)
      .eq("is_private", false)
      .order("created_at", { ascending: false });

    if (error) { console.error("fetchPublicWineCellar:", error); return []; }
    return (data ?? []) as WineEntry[];
  } catch (e) {
    console.error("fetchPublicWineCellar:", e);
    return [];
  }
}

export async function addWineEntry(params: Omit<WineEntry, "id" | "created_at" | "updated_at">): Promise<WineEntry | null> {
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .insert(params)
      .select()
      .single();
    if (error) { console.error("addWineEntry:", error); return null; }
    return data as WineEntry;
  } catch (e) {
    console.error("addWineEntry:", e);
    return null;
  }
}

export async function updateWineEntry(id: string, changes: Partial<Omit<WineEntry, "id" | "user_id" | "created_at">>): Promise<WineEntry | null> {
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .update(changes)
      .eq("id", id)
      .select()
      .single();
    if (error) { console.error("updateWineEntry:", error); return null; }
    return data as WineEntry;
  } catch (e) {
    console.error("updateWineEntry:", e);
    return null;
  }
}

export async function deleteWineEntry(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("wine_cellar").delete().eq("id", id);
    if (error) { console.error("deleteWineEntry:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteWineEntry:", e);
    return false;
  }
}

/**
 * Busca o ranking comunitário de vinhos via RPC `wine_community_ratings`.
 * Vinhos ordenados por nota média desc.
 * @param ean - Se fornecido, retorna apenas o card daquele EAN específico.
 */
export async function fetchWineCommunityRatings(ean?: string): Promise<WineCommunityRating[]> {
  try {
    const { data, error } = await supabase.rpc("wine_community_ratings", {
      p_ean: ean ?? null,
    });
    if (error) { console.warn("fetchWineCommunityRatings:", error); return []; }
    return (data ?? []) as WineCommunityRating[];
  } catch (e) {
    console.warn("fetchWineCommunityRatings:", e);
    return [];
  }
}

// ─── MARKET PRESENTATIONS ────────────────────────────────────────────────────

export interface MarketPresentation {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  content_url: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchMarketPresentations(): Promise<MarketPresentation[]> {
  try {
    const { data, error } = await supabase
      .from("market_presentations")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as MarketPresentation[];
  } catch (e) {
    console.error("fetchMarketPresentations:", e);
    return [];
  }
}

export async function fetchAllMarketPresentations(): Promise<MarketPresentation[]> {
  try {
    const { data, error } = await supabase
      .from("market_presentations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as MarketPresentation[];
  } catch (e) {
    console.error("fetchAllMarketPresentations:", e);
    return [];
  }
}

export async function upsertMarketPresentation(
  payload: Omit<MarketPresentation, "id" | "created_at" | "updated_at"> & { id?: string },
): Promise<MarketPresentation | null> {
  try {
    const { data, error } = await supabase
      .from("market_presentations")
      .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select()
      .single();
    if (error) { console.error("upsertMarketPresentation:", error); return null; }
    return data as MarketPresentation;
  } catch (e) {
    console.error("upsertMarketPresentation:", e);
    return null;
  }
}

export async function deleteMarketPresentation(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("market_presentations").delete().eq("id", id);
    if (error) { console.error("deleteMarketPresentation:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteMarketPresentation:", e);
    return false;
  }
}

// ─── PRESENTATION SLIDES ─────────────────────────────────────────────────────

export interface PresentationSlide {
  slide_id: string;
  sequence_order: number;
  url: string | null;
  locked: boolean;
}

export interface PresentationSlidesResult {
  slides: PresentationSlide[];
  total: number;
  unlocked: number;
}

export async function fetchPresentationSlides(
  presentationId: string,
  token: string,
): Promise<PresentationSlidesResult> {
  try {
    const res = await fetch(`${API_URL}/api/presentations/${presentationId}/slides`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { slides: [], total: 0, unlocked: 0 };
    const json = await res.json();
    return {
      slides: json.slides ?? [],
      total: json.total ?? 0,
      unlocked: json.unlocked ?? 0,
    };
  } catch (e) {
    console.error("fetchPresentationSlides:", e);
    return { slides: [], total: 0, unlocked: 0 };
  }
}

// ─── MARKET PERMISSIONS ──────────────────────────────────────────────────────

export interface MarketPermission {
  id: string;
  title: string;
  icon: string;
  sort_order: number;
  section_type: string;
}

export async function fetchMarketPermissions(): Promise<MarketPermission[]> {
  try {
    const { data, error } = await supabase
      .from("market_permissions")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) { console.error("fetchMarketPermissions:", error); return []; }
    return (data ?? []) as MarketPermission[];
  } catch (e) {
    console.error("fetchMarketPermissions:", e);
    return [];
  }
}

export async function createMarketPermission(
  perm: Omit<MarketPermission, "sort_order"> & { sort_order?: number },
): Promise<MarketPermission | null> {
  try {
    const { data, error } = await supabase
      .from("market_permissions")
      .insert(perm)
      .select()
      .single();
    if (error) { console.error("createMarketPermission:", error); return null; }
    return data as MarketPermission;
  } catch (e) {
    console.error("createMarketPermission:", e);
    return null;
  }
}

export async function updateMarketPermission(
  id: string,
  updates: Partial<Omit<MarketPermission, "id">>,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("market_permissions")
      .update(updates)
      .eq("id", id);
    if (error) { console.error("updateMarketPermission:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateMarketPermission:", e);
    return false;
  }
}

export async function deleteMarketPermission(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("market_permissions")
      .delete()
      .eq("id", id);
    if (error) { console.error("deleteMarketPermission:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteMarketPermission:", e);
    return false;
  }
}

export async function fetchPlanFeatures(planId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("plans")
      .select("features")
      .eq("id", planId)
      .maybeSingle();
    if (error || !data) return [];
    return (data.features ?? []) as string[];
  } catch {
    return [];
  }
}

// ─── MARKET OVERVIEW ─────────────────────────────────────────────────────────

export interface MarketKPI {
  label: string;
  value: string;
  period: string;
  change: number;
  icon: string;
  description?: string;
  source?: string;
  updatedAt?: string;
}

export interface MarketChartArea {
  exports: number[];
  imports: number[];
  labels: string[];
  yLabels: string[];
}

export interface MarketChartBar {
  values: number[];
  labels: string[];
}

export interface MarketTendencia {
  title: string;
  desc: string;
  change: number;
  pos: boolean;
}

export interface MarketRegiao {
  rank: number;
  name: string;
  volume: string;
  pct: number;
}

export interface MarketVariedade {
  name: string;
  volume: string;
  change: number;
}

export interface MarketOverview {
  period: "mes" | "trimestre" | "ano";
  kpis: MarketKPI[];
  chart_area: MarketChartArea;
  chart_bar: MarketChartBar;
  tendencias: MarketTendencia[];
  regioes: MarketRegiao[];
  variedades: MarketVariedade[];
  updated_at: string;
  [key: string]: unknown;
}

export async function updateMarketOverview(
  period: "mes" | "trimestre" | "ano",
  updates: Partial<Omit<MarketOverview, "period" | "updated_at">>,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("market_overview")
      .upsert(
        { period, ...updates, updated_at: new Date().toISOString() },
        { onConflict: "period" },
      );
    if (error) { console.error("updateMarketOverview:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateMarketOverview:", e);
    return false;
  }
}

export async function fetchMarketOverview(
  period: "mes" | "trimestre" | "ano",
): Promise<MarketOverview | null> {
  try {
    const { data, error } = await supabase
      .from("market_overview")
      .select("*")
      .eq("period", period)
      .single();
    if (error || !data) return null;
    return data as MarketOverview;
  } catch (e) {
    console.error("fetchMarketOverview:", e);
    return null;
  }
}

// ─── OPPORTUNITIES ─────────────────────────────────────────────────────────────

export interface AppOpportunity {
  id: string;
  created_by: string;
  type: "vaga" | "marketplace";
  title: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  price?: string | null;
  cover_image_url?: string | null;
  company?: string | null;
  contract_type?: string | null;
  salary?: string | null;
  contact_email?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
  interests_count?: number;
  applications_count?: number;
  creator?: { id: string; full_name: string | null; avatar_url?: string | null; position?: string | null; company?: string | null } | null;
  is_applied?: boolean;
  is_interested?: boolean;
  is_saved?: boolean;
}

export async function fetchOpportunities(
  type: "vaga" | "marketplace",
  search: string,
  userId: string,
): Promise<AppOpportunity[]> {
  try {
    let query = supabase
      .from("opportunities")
      .select(`
        id, created_by, type, title, description, category, location, price, cover_image_url,
        company, contract_type, salary, contact_email, expires_at, is_active, created_at,
        interests_count, applications_count
      `)
      .eq("is_active", true)
      .eq("type", type)
      .order("created_at", { ascending: false });

    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,company.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(50);
    if (error || !data) return [];

    const ids = (data as any[]).map((d) => d.id);

    // Check which ones the user already applied to (vagas only) + saved
    let appliedIds = new Set<string>();
    let savedIds = new Set<string>();

    const promises: Promise<any>[] = [];

    if (type === "vaga" && ids.length > 0) {
      promises.push(
        Promise.resolve(
          supabase
            .from("opportunity_applications")
            .select("opportunity_id")
            .eq("applicant_id", userId)
            .in("opportunity_id", ids),
        ).then(({ data: apps }) => {
          if (apps) apps.forEach((a: any) => appliedIds.add(a.opportunity_id));
        }),
      );
    }

    if (ids.length > 0) {
      promises.push(
        Promise.resolve(
          supabase
            .from("opportunity_saves")
            .select("opportunity_id")
            .eq("user_id", userId)
            .in("opportunity_id", ids),
        ).then(({ data: saves }) => {
          if (saves) saves.forEach((s: any) => savedIds.add(s.opportunity_id));
        }),
      );
    }

    const creatorIds = [...new Set((data as any[]).map(d => d.created_by).filter(Boolean))];
    const [creatorMap] = await Promise.all([
      fetchCommentProfilesForIds(creatorIds),
      ...promises,
    ]);

    return (data as any[]).map((d) => ({
      ...d,
      creator: d.created_by ? (creatorMap.get(d.created_by) ?? null) : null,
      is_applied: appliedIds.has(d.id),
      is_saved: savedIds.has(d.id),
      interests_count: d.interests_count ?? 0,
      applications_count: d.applications_count ?? 0,
    })) as AppOpportunity[];
  } catch (e) {
    console.error("fetchOpportunities:", e);
    return [];
  }
}

export async function fetchOpportunityById(
  id: string,
  userId: string,
): Promise<(AppOpportunity & { is_applied: boolean; is_interested: boolean; applications_count: number }) | null> {
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select(`id, created_by, type, title, description, category, location, price,
        company, contract_type, salary, contact_email, expires_at, is_active, created_at`)
      .eq("id", id)
      .single();

    if (error || !data) return null;

    const creatorId = (data as any).created_by;
    const creatorMap = creatorId ? await fetchCommentProfilesForIds([creatorId]) : new Map();
    (data as any).creator = creatorId ? (creatorMap.get(creatorId) ?? null) : null;

    const isVaga = (data as any).type === "vaga";

    const [appRes, countRes, interestRes] = await Promise.all([
      isVaga
        ? supabase
            .from("opportunity_applications")
            .select("id")
            .eq("opportunity_id", id)
            .eq("applicant_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      isVaga
        ? supabase
            .from("opportunity_applications")
            .select("id", { count: "exact", head: true })
            .eq("opportunity_id", id)
        : Promise.resolve({ count: 0 }),
      !isVaga
        ? supabase
            .from("notifications")
            .select("id")
            .eq("type", "interest")
            .eq("opportunity_id", id)
            .eq("actor_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      ...(data as any),
      creator: (data as any).creator ?? null,
      is_applied: !!appRes.data,
      is_interested: !!interestRes.data,
      applications_count: (countRes as any).count ?? 0,
    };
  } catch (e) {
    console.error("fetchOpportunityById:", e);
    return null;
  }
}

export async function createOpportunity(
  payload: Omit<AppOpportunity, "id" | "created_at" | "is_active" | "creator" | "is_applied" | "applications_count">,
  userId: string,
): Promise<AppOpportunity | null> {
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .insert({ ...payload, created_by: userId, is_active: true })
      .select()
      .single();

    if (error || !data) { console.error("createOpportunity:", error); return null; }
    return data as AppOpportunity;
  } catch (e) {
    console.error("createOpportunity:", e);
    return null;
  }
}

export async function uploadCV(uri: string, userId: string): Promise<string | null> {
  try {
    const ext = uri.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `cvs/${userId}/${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const contentType = ext === "pdf" ? "application/pdf" : ext === "doc" || ext === "docx" ? "application/msword" : "application/octet-stream";

    const { error } = await supabase.storage.from("cvs").upload(path, bytes, {
      contentType,
      upsert: true,
    });

    if (error) { console.error("uploadCV:", error); return null; }

    const { data } = supabase.storage.from("cvs").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("uploadCV:", e);
    return null;
  }
}

export async function applyToJob(
  opportunityId: string,
  applicantId: string,
  cvUrl: string | null,
  message: string | null,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("opportunity_applications")
      .insert({ opportunity_id: opportunityId, applicant_id: applicantId, cv_url: cvUrl, message });

    if (error) { console.error("applyToJob:", error); return false; }

    // Notifica o criador da vaga
    const { data: opp } = await supabase
      .from("opportunities")
      .select("created_by, title")
      .eq("id", opportunityId)
      .single();

    if (opp && opp.created_by !== applicantId) {
      await supabase.from("notifications").insert({
        user_id: opp.created_by,
        actor_id: applicantId,
        type: "application",
        opportunity_id: opportunityId,
        message: `se candidatou à vaga "${opp.title}"`,
      });
    }

    return true;
  } catch (e) {
    console.error("applyToJob:", e);
    return false;
  }
}

export async function expressInterest(
  opportunityId: string,
  userId: string,
  message: string | null,
): Promise<boolean> {
  try {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("created_by, title")
      .eq("id", opportunityId)
      .single();

    if (!opp) return false;

    if (opp.created_by === userId) return true;

    // Evita notificação duplicada: verifica se já existe interesse deste usuário neste anúncio
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("type", "interest")
      .eq("opportunity_id", opportunityId)
      .eq("actor_id", userId)
      .maybeSingle();

    if (existing) return true; // já registrado — sem nova notificação

    await supabase.from("notifications").insert({
      user_id: opp.created_by,
      actor_id: userId,
      type: "interest",
      opportunity_id: opportunityId,
      message: `tem interesse no seu anúncio "${opp.title}"`,
    });

    return true;
  } catch (e) {
    console.error("expressInterest:", e);
    return false;
  }
}

export async function toggleOpportunity(id: string, isActive: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("opportunities")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) { console.error("toggleOpportunity:", error); return false; }
    return true;
  } catch (e) {
    console.error("toggleOpportunity:", e);
    return false;
  }
}

// ── Save / unsave opportunities ───────────────────────────────────────────────
export async function toggleSaveOpportunity(
  opportunityId: string,
  userId: string,
  isSaved: boolean,
): Promise<boolean> {
  try {
    if (isSaved) {
      const { error } = await supabase
        .from("opportunity_saves")
        .delete()
        .match({ opportunity_id: opportunityId, user_id: userId });
      if (error) { console.error("toggleSaveOpportunity (delete):", error); return false; }
    } else {
      const { error } = await supabase
        .from("opportunity_saves")
        .upsert({ opportunity_id: opportunityId, user_id: userId }, { onConflict: "opportunity_id,user_id" });
      if (error) { console.error("toggleSaveOpportunity (insert):", error); return false; }
    }
    return true;
  } catch (e) {
    console.error("toggleSaveOpportunity:", e);
    return false;
  }
}

export async function fetchSavedOpportunityIds(userId: string): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from("opportunity_saves")
      .select("opportunity_id")
      .eq("user_id", userId);
    return new Set((data ?? []).map((r: any) => r.opportunity_id));
  } catch {
    return new Set();
  }
}

// ── My Opportunities (empresa dashboard) ─────────────────────────────────────
export async function fetchMyOpportunities(
  userId: string,
  type?: "vaga" | "marketplace",
): Promise<AppOpportunity[]> {
  try {
    let q = supabase
      .from("opportunities")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) { console.error("fetchMyOpportunities:", error); return []; }
    return (data ?? []) as AppOpportunity[];
  } catch (e) {
    console.error("fetchMyOpportunities:", e);
    return [];
  }
}

// ── Applications received by empresa ─────────────────────────────────────────
export interface AppApplication {
  id: string;
  opportunity_id: string;
  applicant_id: string;
  cv_url: string | null;
  message: string | null;
  created_at: string;
  applicant: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    position: string | null;
    company: string | null;
  } | null;
  opportunity: {
    id: string;
    title: string;
    type: string;
  } | null;
}

export async function fetchApplicationsForMyOpportunities(
  userId: string,
): Promise<AppApplication[]> {
  try {
    const { data: myOps, error: opsErr } = await supabase
      .from("opportunities")
      .select("id")
      .eq("created_by", userId);
    if (opsErr || !myOps?.length) return [];
    const opIds = myOps.map((o: any) => o.id);
    const { data, error } = await supabase
      .from("opportunity_applications")
      .select("id, opportunity_id, applicant_id, cv_url, message, created_at")
      .in("opportunity_id", opIds)
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchApplicationsForMyOpportunities:", error); return []; }
    if (!data || data.length === 0) return [];

    const applicantIds = [...new Set((data as any[]).map(a => a.applicant_id).filter(Boolean))];
    const oppIds2 = [...new Set((data as any[]).map(a => a.opportunity_id).filter(Boolean))];

    const [applicantMap, oppsRes] = await Promise.all([
      fetchProfilesForIds(applicantIds),
      supabase.from("opportunities").select("id, title, type").in("id", oppIds2),
    ]);
    const oppMap = new Map(((oppsRes as any).data ?? []).map((o: any) => [o.id, o]));

    return (data as any[]).map(a => ({
      ...a,
      applicant: a.applicant_id ? (applicantMap.get(a.applicant_id) ?? null) : null,
      opportunity: a.opportunity_id ? (oppMap.get(a.opportunity_id) ?? null) : null,
    })) as any[];
  } catch (e) {
    console.error("fetchApplicationsForMyOpportunities:", e);
    return [];
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
export interface AppEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location_type: "presencial" | "online" | string;
  location: string | null;
  link: string | null;
  image_url: string | null;
  restricted_positions: string[] | null;
  entry_type: "gratuito" | "pago-externo" | "pago-integrado" | string;
  capacity: number | null;
  visibility: string | null;
  is_active: boolean | null;
  pay_link: string | null;
  created_at: string;
  organizer?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
  company_organizer?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  attendees_count?: number;
  is_attending?: boolean;
}

export interface AppEventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: string | null;
  created_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    position: string | null;
  } | null;
}

async function enrichEventsWithOrganizer(events: any[]): Promise<any[]> {
  if (events.length === 0) return events;
  const userIds = [...new Set(events.map((e: any) => e.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, username")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const { data: companies } = await supabase
    .from("company_pages")
    .select("id, owner_id, name, avatar_url")
    .in("owner_id", userIds);
  const companyByOwner = new Map((companies ?? []).map((c: any) => [c.owner_id, c]));

  return events.map((e: any) => ({
    ...e,
    organizer: profileMap.get(e.user_id) ?? null,
    company_organizer: companyByOwner.get(e.user_id) ?? null,
  }));
}

export async function fetchEvents(search = "", userId = ""): Promise<AppEvent[]> {
  try {
    let q = supabase
      .from("events")
      .select(`
        id, user_id, title, description, start_date, end_date,
        location_type, location, link, image_url, restricted_positions,
        entry_type, capacity, visibility, is_active, pay_link, created_at,
        attendees_count
      `)
      .eq("is_active", true)
      .order("start_date", { ascending: true });
    if (search) q = q.ilike("title", `%${search}%`);
    const { data, error } = await q;
    if (error) { console.error("fetchEvents:", error); return []; }

    let events = await enrichEventsWithOrganizer(
      (data ?? []).map((e: any) => ({ ...e, attendees_count: e.attendees_count ?? 0, is_attending: false }))
    );

    if (userId && events.length > 0) {
      const ids = events.map((e: any) => e.id);

      const [attendingResult, profileResult] = await Promise.all([
        supabase.from("event_attendees").select("event_id").eq("user_id", userId).in("event_id", ids),
        supabase.from("profiles").select("position, areas_of_expertise").eq("id", userId).maybeSingle(),
      ]);

      const attendingSet = new Set((attendingResult.data ?? []).map((a: any) => a.event_id));
      events = events.map((e: any) => ({ ...e, is_attending: attendingSet.has(e.id) }));

      const userPosition: string | null = profileResult.data?.position ?? null;
      const userAreas: string[] = profileResult.data?.areas_of_expertise ?? [];

      events = events.filter((e: any) => {
        if (e.visibility !== "restrito") return true;
        if (e.user_id === userId) return true;
        const allowed: string[] = e.restricted_positions ?? [];
        if (allowed.length === 0) return true;
        if (userPosition && allowed.includes(userPosition)) return true;
        if (userAreas.some((a: string) => allowed.includes(a))) return true;
        return false;
      });
    } else {
      events = events.filter((e: any) => e.visibility !== "restrito");
    }

    return events;
  } catch (e) {
    console.error("fetchEvents:", e);
    return [];
  }
}

export async function fetchAllEventsAdmin(): Promise<AppEvent[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, user_id, title, description, start_date, end_date, location_type, location, link, image_url, restricted_positions, entry_type, capacity, visibility, is_active, pay_link, created_at")
      .order("start_date", { ascending: true });
    if (error) { console.error("fetchAllEventsAdmin:", error); return []; }
    return await enrichEventsWithOrganizer(data ?? []);
  } catch (e) {
    console.error("fetchAllEventsAdmin:", e);
    return [];
  }
}

export async function fetchConfirmedAttendanceCount(): Promise<number> {
  try {
    // Count all attendee rows — cancellation removes the row so all rows are confirmed.
    // Falls back gracefully if the status column doesn't exist yet.
    const { count, error } = await supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true });
    if (error) { console.error("fetchConfirmedAttendanceCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchConfirmedAttendanceCount:", e);
    return 0;
  }
}

export async function fetchEventById(id: string): Promise<AppEvent | null> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, user_id, title, description, start_date, end_date,
        location_type, location, link, image_url, restricted_positions,
        entry_type, capacity, visibility, is_active, pay_link, created_at
      `)
      .eq("id", id)
      .single();
    if (error) { console.error("fetchEventById:", error); return null; }
    const [enriched] = await enrichEventsWithOrganizer([data]);
    return (enriched ?? data) as any;
  } catch (e) {
    console.error("fetchEventById:", e);
    return null;
  }
}

export async function uploadEventImage(imageUri: string, userId: string): Promise<string | null> {
  try {
    const ext = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/events/${Date.now()}.${ext}`;
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(path, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: true });
    if (error) { console.error("uploadEventImage:", error); return null; }
    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("uploadEventImage:", e);
    return null;
  }
}

export async function createEvent(params: {
  user_id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  location_type: string;
  location?: string | null;
  link?: string | null;
  image_url?: string | null;
  restricted_positions?: string[] | null;
  entry_type: string;
  capacity?: number | null;
  visibility?: string;
  pay_link?: string | null;
}): Promise<AppEvent | null> {
  try {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...params, is_active: true })
      .select()
      .single();
    if (error) { console.error("createEvent:", error); return null; }
    return data as any;
  } catch (e) {
    console.error("createEvent:", e);
    return null;
  }
}

export async function fetchEventAttendees(eventId: string): Promise<AppEventAttendee[]> {
  try {
    const { data, error } = await supabase
      .from("event_attendees")
      .select("id, event_id, user_id, status, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error) { console.error("fetchEventAttendees:", error); return []; }
    if (!data || data.length === 0) return [];
    const attendeeIds = [...new Set((data as any[]).map(a => a.user_id).filter(Boolean))];
    const profileMap = await fetchProfilesForIds(attendeeIds);
    return (data as any[]).map(a => ({
      ...a,
      profile: a.user_id ? (profileMap.get(a.user_id) ?? null) : null,
    })) as any[];
  } catch (e) {
    console.error("fetchEventAttendees:", e);
    return [];
  }
}

export async function checkAttendance(eventId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("event_attendees")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function confirmAttendance(
  eventId: string,
  userId: string,
  organizerId: string,
  eventTitle: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("event_attendees")
      .upsert({ event_id: eventId, user_id: userId, status: "confirmed" }, { onConflict: "event_id,user_id" });
    if (error) { console.error("confirmAttendance:", error); return false; }
    if (organizerId !== userId) {
      await supabase.from("notifications").insert({
        user_id: organizerId,
        actor_id: userId,
        type: "event_rsvp",
        message: `confirmou presença no seu evento "${eventTitle}"`,
      });
    }
    return true;
  } catch (e) {
    console.error("confirmAttendance:", e);
    return false;
  }
}

export async function cancelAttendance(eventId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("event_attendees")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);
    if (error) { console.error("cancelAttendance:", error); return false; }
    return true;
  } catch (e) {
    console.error("cancelAttendance:", e);
    return false;
  }
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────────

export interface DailyEngagement {
  date: string;
  likes: number;
  comments: number;
}

export interface TopPost {
  id: string;
  content: string;
  likes: number;
  comments: number;
  engagement: number;
}

export interface UserAnalytics {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalPosts: number;
  followersCount: number;
  dailyEngagement: DailyEngagement[];
  topPosts: TopPost[];
}

export interface CompanyAnalytics {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  followersCount: number;
  currentWeekLikes: number;
  currentWeekComments: number;
  currentWeekPosts: number;
  prevWeekLikes: number;
  prevWeekComments: number;
  prevWeekPosts: number;
  dailyEngagement: DailyEngagement[];
  topPosts: TopPost[];
}

function buildDailyEngagement(
  likesDates: string[],
  commentsDates: string[],
  days = 14,
): DailyEngagement[] {
  const result: DailyEngagement[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      likes: likesDates.filter((s) => s.slice(0, 10) === key).length,
      comments: commentsDates.filter((s) => s.slice(0, 10) === key).length,
    });
  }
  return result;
}

export async function fetchUserAnalytics(userId: string): Promise<UserAnalytics> {
  try {
    const cutoff14 = new Date();
    cutoff14.setDate(cutoff14.getDate() - 14);
    const cutoff14Iso = cutoff14.toISOString();

    const [postsRes, profileRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, content, likes_count, comments_count, shares_count")
        .eq("user_id", userId),
      supabase
        .from("profiles")
        .select("followers_count")
        .eq("id", userId)
        .single(),
    ]);

    const posts: any[] = postsRes.data ?? [];
    const followersCount: number = (profileRes.data as any)?.followers_count ?? 0;

    const totalLikes = posts.reduce((s: number, p: any) => s + (p.likes_count ?? 0), 0);
    const totalComments = posts.reduce((s: number, p: any) => s + (p.comments_count ?? 0), 0);
    const totalShares = posts.reduce((s: number, p: any) => s + (p.shares_count ?? 0), 0);

    const postIds = posts.map((p: any) => p.id);

    let likesDates: string[] = [];
    let commentsDates: string[] = [];

    if (postIds.length > 0) {
      const [likesRes, commentsRes] = await Promise.all([
        supabase
          .from("likes")
          .select("created_at")
          .in("post_id", postIds)
          .gte("created_at", cutoff14Iso),
        supabase
          .from("comments")
          .select("created_at")
          .in("post_id", postIds)
          .gte("created_at", cutoff14Iso),
      ]);
      likesDates = (likesRes.data ?? []).map((r: any) => r.created_at as string);
      commentsDates = (commentsRes.data ?? []).map((r: any) => r.created_at as string);
    }

    const dailyEngagement = buildDailyEngagement(likesDates, commentsDates, 14);

    const topPosts: TopPost[] = posts
      .map((p: any) => ({
        id: p.id,
        content: p.content,
        likes: p.likes_count ?? 0,
        comments: p.comments_count ?? 0,
        engagement: (p.likes_count ?? 0) + (p.comments_count ?? 0),
      }))
      .sort((a: TopPost, b: TopPost) => b.engagement - a.engagement)
      .slice(0, 3);

    return { totalLikes, totalComments, totalShares, totalPosts: posts.length, followersCount, dailyEngagement, topPosts };
  } catch (e) {
    console.error("fetchUserAnalytics:", e);
    return { totalLikes: 0, totalComments: 0, totalShares: 0, totalPosts: 0, followersCount: 0, dailyEngagement: [], topPosts: [] };
  }
}

export async function fetchCompanyAnalytics(companyUserId: string): Promise<CompanyAnalytics> {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    const cutoff14 = new Date(now);
    cutoff14.setDate(now.getDate() - 14);

    const [postsRes, profileRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, content, likes_count, comments_count, shares_count, created_at")
        .eq("user_id", companyUserId),
      supabase
        .from("profiles")
        .select("followers_count")
        .eq("id", companyUserId)
        .single(),
    ]);

    const posts: any[] = postsRes.data ?? [];
    const followersCount: number = (profileRes.data as any)?.followers_count ?? 0;

    const totalLikes = posts.reduce((s: number, p: any) => s + (p.likes_count ?? 0), 0);
    const totalComments = posts.reduce((s: number, p: any) => s + (p.comments_count ?? 0), 0);

    const currentWeekPosts = posts.filter((p: any) => new Date(p.created_at) >= startOfWeek).length;
    const prevWeekPosts = posts.filter((p: any) => {
      const d = new Date(p.created_at);
      return d >= startOfPrevWeek && d < startOfWeek;
    }).length;

    const postIds = posts.map((p: any) => p.id);

    let likesDates: string[] = [];
    let commentsDates: string[] = [];
    let currentWeekLikes = 0;
    let currentWeekComments = 0;
    let prevWeekLikes = 0;
    let prevWeekComments = 0;

    if (postIds.length > 0) {
      const [likesRes, commentsRes] = await Promise.all([
        supabase
          .from("likes")
          .select("created_at")
          .in("post_id", postIds),
        supabase
          .from("comments")
          .select("created_at")
          .in("post_id", postIds),
      ]);
      const allLikesDates: string[] = (likesRes.data ?? []).map((r: any) => r.created_at as string);
      const allCommentsDates: string[] = (commentsRes.data ?? []).map((r: any) => r.created_at as string);

      currentWeekLikes = allLikesDates.filter((d) => new Date(d) >= startOfWeek).length;
      currentWeekComments = allCommentsDates.filter((d) => new Date(d) >= startOfWeek).length;
      prevWeekLikes = allLikesDates.filter((d) => { const dt = new Date(d); return dt >= startOfPrevWeek && dt < startOfWeek; }).length;
      prevWeekComments = allCommentsDates.filter((d) => { const dt = new Date(d); return dt >= startOfPrevWeek && dt < startOfWeek; }).length;

      likesDates = allLikesDates.filter((d) => new Date(d) >= cutoff14);
      commentsDates = allCommentsDates.filter((d) => new Date(d) >= cutoff14);
    }

    const dailyEngagement = buildDailyEngagement(likesDates, commentsDates, 14);

    const topPosts: TopPost[] = posts
      .map((p: any) => ({
        id: p.id,
        content: p.content,
        likes: p.likes_count ?? 0,
        comments: p.comments_count ?? 0,
        engagement: (p.likes_count ?? 0) + (p.comments_count ?? 0),
      }))
      .sort((a: TopPost, b: TopPost) => b.engagement - a.engagement)
      .slice(0, 3);

    return {
      totalPosts: posts.length,
      totalLikes,
      totalComments,
      followersCount,
      currentWeekLikes,
      currentWeekComments,
      currentWeekPosts,
      prevWeekLikes,
      prevWeekComments,
      prevWeekPosts,
      dailyEngagement,
      topPosts,
    };
  } catch (e) {
    console.error("fetchCompanyAnalytics:", e);
    return {
      totalPosts: 0, totalLikes: 0, totalComments: 0, followersCount: 0,
      currentWeekLikes: 0, currentWeekComments: 0, currentWeekPosts: 0,
      prevWeekLikes: 0, prevWeekComments: 0, prevWeekPosts: 0,
      dailyEngagement: [], topPosts: [],
    };
  }
}

// ─── CERTIFICATION REQUESTS ───────────────────────────────────────────────────

export interface CertificationRequest {
  id: string;
  user_id: string;
  name: string;
  issuer: string;
  cert_number?: string | null;
  date?: string | null;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  requester?: { id: string; full_name: string | null; avatar_url?: string | null } | null;
}

export async function submitCertificationRequest(params: {
  user_id: string;
  name: string;
  issuer: string;
  cert_number?: string;
  date?: string;
}): Promise<CertificationRequest | null> {
  try {
    const { data, error } = await supabase
      .from("certification_requests")
      .insert({
        user_id: params.user_id,
        name: params.name,
        issuer: params.issuer,
        cert_number: params.cert_number || null,
        date: params.date || null,
        status: "pending",
      })
      .select("id, user_id, name, issuer, cert_number, date, status, created_at, reviewed_at, reviewed_by")
      .single();
    if (error) { console.error("submitCertificationRequest:", error); return null; }
    return data as CertificationRequest;
  } catch (e) {
    console.error("submitCertificationRequest:", e);
    return null;
  }
}

export async function getMyCertificationRequests(userId: string): Promise<CertificationRequest[]> {
  try {
    const { data, error } = await supabase
      .from("certification_requests")
      .select("id, user_id, name, issuer, cert_number, date, status, created_at, reviewed_at, reviewed_by")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !data) { console.error("getMyCertificationRequests:", error); return []; }
    return data as CertificationRequest[];
  } catch (e) {
    console.error("getMyCertificationRequests:", e);
    return [];
  }
}

export async function getAdminCertificationRequests(
  status?: "pending" | "verified" | "rejected",
): Promise<CertificationRequest[]> {
  try {
    let query = supabase
      .from("certification_requests")
      .select("id, user_id, name, issuer, cert_number, date, status, created_at, reviewed_at, reviewed_by")
      .order("created_at", { ascending: false });
    if (status) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error || !data) { console.error("getAdminCertificationRequests:", error); return []; }
    if (data.length === 0) return [];
    const certUserIds = [...new Set((data as any[]).map(r => r.user_id).filter(Boolean))];
    const profileMap = await fetchCommentProfilesForIds(certUserIds);
    return (data as any[]).map(r => ({
      ...r,
      requester: r.user_id ? (profileMap.get(r.user_id) ?? null) : null,
    })) as unknown as CertificationRequest[];
  } catch (e) {
    console.error("getAdminCertificationRequests:", e);
    return [];
  }
}

export async function reviewCertificationRequest(
  id: string,
  action: "verified" | "rejected",
  adminId: string,
): Promise<boolean> {
  try {
    const { data: req, error: fetchErr } = await supabase
      .from("certification_requests")
      .select("user_id, name")
      .eq("id", id)
      .single();
    if (fetchErr || !req) { console.error("reviewCertificationRequest fetch:", fetchErr); return false; }

    const { error: updateErr } = await supabase
      .from("certification_requests")
      .update({ status: action, reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .eq("id", id);
    if (updateErr) { console.error("reviewCertificationRequest update:", updateErr); return false; }

    if (action === "verified") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("certifications")
        .eq("id", req.user_id)
        .single();
      const existing: string[] = Array.isArray(profile?.certifications) ? profile.certifications : [];
      if (!existing.includes(req.name)) {
        await supabase
          .from("profiles")
          .update({ certifications: [...existing, req.name] })
          .eq("id", req.user_id);
      }
    }

    return true;
  } catch (e) {
    console.error("reviewCertificationRequest:", e);
    return false;
  }
}

// ─── AVATAR UPLOAD ────────────────────────────────────────────────────────────

export async function uploadAvatar(userId: string, uri: string): Promise<string | null> {
  try {
    const rawExt = (uri.split(".").pop()?.split("?")[0] ?? "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
    const mime = safeExt === "png" ? "image/png" : safeExt === "webp" ? "image/webp" : "image/jpeg";
    const path = `${userId}/avatar.${safeExt}`;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, bytes, { contentType: mime, upsert: true });

    if (error) { console.error("uploadAvatar:", error); return null; }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    return publicUrl ? `${publicUrl}?t=${Date.now()}` : null;
  } catch (e) {
    console.error("uploadAvatar:", e);
    return null;
  }
}

// ─── USERNAME AVAILABILITY ───────────────────────────────────────────────────

export async function checkUsernameAvailable(username: string, currentUserId: string): Promise<boolean> {
  try {
    if (!username.trim() || username.length < 3) return false;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.trim().toLowerCase())
      .neq("id", currentUserId)
      .maybeSingle();
    if (error) return true;
    return !data;
  } catch {
    return true;
  }
}

// ─── COMPANY POSTS ────────────────────────────────────────────────────────────

export async function fetchCompanyPosts(companyId: string, currentUserId?: string, activeCompanyId?: string | null): Promise<Post[]> {
  try {
    const { data: pageData } = await supabase
      .from("company_pages")
      .select("owner_id")
      .eq("id", companyId)
      .single();

    if (!pageData?.owner_id) return [];

    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .or(`user_id.eq.${pageData.owner_id},company_page_id.eq.${companyId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) { console.error("fetchCompanyPosts:", error); return []; }

    const posts = (data ?? []) as any[];
    if (posts.length === 0) return [];

    const postUserIds = [...new Set(posts.map((p: any) => p.user_id).filter(Boolean))];
    const postCompanyIds = [...new Set(posts.map((p: any) => p.company_page_id).filter(Boolean))];
    const postIds = posts.map((p: any) => p.id);

    // Check likes using active identity (company or personal)
    const likedQuery = activeCompanyId
      ? supabase.from("likes").select("post_id").eq("company_page_id", activeCompanyId).in("post_id", postIds)
      : currentUserId
        ? supabase.from("likes").select("post_id").eq("user_id", currentUserId).is("company_page_id", null).in("post_id", postIds)
        : Promise.resolve({ data: [] });

    const [profileMap, companyMap, likedRes, bookmarkRes] = await Promise.all([
      fetchProfilesForIds(postUserIds),
      fetchCompanyPagesForIds(postCompanyIds),
      likedQuery,
      currentUserId
        ? supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds)
        : Promise.resolve({ data: [] }),
    ]);

    const likedSet    = new Set(((likedRes as any).data ?? []).map((l: any) => l.post_id));
    const bookmarkSet = new Set(((bookmarkRes as any).data ?? []).map((b: any) => b.post_id));

    return (await attachAuthorsToPosts(posts, profileMap, companyMap)).map((p: any) => ({
      ...p,
      is_liked:     likedSet.has(p.id),
      is_bookmarked: bookmarkSet.has(p.id),
    })) as Post[];
  } catch (e) {
    console.error("fetchCompanyPosts:", e);
    return [];
  }
}

// ─── COMPANY PORTFOLIO ────────────────────────────────────────────────────────

export interface CompanyProduct {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  price: string | null;
  category: string;
  image_url: string | null;
  created_at: string;
}

export async function fetchCompanyProducts(companyId: string): Promise<CompanyProduct[]> {
  try {
    const { data, error } = await supabase
      .from("company_products")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) { console.error("fetchCompanyProducts:", error); return []; }
    return (data ?? []) as CompanyProduct[];
  } catch (e) {
    console.error("fetchCompanyProducts:", e);
    return [];
  }
}

export async function fetchInactiveOpportunities(): Promise<AppOpportunity[]> {
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, created_by, type, title, description, category, location, price, company, contract_type, salary, contact_email, expires_at, is_active, created_at")
      .eq("is_active", false)
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchInactiveOpportunities:", error); return []; }
    if (!data || data.length === 0) return [];
    const inactCreatorIds = [...new Set((data as any[]).map(d => d.created_by).filter(Boolean))];
    const inactCreatorMap = await fetchCommentProfilesForIds(inactCreatorIds);
    return (data as any[]).map(d => ({
      ...d,
      creator: d.created_by ? (inactCreatorMap.get(d.created_by) ?? null) : null,
      is_applied: false,
    })) as unknown as AppOpportunity[];
  } catch (e) {
    console.error("fetchInactiveOpportunities:", e);
    return [];
  }
}

export async function createCompanyProduct(params: {
  company_id: string;
  name: string;
  description?: string | null;
  price?: string | null;
  category: string;
  image_url?: string | null;
}): Promise<CompanyProduct | null> {
  try {
    const { data, error } = await supabase
      .from("company_products")
      .insert(params)
      .select()
      .single();

    if (error) { console.error("createCompanyProduct:", error); return null; }
    return data as CompanyProduct;
  } catch (e) {
    console.error("createCompanyProduct:", e);
    return null;
  }
}

export async function updateCompanyProduct(
  productId: string,
  updates: Partial<Pick<CompanyProduct, "name" | "description" | "price" | "category" | "image_url">>,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("company_products")
      .update(updates)
      .eq("id", productId);
    if (error) { console.error("updateCompanyProduct:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateCompanyProduct:", e);
    return false;
  }
}

export async function fetchApplicationsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("opportunity_applications")
      .select("id", { count: "exact", head: true });
    if (error) { console.error("fetchApplicationsCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchApplicationsCount:", e);
    return 0;
  }
}

export async function fetchAllStoriesAdmin(): Promise<AppStory[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("id, user_id, image_url, text, expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchAllStoriesAdmin:", error); return []; }
    if (!data || data.length === 0) return [];
    const adminUserIds = [...new Set((data as any[]).map(s => s.user_id).filter(Boolean))];
    const adminProfileMap = await fetchProfilesForIds(adminUserIds);
    return (data as any[]).map(s => ({ ...s, author: adminProfileMap.get(s.user_id) ?? null })) as unknown as AppStory[];
  } catch (e) {
    console.error("fetchAllStoriesAdmin:", e);
    return [];
  }
}

export async function deleteStoryAdmin(storyId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("stories").delete().eq("id", storyId);
    if (error) { console.error("deleteStoryAdmin:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteStoryAdmin:", e);
    return false;
  }
}

export async function deleteCompanyProduct(productId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("company_products")
      .delete()
      .eq("id", productId);
    if (error) { console.error("deleteCompanyProduct:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteCompanyProduct:", e);
    return false;
  }
}

export async function uploadProductImage(productId: string, uri: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { console.error("uploadProductImage: no session"); return null; }

    const rawExt = (uri.split(".").pop()?.split("?")[0] ?? "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
    const mime = safeExt === "png" ? "image/png" : safeExt === "webp" ? "image/webp" : "image/jpeg";
    const path = `${userId}/product-images/${productId}.${safeExt}`;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, bytes, { contentType: mime, upsert: true });

    if (error) { console.error("uploadProductImage:", error); return null; }

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadProductImage:", e);
    return null;
  }
}

// ─── COMPANY FOLLOW ───────────────────────────────────────────────────────────

export async function checkIsFollowingCompany(companyId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("company_follows")
      .select("id")
      .match({ company_id: companyId, user_id: userId })
      .maybeSingle();
    return !!data;
  } catch { return false; }
}

export async function toggleCompanyFollow(companyId: string, userId: string, isCurrentlyFollowing: boolean): Promise<boolean> {
  try {
    if (isCurrentlyFollowing) {
      const { error } = await supabase.from("company_follows").delete().match({ company_id: companyId, user_id: userId });
      if (error) { console.error("toggleCompanyFollow (unfollow):", error); return false; }
    } else {
      const { error } = await supabase.from("company_follows").upsert({ company_id: companyId, user_id: userId }, { onConflict: "company_id,user_id" });
      if (error) { console.error("toggleCompanyFollow (follow):", error); return false; }
    }
    return true;
  } catch (e) {
    console.error("toggleCompanyFollow:", e);
    return false;
  }
}

export async function fetchStoryViewsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("story_views")
      .select("id", { count: "exact", head: true });
    if (error) { console.error("fetchStoryViewsCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchStoryViewsCount:", e);
    return 0;
  }
}

export async function fetchStoryLikesCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("story_likes")
      .select("id", { count: "exact", head: true });
    if (error) { console.error("fetchStoryLikesCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchStoryLikesCount:", e);
    return 0;
  }
}

// ─── ENGAGEMENT ───────────────────────────────────────────────────────────────

export async function recordProfileView(viewerId: string, profileId: string): Promise<void> {
  if (viewerId === profileId) return;
  try {
    await supabase.from("profile_views").upsert(
      { viewer_id: viewerId, profile_id: profileId, viewed_at: new Date().toISOString().split("T")[0] },
      { onConflict: "viewer_id,profile_id,viewed_at" }
    );
  } catch (e) {
    console.error("recordProfileView:", e);
  }
}

export async function fetchProfileViewsThisWeek(profileId: string): Promise<number> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { count, error } = await supabase
      .from("profile_views")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .gte("viewed_at", since.toISOString().split("T")[0]);
    if (error) { console.error("fetchProfileViewsThisWeek:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchProfileViewsThisWeek:", e);
    return 0;
  }
}

export interface LeaderboardEntry {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  followers_count: number;
  connections_count: number;
  plan: string;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company, location, followers_count, connections_count, plan")
      .eq("profile_type", "pessoa")
      .order("followers_count", { ascending: false })
      .limit(20);
    if (error) { console.error("fetchLeaderboard:", error); return []; }
    return (data ?? []).map((p: any) => ({
      ...p,
      headline: [p.position, p.company].filter(Boolean).join(" · ") || null,
    })) as LeaderboardEntry[];
  } catch (e) {
    console.error("fetchLeaderboard:", e);
    return [];
  }
}

export async function fetchMutualConnections(
  userId1: string,
  userId2: string
): Promise<{ id: string; full_name: string; avatar_url: string | null }[]> {
  try {
    const [res1, res2] = await Promise.all([
      supabase.from("connections").select("requester_id,receiver_id").or(`requester_id.eq.${userId1},receiver_id.eq.${userId1}`).eq("status", "connected"),
      supabase.from("connections").select("requester_id,receiver_id").or(`requester_id.eq.${userId2},receiver_id.eq.${userId2}`).eq("status", "connected"),
    ]);
    const ids1 = new Set<string>();
    for (const c of res1.data ?? []) {
      if (c.requester_id !== userId1) ids1.add(c.requester_id);
      if (c.receiver_id  !== userId1) ids1.add(c.receiver_id);
    }
    const mutualIds: string[] = [];
    for (const c of res2.data ?? []) {
      const other = c.requester_id !== userId2 ? c.requester_id : c.receiver_id;
      if (ids1.has(other) && other !== userId1 && other !== userId2) mutualIds.push(other);
    }
    if (mutualIds.length === 0) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", mutualIds.slice(0, 5));
    if (error) return [];
    return (data ?? []) as { id: string; full_name: string; avatar_url: string | null }[];
  } catch (e) {
    console.error("fetchMutualConnections:", e);
    return [];
  }
}

function deriveReferralCode(userId: string): string {
  const stripped = userId.replace(/-/g, "").toUpperCase();
  return "IB" + stripped.substring(0, 8);
}

export async function ensureReferralCode(userId: string): Promise<string> {
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .single();
    if (existing?.referral_code) return existing.referral_code;
    const code = deriveReferralCode(userId);
    await supabase.from("profiles").update({ referral_code: code }).eq("id", userId);
    return code;
  } catch (e) {
    console.error("ensureReferralCode:", e);
    return "";
  }
}

// ── Referral tracking ──────────────────────────────────────────────────────────

/**
 * Links a new user to whoever shared the invite code.
 * Sets `invited_by_id` on the new user's profile.
 * Safe to call even if the code is invalid (fails silently).
 */
export async function applyReferralCode(newUserId: string, code: string): Promise<boolean> {
  if (!code?.trim()) return false;
  try {
    // Find the inviter by their referral code
    const { data: inviter } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", code.trim().toUpperCase())
      .maybeSingle();

    if (!inviter?.id || inviter.id === newUserId) return false;

    // Set invited_by_id on the new user profile
    const { error } = await supabase
      .from("profiles")
      .update({ invited_by_id: inviter.id })
      .eq("id", newUserId);

    if (error) { console.error("applyReferralCode:", error); return false; }
    return true;
  } catch (e) {
    console.error("applyReferralCode:", e);
    return false;
  }
}

export interface ReferralRankEntry {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  invite_count: number;
  rank: number;
}

/**
 * Returns top inviters sorted by number of people they invited.
 * Uses `invited_by_id` column on profiles.
 */
export async function fetchReferralLeaderboard(limit = 50): Promise<ReferralRankEntry[]> {
  try {
    // Fetch all profiles that were invited by someone
    const { data, error } = await supabase
      .from("profiles")
      .select("invited_by_id")
      .not("invited_by_id", "is", null);

    if (error) { console.error("fetchReferralLeaderboard:", error); return []; }

    // Count invites per inviter
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.invited_by_id) counts[row.invited_by_id] = (counts[row.invited_by_id] ?? 0) + 1;
    }

    const topIds = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => id);

    if (topIds.length === 0) return [];

    // Fetch inviter profiles
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, headline")
      .in("id", topIds);

    if (pErr) { console.error("fetchReferralLeaderboard profiles:", pErr); return []; }

    return (profiles ?? [])
      .map((p, _) => ({
        id: p.id,
        full_name: p.full_name ?? "Usuário",
        username: p.username ?? null,
        avatar_url: p.avatar_url ?? null,
        headline: p.headline ?? null,
        invite_count: counts[p.id] ?? 0,
        rank: 0,
      }))
      .sort((a, b) => b.invite_count - a.invite_count)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));
  } catch (e) {
    console.error("fetchReferralLeaderboard:", e);
    return [];
  }
}

/**
 * Returns the number of people a user has invited and their rank.
 */
export async function fetchMyReferralStats(userId: string): Promise<{ count: number; rank: number }> {
  try {
    const leaderboard = await fetchReferralLeaderboard(200);
    const me = leaderboard.find(e => e.id === userId);
    if (!me) {
      // Count directly in case they're not in top 200
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("invited_by_id", userId);
      return { count: count ?? 0, rank: leaderboard.length + 1 };
    }
    return { count: me.invite_count, rank: me.rank };
  } catch (e) {
    console.error("fetchMyReferralStats:", e);
    return { count: 0, rank: 0 };
  }
}

// ─── COMPANY ADMIN DASHBOARD ──────────────────────────────────────────────────

export interface CompanyAdminOpportunity extends AppOpportunity {
  view_count: number;
  sold: boolean;
  sold_via_ibhub: boolean;
  company_page_id: string | null;
}

export interface CompanyAdminApplicant {
  id: string;
  applicant_id: string;
  cv_url: string | null;
  message: string | null;
  status: "pending" | "reviewed" | "shortlisted" | "hired" | "rejected";
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  username: string | null;
}

export interface CompanyAdminEvent extends AppEvent {
  company_page_id: string | null;
}

/** All vagas/anúncios linked to a company page (or created by the owner). */
export async function fetchCompanyOpportunities(
  companyPageId: string,
  ownerId: string,
  type: "vaga" | "marketplace",
): Promise<CompanyAdminOpportunity[]> {
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        id, created_by, type, title, description, category, location, price,
        cover_image_url, company, contract_type, salary, contact_email,
        expires_at, is_active, created_at,
        interests_count, applications_count,
        view_count, sold, sold_via_ibhub, company_page_id
      `)
      .eq("type", type)
      .or(`company_page_id.eq.${companyPageId},created_by.eq.${ownerId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("fetchCompanyOpportunities:", error); return []; }
    return (data ?? []) as CompanyAdminOpportunity[];
  } catch (e) {
    console.error("fetchCompanyOpportunities:", e);
    return [];
  }
}

/** All events linked to a company page (or created by the owner). */
export async function fetchCompanyEvents(
  companyPageId: string,
  ownerId: string,
): Promise<CompanyAdminEvent[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, user_id, title, description, start_date, end_date,
        location_type, location, entry_type, capacity, visibility,
        is_active, pay_link, created_at, attendees_count, company_page_id
      `)
      .or(`company_page_id.eq.${companyPageId},user_id.eq.${ownerId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("fetchCompanyEvents:", error); return []; }
    return (data ?? []) as CompanyAdminEvent[];
  } catch (e) {
    console.error("fetchCompanyEvents:", e);
    return [];
  }
}

/** Applicants for a job opportunity, with profile data. */
export async function fetchOpportunityApplicants(
  opportunityId: string,
): Promise<CompanyAdminApplicant[]> {
  try {
    const { data, error } = await supabase.rpc("get_opportunity_applicants", {
      p_opportunity_id: opportunityId,
    });
    if (error) {
      // Fallback: join manually if RPC not yet applied
      const { data: raw } = await supabase
        .from("opportunity_applications")
        .select("id, applicant_id, cv_url, message, status, created_at")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false });
      if (!raw) return [];
      const ids = raw.map((r: any) => r.applicant_id).filter(Boolean);
      const profileMap = await fetchCommentProfilesForIds(ids);
      return raw.map((r: any) => ({
        ...r,
        status: r.status ?? "pending",
        full_name: profileMap.get(r.applicant_id)?.full_name ?? null,
        avatar_url: profileMap.get(r.applicant_id)?.avatar_url ?? null,
        headline: profileMap.get(r.applicant_id)?.headline ?? null,
        username: profileMap.get(r.applicant_id)?.username ?? null,
      })) as CompanyAdminApplicant[];
    }
    return (data ?? []).map((r: any) => ({
      ...r,
      status: r.status ?? "pending",
    })) as CompanyAdminApplicant[];
  } catch (e) {
    console.error("fetchOpportunityApplicants:", e);
    return [];
  }
}

/** Increment view count for an opportunity. */
export async function trackOpportunityView(opportunityId: string): Promise<void> {
  try {
    await supabase.rpc("increment_opportunity_views", { p_opportunity_id: opportunityId });
  } catch (e) {
    console.error("trackOpportunityView:", e);
  }
}

/** Toggle sold status for a marketplace item. */
export async function markOpportunitySold(
  opportunityId: string,
  sold: boolean,
  soldViaIbhub: boolean,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("opportunities")
      .update({ sold, sold_via_ibhub: soldViaIbhub })
      .eq("id", opportunityId);
    if (error) { console.error("markOpportunitySold:", error); return false; }
    return true;
  } catch (e) {
    console.error("markOpportunitySold:", e);
    return false;
  }
}

/** Update application status (pending → reviewed → shortlisted → hired / rejected). */
export async function updateApplicationStatus(
  applicationId: string,
  status: CompanyAdminApplicant["status"],
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("opportunity_applications")
      .update({ status })
      .eq("id", applicationId);
    if (error) { console.error("updateApplicationStatus:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateApplicationStatus:", e);
    return false;
  }
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  owner_id: string;
  name: string;
  description?: string | null;
  category: string;
  access: "aberto" | "fechado" | "restrito";
  avatar_url?: string | null;
  created_at: string;
  member_count?: number;
  is_member?: boolean;
  is_owner?: boolean;
}

export async function fetchGroups(userId: string): Promise<{ mine: Group[]; explore: Group[] }> {
  try {
    const [groupsRes, membershipsRes] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id, role").eq("user_id", userId),
    ]);
    if (groupsRes.error) throw groupsRes.error;
    const membershipMap = new Map<string, string>(
      (membershipsRes.data ?? []).map((m: any) => [m.group_id, m.role])
    );
    const groups = (groupsRes.data ?? []) as any[];
    const countResults = await Promise.all(
      groups.map(g =>
        supabase.from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", g.id)
      )
    );
    const enriched: Group[] = groups.map((g, i) => ({
      ...g,
      member_count: countResults[i].count ?? 0,
      is_member: membershipMap.has(g.id),
      is_owner: g.owner_id === userId,
    }));
    return { mine: enriched.filter(g => g.is_member), explore: enriched.filter(g => !g.is_member) };
  } catch (e) {
    console.warn("fetchGroups:", e);
    return { mine: [], explore: [] };
  }
}

export async function uploadGroupAvatar(imageUri: string, userId: string, groupId: string): Promise<string | null> {
  try {
    const ext = imageUri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const filename = `${userId}/groups/${groupId}.${ext}`;
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(filename, bytes, { contentType: mime, upsert: true });
    if (error) { console.error("uploadGroupAvatar:", error); return null; }
    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(data.path);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadGroupAvatar:", e);
    return null;
  }
}

export async function createGroup(params: {
  owner_id: string;
  name: string;
  description?: string;
  category: string;
  access: "aberto" | "fechado" | "restrito";
  avatar_url?: string | null;
}): Promise<Group | null> {
  try {
    const { data, error } = await supabase.from("groups").insert(params).select().single();
    if (error) { console.error("createGroup:", error); return null; }
    const group = data as Group;
    // Create a linked conversation so group-chat works (same UUID)
    const { error: convErr } = await supabase.from("conversations").insert({
      id: group.id,
      is_group: true,
      name: group.name,
      created_at: group.created_at,
    });
    if (convErr) {
      console.error("createGroup: conversation insert failed:", convErr);
      // Clean up — delete the group since the conversation didn't get created
      await supabase.from("groups").delete().eq("id", group.id);
      return null;
    }
    const { error: partErr } = await supabase.from("conversation_participants").insert({
      conversation_id: group.id,
      user_id: group.owner_id,
    });
    if (partErr) {
      console.warn("createGroup: participant insert failed (non-fatal):", partErr);
    }
    return group;
  } catch (e) {
    console.error("createGroup:", e);
    return null;
  }
}

export async function deleteGroupMessages(groupId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("messages").delete().eq("conversation_id", groupId);
    return !error;
  } catch { return false; }
}

export async function deleteMyGroupMessages(groupId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", groupId)
      .eq("sender_id", userId);
    return !error;
  } catch { return false; }
}

export async function clearGroupHistoryForUser(groupId: string, userId: string): Promise<string | null> {
  try {
    const clearedAt = new Date().toISOString();
    const { error } = await supabase
      .from("group_message_clears")
      .upsert({ user_id: userId, conversation_id: groupId, cleared_at: clearedAt }, { onConflict: "user_id,conversation_id" });
    if (error) { console.error("clearGroupHistoryForUser:", error); return null; }
    return clearedAt;
  } catch (e) {
    console.error("clearGroupHistoryForUser:", e);
    return null;
  }
}

export async function fetchGroupHistoryClearedAt(groupId: string, userId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("group_message_clears")
      .select("cleared_at")
      .eq("user_id", userId)
      .eq("conversation_id", groupId)
      .maybeSingle();
    return (data as any)?.cleared_at ?? null;
  } catch { return null; }
}

export async function joinGroup(groupId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId, role: "member" });
    return !error;
  } catch { return false; }
}

export async function leaveGroup(groupId: string, userId: string): Promise<boolean> {
  try {
    const [{ error: gmErr }, { error: cpErr }] = await Promise.all([
      supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId),
      supabase.from("conversation_participants").delete().eq("conversation_id", groupId).eq("user_id", userId),
    ]);
    if (gmErr) console.warn("leaveGroup group_members:", gmErr);
    if (cpErr) console.warn("leaveGroup conversation_participants:", cpErr);
    return !gmErr;
  } catch { return false; }
}

// ─── Ideal.BI Market Feed ──────────────────────────────────────────────────────

export interface MarketPollOption {
  id: string;
  text: string;
  votes_count: number;
}

export interface MarketPost {
  id: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  poll_options?: MarketPollOption[] | null;
  created_at: string;
  author_id: string;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
  user_poll_vote?: string | null;
  author?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    headline?: string | null;
  };
}

export interface MarketComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export async function fetchMarketPosts(userId?: string): Promise<MarketPost[]> {
  try {
    const { data, error } = await supabase
      .from("market_posts")
      .select("id, content, image_url, video_url, poll_options, created_at, author_id, likes_count, comments_count")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error || !data || data.length === 0) return [];

    const authorIds = [...new Set(data.map((p: any) => p.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, avatar_url, headline")
      .in("user_id", authorIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    let likedSet = new Set<string>();
    let pollVoteMap = new Map<string, string>();
    if (userId) {
      const { data: likes } = await supabase
        .from("market_post_likes")
        .select("post_id")
        .eq("user_id", userId);
      likedSet = new Set((likes ?? []).map((l: any) => l.post_id));

      const { data: votes } = await supabase
        .from("market_post_poll_votes")
        .select("post_id, option_id")
        .eq("user_id", userId);
      pollVoteMap = new Map((votes ?? []).map((v: any) => [v.post_id, v.option_id]));
    }

    return data.map((p: any) => ({
      ...p,
      user_liked: likedSet.has(p.id),
      user_poll_vote: pollVoteMap.get(p.id) ?? null,
      author: profileMap.get(p.author_id) ?? null,
    }));
  } catch { return []; }
}

export async function createMarketPost(
  authorId: string,
  content: string,
  imageUrl?: string | null,
  videoUrl?: string | null,
  pollOptions?: MarketPollOption[] | null,
): Promise<MarketPost | null> {
  try {
    const { data, error } = await supabase
      .from("market_posts")
      .insert({
        author_id: authorId,
        content,
        image_url: imageUrl ?? null,
        video_url: videoUrl ?? null,
        poll_options: pollOptions && pollOptions.length > 0 ? pollOptions : null,
        likes_count: 0,
        comments_count: 0,
      })
      .select("id, content, image_url, video_url, poll_options, created_at, author_id, likes_count, comments_count")
      .single();
    if (error || !data) return null;
    return { ...data, user_liked: false, user_poll_vote: null };
  } catch { return null; }
}

export async function voteOnMarketPoll(postId: string, userId: string, optionId: string): Promise<MarketPollOption[] | null> {
  try {
    const { data: existing } = await supabase
      .from("market_post_poll_votes")
      .select("option_id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // decrement old option
      const { data: post } = await supabase.from("market_posts").select("poll_options").eq("id", postId).single();
      if (!post) return null;
      const opts: MarketPollOption[] = post.poll_options ?? [];
      const updated = opts.map((o: MarketPollOption) =>
        o.id === existing.option_id ? { ...o, votes_count: Math.max(0, o.votes_count - 1) } :
        o.id === optionId ? { ...o, votes_count: o.votes_count + 1 } : o
      );
      await supabase.from("market_post_poll_votes").update({ option_id: optionId }).eq("post_id", postId).eq("user_id", userId);
      await supabase.from("market_posts").update({ poll_options: updated }).eq("id", postId);
      return updated;
    } else {
      const { data: post } = await supabase.from("market_posts").select("poll_options").eq("id", postId).single();
      if (!post) return null;
      const opts: MarketPollOption[] = post.poll_options ?? [];
      const updated = opts.map((o: MarketPollOption) => o.id === optionId ? { ...o, votes_count: o.votes_count + 1 } : o);
      await supabase.from("market_post_poll_votes").insert({ post_id: postId, user_id: userId, option_id: optionId });
      await supabase.from("market_posts").update({ poll_options: updated }).eq("id", postId);
      return updated;
    }
  } catch { return null; }
}

export async function uploadMarketPostMediaBase64(
  fileBase64: string,
  fileName: string,
  mimeType: string,
  userId: string,
): Promise<string | null> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL!;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    const res = await fetch(`${apiUrl}/uploads/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileBase64, fileName, mimeType, userId }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.url ?? null;
  } catch { return null; }
}

export async function toggleMarketPostLike(postId: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
  try {
    if (currentlyLiked) {
      await supabase.from("market_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
      const { data: cur } = await supabase.from("market_posts").select("likes_count").eq("id", postId).single();
      await supabase.from("market_posts").update({ likes_count: Math.max(0, (cur?.likes_count ?? 1) - 1) }).eq("id", postId);
    } else {
      await supabase.from("market_post_likes").insert({ post_id: postId, user_id: userId });
      const { data: cur } = await supabase.from("market_posts").select("likes_count").eq("id", postId).single();
      await supabase.from("market_posts").update({ likes_count: (cur?.likes_count ?? 0) + 1 }).eq("id", postId);
    }
    return !currentlyLiked;
  } catch { return currentlyLiked; }
}

export async function fetchMarketComments(postId: string): Promise<MarketComment[]> {
  try {
    const { data, error } = await supabase
      .from("market_post_comments")
      .select("id, post_id, author_id, content, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];

    const authorIds = [...new Set(data.map((c: any) => c.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, avatar_url")
      .in("user_id", authorIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    return data.map((c: any) => ({ ...c, author: profileMap.get(c.author_id) ?? null }));
  } catch { return []; }
}

export async function addMarketComment(postId: string, authorId: string, content: string): Promise<MarketComment | null> {
  try {
    const { data, error } = await supabase
      .from("market_post_comments")
      .insert({ post_id: postId, author_id: authorId, content })
      .select("id, post_id, author_id, content, created_at")
      .single();
    if (error || !data) return null;
    const { data: cur } = await supabase.from("market_posts").select("comments_count").eq("id", postId).single();
    await supabase.from("market_posts").update({ comments_count: (cur?.comments_count ?? 0) + 1 }).eq("id", postId);
    return data;
  } catch { return null; }
}
