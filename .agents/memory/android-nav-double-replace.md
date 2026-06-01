---
name: Android double router.replace freeze
description: Root cause and fix for the post-login freeze on Android where the screen advances, freezes, and snaps back.
---

## Rule
Never start a second `router.replace` while a navigation to the same destination is already in flight.

## Root Cause
The `RootLayoutNav` navigation `useEffect` had `pathname` (and many other deps) but NOT `navInitiated`. After `router.replace("/(tabs)")` is called inside an async IIFE, there is a brief window where:
- `isAuthPath` is still `true` (pathname hasn't updated yet on the JS thread)
- Supabase fires `TOKEN_REFRESHED`, changing the `session` object reference

This causes the effect to re-run with `shouldRedirect = true` (because `isAuthPath=true`), launching a **second async IIFE** that calls `router.replace("/(tabs)")` again. Two rapid `router.replace` calls in succession confuse the Android native stack, producing the visible "advances → freezes → snaps back" artifact.

## Fix (applied)
1. Added `navInitiated` to the navigation effect's deps array.
2. Added a guard immediately after the `!shouldRedirect` check:
   ```ts
   if (navInitiated && lastDestination.current === destination) return;
   ```
   This ensures that if we've already navigated to the current destination (`navInitiated=true` + `lastDestination === destination`), re-runs from session refreshes are silently discarded. Destination changes (e.g. `/(tabs)` → `/social-complete`) are NOT blocked because `lastDestination.current !== destination` in that case.

**Why:** `TOKEN_REFRESHED` fires immediately after `SIGNED_IN` on Android, creating a ~1 render window where both old and new session refs coexist in the effect closure before `pathname` updates.
