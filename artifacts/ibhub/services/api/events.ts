import { supabase } from "@/context/AuthContext";
import { compressPostImage } from "@/utils/compressImage";
import { getSessionSafe, API_URL, fetchProfilesForIds, guardedFetch } from "./_shared";

async function _dispatchEventPush(path: string, body: Record<string, string>): Promise<void> {
  if (!API_URL) return;
  try {
    const { data: { session } } = await getSessionSafe();
    const token = session?.access_token;
    if (!token) return;
    await guardedFetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
export interface AppEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location_type: "presencial" | "online" | string;
  location: string | null;
  link: string | null;
  image_url: string | null;
  restricted_positions: string[] | null;
  entry_type: "gratuito" | "pago-externo" | "pago-integrado" | string;
  capacity: number | null;
  visibility: string | null;
  is_active: boolean | null;
  pay_link: string | null;
  created_at: string;
  organizer?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
  company_organizer?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  attendees_count?: number;
  is_attending?: boolean;
}

export interface AppEventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: string | null;
  created_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    position: string | null;
  } | null;
}

async function enrichEventsWithOrganizer(events: any[]): Promise<any[]> {
  if (events.length === 0) return events;
  const userIds = [...new Set(events.map((e: any) => e.user_id).filter(Boolean))];

  // Collect company_page_ids that are set directly on events (authoritative source)
  const directCompanyPageIds = [...new Set(events.map((e: any) => e.company_page_id).filter(Boolean))];

  const [profilesRes, directCompaniesRes, ownerCompaniesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, username").in("id", userIds),
    directCompanyPageIds.length > 0
      ? supabase.from("company_pages").select("id, owner_id, name, avatar_url").in("id", directCompanyPageIds)
      : Promise.resolve({ data: [] }),
    supabase.from("company_pages").select("id, owner_id, name, avatar_url").in("owner_id", userIds),
  ]);

  const profileMap     = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
  const companyById    = new Map((directCompaniesRes.data ?? []).map((c: any) => [c.id, c]));
  const companyByOwner = new Map((ownerCompaniesRes.data ?? []).map((c: any) => [c.owner_id, c]));

  return events.map((e: any) => ({
    ...e,
    organizer: profileMap.get(e.user_id) ?? null,
    // Prefer direct company_page_id linkage; fall back to owner_id lookup
    company_organizer: (e.company_page_id ? companyById.get(e.company_page_id) : null)
      ?? companyByOwner.get(e.user_id)
      ?? null,
  }));
}

export async function fetchEvents(search = "", userId = ""): Promise<AppEvent[]> {
  try {
    let q = supabase
      .from("events")
      .select(`
        id, user_id, company_page_id, title, description, start_date, end_date,
        location_type, location, link, image_url, restricted_positions,
        entry_type, capacity, visibility, is_active, pay_link, created_at,
        attendees_count
      `)
      .eq("is_active", true)
      .order("start_date", { ascending: true });
    if (search) q = q.ilike("title", `%${search}%`);
    const { data, error } = await q;
    if (error) { console.error("fetchEvents:", error); return []; }

    let events = await enrichEventsWithOrganizer(
      (data ?? []).map((e: any) => ({ ...e, attendees_count: e.attendees_count ?? 0, is_attending: false }))
    );

    if (userId && events.length > 0) {
      const ids = events.map((e: any) => e.id);

      const [attendingResult, profileResult] = await Promise.all([
        supabase.from("event_attendees").select("event_id").eq("user_id", userId).in("event_id", ids),
        supabase.from("profiles").select("position, areas_of_expertise").eq("id", userId).maybeSingle(),
      ]);

      const attendingSet = new Set((attendingResult.data ?? []).map((a: any) => a.event_id));
      events = events.map((e: any) => ({ ...e, is_attending: attendingSet.has(e.id) }));

      const userPosition: string | null = profileResult.data?.position ?? null;
      const userAreas: string[] = profileResult.data?.areas_of_expertise ?? [];

      events = events.filter((e: any) => {
        if (e.visibility !== "restrito") return true;
        if (e.user_id === userId) return true;
        const allowed: string[] = e.restricted_positions ?? [];
        if (allowed.length === 0) return true;
        if (userPosition && allowed.includes(userPosition)) return true;
        if (userAreas.some((a: string) => allowed.includes(a))) return true;
        return false;
      });
    } else {
      events = events.filter((e: any) => e.visibility !== "restrito");
    }

    return events;
  } catch (e) {
    console.error("fetchEvents:", e);
    return [];
  }
}

