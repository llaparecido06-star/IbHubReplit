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
  todaySignups: number;
  yesterdaySignups: number;
  weekSignups: number;
}

export interface PlanPoint {
  plan: string;
  count: number;
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
  avatar_url?: string | null;
}

export interface ModerationPost {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  user_id: string;
  author_name?: string | null;
  is_pinned?: boolean;
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
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [usersRes, postsRes, storiesRes, subsRes, todayRes, yestRes, weekRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("stories").select("id", { count: "exact", head: true }).gt("expires_at", now.toISOString()),
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("plan", "gratuito"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", todayStart.toISOString()),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
  ]);

  return {
    totalUsers: usersRes.count ?? 0,
    totalPosts: postsRes.count ?? 0,
    activeStories: storiesRes.count ?? 0,
    activeSubscribers: subsRes.count ?? 0,
    todaySignups: todayRes.count ?? 0,
    yesterdaySignups: yestRes.count ?? 0,
    weekSignups: weekRes.count ?? 0,
  };
}

export async function fetchUserGrowth(): Promise<UserGrowthPoint[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const grouped: Record<string, number> = {};
  if (!error && data) {
    for (const row of data as { created_at: string }[]) {
      const day = row.created_at.slice(0, 10);
      grouped[day] = (grouped[day] ?? 0) + 1;
    }
  }

  const result: UserGrowthPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const day = d.toISOString().slice(0, 10);
    result.push({ date: day, count: grouped[day] ?? 0 });
  }
  return result;
}

