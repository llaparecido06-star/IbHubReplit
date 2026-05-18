import { supabase } from "@/context/AuthContext";
import { API_URL } from "./_shared";

// ─── MARKET PRESENTATIONS ────────────────────────────────────────────────────

export interface MarketPresentation {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  content_url: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchMarketPresentations(): Promise<MarketPresentation[]> {
  try {
    const { data, error } = await supabase
      .from("market_presentations")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as MarketPresentation[];
  } catch (e) {
    console.error("fetchMarketPresentations:", e);
    return [];
  }
}

export async function fetchAllMarketPresentations(): Promise<MarketPresentation[]> {
  try {
    const { data, error } = await supabase
      .from("market_presentations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as MarketPresentation[];
  } catch (e) {
    console.error("fetchAllMarketPresentations:", e);
    return [];
  }
}

export async function upsertMarketPresentation(
  payload: Omit<MarketPresentation, "id" | "created_at" | "updated_at"> & { id?: string },
): Promise<MarketPresentation | null> {
  try {
    const { data, error } = await supabase
      .from("market_presentations")
      .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select()
      .single();
    if (error) { console.error("upsertMarketPresentation:", error); return null; }
    return data as MarketPresentation;
  } catch (e) {
    console.error("upsertMarketPresentation:", e);
    return null;
  }
}

export async function deleteMarketPresentation(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("market_presentations").delete().eq("id", id);
    if (error) { console.error("deleteMarketPresentation:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteMarketPresentation:", e);
    return false;
  }
}

// ─── PRESENTATION SLIDES ─────────────────────────────────────────────────────

export interface PresentationSlide {
  slide_id: string;
  sequence_order: number;
  url: string | null;
  locked: boolean;
}

export interface PresentationSlidesResult {
  slides: PresentationSlide[];
  total: number;
  unlocked: number;
}

export async function fetchPresentationSlides(
  presentationId: string,
  token: string,
): Promise<PresentationSlidesResult> {
  try {
    const res = await fetch(`${API_URL}/presentations/${presentationId}/slides`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { slides: [], total: 0, unlocked: 0 };
    const json = await res.json();
    return {
      slides: json.slides ?? [],
      total: json.total ?? 0,
      unlocked: json.unlocked ?? 0,
    };
  } catch (e) {
    console.error("fetchPresentationSlides:", e);
    return { slides: [], total: 0, unlocked: 0 };
  }
}

export async function triggerPresentationAccess(
  presentationId: string,
  token: string,
): Promise<void> {
  try {
    await fetch(`${API_URL}/presentations/${presentationId}/access`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.error("triggerPresentationAccess:", e);
  }
}

// ─── MARKET PERMISSIONS ──────────────────────────────────────────────────────

export interface MarketPermission {
  id: string;
  title: string;
  icon: string;
  sort_order: number;
  section_type: string;
  periods?: string[];
  font_size?: number;
}

export async function fetchMarketPermissions(): Promise<MarketPermission[]> {
  try {
    const { data, error } = await supabase
      .from("market_permissions")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) { console.error("fetchMarketPermissions:", error); return []; }
    return (data ?? []) as MarketPermission[];
  } catch (e) {
    console.error("fetchMarketPermissions:", e);
    return [];
  }
}

export async function createMarketPermission(
  perm: Omit<MarketPermission, "sort_order"> & { sort_order?: number },
): Promise<MarketPermission | null> {
  try {
    const { data, error } = await supabase
      .from("market_permissions")
      .insert(perm)
      .select()
      .single();
    if (error) { console.error("createMarketPermission:", error); return null; }
    return data as MarketPermission;
  } catch (e) {
    console.error("createMarketPermission:", e);
    return null;
  }
}

export async function updateMarketPermission(
  id: string,
  updates: Partial<Omit<MarketPermission, "id">>,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("market_permissions")
      .update(updates)
      .eq("id", id);
    if (error) { console.error("updateMarketPermission:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateMarketPermission:", e);
    return false;
  }
}

export async function deleteMarketPermission(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("market_permissions")
      .delete()
      .eq("id", id);
    if (error) { console.error("deleteMarketPermission:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteMarketPermission:", e);
    return false;
  }
}

export async function fetchPlanFeatures(planId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("plans")
      .select("features")
      .eq("id", planId)
      .maybeSingle();
    if (error || !data) return [];
    return (data.features ?? []) as string[];
  } catch {
    return [];
  }
}

// ─── MARKET OVERVIEW ─────────────────────────────────────────────────────────

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

export interface MarketChartArea {
  exports: number[];
  imports: number[];
  labels: string[];
  yLabels: string[];
}

export interface MarketChartBar {
  values: number[];
  labels: string[];
}

export interface MarketTendencia {
  title: string;
  desc: string;
  change: number;
  pos: boolean;
}

export interface MarketRegiao {
  rank: number;
  name: string;
  volume: string;
  pct: number;
}

export interface MarketVariedade {
  name: string;
  volume: string;
  change: number;
}

export interface MarketOverview {
  period: "mes" | "trimestre" | "ano";
  kpis: MarketKPI[];
  chart_area: MarketChartArea;
  chart_bar: MarketChartBar;
  tendencias: MarketTendencia[];
  regioes: MarketRegiao[];
  variedades: MarketVariedade[];
  updated_at: string;
  [key: string]: unknown;
}

export async function updateMarketOverview(
  period: "mes" | "trimestre" | "ano",
  updates: Partial<Omit<MarketOverview, "period" | "updated_at">>,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("market_overview")
      .upsert(
        { period, ...updates, updated_at: new Date().toISOString() },
        { onConflict: "period" },
      );
    if (error) { console.error("updateMarketOverview:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateMarketOverview:", e);
    return false;
  }
}

export async function fetchMarketOverview(
  period: "mes" | "trimestre" | "ano",
): Promise<MarketOverview | null> {
  try {
    const { data, error } = await supabase
      .from("market_overview")
      .select("*")
      .eq("period", period)
      .single();
    if (error || !data) return null;
    return data as MarketOverview;
  } catch (e) {
    console.error("fetchMarketOverview:", e);
    return null;
  }
}


// ─── Ideal.BI Market Feed ──────────────────────────────────────────────────────

export interface MarketPollOption {
  id: string;
  text: string;
  votes_count: number;
}

export interface MarketPost {
  id: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  poll_options?: MarketPollOption[] | null;
  poll_allow_multiple?: boolean;
  created_at: string;
  author_id: string;
  company_page_id?: string | null;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
  reaction_type?: string | null;
  user_poll_votes?: string[] | null;
  author?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    headline?: string | null;
  };
}

export interface MarketComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
  reply_to_id?: string | null;
  replies?: MarketComment[];
  author?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    position?: string | null;
    company?: string | null;
  };
}