export async function fetchAllEventsAdmin(): Promise<AppEvent[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, user_id, company_page_id, title, description, start_date, end_date, location_type, location, link, image_url, restricted_positions, entry_type, capacity, visibility, is_active, pay_link, created_at")
      .order("start_date", { ascending: true });
    if (error) { console.error("fetchAllEventsAdmin:", error); return []; }
    return await enrichEventsWithOrganizer(data ?? []);
  } catch (e) {
    console.error("fetchAllEventsAdmin:", e);
    return [];
  }
}

export async function fetchConfirmedAttendanceCount(): Promise<number> {
  try {
    // Count all attendee rows — cancellation removes the row so all rows are confirmed.
    // Falls back gracefully if the status column doesn't exist yet.
    const { count, error } = await supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true });
    if (error) { console.error("fetchConfirmedAttendanceCount:", error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error("fetchConfirmedAttendanceCount:", e);
    return 0;
  }
}

export async function fetchEventById(id: string): Promise<AppEvent | null> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, user_id, company_page_id, title, description, start_date, end_date,
        location_type, location, link, image_url, restricted_positions,
        entry_type, capacity, visibility, is_active, pay_link, created_at
      `)
      .eq("id", id)
      .single();
    if (error) { console.error("fetchEventById:", error); return null; }
    const [enriched] = await enrichEventsWithOrganizer([data]);
    return (enriched ?? data) as any;
  } catch (e) {
    console.error("fetchEventById:", e);
    return null;
  }
}

export async function uploadEventImage(imageUri: string, userId: string): Promise<string | null> {
  try {
    const ext = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/events/${Date.now()}.${ext}`;
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(path, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: true });
    if (error) { console.error("uploadEventImage:", error); return null; }
    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("uploadEventImage:", e);
    return null;
  }
}

export async function uploadOpportunityImage(uri: string, userId: string): Promise<string | null> {
  try {
    const compressed = await compressPostImage(uri);
    const path = `${userId}/opportunities/${Date.now()}.jpg`;
    const response = await fetch(compressed);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) { console.error("uploadOpportunityImage:", error); return null; }
    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("uploadOpportunityImage:", e);
    return null;
  }
}

export async function createEvent(params: {
  user_id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  location_type: string;
  location?: string | null;
  link?: string | null;
  image_url?: string | null;
  restricted_positions?: string[] | null;
  entry_type: string;
  capacity?: number | null;
  visibility?: string;
  pay_link?: string | null;
  company_page_id?: string | null;
}): Promise<AppEvent | null> {
  try {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...params, is_active: true })
      .select()
      .single();
    if (error) { console.error("createEvent:", error); return null; }
    return data as any;
  } catch (e) {
    console.error("createEvent:", e);
    return null;
  }
}

export async function fetchEventAttendees(eventId: string): Promise<AppEventAttendee[]> {
  try {
    const { data, error } = await supabase
      .from("event_attendees")
      .select("id, event_id, user_id, status, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error) { console.error("fetchEventAttendees:", error); return []; }
    if (!data || data.length === 0) return [];
    const attendeeIds = [...new Set((data as any[]).map(a => a.user_id).filter(Boolean))];
    const profileMap = await fetchProfilesForIds(attendeeIds);
    return (data as any[]).map(a => ({
      ...a,
      profile: a.user_id ? (profileMap.get(a.user_id) ?? null) : null,
    })) as any[];
  } catch (e) {
    console.error("fetchEventAttendees:", e);
    return [];
  }
}

export async function checkAttendance(eventId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("event_attendees")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function confirmAttendance(
  eventId: string,
  userId: string,
  organizerId: string,
  eventTitle: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("event_attendees")
      .upsert({ event_id: eventId, user_id: userId, status: "confirmed" }, { onConflict: "event_id,user_id" });
    if (error) { console.error("confirmAttendance:", error); return false; }
    if (organizerId !== userId) {
      await supabase.from("notifications").insert({
        user_id: organizerId,
        actor_id: userId,
        type: "event_rsvp",
        message: `confirmou presença no seu evento "${eventTitle}"`,
      });
      void _dispatchEventPush("/push/event-rsvp", { eventId });
    }
    return true;
  } catch (e) {
    console.error("confirmAttendance:", e);
    return false;
  }
}

export async function cancelAttendance(eventId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("event_attendees")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);
    if (error) { console.error("cancelAttendance:", error); return false; }
    return true;
  } catch (e) {
    console.error("cancelAttendance:", e);
    return false;
  }
}
