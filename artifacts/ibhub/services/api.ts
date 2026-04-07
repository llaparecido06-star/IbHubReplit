import { supabase } from "@/context/AuthContext";
import { Post } from "@/components/feed/PostCard";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: string;
  post_id?: string | null;
  comment_id?: string | null;
  message?: string | null;
  read: boolean;
  created_at: string;
  actor?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

export interface AppComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
  author?: { id: string; full_name: string; avatar_url?: string | null; headline?: string | null } | null;
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
  viewed?: boolean;
}

export interface StoryGroup {
  userId: string;
  author: { id: string; full_name: string; avatar_url?: string | null };
  stories: AppStory[];
  hasUnseen: boolean;
}

export interface AppMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  message_type?: "text" | "image" | "video" | "audio" | "file";
  media_url?: string | null;
}

export interface AppConversation {
  id: string;
  is_group: boolean;
  name?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  participant?: { id: string; full_name: string; avatar_url?: string | null } | null;
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

export async function fetchFeedPosts(currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id, user_id, content, image_url, likes_count, comments_count, shares_count,
        hashtags, poll, created_at,
        author:profiles!posts_user_id_fkey(${AUTHOR_SELECT})
      `)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) return [];

    const postIds = data.map((p: any) => p.id);

    const [likedRes, bookmarkRes] = await Promise.all([
      supabase.from("likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);

    const likedIds = new Set((likedRes.data ?? []).map((l: any) => l.post_id));
    const bookmarkedIds = new Set((bookmarkRes.data ?? []).map((b: any) => b.post_id));

    return data.map((post: any) => ({
      ...post,
      author: normaliseAuthor(post.author),
      is_liked: likedIds.has(post.id),
      is_bookmarked: bookmarkedIds.has(post.id),
    }));
  } catch (e) {
    console.error("fetchFeedPosts:", e);
    return [];
  }
}

export async function uploadPostImage(imageUri: string, userId: string): Promise<string | null> {
  try {
    const ext = imageUri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
    const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    const filename = `${userId}/${Date.now()}.${ext}`;

    const response = await fetch(imageUri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(filename, blob, { contentType: mime, upsert: false });

    if (error) { console.error("uploadPostImage storage error:", error); return null; }

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(data.path);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadPostImage:", e);
    return null;
  }
}

export async function createPost(params: {
  user_id: string;
  content: string;
  image_url?: string | null;
  poll?: { options: { text: string; votes: number }[]; total_votes: number; closed: boolean };
  hashtags?: string[];
}): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .insert({ ...params, likes_count: 0, comments_count: 0, shares_count: 0 })
      .select(`
        id, user_id, content, image_url, likes_count, comments_count, shares_count,
        hashtags, poll, created_at,
        author:profiles!posts_user_id_fkey(${AUTHOR_SELECT})
      `)
      .single();

    if (error) { console.error("createPost:", error); return null; }
    return { ...data, author: normaliseAuthor((data as any).author), is_liked: false, is_bookmarked: false } as Post;
  } catch (e) {
    console.error("createPost:", e);
    return null;
  }
}

export async function fetchPostById(postId: string, currentUserId?: string): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id, user_id, content, image_url, likes_count, comments_count, shares_count,
        hashtags, poll, created_at,
        author:profiles!posts_user_id_fkey(${AUTHOR_SELECT})
      `)
      .eq("id", postId)
      .single();

    if (error || !data) return null;
    const post = { ...data, author: normaliseAuthor((data as any).author) } as any;

    if (currentUserId) {
      const [l, b] = await Promise.all([
        supabase.from("likes").select("id").match({ post_id: postId, user_id: currentUserId }).maybeSingle(),
        supabase.from("bookmarks").select("id").match({ post_id: postId, user_id: currentUserId }).maybeSingle(),
      ]);
      return { ...post, is_liked: !!l.data, is_bookmarked: !!b.data } as Post;
    }
    return post as Post;
  } catch (e) {
    console.error("fetchPostById:", e);
    return null;
  }
}

