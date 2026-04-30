import { supabase } from "@/context/AuthContext";
import { API_URL, fetchCommentProfilesForIds, fetchCompanyPagesForIds, fetchProfilesForIds, guardedFetch, isNetworkError } from "./_shared";

// ─── OPPORTUNITIES ─────────────────────────────────────────────────────────────

export interface AppOpportunity {
  id: string;
  created_by: string;
  type: "vaga" | "marketplace";
  title: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  price?: string | null;
  cover_image_url?: string | null;
  company?: string | null;
  company_page_id?: string | null;
  company_page?: { id: string; owner_id?: string | null; name: string; avatar_url?: string | null } | null;
  contract_type?: string | null;
  salary?: string | null;
  contact_email?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
  interests_count?: number;
  applications_count?: number;
  creator?: { id: string; full_name: string | null; avatar_url?: string | null; position?: string | null; company?: string | null } | null;
  is_applied?: boolean;
  is_interested?: boolean;
  is_saved?: boolean;
}

export async function fetchOpportunities(
  type: "vaga" | "marketplace",
  search: string,
  userId: string,
): Promise<AppOpportunity[]> {
  try {
    let query = supabase
      .from("opportunities")
      .select(`
        id, created_by, type, title, description, category, location, price, cover_image_url,
        company, company_page_id, contract_type, salary, contact_email, expires_at, is_active, created_at,
        interests_count, applications_count
      `)
      .eq("is_active", true)
      .eq("type", type)
      .order("created_at", { ascending: false });

    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,company.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(50);
    if (error || !data) return [];

    const ids = (data as any[]).map((d) => d.id);

    // Check which ones the user already applied to (vagas only) + saved
    let appliedIds = new Set<string>();
    let savedIds = new Set<string>();

    const promises: Promise<any>[] = [];

    if (type === "vaga" && ids.length > 0) {
      promises.push(
        Promise.resolve(
          supabase
            .from("opportunity_applications")
            .select("opportunity_id")
            .eq("applicant_id", userId)
            .in("opportunity_id", ids),
        ).then(({ data: apps }) => {
          if (apps) apps.forEach((a: any) => appliedIds.add(a.opportunity_id));
        }),
      );
    }

    if (ids.length > 0) {
      promises.push(
        Promise.resolve(
          supabase
            .from("opportunity_saves")
            .select("opportunity_id")
            .eq("user_id", userId)
            .in("opportunity_id", ids),
        ).then(({ data: saves }) => {
          if (saves) saves.forEach((s: any) => savedIds.add(s.opportunity_id));
        }),
      );
    }

    const creatorIds = [...new Set((data as any[]).map(d => d.created_by).filter(Boolean))];
    const [creatorMap] = await Promise.all([
      fetchCommentProfilesForIds(creatorIds),
      ...promises,
    ]);

    return (data as any[]).map((d) => ({
      ...d,
      creator: d.created_by ? (creatorMap.get(d.created_by) ?? null) : null,
      is_applied: appliedIds.has(d.id),
      is_saved: savedIds.has(d.id),
      interests_count: d.interests_count ?? 0,
      applications_count: d.applications_count ?? 0,
    })) as AppOpportunity[];
  } catch (e) {
    console.error("fetchOpportunities:", e);
    return [];
  }
}