export interface MarketPostLiker {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  position?: string | null;
  company?: string | null;
  reaction_type?: string | null;
}

export async function fetchMarketPosts(userId?: string, offset = 0, limit = 15): Promise<MarketPost[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return [];
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const res = await fetch(`${API_URL}/market/posts?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];
    const json = await res.json() as { posts: any[] };
    const data = json.posts ?? [];
    if (data.length === 0) return [];

    // All market posts belong to the Ideal.BI company page (stored as company_page_id in DB).
    // Resolve the company page data from the IDs present in the returned posts.
    const companyPageIds = [...new Set(data.map((p: any) => p.company_page_id).filter(Boolean))];

    const [likesRes, votesRes, companyRes] = await Promise.all([
      userId
        ? supabase.from("market_post_likes").select("post_id, reaction_type").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      userId
        ? supabase.from("market_post_poll_votes").select("post_id, option_id").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      companyPageIds.length > 0
        ? supabase.from("company_pages").select("id, name, avatar_url").in("id", companyPageIds)
        : supabase.from("company_pages").select("id, name, avatar_url").ilike("name", "Ideal.BI").maybeSingle(),
    ]);

    const likedMap = new Map<string, string | null>(
      ((likesRes as any).data ?? []).map((l: any) => [l.post_id as string, (l.reaction_type as string | null) ?? "saude"])
    );
    const pollVoteMap = new Map<string, string[]>();
    for (const v of ((votesRes as any).data ?? [])) {
      const arr = pollVoteMap.get(v.post_id as string) ?? [];
      arr.push(v.option_id as string);
      pollVoteMap.set(v.post_id as string, arr);
    }

    // Build company map (by id) — or use the single ilike result as fallback
    const companyMap = new Map<string, { id: string; name: string; avatar_url: string | null }>();
    const companyData = (companyRes as any).data;
    if (Array.isArray(companyData)) {
      for (const c of companyData) companyMap.set(c.id, c);
    } else if (companyData?.id) {
      companyMap.set(companyData.id, companyData);
    }

    // All posts in this feed are from Ideal.BI — use any resolved company as the
    // universal author, including for posts where company_page_id is still null
    // (e.g. posts created before the backfill migration was applied).
    const idealbiCompany = [...companyMap.values()][0] ?? null;
    const universalAuthor = idealbiCompany
      ? { id: idealbiCompany.id, full_name: idealbiCompany.name, avatar_url: idealbiCompany.avatar_url, headline: "Inteligência de Mercado do Vinho" }
      : { id: "idealbi", full_name: "Ideal.BI", avatar_url: null, headline: "Inteligência de Mercado do Vinho" };

    return data.map((p: any) => {
      const company = p.company_page_id ? (companyMap.get(p.company_page_id) ?? idealbiCompany) : idealbiCompany;
      const author = company
        ? { id: company.id, full_name: company.name, avatar_url: company.avatar_url, headline: "Inteligência de Mercado do Vinho" }
        : universalAuthor;
      const votes = pollVoteMap.get(p.id);
      return { ...p, user_liked: likedMap.has(p.id), reaction_type: likedMap.get(p.id) ?? null, user_poll_votes: votes?.length ? votes : null, poll_allow_multiple: p.poll_allow_multiple ?? false, author };
    });
  } catch { return []; }
}

export async function createMarketPost(
  authorId: string,
  content: string,
  imageUrl?: string | null,
  videoUrl?: string | null,
  pollOptions?: MarketPollOption[] | null,
  pollAllowMultiple?: boolean,
): Promise<MarketPost | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch(`${API_URL}/market/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        image_url: imageUrl ?? null,
        video_url: videoUrl ?? null,
        poll_options: pollOptions && pollOptions.length > 0 ? pollOptions : null,
        poll_allow_multiple: pollAllowMultiple ?? false,
      }),
    });
    if (!res.ok) return null;
    const body = await res.json() as { post: MarketPost };
    const newPost = body.post;

    // Resolve the Ideal.BI company page so the card shows the correct avatar immediately,
    // without waiting for a full feed refresh.
    let author: MarketPost["author"];
    try {
      const companyQuery = newPost.company_page_id
        ? supabase.from("company_pages").select("id, name, avatar_url").eq("id", newPost.company_page_id).maybeSingle()
        : supabase.from("company_pages").select("id, name, avatar_url").ilike("name", "Ideal.BI").order("created_at", { ascending: true }).limit(1).maybeSingle();
      const { data: company } = await companyQuery;
      if (company) {
        author = { id: (company as any).id, full_name: (company as any).name, avatar_url: (company as any).avatar_url, headline: "Inteligência de Mercado do Vinho" };
      }
    } catch { /* keep author undefined — card gracefully falls back */ }

    return { ...newPost, user_liked: false, user_poll_votes: null, poll_allow_multiple: pollAllowMultiple ?? false, author };
  } catch { return null; }
}

