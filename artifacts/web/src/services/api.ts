import { supabase } from "@/lib/supabase";

// ─── Feed / Posts ──────────────────────────────────────────────────────────────

export type ReactionType = "curtir" | "saude" | "destaque" | "incrivel";

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
}

const POST_SELECT = `id, user_id, company_page_id, content, image_url, image_urls, video_url,
  likes_count, comments_count, shares_count, view_count, location, hashtags, created_at`;

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
    const { data: { session } } = await supabase.auth.getSession();
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

    return rawPosts.map((raw: any) => ({
      ..._normalisePost(raw, profileMap),
      is_liked: likedMap.has(raw.id),
      reaction_type: likedMap.get(raw.id) ?? null,
      is_bookmarked: bookmarkedIds.has(raw.id),
    }));
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
}): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .insert({ ...params, likes_count: 0, comments_count: 0, shares_count: 0, view_count: 0 })
      .select(POST_SELECT)
      .single();
    if (error || !data) return null;
    const profileMap = await _fetchProfilesMap([data.user_id]);
    return _normalisePost(data, profileMap);
  } catch (e) {
    console.warn("createWebPost:", e);
    return null;
  }
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
      reaction_type: likedMap.get(raw.id) ?? null,
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
  reaction: ReactionType = "curtir",
  companyPageId?: string | null,
): Promise<boolean> {
  try {
    if (companyPageId) {
      if (isLiked) {
        await supabase.from("likes").delete().match({ post_id: postId, company_page_id: companyPageId });
        await supabase.rpc("decrement_post_likes", { p_post_id: postId });
      } else {
        await supabase.from("likes").upsert({ post_id: postId, user_id: userId, company_page_id: companyPageId, reaction_type: reaction }, { onConflict: "post_id,company_page_id" });
        await supabase.rpc("increment_post_likes", { p_post_id: postId });
      }
    } else {
      if (isLiked) {
        await supabase.from("likes").delete().match({ post_id: postId, user_id: userId }).is("company_page_id", null);
        await supabase.rpc("decrement_post_likes", { p_post_id: postId });
      } else {
        await supabase.from("likes").upsert({ post_id: postId, user_id: userId, reaction_type: reaction }, { onConflict: "post_id,user_id" });
        await supabase.rpc("increment_post_likes", { p_post_id: postId });
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
      .select("requester_id, receiver_id")
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq("status", "accepted");
    if (!data) return [];
    const ids = data.map((c: any) => c.requester_id === userId ? c.receiver_id : c.requester_id);
    if (!ids.length) return [];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, username, avatar_url, position, company").in("id", ids);
    return (profiles ?? []).map((p: any) => ({ id: p.id, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, headline: [p.position, p.company].filter(Boolean).join(" · ") || null }));
  } catch (e) {
    console.warn("fetchConnectionsList:", e);
    return [];
  }
}

export async function fetchFollowersList(userId: string): Promise<ProfilePerson[]> {
  try {
    const { data } = await supabase.from("follows").select("follower_id").eq("following_id", userId).limit(50);
    if (!data || !data.length) return [];
    const ids = data.map((f: any) => f.follower_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, username, avatar_url, position, company").in("id", ids);
    return (profiles ?? []).map((p: any) => ({ id: p.id, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, headline: [p.position, p.company].filter(Boolean).join(" · ") || null }));
  } catch (e) {
    console.warn("fetchFollowersList:", e);
    return [];
  }
}

export async function fetchFollowingList(userId: string): Promise<ProfilePerson[]> {
  try {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId).limit(50);
    if (!data || !data.length) return [];
    const ids = data.map((f: any) => f.following_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, username, avatar_url, position, company").in("id", ids);
    return (profiles ?? []).map((p: any) => ({ id: p.id, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, headline: [p.position, p.company].filter(Boolean).join(" · ") || null }));
  } catch (e) {
    console.warn("fetchFollowingList:", e);
    return [];
  }
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
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, bio, headline, position, company, plan, is_admin, created_at, certifications")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as UserProfile;
  } catch (e) {
    console.warn("fetchUserProfile:", e);
    return null;
  }
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data || !data.length) return [];
    const profileMap = await _fetchProfilesMap([userId]);
    return data.map((raw: any) => _normalisePost(raw, profileMap));
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
      .select("id, full_name, username, avatar_url, position, company, plan, areas")
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

export async function sendWebConnectionRequest(targetId: string, currentUserId: string): Promise<void> {
  try {
    await supabase.from("connections").upsert(
      { requester_id: currentUserId, receiver_id: targetId, status: "pending" },
      { onConflict: "requester_id,receiver_id" },
    );
  } catch (e) {
    console.warn("sendWebConnectionRequest:", e);
  }
}

const _statsCache = new Map<string, { data: { connections: number; followers: number; following: number }; ts: number }>();
const STATS_TTL = 5 * 60 * 1000;

export async function fetchProfileStats(userId: string, forceRefresh = false): Promise<{ connections: number; followers: number; following: number }> {
  const cached = _statsCache.get(userId);
  if (!forceRefresh && cached && Date.now() - cached.ts < STATS_TTL) return cached.data;
  try {
    const [connsRes, followersRes, followingRes] = await Promise.all([
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", userId),
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", userId),
    ]);
    const data = {
      connections: connsRes.count ?? 0,
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
    };
    _statsCache.set(userId, { data, ts: Date.now() });
    return data;
  } catch (e) {
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
    const { data: { session } } = await supabase.auth.getSession();
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
  const { data: { session } } = await supabase.auth.getSession();
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
}

export interface WebMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { id: string; full_name: string; avatar_url?: string | null };
}

export async function fetchWebConversations(userId: string): Promise<WebConversation[]> {
  try {
    // Use SECURITY DEFINER RPC to bypass RLS on conversation_participants (same as mobile)
    const [participantsRes, convosRes] = await Promise.all([
      supabase.rpc("get_my_conversations_participants", { p_user_id: userId }),
      supabase
        .from("conversation_participants")
        .select("conversation_id, accepted, last_read_at, conversation:conversations(id, is_group, name, created_at)")
        .eq("user_id", userId),
    ]);

    if (convosRes.error || !convosRes.data) return [];

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

    const results: WebConversation[] = [];
    for (const row of convosRes.data as any[]) {
      const convo = row.conversation;
      if (!convo) continue;

      const pInfo = participantMap.get(convo.id);
      const participant = pInfo?.other_user_id ? (profileMap.get(pInfo.other_user_id) ?? null) : null;

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
      });
    }

    return results.sort(
      (a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
    );
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

    if (!rpcError && rpcData) {
      return (rpcData as any[]).map((m) => ({
        id:              m.id,
        conversation_id: m.conversation_id,
        sender_id:       m.sender_id,
        content:         m.content,
        created_at:      m.created_at,
        sender: {
          id:         m.sender_id,
          full_name:  m.sender_name  ?? null,
          avatar_url: m.sender_avatar ?? null,
        },
      }));
    }

    // Fallback: direct query (may only return messages where sender_id = current user due to RLS)
    console.warn("get_conversation_messages RPC unavailable, using direct query:", rpcError?.message);
    const { data } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
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

    return data.map((m: any) => ({
      ...m,
      sender: profileMap.get(m.sender_id) ?? null,
    }));
  } catch (e) {
    console.warn("fetchWebMessages:", e);
    return [];
  }
}

export async function sendWebMessage(conversationId: string, senderId: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: "text",
    });
    return !error;
  } catch (e) {
    console.warn("sendWebMessage:", e);
    return false;
  }
}

