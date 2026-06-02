---
name: Android double router.replace freeze
description: Root cause and fix for the post-login freeze on Android where the screen advances, freezes, and snaps back.
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

## How to apply
- **Never** call `router.replace` in auth screens for post-login navigation; `RootLayoutNav` handles it.
- The auth Stack's `<Stack.Screen name="(tabs)" redirect />` is intentional — do NOT remove it.
- `navInitiated` must remain in the navigation effect's deps array so the guard reads the current value.
- The same pattern applies to any other auth screen (register, social-complete, etc.) — they should not call `router.replace("/(tabs)")` themselves.
