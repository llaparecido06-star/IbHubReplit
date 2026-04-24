import { createClient, type Session } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

// ─── Session cache ────────────────────────────────────────────────────────────
// supabase.auth.getSession() acquires a navigator.locks lock to serialize token
// refresh. When many functions call getSession() concurrently on page load, they
// queue on the same lock; after 5 s the waiting callers throw isAcquireTimeout,
// causing all pages to stay on "Carregando…" forever.
//
// Fix: funnell ALL callers through this helper.  It fires at most one real
// getSession() at a time; concurrent callers await the same in-flight promise.
// The result is cached for 3 s so rapid successive calls are instant.

let _sessionCache: { session: Session | null; expiresAt: number } | null = null;
let _sessionPromise: Promise<Session | null> | null = null;

export async function getCachedSession(): Promise<Session | null> {
  const now = Date.now();
  if (_sessionCache && _sessionCache.expiresAt > now) return _sessionCache.session;
  if (_sessionPromise) return _sessionPromise;

  _sessionPromise = supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      _sessionCache = { session, expiresAt: Date.now() + 3000 };
      return session;
    })
    .catch(() => null)
    .finally(() => { _sessionPromise = null; });

  return _sessionPromise;
}

/** Call this from AuthContext after a sign-in / sign-out to bust the cache. */
export function bustSessionCache(): void {
  _sessionCache = null;
  _sessionPromise = null;
}
