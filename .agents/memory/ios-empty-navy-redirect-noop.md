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

## Fix — render the gate, do NOT navigate to it
On this iOS config, **BOTH `router.replace()` AND expo-router `<Redirect>` no-op at first cold-start mount** (declarative redirect was tried and FAILED on a real build — it ultimately performs the same imperative navigation under the hood). The reliable fix is to make the route that `/` mounts **render the logged-out screen in place** instead of navigating: in `app/(tabs)/_layout.tsx`, when `authReady && !session`, `return <LoginScreen />` directly (import the route's default export). When the user signs in, `session` flips via `onAuthStateChange`, the layout re-renders, `!session` becomes false, and it renders `<Tabs>` — **no router call ever required**.

**Why:** the bug is that first-mount navigation silently drops; any fix built on navigation (imperative or declarative) inherits the bug. Conditionally rendering the correct screen sidesteps navigation entirely. Safe because: rendering a route's default-export component elsewhere does NOT duplicate route registration; `signIn()` never flips the global `loading` flag, so a failed attempt keeps `LoginScreen` mounted with its inline error.

**How to apply:** when a logged-out iOS user is stuck on a contentless navy screen after the overlay clears, do NOT tune AuthContext timeouts and do NOT add another redirect — render the screen in place. Keep the root imperative effect too (benign: it handles warm transitions; on a device where nav works it just remounts the real login route briefly). HARD CONSTRAINT remains: never swap the root navigator by auth state (Android-freeze) — the permanent `AppStack` stays mounted; the gate lives *inside* the mounted route.

## Diagnosing further failures
If empty-navy ever recurs, ship a temporary on-screen HUD (absolute, `pointerEvents="none"`, iOS-only, gated by a const) in `RootLayoutNav` printing version+build and live `loading/authReady/session/profileChecked/pathname/segments`. The "empty" screen then self-reports its state on-device, ending blind build iterations. Remove it once confirmed.

## Telemetry note
`crash_reports` lives ONLY in Supabase (api-server writes via `supabaseAdmin`), not in Replit Postgres. Service-role key value is not readable from the agent env (`viewEnvVars` masks secret values). An empty-navy bug with NO crash report received by the deployed API is consistent with "no JS exception" → reinforces the navigation diagnosis over a render crash (whose ErrorBoundary fallback is a visible UI anyway).
