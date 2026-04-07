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
  created_at: string;
  expires_at: string;
  author?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

export interface AppMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface AppConversation {
  id: string;
  is_group: boolean;
  name?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  participant?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

// ─── POSTS ───────────────────────────────────────────────────────────────────

export async function fetchFeedPosts(currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id, user_id, content, image_url, likes_count, comments_count, shares_count,
        hashtags, poll, created_at,
        author:profiles!posts_user_id_fkey(id, full_name, username, avatar_url, headline, plan)
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
      is_liked: likedIds.has(post.id),
      is_bookmarked: bookmarkedIds.has(post.id),
    }));
  } catch (e) {
    console.error("fetchFeedPosts:", e);
    return [];
  }
}

export async function createPost(params: {
  user_id: string;
  content: string;
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
        author:profiles!posts_user_id_fkey(id, full_name, username, avatar_url, headline, plan)
      `)
      .single();

    if (error) { console.error("createPost:", error); return null; }
    return { ...data, is_liked: false, is_bookmarked: false } as Post;
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
        author:profiles!posts_user_id_fkey(id, full_name, username, avatar_url, headline, plan)
      `)
      .eq("id", postId)
      .single();

    if (error || !data) return null;

    if (currentUserId) {
      const [l, b] = await Promise.all([
        supabase.from("likes").select("id").match({ post_id: postId, user_id: currentUserId }).maybeSingle(),
        supabase.from("bookmarks").select("id").match({ post_id: postId, user_id: currentUserId }).maybeSingle(),
      ]);
      return { ...data, is_liked: !!l.data, is_bookmarked: !!b.data } as Post;
    }
    return data as Post;
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
        author:profiles!comments_user_id_fkey(id, full_name, avatar_url, headline)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as AppComment[];
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
        author:profiles!comments_user_id_fkey(id, full_name, avatar_url, headline)
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

    return data as AppComment;
  } catch (e) {
    console.error("addComment:", e);
    return null;
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
    return data as AppNotification[];
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
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    return data ?? null;
  } catch { return null; }
}

export async function fetchProfilePosts(userId: string, currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id, user_id, content, image_url, likes_count, comments_count, shares_count,
        hashtags, poll, created_at,
        author:profiles!posts_user_id_fkey(id, full_name, username, avatar_url, headline, plan)
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
      ...post, is_liked: likedIds.has(post.id), is_bookmarked: bookmarkedIds.has(post.id),
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
        id, user_id, image_url, text, created_at, expires_at,
        author:profiles!stories_user_id_fkey(id, full_name, avatar_url)
      `)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as AppStory[];
  } catch (e) {
    console.error("fetchActiveStories:", e);
    return [];
  }
}

export async function createStory(userId: string, text: string): Promise<AppStory | null> {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("stories")
      .insert({ user_id: userId, text, expires_at: expiresAt })
      .select(`
        id, user_id, image_url, text, created_at, expires_at,
        author:profiles!stories_user_id_fkey(id, full_name, avatar_url)
      `)
      .single();

    if (error) { console.error("createStory:", error); return null; }
    return data as AppStory;
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
      .select("id, full_name, username, avatar_url, headline")
      .neq("id", currentUserId)
      .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(limit);
    if (error || !data) return [];
    return data;
  } catch { return []; }
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────

export async function fetchMessages(conversationId: string): Promise<AppMessage[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
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
        conversation:conversations(id, is_group, name, created_at)
      `)
      .eq("user_id", userId);

    if (error || !data) return [];

    const results: AppConversation[] = [];
    for (const row of data as any[]) {
      const convo = row.conversation;
      if (!convo) continue;

      // Get the other participant
      const { data: others } = await supabase
        .from("conversation_participants")
        .select("user_id, profile:profiles!conversation_participants_user_id_fkey(id, full_name, avatar_url)")
        .eq("conversation_id", convo.id)
        .neq("user_id", userId)
        .limit(1);

      // Get last message
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("conversation_id", convo.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get unread count
      const { count: unreadCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convo.id)
        .neq("sender_id", userId);

      const other = others?.[0];
      results.push({
        id: convo.id,
        is_group: convo.is_group,
        name: convo.name,
        last_message: lastMsg?.content ?? null,
        last_message_at: lastMsg?.created_at ?? convo.created_at,
        unread_count: unreadCount ?? 0,
        participant: other ? (other as any).profile : null,
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
    return data as AppReport[];
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

    // Create new
    const { data: convo } = await supabase
      .from("conversations")
      .insert({ is_group: false })
      .select()
      .single();
    if (!convo) return null;

    await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: userId1 },
      { conversation_id: convo.id, user_id: userId2 },
    ]);

    return convo.id;
  } catch (e) {
    console.error("getOrCreateDirectConversation:", e);
    return null;
  }
}
