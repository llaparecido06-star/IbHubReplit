import { supabase } from "@/context/AuthContext";
import { Post } from "@/components/feed/PostCard";
import { compressLogoImage } from "@/utils/compressImage";
import { getSessionSafe, API_URL, POST_SELECT_BASE, attachAuthorsToPosts, fetchCommentProfilesForIds, fetchCompanyPagesForIds, fetchProfilesForIds, isNetworkError } from "./_shared";
import type { AppStory } from "./types";
import type { AppEvent } from "./events";
import type { AppOpportunity } from "./opportunities";

// ─── COMPANY PAGES ────────────────────────────────────────────────────────────

export interface CompanyPage {
  id: string;
  owner_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  plan: string;
  created_at: string;
  userRole?: "owner" | "editor" | "moderador" | "visualizador";
}

/** Checks if the given role can publish content (posts, chat, events, vagas, market) */
export function canPublishAsCompany(role: string | null | undefined): boolean {
  return role === "owner" || role === "editor" || role === "moderador";
}

/** Checks if the given role can edit page info and portfolio */
export function canEditCompanyPage(role: string | null | undefined): boolean {
  return role === "owner" || role === "editor";
}

const COMPANY_PAGE_SELECT = "id, owner_id, name, username, avatar_url, bio, website, industry, location, plan, created_at";

export async function fetchUserCompanyPages(userId: string): Promise<CompanyPage[]> {
  try {
    // Pages owned by the user
    const { data: owned, error: ownedErr } = await supabase
      .from("company_pages")
      .select(COMPANY_PAGE_SELECT)
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    if (ownedErr) console.warn("fetchUserCompanyPages owned:", ownedErr.message ?? ownedErr);

    // Pages where user is an admin/member — include role
    const { data: memberships } = await supabase
      .from("company_page_admins")
      .select("company_id, role")
      .eq("user_id", userId);

    const membershipMap = new Map<string, string>(
      (memberships ?? []).map((m: any) => [m.company_id, m.role])
    );
    const adminIds = [...membershipMap.keys()];
    let adminPages: CompanyPage[] = [];
    if (adminIds.length > 0) {
      const { data: adminData } = await supabase
        .from("company_pages")
        .select(COMPANY_PAGE_SELECT)
        .in("id", adminIds)
        .order("created_at", { ascending: true });
      adminPages = ((adminData ?? []) as CompanyPage[]).map(p => ({
        ...p,
        userRole: (membershipMap.get(p.id) as CompanyPage["userRole"]) ?? "visualizador",
      }));
    }

    // Merge, deduplicate by id — owned pages get role "owner"
    const ownedPages = ((owned ?? []) as CompanyPage[]).map(p => ({ ...p, userRole: "owner" as const }));
    const ownedIds = new Set(ownedPages.map(p => p.id));
    const merged = [...ownedPages, ...adminPages.filter(p => !ownedIds.has(p.id))];
    return merged;
  } catch (e) {
    console.error("fetchUserCompanyPages:", e);
    return [];
  }
}

export async function checkUserCompanyRole(
  companyId: string,
  userId: string,
): Promise<{ isOwner: boolean; role: string | null }> {
  try {
    const { data: page } = await supabase
      .from("company_pages")
      .select("owner_id")
      .eq("id", companyId)
      .single();

    if (page?.owner_id === userId) return { isOwner: true, role: "owner" };

    const { data: adminRow } = await supabase
      .from("company_page_admins")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .single();

    if (adminRow) return { isOwner: false, role: adminRow.role };
    return { isOwner: false, role: null };
  } catch (e) {
    return { isOwner: false, role: null };
  }
}