export async function uploadChatAttachment(file: File, userId: string): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token ?? "";

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

export async function uploadPortfolioImage(file: File, userId: string): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token ?? "";

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
  creator?: { id: string; full_name: string; avatar_url?: string | null } | null;
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
  price?: number | null;
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
  };
  chart_bar: { values: number[]; labels: string[] };
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
      id, type, title, description, category, company, location,
      price, salary, contract_type, contact_email, expires_at, created_at,
      created_by, interests_count, applications_count, cover_image_url
    `)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const items = data as AppOpportunity[];

  if (!userId) return items;

  const ids = items.map((i) => i.id);
  type OppIdRow = { opportunity_id: string };
  const [savedRes, appliedRes] = await Promise.all([
    supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", userId).in("opportunity_id", ids),
    type === "vaga"
      ? supabase.from("job_applications").select("opportunity_id").eq("user_id", userId).in("opportunity_id", ids)
      : Promise.resolve({ data: [] as OppIdRow[] }),
  ]);

  const savedSet = new Set(((savedRes.data ?? []) as OppIdRow[]).map((r) => r.opportunity_id));
  const appliedSet = new Set(((appliedRes.data ?? []) as OppIdRow[]).map((r) => r.opportunity_id));

  return items.map((i) => ({
    ...i,
    is_saved: savedSet.has(i.id),
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
      id, type, title, description, category, company, location,
      price, salary, contract_type, contact_email, expires_at, created_at,
      created_by, interests_count, applications_count, cover_image_url
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const rawItem = data as AppOpportunity;
  let result: AppOpportunity = { ...rawItem };

  if (userId && result.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", result.created_by)
      .maybeSingle();
    result.creator = (profile as AppOpportunity["creator"]) ?? null;
  }

  if (userId) {
    const [savedRes, appliedRes, intRes] = await Promise.all([
      supabase.from("saved_opportunities").select("id").eq("user_id", userId).eq("opportunity_id", id).maybeSingle(),
      result.type === "vaga"
        ? supabase.from("job_applications").select("id").eq("user_id", userId).eq("opportunity_id", id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("opportunity_interests").select("id").eq("user_id", userId).eq("opportunity_id", id).maybeSingle(),
    ]);
    result = {
      ...result,
      is_saved: !!savedRes.data,
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
  location?: string | null;
  price?: string | null;
  salary?: string | null;
  contract_type?: string | null;
  contact_email?: string | null;
  expires_at?: string | null;
  created_by: string;
}): Promise<AppOpportunity | null> {
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin}/api`;
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
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

