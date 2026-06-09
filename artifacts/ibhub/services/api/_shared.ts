import Constants from "expo-constants";
import { supabase } from "@/context/AuthContext";
import type { ProfileLite, CommentProfileLite, CompanyPageLite, RawPostRow } from "./types";

// Priority: explicit env var (EAS / .env file) → app.config.js extra.apiUrl
// (which resolves from REPLIT_DEV_DOMAIN in dev or falls back to the canonical
// production domain) → empty string (should never happen in practice).
export const API_URL: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  "";

export function isNetworkError(e: unknown): boolean {
  const msg = String(e instanceof Error ? e.message : e).toLowerCase();
  return (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("verifique sua conex")
  );
}

export async function guardedFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e: unknown) {
    throw new Error("Verifique sua conexão e tente novamente.");
  } finally {
    clearTimeout(timer);
  }
}


// ─── POSTS ───────────────────────────────────────────────────────────────────

// Helper: normalise the `author` object returned by Supabase embedded selects
// (profiles table uses `position` + `company`, not `headline`)
export function normaliseAuthor<T extends { headline?: string | null; position?: string | null; company?: string | null } | null | undefined>(author: T): T {
  if (!author) return author;
  const headline =
    author.headline ??
    ([author.position, author.company].filter(Boolean).join(" · ") || null);
  return { ...author, headline };
}

// Common embedded author select string (uses real column names)
export const AUTHOR_SELECT = "id, full_name, username, avatar_url, position, company, plan, is_shadowbanned";

/** Returns profile IDs where is_shadowbanned=true, excluding excludeUserId (so the user still sees their own posts). */
export async function fetchShadowbannedIds(excludeUserId?: string): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_shadowbanned", true);
  return (data ?? [])
    .map((p: { id: string }) => p.id)
    .filter((id) => id !== excludeUserId);
}
export const COMMENT_AUTHOR_SELECT = "id, full_name, avatar_url, position, company";

export function normalizePollIndices(userVotes: Record<string, number | number[]> | undefined, userId: string): number[] {
  const v = userVotes?.[userId];
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

// Base post select WITHOUT the broken profiles FK join (posts.user_id → auth.users, not profiles)
export const POST_SELECT_BASE = `id, user_id, company_page_id, content, image_url, image_urls, video_url,
  likes_count, comments_count, shares_count, view_count, location, hashtags, poll, created_at`;
export const COMMENT_SELECT_BASE = `id, post_id, parent_comment_id, user_id, company_page_id, content, created_at, likes_count`;

// Fetch profiles by IDs (workaround: avoids broken FK join posts→auth.users)
export async function fetchProfilesForIds(userIds: string[]): Promise<Map<string, ProfileLite>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select(AUTHOR_SELECT).in("id", userIds);
  return new Map((data ?? []).map((p: ProfileLite) => [p.id, p]));
}
export async function fetchCommentProfilesForIds(userIds: string[]): Promise<Map<string, CommentProfileLite>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select(COMMENT_AUTHOR_SELECT).in("id", userIds);
  return new Map((data ?? []).map((p: CommentProfileLite) => [p.id, p]));
}
export async function fetchCompanyPagesForIds(companyIds: string[]): Promise<Map<string, CompanyPageLite>> {
  if (companyIds.length === 0) return new Map();
  const { data } = await supabase.from("company_pages").select("id, owner_id, name, avatar_url, industry").in("id", companyIds);
  return new Map((data ?? []).map((c: CompanyPageLite) => [c.id, c]));
}
export async function attachAuthorsToPosts<T extends { user_id: string; company_page_id?: string | null }>(
  rawPosts: T[],
  profileMap: Map<string, ProfileLite>,
  companyMap: Map<string, CompanyPageLite>,
): Promise<(T & { author: ProfileLite | undefined; company_page: CompanyPageLite | null })[]> {
  return rawPosts.map((p) => ({
    ...p,
    author: normaliseAuthor(profileMap.get(p.user_id)),
    company_page: p.company_page_id ? (companyMap.get(p.company_page_id) ?? null) : null,
  }));
}


export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUUID = (s: string) => UUID_REGEX.test(s);