export async function createCompanyPage(params: {
  owner_id: string;
  name: string;
  username?: string;
  bio?: string;
  website?: string;
  industry?: string;
  location?: string;
}): Promise<CompanyPage | null> {
  try {
    const { data: { session } } = await getSessionSafe();
    if (!session?.access_token) return null;
    const res = await fetch(`${API_URL}/community/companies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) { console.error("createCompanyPage:", res.status); return null; }
    const body = await res.json() as { company: CompanyPage };
    return body.company;
  } catch (e) {
    console.error("createCompanyPage:", e);
    return null;
  }
}

export async function fetchCompanyPageById(id: string): Promise<CompanyPage | null> {
  try {
    const { data, error } = await supabase
      .from("company_pages")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return data as CompanyPage;
  } catch (e) {
    console.error("fetchCompanyPageById:", e);
    return null;
  }
}

export async function updateCompanyPage(
  id: string,
  updates: Partial<Pick<CompanyPage, "name" | "username" | "bio" | "website" | "industry" | "location" | "avatar_url">>,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("company_pages").update(updates).eq("id", id);
    if (error) { console.error("updateCompanyPage:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateCompanyPage:", e);
    return false;
  }
}

export async function transferCompanyOwnership(
  pageId: string,
  newOwnerId: string,
  currentOwnerId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("transfer_company_ownership", {
      p_page_id:   pageId,
      p_new_owner: newOwnerId,
      p_old_owner: currentOwnerId,
    });
    if (error) return { ok: false, error: error.message };
    const result = data as { ok: boolean; error?: string };
    return result;
  } catch (e: any) {
    console.error("transferCompanyOwnership:", e);
    return { ok: false, error: e?.message ?? "Erro desconhecido" };
  }
}

export async function deleteCompanyPage(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("company_pages").delete().eq("id", id);
    if (error) { console.error("deleteCompanyPage:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteCompanyPage:", e);
    return false;
  }
}

export interface CompanyPageAdmin {
  company_id: string;
  user_id: string;
  role: string;
  added_at: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    position: string | null;
    company: string | null;
  };
}

export async function fetchCompanyPageAdmins(companyId: string): Promise<CompanyPageAdmin[]> {
  try {
    const { data, error } = await supabase
      .from("company_page_admins")
      .select("company_id, user_id, role, added_at")
      .eq("company_id", companyId)
      .order("added_at", { ascending: true });
    if (error || !data || data.length === 0) return [];
    const adminUserIds = [...new Set((data as any[]).map(r => r.user_id).filter(Boolean))];
    const profileMap = await fetchProfilesForIds(adminUserIds);
    return (data as any[]).map(row => ({
      ...row,
      profile: row.user_id ? (profileMap.get(row.user_id) ?? null) : null,
    }));
  } catch (e) {
    console.error("fetchCompanyPageAdmins:", e);
    return [];
  }
}

export async function addCompanyPageAdmin(
  companyId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("company_page_admins").upsert(
      { company_id: companyId, user_id: userId, role },
      { onConflict: "company_id,user_id" },
    );
    if (error) { console.error("addCompanyPageAdmin:", error); return false; }
    return true;
  } catch (e) {
    console.error("addCompanyPageAdmin:", e);
    return false;
  }
}

export async function removeCompanyPageAdmin(companyId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("company_page_admins")
      .delete()
      .eq("company_id", companyId)
      .eq("user_id", userId);
    if (error) { console.error("removeCompanyPageAdmin:", error); return false; }
    return true;
  } catch (e) {
    console.error("removeCompanyPageAdmin:", e);
    return false;
  }
}

export async function uploadCompanyLogo(companyId: string, uri: string): Promise<string | null> {
  try {
    const { data: { session } } = await getSessionSafe();
    const userId = session?.user?.id;
    if (!userId) { console.error("uploadCompanyLogo: no session"); return null; }

    const compressed = await compressLogoImage(uri);
    const safeExt = "jpg";
    const mime = "image/jpeg";
    const path = `${userId}/company-logos/${companyId}.${safeExt}`;

    const resp = await fetch(compressed);
    const arrayBuffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, bytes, { contentType: mime, upsert: true });

    if (error) { console.error("uploadCompanyLogo:", error); return null; }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadCompanyLogo:", e);
    return null;
  }
}


// ─── COMPANY POSTS ────────────────────────────────────────────────────────────

export async function fetchCompanyPosts(companyId: string, currentUserId?: string, activeCompanyId?: string | null): Promise<Post[]> {
  try {
    const { data: pageData } = await supabase
      .from("company_pages")
      .select("owner_id")
      .eq("id", companyId)
      .single();

    if (!pageData?.owner_id) return [];

    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT_BASE)
      .eq("company_page_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) { console.error("fetchCompanyPosts:", error); return []; }

    const posts = (data ?? []) as any[];
    if (posts.length === 0) return [];

    const postUserIds = [...new Set(posts.map((p: any) => p.user_id).filter(Boolean))];
    const postCompanyIds = [...new Set(posts.map((p: any) => p.company_page_id).filter(Boolean))];
    const postIds = posts.map((p: any) => p.id);

    // Check likes using active identity (company or personal)
    const likedQuery = activeCompanyId
      ? supabase.from("likes").select("post_id").eq("company_page_id", activeCompanyId).in("post_id", postIds)
      : currentUserId
        ? supabase.from("likes").select("post_id").eq("user_id", currentUserId).is("company_page_id", null).in("post_id", postIds)
        : Promise.resolve({ data: [] });

    const [profileMap, companyMap, likedRes, bookmarkRes] = await Promise.all([
      fetchProfilesForIds(postUserIds),
      fetchCompanyPagesForIds(postCompanyIds),
      likedQuery,
      currentUserId
        ? supabase.from("bookmarks").select("post_id").eq("user_id", currentUserId).in("post_id", postIds)
        : Promise.resolve({ data: [] }),
    ]);

    const likedSet    = new Set(((likedRes as any).data ?? []).map((l: any) => l.post_id));
    const bookmarkSet = new Set(((bookmarkRes as any).data ?? []).map((b: any) => b.post_id));

    return (await attachAuthorsToPosts(posts, profileMap, companyMap)).map((p: any) => ({
      ...p,
      is_liked:     likedSet.has(p.id),
      is_bookmarked: bookmarkSet.has(p.id),
    })) as Post[];
  } catch (e) {
    console.error("fetchCompanyPosts:", e);
    return [];
  }
}

// ─── COMPANY PORTFOLIO ────────────────────────────────────────────────────────

export interface CompanyProduct {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  price: string | null;
  category: string;
  image_url: string | null;
  created_at: string;
}

export async function fetchCompanyProducts(companyId: string): Promise<CompanyProduct[]> {
  try {
    const { data, error } = await supabase
      .from("company_products")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) { console.error("fetchCompanyProducts:", error); return []; }
    return (data ?? []) as CompanyProduct[];
  } catch (e) {
    console.error("fetchCompanyProducts:", e);
    return [];
  }
}

export async function fetchInactiveOpportunities(): Promise<AppOpportunity[]> {
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, created_by, type, title, description, category, location, price, company, contract_type, salary, contact_email, expires_at, is_active, created_at")
      .eq("is_active", false)
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchInactiveOpportunities:", error); return []; }
    if (!data || data.length === 0) return [];
    const inactCreatorIds = [...new Set((data as any[]).map(d => d.created_by).filter(Boolean))];
    const inactCreatorMap = await fetchCommentProfilesForIds(inactCreatorIds);
    return (data as any[]).map(d => ({
      ...d,
      creator: d.created_by ? (inactCreatorMap.get(d.created_by) ?? null) : null,
      is_applied: false,
    })) as unknown as AppOpportunity[];
  } catch (e) {
    console.error("fetchInactiveOpportunities:", e);
    return [];
  }
}

export async function createCompanyProduct(params: {
  company_id: string;
  name: string;
  description?: string | null;
  price?: string | null;
  category: string;
  image_url?: string | null;
}): Promise<CompanyProduct | null> {
  try {
    const { data, error } = await supabase
      .from("company_products")
      .insert(params)
      .select()
      .single();

    if (error) { console.error("createCompanyProduct:", error); return null; }
    return data as CompanyProduct;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("createCompanyProduct:", e);
    return null;
  }
}

export async function updateCompanyProduct(
  productId: string,
  updates: Partial<Pick<CompanyProduct, "name" | "description" | "price" | "category" | "image_url">>,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("company_products")
      .update(updates)
      .eq("id", productId);
    if (error) { console.error("updateCompanyProduct:", error); return false; }
    return true;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("updateCompanyProduct:", e);
    return false;
  }
}

export async function fetchApplicationsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("opportunity_applications")
      .select("id", { count: "exact", head: true });
    if (error) { console.error("fetchApplicationsCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchApplicationsCount:", e);
    return 0;
  }
}

export async function fetchAllStoriesAdmin(): Promise<AppStory[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("id, user_id, image_url, video_url, text, expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchAllStoriesAdmin:", error); return []; }
    if (!data || data.length === 0) return [];
    const adminUserIds = [...new Set((data as any[]).map(s => s.user_id).filter(Boolean))];
    const adminProfileMap = await fetchProfilesForIds(adminUserIds);
    return (data as any[]).map(s => ({ ...s, author: adminProfileMap.get(s.user_id) ?? null })) as unknown as AppStory[];
  } catch (e) {
    console.error("fetchAllStoriesAdmin:", e);
    return [];
  }
}

export async function deleteStoryAdmin(storyId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("stories").delete().eq("id", storyId);
    if (error) { console.error("deleteStoryAdmin:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteStoryAdmin:", e);
    return false;
  }
}

export async function deleteCompanyProduct(productId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("company_products")
      .delete()
      .eq("id", productId);
    if (error) { console.error("deleteCompanyProduct:", error); return false; }
    return true;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("deleteCompanyProduct:", e);
    return false;
  }
}

export async function uploadProductImage(productId: string, uri: string): Promise<string | null> {
  try {
    const { data: { session } } = await getSessionSafe();
    const userId = session?.user?.id;
    if (!userId) { console.error("uploadProductImage: no session"); return null; }

    const compressed = await compressLogoImage(uri);
    const path = `${userId}/product-images/${productId}.jpg`;

    const response = await fetch(compressed);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

    if (error) { console.error("uploadProductImage:", error); return null; }

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadProductImage:", e);
    return null;
  }
}

// ─── COMPANY FOLLOW ───────────────────────────────────────────────────────────

export async function checkIsFollowingCompany(companyId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("company_follows")
      .select("id")
      .match({ company_id: companyId, user_id: userId })
      .maybeSingle();
    return !!data;
  } catch { return false; }
}

export async function toggleCompanyFollow(companyId: string, userId: string, isCurrentlyFollowing: boolean): Promise<boolean> {
  try {
    if (isCurrentlyFollowing) {
      const { error } = await supabase.from("company_follows").delete().match({ company_id: companyId, user_id: userId });
      if (error) { console.error("toggleCompanyFollow (unfollow):", error); return false; }
    } else {
      const { error } = await supabase.from("company_follows").upsert({ company_id: companyId, user_id: userId }, { onConflict: "company_id,user_id" });
      if (error) { console.error("toggleCompanyFollow (follow):", error); return false; }
      void _dispatchCompanyPush("/push/company-follow", { companyId });
    }
    return true;
  } catch (e) {
    console.error("toggleCompanyFollow:", e);
    return false;
  }
}

async function _dispatchCompanyPush(path: string, body: Record<string, string>): Promise<void> {
  if (!API_URL) return;
  try {
    const { data: { session } } = await getSessionSafe();
    const token = session?.access_token;
    if (!token) return;
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
  }
}

export async function fetchStoryViewsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("story_views")
      .select("id", { count: "exact", head: true });
    if (error) { console.error("fetchStoryViewsCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchStoryViewsCount:", e);
    return 0;
  }
}

export async function fetchStoryLikesCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("story_likes")
      .select("id", { count: "exact", head: true });
    if (error) { console.error("fetchStoryLikesCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchStoryLikesCount:", e);
    return 0;
  }
}


// ─── COMPANY ADMIN DASHBOARD ──────────────────────────────────────────────────

export interface CompanyAdminOpportunity extends AppOpportunity {
  view_count: number;
  sold: boolean;
  sold_via_ibhub: boolean;
  company_page_id: string | null;
}

export interface CompanyAdminApplicant {
  id: string;
  applicant_id: string;
  cv_url: string | null;
  message: string | null;
  status: "pending" | "reviewed" | "shortlisted" | "hired" | "rejected";
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  username: string | null;
}

export interface CompanyAdminEvent extends AppEvent {
  company_page_id: string | null;
}

/** All vagas/anúncios linked to a company page (or created by the owner).
 *  ADMIN view — includes inactive items and personal items by the owner.
 *  Use fetchPublicCompanyOpportunities for public profile pages.
 */
export async function fetchCompanyOpportunities(
  companyPageId: string,
  ownerId: string,
  type: "vaga" | "marketplace",
): Promise<CompanyAdminOpportunity[]> {
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        id, created_by, type, title, description, category, location, price,
        cover_image_url, company, contract_type, salary, contact_email,
        expires_at, is_active, created_at,
        interests_count, applications_count,
        view_count, sold, sold_via_ibhub, company_page_id
      `)
      .eq("type", type)
      .or(`company_page_id.eq.${companyPageId},created_by.eq.${ownerId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("fetchCompanyOpportunities:", error); return []; }
    return (data ?? []) as CompanyAdminOpportunity[];
  } catch (e) {
    console.error("fetchCompanyOpportunities:", e);
    return [];
  }
}

/** Active vagas/marketplace items strictly linked to a company page.
 *  Safe for public company profile listings — never returns inactive items
 *  or personal items by the owner.
 */
export async function fetchPublicCompanyOpportunities(
  companyPageId: string,
  type: "vaga" | "marketplace",
): Promise<AppOpportunity[]> {
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        id, created_by, type, title, description, category, location, price,
        cover_image_url, company, company_page_id, contract_type, salary,
        contact_email, expires_at, is_active, created_at
      `)
      .eq("type", type)
      .eq("company_page_id", companyPageId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("fetchPublicCompanyOpportunities:", error); return []; }
    return (data ?? []) as AppOpportunity[];
  } catch (e) {
    console.error("fetchPublicCompanyOpportunities:", e);
    return [];
  }
}

