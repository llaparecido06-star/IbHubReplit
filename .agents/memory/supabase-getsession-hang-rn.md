---
name: supabase.auth.getSession() hangs on React Native
description: Why API-backed screens can freeze on an infinite spinner while the feed works, and the timeout+cache pattern that fixes it.
---

# `supabase.auth.getSession()` can stall indefinitely on React Native

On RN with `autoRefreshToken: true`, `supabase.auth.getSession()` can hang
forever when an in-flight token refresh holds the auth lock. Any code that
`await`s it before an API call freezes the screen on an infinite spinner.

**Key tell:** an *infinite* spinner (not empty/error) means an un-timeouted
`await`. Network fetches are already bounded (e.g. a 15s AbortController), so a
truly infinite hang points at `getSession()`, not the fetch.

**Why only some tabs freeze:** `supabase.from()` / `.rpc()` queries run off the
client's in-memory cached token and do NOT await `getSession()`, so the feed (and
any direct-Supabase screen) keeps working while every API-service-layer screen
that gates on `getSession()` freezes.

**Fix pattern (in this repo):**
- `services/api/_shared.ts` `getSessionSafe()` — drop-in returning the same
  `{ data: { session } }` shape. **Fast path FIRST:** if the in-memory cached
  session is *fresh* (has `expires_at` and expiry is >60s away, or no `expires_at`),
  return it immediately WITHOUT awaiting `getSession()`. Only when the cache is
  absent / expired / within the 60s buffer does it take the slow path (race the
  real call against a ~4s timeout that RESOLVES with the cached session; drops an
  already-expired session so it never hands out a dead JWT).
  **Why the fast path matters:** even when `getSession()` doesn't fully hang, it
  reads AsyncStorage on EVERY call, so awaiting it on every API fetch made *all*
  API-backed screens feel slow (the feed was fine only because it uses direct
  `supabase.from()`). The cache is kept current by AuthContext + `autoRefreshToken`,
  and the slow path self-heals the cache, so fast-path is safe.
- `signOut()` in AuthContext must call `setCachedSession(null)` SYNCHRONOUSLY
  (not just `clearAuthCache()`, which only wipes the persisted AsyncStorage copy)
  or the fast path can hand out the old token during the brief window before
  `onAuthStateChange(SIGNED_OUT)` fires.
- `services/api/_session.ts` — dependency-cycle-free leaf holding the cached
  `Session` (`set/getCachedSession`).
- `context/AuthContext.tsx` seeds the cache via `setCachedSession()` in init
  (BOTH the cache-hit path — *before* the background validation await — and the
  no-cache path) and in `onAuthStateChange`; clears it on stale-session cleanup.

**Why:** the cache-hit init path is the common one when reopening an installed
build; if the background `getSession()` is the call that stalls, the fallback
must already have the cached session or API tabs render logged-out/empty.

**How to apply:** never add a new API service fn that does a bare
`await supabase.auth.getSession()` — use `getSessionSafe()`. A client-only fix
like this needs a fresh EAS build to reach an already-installed binary. Remaining
raw `getSession()` sites outside `services/api` (admin-api, notificationPrefs,
some `app/*` screens) are on user-action paths and still susceptible — migrate
them if they ever exhibit the same freeze.

# Boot freeze: navy LoadingOverlay that never goes away (iOS)

A *frozen* navy overlay at startup (app open, unresponsive — NOT a <1s crash) is
an `authReady`-never-true bug, not a native crash. `authReady = !loading &&
!(session && !profileChecked)`, so it stays forever if a cached session makes
`session` truthy while `profileChecked` is never forced true.

**Two root causes that combine to cause it:**
1. **async `onAuthStateChange` callback = auth-lock deadlock.** supabase-js holds
   its auth lock for the *entire* duration of the callback. An `async` callback
   that `await`s `getSession()`/`.from()` inside can deadlock the in-flight token
   refresh — which is exactly what makes a *later* `getSession()` hang forever.
   This is a documented supabase-js gotcha. Fix: keep the callback synchronous
   (set immediate auth state only) and schedule all Supabase reads/writes
   (`fetchProfile`, profile safety-net, referral) AFTER it via
   `setTimeout(() => void run(...), 0)`. Re-narrow `session` inside the deferred
   closure (`if (!session?.user) return;`) — TS drops the outer narrowing.
2. **A code path that clears the boot safety-net BEFORE a risky await.** The
   cache-hit init branch used to `clearTimeout(initTimeoutId)` *before* the
   background `getSession()`; if that stalled and there was no cached profile to
   seed `profileChecked`, the net was disarmed and the overlay stayed forever.
   Fix: clear the net only in init()'s `finally` (after all awaits), and keep the
   `getSession()` bounded (timeout-raced) so `finally` always runs.

**Belt-and-suspenders:** an absolute boot watchdog (~7s) armed at effect start
and cleared ONLY on unmount that forces `loading=false` + `profileChecked=true`.
It can never be defeated by a branch clearing it early. Forcing
`profileChecked=true` is acceptable fail-open (RLS is the real control); do NOT
also set `needsProfileCompletion=false` on a fetch error. If even this watchdog
never fires, the JS event loop itself is blocked — no JS timer can recover that.