export async function toggleLike(postId: string, userId: string, isCurrentlyLiked: boolean): Promise<void> {
  try {
    if (isCurrentlyLiked) {
      await supabase.from("likes").delete().match({ post_id: postId, user_id: userId });
    } else {
      await supabase.from("likes").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id" });
    }
  } catch (e) {
    console.error("toggleLike:", e);
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
    console.error("toggleBookmark:", e);
  }
}

// ─── COMMENTS ────────────────────────────────────────────────────────────────

export async function fetchComments(postId: string): Promise<AppComment[]> {
  try {
    const { data, error } = await supabase
      .from("comments")
      .select(`
        id, post_id, user_id, content, created_at,
        author:profiles!comments_user_id_fkey(${COMMENT_AUTHOR_SELECT})
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return (data as any[]).map(c => ({ ...c, author: normaliseAuthor(c.author) })) as AppComment[];
  } catch (e) {
    console.error("fetchComments:", e);
    return [];
  }
}

export async function addComment(
  postId: string,
  userId: string,
  content: string,
): Promise<AppComment | null> {
  try {
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: userId, content })
      .select(`
        id, post_id, user_id, content, created_at,
        author:profiles!comments_user_id_fkey(${COMMENT_AUTHOR_SELECT})
      `)
      .single();

    if (error) { console.error("addComment:", error); return null; }

    // Create notification for post author
    const { data: post } = await supabase.from("posts").select("user_id").eq("id", postId).single();
    if (post && post.user_id !== userId) {
      await supabase.from("notifications").insert({
        user_id: post.user_id, actor_id: userId, type: "comment", post_id: postId,
        message: "comentou na sua publicação",
      });
    }

    return { ...(data as any), author: normaliseAuthor((data as any)?.author) } as AppComment;
  } catch (e) {
    console.error("addComment:", e);
    return null;
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

    // 2. Fetch candidate profiles — use real column names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, username, avatar_url, position, company, plan, areas")
      .limit(80);

    if (!profiles) return [];

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
        } as SuggestedProfile;
      })
      .sort((a, b) => {
        if (b.match_score !== a.match_score) return b.match_score - a.match_score;
        const planOrder: Record<string, number> = { exclusive: 3, business: 2, premium: 1, basico: 0, gratuito: 0 };
        return (planOrder[b.plan] ?? 0) - (planOrder[a.plan] ?? 0);
      });

    return scored.slice(0, limit);
  } catch (e) {
    console.error("fetchSuggestedConnections:", e);
    return [];
  }
}

// ─── USER POSTS ──────────────────────────────────────────────────────────────

export async function fetchUserPosts(targetUserId: string, currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id, user_id, content, image_url, likes_count, comments_count, shares_count,
        hashtags, poll, created_at,
        author:profiles!posts_user_id_fkey(${AUTHOR_SELECT})
      `)
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return [];

    const postIds = data.map((p: any) => p.id);
    const [likedRes, bookmarkRes] = await Promise.all([
      supabase.from("likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);
    const likedIds = new Set((likedRes.data ?? []).map((l: any) => l.post_id));
    const bookmarkedIds = new Set((bookmarkRes.data ?? []).map((b: any) => b.post_id));

    return data.map((post: any) => ({
      ...post,
      author: normaliseAuthor(post.author),
      is_liked: likedIds.has(post.id),
      is_bookmarked: bookmarkedIds.has(post.id),
    }));
  } catch (e) {
    console.error("fetchUserPosts:", e);
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
      .select("follower:profiles!follows_follower_id_fkey(id, full_name, username, avatar_url, position, company)")
      .eq("following_id", userId)
      .limit(100);
    if (error || !data) return [];
    return data.map((r: any) => r.follower).filter(Boolean) as FollowProfile[];
  } catch (e) {
    console.error("fetchFollowers:", e);
    return [];
  }
}

export async function fetchFollowing(userId: string): Promise<FollowProfile[]> {
  try {
    const { data, error } = await supabase
      .from("follows")
      .select("following:profiles!follows_following_id_fkey(id, full_name, username, avatar_url, position, company)")
      .eq("follower_id", userId)
      .limit(100);
    if (error || !data) return [];
    return data.map((r: any) => r.following).filter(Boolean) as FollowProfile[];
  } catch (e) {
    console.error("fetchFollowing:", e);
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
    console.error("fetchConnectionSuggestions:", e);
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
    console.error("toggleFollow:", e);
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

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id, user_id, actor_id, type, post_id, comment_id, message, read, created_at,
        actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data as unknown as AppNotification[];
  } catch (e) {
    console.error("fetchNotifications:", e);
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

export async function fetchPublicProfile(userId: string) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();
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
      .select(`
        id, user_id, content, image_url, likes_count, comments_count, shares_count,
        hashtags, poll, created_at,
        author:profiles!posts_user_id_fkey(${AUTHOR_SELECT})
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return [];

    const postIds = data.map((p: any) => p.id);
    const [likedRes, bookmarkRes] = await Promise.all([
      supabase.from("likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);
    const likedIds = new Set((likedRes.data ?? []).map((l: any) => l.post_id));
    const bookmarkedIds = new Set((bookmarkRes.data ?? []).map((b: any) => b.post_id));
    return data.map((post: any) => ({
      ...post,
      author: normaliseAuthor(post.author),
      is_liked: likedIds.has(post.id),
      is_bookmarked: bookmarkedIds.has(post.id),
    }));
  } catch (e) {
    console.error("fetchProfilePosts:", e);
    return [];
  }
}

// ─── STORIES ─────────────────────────────────────────────────────────────────

export async function fetchActiveStories(): Promise<AppStory[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select(`
        id, user_id, image_url, text, tagged_users, created_at, expires_at,
        author:profiles!stories_user_id_fkey(id, full_name, avatar_url)
      `)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as unknown as AppStory[];
  } catch (e) {
    console.error("fetchActiveStories:", e);
    return [];
  }
}

export async function fetchActiveStoriesForUser(currentUserId: string): Promise<StoryGroup[]> {
  try {
    const { data: stories, error } = await supabase
      .from("stories")
      .select(`
        id, user_id, image_url, text, tagged_users, created_at, expires_at,
        author:profiles!stories_user_id_fkey(id, full_name, avatar_url)
      `)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (error || !stories) return [];

    const { data: views } = await supabase
      .from("story_views")
      .select("story_id")
      .eq("user_id", currentUserId);

    const viewedIds = new Set((views ?? []).map((v: { story_id: string }) => v.story_id));

    const storiesWithViewed = (stories as unknown as AppStory[]).map(s => ({
      ...s,
      viewed: viewedIds.has(s.id),
    }));

    const groupMap = new Map<string, StoryGroup>();
    for (const story of storiesWithViewed) {
      const uid = story.user_id;
      if (!groupMap.has(uid)) {
        groupMap.set(uid, {
          userId: uid,
          author: story.author ?? { id: uid, full_name: "Usuário", avatar_url: null },
          stories: [],
          hasUnseen: false,
        });
      }
      const group = groupMap.get(uid)!;
      group.stories.push(story);
      if (!story.viewed) group.hasUnseen = true;
    }

    const ownGroup = groupMap.get(currentUserId);
    const otherGroups = [...groupMap.values()].filter(g => g.userId !== currentUserId);
    const result: StoryGroup[] = [];
    if (ownGroup) result.push(ownGroup);
    result.push(...otherGroups.sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0)));
    return result;
  } catch (e) {
    console.error("fetchActiveStoriesForUser:", e);
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
    console.error("markStoryViewed:", e);
  }
}

export async function fetchStoryViewers(storyId: string): Promise<{ id: string; full_name: string; avatar_url?: string | null }[]> {
  try {
    const { data, error } = await supabase
      .from("story_views")
      .select("user_id, viewer:profiles!story_views_user_id_fkey(id, full_name, avatar_url)")
      .eq("story_id", storyId);

    if (error || !data) return [];
    type StoryViewRow = { viewer: { id: string; full_name: string; avatar_url?: string | null } | null };
    return (data as unknown as StoryViewRow[])
      .map(d => d.viewer)
      .filter((v): v is { id: string; full_name: string; avatar_url?: string | null } => v !== null);
  } catch (e) {
    console.error("fetchStoryViewers:", e);
    return [];
  }
}

export async function uploadStoryImage(userId: string, uri: string): Promise<string | null> {
  try {
    const ext = uri.split(".").pop()?.split("?")[0] ?? "jpg";
    const fileName = `${userId}/${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from("stories")
      .upload(fileName, blob, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: true });

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
  options: { text?: string; imageUri?: string; taggedUsers?: string[] }
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
    const { data, error } = await supabase
      .from("stories")
      .insert({
        user_id: userId,
        text: options.text ?? null,
        image_url: imageUrl,
        tagged_users: options.taggedUsers ?? [],
        expires_at: expiresAt,
      })
      .select(`
        id, user_id, image_url, text, tagged_users, created_at, expires_at,
        author:profiles!stories_user_id_fkey(id, full_name, avatar_url)
      `)
      .single();

    if (error) { console.error("createStory:", error); return null; }
    return data as unknown as AppStory;
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
    console.error("voteOnPoll:", e);
  }
}

// ─── COMMENT LIKES ───────────────────────────────────────────────────────────

export async function toggleCommentLike(commentId: string, userId: string): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from("comment_likes")
      .select("id")
      .match({ comment_id: commentId, user_id: userId })
      .maybeSingle();

    if (existing) {
      await supabase.from("comment_likes").delete().match({ comment_id: commentId, user_id: userId });
      return false; // now unliked
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
      return true; // now liked
    }
  } catch (e) {
    console.error("toggleCommentLike:", e);
    return false;
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
        .select("user1_id, user2_id")
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId),
    ]);

    const connectedIds = (connRes.data ?? []).map((c: any) =>
      c.user1_id === currentUserId ? c.user2_id : c.user1_id,
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

export async function fetchMessages(conversationId: string): Promise<AppMessage[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at, message_type, media_url")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as AppMessage[];
  } catch (e) {
    console.error("fetchMessages:", e);
    return [];
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<AppMessage | null> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: senderId, content })
      .select()
      .single();

    if (error) { console.error("sendMessage:", error); return null; }
    return data as AppMessage;
  } catch (e) {
    console.error("sendMessage:", e);
    return null;
  }
}

