import type { Session } from "@supabase/supabase-js";

// In-memory snapshot of the latest known Supabase session. Kept up to date by
// AuthContext (init flow + onAuthStateChange). Used as a fallback when
// supabase.auth.getSession() stalls — a known React Native deadlock where an
// in-flight token refresh holds the auth lock and getSession() never resolves,
// freezing any screen that awaits it before an API call. This module has no
// imports of its own (besides a type) so it stays a dependency-cycle-free leaf.

let cachedSession: Session | null = null;

export function setCachedSession(session: Session | null): void {
  cachedSession = session;
}

export function getCachedSession(): Session | null {
  return cachedSession;
}
