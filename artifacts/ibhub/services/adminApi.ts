import { supabase } from "@/context/AuthContext";

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

export type ActivityType = "Cadastro" | "Curtida" | "Conexão" | "Seguiu";

export interface ActivityLog {
  id: string;
  type: ActivityType;
  initial: string;
  text: string;
  icon: "user-plus" | "heart" | "user-check" | "users";
  iconColor: string;
  created_at: string;
}

export interface ActivityCounts {
  cadastros: number;
  curtidas: number;
  conexoes: number;
  seguiu: number;
}

// ─── Private row types (for Supabase query results) ──────────────────────────

interface ProfileNameRow {
  full_name: string | null;
}

interface ProfileRow extends ProfileNameRow {
  id: string;
  created_at: string;
}

interface PostTypeRow {
  image_url: string | null;
  poll: Record<string, unknown> | null;
}

interface LikeRow {
  id: string;
  created_at: string;
  profile: ProfileNameRow | ProfileNameRow[] | null;
}

interface FollowRow {
  id: string;
  created_at: string;
  profile: ProfileNameRow | ProfileNameRow[] | null;
}

interface ConnectionRow {
  id: string;
  created_at: string;
  profile: ProfileNameRow | ProfileNameRow[] | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getInitial(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function resolveProfileName(
  profile: ProfileNameRow | ProfileNameRow[] | null
): string | null {
  if (!profile) return null;
  if (Array.isArray(profile)) return profile[0]?.full_name ?? null;
  return profile.full_name;
}

// ─── KPI Queries ─────────────────────────────────────────────────────────────

export async function fetchAdminStats(): Promise<AdminStats> {
  const now = new Date().toISOString();

  const [usersRes, postsRes, storiesRes, subsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase
      .from("stories")
      .select("id", { count: "exact", head: true })
      .gt("expires_at", now),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("plan", "gratuito"),
  ]);

  return {
    totalUsers: usersRes.count ?? 0,
    totalPosts: postsRes.count ?? 0,
    activeStories: storiesRes.count ?? 0,
    activeSubscribers: subsRes.count ?? 0,
  };
}

// ─── User Growth (last 30 days, grouped by date) ──────────────────────────────

export async function fetchUserGrowth(): Promise<UserGrowthPoint[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return [];

  const grouped: Record<string, number> = {};
  for (const row of data as Pick<ProfileRow, "created_at">[]) {
    const day = row.created_at.slice(0, 10);
    grouped[day] = (grouped[day] ?? 0) + 1;
  }

  return Object.entries(grouped).map(([date, count]) => ({ date, count }));
}

// ─── Posts by Type ────────────────────────────────────────────────────────────

export async function fetchPostsByType(): Promise<PostsByTypePoint[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("image_url, poll");

  if (error || !data) return [];

  let texto = 0;
  let enquete = 0;
  let imagem = 0;

  for (const row of data as PostTypeRow[]) {
    if (row.poll != null) {
      enquete += 1;
    } else if (row.image_url) {
      imagem += 1;
    } else {
      texto += 1;
    }
  }

  return [
    { label: "Texto", v: texto },
    { label: "Enquete", v: enquete },
    { label: "Imagem", v: imagem },
  ];
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [regsRes, likesRes, followsRes, connRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("likes")
      .select("id, created_at, profile:profiles!likes_user_id_fkey(full_name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("follows")
      .select("id, created_at, profile:profiles!follows_follower_id_fkey(full_name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("connections")
      .select("id, created_at, profile:profiles!connections_requester_id_fkey(full_name)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const logs: ActivityLog[] = [];

  for (const row of (regsRes.data ?? []) as ProfileRow[]) {
    logs.push({
      id: `reg-${row.id}`,
      type: "Cadastro",
      initial: getInitial(row.full_name),
      text: `${row.full_name ?? "Usuário"} se cadastrou na plataforma`,
      icon: "user-plus",
      iconColor: "#059669",
      created_at: row.created_at,
    });
  }

  for (const row of (likesRes.data ?? []) as LikeRow[]) {
    const name = resolveProfileName(row.profile);
    logs.push({
      id: `like-${row.id}`,
      type: "Curtida",
      initial: getInitial(name),
      text: `${name ?? "Usuário"} curtiu um post`,
      icon: "heart",
      iconColor: "#e11d48",
      created_at: row.created_at,
    });
  }

  for (const row of (followsRes.data ?? []) as FollowRow[]) {
    const name = resolveProfileName(row.profile);
    logs.push({
      id: `follow-${row.id}`,
      type: "Seguiu",
      initial: getInitial(name),
      text: `${name ?? "Usuário"} seguiu alguém`,
      icon: "user-check",
      iconColor: "#059669",
      created_at: row.created_at,
    });
  }

  for (const row of (connRes.data ?? []) as ConnectionRow[]) {
    const name = resolveProfileName(row.profile);
    logs.push({
      id: `conn-${row.id}`,
      type: "Conexão",
      initial: getInitial(name),
      text: `${name ?? "Usuário"} enviou pedido de conexão`,
      icon: "users",
      iconColor: "#7c3aed",
      created_at: row.created_at,
    });
  }

  logs.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return logs;
}

// ─── Activity counts for KPIs ────────────────────────────────────────────────

export function computeActivityCounts(logs: ActivityLog[]): ActivityCounts {
  let cadastros = 0;
  let curtidas = 0;
  let conexoes = 0;
  let seguiu = 0;

  for (const log of logs) {
    if (log.type === "Cadastro") cadastros += 1;
    else if (log.type === "Curtida") curtidas += 1;
    else if (log.type === "Conexão") conexoes += 1;
    else if (log.type === "Seguiu") seguiu += 1;
  }

  return { cadastros, curtidas, conexoes, seguiu };
}

// ─── Relative time helper ─────────────────────────────────────────────────────

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
