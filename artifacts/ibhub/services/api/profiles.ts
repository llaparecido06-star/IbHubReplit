import { supabase } from "@/context/AuthContext";
import { Post } from "@/components/feed/PostCard";
import { compressAvatar } from "@/utils/compressImage";
import { getSessionSafe, API_URL, POST_SELECT_BASE, attachAuthorsToPosts, fetchCompanyPagesForIds, fetchProfilesForIds, isNetworkError, isValidUUID } from "./_shared";

/**
 * Fire-and-forget helper that calls a server-side push route.
 * The server resolves the actor name from their auth token.
 * Never throws — errors are swallowed to avoid blocking the primary action.
 */
async function _dispatchPush(path: string, body: Record<string, string>): Promise<void> {
  try {
    const { data: { session } } = await getSessionSafe();
    const token = session?.access_token;
    if (!token || !API_URL) return;
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
  }
}

// ─── UPDATE PROFILE ─────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  full_name?: string;
  username?: string;
  bio?: string;
  phone?: string | null;
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
    const dbPayload: Record<string, unknown> = { ...(payload as any) };
    const { error } = await supabase
      .from("profiles")
      .update(dbPayload)
      .or(`id.eq.${userId},user_id.eq.${userId}`);
    if (error) { console.error("updateProfile:", error); return false; }
    return true;
  } catch (e) {
    if (isNetworkError(e)) throw e;
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
  company_match: boolean;
  is_following: boolean;
  is_company: boolean;
}

export async function fetchSuggestedConnections(
  currentUserId: string,
  userAreas: string[],
  userCompany?: string | null,
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
        .select("id, user_id, full_name, username, avatar_url, position, company, plan, areas, profile_type")
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
    const lowerUserCompany = userCompany?.toLowerCase() ?? null;

    // 3. Score and rank — area matches + company match
    const scored = (profiles as any[])
      .filter((p: any) => !excludedIds.has(p.id) && p.id !== currentUserId && p.user_id !== currentUserId)
      .map((p: any) => {
        const pAreas: string[] = Array.isArray(p.areas) ? p.areas : [];
        const match_score = pAreas.filter(a => lowerUserAreas.includes(a.toLowerCase())).length;
        const company_match = !!(lowerUserCompany && p.company && p.company.toLowerCase() === lowerUserCompany);
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
          company_match,
          is_following: followingIds.has(p.id),
          is_company: p.profile_type === "empresa",
        } as SuggestedProfile;
      })
      .sort((a, b) => {
        // Combined sort: area matches + company match bonus, then plan tier
        const totalA = a.match_score + (a.company_match ? 2 : 0);
        const totalB = b.match_score + (b.company_match ? 2 : 0);
        if (totalB !== totalA) return totalB - totalA;
        const planOrder: Record<string, number> = { executivo: 3, exclusive: 3, business: 3, empresa: 2, empresas: 2, profissional: 1, basico: 1, premium: 1, gratuito: 0 };
        return (planOrder[b.plan] ?? 0) - (planOrder[a.plan] ?? 0);
      });

    return scored.slice(0, limit);
  } catch (e) {
    console.warn("fetchSuggestedConnections:", e);
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
      void _dispatchPush("/push/follow", { targetId });
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
    // Auto-follow the target when sending a connection request
    await supabase.from("follows").upsert(
      { follower_id: currentUserId, following_id: targetId },
      { onConflict: "follower_id,following_id" },
    );
    await supabase.from("notifications").insert({
      user_id: targetId, actor_id: currentUserId, type: "connection",
      message: "enviou um pedido de conexão",
    });
    void _dispatchPush("/push/connection", { targetId });
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
      const p = profileMap.get(row.requester_id);
      return { connectionId: row.id, id: row.requester_id, full_name: p?.full_name ?? null, username: p?.username ?? null, avatar_url: p?.avatar_url ?? null, position: p?.position ?? null, company: p?.company ?? null, created_at: row.created_at };
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
      const p = profileMap.get(row.receiver_id);
      return { connectionId: row.id, id: row.receiver_id, full_name: p?.full_name ?? null, username: p?.username ?? null, avatar_url: p?.avatar_url ?? null, position: p?.position ?? null, company: p?.company ?? null, created_at: row.created_at };
    });
  } catch (e) { console.warn("fetchPendingConnectionsSent:", e); return []; }
}

export async function removeConnection(targetId: string, currentUserId: string): Promise<boolean> {
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

    const userId1 = (connRow as any).requester_id as string;
    const userId2 = (connRow as any).receiver_id as string;

    // Auto-follow the requester when accepting a connection (receiver follows requester)
    await supabase.from("follows").upsert(
      { follower_id: userId2, following_id: userId1 },
      { onConflict: "follower_id,following_id" },
    );

    // Push to the requester (userId1) letting them know their request was accepted
    void _dispatchPush("/push/connection-accepted", { requesterId: userId1 });

    // Unlock any existing direct conversations between these two users
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

export async function fetchFollowersList(userId: string): Promise<UserListItem[]> {
  return fetchUserListForModal(userId, "followers", 100);
}

export async function fetchFollowingList(userId: string): Promise<UserListItem[]> {
  return fetchUserListForModal(userId, "following", 100);
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


export async function fetchProfileStats(userId: string): Promise<{ connections: number; followers: number; following: number }> {
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
    return {
      connections: connsRes.count ?? 0,
      followers:   followersRes.count ?? 0,
      following:   followingRes.count ?? 0,
    };
  } catch {
    return { connections: 0, followers: 0, following: 0 };
  }
}

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
      supabase.from("likes").select("post_id, reaction_type").eq("user_id", currentUserId).in("post_id", postIds),
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);
    const likedMap = new Map((likedRes.data ?? []).map((l: any) => [l.post_id, l.reaction_type ?? "curtir"]));
    const bookmarkedIds = new Set((bookmarkRes.data ?? []).map((b: any) => b.post_id));
    return (await attachAuthorsToPosts(data, profileMap, companyMap)).map((post: any) => ({
      ...post,
      is_liked: likedMap.has(post.id),
      reaction_type: likedMap.get(post.id) ?? null,
      is_bookmarked: bookmarkedIds.has(post.id),
    }));
  } catch (e) {
    console.warn("fetchProfilePosts:", e);
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


// ─── AVATAR UPLOAD ────────────────────────────────────────────────────────────

export async function uploadAvatar(userId: string, uri: string): Promise<string | null> {
  try {
    const compressed = await compressAvatar(uri);
    const safeExt = "jpg";
    const mime = "image/jpeg";
    const path = `${userId}/avatar.${safeExt}`;

    const response = await fetch(compressed);
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
    if (isNetworkError(e)) throw e;
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
