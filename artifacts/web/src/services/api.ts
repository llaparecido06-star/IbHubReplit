import { supabase, getCachedSession } from "@/lib/supabase";
import { extractWineName } from "@/utils/winePost";

// ─── Feed / Posts ──────────────────────────────────────────────────────────────

export type ReactionType = "curtir" | "saude" | "bravo" | "destaque" | "incrivel";

export interface PollOption {
  text: string;
  votes: number;
}

export interface Poll {
  options: PollOption[];
  total_votes: number;
  closed: boolean;
  expires_at?: string | null;
  allow_multiple?: boolean;
  user_votes?: Record<string, number | number[]>;
  user_voted_index?: number | null;
  user_voted_indices?: number[];
}

export function normalizePollIndices(userVotes: Record<string, number | number[]> | undefined, userId: string): number[] {
  const v = userVotes?.[userId];
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

export interface Post {
  id: string;
  user_id: string;
  company_page_id?: string | null;
  content: string;
  image_url?: string | null;
  image_urls?: string[] | null;
  video_url?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  view_count?: number;
  is_liked?: boolean;
  reaction_type?: ReactionType | null;
  is_bookmarked?: boolean;
  created_at: string;
  hashtags?: string[];
  location?: string | null;
  poll?: Poll | null;
  author?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url?: string | null;
    headline?: string | null;
    plan?: string;
    is_shadowbanned?: boolean;
  };
  company_page?: { id: string; name: string; avatar_url?: string | null } | null;
}

export interface SuggestedProfile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  plan: string;
  connection_status: "none" | "pending" | "connected";
  match_score: number;
  company_match: boolean;
  is_company: boolean;
  is_following: boolean;
}

const POST_SELECT = `id, user_id, company_page_id, content, image_url, image_urls, video_url,
  likes_count, comments_count, shares_count, view_count, location, hashtags, poll, created_at`;

async function _fetchProfilesMap(userIds: string[]): Promise<Map<string, any>> {
  if (!userIds.length) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, position, company, plan, is_shadowbanned")
    .in("id", userIds);
  return new Map((data ?? []).map((p: any) => [p.id, p]));
}


function _normalisePost(raw: any, profileMap: Map<string, any>): Post {
  const p = profileMap.get(raw.user_id);
  return {
    ...raw,
    author: p ? {
      id: p.id,
      full_name: p.full_name,
      username: p.username,
      avatar_url: p.avatar_url,
      headline: [p.position, p.company].filter(Boolean).join(" · ") || null,
      plan: p.plan ?? "gratuito",
      is_shadowbanned: p.is_shadowbanned ?? false,
    } : undefined,
  };
}

export async function fetchFeedPosts(currentUserId: string): Promise<Post[]> {
  try {
    // Use the authoritative API server endpoint for shadowban enforcement.
    // The server filters using the admin Supabase client; clients cannot bypass this.
    const session = await getCachedSession();
    if (!session?.access_token) return [];

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

    const res = await fetch(`${apiBase}/feed/posts?limit=30`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];

    const { posts: rawPosts } = await res.json() as { posts: any[] };
    if (!rawPosts?.length) return [];

    const userIds = [...new Set(rawPosts.map((p: any) => p.user_id).filter(Boolean))] as string[];
    const postIds = rawPosts.map((p: any) => p.id) as string[];

    const [profileMap, likedRes, bookmarkRes] = await Promise.all([
      _fetchProfilesMap(userIds),
      supabase.from("likes").select("post_id, reaction_type").eq("user_id", currentUserId).is("company_page_id", null).in("post_id", postIds),
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);

    const likedMap = new Map((likedRes.data ?? []).map((l: any) => [l.post_id, l.reaction_type ?? "curtir"]));
    const bookmarkedIds = new Set((bookmarkRes.data ?? []).map((b: any) => b.post_id));

    return rawPosts.map((raw: any) => {
      const post = _normalisePost(raw, profileMap) as Post;
      if (post.poll) {
        const indices = normalizePollIndices(post.poll.user_votes, currentUserId);
        post.poll = { ...post.poll, user_voted_indices: indices, user_voted_index: indices[0] ?? null };
      }
      return {
        ...post,
        is_liked: likedMap.has(raw.id),
        reaction_type: (likedMap.get(raw.id) as ReactionType | undefined) ?? null,
        is_bookmarked: bookmarkedIds.has(raw.id),
      };
    });
  } catch (e) {
    console.warn("fetchFeedPosts:", e);
    return [];
  }
}

export async function uploadWebPostImage(file: File, userId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) { console.error("uploadWebPostImage error:", error); return null; }
    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(data.path);
    return urlData?.publicUrl ?? null;
  } catch (e) {
    console.error("uploadWebPostImage:", e);
    return null;
  }
}

export async function uploadWebPostVideo(file: File, userId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("post-videos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) { console.error("uploadWebPostVideo error:", error); return null; }
    const { data: urlData } = supabase.storage.from("post-videos").getPublicUrl(data.path);
    return urlData?.publicUrl ?? null;
  } catch (e) {
    console.error("uploadWebPostVideo:", e);
    return null;
  }
}

export async function createWebPost(params: {
  user_id: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  company_page_id?: string | null;
  poll?: Poll | null;
}): Promise<Post | null> {
  try {
    const { poll, ...rest } = params;
    const insertData: Record<string, unknown> = { ...rest, likes_count: 0, comments_count: 0, shares_count: 0, view_count: 0 };
    if (poll) insertData.poll = poll;
    const { data, error } = await supabase
      .from("posts")
      .insert(insertData)
      .select(POST_SELECT)
      .single();
    if (error || !data) return null;
    const profileMap = await _fetchProfilesMap([data.user_id]);
    const post = _normalisePost(data, profileMap) as Post;
    if (post.poll && poll) post.poll = { ...post.poll, user_voted_index: null };
    return post;
  } catch (e) {
    console.warn("createWebPost:", e);
    return null;
  }
}