export async function voteOnMarketPoll(
  postId: string,
  _userId: string,
  optionId: string,
): Promise<{ poll_options: MarketPollOption[]; user_poll_votes: string[] } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch(`${API_URL}/market-posts/${postId}/poll/vote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { poll_options: MarketPollOption[]; user_poll_votes: string[] };
    return { poll_options: json.poll_options, user_poll_votes: json.user_poll_votes ?? [] };
  } catch { return null; }
}

export async function fetchMarketPollVoters(postId: string): Promise<{
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  optionId: string;
}[]> {
  try {
    const { data: votes } = await supabase
      .from("market_post_poll_votes")
      .select("user_id, option_id")
      .eq("post_id", postId);
    if (!votes?.length) return [];
    const userIds = [...new Set(votes.map((v: any) => v.user_id as string))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, username").in("id", userIds);
    if (!profiles) return [];
    const profileMap = new Map((profiles as any[]).map((p: any) => [p.id as string, p]));
    return (votes as any[]).flatMap((v: any) => {
      const p = profileMap.get(v.user_id as string);
      if (!p) return [];
      return [{ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, username: p.username, optionId: v.option_id as string }];
    });
  } catch { return []; }
}

export async function uploadMarketPostMediaBase64(
  fileBase64: string,
  fileName: string,
  mimeType: string,
  userId: string,
): Promise<string | null> {
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL!;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    const res = await fetch(`${apiUrl}/uploads/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileBase64, fileName, mimeType, userId }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.url ?? null;
  } catch { return null; }
}

/**
 * Toggle / change a reaction on a market post via the API server (service role).
 * Returns { user_liked, reaction_type, likes_count } after the operation.
 * - Same reaction → unlike (remove)
 * - Different reaction → swap reaction (count unchanged)
 * - No previous reaction → add reaction (count +1)
 */
