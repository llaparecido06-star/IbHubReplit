import { supabase } from "@/context/AuthContext";
import { API_URL, fetchCommentProfilesForIds } from "./_shared";
import type { AppNotification } from "./types";

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, actor_company_id, type, post_id, comment_id, message, read, created_at, metadata, target_company_id")
      .eq("user_id", userId)
      .is("target_company_id", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("fetchNotifications DB error:", JSON.stringify(error));
      return [];
    }
    if (!data) return [];

    const actorIds = [...new Set((data as any[]).map(n => n.actor_id).filter(Boolean))];
    const actorCompanyIds = [...new Set((data as any[]).map(n => n.actor_company_id).filter(Boolean))];

    // For connection notifications, fetch the corresponding connection record
    const connectionActorIds = (data as any[])
      .filter(n => n.type === "connection" && n.actor_id)
      .map(n => n.actor_id);

    const [profileMap, connectionsRes, companiesRes] = await Promise.all([
      fetchCommentProfilesForIds(actorIds),
      connectionActorIds.length > 0
        ? supabase
            .from("connections")
            .select("id, requester_id, receiver_id, status")
            .eq("receiver_id", userId)
            .in("requester_id", connectionActorIds)
        : Promise.resolve({ data: [] }),
      actorCompanyIds.length > 0
        ? supabase
            .from("company_pages")
            .select("id, name, avatar_url")
            .in("id", actorCompanyIds)
        : Promise.resolve({ data: [] }),
    ]);

    const connectionMap = new Map<string, { id: string; status: string }>();
    ((connectionsRes as any).data ?? []).forEach((c: any) => {
      connectionMap.set(c.requester_id, { id: c.id, status: c.status });
    });

    const companyMap = new Map<string, { id: string; name: string; avatar_url?: string | null }>();
    ((companiesRes as any).data ?? []).forEach((cp: any) => {
      companyMap.set(cp.id, { id: cp.id, name: cp.name, avatar_url: cp.avatar_url ?? null });
    });

    return (data as any[]).map(n => {
      const base = {
        ...n,
        actor: profileMap.get(n.actor_id) ?? null,
        actor_company: n.actor_company_id ? (companyMap.get(n.actor_company_id) ?? null) : null,
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
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .is("target_company_id", null)
    .eq("read", false);
}

export async function fetchCompanyNotifications(companyId: string): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, actor_company_id, type, post_id, comment_id, message, read, created_at, metadata, target_company_id")
      .eq("target_company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("fetchCompanyNotifications DB error:", JSON.stringify(error));
      return [];
    }
    if (!data) return [];

    const actorIds = [...new Set((data as any[]).map(n => n.actor_id).filter(Boolean))];
    const actorCompanyIds = [...new Set((data as any[]).map(n => n.actor_company_id).filter(Boolean))];

    const [profileMap, companiesRes] = await Promise.all([
      fetchCommentProfilesForIds(actorIds),
      actorCompanyIds.length > 0
        ? supabase.from("company_pages").select("id, name, avatar_url").in("id", actorCompanyIds)
        : Promise.resolve({ data: [] }),
    ]);

    const companyMap = new Map<string, { id: string; name: string; avatar_url?: string | null }>();
    ((companiesRes as any).data ?? []).forEach((cp: any) => {
      companyMap.set(cp.id, { id: cp.id, name: cp.name, avatar_url: cp.avatar_url ?? null });
    });

    return (data as any[]).map(n => ({
      ...n,
      actor: profileMap.get(n.actor_id) ?? null,
      actor_company: n.actor_company_id ? (companyMap.get(n.actor_company_id) ?? null) : null,
    })) as unknown as AppNotification[];
  } catch (e) {
    console.warn("fetchCompanyNotifications:", e);
    return [];
  }
}

export async function markAllCompanyNotificationsRead(companyId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("target_company_id", companyId)
    .eq("read", false);
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
  _senderId: string,
  senderName: string,
  messageBody: string,
): Promise<void> {
  if (!API_URL) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    // Server verifies caller is a participant, resolves recipients, and looks up
    // push tokens via service role. Client supplies conversationId only.
    await fetch(`${API_URL}/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        conversationId,
        title: senderName,
        body: messageBody,
        data: { conversationId },
      }),
    });
  } catch (e) {
    console.error("dispatchPushToConversation:", e);
  }
}
