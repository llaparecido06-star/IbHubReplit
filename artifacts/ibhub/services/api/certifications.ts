import { supabase } from "@/context/AuthContext";
import { fetchCommentProfilesForIds } from "./_shared";

// ─── CERTIFICATION REQUESTS ───────────────────────────────────────────────────

export interface CertificationRequest {
  id: string;
  user_id: string;
  name: string;
  issuer: string;
  cert_number?: string | null;
  date?: string | null;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  requester?: { id: string; full_name: string | null; avatar_url?: string | null } | null;
}

export async function submitCertificationRequest(params: {
  user_id: string;
  name: string;
  issuer: string;
  cert_number?: string;
  date?: string;
}): Promise<CertificationRequest | null> {
  try {
    const { data, error } = await supabase
      .from("certification_requests")
      .insert({
        user_id: params.user_id,
        name: params.name,
        issuer: params.issuer,
        cert_number: params.cert_number || null,
        date: params.date || null,
        status: "pending",
      })
      .select("id, user_id, name, issuer, cert_number, date, status, created_at, reviewed_at, reviewed_by")
      .single();
    if (error) { console.error("submitCertificationRequest:", error); return null; }
    return data as CertificationRequest;
  } catch (e) {
    console.error("submitCertificationRequest:", e);
    return null;
  }
}

export async function getMyCertificationRequests(userId: string): Promise<CertificationRequest[]> {
  try {
    const { data, error } = await supabase
      .from("certification_requests")
      .select("id, user_id, name, issuer, cert_number, date, status, created_at, reviewed_at, reviewed_by")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !data) { console.error("getMyCertificationRequests:", error); return []; }
    return data as CertificationRequest[];
  } catch (e) {
    console.error("getMyCertificationRequests:", e);
    return [];
  }
}

export async function getAdminCertificationRequests(
  status?: "pending" | "verified" | "rejected",
): Promise<CertificationRequest[]> {
  try {
    let query = supabase
      .from("certification_requests")
      .select("id, user_id, name, issuer, cert_number, date, status, created_at, reviewed_at, reviewed_by")
      .order("created_at", { ascending: false });
    if (status) {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error || !data) { console.error("getAdminCertificationRequests:", error); return []; }
    if (data.length === 0) return [];
    const certUserIds = [...new Set((data as any[]).map(r => r.user_id).filter(Boolean))];
    const profileMap = await fetchCommentProfilesForIds(certUserIds);
    return (data as any[]).map(r => ({
      ...r,
      requester: r.user_id ? (profileMap.get(r.user_id) ?? null) : null,
    })) as unknown as CertificationRequest[];
  } catch (e) {
    console.error("getAdminCertificationRequests:", e);
    return [];
  }
}

export async function reviewCertificationRequest(
  id: string,
  action: "verified" | "rejected",
  adminId: string,
): Promise<boolean> {
  try {
    const { data: req, error: fetchErr } = await supabase
      .from("certification_requests")
      .select("user_id, name")
      .eq("id", id)
      .single();
    if (fetchErr || !req) { console.error("reviewCertificationRequest fetch:", fetchErr); return false; }

    const { error: updateErr } = await supabase
      .from("certification_requests")
      .update({ status: action, reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .eq("id", id);
    if (updateErr) { console.error("reviewCertificationRequest update:", updateErr); return false; }

    if (action === "verified") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("certifications")
        .eq("id", req.user_id)
        .single();
      const existing: string[] = Array.isArray(profile?.certifications) ? profile.certifications : [];
      if (!existing.includes(req.name)) {
        await supabase
          .from("profiles")
          .update({ certifications: [...existing, req.name] })
          .eq("id", req.user_id);
      }
    }

    return true;
  } catch (e) {
    console.error("reviewCertificationRequest:", e);
    return false;
  }
}
