import { supabase } from "@/context/AuthContext";
import { API_URL } from "./_shared";

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
  is_pending?: boolean;
}

export async function fetchGroups(userId: string, activeCompanyId?: string | null): Promise<{ mine: Group[]; explore: Group[] }> {
  try {
    // Fetch memberships scoped to the current identity (personal or company)
    const membershipsQuery = activeCompanyId
      ? supabase.from("group_members").select("group_id, role").eq("user_id", userId).eq("company_page_id", activeCompanyId)
      : supabase.from("group_members").select("group_id, role").eq("user_id", userId).is("company_page_id", null);

    const [groupsRes, membershipsRes] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      membershipsQuery,
    ]);
    if (groupsRes.error) throw groupsRes.error;
    // If the memberships query fails, throw instead of silently treating all
    // groups as "not joined" — that would hide pending badges and let the user
    // try to re-request a group they already have a pending row for.
    if (membershipsRes.error) throw membershipsRes.error;
    const membershipMap = new Map<string, string>(
      (membershipsRes.data ?? []).map((m: any) => [m.group_id, m.role])
    );
    const groups = (groupsRes.data ?? []) as any[];
    // Exclude pending members from count (they haven't been approved yet)
    const countResults = await Promise.all(
      groups.map(g =>
        supabase.from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", g.id).neq("role", "pending")
      )
    );
    const enriched: Group[] = groups.map((g, i) => {
      const role = membershipMap.get(g.id);
      return {
        ...g,
        member_count: countResults[i].count ?? 0,
        is_member:  role !== undefined && role !== "pending",
        is_pending: role === "pending",
        is_owner:   g.owner_id === userId,
      };
    });
    return {
      // Full members + owners (is_owner covers the edge case where the user is
      // the group owner but switched to a company identity: their personal
      // membership (company_page_id=null) is not matched by the company-scoped
      // membership query, so is_member=false even though they own the group).
      mine:    enriched.filter(g => g.is_member || g.is_owner),
      // Pending users appear in explore with is_pending=true so they can see the status badge
      // restrito groups are hidden from search/explore — only visible to members
      explore: enriched.filter(g => !g.is_member && !g.is_owner && g.access !== "restrito"),
    };
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
}, accessToken?: string): Promise<Group | null> {
  try {
    let token = accessToken;
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    }
    if (!token) return null;
    const res = await fetch(`${API_URL}/community/groups`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) { console.error("createGroup:", res.status); return null; }
    const body = await res.json() as { group: Group };
    return body.group;
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

export async function joinGroup(groupId: string, userId: string, companyPageId?: string | null): Promise<boolean> {
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
  } catch { return false; }
}

// Inserts a "pending" membership — does NOT grant chat access until admin approves.
// Returns "ok" | "already_pending" | "already_member" | "error"
export type RequestJoinResult = "ok" | "already_pending" | "already_member" | "error";
export async function requestGroupJoin(groupId: string, userId: string, companyPageId?: string | null): Promise<RequestJoinResult> {
  try {
    const cpId = companyPageId ?? null;

    // Pre-check for an existing row before attempting INSERT to give a clear,
    // actionable result instead of a generic unique-constraint error.
    const existingQ = cpId
      ? supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", userId).eq("company_page_id", cpId).maybeSingle()
      : supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", userId).is("company_page_id", null).maybeSingle();
    const { data: existing } = await existingQ;
    if (existing) {
      const role = (existing as any).role as string;
      if (role === "pending") return "already_pending";
      return "already_member";
    }

    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: userId, role: "pending", company_page_id: cpId });
    if (error) { console.warn("requestGroupJoin:", error); return "error"; }
    return "ok";
  } catch { return "error"; }
}

// Admin approves a pending member — handled server-side to bypass RLS.
export async function approveGroupMember(groupId: string, memberId: string): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return false;
    const res = await fetch(`${API_URL}/community/groups/${groupId}/members/${memberId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) { console.error("approveGroupMember:", res.status, await res.text()); return false; }
    return true;
  } catch (e) { console.error("approveGroupMember:", e); return false; }
}

// Admin rejects a pending member — removes the pending group_members row.
export async function rejectGroupMember(groupId: string, memberId: string): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return false;
    const res = await fetch(`${API_URL}/community/groups/${groupId}/members/${memberId}/reject`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) { console.error("rejectGroupMember:", res.status, await res.text()); return false; }
    return true;
  } catch (e) { console.error("rejectGroupMember:", e); return false; }
}

export async function notifyGroupJoinRequest(groupId: string): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;
    await fetch(`${API_URL}/community/groups/${groupId}/notify-request`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.warn("notifyGroupJoinRequest:", e);
  }
}

export async function leaveGroup(groupId: string, userId: string, companyPageId?: string | null): Promise<boolean> {
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
  } catch { return false; }
}