export async function getCvSignedUrl(cvValue: string): Promise<string | null> {
  if (!cvValue.startsWith(CV_STORAGE_PREFIX)) {
    return cvValue;
  }
  const storagePath = cvValue.slice(CV_STORAGE_PREFIX.length);

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
    ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";

  try {
    const res = await fetch(`${apiBase}/cv/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path: storagePath }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { signedUrl?: string };
    return json.signedUrl ?? null;
  } catch (e) {
    console.error("getCvSignedUrl:", e);
    return null;
  }
}

export async function applyToJob(
  opportunityId: string,
  userId: string,
  cvUrl: string | null,
  message: string | null
): Promise<boolean> {
  const { error } = await supabase.from("job_applications").insert({
    opportunity_id: opportunityId,
    user_id: userId,
    cv_url: cvUrl,
    message,
  });
  return !error;
}

export async function expressInterest(
  opportunityId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase.from("opportunity_interests").insert({
    opportunity_id: opportunityId,
    user_id: userId,
  });
  return !error;
}

export async function trackOpportunityView(opportunityId: string): Promise<void> {
  try { await supabase.rpc("increment_opportunity_views", { opp_id: opportunityId }); } catch {}
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function fetchEvents(userId: string): Promise<AppEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(`
      id, title, description, start_date, end_date, location, location_type,
      entry_type, price, cover_image_url, max_attendees, attendees_count,
      created_by, created_at
    `)
    .order("start_date", { ascending: true })
    .limit(100);

  if (error || !data) return [];

  const items = data as AppEvent[];

  if (userId && items.length > 0) {
    const ids = items.map((i) => i.id);
    type EventIdRow = { event_id: string };
    const { data: regData } = await supabase
      .from("event_registrations")
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
    .select(`
      id, title, description, start_date, end_date, location, location_type,
      entry_type, price, cover_image_url, max_attendees, attendees_count,
      created_by, created_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  let result: AppEvent = { ...(data as AppEvent) };

  if (userId && result.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", result.created_by)
      .maybeSingle();
    result.organizer = (profile as AppEvent["organizer"]) ?? null;
  }

  if (userId) {
    const { data: regData } = await supabase
      .from("event_registrations")
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
    .from("event_registrations")
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
  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    user_id: userId,
  });
  return !error;
}

export async function unregisterFromEvent(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("event_registrations")
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
  return MARKET_FALLBACK[period];
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

    // Fetch member counts
    const groups = (groupsRes.data ?? []) as any[];
    const countResults = await Promise.all(
      groups.map(g =>
        supabase
          .from("group_members")
          .select("user_id", { count: "exact", head: true })
          .eq("group_id", g.id)
      )
    );

    const enriched: Group[] = groups.map((g, i) => ({
      ...g,
      member_count: countResults[i].count ?? 0,
      is_member: membershipMap.has(g.id),
      is_owner: g.owner_id === userId,
    }));

    const mine    = enriched.filter(g => g.is_member);
    const explore = enriched.filter(g => !g.is_member);
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
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
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

export async function joinGroup(groupId: string, userId: string): Promise<boolean> {
  try {
    const [{ error: gmErr }, { error: cpErr }] = await Promise.all([
      supabase.from("group_members").insert({ group_id: groupId, user_id: userId, role: "member" }),
      supabase.from("conversation_participants").upsert({ conversation_id: groupId, user_id: userId }, { onConflict: "conversation_id,user_id", ignoreDuplicates: true }),
    ]);
    if (cpErr) console.warn("joinGroup conversation_participants:", cpErr);
    return !gmErr;
  } catch {
    return false;
  }
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
    position?: string | null;
    company?: string | null;
  };
}

export async function fetchMarketPosts(userId?: string): Promise<MarketPost[]> {
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
      ?? `${window.location.origin}/api`;
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
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
        ? supabase.from("market_post_likes").select("post_id").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      userId
        ? supabase.from("market_post_poll_votes").select("post_id, option_id").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      companyPageIds.length > 0
        ? supabase.from("company_pages").select("id, name, avatar_url").in("id", companyPageIds)
        : supabase.from("company_pages").select("id, name, avatar_url").ilike("name", "Ideal.BI").maybeSingle(),
    ]);

    const likedSet    = new Set(((likesRes as any).data ?? []).map((l: any) => l.post_id as string));
    const pollVoteMap = new Map(((votesRes as any).data ?? []).map((v: any) => [v.post_id as string, v.option_id as string]));

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
      return { ...p, user_liked: likedSet.has(p.id), user_poll_vote: pollVoteMap.get(p.id) ?? null, author };
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
    const { data: { session } } = await supabase.auth.getSession();
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

    return { ...newPost, user_liked: false, user_poll_vote: null, author };
  } catch {
    return null;
  }
}