export async function fetchOpportunitiesPage(
  type: "vaga" | "marketplace",
  search: string,
  userId: string,
  offset = 0,
  limit = 15,
  category?: string,
): Promise<AppOpportunity[]> {
  try {
    let query = supabase
      .from("opportunities")
      .select(`
        id, created_by, type, title, description, category, location, price, cover_image_url,
        company, company_page_id, contract_type, salary, contact_email, expires_at, is_active, created_at,
        interests_count, applications_count
      `)
      .eq("is_active", true)
      .eq("type", type)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,company.ilike.%${search}%,category.ilike.%${search}%`);
    }
    if (category && category !== "Todos") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const ids = (data as any[]).map((d) => d.id);
    let appliedIds = new Set<string>();
    let savedIds = new Set<string>();
    const promises: Promise<any>[] = [];

    if (type === "vaga" && ids.length > 0) {
      promises.push(
        Promise.resolve(
          supabase.from("opportunity_applications").select("opportunity_id").eq("applicant_id", userId).in("opportunity_id", ids),
        ).then(({ data: apps }) => { if (apps) apps.forEach((a: any) => appliedIds.add(a.opportunity_id)); }),
      );
    }
    if (ids.length > 0) {
      promises.push(
        Promise.resolve(
          supabase.from("opportunity_saves").select("opportunity_id").eq("user_id", userId).in("opportunity_id", ids),
        ).then(({ data: saves }) => { if (saves) saves.forEach((s: any) => savedIds.add(s.opportunity_id)); }),
      );
    }

    const creatorIds = [...new Set((data as any[]).map(d => d.created_by).filter(Boolean))];
    const [creatorMap] = await Promise.all([fetchCommentProfilesForIds(creatorIds), ...promises]);

    return (data as any[]).map((d) => ({
      ...d,
      creator: d.created_by ? (creatorMap.get(d.created_by) ?? null) : null,
      is_applied: appliedIds.has(d.id),
      is_saved: savedIds.has(d.id),
      interests_count: d.interests_count ?? 0,
      applications_count: d.applications_count ?? 0,
    })) as AppOpportunity[];
  } catch (e) {
    console.error("fetchOpportunitiesPage:", e);
    return [];
  }
}

export async function fetchOpportunityById(
  id: string,
  userId: string,
): Promise<(AppOpportunity & { is_applied: boolean; is_interested: boolean; applications_count: number }) | null> {
  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select(`id, created_by, type, title, description, category, location, price, cover_image_url,
        company, company_page_id, contract_type, salary, contact_email, expires_at, is_active, created_at`)
      .eq("id", id)
      .single();

    if (error || !data) return null;

    const creatorId = (data as any).created_by;
    const companyPageId = (data as any).company_page_id;
    const [creatorMap, companyMap] = await Promise.all([
      creatorId ? fetchCommentProfilesForIds([creatorId]) : Promise.resolve(new Map()),
      companyPageId ? fetchCompanyPagesForIds([companyPageId]) : Promise.resolve(new Map()),
    ]);
    (data as any).creator = creatorId ? (creatorMap.get(creatorId) ?? null) : null;
    (data as any).company_page = companyPageId ? (companyMap.get(companyPageId) ?? null) : null;

    const isVaga = (data as any).type === "vaga";

    const [appRes, countRes, interestRes] = await Promise.all([
      isVaga
        ? supabase
            .from("opportunity_applications")
            .select("id")
            .eq("opportunity_id", id)
            .eq("applicant_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      isVaga
        ? supabase
            .from("opportunity_applications")
            .select("id", { count: "exact", head: true })
            .eq("opportunity_id", id)
        : Promise.resolve({ count: 0 }),
      !isVaga
        ? supabase
            .from("notifications")
            .select("id")
            .eq("type", "interest")
            .eq("opportunity_id", id)
            .eq("actor_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      ...(data as any),
      creator: (data as any).creator ?? null,
      is_applied: !!appRes.data,
      is_interested: !!interestRes.data,
      applications_count: (countRes as any).count ?? 0,
    };
  } catch (e) {
    console.error("fetchOpportunityById:", e);
    return null;
  }
}

export async function createOpportunity(
  payload: Omit<AppOpportunity, "id" | "created_at" | "is_active" | "creator" | "is_applied" | "applications_count">,
  userId: string,
): Promise<AppOpportunity | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await guardedFetch(`${API_URL}/community/opportunities`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, created_by: userId }),
    });
    if (!res.ok) { console.error("createOpportunity:", res.status); return null; }
    const body = await res.json() as { opportunity: AppOpportunity };
    return body.opportunity;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("createOpportunity:", e);
    return null;
  }
}

export async function uploadCV(uri: string, userId: string): Promise<string | null> {
  try {
    const ext = uri.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `cvs/${userId}/${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const contentType = ext === "pdf" ? "application/pdf" : ext === "doc" || ext === "docx" ? "application/msword" : "application/octet-stream";

    const { error } = await supabase.storage.from("cvs").upload(path, bytes, {
      contentType,
      upsert: true,
    });

    if (error) { console.error("uploadCV:", error); return null; }

    const { data } = supabase.storage.from("cvs").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("uploadCV:", e);
    return null;
  }
}

export async function fetchUserLastCV(userId: string): Promise<{ url: string; name: string } | null> {
  try {
    const { data, error } = await supabase
      .from("opportunity_applications")
      .select("cv_url, created_at")
      .eq("applicant_id", userId)
      .not("cv_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.cv_url) return null;
    const segments = data.cv_url.split("/");
    const rawName = decodeURIComponent(segments[segments.length - 1] ?? "curriculo.pdf");
    const name = rawName.split("?")[0] ?? rawName;
    return { url: data.cv_url, name };
  } catch (e) {
    console.error("fetchUserLastCV:", e);
    return null;
  }
}

export async function applyToJob(
  opportunityId: string,
  _applicantId: string,
  cvUrl: string | null,
  message: string | null,
): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(`${API_URL}/community/opportunities/${opportunityId}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ cv_url: cvUrl, message }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("applyToJob server error:", res.status, errText);
      return false;
    }

    return true;
  } catch (e) {
    console.error("applyToJob:", e);
    return false;
  }
}

export async function expressInterest(
  opportunityId: string,
  _userId: string,
  _message: string | null,
): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(`${API_URL}/community/opportunities/${opportunityId}/interest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("expressInterest server error:", res.status, errText);
      return false;
    }

    return true;
  } catch (e) {
    console.error("expressInterest:", e);
    return false;
  }
}

