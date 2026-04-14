import { supabase } from "@/lib/supabase";

// ─── Feed / Posts ──────────────────────────────────────────────────────────────

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
}

const POST_SELECT = `id, user_id, company_page_id, content, image_url, image_urls, video_url,
  likes_count, comments_count, shares_count, view_count, location, hashtags, created_at`;

async function _fetchProfilesMap(userIds: string[]): Promise<Map<string, any>> {
  if (!userIds.length) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, position, company, plan")
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
    } : undefined,
  };
}

export async function fetchFeedPosts(currentUserId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error || !data || !data.length) return [];

    const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))] as string[];
    const postIds = data.map((p: any) => p.id) as string[];

    const [profileMap, likedRes, bookmarkRes] = await Promise.all([
      _fetchProfilesMap(userIds),
      supabase.from("likes").select("post_id").eq("user_id", currentUserId).is("company_page_id", null).in("post_id", postIds),
      supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    ]);

    const likedIds = new Set((likedRes.data ?? []).map((l: any) => l.post_id));
    const bookmarkedIds = new Set((bookmarkRes.data ?? []).map((b: any) => b.post_id));

    return data.map((raw: any) => ({
      ..._normalisePost(raw, profileMap),
      is_liked: likedIds.has(raw.id),
      is_bookmarked: bookmarkedIds.has(raw.id),
    }));
  } catch (e) {
    console.warn("fetchFeedPosts:", e);
    return [];
  }
}

export async function createWebPost(params: {
  user_id: string;
  content: string;
  image_url?: string | null;
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

export async function toggleLikePost(postId: string, userId: string, isLiked: boolean): Promise<boolean> {
  try {
    if (isLiked) {
      await supabase.from("likes").delete().match({ post_id: postId, user_id: userId }).is("company_page_id", null);
      await supabase.rpc("decrement_post_likes", { p_post_id: postId });
    } else {
      await supabase.from("likes").insert({ post_id: postId, user_id: userId });
      await supabase.rpc("increment_post_likes", { p_post_id: postId });
    }
    return true;
  } catch (e) {
    console.warn("toggleLikePost:", e);
    return false;
  }
}

export async function fetchWebSuggestedConnections(currentUserId: string, limit = 5): Promise<SuggestedProfile[]> {
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
      .select("id, full_name, username, avatar_url, position, company, plan")
      .limit(60);

    if (!profiles) return [];

    return (profiles as any[])
      .filter((p: any) => !excludedIds.has(p.id))
      .slice(0, limit)
      .map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        username: p.username,
        avatar_url: p.avatar_url,
        headline: [p.position, p.company].filter(Boolean).join(" · ") || null,
        plan: p.plan ?? "gratuito",
        connection_status: statusMap.get(p.id) ?? "none",
      }));
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

export async function fetchProfileStats(userId: string): Promise<{ connections: number; followers: number; visits: number }> {
  try {
    const [connsRes, followsRes] = await Promise.all([
      supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", userId),
    ]);
    return {
      connections: connsRes.count ?? 0,
      followers: followsRes.count ?? 0,
      visits: 0,
    };
  } catch (e) {
    return { connections: 0, followers: 0, visits: 0 };
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
  qty: number;
  price?: number | null;
  buy_date?: string | null;
  drink_by?: string | null;
  storage?: string | null;
  notes?: string | null;
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