export async function voteOnFeedPoll(postId: string, _userId: string, optionIndex: number): Promise<Poll | null> {
  try {
    const session = await getCachedSession();
    if (!session?.access_token) return null;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;
    const res = await fetch(`${apiBase}/posts/${postId}/poll/vote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ optionIndex }),
    });
    if (!res.ok) return null;
    const { poll: updatedPoll, indices } = await res.json() as { poll: Poll; indices: number[] };
    return { ...updatedPoll, user_voted_indices: indices, user_voted_index: indices[0] ?? null };
  } catch (e) {
    console.warn("voteOnFeedPoll:", e);
    return null;
  }
}

export async function fetchPollVoters(userIds: string[]): Promise<{ id: string; full_name: string | null; avatar_url: string | null; username: string | null }[]> {
  if (!userIds.length) return [];
  const { data } = await supabase.from("profiles").select("id, full_name, avatar_url, username").in("id", userIds);
  return data ?? [];
}

export async function fetchCompanyFeedPosts(companyPageId: string, currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("company_page_id", companyPageId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error || !data || !data.length) return [];
    const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))] as string[];
    const postIds = data.map((p: any) => p.id) as string[];
    const [profileMap, likedRes] = await Promise.all([
      _fetchProfilesMap(userIds),
      supabase.from("likes").select("post_id, reaction_type").eq("company_page_id", companyPageId).in("post_id", postIds),
    ]);
    const likedMap = new Map((likedRes.data ?? []).map((l: any) => [l.post_id, l.reaction_type ?? "curtir"]));
    return data.map((raw: any) => ({
      ..._normalisePost(raw, profileMap),
      is_liked: likedMap.has(raw.id),
      reaction_type: (likedMap.get(raw.id) as ReactionType | undefined) ?? null,
    }));
  } catch (e) {
    console.warn("fetchCompanyFeedPosts:", e);
    return [];
  }
}

export async function toggleLikePost(
  postId: string,
  userId: string,
  isLiked: boolean,
  // Default aligned with mobile + DB constraint: likes_reaction_type_check
  // only allows saude/bravo/destaque/incrivel. Inserting "curtir" (the previous
  // default) was rejected at the DB layer for any caller that omitted this arg.
  reaction: ReactionType = "saude",
  companyPageId?: string | null,
  actorName?: string,
): Promise<boolean> {
  try {
    if (isLiked) {
      // UNLIKE — always a plain DELETE + decrement
      if (companyPageId) {
        const { error } = await supabase.from("likes").delete().match({ post_id: postId, company_page_id: companyPageId });
        if (error) { console.warn("toggleLikePost delete (company):", error); return false; }
      } else {
        const { error } = await supabase.from("likes").delete().match({ post_id: postId, user_id: userId }).is("company_page_id", null);
        if (error) { console.warn("toggleLikePost delete (personal):", error); return false; }
      }
      await supabase.rpc("decrement_post_likes", { p_post_id: postId });
    } else {
      // LIKE — use INSERT (not upsert) so unique constraint violations are detectable.
      // If the row already exists the DB returns code 23505 (unique violation) and we
      // do NOT call the RPC, preventing phantom double-counts.
      const payload: Record<string, unknown> = { post_id: postId, user_id: userId, reaction_type: reaction };
      if (companyPageId) payload.company_page_id = companyPageId;

      const { error } = await supabase.from("likes").insert(payload);
      if (error) {
        if (error.code === "23505") {
          // Already liked — the unique index caught it. State is already correct in DB.
          return true;
        }
        console.warn("toggleLikePost insert:", error);
        return false;
      }
      // Row was freshly inserted — safe to increment
      await supabase.rpc("increment_post_likes", { p_post_id: postId });
      if (actorName && !companyPageId) {
        _dispatchSocialPush({ type: "like", postId, actorName });
      }
    }
    return true;
  } catch (e) {
    console.warn("toggleLikePost:", e);
    return false;
  }
}

export async function changeReactionPost(postId: string, userId: string, reaction: ReactionType, companyPageId?: string | null): Promise<boolean> {
  try {
    if (companyPageId) {
      await supabase.from("likes").update({ reaction_type: reaction }).match({ post_id: postId, company_page_id: companyPageId });
    } else {
      await supabase.from("likes").update({ reaction_type: reaction }).match({ post_id: postId, user_id: userId }).is("company_page_id", null);
    }
    return true;
  } catch (e) {
    console.warn("changeReactionPost:", e);
    return false;
  }
}

export async function toggleBookmarkPost(postId: string, userId: string, isBookmarked: boolean): Promise<boolean> {
  try {
    if (isBookmarked) {
      await supabase.from("bookmarks").delete().match({ post_id: postId, user_id: userId });
    } else {
      await supabase.from("bookmarks").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id" });
    }
    return true;
  } catch (e) {
    console.warn("toggleBookmarkPost:", e);
    return false;
  }
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("posts").delete().match({ id: postId, user_id: userId });
    return !error;
  } catch { return false; }
}

export async function updatePost(postId: string, userId: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("posts").update({ content }).match({ id: postId, user_id: userId });
    return !error;
  } catch { return false; }
}

export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("user_blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
    return !error;
  } catch { return false; }
}

export async function reportPost(reporterId: string, postId: string, reason: string): Promise<boolean> {
  try {
    await supabase.from("reports").insert({ reporter_id: reporterId, post_id: postId, reason });
    return true;
  } catch { return true; }
}

export async function fetchSavedPosts(userId: string): Promise<Post[]> {
  try {
    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!bookmarks || bookmarks.length === 0) return [];
    const postIds = bookmarks.map((b: any) => b.post_id);

    const { data } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .in("id", postIds)
      .order("created_at", { ascending: false });

    if (!data || !data.length) return [];
    const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))] as string[];
    const profileMap = await _fetchProfilesMap(userIds);

    return data.map((raw: any) => ({
      ..._normalisePost(raw, profileMap),
      is_bookmarked: true,
    }));
  } catch (e) {
    console.warn("fetchSavedPosts:", e);
    return [];
  }
}

// ─── Wine Community Rankings ──────────────────────────────────────────────────

export interface WineCommunityRating {
  ean: string;
  name: string;
  producer: string | null;
  vintage: string | null;
  grape: string | null;
  region?: string | null;
  country?: string | null;
  wine_type?: string | null;
  image_url?: string | null;
  avg_rating: number;
  avg_score: number | null;
  total_ratings: number;
}

export async function fetchWineCommunityRankings(): Promise<WineCommunityRating[]> {
  try {
    const { data, error } = await supabase.rpc("wine_community_ratings", { p_ean: null });
    if (error) { console.warn("fetchWineCommunityRankings:", error); return []; }
    return (data ?? []) as WineCommunityRating[];
  } catch (e) {
    console.warn("fetchWineCommunityRankings:", e);
    return [];
  }
}

// ─── Profile Stats & Lists ────────────────────────────────────────────────────

export interface ProfilePerson {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
}

export async function fetchConnectionsList(userId: string): Promise<ProfilePerson[]> {
  try {
    const { data } = await supabase
      .from("connections")
      .select("requester_id, receiver_id, created_at")
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });
    if (!data) return [];
    const ids = data.map((c: any) => c.requester_id === userId ? c.receiver_id : c.requester_id);
    if (!ids.length) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    // Preserve the order from connections (most recent first)
    return ids.map(id => {
      const p = profileMap.get(id);
      if (!p) return null;
      return { id: p.id, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, headline: [p.position, p.company].filter(Boolean).join(" · ") || null };
    }).filter(Boolean) as ProfilePerson[];
  } catch (e) {
    console.warn("fetchConnectionsList:", e);
    return [];
  }
}

export async function fetchFollowersList(userId: string): Promise<ProfilePerson[]> {
  try {
    const { data } = await supabase
      .from("follows")
      .select("follower_id, created_at")
      .eq("following_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data || !data.length) return [];
    const ids = data.map((f: any) => f.follower_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return ids.map(id => {
      const p = profileMap.get(id);
      if (!p) return null;
      return { id: p.id, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, headline: [p.position, p.company].filter(Boolean).join(" · ") || null };
    }).filter(Boolean) as ProfilePerson[];
  } catch (e) {
    console.warn("fetchFollowersList:", e);
    return [];
  }
}

export async function fetchFollowingList(userId: string): Promise<ProfilePerson[]> {
  try {
    const { data } = await supabase
      .from("follows")
      .select("following_id, created_at")
      .eq("follower_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data || !data.length) return [];
    const ids = data.map((f: any) => f.following_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return ids.map(id => {
      const p = profileMap.get(id);
      if (!p) return null;
      return { id: p.id, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, headline: [p.position, p.company].filter(Boolean).join(" · ") || null };
    }).filter(Boolean) as ProfilePerson[];
  } catch (e) {
    console.warn("fetchFollowingList:", e);
    return [];
  }
}

// ─── Connections (pending/accept/reject) ─────────────────────────────────────

export interface ConnectionProfile {
  id: string;
  connectionId: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  position: string | null;
  company: string | null;
}

export async function fetchPendingConnectionsReceived(userId: string): Promise<ConnectionProfile[]> {
  try {
    const { data } = await supabase
      .from("connections")
      .select("id, requester_id")
      .eq("receiver_id", userId)
      .eq("status", "pending");
    if (!data || !data.length) return [];
    const ids = data.map((c: any) => c.requester_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return data.map((c: any) => {
      const p = profileMap.get(c.requester_id) ?? {};
      return { id: c.requester_id, connectionId: c.id, full_name: p.full_name ?? null, username: p.username ?? null, avatar_url: p.avatar_url ?? null, position: p.position ?? null, company: p.company ?? null };
    });
  } catch (e) { console.warn("fetchPendingConnectionsReceived:", e); return []; }
}

export async function fetchPendingConnectionsSent(userId: string): Promise<ConnectionProfile[]> {
  try {
    const { data } = await supabase
      .from("connections")
      .select("id, receiver_id")
      .eq("requester_id", userId)
      .eq("status", "pending");
    if (!data || !data.length) return [];
    const ids = data.map((c: any) => c.receiver_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return data.map((c: any) => {
      const p = profileMap.get(c.receiver_id) ?? {};
      return { id: c.receiver_id, connectionId: c.id, full_name: p.full_name ?? null, username: p.username ?? null, avatar_url: p.avatar_url ?? null, position: p.position ?? null, company: p.company ?? null };
    });
  } catch (e) { console.warn("fetchPendingConnectionsSent:", e); return []; }
}

export async function respondToConnectionWeb(connectionId: string, action: "accepted" | "rejected"): Promise<boolean> {
  try {
    if (action === "rejected") {
      const { error } = await supabase.from("connections").delete().eq("id", connectionId);
      return !error;
    }

    // Load the connection to know both sides
    const { data: conn } = await supabase
      .from("connections")
      .select("requester_id, receiver_id")
      .eq("id", connectionId)
      .maybeSingle();
    if (!conn) return false;
    const { requester_id, receiver_id } = conn as { requester_id: string; receiver_id: string };

    // 1. Mark accepted
    const { error } = await supabase.from("connections").update({ status: "accepted" }).eq("id", connectionId);
    if (error) return false;

    // 2. Auto-follow: receiver follows requester back (requester already follows receiver from sendWebConnectionRequest)
    await supabase.from("follows").upsert(
      { follower_id: receiver_id, following_id: requester_id },
      { onConflict: "follower_id,following_id" },
    );

    // 3. Notify the requester that their request was accepted
    await supabase.from("notifications").insert({
      user_id:  requester_id,
      actor_id: receiver_id,
      type:     "connection_accepted",
      message:  "aceitou seu pedido de conexão",
    });

    // 4. Unlock any existing direct conversation between the two users
    const { data: convs } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", requester_id);
    if (convs && convs.length > 0) {
      const convIds = (convs as { conversation_id: string }[]).map(c => c.conversation_id);
      await supabase
        .from("conversation_participants")
        .update({ accepted: true })
        .in("conversation_id", convIds)
        .eq("user_id", receiver_id);
    }

    return true;
  } catch (e) {
    console.warn("respondToConnectionWeb:", e);
    return false;
  }
}

export async function fetchConnectedUsersWeb(userId: string): Promise<ConnectionProfile[]> {
  try {
    const [sent, received] = await Promise.all([
      supabase.from("connections").select("id, receiver_id").eq("requester_id", userId).eq("status", "accepted"),
      supabase.from("connections").select("id, requester_id").eq("receiver_id", userId).eq("status", "accepted"),
    ]);
    const pairs: { connId: string; otherId: string }[] = [
      ...((sent.data ?? []) as any[]).map((r) => ({ connId: r.id, otherId: r.receiver_id })),
      ...((received.data ?? []) as any[]).map((r) => ({ connId: r.id, otherId: r.requester_id })),
    ];
    if (!pairs.length) return [];
    const ids = pairs.map((p) => p.otherId);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return pairs.map(({ connId, otherId }) => {
      const p = profileMap.get(otherId) ?? {};
      return { id: otherId, connectionId: connId, full_name: p.full_name ?? null, username: p.username ?? null, avatar_url: p.avatar_url ?? null, position: p.position ?? null, company: p.company ?? null };
    });
  } catch (e) { console.warn("fetchConnectedUsersWeb:", e); return []; }
}

export async function approveGroupMemberWeb(groupId: string, memberId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("group_members")
      .update({ role: "member" })
      .eq("group_id", groupId)
      .eq("user_id", memberId)
      .eq("role", "pending");
    return !error;
  } catch { return false; }
}

export async function rejectGroupMemberWeb(groupId: string, memberId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", memberId);
    return !error;
  } catch { return false; }
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  headline: string | null;
  position: string | null;
  company: string | null;
  plan: string;
  is_admin: boolean;
  created_at: string;
  certifications?: string[] | null;
  areas_of_expertise?: string[] | null;
  profile_type?: string | null;
  location?: string | null;
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, bio, headline, position, company, plan, is_admin, created_at, certifications, areas_of_expertise, profile_type, location")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as UserProfile;
  } catch (e) {
    console.warn("fetchUserProfile:", e);
    return null;
  }
}

export async function fetchUserPosts(userId: string, currentUserId?: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data || !data.length) return [];
    const postIds = data.map((p: any) => p.id) as string[];
    const [profileMap, likedRes, bookmarkRes] = await Promise.all([
      _fetchProfilesMap([userId]),
      currentUserId
        ? supabase.from("likes").select("post_id, reaction_type").eq("user_id", currentUserId).is("company_page_id", null).in("post_id", postIds)
        : Promise.resolve({ data: [] }),
      currentUserId
        ? supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds)
        : Promise.resolve({ data: [] }),
    ]);
    const likedMap = new Map(((likedRes as any).data ?? []).map((l: any) => [l.post_id, l.reaction_type ?? "curtir"]));
    const bookmarkedIds = new Set(((bookmarkRes as any).data ?? []).map((b: any) => b.post_id));
    return data.map((raw: any) => ({
      ..._normalisePost(raw, profileMap),
      is_liked: likedMap.has(raw.id),
      reaction_type: (likedMap.get(raw.id) as ReactionType | undefined) ?? null,
      is_bookmarked: bookmarkedIds.has(raw.id),
    }));
  } catch (e) {
    console.warn("fetchUserPosts:", e);
    return [];
  }
}

export async function fetchWebSuggestedConnections(
  currentUserId: string,
  userAreas: string[] = [],
  userCompany: string | null = null,
  limit = 5,
): Promise<SuggestedProfile[]> {
  try {
    const { data: conns } = await supabase
      .from("connections")
      .select("requester_id, receiver_id, status")
      .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    const excludedIds = new Set<string>([currentUserId]);
    const statusMap = new Map<string, "pending" | "connected">();
    (conns ?? []).forEach((c: any) => {
      const other = c.requester_id === currentUserId ? c.receiver_id : c.requester_id;
      excludedIds.add(other);
      statusMap.set(other, c.status === "accepted" ? "connected" : "pending");
    });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company, plan, areas, profile_type")
      .limit(80);

    if (!profiles) return [];

    const lowerUserAreas = userAreas.map(a => a.toLowerCase());
    const lowerUserCompany = userCompany?.toLowerCase() ?? null;

    const scored = (profiles as any[])
      .filter((p: any) => !excludedIds.has(p.id))
      .map((p: any) => {
        const pAreas: string[] = Array.isArray(p.areas) ? p.areas : [];
        const match_score = pAreas.filter(a => lowerUserAreas.includes(a.toLowerCase())).length;
        const company_match = !!(lowerUserCompany && p.company && p.company.toLowerCase() === lowerUserCompany);
        return {
          id: p.id,
          full_name: p.full_name,
          username: p.username,
          avatar_url: p.avatar_url,
          headline: [p.position, p.company].filter(Boolean).join(" · ") || null,
          plan: p.plan ?? "gratuito",
          connection_status: statusMap.get(p.id) ?? "none",
          match_score,
          company_match,
          is_company: p.profile_type === "empresa",
          is_following: false,
        } as SuggestedProfile;
      })
      .sort((a, b) => {
        const totalA = a.match_score + (a.company_match ? 2 : 0);
        const totalB = b.match_score + (b.company_match ? 2 : 0);
        return totalB - totalA;
      });

    return scored.slice(0, limit);
  } catch (e) {
    console.warn("fetchWebSuggestedConnections:", e);
    return [];
  }
}

export async function removeWebConnection(targetId: string, currentUserId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("connections")
      .delete()
      .or(
        `and(requester_id.eq.${currentUserId},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${currentUserId})`
      );
    return !error;
  } catch {
    return false;
  }
}

export async function sendWebConnectionRequest(targetId: string, currentUserId: string): Promise<void> {
  try {
    await supabase.from("connections").upsert(
      { requester_id: currentUserId, receiver_id: targetId, status: "pending" },
      { onConflict: "requester_id,receiver_id" },
    );
    await supabase.from("follows").upsert(
      { follower_id: currentUserId, following_id: targetId },
      { onConflict: "follower_id,following_id" },
    );
    // Notify the receiver so it shows in their notification bell
    await supabase.from("notifications").insert({
      user_id:  targetId,
      actor_id: currentUserId,
      type:     "connection",
      message:  "enviou um pedido de conexão",
    });
  } catch (e) {
    console.warn("sendWebConnectionRequest:", e);
  }
}

export async function checkWebConnectionStatus(
  targetId: string,
  currentUserId: string,
): Promise<"none" | "pending_sent" | "pending_received" | "connected"> {
  try {
    const { data } = await supabase
      .from("connections")
      .select("id, status, requester_id")
      .or(
        `and(requester_id.eq.${currentUserId},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${currentUserId})`
      )
      .maybeSingle();
    if (!data) return "none";
    if ((data as any).status === "accepted") return "connected";
    // Distinguish direction so the UI can show Accept/Reject when current user is the receiver
    return (data as any).requester_id === currentUserId ? "pending_sent" : "pending_received";
  } catch (e) {
    console.warn("checkWebConnectionStatus:", e);
    return "none";
  }
}

/**
 * Get or create a 1:1 conversation between two users, optionally tagged
 * to a company page. When `companyPageId` is set, the conversation is a
 * company-scoped thread (the company owner side will see it under that
 * company's inbox, the other side will see the company's name/avatar).
 *
 * Routes through the API server (`POST /conversations/direct`) so that:
 * - RLS doesn't block inserting the recipient's participant row.
 * - Company / personal threads stay separate (the SECURITY DEFINER RPC
 *   matches on `company_page_id`).
 */
export async function getOrCreateWebConversation(
  currentUserId: string,
  targetId: string,
  companyPageId?: string | null,
  forceAccepted = false,
): Promise<string | null> {
  try {
    const session = await getCachedSession();
    const token = session?.access_token;
    if (!token) {
      console.warn("getOrCreateWebConversation: no session token");
      return null;
    }

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

    const res = await fetch(`${apiBase}/conversations/direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_id_1:       currentUserId,
        user_id_2:       targetId,
        company_page_id: companyPageId ?? null,
        force_accepted:  forceAccepted,
      }),
    });

    if (!res.ok) {
      console.warn("getOrCreateWebConversation server error:", res.status);
      return null;
    }
    const json = await res.json() as { conversation_id?: string };
    return json.conversation_id ?? null;
  } catch (e) {
    console.warn("getOrCreateWebConversation:", e);
    return null;
  }
}

export async function checkWebFollowStatus(
  targetId: string,
  currentUserId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUserId)
      .eq("following_id", targetId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function toggleWebFollow(
  targetId: string,
  currentUserId: string,
  isCurrentlyFollowing: boolean,
): Promise<boolean> {
  try {
    if (isCurrentlyFollowing) {
      await supabase.from("follows").delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", targetId);
    } else {
      await supabase.from("follows").upsert(
        { follower_id: currentUserId, following_id: targetId },
        { onConflict: "follower_id,following_id" },
      );
    }
    return true;
  } catch {
    return false;
  }
}

const _statsCache = new Map<string, { data: { connections: number; followers: number; following: number }; ts: number }>();
const STATS_TTL = 30 * 1000;

export async function fetchProfileStats(userId: string, forceRefresh = false): Promise<{ connections: number; followers: number; following: number }> {
  const cached = _statsCache.get(userId);
  if (!forceRefresh && cached && Date.now() - cached.ts < STATS_TTL) return cached.data;
  try {
    const [followersRes, followingRes, connRes] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
      supabase.from("connections").select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "accepted"),
    ]);
    const result = {
      followers:   followersRes.count  ?? 0,
      following:   followingRes.count  ?? 0,
      connections: connRes.count       ?? 0,
    };
    _statsCache.set(userId, { data: result, ts: Date.now() });
    return result;
  } catch {
    return cached?.data ?? { connections: 0, followers: 0, following: 0 };
  }
}

export function invalidateStatsCache(userId: string) {
  _statsCache.delete(userId);
}

// ─── Market Presentations ─────────────────────────────────────────────────────

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
    console.warn("fetchMarketPresentations:", e);
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
    console.warn("fetchAllMarketPresentations:", e);
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

export interface PresentationSlide {
  slide_id: string;
  sequence_order: number;
  url: string | null;
  locked: boolean;
}

export async function fetchPresentationSlides(presentationId: string): Promise<{ slides: PresentationSlide[]; total: number } | null> {
  try {
    const session = await getCachedSession();
    if (!session?.access_token) return null;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;
    const res = await fetch(`${apiBase}/presentations/${presentationId}/slides`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ slides: PresentationSlide[]; total: number }>;
  } catch {
    return null;
  }
}

export async function triggerPresentationAccess(presentationId: string): Promise<{ ok: boolean; reason?: string }> {
  const session = await getCachedSession();
  if (!session?.access_token) return { ok: false, reason: "unauthenticated" };
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
    ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;
  const res = await fetch(`${apiBase}/presentations/${presentationId}/access`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return { ok: false, reason: body.error ?? "plan_required" };
  }
  if (!res.ok) return { ok: false, reason: "server_error" };
  return { ok: true };
}

// ─── Conversations / Messages ─────────────────────────────────────────────────

export interface WebConversation {
  id: string;
  is_group: boolean;
  name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  participant: { id: string; full_name: string; avatar_url?: string | null } | null;
  /**
   * Identity bucket the conversation belongs to:
   * - null  → personal (1:1 between regular users), or a personal-side
   *           conversation with a company.
   * - uuid  → conversation belongs to that company page's inbox.
   */
  company_page_id?: string | null;
  /**
   * Resolved company identity for the company-scoped thread (when
   * `company_page_id` is set). Used by the chat list to render the
   * company's name/avatar to the non-owner side instead of leaking
   * the owner's personal profile.
   */
  company_page?: { id: string; owner_id: string | null; name: string; avatar_url: string | null } | null;
}

