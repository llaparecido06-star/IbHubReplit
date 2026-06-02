---
name: Android double router.replace freeze
description: Root cause and fix for the post-login freeze on Android where the screen advances, freezes, and snaps back. Also covers cold-start spinner root causes.
---

## Rule
Never call `router.replace("/(tabs)")` from a screen that lives inside the auth Stack. `RootLayoutNav` handles that navigation via its IIFE. Calling it from the screen itself races with the RootLayoutNav IIFE AND with the auth Stack's `(tabs) redirect` configuration, producing the Android freeze.

## Root Cause (three layers, all addressed)

### Layer 1 — PRIMARY: Login screen calling router.replace
`app/(auth)/login.tsx` was calling `router.replace("/(tabs)")` immediately after `signIn()` returned, while the **auth Stack** was still mounted.

The auth Stack has `<Stack.Screen name="(tabs)" redirect />`. The sequence:
1. Login: `router.replace("/(tabs)")` while auth Stack mounted → briefly renders `/(tabs)` content
2. Auth Stack's `redirect` on `(tabs)` fires → snaps back to login (the "avança, trava, volta")
3. `onAuthStateChange(SIGNED_IN)` fires → `RootLayoutNav` IIFE also calls `router.replace("/(tabs)")`
4. Two concurrent replaces on Android → visual freeze

**Fix:** Removed `router.replace` from `app/(auth)/login.tsx`. `RootLayoutNav`'s navigation effect is the single source of truth for post-login navigation.

### Layer 2 — SECONDARY: TOKEN_REFRESHED double-IIFE
After `SIGNED_IN`, Supabase immediately fires `TOKEN_REFRESHED` (very common on Android), changing the `session` object reference. The navigation `useEffect` re-ran with `isAuthPath=true` (pathname not yet updated) and same destination → started a second async IIFE → second `router.replace`.

**Fix:** Added guard `if (navInitiated && lastDestination.current === destination) return;` after the `!shouldRedirect` check, and added `navInitiated` to the effect's deps array.

### Layer 3 — EARLIER: transparentModal
`story/[id]` and `story-viewer` were registered with `transparentModal`, which makes the entire Android Stack background transparent. Changed to `fullScreenModal`.

## Cold-Start Freeze Root Causes (separate from login freeze)

### Layer 4 — `flagsLoading` blocked navigation for up to 5s
`FeatureFlagsContext` starts with `isLoading=true`. On first cold start (no flags cache), it waited for a Supabase network query (up to 5s timeout). `_layout.tsx` had:
1. A direct `if (flagsLoading) return <spinner>` render guard
2. `flagsLoading` in the nav effect early return: `if (loading || ... || flagsLoading) return`

Both blocked the entire startup sequence until flags resolved.

**Fix:** Removed the `if (flagsLoading) return spinner` block and removed `flagsLoading` from the nav effect early return. `flagsLoading` stays in the deps array so when it changes, `manutencao` (which reads `false` during loading) is re-evaluated. `MaintenanceGuard` inside `AuthenticatedLayout` handles maintenance mode for authenticated users. Timeout reduced 5s → 2s.

### Layer 5 — Register guard set `navInitiated=true` without `router.replace`
The register guard in `RootLayoutNav`:
```ts
if (pathname.includes("register")) {
  lastDestination.current = destination;
  setNavInitiated(true);  // ← BUG: renders AuthenticatedLayout with empty Stack
  return;
}
```
Setting `navInitiated=true` without calling `router.replace` caused `AuthenticatedLayout` to render with no active route → blank/white screen. The register screen's own `router.replace("/(tabs)")` arrived a frame later.

**Fix:** Remove `setNavInitiated(true)` from the register guard. Only set `lastDestination.current`. When the register screen calls `router.replace("/(tabs)")`, the pathname changes, the nav effect re-runs, finds `shouldRedirect=false`, and calls `setNavInitiated(true)` safely — AFTER the route is already active.

## How to apply
- **Never** call `router.replace` in auth screens for post-login navigation; `RootLayoutNav` handles it.
- The auth Stack's `<Stack.Screen name="(tabs)" redirect />` is intentional — do NOT remove it.
- `navInitiated` must remain in the navigation effect's deps array so the guard reads the current value.
- `flagsLoading` must NOT be in the nav effect early return or direct render guards — it was causing 5s startup blocks. Keep it only in the deps array.
- The register guard must only set `lastDestination.current`, never `navInitiated=true`. The register screen's own `router.replace` drives the transition.
- Safety-net timers: 3s for `fetchProfile`, `AuthInit`, and `RootLayoutNav` safety-net effect.
