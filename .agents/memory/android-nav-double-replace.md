---
name: Android double router.replace freeze
description: Root cause and fix for the post-login freeze on Android where the screen advances, freezes, and snaps back. Also covers cold-start spinner root causes.
---

## Rule
Never call `router.replace("/(tabs)")` from a screen that lives inside the auth Stack. `RootLayoutNav` handles that navigation via its IIFE. Calling it from the screen itself races with the RootLayoutNav IIFE AND with the auth Stack's `(tabs) redirect` configuration, producing the Android freeze.

## Root Cause (four layers, all addressed)

### Layer 1 — PRIMARY: Login screen calling router.replace
`app/(auth)/login.tsx` was calling `router.replace("/(tabs)")` immediately after `signIn()` returned, while the **auth Stack** was still mounted.

**Fix:** Removed `router.replace` from `app/(auth)/login.tsx`. `RootLayoutNav`'s navigation effect is the single source of truth for post-login navigation.

### Layer 2 — SECONDARY: TOKEN_REFRESHED double-IIFE
After `SIGNED_IN`, Supabase immediately fires `TOKEN_REFRESHED`, changing the `session` object reference. The navigation `useEffect` re-ran with `isAuthPath=true` (pathname not yet updated) and same destination → started a second async IIFE → second `router.replace`.

**Fix:** Added guard `if (navInitiated && lastDestination.current === destination) return;` and `navInitiated` in the effect's deps array.

### Layer 3 — EARLIER: transparentModal
`story/[id]` and `story-viewer` were registered with `transparentModal`, making the entire Android Stack background transparent. Changed to `fullScreenModal`.

### Layer 4 — Cold-start frozen navy screen (navIifePendingRef)

**Root cause:** `flagsLoading` (and `manutencao`) in the nav effect's deps array caused the effect to re-run while the `/(tabs)` navigation IIFE was mid-flight (awaiting `coldStartDeepLinkPromise`). When the effect re-ran, `shouldRedirect=false` (because `lastDestination.current` was already set to `"/(tabs)"` before the IIFE started), causing `setNavInitiated(true)` to fire BEFORE `router.replace` was called. `AuthenticatedLayout` then rendered with an empty Stack → frozen navy screen with a tiny gold dot.

**Fix:** Added `navIifePendingRef = useRef(false)` to `RootLayoutNav`:
- Set to `true` immediately before the `/(tabs)` IIFE starts
- Set to `false` inside the IIFE, after `router.replace` is called and before `setNavInitiated(true)`
- The `!shouldRedirect` branch only calls `setNavInitiated(true)` when `!navIifePendingRef.current`
- Removed `flagsLoading` from the nav effect deps array (it was no longer referenced in the body; `manutencao` still covers the maintenance re-check when flags load)

**Why `flagsLoading` was dangerous in deps:** Even though `flagsLoading` was no longer in the early return (removed in previous fix), keeping it in the deps array meant any state change of `flagsLoading` re-triggered the effect. The transition `true → false` fired mid-IIFE and hit the race. The same race can happen with `manutencao` for logged-in users (it returns `false` while loading, then changes), which is why `navIifePendingRef` is the correct fix regardless of which dep triggers the re-run.

## Startup flow after all fixes

Cold start (logged-in user, session cached):
1. `loading=true` → navy spinner (auth context resolving)
2. `loading=false`, `session=X`, `profileChecked=true` from cache
3. `!navInitiated` → navy spinner (ONE frame, ~16ms)
4. Nav effect fires: `navIifePendingRef=true`, IIFE starts, `await coldStartDeepLinkPromise` (already settled)
5. IIFE: `router.replace("/(tabs)")`, `navIifePendingRef=false`, `setNavInitiated(true)`
6. `AuthenticatedLayout` renders with `/(tabs)` active ✓

## How to apply
- **Never** call `router.replace` in auth screens for post-login navigation; `RootLayoutNav` handles it.
- The auth Stack's `<Stack.Screen name="(tabs)" redirect />` is intentional — do NOT remove it.
- `navInitiated` must remain in the navigation effect's deps array.
- `flagsLoading` must NOT be in the nav effect deps — it triggers mid-IIFE re-runs that race with `navIifePendingRef`.
- The register guard must only set `lastDestination.current`, never `navInitiated=true` directly.
- Safety-net timers: 3s for `fetchProfile`, `AuthInit`, and `RootLayoutNav` safety-net effect.
- `navIifePendingRef` is the canonical guard against premature `setNavInitiated(true)` calls.