export interface WebMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  from_company_page_id?: string | null;
  content: string;
  created_at: string;
  message_type?: string | null;
  media_url?: string | null;
  sender?: { id: string; full_name: string; avatar_url?: string | null };
  /** When the message was authored from a company identity, this
   *  carries the company's display name/avatar so the recipient sees
   *  "Empresa X" instead of the owner's personal profile. */
  from_company?: { id: string; name: string; avatar_url: string | null } | null;
}

/**
 * Fetch conversations scoped to the user's currently-active identity.
 * - When `activeCompanyId` is provided (user is acting as a company), only
 *   conversations tagged with that company_page_id are returned.
 * - When in personal mode (`activeCompanyId == null`), conversations belonging
 *   to companies this user OWNS are excluded so they only show under company
 *   mode. Conversations with no company_page_id (purely personal) and ones
 *   where the user is the non-owner side of a company chat are kept.
 * - Group chats are always included (identity-agnostic, same rule as mobile).
 */
export async function fetchWebConversations(
  userId: string,
  activeCompanyId?: string | null,
): Promise<WebConversation[]> {
  try {
    // Use SECURITY DEFINER RPC to bypass RLS on conversation_participants (same as mobile)
    const [participantsRes, convosRes, ownedCompaniesRes] = await Promise.all([
      supabase.rpc("get_my_conversations_participants", { p_user_id: userId }),
      supabase
        .from("conversation_participants")
        .select("conversation_id, accepted, last_read_at, conversation:conversations(id, is_group, name, created_at, company_page_id)")
        .eq("user_id", userId),
      supabase.from("company_pages").select("id").eq("owner_id", userId),
    ]);

    if (convosRes.error || !convosRes.data) return [];

    const ownedCompanyIds = new Set<string>(
      ((ownedCompaniesRes.data ?? []) as any[]).map((c: any) => c.id as string),
    );

    const participantMap = new Map<string, { other_user_id: string | null }>();
    for (const row of (participantsRes.data ?? []) as any[]) {
      participantMap.set(row.conversation_id, { other_user_id: row.other_user_id ?? null });
    }

    const allOtherIds = [...new Set(
      [...participantMap.values()].map(v => v.other_user_id).filter(Boolean) as string[]
    )];

    let profileMap = new Map<string, any>();
    if (allOtherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", allOtherIds);
      profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    }

    // Resolve company identities for company-scoped conversations so the
    // non-owner side renders "Empresa X" instead of the owner's personal
    // profile (privacy: owner's personal name/avatar would otherwise leak).
    const convoCompanyIds = [
      ...new Set(
        ((convosRes.data ?? []) as any[])
          .map((r: any) => r.conversation?.company_page_id as string | null | undefined)
          .filter(Boolean) as string[],
      ),
    ];
    let companyPageMap = new Map<string, { id: string; owner_id: string | null; name: string; avatar_url: string | null }>();
    if (convoCompanyIds.length > 0) {
      const { data: cpRows } = await supabase
        .from("company_pages")
        .select("id, owner_id, name, avatar_url")
        .in("id", convoCompanyIds);
      if (cpRows) {
        for (const r of cpRows as Array<{ id: string; owner_id: string | null; name: string; avatar_url: string | null }>) {
          companyPageMap.set(r.id, r);
        }
      }
    }

    const results: WebConversation[] = [];
    for (const row of convosRes.data as any[]) {
      const convo = row.conversation;
      if (!convo) continue;

      const pInfo = participantMap.get(convo.id);
      const participant = pInfo?.other_user_id ? (profileMap.get(pInfo.other_user_id) ?? null) : null;
      const cpId = (convo as any).company_page_id ?? null;
      const company_page = cpId ? (companyPageMap.get(cpId) ?? null) : null;

      const lastMsgRes = await supabase
        .from("messages")
        .select("content, created_at, message_type")
        .eq("conversation_id", convo.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

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
        unread_count: 0,
        participant,
        company_page_id: cpId,
        company_page,
      });
    }

    const sorted = results.sort(
      (a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime(),
    );

    // ── Identity scoping (same rules as mobile fetchConversations) ────────────
    if (activeCompanyId) {
      // Company mode: only this company's conversations (groups always shown).
      return sorted.filter(r => r.is_group || r.company_page_id === activeCompanyId);
    }
    // Personal mode: drop conversations belonging to companies this user owns
    // (they'll show up cleanly when the user switches into that company).
    return sorted.filter(r => r.is_group || !r.company_page_id || !ownedCompanyIds.has(r.company_page_id));
  } catch (e) {
    console.warn("fetchWebConversations:", e);
    return [];
  }
}

export async function fetchWebMessages(conversationId: string): Promise<WebMessage[]> {
  try {
    // Try the SECURITY DEFINER RPC first (bypasses RLS so all participants see all messages)
    const { data: rpcData, error: rpcError } = await supabase
      .rpc("get_conversation_messages", { p_conversation_id: conversationId });

    let raw: any[] | null = null;
    if (!rpcError && rpcData) {
      raw = (rpcData as any[]).map((m) => ({
        id:                   m.id,
        conversation_id:      m.conversation_id,
        sender_id:            m.sender_id,
        content:              m.content ?? "",
        created_at:           m.created_at,
        message_type:         m.message_type ?? null,
        media_url:            m.media_url ?? null,
        from_company_page_id: m.from_company_page_id ?? null,
        sender: {
          id:         m.sender_id,
          full_name:  m.sender_name   ?? null,
          avatar_url: m.sender_avatar ?? null,
        },
      }));
    } else {
      // Fallback: direct query (may only return messages where sender_id = current user due to RLS)
      console.warn("get_conversation_messages RPC unavailable, using direct query:", rpcError?.message);
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at, message_type, media_url, from_company_page_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!data || data.length === 0) return [];

      const senderIds = [...new Set(data.map((m: any) => m.sender_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", senderIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      raw = data.map((m: any) => ({
        ...m,
        from_company_page_id: m.from_company_page_id ?? null,
        sender: profileMap.get(m.sender_id) ?? null,
      }));
    }

    if (!raw) return [];

    // Resolve company identities for messages authored as a company so the
    // recipient sees "Empresa X" instead of the owner's personal profile.
    const fromCpIds = [
      ...new Set(raw.map(m => m.from_company_page_id).filter(Boolean) as string[]),
    ];
    if (fromCpIds.length > 0) {
      const { data: cpRows } = await supabase
        .from("company_pages")
        .select("id, name, avatar_url")
        .in("id", fromCpIds);
      const cpMap = new Map<string, { id: string; name: string; avatar_url: string | null }>();
      for (const c of (cpRows ?? []) as Array<{ id: string; name: string; avatar_url: string | null }>) {
        cpMap.set(c.id, c);
      }
      raw = raw.map(m => ({
        ...m,
        from_company: m.from_company_page_id ? (cpMap.get(m.from_company_page_id) ?? null) : null,
      }));
    }

    return raw as WebMessage[];
  } catch (e) {
    console.warn("fetchWebMessages:", e);
    return [];
  }
}

/**
 * Send a chat message. When the user is acting as a company (companyPageId
 * provided), `from_company_page_id` is persisted so the message is rendered
 * with the company's name/avatar to the recipient and remains in the company
 * inbox after switching identities.
 *
 * Routed through the API server (POST /messages/send) rather than a direct
 * Supabase insert: the server enforces sender / company-membership checks
 * (see api-server/src/routes/messages.ts). A direct client insert would let
 * a malicious caller spoof `from_company_page_id` for any company they don't
 * actually administer.
 */
export async function sendWebMessage(
  conversationId: string,
  senderId: string,
  content: string,
  opts?: { companyPageId?: string | null; messageType?: string; mediaUrl?: string | null },
): Promise<boolean> {
  try {
    const session = await getCachedSession();
    const token = session?.access_token;
    if (!token) {
      console.warn("sendWebMessage: no session token");
      return false;
    }

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

    const payload: Record<string, any> = {
      conversation_id: conversationId,
      sender_id:       senderId,
      content,
      message_type:    opts?.messageType ?? "text",
    };
    if (opts?.companyPageId) payload.from_company_page_id = opts.companyPageId;
    if (opts?.mediaUrl)      payload.media_url            = opts.mediaUrl;

    const res = await fetch(`${apiBase}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn("sendWebMessage server error:", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("sendWebMessage:", e);
    return false;
  }
}

/**
 * Upload an audio Blob recorded in the browser (e.g. MediaRecorder output)
 * and persist it as a chat message. Mirrors the mobile audio flow: the
 * blob is uploaded via /uploads/chat-form and then a `messages` row is
 * inserted with `message_type=audio` and `media_url=<uploaded url>`.
 */
export async function sendWebAudioMessage(
  conversationId: string,
  senderId: string,
  blob: Blob,
  mimeType: string,
  opts?: { companyPageId?: string | null; fileName?: string },
): Promise<{ success: boolean; mediaUrl: string | null }> {
  try {
    // Strip codec parameters (e.g. "audio/webm;codecs=opus" → "audio/webm")
    // because the server allowlist only matches plain mime types.
    const cleanMime = (mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
    const ext = (cleanMime.split("/")[1] ?? "webm") || "webm";
    const fileName = opts?.fileName ?? `audio-${Date.now()}.${ext}`;
    const file = new File([blob], fileName, { type: cleanMime });
    const url = await uploadChatAttachment(file, senderId);
    if (!url) return { success: false, mediaUrl: null };
    const ok = await sendWebMessage(conversationId, senderId, "", {
      companyPageId: opts?.companyPageId ?? null,
      messageType: "audio",
      mediaUrl: url,
    });
    return { success: ok, mediaUrl: url };
  } catch (e) {
    console.warn("sendWebAudioMessage:", e);
    return { success: false, mediaUrl: null };
  }
}

export async function uploadChatAttachment(file: File, userId: string): Promise<string | null> {
  try {
    const sessionData = await getCachedSession();
    const token = sessionData?.access_token ?? "";

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

    // Use multipart/form-data — avoids loading large video/audio files into memory
    // as base64 (which caused Network request failed for large files)
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("userId", userId);
    formData.append("mimeType", file.type || "application/octet-stream");

    const res = await fetch(`${apiBase}/uploads/chat-form`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Do NOT set Content-Type — let browser set multipart boundary automatically
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("uploadChatAttachment API error:", err);
      return null;
    }

    const { url } = await res.json();
    return url ?? null;
  } catch (e) {
    console.warn("uploadChatAttachment:", e);
    return null;
  }
}

// ─── Company Products (Portfolio) ─────────────────────────────────────────────

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

export async function deleteCompanyProduct(productId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("company_products").delete().eq("id", productId);
    if (error) { console.error("deleteCompanyProduct:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteCompanyProduct:", e);
    return false;
  }
}

/** Uploads a product image for a company portfolio item.
 *  Storage path uses the authenticated user id (matches mobile +
 *  existing RLS policy: bucket "post-images" is keyed by uploader uid).
 */
export async function uploadCompanyProductImage(
  productId: string,
  file: File,
): Promise<string | null> {
  try {
    if (!file.type.startsWith("image/")) {
      console.warn("uploadCompanyProductImage: not an image");
      return null;
    }
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      console.warn("uploadCompanyProductImage: image too large", file.size);
      return null;
    }
    const { data: sessionRes } = await supabase.auth.getSession();
    const userId = sessionRes.session?.user?.id;
    if (!userId) { console.warn("uploadCompanyProductImage: no session"); return null; }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/product-images/${productId}.${ext}`;
    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) { console.warn("uploadCompanyProductImage:", error); return null; }
    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    return data.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;
  } catch (e) {
    console.warn("uploadCompanyProductImage:", e);
    return null;
  }
}

// ─── Company Follow ──────────────────────────────────────────────────────────

