import { supabase } from "@/context/AuthContext";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

async function getAdminHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface AdminUser {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  plan: string;
  areas_of_expertise: string[] | null;
  created_at: string;
  is_banned: boolean;
  is_shadowbanned: boolean;
}

export async function fetchAdminUsers(search?: string): Promise<AdminUser[]> {
  const headers = await getAdminHeaders();
  const params = new URLSearchParams({ limit: "200" });
  if (search) params.set("search", search);
  const res = await fetch(`${API_URL}/admin/users?${params.toString()}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.users as AdminUser[];
}

export async function generateResetLink(userId: string): Promise<string> {
  const headers = await getAdminHeaders();
  const res = await fetch(`${API_URL}/admin/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.resetLink as string;
}

export interface AdminUserByEmail {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  plan: string;
  courtesy_until: string | null;
}

export async function fetchUserByEmail(email: string): Promise<AdminUserByEmail> {
  const headers = await getAdminHeaders();
  const res = await fetch(
    `${API_URL}/admin/user-by-email?email=${encodeURIComponent(email)}`,
    { headers }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.user as AdminUserByEmail;
}

export async function banUser(userId: string, ban: boolean): Promise<void> {
  const headers = await getAdminHeaders();
  const res = await fetch(`${API_URL}/admin/ban-user`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, ban }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export async function shadowbanUser(userId: string, shadowban: boolean): Promise<void> {
  const headers = await getAdminHeaders();
  const res = await fetch(`${API_URL}/admin/shadowban-user`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, shadowban }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export async function changeUserPlan(userId: string, plan: string, isCourtesy?: boolean): Promise<void> {
  const headers = await getAdminHeaders();
  const res = await fetch(`${API_URL}/admin/change-plan`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, plan, isCourtesy }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
}

export async function broadcastPushNotification(params: {
  title: string;
  body: string;
  segment: string;
  deepLink?: string;
  logId?: string;
}): Promise<{ sent: number; total: number }> {
  const headers = await getAdminHeaders();
  const res = await fetch(`${API_URL}/admin/broadcast-push`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: params.title,
      body: params.body,
      segment: params.segment,
      deepLink: params.deepLink || undefined,
      logId: params.logId,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return { sent: json.sent ?? 0, total: json.total ?? 0 };
}