export async function fetchPlanBreakdown(): Promise<PlanPoint[]> {
  const { data, error } = await supabase.from("profiles").select("plan");
  if (error || !data) return [];
  const grouped: Record<string, number> = {};
  for (const row of data as { plan: string | null }[]) {
    const p = row.plan ?? "gratuito";
    grouped[p] = (grouped[p] ?? 0) + 1;
  }
  return Object.entries(grouped)
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Credit Analytics ─────────────────────────────────────────────────────────

export interface CreditDailyPoint {
  date: string;
  ai_search: number;
  bi_reveal: number;
  total: number;
}

export interface CreditUserStat {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  plan: string | null;
  ai_search: number;
  bi_reveal: number;
  total: number;
  last_used: string;
}

export async function fetchCreditDailyStats(days = 30): Promise<CreditDailyPoint[]> {
  try {
    const res = await adminFetch(`/admin/credits/daily?days=${days}`);
    if (!res.ok) return [];
    const json = await res.json() as { daily: CreditDailyPoint[] };
    return json.daily ?? [];
  } catch {
    return [];
  }
}

export async function fetchCreditTopUsers(days = 30, limit = 20): Promise<CreditUserStat[]> {
  try {
    const res = await adminFetch(`/admin/credits/top-users?days=${days}&limit=${limit}`);
    if (!res.ok) return [];
    const json = await res.json() as { users: CreditUserStat[] };
    return json.users ?? [];
  } catch {
    return [];
  }
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

export async function pinPost(postId: string, isPinned: boolean): Promise<boolean> {
  try {
    const res = await adminFetch(`/admin/posts/${postId}/pin`, {
      method: "PATCH",
      body: JSON.stringify({ is_pinned: isPinned }),
    });
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

export type ActivityType =
  | "Cadastro"
  | "Curtida"
  | "Comentário"
  | "Publicação"
  | "Conexão"
  | "Seguiu"
  | "Chat"
  | "Mercado";

export interface ActivityLog {
  id: string;
  type: ActivityType;
  initial: string;
  text: string;
  iconColor: string;
  created_at: string;
  detail?: string | null;
}

export interface ActivityCounts {
  cadastros: number;
  curtidas: number;
  comentarios: number;
  publicacoes: number;
  conexoes: number;
  seguiu: number;
  chat: number;
  mercado: number;
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

function truncateDetail(s: string | null | undefined, max = 220): string | null {
  if (!s?.trim()) return null;
  const clean = s.trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

export async function fetchActivityLogs(days = 7): Promise<ActivityLog[]> {
  const since = days === 0 ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withPeriod(q: any): any {
    return since ? q.gte("created_at", since) : q;
  }

  const [regsRes, likesRes, followsRes, connRes, commentsRes, postsRes, messagesRes, marketRes] = await Promise.all([
    withPeriod(supabase.from("profiles").select("id, full_name, created_at")).order("created_at", { ascending: false }).limit(100),
    withPeriod(supabase.from("likes").select("id, created_at, post_id, profile:profiles!likes_user_id_fkey(full_name)")).order("created_at", { ascending: false }).limit(100),
    withPeriod(supabase.from("follows").select("id, created_at, following_id, profile:profiles!follows_follower_id_fkey(full_name)")).order("created_at", { ascending: false }).limit(100),
    withPeriod(supabase.from("connections").select("id, created_at, receiver_id, profile:profiles!connections_requester_id_fkey(full_name)")).order("created_at", { ascending: false }).limit(100),
    withPeriod(supabase.from("comments").select("id, created_at, user_id, content")).order("created_at", { ascending: false }).limit(100),
    withPeriod(supabase.from("posts").select("id, created_at, user_id, content")).order("created_at", { ascending: false }).limit(100),
    withPeriod(supabase.from("messages").select("id, created_at, sender_id, content").is("deleted_at", null)).order("created_at", { ascending: false }).limit(100),
    withPeriod(supabase.from("market_posts").select("id, created_at, author_id, content")).order("created_at", { ascending: false }).limit(100),
  ]);

  const directUserIds = [
    ...(commentsRes.data ?? []).map((r: any) => r.user_id),
    ...(postsRes.data ?? []).map((r: any) => r.user_id),
    ...(messagesRes.data ?? []).map((r: any) => r.sender_id),
    ...(marketRes.data ?? []).map((r: any) => r.author_id),
  ].filter(Boolean) as string[];

  const likedPostIds = [...new Set((likesRes.data ?? []).map((r: any) => r.post_id).filter(Boolean))] as string[];
  const followingIds = [...new Set((followsRes.data ?? []).map((r: any) => r.following_id).filter(Boolean))] as string[];
  const receiverIds  = [...new Set((connRes.data ?? []).map((r: any) => r.receiver_id).filter(Boolean))] as string[];

  const [profilesRes, likedPostsRes, followingProfilesRes, receiverProfilesRes] = await Promise.all([
    directUserIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", [...new Set(directUserIds)])
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    likedPostIds.length > 0
      ? supabase.from("posts").select("id, content").in("id", likedPostIds)
      : Promise.resolve({ data: [] as Array<{ id: string; content: string | null }> }),
    followingIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", followingIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    receiverIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", receiverIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
  ]);

  const profileMap = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>) {
    profileMap.set(p.id, p.full_name ?? "Usuário");
  }
  const likedPostMap = new Map<string, string | null>();
  for (const p of (likedPostsRes.data ?? []) as Array<{ id: string; content: string | null }>) {
    likedPostMap.set(p.id, p.content);
  }
  const followingProfileMap = new Map<string, string>();
  for (const p of (followingProfilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>) {
    followingProfileMap.set(p.id, p.full_name ?? "Usuário");
  }
  const receiverProfileMap = new Map<string, string>();
  for (const p of (receiverProfilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>) {
    receiverProfileMap.set(p.id, p.full_name ?? "Usuário");
  }

  const logs: ActivityLog[] = [];

  for (const row of ((regsRes.data ?? []) as Array<{ id: string; full_name: string | null; created_at: string }>)) {
    logs.push({ id: `reg-${row.id}`, type: "Cadastro", initial: getLogInitial(row.full_name), text: `${row.full_name ?? "Usuário"} se cadastrou na plataforma`, iconColor: "#059669", created_at: row.created_at, detail: null });
  }
  for (const row of ((likesRes.data ?? []) as Array<{ id: string; created_at: string; post_id: string | null; profile: unknown }>)) {
    const name = resolveProfileName(row.profile);
    const postContent = row.post_id ? likedPostMap.get(row.post_id) : null;
    logs.push({ id: `like-${row.id}`, type: "Curtida", initial: getLogInitial(name), text: `${name ?? "Usuário"} curtiu uma publicação`, iconColor: "#e11d48", created_at: row.created_at, detail: truncateDetail(postContent) });
  }
  for (const row of ((followsRes.data ?? []) as Array<{ id: string; created_at: string; following_id: string | null; profile: unknown }>)) {
    const name = resolveProfileName(row.profile);
    const targetName = row.following_id ? followingProfileMap.get(row.following_id) : null;
    logs.push({ id: `follow-${row.id}`, type: "Seguiu", initial: getLogInitial(name), text: `${name ?? "Usuário"} seguiu alguém`, iconColor: "#059669", created_at: row.created_at, detail: targetName ? `Seguiu: ${targetName}` : null });
  }
  for (const row of ((connRes.data ?? []) as Array<{ id: string; created_at: string; receiver_id: string | null; profile: unknown }>)) {
    const name = resolveProfileName(row.profile);
    const targetName = row.receiver_id ? receiverProfileMap.get(row.receiver_id) : null;
    logs.push({ id: `conn-${row.id}`, type: "Conexão", initial: getLogInitial(name), text: `${name ?? "Usuário"} enviou pedido de conexão`, iconColor: "#7c3aed", created_at: row.created_at, detail: targetName ? `Pedido enviado para: ${targetName}` : null });
  }
  for (const row of ((commentsRes.data ?? []) as Array<{ id: string; created_at: string; user_id: string; content: string | null }>)) {
    const name = profileMap.get(row.user_id) ?? "Usuário";
    logs.push({ id: `comment-${row.id}`, type: "Comentário", initial: getLogInitial(name), text: `${name} comentou em uma publicação`, iconColor: "#0ea5e9", created_at: row.created_at, detail: truncateDetail(row.content) });
  }
  for (const row of ((postsRes.data ?? []) as Array<{ id: string; created_at: string; user_id: string; content: string | null }>)) {
    const name = profileMap.get(row.user_id) ?? "Usuário";
    logs.push({ id: `post-${row.id}`, type: "Publicação", initial: getLogInitial(name), text: `${name} publicou no feed`, iconColor: "#f59e0b", created_at: row.created_at, detail: truncateDetail(row.content) });
  }
  for (const row of ((messagesRes.data ?? []) as Array<{ id: string; created_at: string; sender_id: string; content: string | null }>)) {
    const name = profileMap.get(row.sender_id) ?? "Usuário";
    logs.push({ id: `msg-${row.id}`, type: "Chat", initial: getLogInitial(name), text: `${name} enviou uma mensagem no chat`, iconColor: "#6366f1", created_at: row.created_at, detail: truncateDetail(row.content) });
  }
  for (const row of ((marketRes.data ?? []) as Array<{ id: string; created_at: string; author_id: string; content: string | null }>)) {
    const name = profileMap.get(row.author_id) ?? "Usuário";
    logs.push({ id: `market-${row.id}`, type: "Mercado", initial: getLogInitial(name), text: `${name} publicou no Mercado`, iconColor: "#c9a84c", created_at: row.created_at, detail: truncateDetail(row.content) });
  }

  logs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return logs;
}

export function computeActivityCounts(logs: ActivityLog[]): ActivityCounts {
  let cadastros = 0, curtidas = 0, comentarios = 0, publicacoes = 0, conexoes = 0, seguiu = 0, chat = 0, mercado = 0;
  for (const log of logs) {
    if (log.type === "Cadastro") cadastros++;
    else if (log.type === "Curtida") curtidas++;
    else if (log.type === "Comentário") comentarios++;
    else if (log.type === "Publicação") publicacoes++;
    else if (log.type === "Conexão") conexoes++;
    else if (log.type === "Seguiu") seguiu++;
    else if (log.type === "Chat") chat++;
    else if (log.type === "Mercado") mercado++;
  }
  return { cadastros, curtidas, comentarios, publicacoes, conexoes, seguiu, chat, mercado };
}

export interface UserCredits {
  credits_remaining: number;
  credits_total: number;
}

export async function getUserCredits(userId: string): Promise<UserCredits> {
  const res = await adminFetch(`/admin/users/${userId}/credits`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<UserCredits>;
}

export async function addUserCredits(userId: string, amount: number): Promise<UserCredits> {
  const res = await adminFetch(`/admin/users/${userId}/credits`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as UserCredits;
}

export async function getUserRevealCredits(userId: string): Promise<UserCredits> {
  const res = await adminFetch(`/admin/users/${userId}/reveal-credits`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<UserCredits>;
}

export async function addUserRevealCredits(userId: string, amount: number): Promise<UserCredits> {
  const res = await adminFetch(`/admin/users/${userId}/reveal-credits`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as UserCredits;
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await adminFetch("/admin/delete-user", {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    });
    const json = await res.json() as { success?: boolean; error?: string };
    if (!res.ok) return { success: false, error: json.error ?? `HTTP ${res.status}` };
    return { success: true };
  } catch {
    return { success: false, error: "Erro de rede" };
  }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export interface UserBadgeRow {
  id: string;
  user_id: string;
  badge_key: string;
  granted_by: string | null;
  notes: string | null;
  granted_at: string;
}

export async function fetchAllUserBadges(): Promise<UserBadgeRow[]> {
  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .order("granted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as UserBadgeRow[];
}

export async function fetchUserBadgesByUserId(userId: string): Promise<UserBadgeRow[]> {
  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .eq("user_id", userId)
    .order("granted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as UserBadgeRow[];
}

export async function grantBadge(
  userId: string,
  badgeKey: string,
  grantedBy: string,
  notes?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("user_badges")
    .insert({ user_id: userId, badge_key: badgeKey, granted_by: grantedBy, notes: notes ?? null });
  return !error;
}

export async function revokeBadge(badgeId: string): Promise<boolean> {
  const { error } = await supabase.from("user_badges").delete().eq("id", badgeId);
  return !error;
}

export interface BadgeDefinition {
  id: string;
  key: string;
  icon: string;
  label: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function fetchBadgeDefinitions(): Promise<BadgeDefinition[]> {
  const { data, error } = await supabase
    .from("badge_definitions")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BadgeDefinition[];
}

export async function createBadgeDefinition(
  def: Pick<BadgeDefinition, "key" | "icon" | "label" | "description">,
  sortOrder: number,
): Promise<BadgeDefinition | null> {
  const { data, error } = await supabase
    .from("badge_definitions")
    .insert({ ...def, is_active: true, sort_order: sortOrder })
    .select()
    .single();
  if (error) return null;
  return data as BadgeDefinition;
}

export async function updateBadgeDefinition(
  id: string,
  updates: Partial<Pick<BadgeDefinition, "icon" | "label" | "description" | "is_active" | "sort_order">>,
): Promise<boolean> {
  const { error } = await supabase
    .from("badge_definitions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteBadgeDefinition(id: string): Promise<boolean> {
  const { error } = await supabase.from("badge_definitions").delete().eq("id", id);
  return !error;
}

export interface DailyLoginEntry {
  id: string;
  full_name: string;
  avatar_url: string | null;
  last_sign_in_at: string | null;
}

export interface DailyLoginStats {
  todayCount: number;
  recentCount: number;
  recentLogins: DailyLoginEntry[];
}

export async function fetchDailyLoginStats(): Promise<DailyLoginStats> {
  const res = await adminFetch("/admin/daily-logins");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<DailyLoginStats>;
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
