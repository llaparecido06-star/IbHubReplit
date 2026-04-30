import { supabase } from "@/context/AuthContext";
import { isNetworkError, isValidUUID } from "./_shared";

export async function fetchUserWines(userId: string): Promise<{ id: string; name: string; vintage?: string | null; region?: string | null; notes?: string | null; image_url?: string | null }[]> {
  try {
    // Wine cards are shared from the user's personal cellar (wine_cellar table).
    const { data, error } = await supabase
      .from("wine_cellar")
      .select("id, name, vintage, region, notes, image_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data as any[];
  } catch {
    return [];
  }
}


// ─── WINE CELLAR ─────────────────────────────────────────────────────────────

export interface WineEntry {
  id: string;
  user_id: string;
  name: string;
  producer?: string | null;
  vintage?: string | null;
  region?: string | null;
  country?: string | null;
  grape?: string | null;
  ean?: string | null;
  qty: number;
  price?: number | null;
  buy_date?: string | null;
  drink_by?: string | null;
  storage?: string | null;
  notes?: string | null;
  aroma?: string | null;
  sabor?: string | null;
  harmonizacao?: string | null;
  score_100?: number | null;
  rating: number;
  status: "adega" | "consumido" | "presenteado" | "wishlist";
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface WineCommunityRating {
  ean: string;
  name: string;
  producer: string | null;
  vintage: string | null;
  grape: string | null;
  avg_rating: number;
  avg_score: number | null;
  total_ratings: number;
}

export async function fetchWineCellar(userId: string): Promise<WineEntry[]> {
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) { console.error("fetchWineCellar:", error); return []; }
    return (data ?? []) as WineEntry[];
  } catch (e) {
    console.error("fetchWineCellar:", e);
    return [];
  }
}

export async function fetchPublicWineCellar(userId: string): Promise<WineEntry[]> {
  if (!isValidUUID(userId)) return [];
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .select("*")
      .eq("user_id", userId)
      .eq("is_private", false)
      .order("created_at", { ascending: false });

    if (error) { console.error("fetchPublicWineCellar:", error); return []; }
    return (data ?? []) as WineEntry[];
  } catch (e) {
    console.error("fetchPublicWineCellar:", e);
    return [];
  }
}

export async function addWineEntry(params: Omit<WineEntry, "id" | "created_at" | "updated_at">): Promise<WineEntry | null> {
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .insert(params)
      .select()
      .single();
    if (error) { console.error("addWineEntry:", error); return null; }
    return data as WineEntry;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("addWineEntry:", e);
    return null;
  }
}

export async function updateWineEntry(id: string, changes: Partial<Omit<WineEntry, "id" | "user_id" | "created_at">>): Promise<WineEntry | null> {
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .update(changes)
      .eq("id", id)
      .select()
      .single();
    if (error) { console.error("updateWineEntry:", error); return null; }
    return data as WineEntry;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("updateWineEntry:", e);
    return null;
  }
}

export async function deleteWineEntry(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("wine_cellar").delete().eq("id", id);
    if (error) { console.error("deleteWineEntry:", error); return false; }
    return true;
  } catch (e) {
    if (isNetworkError(e)) throw e;
    console.error("deleteWineEntry:", e);
    return false;
  }
}

export interface WineEanReview {
  id: string;
  user_id: string;
  rating: number | null;
  score: number | null;
  notes: string | null;
  tasted_at: string | null;
  profile: { full_name: string; avatar_url: string | null; username: string | null } | null;
}

/**
 * Busca todas as avaliações individuais de um EAN específico.
 */
export async function fetchWineEanReviews(ean: string): Promise<WineEanReview[]> {
  try {
    const { data, error } = await supabase
      .from("wine_cellar")
      .select("id, user_id, rating, score, notes, tasted_at, profiles(full_name, avatar_url, username)")
      .eq("ean", ean)
      .eq("is_private", false)
      .not("rating", "is", null)
      .order("score", { ascending: false, nullsFirst: false });
    if (error || !data) return [];
    return (data as any[]).map(r => ({
      id: r.id,
      user_id: r.user_id,
      rating: r.rating,
      score: r.score,
      notes: r.notes,
      tasted_at: r.tasted_at,
      profile: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : (r.profiles ?? null),
    }));
  } catch (e) {
    console.warn("fetchWineEanReviews:", e);
    return [];
  }
}

/**
 * Busca o ranking comunitário de vinhos via RPC `wine_community_ratings`.
 * Vinhos ordenados por nota média desc.
 * @param ean - Se fornecido, retorna apenas o card daquele EAN específico.
 */
export async function fetchWineCommunityRatings(ean?: string): Promise<WineCommunityRating[]> {
  try {
    const { data, error } = await supabase.rpc("wine_community_ratings", {
      p_ean: ean ?? null,
    });
    if (error) { console.warn("fetchWineCommunityRatings:", error); return []; }
    return (data ?? []) as WineCommunityRating[];
  } catch (e) {
    console.warn("fetchWineCommunityRatings:", e);
    return [];
  }
}