export async function checkIsFollowingCompany(
  companyId: string,
  userId: string,
): Promise<boolean> {
  if (!companyId || !userId) return false;
  try {
    const { data } = await supabase
      .from("company_follows")
      .select("id")
      .match({ company_id: companyId, user_id: userId })
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function toggleCompanyFollow(
  companyId: string,
  userId: string,
  isCurrentlyFollowing: boolean,
): Promise<boolean> {
  if (!companyId || !userId) return false;
  try {
    if (isCurrentlyFollowing) {
      const { error } = await supabase
        .from("company_follows")
        .delete()
        .match({ company_id: companyId, user_id: userId });
      if (error) { console.warn("toggleCompanyFollow (unfollow):", error); return false; }
    } else {
      const { error } = await supabase
        .from("company_follows")
        .upsert(
          { company_id: companyId, user_id: userId },
          { onConflict: "company_id,user_id" },
        );
      if (error) { console.warn("toggleCompanyFollow (follow):", error); return false; }
    }
    return true;
  } catch (e) {
    console.warn("toggleCompanyFollow:", e);
    return false;
  }
}

export async function fetchCompanyFollowersCount(companyId: string): Promise<number> {
  if (!companyId) return 0;
  try {
    const { count, error } = await supabase
      .from("company_follows")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if (error) { console.warn("fetchCompanyFollowersCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.warn("fetchCompanyFollowersCount:", e);
    return 0;
  }
}

export async function fetchCompanyPostsCount(companyId: string): Promise<number> {
  if (!companyId) return 0;
  try {
    const { count, error } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("company_page_id", companyId);
    if (error) { console.warn("fetchCompanyPostsCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.warn("fetchCompanyPostsCount:", e);
    return 0;
  }
}

// ─── Company Events ──────────────────────────────────────────────────────────

/** Active, non-restricted events strictly linked to a company page.
 *  Safe for public company profile listings.
 */
export async function fetchPublicCompanyEvents(
  companyPageId: string,
): Promise<AppEvent[]> {
  if (!companyPageId) return [];
  try {
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("company_page_id", companyPageId)
      .eq("is_active", true)
      // Allow-list: only "publico" (or legacy NULL) reach the public profile.
      .or("visibility.is.null,visibility.eq.publico")
      .order("start_date", { ascending: true })
      .limit(100);
    if (error || !data) return [];
    return (data as EventDbRow[]).map(mapEventRow);
  } catch (e) {
    console.warn("fetchPublicCompanyEvents:", e);
    return [];
  }
}

export async function uploadPortfolioImage(file: File, userId: string): Promise<string | null> {
  try {
    const sessionData = await getCachedSession();
    const token = sessionData?.access_token ?? "";

    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

    const res = await fetch(`${apiBase}/uploads/portfolio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ fileBase64, fileName: file.name, mimeType: file.type || "image/jpeg", userId }),
    });

    if (!res.ok) return null;
    const { url } = await res.json();
    return url ?? null;
  } catch (e) {
    console.warn("uploadPortfolioImage:", e);
    return null;
  }
}

// ─── Company Pages ────────────────────────────────────────────────────────────

export interface WebCompanyPage {
  id: string;
  name: string;
  avatar_url: string | null;
  owner_id: string;
}

export async function fetchWebCompanyPages(userId: string): Promise<WebCompanyPage[]> {
  try {
    // Fetch pages where user is owner
    const ownedRes = await supabase
      .from("company_pages")
      .select("id, name, avatar_url, owner_id")
      .eq("owner_id", userId);

    const owned = (ownedRes.data ?? []) as WebCompanyPage[];

    // Try to fetch pages where user is admin (table may not exist)
    let adminPages: WebCompanyPage[] = [];
    try {
      const adminRes = await supabase
        .from("company_page_admins")
        .select("company_id")
        .eq("user_id", userId);
      const adminIds = (adminRes.data ?? []).map((m: any) => m.company_id).filter(Boolean);
      if (adminIds.length > 0) {
        const { data } = await supabase
          .from("company_pages")
          .select("id, name, avatar_url, owner_id")
          .in("id", adminIds);
        adminPages = (data ?? []) as WebCompanyPage[];
      }
    } catch (_) {}

    const ownedIds = new Set(owned.map((p) => p.id));
    return [...owned, ...adminPages.filter((p) => !ownedIds.has(p.id))];
  } catch (e) {
    console.warn("fetchWebCompanyPages:", e);
    return [];
  }
}

export async function fetchPublicUserProfile(userId: string): Promise<UserProfile | null> {
  return fetchUserProfile(userId);
}

export interface CompanyPageFull {
  id: string;
  owner_id: string;
  name: string;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  plan?: string | null;
  created_at?: string | null;
}

export async function fetchWebCompanyPageById(id: string): Promise<CompanyPageFull | null> {
  try {
    const { data, error } = await supabase
      .from("company_pages")
      .select("id, owner_id, name, username, avatar_url, bio, website, industry, location, plan, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data as CompanyPageFull;
  } catch (e) {
    console.warn("fetchWebCompanyPageById:", e);
    return null;
  }
}

export async function fetchCompanyPostsWeb(companyId: string, currentUserId: string): Promise<Post[]> {
  try {
    const { data: rawPosts } = await supabase
      .from("posts")
      .select("id, user_id, company_page_id, content, image_url, video_url, created_at")
      .eq("company_page_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!rawPosts) return [];

    const [authorIds, companyPageRes] = await Promise.all([
      Promise.resolve([...new Set((rawPosts as any[]).map((p: any) => p.user_id).filter(Boolean))]),
      supabase.from("company_pages").select("id, name, avatar_url").eq("id", companyId).maybeSingle(),
    ]);

    let profileMap = new Map<string, any>();
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, headline, plan")
        .in("id", authorIds as string[]);
      profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    }

    const companyPage = companyPageRes.data ?? null;

    const postIds = (rawPosts as any[]).map((p: any) => p.id);
    const [likesRes, commentsRes, bookmarksRes] = await Promise.all([
      supabase.from("likes").select("post_id, user_id, reaction_type").in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds),
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);

    const likesByPost  = new Map<string, any[]>();
    const countByPost  = new Map<string, number>();
    const commentCount = new Map<string, number>();
    const bookmarkSet  = new Set<string>();

    for (const l of (likesRes.data ?? []) as any[]) {
      likesByPost.set(l.post_id, [...(likesByPost.get(l.post_id) ?? []), l]);
      countByPost.set(l.post_id, (countByPost.get(l.post_id) ?? 0) + 1);
    }
    for (const c of (commentsRes.data ?? []) as any[]) {
      commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1);
    }
    for (const b of (bookmarksRes.data ?? []) as any[]) bookmarkSet.add(b.post_id);

    return (rawPosts as any[]).map((p: any) => {
      const myLike = (likesByPost.get(p.id) ?? []).find((l: any) => l.user_id === currentUserId);
      return {
        id: p.id, user_id: p.user_id, company_page_id: p.company_page_id,
        content: p.content, image_url: p.image_url, video_url: p.video_url, created_at: p.created_at,
        likes_count: countByPost.get(p.id) ?? 0,
        comments_count: commentCount.get(p.id) ?? 0,
        shares_count: p.shares_count ?? 0,
        is_liked: !!myLike, reaction_type: myLike?.reaction_type ?? null,
        is_bookmarked: bookmarkSet.has(p.id),
        author: profileMap.get(p.user_id) ?? null,
        company_page: p.company_page_id ? companyPage : null,
      };
    });
  } catch (e) {
    console.warn("fetchCompanyPostsWeb:", e);
    return [];
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppOpportunity {
  id: string;
  type: "marketplace" | "vaga";
  title: string;
  description?: string | null;
  category?: string | null;
  company?: string | null;
  location?: string | null;
  price?: string | null;
  salary?: string | null;
  contract_type?: string | null;
  contact_email?: string | null;
  expires_at?: string | null;
  created_at: string;
  created_by?: string | null;
  is_saved?: boolean;
  is_applied?: boolean;
  is_interested?: boolean;
  interests_count?: number;
  applications_count?: number;
  cover_image_url?: string | null;
  company_page_id?: string | null;
  company_page?: { id: string; owner_id?: string | null; name: string; avatar_url?: string | null } | null;
  creator?: { id: string; full_name: string; avatar_url?: string | null } | null;
  is_active?: boolean;
}

export interface AppEvent {
  id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  location_type?: "online" | "presencial";
  entry_type?: "gratuito" | "pago";
  cover_image_url?: string | null;
  max_attendees?: number | null;
  attendees_count?: number;
  is_registered?: boolean;
  created_by?: string | null;
  created_at: string;
  organizer?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

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
}

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

export interface MarketInfluencer {
  rank: number;
  name: string;
  handle: string;
  specialty: string;
  reach: string;
  engagement: string;
}

export interface MarketOverview {
  period: string;
  kpis: MarketKPI[];
  chart_area: {
    exports: number[];
    imports: number[];
    labels: string[];
    yLabels: string[];
    title?: string;
    subtitle?: string;
  };
  chart_bar: { values: number[]; labels: string[]; title?: string; subtitle?: string };
  tendencias: { title: string; desc: string; change: number; pos: boolean }[];
  regioes: { rank: number; name: string; volume: string; pct: number }[];
  variedades: { name: string; volume: string; change: number }[];
  influencers: MarketInfluencer[];
  updated_at: string;
}

// ─── Opportunities ────────────────────────────────────────────────────────────

export async function fetchOpportunities(
  type: "marketplace" | "vaga",
  userId: string
): Promise<AppOpportunity[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select(`
      id, type, title, description, category, company, company_page_id, location,
      price, salary, contract_type, contact_email, expires_at, created_at,
      created_by, interests_count, applications_count, cover_image_url
    `)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const items = data as AppOpportunity[];

  // Resolve company_page (id, name, avatar, owner) for items owned by a company page
  const companyPageIds = [
    ...new Set(items.map((i) => i.company_page_id).filter(Boolean) as string[]),
  ];
  let companyPageMap = new Map<string, { id: string; owner_id: string | null; name: string; avatar_url: string | null }>();
  if (companyPageIds.length > 0) {
    const { data: cpRows } = await supabase
      .from("company_pages")
      .select("id, owner_id, name, avatar_url")
      .in("id", companyPageIds);
    if (cpRows) {
      for (const r of cpRows as Array<{ id: string; owner_id: string | null; name: string; avatar_url: string | null }>) {
        companyPageMap.set(r.id, r);
      }
    }
  }

  const withCompany: AppOpportunity[] = items.map((i) => ({
    ...i,
    company_page: i.company_page_id ? (companyPageMap.get(i.company_page_id) ?? null) : null,
  }));

  if (!userId) return withCompany;

  const ids = withCompany.map((i) => i.id);
  type OppIdRow = { opportunity_id: string };
  const [appliedRes] = await Promise.all([
    type === "vaga"
      ? supabase
          .from("opportunity_applications")
          .select("opportunity_id")
          .eq("applicant_id", userId)
          .in("opportunity_id", ids)
      : Promise.resolve({ data: [] as OppIdRow[] }),
  ]);

  const appliedSet = new Set(((appliedRes.data ?? []) as OppIdRow[]).map((r) => r.opportunity_id));

  return withCompany.map((i) => ({
    ...i,
    is_applied: appliedSet.has(i.id),
  }));
}

export async function fetchOpportunityById(
  id: string,
  userId: string
): Promise<AppOpportunity | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select(`
      id, type, title, description, category, company, company_page_id, location,
      price, salary, contract_type, contact_email, expires_at, created_at,
      created_by, interests_count, applications_count, cover_image_url
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const rawItem = data as AppOpportunity;
  let result: AppOpportunity = { ...rawItem };

  if (result.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", result.created_by)
      .maybeSingle();
    result.creator = (profile as AppOpportunity["creator"]) ?? null;
  }

  if (result.company_page_id) {
    const { data: cp } = await supabase
      .from("company_pages")
      .select("id, owner_id, name, avatar_url")
      .eq("id", result.company_page_id)
      .maybeSingle();
    result.company_page = (cp as AppOpportunity["company_page"]) ?? null;
  }

  if (userId) {
    const [appliedRes, intRes] = await Promise.all([
      result.type === "vaga"
        ? supabase
            .from("opportunity_applications")
            .select("id")
            .eq("applicant_id", userId)
            .eq("opportunity_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      result.type !== "vaga"
        ? supabase
            .from("notifications")
            .select("id")
            .eq("type", "interest")
            .eq("opportunity_id", id)
            .eq("actor_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    result = {
      ...result,
      is_applied: !!appliedRes.data,
      is_interested: !!intRes.data,
    };
  }

  return result;
}

export async function createOpportunity(params: {
  type: "marketplace" | "vaga";
  title: string;
  description?: string | null;
  category?: string | null;
  company?: string | null;
  company_page_id?: string | null;
  location?: string | null;
  price?: string | null;
  salary?: string | null;
  contract_type?: string | null;
  contact_email?: string | null;
  expires_at?: string | null;
  cover_image_url?: string | null;
  created_by: string;
}): Promise<AppOpportunity | null> {
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin}/api`;
    const session = await getCachedSession();
    const token = session?.access_token;
    const res = await fetch(`${apiBase}/community/opportunities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) { console.error("createOpportunity:", res.status); return null; }
    const json = await res.json();
    return json.opportunity as AppOpportunity;
  } catch (e) {
    console.error("createOpportunity:", e);
    return null;
  }
}

export async function toggleSaveOpportunity(
  opportunityId: string,
  userId: string,
  wasSaved: boolean
): Promise<void> {
  if (wasSaved) {
    await supabase
      .from("saved_opportunities")
      .delete()
      .eq("user_id", userId)
      .eq("opportunity_id", opportunityId);
  } else {
    await supabase
      .from("saved_opportunities")
      .insert({ user_id: userId, opportunity_id: opportunityId });
  }
}

export const CV_STORAGE_PREFIX = "cvs://";

export async function uploadCV(file: File, userId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `cvs/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cvs").upload(path, file, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });
    if (error) { console.error("uploadCV:", error); return null; }
    return `${CV_STORAGE_PREFIX}${path}`;
  } catch (e) {
    console.error("uploadCV:", e);
    return null;
  }
}

export async function getCvSignedUrl(
  cvValue: string,
  opts?: { applicationId?: string },
): Promise<string | null> {
  if (!cvValue.startsWith(CV_STORAGE_PREFIX)) {
    return cvValue;
  }
  const storagePath = cvValue.slice(CV_STORAGE_PREFIX.length);

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
    ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

  const sessionData = await getCachedSession();
  const token = sessionData?.access_token ?? "";

  try {
    const res = await fetch(`${apiBase}/cv/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: storagePath, application_id: opts?.applicationId }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { signedUrl?: string };
    return json.signedUrl ?? null;
  } catch (e) {
    console.error("getCvSignedUrl:", e);
    return null;
  }
}

export async function updateOpportunity(
  id: string,
  fields: Partial<Pick<AppOpportunity,
    | "title" | "description" | "category" | "company" | "location"
    | "price" | "salary" | "contract_type" | "contact_email" | "expires_at"
  >>,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("opportunities").update(fields).eq("id", id);
    if (error) { console.error("updateOpportunity:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateOpportunity:", e);
    return false;
  }
}

export interface CompanyAdminOpportunity extends AppOpportunity {
  view_count?: number;
  sold?: boolean;
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

/** ADMIN view — includes inactive items and personal items by the owner.
 *  Use fetchPublicCompanyOpportunities on public profile pages.
 */
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
        view_count, sold, company_page_id
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

/** Active vagas/marketplace items linked to a company page or created by the owner.
 *  Safe for public company profile listings. Pass ownerId to also catch items
 *  created directly by the owner without a company_page_id.
 */
export async function fetchPublicCompanyOpportunities(
  companyPageId: string,
  type: "vaga" | "marketplace",
  ownerId?: string,
): Promise<CompanyAdminOpportunity[]> {
  try {
    let query = supabase
      .from("opportunities")
      .select(`
        id, created_by, type, title, description, category, location, price,
        cover_image_url, company, contract_type, salary, contact_email,
        expires_at, is_active, created_at,
        interests_count, applications_count,
        view_count, sold, company_page_id
      `)
      .eq("type", type)
      .eq("is_active", true);

    if (ownerId) {
      query = query.or(`company_page_id.eq.${companyPageId},created_by.eq.${ownerId}`);
    } else {
      query = query.eq("company_page_id", companyPageId);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
    if (error) { console.error("fetchPublicCompanyOpportunities:", error); return []; }
    return (data ?? []) as CompanyAdminOpportunity[];
  } catch (e) {
    console.error("fetchPublicCompanyOpportunities:", e);
    return [];
  }
}

export async function fetchUserOpportunities(
  userId: string,
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
        view_count, sold, company_page_id
      `)
      .eq("created_by", userId)
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("fetchUserOpportunities:", error); return []; }
    return (data ?? []) as CompanyAdminOpportunity[];
  } catch (e) {
    console.error("fetchUserOpportunities:", e);
    return [];
  }
}

export async function fetchOpportunityApplicants(
  opportunityId: string,
): Promise<CompanyAdminApplicant[]> {
  try {
    const { data: apps, error } = await supabase
      .from("opportunity_applications")
      .select("id, applicant_id, cv_url, message, status, created_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchOpportunityApplicants:", error); return []; }
    if (!apps?.length) return [];
    const ids = [...new Set(apps.map((a: any) => a.applicant_id as string))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, headline, username")
      .in("id", ids);
    const map = new Map<string, any>();
    (profs ?? []).forEach((p: any) => map.set(p.id, p));
    return apps.map((a: any) => {
      const p = map.get(a.applicant_id) ?? {};
      return {
        id: a.id,
        applicant_id: a.applicant_id,
        cv_url: a.cv_url,
        message: a.message,
        status: a.status,
        created_at: a.created_at,
        full_name: p.full_name ?? null,
        avatar_url: p.avatar_url ?? null,
        headline: p.headline ?? null,
        username: p.username ?? null,
      };
    });
  } catch (e) {
    console.error("fetchOpportunityApplicants:", e);
    return [];
  }
}

export async function updateApplicantStatus(
  applicationId: string,
  status: CompanyAdminApplicant["status"],
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("opportunity_applications")
      .update({ status })
      .eq("id", applicationId);
    if (error) { console.error("updateApplicantStatus:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateApplicantStatus:", e);
    return false;
  }
}

export async function applyToJob(
  opportunityId: string,
  _userId: string,
  cvUrl: string | null,
  message: string | null
): Promise<boolean> {
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin}/api`;
    const session = await getCachedSession();
    const token = session?.access_token;
    const res = await fetch(`${apiBase}/community/opportunities/${opportunityId}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ cv_url: cvUrl, message }),
    });
    if (!res.ok) { console.error("applyToJob:", res.status); return false; }
    return true;
  } catch (e) {
    console.error("applyToJob:", e);
    return false;
  }
}

export async function expressInterest(
  opportunityId: string,
  _userId: string
): Promise<boolean> {
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin}/api`;
    const session = await getCachedSession();
    const token = session?.access_token;
    const res = await fetch(`${apiBase}/community/opportunities/${opportunityId}/interest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) { console.error("expressInterest:", res.status); return false; }
    return true;
  } catch (e) {
    console.error("expressInterest:", e);
    return false;
  }
}

export async function trackOpportunityView(opportunityId: string): Promise<void> {
  try { await supabase.rpc("increment_opportunity_views", { opp_id: opportunityId }); } catch {}
}

// ─── Events ───────────────────────────────────────────────────────────────────

type EventDbRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  location_type: AppEvent["location_type"];
  entry_type: AppEvent["entry_type"];
  image_url: string | null;
  capacity: number | null;
  attendees_count: number | null;
  created_at: string;
};

const EVENT_COLUMNS =
  "id, user_id, title, description, start_date, end_date, location, location_type, entry_type, image_url, capacity, attendees_count, created_at";

function mapEventRow(row: EventDbRow): AppEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    location: row.location,
    location_type: row.location_type,
    entry_type: row.entry_type,
    cover_image_url: row.image_url,
    max_attendees: row.capacity,
    attendees_count: row.attendees_count ?? 0,
    created_by: row.user_id,
    created_at: row.created_at,
  };
}

export async function fetchEvents(userId: string): Promise<AppEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("is_active", true)
    .order("start_date", { ascending: true })
    .limit(100);

  if (error || !data) return [];

  const items = (data as EventDbRow[]).map(mapEventRow);

  if (userId && items.length > 0) {
    const ids = items.map((i) => i.id);
    type EventIdRow = { event_id: string };
    const { data: regData } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", userId)
      .in("event_id", ids);
    const regSet = new Set(((regData ?? []) as EventIdRow[]).map((r) => r.event_id));
    return items.map((i) => ({ ...i, is_registered: regSet.has(i.id) }));
  }

  return items;
}

export async function fetchEventById(id: string, userId: string): Promise<AppEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  let result: AppEvent = mapEventRow(data as EventDbRow);

  if (result.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", result.created_by)
      .maybeSingle();
    result.organizer = (profile as AppEvent["organizer"]) ?? null;
  }

  if (userId) {
    const { data: regData } = await supabase
      .from("event_attendees")
      .select("id")
      .eq("user_id", userId)
      .eq("event_id", id)
      .maybeSingle();
    result = { ...result, is_registered: !!regData };
  }

  return result;
}

export interface EventParticipant {
  id: string;
  user_id: string;
  registered_at: string;
  profile?: { full_name: string; avatar_url?: string | null; plan?: string | null } | null;
}

export async function fetchEventParticipants(eventId: string): Promise<EventParticipant[]> {
  const { data, error } = await supabase
    .from("event_attendees")
    .select("id, user_id, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !data) return [];

  type RegRow = { id: string; user_id: string; created_at: string };
  const rows = data as RegRow[];
  const userIds = rows.map((r) => r.user_id);

  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, plan")
    .in("id", userIds);

  type ProfileRow = { id: string; full_name: string; avatar_url?: string | null; plan?: string | null };
  const profileMap = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p])
  );

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    registered_at: r.created_at,
    profile: profileMap.get(r.user_id) ?? null,
  }));
}

export async function registerForEvent(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("event_attendees")
    .upsert(
      { event_id: eventId, user_id: userId, status: "confirmed" },
      { onConflict: "event_id,user_id" },
    );
  return !error;
}

export async function unregisterFromEvent(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("event_attendees")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  return !error;
}

// ─── Wine Cellar ──────────────────────────────────────────────────────────────

export async function fetchWineCellar(userId: string): Promise<WineEntry[]> {
  const { data, error } = await supabase
    .from("wine_cellar")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as WineEntry[];
}

export async function fetchPublicWineCellar(userId: string): Promise<WineEntry[]> {
  const { data, error } = await supabase
    .from("wine_cellar")
    .select("*")
    .eq("user_id", userId)
    .eq("is_private", false)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as WineEntry[];
}

export async function addWineEntry(entry: Omit<WineEntry, "id" | "created_at">): Promise<WineEntry | null> {
  const { data, error } = await supabase
    .from("wine_cellar")
    .insert(entry)
    .select()
    .single();

  if (error || !data) return null;
  return data as WineEntry;
}

export async function updateWineEntry(
  id: string,
  patch: Partial<Omit<WineEntry, "id" | "created_at" | "user_id">>
): Promise<boolean> {
  const { error } = await supabase.from("wine_cellar").update(patch).eq("id", id);
  return !error;
}

export async function deleteWineEntry(id: string): Promise<boolean> {
  const { error } = await supabase.from("wine_cellar").delete().eq("id", id);
  return !error;
}

// ─── Market Overview (fallback data) ─────────────────────────────────────────

export type Period = "mes" | "trimestre" | "ano";

export const MARKET_FALLBACK: Record<Period, MarketOverview> = {
  mes: {
    period: "mes",
    kpis: [
      { label: "Exportações BR", value: "US$ 3.8M", period: "Mar/2026", change: 9.2, icon: "Globe", description: "Total exportado pelo Brasil em vinhos e derivados. Fonte: IBRAVIN / UVIBRA.", source: "IBRAVIN", updatedAt: "2026-04-01" },
      { label: "Importações de Vinho", value: "R$ 185M", period: "Mar/2026", change: 6.1, icon: "TrendingUp", description: "Total importado pelo Brasil em vinhos de mesa e espumantes. Fonte: SECEX/MDIC.", source: "SECEX/MDIC", updatedAt: "2026-04-01" },
      { label: "Produção Nacional", value: "29M litros", period: "Mar/2026", change: 3.5, icon: "BarChart2", description: "Volume total de uvas processadas no Brasil para vinhos. Fonte: IBRAVIN.", source: "IBRAVIN", updatedAt: "2026-04-01" },
    ],
    chart_area: { exports: [28, 30, 34, 38], imports: [68, 71, 77, 82], labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"], yLabels: ["0", "50", "100", "150", "200"] },
    chart_bar: { values: [78, 75, 83, 81], labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"] },
    tendencias: [
      { title: "Espumantes brasileiros em alta", desc: "Crescimento de 22% nas vendas de espumantes nacionais no mês de março.", change: 22, pos: true },
      { title: "Vinhos naturais ganham espaço", desc: "Segmento de vinhos naturais e orgânicos cresce 15% ao mês.", change: 15, pos: true },
      { title: "Importação de tintos chilenos recua", desc: "Queda de 3.2% nas importações de tintos do Chile.", change: -3.2, pos: false },
    ],
    regioes: [
      { rank: 1, name: "Serra Gaúcha", volume: "15M litros", pct: 51 },
      { rank: 2, name: "Campanha Gaúcha", volume: "4M litros", pct: 13 },
      { rank: 3, name: "Vale do São Francisco", volume: "3M litros", pct: 11 },
      { rank: 4, name: "Planalto Catarinense", volume: "2M litros", pct: 6 },
    ],
    variedades: [
      { name: "Merlot", volume: "3.5M litros", change: 5.1 },
      { name: "Cabernet Sauvignon", volume: "3.2M litros", change: 3.8 },
      { name: "Chardonnay", volume: "2.3M litros", change: 9.2 },
      { name: "Pinot Noir", volume: "1.5M litros", change: 2.1 },
    ],
    influencers: [
      { rank: 1, name: "Ana Carvalho", handle: "@anavinhos", specialty: "Espumantes nacionais", reach: "82K seguidores", engagement: "6.3%" },
      { rank: 2, name: "Pedro Almada", handle: "@pedrosomelier", specialty: "Tintos clássicos", reach: "61K seguidores", engagement: "5.1%" },
      { rank: 3, name: "Júlia Ferreira", handle: "@vinhoejornal", specialty: "Jornalismo vínico", reach: "44K seguidores", engagement: "4.7%" },
      { rank: 4, name: "Marcos Vinícius", handle: "@mvwine", specialty: "Importados premium", reach: "37K seguidores", engagement: "3.9%" },
    ],
    updated_at: "",
  },
  trimestre: {
    period: "trimestre",
    kpis: [
      { label: "Exportações BR", value: "US$ 11.2M", period: "Q1 2026", change: 10.8, icon: "Globe", description: "Total exportado pelo Brasil em vinhos e derivados.", source: "IBRAVIN", updatedAt: "2026-04-01" },
      { label: "Importações de Vinho", value: "R$ 540M", period: "Q1 2026", change: 7.4, icon: "TrendingUp", description: "Total importado pelo Brasil em vinhos de mesa e espumantes.", source: "SECEX/MDIC", updatedAt: "2026-04-01" },
      { label: "Produção Nacional", value: "88M litros", period: "Q1 2026", change: 4.1, icon: "BarChart2", description: "Volume total de uvas processadas no Brasil para vinhos.", source: "IBRAVIN", updatedAt: "2026-04-01" },
    ],
    chart_area: { exports: [30, 34, 38], imports: [70, 76, 84], labels: ["Jan", "Fev", "Mar"], yLabels: ["0", "150", "300", "450", "600"] },
    chart_bar: { values: [78, 82, 85], labels: ["Jan", "Fev", "Mar"] },
    tendencias: [
      { title: "Espumantes brasileiros em alta", desc: "Crescimento de 18% nas vendas de espumantes nacionais no Q1 2026.", change: 18, pos: true },
      { title: "Vinhos naturais ganham espaço", desc: "Segmento de vinhos naturais e orgânicos cresce 12% no trimestre.", change: 12, pos: true },
      { title: "Importação de tintos chilenos recua", desc: "Queda de 4.1% nas importações de tintos do Chile no Q1.", change: -4.1, pos: false },
    ],
    regioes: [
      { rank: 1, name: "Serra Gaúcha", volume: "45M litros", pct: 51 },
      { rank: 2, name: "Campanha Gaúcha", volume: "12M litros", pct: 13 },
      { rank: 3, name: "Vale do São Francisco", volume: "10M litros", pct: 11 },
      { rank: 4, name: "Planalto Catarinense", volume: "5M litros", pct: 6 },
    ],
    variedades: [
      { name: "Merlot", volume: "10.5M litros", change: 4.8 },
      { name: "Cabernet Sauvignon", volume: "9.5M litros", change: 3.5 },
      { name: "Chardonnay", volume: "7M litros", change: 8.9 },
      { name: "Pinot Noir", volume: "4.5M litros", change: 1.9 },
    ],
    influencers: [
      { rank: 1, name: "Ana Carvalho", handle: "@anavinhos", specialty: "Espumantes nacionais", reach: "84K seguidores", engagement: "6.5%" },
      { rank: 2, name: "Pedro Almada", handle: "@pedrosomelier", specialty: "Tintos clássicos", reach: "63K seguidores", engagement: "5.2%" },
      { rank: 3, name: "Júlia Ferreira", handle: "@vinhoejornal", specialty: "Jornalismo vínico", reach: "45K seguidores", engagement: "4.8%" },
      { rank: 4, name: "Marcos Vinícius", handle: "@mvwine", specialty: "Importados premium", reach: "38K seguidores", engagement: "4.0%" },
    ],
    updated_at: "",
  },
  ano: {
    period: "ano",
    kpis: [
      { label: "Exportações BR", value: "US$ 42M", period: "2025", change: 12.5, icon: "Globe", description: "Total exportado pelo Brasil em vinhos e derivados.", source: "IBRAVIN", updatedAt: "2026-04-01" },
      { label: "Importações de Vinho", value: "R$ 2.1B", period: "2025", change: 8.3, icon: "TrendingUp", description: "Total importado pelo Brasil em vinhos de mesa e espumantes.", source: "SECEX/MDIC", updatedAt: "2026-04-01" },
      { label: "Produção Nacional", value: "350M litros", period: "2025", change: 4.7, icon: "BarChart2", description: "Volume total de uvas processadas no Brasil para vinhos.", source: "IBRAVIN", updatedAt: "2026-04-01" },
    ],
    chart_area: { exports: [32, 35, 38, 44], imports: [72, 79, 86, 91], labels: ["Q1", "Q2", "Q3", "Q4"], yLabels: ["0", "150", "300", "450", "600"] },
    chart_bar: { values: [75, 80, 85, 87], labels: ["Q1", "Q2", "Q3", "Q4"] },
    tendencias: [
      { title: "Espumantes brasileiros em alta", desc: "Crescimento de 22% nas vendas de espumantes nacionais em 2025, com destaque para a Serra Gaúcha.", change: 22, pos: true },
      { title: "Vinhos naturais ganham espaço", desc: "Segmento de vinhos naturais e orgânicos cresceu 15% ao ano, impulsionado por consumidores jovens.", change: 15, pos: true },
      { title: "Importação de tintos chilenos recua", desc: "Queda de 3.2% nas importações de tintos do Chile em 2025 em relação ao ano anterior.", change: -3.2, pos: false },
    ],
    regioes: [
      { rank: 1, name: "Serra Gaúcha", volume: "180M litros", pct: 51 },
      { rank: 2, name: "Campanha Gaúcha", volume: "45M litros", pct: 13 },
      { rank: 3, name: "Vale do São Francisco", volume: "38M litros", pct: 11 },
      { rank: 4, name: "Planalto Catarinense", volume: "22M litros", pct: 6 },
    ],
    variedades: [
      { name: "Merlot", volume: "42M litros", change: 5.1 },
      { name: "Cabernet Sauvignon", volume: "38M litros", change: 3.8 },
      { name: "Chardonnay", volume: "28M litros", change: 9.2 },
      { name: "Pinot Noir", volume: "18M litros", change: 2.1 },
    ],
    influencers: [
      { rank: 1, name: "Ana Carvalho", handle: "@anavinhos", specialty: "Espumantes nacionais", reach: "89K seguidores", engagement: "6.8%" },
      { rank: 2, name: "Pedro Almada", handle: "@pedrosomelier", specialty: "Tintos clássicos", reach: "67K seguidores", engagement: "5.4%" },
      { rank: 3, name: "Júlia Ferreira", handle: "@vinhoejornal", specialty: "Jornalismo vínico", reach: "48K seguidores", engagement: "5.0%" },
      { rank: 4, name: "Marcos Vinícius", handle: "@mvwine", specialty: "Importados premium", reach: "41K seguidores", engagement: "4.2%" },
      { rank: 5, name: "Renata Souza", handle: "@renatacava", specialty: "Espumantes e espanhóis", reach: "35K seguidores", engagement: "3.8%" },
    ],
    updated_at: "",
  },
};

export async function fetchMarketOverview(period: Period): Promise<MarketOverview> {
  try {
    const { data, error } = await supabase
      .from("market_overview")
      .select("*")
      .eq("period", period)
      .single();
    if (error || !data) return MARKET_FALLBACK[period];
    return data as unknown as MarketOverview;
  } catch {
    return MARKET_FALLBACK[period];
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

export async function fetchGroups(
  userId: string,
  activeCompanyId?: string | null,
): Promise<{ mine: Group[]; explore: Group[] }> {
  try {
    // Scope memberships to the active identity. NULL company_page_id = personal,
    // a UUID = that specific company. Mirrors mobile behavior (v56 migration).
    const membershipsQuery = activeCompanyId
      ? supabase.from("group_members").select("group_id, role").eq("user_id", userId).eq("company_page_id", activeCompanyId)
      : supabase.from("group_members").select("group_id, role").eq("user_id", userId).is("company_page_id", null);

    const [groupsRes, membershipsRes] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      membershipsQuery,
    ]);

    if (groupsRes.error) throw groupsRes.error;

    const membershipMap = new Map<string, string>(
      (membershipsRes.data ?? []).map((m: any) => [m.group_id, m.role])
    );

    // Fetch member counts (excluding pending requests so the badge matches mobile)
    const groups = (groupsRes.data ?? []) as any[];
    const countResults = await Promise.all(
      groups.map(g =>
        supabase
          .from("group_members")
          .select("user_id", { count: "exact", head: true })
          .eq("group_id", g.id)
          .neq("role", "pending")
      )
    );

    const enriched: Group[] = groups.map((g, i) => {
      const role = membershipMap.get(g.id);
      return {
        ...g,
        member_count: countResults[i].count ?? 0,
        is_member: role !== undefined && role !== "pending",
        is_owner:  g.owner_id === userId,
      };
    });

    const mine    = enriched.filter(g => g.is_member);
    // Hide "restrito" groups from explore — only members ever see them
    const explore = enriched.filter(g => !g.is_member && g.access !== "restrito");
    return { mine, explore };
  } catch (e) {
    console.warn("fetchGroups:", e);
    return { mine: [], explore: [] };
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
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin}/api`;
    const session = await getCachedSession();
    const token = session?.access_token;
    const res = await fetch(`${apiBase}/community/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) { console.warn("createGroup:", res.status); return null; }
    const json = await res.json();
    return json.group as Group;
  } catch (e) {
    console.warn("createGroup:", e);
    return null;
  }
}

export async function joinGroup(
  groupId: string,
  userId: string,
  companyPageId?: string | null,
): Promise<boolean> {
  try {
    const cpId = companyPageId ?? null;
    const [{ error: gmErr }, { error: cpErr }] = await Promise.all([
      supabase.from("group_members").insert({ group_id: groupId, user_id: userId, role: "member", company_page_id: cpId }),
      supabase.from("conversation_participants").upsert(
        { conversation_id: groupId, user_id: userId, company_page_id: cpId },
        { onConflict: "conversation_id,user_id,company_page_id", ignoreDuplicates: true }
      ),
    ]);
    if (cpErr) console.warn("joinGroup conversation_participants:", cpErr);
    return !gmErr;
  } catch {
    return false;
  }
}

export async function leaveGroup(
  groupId: string,
  userId: string,
  companyPageId?: string | null,
): Promise<boolean> {
  try {
    const cpId = companyPageId ?? null;
    // Delete only the identity-specific row, not ALL memberships of this user.
    let gmQ = supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    let cpQ = supabase.from("conversation_participants").delete().eq("conversation_id", groupId).eq("user_id", userId);
    if (cpId) {
      gmQ = gmQ.eq("company_page_id", cpId);
      cpQ = cpQ.eq("company_page_id", cpId);
    } else {
      gmQ = gmQ.is("company_page_id", null);
      cpQ = cpQ.is("company_page_id", null);
    }
    const [{ error: gmErr }, { error: cpErr }] = await Promise.all([gmQ, cpQ]);
    if (gmErr) console.warn("leaveGroup group_members:", gmErr);
    if (cpErr) console.warn("leaveGroup conversation_participants:", cpErr);
    return !gmErr;
  } catch {
    return false;
  }
}

// ─── Ideal.BI Market Feed ───────────────────────────────────────────────────

export interface MarketPollOption {
  id: string;
  text: string;
  votes_count: number;
}

export type MarketReactionType = "saude" | "bravo" | "destaque" | "incrivel";

export interface MarketPost {
  id: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  company_page_id?: string | null;
  poll_options?: MarketPollOption[] | null;
  created_at: string;
  author_id: string;
  likes_count: number;
  comments_count: number;
  poll_allow_multiple?: boolean;
  user_liked: boolean;
  user_reaction?: MarketReactionType | null;
  user_poll_votes?: string[] | null;
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
  likes_count: number;
  is_liked: boolean;
  author?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    position?: string | null;
    company?: string | null;
  };
}

export async function fetchMarketPosts(userId?: string): Promise<MarketPost[]> {
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin}/api`;
    const session = await getCachedSession();
    const token = session?.access_token;
    const res = await fetch(`${apiBase}/market/posts?limit=30`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data: any[] = json.posts ?? [];
    if (data.length === 0) return [];

    // All market posts belong to the Ideal.BI company page (stored as company_page_id in DB).
    const companyPageIds = [...new Set(data.map((p: any) => p.company_page_id).filter(Boolean))];

    const [likesRes, votesRes, companyRes] = await Promise.all([
      userId
        ? supabase.from("market_post_likes").select("post_id, reaction_type").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      userId
        ? supabase.from("market_post_poll_votes").select("post_id, option_id").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      companyPageIds.length > 0
        ? supabase.from("company_pages").select("id, name, avatar_url").in("id", companyPageIds)
        : supabase.from("company_pages").select("id, name, avatar_url").ilike("name", "Ideal.BI").maybeSingle(),
    ]);

    const likedData: { post_id: string; reaction_type?: string | null }[] = (likesRes as any).data ?? [];
    const likedSet = new Set(likedData.map(l => l.post_id));
    const reactionMap = new Map(likedData.map(l => [l.post_id, (l.reaction_type ?? null) as MarketReactionType | null]));
    const pollVoteMap = new Map<string, string[]>();
    for (const v of ((votesRes as any).data ?? [])) {
      const arr = pollVoteMap.get(v.post_id as string) ?? [];
      arr.push(v.option_id as string);
      pollVoteMap.set(v.post_id as string, arr);
    }

    const companyMap = new Map<string, { id: string; name: string; avatar_url: string | null }>();
    const companyData = (companyRes as any).data;
    if (Array.isArray(companyData)) {
      for (const c of companyData) companyMap.set(c.id, c);
    } else if (companyData?.id) {
      companyMap.set(companyData.id, companyData);
    }

    // All posts in this feed are from Ideal.BI — use any resolved company as the
    // universal author, including for posts where company_page_id is still null.
    const idealbiCompany = [...companyMap.values()][0] ?? null;
    const universalAuthor = idealbiCompany
      ? { id: idealbiCompany.id, full_name: idealbiCompany.name, avatar_url: idealbiCompany.avatar_url, headline: "Inteligência de Mercado do Vinho" }
      : { id: "idealbi", full_name: "Ideal.BI", avatar_url: null, headline: "Inteligência de Mercado do Vinho" };

    return data.map((p: any) => {
      const company = p.company_page_id ? (companyMap.get(p.company_page_id) ?? idealbiCompany) : idealbiCompany;
      const author = company
        ? { id: company.id, full_name: company.name, avatar_url: company.avatar_url, headline: "Inteligência de Mercado do Vinho" }
        : universalAuthor;
      const votes = pollVoteMap.get(p.id);
      return { ...p, user_liked: likedSet.has(p.id), user_reaction: reactionMap.get(p.id) ?? null, user_poll_votes: votes?.length ? votes : null, poll_allow_multiple: (p as any).poll_allow_multiple ?? false, author };
    });
  } catch {
    return [];
  }
}

export async function createMarketPost(
  authorId: string,
  content: string,
  imageUrl?: string | null,
  videoUrl?: string | null,
  pollOptions?: MarketPollOption[] | null,
): Promise<MarketPost | null> {
  try {
    const session = await getCachedSession();
    if (!session?.access_token) return null;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;
    const res = await fetch(`${apiBase}/market/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        image_url: imageUrl ?? null,
        video_url: videoUrl ?? null,
        poll_options: pollOptions && pollOptions.length > 0 ? pollOptions : null,
      }),
    });
    if (!res.ok) return null;
    const body = await res.json() as { post: MarketPost };
    const newPost = body.post;

    // Resolve the Ideal.BI company page so the card shows the correct avatar immediately.
    let author: MarketPost["author"];
    try {
      const companyQuery = newPost.company_page_id
        ? supabase.from("company_pages").select("id, name, avatar_url").eq("id", newPost.company_page_id).maybeSingle()
        : supabase.from("company_pages").select("id, name, avatar_url").ilike("name", "Ideal.BI").order("created_at", { ascending: true }).limit(1).maybeSingle();
      const { data: company } = await companyQuery;
      if (company) {
        author = { id: (company as any).id, full_name: (company as any).name, avatar_url: (company as any).avatar_url, headline: "Inteligência de Mercado do Vinho" };
      }
    } catch { /* keep author undefined */ }

    return { ...newPost, user_liked: false, user_poll_votes: null, poll_allow_multiple: false, author };
  } catch {
    return null;
  }
}

export async function voteOnMarketPoll(
  postId: string,
  _userId: string,
  optionId: string,
): Promise<{ poll_options: MarketPollOption[]; user_poll_votes: string[] } | null> {
  try {
    const session = await getCachedSession();
    if (!session?.access_token) return null;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? (window.location.origin.replace(/:\d+$/, "") + "/api");
    const res = await fetch(`${apiBase}/market-posts/${postId}/poll/vote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { poll_options: MarketPollOption[]; user_poll_votes: string[] };
    return { poll_options: json.poll_options, user_poll_votes: json.user_poll_votes ?? [] };
  } catch {
    return null;
  }
}

async function getWebApiBase(): Promise<{ apiBase: string; token: string | null }> {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
    ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;
  const { data: { session } } = await supabase.auth.getSession();
  return { apiBase, token: session?.access_token ?? null };
}

export async function toggleMarketPostLike(postId: string, _userId: string, currentlyLiked: boolean, reaction: MarketReactionType = "saude"): Promise<boolean> {
  try {
    const { apiBase, token } = await getWebApiBase();
    if (!token) return currentlyLiked;
    const res = await fetch(`${apiBase}/market/posts/${postId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reaction_type: currentlyLiked ? reaction : reaction }),
    });
    if (!res.ok) return currentlyLiked;
    const json = await res.json() as { user_liked: boolean };
    return json.user_liked;
  } catch {
    return currentlyLiked;
  }
}

export async function changeMarketReaction(postId: string, _userId: string, reaction: MarketReactionType): Promise<boolean> {
  try {
    const { apiBase, token } = await getWebApiBase();
    if (!token) return false;
    const res = await fetch(`${apiBase}/market/posts/${postId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reaction_type: reaction }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function toggleMarketCommentLike(commentId: string, _userId: string, currentlyLiked: boolean): Promise<boolean> {
  try {
    const { apiBase, token } = await getWebApiBase();
    if (!token) return currentlyLiked;
    const res = await fetch(`${apiBase}/market/comments/${commentId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return currentlyLiked;
    const json = await res.json() as { is_liked: boolean };
    return json.is_liked;
  } catch {
    return currentlyLiked;
  }
}

export async function fetchMarketComments(postId: string, userId?: string): Promise<MarketComment[]> {
  try {
    const { data, error } = await supabase
      .from("market_post_comments")
      .select("id, post_id, author_id, content, created_at, likes_count")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];

    const authorIds = [...new Set(data.map((c: any) => c.author_id))];
    const commentIds = data.map((c: any) => c.id);

    const [profilesByUserId, profilesById, likesRes] = await Promise.all([
      authorIds.length > 0
        ? supabase.from("profiles").select("id, user_id, full_name, avatar_url, headline").in("user_id", authorIds)
        : Promise.resolve({ data: [] }),
      authorIds.length > 0
        ? supabase.from("profiles").select("id, user_id, full_name, avatar_url, headline").in("id", authorIds)
        : Promise.resolve({ data: [] }),
      userId && commentIds.length > 0
        ? supabase.from("market_comment_likes").select("comment_id").eq("user_id", userId).in("comment_id", commentIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build map keyed by user_id first, then overlay by profiles.id as fallback
    // (some older comments stored profiles.id in author_id instead of auth user_id)
    const profileMap = new Map<string, any>();
    for (const p of ((profilesByUserId as any).data ?? [])) profileMap.set(p.user_id, p);
    for (const p of ((profilesById as any).data ?? [])) {
      if (!profileMap.has(p.id)) profileMap.set(p.id, p);
    }
    const likedSet = new Set(((likesRes as any).data ?? []).map((l: any) => l.comment_id as string));

    return data.map((c: any) => {
      const profile = profileMap.get(c.author_id);
      return {
        ...c,
        likes_count: c.likes_count ?? 0,
        is_liked: likedSet.has(c.id),
        author: profile ? {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          position: profile.headline ?? null,
          company: null,
        } : null,
      };
    });
  } catch {
    return [];
  }
}

export async function addMarketComment(postId: string, _authorId: string, content: string): Promise<MarketComment | null> {
  try {
    const { apiBase, token } = await getWebApiBase();
    if (!token) return null;
    const res = await fetch(`${apiBase}/market/posts/${postId}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { comment: MarketComment };
    return json.comment ?? null;
  } catch {
    return null;
  }
}

export async function fetchCompanyPageByName(name: string): Promise<{ id: string; name: string; avatar_url: string | null } | null> {
  try {
    const { data } = await supabase
      .from("company_pages")
      .select("id, name, avatar_url")
      .ilike("name", `%${name}%`)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function uploadMarketPostImage(file: File, userId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `market/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type, upsert: true });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  } catch {
    return null;
  }
}

export async function uploadMarketPostVideo(file: File, userId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `market/video/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type, upsert: true });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  } catch {
    return null;
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

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface WebNotification {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: string;
  post_id?: string | null;
  comment_id?: string | null;
  message?: string | null;
  read: boolean;
  created_at: string;
  /** When set, the notification belongs to this company's inbox; the
   *  personal feed must filter these out. */
  target_company_id?: string | null;
  actor?: { id: string; full_name: string; avatar_url?: string | null } | null;
  connection_id?: string | null;
  connection_status?: "pending" | "accepted" | "rejected" | null;
  /** Set when the referenced post is a wine review; the notifications page
   *  uses this to show "curtiu sua avaliação do <wine>" instead of the
   *  generic "publicação" wording. */
  wine_name?: string | null;
}

/**
 * Fetch notifications scoped to the user's currently-active identity.
 * - Personal mode (`activeCompanyId == null`): only notifications with
 *   `target_company_id IS NULL` (so company-targeted notifications such as
 *   job applications and marketplace inquiries do NOT leak into the
 *   personal inbox).
 * - Company mode (`activeCompanyId == <uuid>`): only notifications targeted
 *   to that company (`target_company_id = activeCompanyId`).
 */
export async function fetchWebNotifications(
  userId: string,
  activeCompanyId?: string | null,
): Promise<WebNotification[]> {
  try {
    let query = supabase
      .from("notifications")
      .select("id, user_id, actor_id, type, post_id, comment_id, message, read, created_at, target_company_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (activeCompanyId) {
      query = query.eq("target_company_id", activeCompanyId);
    } else {
      query = query.is("target_company_id", null);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const actorIds = [...new Set((data as any[]).filter(n => n.actor_id).map((n: any) => n.actor_id as string))];
    const postIds  = [...new Set((data as any[]).filter(n => n.post_id).map((n: any) => n.post_id as string))];

    let actorMap: Map<string, { id: string; full_name: string; avatar_url?: string | null }> = new Map();
    const wineNameMap = new Map<string, string>();

    const tasks: Promise<void>[] = [];
    if (actorIds.length > 0) {
      tasks.push((async () => {
        const { data: actors } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", actorIds);
        if (actors) for (const a of actors as any[]) actorMap.set(a.id, a);
      })());
    }
    if (postIds.length > 0) {
      // Fetch the source post content so the row can show the wine name
      // when the referenced post is a wine review.
      tasks.push((async () => {
        const { data: posts } = await supabase.from("posts").select("id, content").in("id", postIds);
        if (posts) {
          for (const p of posts as Array<{ id: string; content: string | null }>) {
            const name = extractWineName(p.content);
            if (name) wineNameMap.set(p.id, name);
          }
        }
      })());
    }
    await Promise.all(tasks);

    return (data as any[]).map(n => ({
      ...n,
      actor: n.actor_id ? (actorMap.get(n.actor_id) ?? null) : null,
      wine_name: n.post_id ? (wineNameMap.get(n.post_id) ?? null) : null,
    })) as WebNotification[];
  } catch (e) {
    console.warn("fetchWebNotifications:", e);
    return [];
  }
}

export async function markWebNotificationRead(notifId: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", notifId);
}

/**
 * Mark all unread notifications as read, scoped to the active identity so
 * the personal "mark all" doesn't accidentally clear company notifications
 * the user hasn't seen yet (and vice versa).
 */
export async function markAllWebNotificationsRead(
  userId: string,
  activeCompanyId?: string | null,
): Promise<void> {
  let q = supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  if (activeCompanyId) q = q.eq("target_company_id", activeCompanyId);
  else                 q = q.is("target_company_id", null);
  await q;
}

export async function acceptWebConnectionRequest(connectionId: string): Promise<boolean> {
  try {
    const { data: connRow, error: fetchErr } = await supabase
      .from("connections")
      .select("requester_id, receiver_id")
      .eq("id", connectionId)
      .single();
    if (fetchErr || !connRow) return false;

    const { error } = await supabase.from("connections").update({ status: "accepted" }).eq("id", connectionId);
    if (error) return false;

    // Auto-follow the requester when accepting a connection (receiver follows requester)
    await supabase.from("follows").upsert(
      { follower_id: (connRow as any).receiver_id, following_id: (connRow as any).requester_id },
      { onConflict: "follower_id,following_id" },
    );

    return true;
  } catch { return false; }
}

export async function rejectWebConnectionRequest(connectionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("connections").update({ status: "rejected" }).eq("id", connectionId);
    return !error;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════
// USER SEARCH
// ═══════════════════════════════════════════════════════════════════════════

export interface WebSearchProfile {
  id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
  plan?: string | null;
  profile_type?: string | null;
}

export async function searchWebProfiles(query: string, currentUserId: string, limit = 20): Promise<WebSearchProfile[]> {
  if (!query.trim()) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, position, company, plan, profile_type")
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

// ═══════════════════════════════════════════════════════════════════════════
// GROUP CHAT INFO
// ═══════════════════════════════════════════════════════════════════════════

export interface WebGroupInfo {
  id: string;
  name: string | null;
  member_count: number;
}

// ─── Post Detail + Comments ──────────────────────────────────────────────────

export interface AppComment {
  id: string;
  post_id: string;
  parent_comment_id?: string | null;
  user_id: string;
  content: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
  author?: { id: string; full_name: string; avatar_url?: string | null } | null;
  replies?: AppComment[];
}

export async function fetchPostById(postId: string, currentUserId?: string, companyPageId?: string | null): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`${POST_SELECT}`)
      .eq("id", postId)
      .maybeSingle();
    if (error || !data) return null;
    const profileMap = await _fetchProfilesMap([data.user_id]);
    const post = _normalisePost(data, profileMap);
    if (post.poll && currentUserId) {
      const indices = normalizePollIndices(post.poll.user_votes, currentUserId);
      post.poll = { ...post.poll, user_voted_indices: indices, user_voted_index: indices[0] ?? null };
    }
    if (currentUserId) {
      const likeQuery = companyPageId
        ? supabase.from("likes").select("reaction_type").eq("post_id", postId).eq("company_page_id", companyPageId).maybeSingle()
        : supabase.from("likes").select("reaction_type").eq("post_id", postId).eq("user_id", currentUserId).is("company_page_id", null).maybeSingle();
      const [likeRes, bookRes] = await Promise.all([
        likeQuery,
        supabase.from("bookmarks").select("post_id").eq("post_id", postId).eq("user_id", currentUserId).maybeSingle(),
      ]);
      return { ...post, is_liked: !!likeRes.data, reaction_type: (likeRes.data as any)?.reaction_type ?? null, is_bookmarked: !!bookRes.data };
    }
    return post;
  } catch (e) {
    console.warn("fetchPostById:", e);
    return null;
  }
}

export async function fetchPostComments(postId: string, currentUserId?: string): Promise<AppComment[]> {
  try {
    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, parent_comment_id, user_id, content, created_at, likes_count")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error || !data || data.length === 0) return [];
    const userIds = [...new Set((data as any[]).map((c: any) => c.user_id).filter(Boolean))];
    const profileMap = await _fetchProfilesMap(userIds);
    let likedSet = new Set<string>();
    if (currentUserId) {
      const { data: likes } = await supabase.from("comment_likes").select("comment_id").eq("user_id", currentUserId).in("comment_id", (data as any[]).map((c: any) => c.id));
      likedSet = new Set((likes ?? []).map((l: any) => l.comment_id));
    }
    const flat: AppComment[] = (data as any[]).map((c: any) => {
      const p = profileMap.get(c.user_id);
      return { ...c, likes_count: c.likes_count ?? 0, is_liked: likedSet.has(c.id), author: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url ?? null } : null, replies: [] };
    });
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
    console.warn("fetchPostComments:", e);
    return [];
  }
}

export async function toggleCommentLike(commentId: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
  try {
    if (currentlyLiked) {
      await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
      const { data: cur } = await supabase.from("comments").select("likes_count").eq("id", commentId).single();
      await supabase.from("comments").update({ likes_count: Math.max(0, (cur?.likes_count ?? 1) - 1) }).eq("id", commentId);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
      const { data: cur } = await supabase.from("comments").select("likes_count").eq("id", commentId).single();
      await supabase.from("comments").update({ likes_count: (cur?.likes_count ?? 0) + 1 }).eq("id", commentId);
    }
    return !currentlyLiked;
  } catch {
    return currentlyLiked;
  }
}

async function _dispatchSocialPush(opts: {
  type: "like" | "comment";
  postId: string;
  actorName: string;
  commentText?: string;
}): Promise<void> {
  try {
    const sessionData = await getCachedSession();
    const token = sessionData?.access_token;
    if (!token) return;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;
    await fetch(`${apiBase}/push/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: opts.type, postId: opts.postId, actorName: opts.actorName, commentText: opts.commentText }),
    });
  } catch {
    // fire-and-forget
  }
}

export async function addPostComment(postId: string, userId: string, content: string, parentId?: string, actorName?: string): Promise<AppComment | null> {
  try {
    const { data, error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: userId,
      content,
      parent_comment_id: parentId ?? null,
    }).select("id, post_id, parent_comment_id, user_id, content, created_at, likes_count").single();
    if (error || !data) return null;
    const profileMap = await _fetchProfilesMap([userId]);
    const p = profileMap.get(userId);
    if (actorName) {
      _dispatchSocialPush({ type: "comment", postId, actorName, commentText: content });
    }
    return { ...data as any, likes_count: 0, is_liked: false, author: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url ?? null } : null, replies: [] };
  } catch (e) {
    console.warn("addPostComment:", e);
    return null;
  }
}

// ─── Blocked Users ───────────────────────────────────────────────────────────

export interface BlockedUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export async function fetchBlockedUsers(userId: string): Promise<BlockedUser[]> {
  try {
    const { data, error } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId).order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return [];
    const blockedIds = (data as any[]).map((r: any) => r.blocked_id).filter(Boolean);
    const profileMap = await _fetchProfilesMap(blockedIds);
    return blockedIds.map(id => {
      const p = profileMap.get(id) as any;
      return { id, full_name: p?.full_name ?? null, username: p?.username ?? null, avatar_url: p?.avatar_url ?? null };
    });
  } catch (e) {
    console.warn("fetchBlockedUsers:", e);
    return [];
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("user_blocks").delete().match({ blocker_id: blockerId, blocked_id: blockedId });
    return !error;
  } catch { return false; }
}

// ─── Certifications ──────────────────────────────────────────────────────────

export interface CertificationRequest {
  id: string;
  user_id: string;
  certification_name: string;
  issuing_body?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  proof_url?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export async function fetchMyCertificationRequests(userId: string): Promise<CertificationRequest[]> {
  try {
    const { data, error } = await supabase.from("certification_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as CertificationRequest[];
  } catch (e) {
    console.warn("fetchMyCertificationRequests:", e);
    return [];
  }
}

export async function submitCertificationRequest(params: {
  user_id: string;
  certification_name: string;
  issuing_body?: string;
  issue_date?: string;
  expiry_date?: string;
  proof_url?: string;
}): Promise<CertificationRequest | null> {
  try {
    const { data, error } = await supabase.from("certification_requests").insert(params).select().single();
    if (error || !data) return null;
    return data as CertificationRequest;
  } catch (e) {
    console.warn("submitCertificationRequest:", e);
    return null;
  }
}

// ─── Stories / Momentos ─────────────────────────────────────────────────────

export interface WebStory {
  id: string;
  user_id: string;
  image_url?: string | null;
  video_url?: string | null;
  text?: string | null;
  created_at: string;
  expires_at: string;
  author?: { id: string; full_name: string; avatar_url?: string | null } | null;
  viewed?: boolean;
}

export interface WebStoryGroup {
  userId: string;
  author: { id: string; full_name: string; avatar_url?: string | null };
  stories: WebStory[];
  hasUnseen: boolean;
}

export async function fetchWebStories(currentUserId: string): Promise<WebStoryGroup[]> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("stories")
      .select("id, user_id, image_url, video_url, text, created_at, expires_at")
      .gte("expires_at", now)
      .order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return [];
    const userIds = [...new Set((data as any[]).map((s: any) => s.user_id))];
    const profileMap = await _fetchProfilesMap(userIds);
    let seenSet = new Set<string>();
    if (currentUserId) {
      const { data: seen } = await supabase.from("story_views").select("story_id").eq("viewer_id", currentUserId);
      seenSet = new Set((seen ?? []).map((v: any) => v.story_id));
    }
    const groupMap = new Map<string, WebStoryGroup>();
    for (const s of data as any[]) {
      const p = profileMap.get(s.user_id);
      if (!p) continue;
      if (!groupMap.has(s.user_id)) {
        groupMap.set(s.user_id, { userId: s.user_id, author: { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url ?? null }, stories: [], hasUnseen: false });
      }
      const story: WebStory = { ...s, viewed: seenSet.has(s.id), author: { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url ?? null } };
      const grp = groupMap.get(s.user_id)!;
      grp.stories.push(story);
      if (!seenSet.has(s.id)) grp.hasUnseen = true;
    }
    return [...groupMap.values()];
  } catch (e) {
    console.warn("fetchWebStories:", e);
    return [];
  }
}

export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  try {
    await supabase.from("story_views").upsert({ story_id: storyId, viewer_id: viewerId }, { onConflict: "story_id,viewer_id" });
  } catch { }
}

export async function createWebStory(params: { user_id: string; text?: string; image_url?: string }): Promise<WebStory | null> {
  try {
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("stories").insert({ ...params, expires_at }).select().single();
    if (error || !data) return null;
    return data as WebStory;
  } catch (e) {
    console.warn("createWebStory:", e);
    return null;
  }
}

// ─── Company Page Edit ───────────────────────────────────────────────────────

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

export async function uploadCompanyLogoWeb(
  companyId: string,
  file: File,
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `company-logos/${companyId}/logo.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) { console.warn("uploadCompanyLogoWeb:", error); return null; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl + `?t=${Date.now()}`;
  } catch (e) {
    console.warn("uploadCompanyLogoWeb:", e);
    return null;
  }
}

export async function updateCompanyPage(
  companyId: string,
  updates: Partial<Pick<CompanyPageFull, "name" | "bio" | "website" | "industry" | "location" | "username" | "avatar_url">>
): Promise<boolean> {
  try {
    const { error } = await supabase.from("company_pages").update(updates).eq("id", companyId);
    return !error;
  } catch (e) {
    console.warn("updateCompanyPage:", e);
    return false;
  }
}

// ─── Account & Settings helpers ──────────────────────────────────────────────

export interface MyReport {
  id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  post_id: string | null;
  reported_user_id: string | null;
}

/** Fetch the reports/denúncias filed by the current user. */
export async function fetchMyReports(userId: string): Promise<MyReport[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, reason, status, created_at, post_id, reported_user_id")
      .eq("reported_by", userId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as MyReport[];
  } catch (e) {
    console.warn("fetchMyReports:", e);
    return [];
  }
}

/**
 * Update arbitrary profile columns for the current user.
 * Used by Privacy/Security toggles (is_public, allow_messages, show_connections).
 */
export async function updateProfileFields(
  profileId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!profileId || !patch || Object.keys(patch).length === 0) return false;
  try {
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .or(`id.eq.${profileId},user_id.eq.${profileId}`);
    return !error;
  } catch (e) {
    console.warn("updateProfileFields:", e);
    return false;
  }
}

/**
 * Permanently delete the current user's account through the API server.
 * Mirrors the mobile `deleteAccount(token)` helper at
 * artifacts/ibhub/services/api/account.ts.
 */
export async function deleteOwnAccount(
  token: string,
): Promise<{ success: boolean; warnings?: string[]; error?: string }> {
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;
    const res = await fetch(`${apiBase}/users/me`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: json?.error ?? "Erro ao excluir conta." };
    }
    return { success: true, warnings: json?.warnings ?? [] };
  } catch (e) {
    console.warn("deleteOwnAccount:", e);
    return { success: false, error: "Erro de conexão. Tente novamente." };
  }
}

// ─── Events CRUD ─────────────────────────────────────────────────────────────

export async function fetchMyEvents(userId: string): Promise<AppEvent[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("user_id", userId)
      .order("start_date", { ascending: false });
    if (error || !data) return [];
    return (data as EventDbRow[]).map(mapEventRow);
  } catch (e) {
    console.warn("fetchMyEvents:", e);
    return [];
  }
}

/** Admin view of a company's events: includes all events by the owner user,
 *  regardless of is_active status. */
export async function fetchCompanyAdminEvents(ownerId: string): Promise<AppEvent[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("user_id", ownerId)
      .order("start_date", { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return (data as EventDbRow[]).map(mapEventRow);
  } catch (e) {
    console.warn("fetchCompanyAdminEvents:", e);
    return [];
  }
}

export async function createEvent(params: {
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  location_type?: "online" | "presencial";
  entry_type?: "gratuito" | "pago";
  max_attendees?: number;
  created_by: string;
}): Promise<AppEvent | null> {
  try {
    const insertPayload = {
      user_id: params.created_by,
      title: params.title,
      description: params.description ?? null,
      start_date: params.start_date,
      end_date: params.end_date ?? null,
      location: params.location ?? null,
      location_type: params.location_type ?? "presencial",
      entry_type: params.entry_type ?? "gratuito",
      capacity: params.max_attendees ?? null,
      visibility: "publico",
      is_active: true,
    };
    const { data, error } = await supabase
      .from("events")
      .insert(insertPayload)
      .select(EVENT_COLUMNS)
      .single();
    if (error || !data) {
      if (error) console.warn("createEvent:", error);
      return null;
    }
    return mapEventRow(data as EventDbRow);
  } catch (e) {
    console.warn("createEvent:", e);
    return null;
  }
}

export async function deleteEvent(eventId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("events").delete().eq("id", eventId).eq("user_id", userId);
    return !error;
  } catch (e) {
    console.warn("deleteEvent:", e);
    return false;
  }
}

// ─── User Analytics ─────────────────────────────────────────────────────────

export interface DailyEngagement {
  date: string;
  likes: number;
  comments: number;
}

export interface UserAnalytics {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalPosts: number;
  followersCount: number;
  topPosts: Array<{ id: string; content: string; likes_count: number; comments_count: number; shares_count: number }>;
  dailyEngagement: DailyEngagement[];
}

function buildDailyEngagementWeb(
  likesDates: string[],
  commentsDates: string[],
  days: number,
): DailyEngagement[] {
  const result: DailyEngagement[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({
      date: key,
      likes: likesDates.filter((s) => s.startsWith(key)).length,
      comments: commentsDates.filter((s) => s.startsWith(key)).length,
    });
  }
  return result;
}

export async function fetchUserAnalytics(userId: string): Promise<UserAnalytics> {
  try {
    const [postsRes, profileRes, likesRes, commentsRes] = await Promise.all([
      supabase.from("posts").select("id, content, likes_count, comments_count, shares_count, created_at").eq("user_id", userId),
      supabase.from("profiles").select("followers_count").eq("id", userId).single(),
      supabase.from("post_likes").select("created_at").eq("user_id", userId).gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()),
      supabase.from("comments").select("created_at").eq("user_id", userId).gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()),
    ]);
    const posts: any[] = postsRes.data ?? [];
    const followersCount: number = (profileRes.data as any)?.followers_count ?? 0;
    const totalLikes = posts.reduce((s, p) => s + (p.likes_count ?? 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments_count ?? 0), 0);
    const totalShares = posts.reduce((s, p) => s + (p.shares_count ?? 0), 0);
    const topPosts = [...posts]
      .sort((a, b) => ((b.likes_count ?? 0) + (b.comments_count ?? 0)) - ((a.likes_count ?? 0) + (a.comments_count ?? 0)))
      .slice(0, 5);
    const likesDates = (likesRes.data ?? []).map((r: any) => r.created_at as string);
    const commentsDates = (commentsRes.data ?? []).map((r: any) => r.created_at as string);
    const dailyEngagement = buildDailyEngagementWeb(likesDates, commentsDates, 14);
    return { totalLikes, totalComments, totalShares, totalPosts: posts.length, followersCount, topPosts, dailyEngagement };
  } catch (e) {
    console.warn("fetchUserAnalytics:", e);
    return { totalLikes: 0, totalComments: 0, totalShares: 0, totalPosts: 0, followersCount: 0, topPosts: [], dailyEngagement: [] };
  }
}

// ─── Referral ────────────────────────────────────────────────────────────────

export interface ReferralRankEntry {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  invite_count: number;
  rank: number;
}

function _deriveReferralCode(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function applyReferralCode(newUserId: string, code: string): Promise<boolean> {
  try {
    if (!code.trim()) return false;
    const { data: prof } = await supabase
      .from("profiles")
      .select("invited_by_id")
      .eq("id", newUserId)
      .maybeSingle();
    if ((prof as any)?.invited_by_id) return true;
    const { data: inviter } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", code.trim().toUpperCase())
      .maybeSingle();
    if (!inviter?.id || inviter.id === newUserId) return false;
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

export async function ensureReferralCode(userId: string): Promise<string> {
  try {
    const { data } = await supabase.from("profiles").select("referral_code").eq("id", userId).single();
    if ((data as any)?.referral_code) return (data as any).referral_code;
    const code = _deriveReferralCode(userId);
    await supabase.from("profiles").update({ referral_code: code }).eq("id", userId);
    return code;
  } catch (e) {
    console.warn("ensureReferralCode:", e);
    return _deriveReferralCode(userId);
  }
}

export async function fetchMyReferralCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("invited_by_id", userId);
    return count ?? 0;
  } catch { return 0; }
}

export async function fetchReferralLeaderboard(limit = 20): Promise<ReferralRankEntry[]> {
  try {
    const { data } = await supabase.from("profiles").select("invited_by_id").not("invited_by_id", "is", null);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.invited_by_id) counts[row.invited_by_id] = (counts[row.invited_by_id] ?? 0) + 1;
    }
    const topIds = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, limit).map(([id]) => id);
    if (!topIds.length) return [];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", topIds);
    const countMap = new Map(Object.entries(counts));
    return (profiles ?? [])
      .map((p: any, i: number) => ({ id: p.id, full_name: p.full_name ?? "Usuário", username: p.username ?? null, avatar_url: p.avatar_url ?? null, invite_count: countMap.get(p.id) ?? 0, rank: i + 1 }))
      .sort((a, b) => b.invite_count - a.invite_count)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  } catch (e) {
    console.warn("fetchReferralLeaderboard:", e);
    return [];
  }
}

// ─── Group Chat Utilities ────────────────────────────────────────────────────

export async function fetchWebGroupInfo(groupId: string): Promise<WebGroupInfo | null> {
  try {
    const [convRes, partRes] = await Promise.all([
      supabase.from("conversations").select("id, name").eq("id", groupId).maybeSingle(),
      supabase.from("conversation_participants").select("user_id").eq("conversation_id", groupId),
    ]);
    if (!convRes.data) return null;
    return {
      id: (convRes.data as any).id,
      name: (convRes.data as any).name,
      member_count: (partRes.data ?? []).length,
    };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST LIKES (quem curtiu)
// ═══════════════════════════════════════════════════════════════════════════

export interface LikeUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  headline?: string | null;
  company_page_id?: string | null;
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

    const userIds = [...new Set((data as any[]).map((l: any) => l.user_id).filter(Boolean))];
    const companyIds = [...new Set((data as any[]).map((l: any) => l.company_page_id).filter(Boolean))];

    const [profileRes, companyRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("id, full_name, avatar_url, headline").in("id", userIds)
        : Promise.resolve({ data: [] }),
      companyIds.length > 0
        ? supabase.from("company_pages").select("id, name, avatar_url, industry").in("id", companyIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profileRes.data ?? []).map((p: any) => [p.id, p]));
    const companyMap = new Map((companyRes.data ?? []).map((c: any) => [c.id, c]));

    return (data as any[]).map((l: any) => {
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

export async function deleteMarketPost(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("market_posts").delete().eq("id", id);
    if (error) { console.error("deleteMarketPost:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteMarketPost:", e);
    return false;
  }
}

export async function updateMarketPost(id: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("market_posts").update({ content }).eq("id", id);
    if (error) { console.error("updateMarketPost:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateMarketPost:", e);
    return false;
  }
}

// ─── MENTIONS ────────────────────────────────────────────────────────────────

export interface MentionSuggestion {
  id: string;
  type: "user" | "company";
  display_name: string;
  username: string;
  avatar_url: string | null;
}

export async function searchUsersForMention(q: string): Promise<MentionSuggestion[]> {
  if (!q || q.length < 1) return [];
  try {
    const [{ data: people }, { data: companies }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .not("username", "is", null)
        .limit(8),
      supabase
        .from("company_pages")
        .select("id, name, avatar_url, slug")
        .ilike("name", `%${q}%`)
        .limit(5),
    ]);
    const results: MentionSuggestion[] = [];
    for (const p of (people ?? [])) {
      if (!p.username) continue;
      results.push({ id: p.id, type: "user", display_name: (p as any).full_name ?? p.username, username: p.username, avatar_url: (p as any).avatar_url });
    }
    for (const c of (companies ?? [])) {
      const slug = (c as any).slug ?? (c as any).name.toLowerCase().replace(/\s+/g, "_");
      results.push({ id: c.id, type: "company", display_name: (c as any).name, username: slug, avatar_url: (c as any).avatar_url });
    }
    return results;
  } catch { return []; }
}

export async function sendMentionNotifications(
  text: string,
  actorId: string,
  actorName: string,
  postId?: string,
  commentId?: string,
): Promise<void> {
  try {
    const handles = [...new Set((text.match(/@([\w.]+)/g) ?? []).map(m => m.slice(1).toLowerCase()))];
    if (!handles.length) return;

    const [{ data: people }, { data: companies }] = await Promise.all([
      supabase.from("profiles").select("id, username").in("username", handles),
      supabase.from("company_pages").select("id, slug").in("slug", handles),
    ]);

    const mentionedUserIds: string[] = [];
    const notifs: Array<Record<string, unknown>> = [];
    const where = commentId ? "comentário" : "publicação";

    for (const p of (people ?? [])) {
      if ((p as any).id === actorId) continue;
      mentionedUserIds.push((p as any).id);
      notifs.push({ user_id: (p as any).id, actor_id: actorId, type: "mention", message: `mencionou você em um ${where}`, post_id: postId ?? null, comment_id: commentId ?? null });
    }
    for (const c of (companies ?? [])) {
      const { data: admins } = await supabase
        .from("company_page_admins")
        .select("user_id")
        .eq("company_page_id", (c as any).id);
      for (const a of (admins ?? [])) {
        if ((a as any).user_id === actorId) continue;
        mentionedUserIds.push((a as any).user_id);
        notifs.push({ user_id: (a as any).user_id, actor_id: actorId, type: "mention", message: `mencionou ${(c as any).name || "sua empresa"} em um ${where}`, post_id: postId ?? null, comment_id: commentId ?? null });
      }
    }

    if (!notifs.length) return;
    await supabase.from("notifications").insert(notifs);

    if (mentionedUserIds.length) {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const session = await getCachedSession();
      if (session?.access_token && apiBase) {
        fetch(`${apiBase}/push/mention`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ mentionedUserIds, actorName, postId, commentId, contextText: text.slice(0, 100) }),
        }).catch(() => {});
      }
    }
  } catch { /* best-effort */ }
}

/* ─── Ideal.BI — BI Search ────────────────────────────────────────────────── */

export interface BiImportador {
  id: string;
  name: string;
  segmentos: string;
  exportadores: Array<{ exportador: string; pais: string }>;
}

export interface BiExportador {
  id: string;
  name: string;
  origem_exportador: string;
  distribuidor: string | null;
  created_at: string;
}

export interface BiProdutor {
  id: string;
  name: string;
  name_fantasia: string | null;
  regiao: string;
  estado: string | null;
  created_at: string;
}

export interface BiSearchResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export class BiAccessError extends Error {
  constructor(message = "Acesso negado") { super(message); this.name = "BiAccessError"; }
}

async function biGet<T>(path: string, q: string, limit: number, offset: number): Promise<BiSearchResult<T>> {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? `${window.location.origin}/api`;
  const session = await getCachedSession();
  const token = session?.access_token;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), ...(q ? { q } : {}) });
  const res = await fetch(`${apiBase}/${path}?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 || res.status === 403) throw new BiAccessError();
  if (!res.ok) throw new Error(`BI fetch failed: ${res.status}`);
  return res.json() as Promise<BiSearchResult<T>>;
}

export function fetchBiImportadores(q: string, limit = 20, offset = 0) {
  return biGet<BiImportador>("market/bi/importadores", q, limit, offset);
}

export function fetchBiExportadores(q: string, limit = 20, offset = 0) {
  return biGet<BiExportador>("market/bi/exportadores", q, limit, offset);
}

export function fetchBiProdutores(q: string, limit = 20, offset = 0) {
  return biGet<BiProdutor>("market/bi/produtores", q, limit, offset);
}