export async function toggleMarketPostReaction(
  postId: string,
  _userId: string,
  reactionType: string,
  currentReaction: string | null,
  currentCount: number,
): Promise<{ user_liked: boolean; reaction_type: string | null; likes_count: number }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { user_liked: !!currentReaction, reaction_type: currentReaction, likes_count: currentCount };
    const res = await fetch(`${API_URL}/market/posts/${postId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reaction_type: reactionType }),
    });
    if (!res.ok) return { user_liked: !!currentReaction, reaction_type: currentReaction, likes_count: currentCount };
    const json = await res.json() as { user_liked: boolean; reaction_type: string | null; likes_count: number };
    return json;
  } catch {
    return { user_liked: !!currentReaction, reaction_type: currentReaction, likes_count: currentCount };
  }
}

/** Back-compat alias kept so any remaining callers don't break. */
export async function toggleMarketPostLike(postId: string, _userId: string, currentlyLiked: boolean): Promise<boolean> {
  const result = await toggleMarketPostReaction(postId, _userId, "saude", currentlyLiked ? "saude" : null, 0);
  return result.user_liked;
}

const REPLY_PREFIX_RE = /^\[R:([0-9a-f-]{36})\]/i;

export async function fetchMarketComments(postId: string, currentUserId?: string): Promise<MarketComment[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = currentUserId ?? session?.user?.id;

    const { data, error } = await supabase
      .from("market_post_comments")
      .select("id, post_id, author_id, content, created_at, likes_count")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];

    const commentIds = data.map((c: any) => c.id as string);
    const authorIds = [...new Set(data.map((c: any) => c.author_id as string))];

    const [profilesByUserId, profilesById, commentLikesRes] = await Promise.all([
      authorIds.length > 0
        ? supabase.from("profiles").select("id, user_id, full_name, avatar_url, position, company").in("user_id", authorIds)
        : Promise.resolve({ data: [] }),
      authorIds.length > 0
        ? supabase.from("profiles").select("id, user_id, full_name, avatar_url, position, company").in("id", authorIds)
        : Promise.resolve({ data: [] }),
      uid && commentIds.length > 0
        ? supabase.from("market_comment_likes").select("comment_id").eq("user_id", uid).in("comment_id", commentIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build map keyed by user_id first, then overlay by profiles.id as fallback
    // (some older comments stored profiles.id in author_id instead of auth user_id)
    const profileMap = new Map<string, any>();
    for (const p of ((profilesByUserId as any).data ?? [])) profileMap.set(p.user_id, p);
    for (const p of ((profilesById as any).data ?? [])) {
      if (!profileMap.has(p.id)) profileMap.set(p.id, p);
    }
    const likedCommentIds = new Set(((commentLikesRes as any).data ?? []).map((l: any) => l.comment_id as string));

    // Parse [R:parentId] prefix embedded in content (reply encoding)
    const flat: MarketComment[] = data.map((c: any) => {
      const match = REPLY_PREFIX_RE.exec(c.content ?? "");
      return {
        ...c,
        likes_count: c.likes_count ?? 0,
        is_liked: likedCommentIds.has(c.id),
        reply_to_id: match ? match[1] : null,
        content: match ? c.content.slice(match[0].length) : c.content,
        replies: [] as MarketComment[],
        author: profileMap.get(c.author_id) ?? null,
      };
    });

    // Build tree: top-level comments first, then nest replies
    const byId = new Map(flat.map(c => [c.id, c]));
    const roots: MarketComment[] = [];
    for (const c of flat) {
      if (c.reply_to_id && byId.has(c.reply_to_id)) {
        byId.get(c.reply_to_id)!.replies!.push(c);
      } else {
        roots.push(c);
      }
    }
    return roots;
  } catch { return []; }
}

export async function toggleMarketCommentLike(
  commentId: string,
  _userId: string,
  currentlyLiked: boolean,
): Promise<{ is_liked: boolean; likes_count: number } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch(`${API_URL}/market/comments/${commentId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json() as { is_liked: boolean; likes_count: number };
    return json;
  } catch { return null; }
}

export async function fetchMarketPostLikers(postId: string): Promise<MarketPostLiker[]> {
  try {
    const { data: likes } = await supabase
      .from("market_post_likes")
      .select("user_id, reaction_type")
      .eq("post_id", postId)
      .limit(50);
    if (!likes || likes.length === 0) return [];

    const reactionMap = new Map<string, string | null>(
      likes.map((l: any) => [l.user_id as string, (l.reaction_type as string | null) ?? "saude"])
    );
    const userIds = likes.map((l: any) => l.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, position, company")
      .in("user_id", userIds);
    return (profiles ?? []).map((p: any) => ({
      id: p.user_id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      position: p.position,
      company: p.company,
      reaction_type: reactionMap.get(p.user_id) ?? "saude",
    }));
  } catch { return []; }
}

export async function deleteDirectConversation(conversationId: string): Promise<boolean> {
  try {
    await supabase.from("messages").delete().eq("conversation_id", conversationId);
    await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId);
    const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
    return !error;
  } catch { return false; }
}

export async function addMarketComment(
  postId: string,
  _authorId: string,
  content: string,
  replyToId?: string | null,
): Promise<MarketComment | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch(`${API_URL}/market/posts/${postId}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content, reply_to_id: replyToId ?? null }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { comment: MarketComment };
    return json.comment ?? null;
  } catch { return null; }
}