export async function voteOnMarketPoll(postId: string, userId: string, optionId: string): Promise<MarketPollOption[] | null> {
  try {
    const { data: existing } = await supabase
      .from("market_post_poll_votes")
      .select("option_id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: post } = await supabase.from("market_posts").select("poll_options").eq("id", postId).single();
    if (!post) return null;
    const opts: MarketPollOption[] = post.poll_options ?? [];

    if (existing) {
      const updated = opts.map((o: MarketPollOption) =>
        o.id === existing.option_id ? { ...o, votes_count: Math.max(0, o.votes_count - 1) } :
        o.id === optionId ? { ...o, votes_count: o.votes_count + 1 } : o
      );
      await supabase.from("market_post_poll_votes").update({ option_id: optionId }).eq("post_id", postId).eq("user_id", userId);
      await supabase.from("market_posts").update({ poll_options: updated }).eq("id", postId);
      return updated;
    } else {
      const updated = opts.map((o: MarketPollOption) => o.id === optionId ? { ...o, votes_count: o.votes_count + 1 } : o);
      await supabase.from("market_post_poll_votes").insert({ post_id: postId, user_id: userId, option_id: optionId });
      await supabase.from("market_posts").update({ poll_options: updated }).eq("id", postId);
      return updated;
    }
  } catch {
    return null;
  }
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
  } catch {
    return currentlyLiked;
  }
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
      .select("id, user_id, full_name, avatar_url, headline")
      .in("user_id", authorIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    return data.map((c: any) => {
      const profile = profileMap.get(c.author_id);
      return {
        ...c,
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
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, avatar_url")
      .eq("user_id", authorId)
      .maybeSingle();
    return { ...data, author: authorProfile ?? undefined };
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
  message?: string | null;
  read: boolean;
  created_at: string;
  actor?: { id: string; full_name: string; avatar_url?: string | null } | null;
  connection_id?: string | null;
  connection_status?: "pending" | "accepted" | "rejected" | null;
}

export async function fetchWebNotifications(userId: string): Promise<WebNotification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, type, post_id, message, read, created_at, connection_id, connection_status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error || !data) return [];

    const actorIds = [...new Set((data as any[]).filter(n => n.actor_id).map((n: any) => n.actor_id as string))];
    let actorMap: Map<string, { id: string; full_name: string; avatar_url?: string | null }> = new Map();
    if (actorIds.length > 0) {
      const { data: actors } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", actorIds);
      if (actors) for (const a of actors as any[]) actorMap.set(a.id, a);
    }

    return (data as any[]).map(n => ({ ...n, actor: n.actor_id ? (actorMap.get(n.actor_id) ?? null) : null })) as WebNotification[];
  } catch (e) {
    console.warn("fetchWebNotifications:", e);
    return [];
  }
}

export async function markWebNotificationRead(notifId: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", notifId);
}

export async function markAllWebNotificationsRead(userId: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export async function acceptWebConnectionRequest(connectionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("connections").update({ status: "accepted" }).eq("id", connectionId);
    return !error;
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

export async function fetchPostById(postId: string, currentUserId?: string): Promise<Post | null> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`${POST_SELECT}`)
      .eq("id", postId)
      .maybeSingle();
    if (error || !data) return null;
    const profileMap = await _fetchProfilesMap([data.user_id]);
    const post = _normalisePost(data, profileMap);
    if (currentUserId) {
      const [likeRes, bookRes] = await Promise.all([
        supabase.from("reactions").select("reaction_type").eq("post_id", postId).eq("user_id", currentUserId).maybeSingle(),
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

export async function addPostComment(postId: string, userId: string, content: string, parentId?: string): Promise<AppComment | null> {
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
      .select("id, user_id, image_url, text, created_at, expires_at")
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

// ─── Events CRUD ─────────────────────────────────────────────────────────────

export async function fetchMyEvents(userId: string): Promise<AppEvent[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, start_date, end_date, location, location_type, entry_type, price, cover_image_url, max_attendees, attendees_count, created_by, created_at")
      .eq("created_by", userId)
      .order("start_date", { ascending: false });
    if (error || !data) return [];
    return data as AppEvent[];
  } catch (e) {
    console.warn("fetchMyEvents:", e);
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
  price?: number;
  max_attendees?: number;
  created_by: string;
}): Promise<AppEvent | null> {
  try {
    const { data, error } = await supabase.from("events").insert(params).select().single();
    if (error || !data) return null;
    return data as AppEvent;
  } catch (e) {
    console.warn("createEvent:", e);
    return null;
  }
}

export async function deleteEvent(eventId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("events").delete().eq("id", eventId).eq("created_by", userId);
    return !error;
  } catch (e) {
    console.warn("deleteEvent:", e);
    return false;
  }
}

// ─── User Analytics ─────────────────────────────────────────────────────────

export interface UserAnalytics {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalPosts: number;
  followersCount: number;
  topPosts: Array<{ id: string; content: string; likes_count: number; comments_count: number; shares_count: number }>;
}

export async function fetchUserAnalytics(userId: string): Promise<UserAnalytics> {
  try {
    const [postsRes, profileRes] = await Promise.all([
      supabase.from("posts").select("id, content, likes_count, comments_count, shares_count").eq("user_id", userId),
      supabase.from("profiles").select("followers_count").eq("id", userId).single(),
    ]);
    const posts: any[] = postsRes.data ?? [];
    const followersCount: number = (profileRes.data as any)?.followers_count ?? 0;
    const totalLikes = posts.reduce((s, p) => s + (p.likes_count ?? 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments_count ?? 0), 0);
    const totalShares = posts.reduce((s, p) => s + (p.shares_count ?? 0), 0);
    const topPosts = [...posts].sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0)).slice(0, 5);
    return { totalLikes, totalComments, totalShares, totalPosts: posts.length, followersCount, topPosts };
  } catch (e) {
    console.warn("fetchUserAnalytics:", e);
    return { totalLikes: 0, totalComments: 0, totalShares: 0, totalPosts: 0, followersCount: 0, topPosts: [] };
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
