import { supabase } from "@/context/AuthContext";

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
 * Uses `invited_by_id` column on profiles (added in migration v17/v42).
 *
 * NOTE: If the column does not yet exist in the database, apply
 * artifacts/api-server/migrations_v42_referral_columns.sql in the Supabase SQL editor.
 */
export async function fetchReferralLeaderboard(limit = 50): Promise<ReferralRankEntry[]> {
  try {
    // Cap the scan to a reasonable row count to avoid mobile network timeouts.
    // We fetch limit * 40 invited rows which is more than enough to rank the top inviters.
    const scanLimit = Math.max(limit * 40, 2000);

    const { data, error } = await supabase
      .from("profiles")
      .select("invited_by_id")
      .not("invited_by_id", "is", null)
      .limit(scanLimit);

    if (error) {
      // Distinguish column-missing / network errors so we don't spam Expo DevTools
      const isKnownTransient =
        !error.code ||
        error.code === "" ||
        error.message?.toLowerCase().includes("network") ||
        error.message?.toLowerCase().includes("42703"); // column does not exist
      if (isKnownTransient) {
        console.warn("fetchReferralLeaderboard: coluna invited_by_id indisponível ou erro de rede. Execute a migration v42 no painel Supabase.");
      } else {
        console.error("fetchReferralLeaderboard:", error);
      }
      return [];
    }

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

    if (pErr) {
      console.warn("fetchReferralLeaderboard (profiles):", pErr);
      return [];
    }

    return (profiles ?? [])
      .map((p) => ({
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
    console.warn("fetchReferralLeaderboard:", e);
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
    console.warn("fetchMyReferralStats:", e);
    return { count: 0, rank: 0 };
  }
}
