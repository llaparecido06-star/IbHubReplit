import { supabase } from "@/lib/supabase";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  activeStories: number;
  activeSubscribers: number;
}

export interface UserGrowthPoint {
  date: string;
  count: number;
}

export interface PostsByTypePoint {
  label: string;
  v: number;
}

export interface AdminUser {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  plan: string;
  is_admin: boolean;
  is_banned: boolean;
  is_shadowbanned: boolean;
  areas_of_expertise: string[] | null;
  created_at: string;
}

export interface ModerationPost {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  user_id: string;
  author_name?: string | null;
}

export interface BroadcastParams {
  title: string;
  body: string;
  segment: "all" | "profissional" | "empresarial" | "premium" | "basico";
}

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  segment: string;
  sent_at: string;
  sent_count?: number;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function fetchAdminStats(): Promise<AdminStats> {
  const now = new Date().toISOString();

  const [usersRes, postsRes, storiesRes, subsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("stories").select("id", { count: "exact", head: true }).gt("expires_at", now),
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("plan", "basico"),
  ]);

  return {
    totalUsers: usersRes.count ?? 0,
    totalPosts: postsRes.count ?? 0,
    activeStories: storiesRes.count ?? 0,
    activeSubscribers: subsRes.count ?? 0,
  };
}

export async function fetchUserGrowth(): Promise<UserGrowthPoint[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return [];

  const grouped: Record<string, number> = {};
  for (const row of data as { created_at: string }[]) {
    const day = row.created_at.slice(0, 10);
    grouped[day] = (grouped[day] ?? 0) + 1;
  }

  return Object.entries(grouped).map(([date, count]) => ({ date, count }));
}

export async function fetchPostsByType(): Promise<PostsByTypePoint[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("image_url, poll");

  if (error || !data) return [];

  let texto = 0;
  let enquete = 0;
  let imagem = 0;

  type PostRow = { image_url: string | null; poll: Record<string, unknown> | null };
  for (const row of data as PostRow[]) {
    if (row.poll && typeof row.poll === "object") enquete++;
    else if (row.image_url) imagem++;
    else texto++;
  }

  return [
    { label: "Texto", v: texto },
    { label: "Imagem", v: imagem },
    { label: "Enquete", v: enquete },
  ];
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function fetchAdminUsers(search?: string): Promise<AdminUser[]> {
  try {
    const url = search
      ? `/admin/users?search=${encodeURIComponent(search)}&limit=200`
      : `/admin/users?limit=200`;
    const res = await adminFetch(url);
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { users: AdminUser[] };
    return json.users ?? [];
  } catch {
    return [];
  }
}

export async function banUser(userId: string, ban: boolean): Promise<boolean> {
  try {
    const res = await adminFetch("/admin/ban-user", {
      method: "POST",
      body: JSON.stringify({ userId, ban }),
    });
    if (!res.ok) return false;
    const json = await res.json() as { success?: boolean };
    return !!json.success;
  } catch {
    return false;
  }
}

export async function changeUserPlan(userId: string, plan: string, isCourtesy?: boolean): Promise<boolean> {
  try {
    const res = await adminFetch("/admin/change-plan", {
      method: "POST",
      body: JSON.stringify({ userId, plan, isCourtesy }),
    });
    if (!res.ok) return false;
    const json = await res.json() as { success?: boolean };
    return !!json.success;
  } catch {
    return false;
  }
}

export async function shadowbanUser(userId: string, shadowban: boolean): Promise<boolean> {
  try {
    const res = await adminFetch("/admin/shadowban-user", {
      method: "POST",
      body: JSON.stringify({ userId, shadowban }),
    });
    if (!res.ok) return false;
    const json = await res.json() as { success?: boolean };
    return !!json.success;
  } catch {
    return false;
  }
}

export async function resetUserPassword(userId: string): Promise<{ success: boolean; resetLink?: string; error?: string }> {
  try {
    const res = await adminFetch("/admin/reset-password", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    const json = await res.json() as { resetLink?: string; error?: string };
    if (!res.ok) return { success: false, error: json.error ?? "Erro ao gerar link" };
    return { success: true, resetLink: json.resetLink };
  } catch {
    return { success: false, error: "Erro de rede" };
  }
}

// ─── Content Moderation ───────────────────────────────────────────────────────

export async function fetchRecentPosts(limit = 100, search?: string): Promise<ModerationPost[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search) params.set("search", search);
    const res = await adminFetch(`/admin/posts?${params}`);
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { posts: ModerationPost[] };
    return json.posts ?? [];
  } catch {
    return [];
  }
}

export async function deletePost(postId: string): Promise<boolean> {
  try {
    const res = await adminFetch(`/admin/posts/${postId}`, { method: "DELETE" });
    if (!res.ok) return false;
    const json = await res.json() as { success?: boolean };
    return !!json.success;
  } catch {
    return false;
  }
}

// ─── Notifications Broadcast ──────────────────────────────────────────────────

export async function fetchNotificationLogs(): Promise<NotificationLog[]> {
  const { data, error } = await supabase
    .from("notification_broadcasts")
    .select("id, title, body, segment, sent_at, sent_count")
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data as NotificationLog[];
}

export async function sendBroadcastNotification(params: BroadcastParams): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await adminFetch("/admin/broadcast-notification", {
      method: "POST",
      body: JSON.stringify({ title: params.title, body: params.body, segment: params.segment }),
    });
    const json = await res.json() as { success?: boolean; message?: string; count?: number; error?: string };
    if (!res.ok) return { success: false, message: json.error ?? "Erro ao enviar notificação." };
    return {
      success: true,
      message: json.message ?? `Notificação enviada para ${json.count ?? 0} usuário(s).`,
    };
  } catch {
    return { success: false, message: "Erro de rede ao enviar notificação." };
  }
}
