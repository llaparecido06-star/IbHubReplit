---
name: iOS empty-navy screen = redirect no-op, not auth freeze
description: Distinguishing the iOS cold-start empty-navy bug from the auth-overlay freeze, and the declarative-redirect fix.
---

# iOS empty navy screen at boot — imperative redirect no-op

## Symptom triage (decisive, ask the user)
A navy boot screen has THREE distinct causes that look similar but mean different things:
- **Logo/icon centered, nothing else** → native splash still up → JS never ran far enough → native crash/hang.
- **Gold spinner + progress text/%** → JS running, `authReady` still false → the AuthContext boot path (see `supabase-getsession-hang-rn.md`).
- **Totally empty navy — NO logo, NO spinner, NO text** → splash was hidden (JS ran + `SplashScreen.hideAsync()` fired) AND the overlay cleared (`authReady` true) → the navigator mounted a route with no visible content. This is a **navigation/redirect** problem, not an auth-freeze.

## Root cause
`/` resolves to `app/(tabs)/index.tsx` via the URL-less `(tabs)` group (there is intentionally **no `app/index.tsx`** — adding one conflicts with the tabs index). So a cold start mounts the authenticated tabs group first. The root layout redirects logged-out users with an **imperative** `router.replace("/(auth)/login")` from a `useEffect`. On **iOS New Architecture + buildReactNativeFromSource**, that imperative call can silently no-op at the very first mount, stranding a logged-out user on the empty navy tabs route (no overlay, because `authReady` is already true).

## Fix
Add a **declarative `<Redirect>` guard inside the mounted route's layout** (`app/(tabs)/_layout.tsx`), after all hooks, mirroring the root effect's branches exactly (recovering/mustChangePassword → reset-password; `!session` → maintenance|login; needsProfileCompletion → social-complete). Declarative `<Redirect>` runs as part of route resolution *after* the navigator exists, so it lands where the imperative call doesn't.

**Why:** declarative redirects from an actually-mounted route are reliable on iOS New Arch; imperative `router.replace()` from a root-layout effect at first mount is not. Keep the imperative effect too — it still handles warm login/logout transitions and non-tab screens; same-target double-redirects are harmless with the permanent Stack.

**How to apply:** when a logged-out iOS user gets stuck on a contentless navy screen after the overlay clears, do NOT keep tuning AuthContext timeouts — the auth path already works (overlay cleared). Guard the route that `/` mounts with a declarative redirect. Branches must mirror the root effect to avoid ping-pong.

## Telemetry note
`crash_reports` lives ONLY in Supabase (api-server writes via `supabaseAdmin`), not in Replit Postgres. Service-role key value is not readable from the agent env (`viewEnvVars` masks secret values). An empty-navy bug with NO crash report received by the deployed API is consistent with "no JS exception" → reinforces the navigation diagnosis over a render crash (whose ErrorBoundary fallback is a visible UI anyway).