export async function toggleOpportunity(id: string, isActive: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("opportunities")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) { console.error("toggleOpportunity:", error); return false; }
    return true;
  } catch (e) {
    console.error("toggleOpportunity:", e);
    return false;
  }
}

// ── Save / unsave opportunities ───────────────────────────────────────────────
export async function toggleSaveOpportunity(
  opportunityId: string,
  userId: string,
  isSaved: boolean,
): Promise<boolean> {
  try {
    if (isSaved) {
      const { error } = await supabase
        .from("opportunity_saves")
        .delete()
        .match({ opportunity_id: opportunityId, user_id: userId });
      if (error) { console.error("toggleSaveOpportunity (delete):", error); return false; }
    } else {
      const { error } = await supabase
        .from("opportunity_saves")
        .upsert({ opportunity_id: opportunityId, user_id: userId }, { onConflict: "opportunity_id,user_id" });
      if (error) { console.error("toggleSaveOpportunity (insert):", error); return false; }
    }
    return true;
  } catch (e) {
    console.error("toggleSaveOpportunity:", e);
    return false;
  }
}

export async function fetchSavedOpportunityIds(userId: string): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from("opportunity_saves")
      .select("opportunity_id")
      .eq("user_id", userId);
    return new Set((data ?? []).map((r: any) => r.opportunity_id));
  } catch {
    return new Set();
  }
}

// ── My Opportunities (empresa dashboard) ─────────────────────────────────────
export async function fetchMyOpportunities(
  userId: string,
  type?: "vaga" | "marketplace",
): Promise<AppOpportunity[]> {
  try {
    let q = supabase
      .from("opportunities")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) { console.error("fetchMyOpportunities:", error); return []; }
    return (data ?? []) as AppOpportunity[];
  } catch (e) {
    console.error("fetchMyOpportunities:", e);
    return [];
  }
}

// ── Applications received by empresa ─────────────────────────────────────────
export interface AppApplication {
  id: string;
  opportunity_id: string;
  applicant_id: string;
  cv_url: string | null;
  message: string | null;
  created_at: string;
  applicant: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    position: string | null;
    company: string | null;
  } | null;
  opportunity: {
    id: string;
    title: string;
    type: string;
  } | null;
}

export async function fetchApplicationsForMyOpportunities(
  userId: string,
): Promise<AppApplication[]> {
  try {
    const { data: myOps, error: opsErr } = await supabase
      .from("opportunities")
      .select("id")
      .eq("created_by", userId);
    if (opsErr || !myOps?.length) return [];
    const opIds = myOps.map((o: any) => o.id);
    const { data, error } = await supabase
      .from("opportunity_applications")
      .select("id, opportunity_id, applicant_id, cv_url, message, created_at")
      .in("opportunity_id", opIds)
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchApplicationsForMyOpportunities:", error); return []; }
    if (!data || data.length === 0) return [];

    const applicantIds = [...new Set((data as any[]).map(a => a.applicant_id).filter(Boolean))];
    const oppIds2 = [...new Set((data as any[]).map(a => a.opportunity_id).filter(Boolean))];

    const [applicantMap, oppsRes] = await Promise.all([
      fetchProfilesForIds(applicantIds),
      supabase.from("opportunities").select("id, title, type").in("id", oppIds2),
    ]);
    const oppMap = new Map(((oppsRes as any).data ?? []).map((o: any) => [o.id, o]));

    return (data as any[]).map(a => ({
      ...a,
      applicant: a.applicant_id ? (applicantMap.get(a.applicant_id) ?? null) : null,
      opportunity: a.opportunity_id ? (oppMap.get(a.opportunity_id) ?? null) : null,
    })) as any[];
  } catch (e) {
    console.error("fetchApplicationsForMyOpportunities:", e);
    return [];
  }
}