export async function fetchConversations(userId: string): Promise<AppConversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversation_participants")
      .select(`
        conversation_id,
        accepted,
        conversation:conversations(id, is_group, name, created_at)
      `)
      .eq("user_id", userId);

    if (error || !data) return [];

    const results: AppConversation[] = [];
    for (const row of data as any[]) {
      const convo = row.conversation;
      if (!convo) continue;

      const [othersRes, lastMsgRes, unreadRes] = await Promise.all([
        supabase
          .from("conversation_participants")
          .select("user_id, profile:profiles!conversation_participants_user_id_fkey(id, full_name, avatar_url)")
          .eq("conversation_id", convo.id)
          .neq("user_id", userId)
          .limit(1),
        supabase
          .from("messages")
          .select("content, created_at, message_type")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convo.id)
          .neq("sender_id", userId),
      ]);

      const other = othersRes.data?.[0];
      const lastMsg = lastMsgRes.data;
      const lastContent =
        lastMsg?.message_type === "image" ? "📷 Foto"
        : lastMsg?.message_type === "video" ? "🎬 Vídeo"
        : lastMsg?.message_type === "audio" ? "🎤 Áudio"
        : lastMsg?.message_type === "file"  ? "📎 Arquivo"
        : (lastMsg?.content ?? null);

      results.push({
        id: convo.id,
        is_group: convo.is_group,
        name: convo.name,
        last_message: lastContent,
        last_message_at: lastMsg?.created_at ?? convo.created_at,
        unread_count: unreadRes.count ?? 0,
        participant: other ? (other as any).profile : null,
        accepted: row.accepted ?? true,
      });
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
    const { data } = await supabase
      .from("conversation_participants")
      .select("user_id, profile:profiles!conversation_participants_user_id_fkey(id, full_name, avatar_url)")
      .eq("conversation_id", conversationId)
      .neq("user_id", currentUserId)
      .limit(1);
    if (!data || data.length === 0) return null;
    return (data[0] as any).profile ?? null;
  } catch { return null; }
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
      .select(`
        id, post_id, reported_by, reason, status, created_at,
        reporter:profiles!reports_reported_by_fkey(id, full_name, avatar_url),
        post:posts!reports_post_id_fkey(id, content, user_id)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as unknown as AppReport[];
  } catch (e) {
    console.error("fetchPendingReports:", e);
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

export async function getOrCreateDirectConversation(userId1: string, userId2: string): Promise<string | null> {
  try {
    // Find existing conversation between these two users
    const { data: myConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId1);

    if (myConvos && myConvos.length > 0) {
      const myConvoIds = myConvos.map((c: any) => c.conversation_id);
      const { data: shared } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId2)
        .in("conversation_id", myConvoIds);

      if (shared && shared.length > 0) {
        return shared[0].conversation_id;
      }
    }

    // Check if recipient (userId2) should receive this as a request:
    // i.e., userId1 is NOT connected AND NOT followed BY userId2
    const [connCheck, followCheck] = await Promise.all([
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .or(
          `and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`,
        ),
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", userId2)
        .eq("following_id", userId1),
    ]);
    const isKnown = (connCheck.count ?? 0) > 0 || (followCheck.count ?? 0) > 0;

    // Create new conversation
    const { data: convo } = await supabase
      .from("conversations")
      .insert({ is_group: false })
      .select()
      .single();
    if (!convo) return null;

    await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: userId1, accepted: true },
      { conversation_id: convo.id, user_id: userId2, accepted: isKnown },
    ]);

    return convo.id;
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
    const ext  = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const path = `chat/${conversationId}/${Date.now()}.${ext}`;
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const { error } = await supabase.storage.from("post-images").upload(path, blob, { contentType: mimeType, upsert: false });
    if (error) { console.error("uploadChatMedia:", error); return null; }
    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    return data.publicUrl;
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

export async function fetchUserCompanyPages(userId: string): Promise<CompanyPage[]> {
  try {
    const { data, error } = await supabase
      .from("company_pages")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });

    if (error) { console.error("fetchUserCompanyPages:", error); return []; }
    return (data ?? []) as CompanyPage[];
  } catch (e) {
    console.error("fetchUserCompanyPages:", e);
    return [];
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
      .select(`
        company_id, user_id, role, added_at,
        profile:profiles!company_page_admins_user_id_fkey(id, full_name, avatar_url, position, company)
      `)
      .eq("company_id", companyId)
      .order("added_at", { ascending: true });
    if (error || !data) return [];
    return (data as any[]).map(row => ({
      ...row,
      profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
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
    const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `company-logos/${companyId}.${ext}`;

    const resp = await fetch(uri);
    const blob = await resp.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, uint8, { contentType: `image/${ext}`, upsert: true });

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
  qty: number;
  price?: number | null;
  buy_date?: string | null;
  drink_by?: string | null;
  storage?: string | null;
  notes?: string | null;
  rating: number;
  status: "adega" | "consumido" | "presenteado" | "wishlist";
  is_private: boolean;
  created_at: string;
  updated_at: string;
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

// ─── MARKET OVERVIEW ─────────────────────────────────────────────────────────

export interface MarketKPI {
  label: string;
  value: string;
  period: string;
  change: number;
  icon: string;
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
  company?: string | null;
  contract_type?: string | null;
  salary?: string | null;
  contact_email?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
  creator?: { id: string; full_name: string | null; avatar_url?: string | null; position?: string | null; company?: string | null } | null;
  is_applied?: boolean;
  is_interested?: boolean;
  applications_count?: number;
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
        id, created_by, type, title, description, category, location, price,
        company, contract_type, salary, contact_email, expires_at, is_active, created_at,
        creator:profiles!opportunities_created_by_fkey(id, full_name, avatar_url, position, company)
      `)
      .eq("is_active", true)
      .eq("type", type)
      .order("created_at", { ascending: false });

    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,company.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(50);
    if (error || !data) return [];

    // Check which ones the user already applied to (vagas only)
    let appliedIds = new Set<string>();
    if (type === "vaga" && data.length > 0) {
      const ids = (data as any[]).map((d) => d.id);
      const { data: apps } = await supabase
        .from("opportunity_applications")
        .select("opportunity_id")
        .eq("applicant_id", userId)
        .in("opportunity_id", ids);
      if (apps) apps.forEach((a: any) => appliedIds.add(a.opportunity_id));
    }

    return (data as any[]).map((d) => ({
      ...d,
      creator: d.creator ?? null,
      is_applied: appliedIds.has(d.id),
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
      .select(`
        id, created_by, type, title, description, category, location, price,
        company, contract_type, salary, contact_email, expires_at, is_active, created_at,
        creator:profiles!opportunities_created_by_fkey(id, full_name, avatar_url, position, company)
      `)
      .eq("id", id)
      .single();

    if (error || !data) return null;

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
    const blob = await response.blob();

    const { error } = await supabase.storage.from("cvs").upload(path, blob, {
      contentType: blob.type || "application/pdf",
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
      .select(`
        id, opportunity_id, applicant_id, cv_url, message, created_at,
        applicant:profiles!opportunity_applications_applicant_id_fkey(id, full_name, avatar_url, username, position, company),
        opportunity:opportunities!opportunity_applications_opportunity_id_fkey(id, title, type)
      `)
      .in("opportunity_id", opIds)
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchApplicationsForMyOpportunities:", error); return []; }
    return (data ?? []) as any[];
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
  attendees_count?: number;
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

export async function fetchEvents(search = ""): Promise<AppEvent[]> {
  try {
    let q = supabase
      .from("events")
      .select(`
        id, user_id, title, description, start_date, end_date,
        location_type, location, entry_type, capacity, visibility, is_active, pay_link, created_at,
        organizer:profiles!events_user_id_fkey(id, full_name, avatar_url, username)
      `)
      .eq("is_active", true)
      .order("start_date", { ascending: true });
    if (search) q = q.ilike("title", `%${search}%`);
    const { data, error } = await q;
    if (error) { console.error("fetchEvents:", error); return []; }
    return (data ?? []) as any[];
  } catch (e) {
    console.error("fetchEvents:", e);
    return [];
  }
}

export async function fetchEventById(id: string): Promise<AppEvent | null> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, user_id, title, description, start_date, end_date,
        location_type, location, entry_type, capacity, visibility, is_active, pay_link, created_at,
        organizer:profiles!events_user_id_fkey(id, full_name, avatar_url, username)
      `)
      .eq("id", id)
      .single();
    if (error) { console.error("fetchEventById:", error); return null; }
    return data as any;
  } catch (e) {
    console.error("fetchEventById:", e);
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
      .select(`
        id, event_id, user_id, status, created_at,
        profile:profiles!event_attendees_user_id_fkey(id, full_name, avatar_url, username, position)
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error) { console.error("fetchEventAttendees:", error); return []; }
    return (data ?? []) as any[];
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