/** All events linked to a company page (or created by the owner).
 *  ADMIN view — includes inactive/restrito events and personal events
 *  by the owner. Use fetchPublicCompanyEvents for public profile pages.
 */
export async function fetchCompanyEvents(
  companyPageId: string,
  ownerId: string,
): Promise<CompanyAdminEvent[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, user_id, title, description, start_date, end_date,
        location_type, location, entry_type, capacity, visibility,
        is_active, pay_link, created_at, attendees_count, company_page_id
      `)
      .or(`company_page_id.eq.${companyPageId},user_id.eq.${ownerId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("fetchCompanyEvents:", error); return []; }
    return (data ?? []) as CompanyAdminEvent[];
  } catch (e) {
    console.error("fetchCompanyEvents:", e);
    return [];
  }
}

/** Active, non-restricted events strictly linked to a company page.
 *  Safe for public company profile listings.
 */
export async function fetchPublicCompanyEvents(
  companyPageId: string,
): Promise<AppEvent[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, user_id, title, description, start_date, end_date,
        location_type, location, link, image_url, restricted_positions,
        entry_type, capacity, visibility, is_active, pay_link, created_at
      `)
      .eq("company_page_id", companyPageId)
      .eq("is_active", true)
      // Allow-list: only "publico" (or legacy NULL) reach the public profile.
      .or("visibility.is.null,visibility.eq.publico")
      .order("start_date", { ascending: true })
      .limit(100);
    if (error) { console.error("fetchPublicCompanyEvents:", error); return []; }
    return (data ?? []) as AppEvent[];
  } catch (e) {
    console.error("fetchPublicCompanyEvents:", e);
    return [];
  }
}

/** Applicants for a job opportunity, with profile data. */
export async function fetchOpportunityApplicants(
  opportunityId: string,
): Promise<CompanyAdminApplicant[]> {
  try {
    const { data, error } = await supabase.rpc("get_opportunity_applicants", {
      p_opportunity_id: opportunityId,
    });
    if (error) {
      // Fallback: join manually if RPC not yet applied
      const { data: raw } = await supabase
        .from("opportunity_applications")
        .select("id, applicant_id, cv_url, message, status, created_at")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false });
      if (!raw) return [];
      const ids = raw.map((r: any) => r.applicant_id).filter(Boolean);
      // Use full profile select (AUTHOR_SELECT) so `username` is available;
      // COMMENT_AUTHOR_SELECT does not include username.
      const profileMap = await fetchProfilesForIds(ids);
      return raw.map((r: any) => {
        const p = profileMap.get(r.applicant_id);
        const headline = p ? ([p.position, p.company].filter(Boolean).join(" · ") || null) : null;
        return {
          ...r,
          status: r.status ?? "pending",
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          headline,
          username: p?.username ?? null,
        };
      }) as CompanyAdminApplicant[];
    }
    return (data ?? []).map((r: any) => ({
      ...r,
      status: r.status ?? "pending",
    })) as CompanyAdminApplicant[];
  } catch (e) {
    console.error("fetchOpportunityApplicants:", e);
    return [];
  }
}

/** Increment view count for an opportunity. */
export async function trackOpportunityView(opportunityId: string): Promise<void> {
  try {
    await supabase.rpc("increment_opportunity_views", { p_opportunity_id: opportunityId });
  } catch (e) {
    console.error("trackOpportunityView:", e);
  }
}

/** Toggle sold status for a marketplace item. */
export async function markOpportunitySold(
  opportunityId: string,
  sold: boolean,
  soldViaIbhub: boolean,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("opportunities")
      .update({ sold, sold_via_ibhub: soldViaIbhub })
      .eq("id", opportunityId);
    if (error) { console.error("markOpportunitySold:", error); return false; }
    return true;
  } catch (e) {
    console.error("markOpportunitySold:", e);
    return false;
  }
}

/** Update application status (pending → reviewed → shortlisted → hired / rejected). */
export async function updateApplicationStatus(
  applicationId: string,
  status: CompanyAdminApplicant["status"],
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("opportunity_applications")
      .update({ status })
      .eq("id", applicationId);
    if (error) { console.error("updateApplicationStatus:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateApplicationStatus:", e);
    return false;
  }
}

/** Delete an opportunity (vaga or marketplace item) by id. */
export async function deleteOpportunityById(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    if (error) { console.error("deleteOpportunityById:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteOpportunityById:", e);
    return false;
  }
}

/** Delete an event by id. */
export async function deleteEventById(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { console.error("deleteEventById:", error); return false; }
    return true;
  } catch (e) {
    console.error("deleteEventById:", e);
    return false;
  }
}

/** Partial update an opportunity (title, description, price, salary, expires_at, contact_email, location, category, contract_type, company). */
export async function updateOpportunity(
  id: string,
  fields: Partial<Pick<AppOpportunity, "title" | "description" | "price" | "salary" | "expires_at" | "contact_email" | "location" | "category" | "contract_type" | "company">>,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("opportunities").update(fields).eq("id", id);
    if (error) { console.error("updateOpportunity:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateOpportunity:", e);
    return false;
  }
}

/** Partial update an event (title, description, location, start_date, end_date, capacity, is_active). */
export async function updateEvent(
  id: string,
  fields: Partial<Pick<AppEvent, "title" | "description" | "location" | "start_date" | "end_date" | "capacity" | "is_active">>,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("events").update(fields).eq("id", id);
    if (error) { console.error("updateEvent:", error); return false; }
    return true;
  } catch (e) {
    console.error("updateEvent:", e);
    return false;
  }
}
