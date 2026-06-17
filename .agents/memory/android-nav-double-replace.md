---
name: Android double router.replace freeze
description: Root cause and fix for the post-login/cold-start loop on Android ("avança 1cm e volta") caused by multiple router.replace calls. Covers all layers found and fixed.
---

## Core Rule
Never call `router.replace("/(tabs)")` from inside an auth screen. `RootLayoutNav` is the single source of truth for all post-auth navigation. Any extra `router.replace` races with the IIFE and produces the Android loop.

---

## Layer 1 — Login screen calling router.replace
`login.tsx` called `router.replace("/(tabs)")` after `signIn()` returned while the auth Stack was still mounted. The auth Stack has `<Stack.Screen name="(tabs)" redirect />` which snapped back to login, plus `RootLayoutNav`'s IIFE also called it → double replace.

**Fix:** Removed `router.replace` from `login.tsx`.

---

## Layer 2 — TOKEN_REFRESHED double-IIFE (the infinite loop)

**Root cause:** TOKEN_REFRESHED (fired by Supabase on Android right after SIGNED_IN) changes the `session` object reference. This re-triggers the nav effect with `isAuthPath=true` (pathname not yet updated), `navInitiated=false`, and `shouldRedirect=true`. The existing guard `if (navInitiated && lastDestination.current === destination) return` does NOT fire because `navInitiated=false`. So a **second IIFE** starts while the first is still awaiting `coldStartDeepLinkPromise`. Both IIFEs call `router.replace("/(tabs)")` → Android "avança 1cm e volta" infinite loop.

**Fix:** Added `navIifePendingRef = useRef(false)` with two roles:
1. **Blocks a second IIFE**: `if (navIifePendingRef.current) return;` immediately before the IIFE start (after `lastDestination.current = destination` is already set, so next re-run sees `shouldRedirect=false`).
2. **Prevents premature `setNavInitiated(true)` in `!shouldRedirect` branch**: `if (!navIifePendingRef.current) setNavInitiated(true)` — AuthenticatedLayout only renders after `router.replace` has been called inside the IIFE.

Timeline of `navIifePendingRef`:
- `false` (initial)
- `true` — set just before the IIFE starts (guards both roles above)
- `false` — set inside the IIFE, AFTER `router.replace` is called, BEFORE `setNavInitiated(true)`

---

## Layer 6 — navInitiatedRef closes the residual race window

**Root cause (residual):** `navIifePendingRef` blocked concurrent IIFEs, but a timing gap remained: after the IIFE sets `navIifePendingRef.current = false` and calls `setNavInitiated(true)`, React commits the state update asynchronously. If TOKEN_REFRESHED fires in that gap, the effect re-runs with `navIifePendingRef=false` AND `navInitiated=false` → guard at line 346 does not fire → third IIFE → loop persists on some Android devices.

**Fix:** Added `navInitiatedRef = useRef(false)` as a synchronous mirror of `navInitiated` state. Set `navInitiatedRef.current = true` BEFORE `navIifePendingRef.current = false` in the IIFE (and before `setNavInitiated(true)` everywhere). Guard updated to `if ((navInitiated || navInitiatedRef.current) && lastDestination.current === destination) return`. The ref is always synchronously true by the time the gap exists, so no second IIFE can start.

---

## Layer 3 — transparentModal
`story/[id]` registered with `transparentModal` made the entire Android Stack background transparent. Changed to `fullScreenModal`.

---

## Layer 4 — flagsLoading blocked startup for up to 5s
`FeatureFlagsContext` started with `isLoading=true`. Both the render path and the nav effect early return blocked on this for up to 5s (no flags cache on first cold start).

**Fix:** Removed `if (flagsLoading) return spinner` and `flagsLoading` from nav effect early return. `flagsLoading` also removed from nav effect deps (it was causing mid-IIFE re-runs; `manutencao` is still a dep and covers the maintenance re-check when flags load). Timeout reduced 5s → 2s.

---

## Layer 5 — Register guard set navInitiated=true without router.replace
The register guard called `setNavInitiated(true)` without calling `router.replace`, rendering `AuthenticatedLayout` with an empty Stack → navy frozen screen.

**Fix:** Register guard now only sets `lastDestination.current = destination` and returns. `setNavInitiated(true)` is set by the `!shouldRedirect` branch when the register screen's own `router.replace` fires and the pathname changes.

---

## Layer 7 — navInitiated NOT reset on session clear (re-login blank screen)

**Root cause:** On logout, `navInitiated` (React state) was never reset to `false`. On the subsequent re-login, the render immediately returned `<AuthenticatedLayout />` (because `!navInitiated = false`) before the navigation IIFE called `router.replace("/(tabs)")`. The `Stack` inside `AuthenticatedLayout` had no active route → blank screen flash or brief navy screen on every re-login.

**Fix:** Added `setNavInitiated(false)` and `navInitiatedRef.current = false` to the `session=null` cleanup effect alongside the existing `safetyNetArmed.current = false` reset. `safetyNetArmed` was already correctly reset, so re-arming the 2s safety-net on re-login also works correctly.

---

## Layer 8 — PushNotificationHandler.handleLastResponse without timeout

**Root cause:** `handleLastResponse` inside `PushNotificationHandler` called `getLastNotificationResponseAsync()` again (after `coldStartDeepLinkPromise` already consumed it with a 1.5s timeout). Without a timeout, on Android without Google Play Services this async call could hang indefinitely and become an orphan — navigating unexpectedly when it finally resolves, possibly after logout/re-login.

**Fix:** Added `Promise.race` with a 1.5s timeout, matching the pattern used in `coldStartDeepLinkPromise`.

---

## Debug alerts — the paradox (commit 8905026)
Debug `Alert.alert` calls added to `login.tsx` to diagnose the freeze were placed EXACTLY where the freeze happened. On Android, `Alert.alert` is synchronous/blocking on the JS thread. This blocked `onAuthStateChange(SIGNED_IN)` from completing its work. The alerts were simultaneously diagnosing AND causing the freeze. Removed in subsequent session.

---

## Startup timeouts (current values)
- `fetchProfile` timeout: 2s
- `AuthInit` timeout: 3s  
- `FeatureFlagsContext` no-cache timeout: 2s
- `coldStartDeepLinkPromise` timeout: 1.5s
- `PushNotificationHandler.handleLastResponse` timeout: 1.5s
- `RootLayoutNav` safety-net: 2s

---

## How to apply (checklist)
- **Auth screens**: NEVER call `router.replace` for post-auth navigation. RootLayoutNav handles it.
- **Auth Stack**: Keep `<Stack.Screen name="(tabs)" redirect />` — do not remove.
- **`navIifePendingRef`**: The canonical guard against both second-IIFE and premature `setNavInitiated`.
  - Check `if (navIifePendingRef.current) return` BEFORE starting a new IIFE.
  - Check `if (!navIifePendingRef.current) setNavInitiated(true)` in the `!shouldRedirect` branch.
- **`flagsLoading`**: Must NOT be in nav effect deps or early return. Only `manutencao` (derived) covers the flags re-check.
- **Register guard**: Only sets `lastDestination.current`. No `setNavInitiated(true)`.
- **`navInitiated`**: Must stay in nav effect deps. Must be reset to `false` when `session` clears.
- **Any `getLastNotificationResponseAsync()` call**: Always race against 1.5s timeout.
