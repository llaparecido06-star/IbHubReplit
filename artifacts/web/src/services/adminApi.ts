import { supabase, getCachedSession } from "@/lib/supabase";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const session = await getCachedSession();
  const token = session?.access_token ?? "";
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
  courtesy_until: string | null;
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
  segment: "all" | "gratuito" | "profissional" | "basico" | "empresa" | "executivo";
  deepLink?: string;
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
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("plan", "gratuito"),
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

export async function setUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await adminFetch("/admin/set-password", {
      method: "POST",
      body: JSON.stringify({ userId, newPassword }),
    });
    const json = await res.json() as { success?: boolean; error?: string };
    if (!res.ok) return { success: false, error: json.error ?? "Erro ao definir senha" };
    return { success: true };
  } catch {
    return { success: false, error: "Erro de rede" };
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

// ─── Reports (Denúncias) ──────────────────────────────────────────────────────

export interface AppReportPost {
  id: string;
  content: string | null;
  user_id: string;
}

export interface AppReportUser {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

export interface AppReport {
  id: string;
  post_id: string | null;
  reported_user_id?: string | null;
  reported_by: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reporter?: AppReportUser | null;
  post?: AppReportPost | null;
  reported_user?: AppReportUser | null;
}

export async function fetchPendingReports(): Promise<AppReport[]> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, post_id, reported_user_id, reported_by, reason, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return [];

    const rows = data as Array<{ id: string; post_id: string | null; reported_user_id: string | null; reported_by: string; reason: string; status: string; created_at: string }>;
    const reporterIds = [...new Set(rows.map(r => r.reported_by).filter(Boolean))];
    const reportedUserIds = [...new Set(rows.map(r => r.reported_user_id).filter(Boolean) as string[])];
    const postIds = [...new Set(rows.map(r => r.post_id).filter(Boolean) as string[])];
    const allProfileIds = [...new Set([...reporterIds, ...reportedUserIds])];

    const [profilesRes, postsRes] = await Promise.all([
      allProfileIds.length > 0
        ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", allProfileIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> }),
      postIds.length > 0
        ? supabase.from("posts").select("id, content, user_id").in("id", postIds)
        : Promise.resolve({ data: [] as Array<{ id: string; content: string | null; user_id: string }> }),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [p.id, p]));
    const postMap = new Map((postsRes.data ?? []).map((p: { id: string; content: string | null; user_id: string }) => [p.id, p]));

    return rows.map(r => ({
      ...r,
      reporter:      r.reported_by       ? (profileMap.get(r.reported_by)       ?? null) : null,
      reported_user: r.reported_user_id  ? (profileMap.get(r.reported_user_id!) ?? null) : null,
      post:          r.post_id           ? (postMap.get(r.post_id!)              ?? null) : null,
    })) as AppReport[];
  } catch (e) {
    console.warn("fetchPendingReports:", e);
    return [];
  }
}

export async function updateReportStatus(reportId: string, status: "approved" | "rejected"): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", reportId)
      .select("id");
    if (error || !data || (data as unknown[]).length === 0) return false;
    return true;
  } catch {
    return false;
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

export async function sendBroadcastPush(params: BroadcastParams): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await adminFetch("/admin/broadcast-push", {
      method: "POST",
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        segment: params.segment,
        deepLink: params.deepLink ?? null,
      }),
    });
    const json = await res.json() as { success?: boolean; sent?: number; total?: number; error?: string };
    if (!res.ok) return { success: false, message: json.error ?? "Erro ao enviar push." };
    return {
      success: true,
      message: `Push enviado para ${json.sent ?? 0}/${json.total ?? 0} dispositivo(s).`,
    };
  } catch {
    return { success: false, message: "Erro de rede ao enviar push." };
  }
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

export type ActivityType = "Cadastro" | "Curtida" | "Conexão" | "Seguiu";

export interface ActivityLog {
  id: string;
  type: ActivityType;
  initial: string;
  text: string;
  iconColor: string;
  created_at: string;
}

export interface ActivityCounts {
  cadastros: number;
  curtidas: number;
  conexoes: number;
  seguiu: number;
}

function getLogInitial(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function resolveProfileName(profile: unknown): string | null {
  if (!profile) return null;
  if (Array.isArray(profile)) return (profile as Array<{ full_name: string | null }>)[0]?.full_name ?? null;
  return (profile as { full_name: string | null }).full_name;
}

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [regsRes, likesRes, followsRes, connRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("likes").select("id, created_at, profile:profiles!likes_user_id_fkey(full_name)").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("follows").select("id, created_at, profile:profiles!follows_follower_id_fkey(full_name)").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("connections").select("id, created_at, profile:profiles!connections_requester_id_fkey(full_name)").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
  ]);

  const logs: ActivityLog[] = [];

  for (const row of ((regsRes.data ?? []) as Array<{ id: string; full_name: string | null; created_at: string }>)) {
    logs.push({ id: `reg-${row.id}`, type: "Cadastro", initial: getLogInitial(row.full_name), text: `${row.full_name ?? "Usuário"} se cadastrou na plataforma`, iconColor: "#059669", created_at: row.created_at });
  }
  for (const row of ((likesRes.data ?? []) as Array<{ id: string; created_at: string; profile: unknown }>)) {
    const name = resolveProfileName(row.profile);
    logs.push({ id: `like-${row.id}`, type: "Curtida", initial: getLogInitial(name), text: `${name ?? "Usuário"} curtiu um post`, iconColor: "#e11d48", created_at: row.created_at });
  }
  for (const row of ((followsRes.data ?? []) as Array<{ id: string; created_at: string; profile: unknown }>)) {
    const name = resolveProfileName(row.profile);
    logs.push({ id: `follow-${row.id}`, type: "Seguiu", initial: getLogInitial(name), text: `${name ?? "Usuário"} seguiu alguém`, iconColor: "#059669", created_at: row.created_at });
  }
  for (const row of ((connRes.data ?? []) as Array<{ id: string; created_at: string; profile: unknown }>)) {
    const name = resolveProfileName(row.profile);
    logs.push({ id: `conn-${row.id}`, type: "Conexão", initial: getLogInitial(name), text: `${name ?? "Usuário"} enviou pedido de conexão`, iconColor: "#7c3aed", created_at: row.created_at });
  }

  logs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return logs;
}

export function computeActivityCounts(logs: ActivityLog[]): ActivityCounts {
  let cadastros = 0, curtidas = 0, conexoes = 0, seguiu = 0;
  for (const log of logs) {
    if (log.type === "Cadastro") cadastros++;
    else if (log.type === "Curtida") curtidas++;
    else if (log.type === "Conexão") conexoes++;
    else if (log.type === "Seguiu") seguiu++;
  }
  return { cadastros, curtidas, conexoes, seguiu };
}

export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
