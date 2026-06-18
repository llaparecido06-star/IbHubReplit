---
name: Android post-login freeze — never swap the root navigator by auth state
description: Why the Expo app froze on a navy screen after login on Android, and the architectural rule that prevents it. Root layout must keep ONE permanent Stack with all routes always mounted.
---

## Core Rule
The root layout (`app/_layout.tsx` → `RootLayoutNav`) must render ONE permanent `<Stack>` (`AppStack`) that registers **every** route — auth screens AND authenticated screens — and is **always mounted**, regardless of auth state. Drive navigation with a single auth-driven redirect effect (`router.replace` based on `useSegments()`), and show a cosmetic full-screen overlay (`LoadingOverlay`) on top while auth resolves or a redirect is in flight.

**Why:** The previous design conditionally **swapped/unmounted the navigator** based on auth state (spinner `View` ↔ auth `Stack` ↔ authenticated `Stack`). When `router.replace()` ran while only the spinner `View` was mounted (no navigator present), the navigation **silently failed** → permanent frozen navy screen on Android. This was made unrecoverable when a `finally{}` block started latching a "navInitiated" flag even on failed replaces, removing the old self-healing retry. We then piled on ~8 layers of refs/latches/safety-net timers (`navInitiated`, `navIifePendingRef`, `navInitiatedRef`, `safetyNetArmed`, a cold-start IIFE) that only papered over the swap bug. A permanent navigator deletes the entire class of bug: `router.replace` always has a mounted target and can never fail silently.

**How to apply:**
- Keep `AppStack` always mounted. Do **not** reintroduce auth-conditional rendering of different `Stack`s or a bare spinner `View` *in place of* the navigator. The overlay goes *on top of* the navigator, never instead of it.
- `(tabs)` must be a real `<Stack.Screen>` (not `<Stack.Screen name="(tabs)" redirect />`). The feed (`(tabs)/index.tsx`) gates every effect/query on `user?.id`, so it mounts harmlessly under the overlay for an unauthenticated cold start.
- Auth screens (`login`, etc.) must NOT call `router.replace` for post-auth navigation — the root redirect effect owns it. (Exception: `register.tsx` drives its own post-signup nav to `/subscription` or `/(tabs)` because the account is created mid-form; the root effect and overlay both explicitly exclude `register`.)
- Compute the redirect target from `segments[0]`: `(auth)` group = auth area, `auth` = OAuth callback (`app/auth/callback.tsx`), `social-complete`, `maintenance`. `usePathname()` strips group parens, so match auth sub-screens via `pathname.includes("register" | "reset-password")`.
- Recovery / forced password change (`isRecovering || mustChangePassword`) takes precedence → force `/(auth)/reset-password`.
- Mount `UnreadSyncer` / `PushNotificationHandler` / `MaintenanceGuard` only when `session && !isRecovering && !mustChangePassword`.

## Double-replace is now benign
`TOKEN_REFRESHED` (frequent on Android right after `SIGNED_IN`) changes the `session` ref and re-runs the effect. After the first `replace("/(tabs)")`, `segments` become `(tabs)` so the redirect condition is false → no re-redirect. In the tiny window before segments update, a re-run issues at most ONE extra `replace` to the **same** target — harmless now that `(tabs)` is permanently mounted (the old freeze required the navigator to be mid-swap with no target). No refs/guards needed.

## Cold-start deep links
`PushNotificationHandler` is the SOLE owner of cold-start notification deep links (reads `getLastNotificationResponseAsync()` once the authenticated user exists, raced against a 1.5 s timeout — it can hang on Android without Google Play Services). The old module-level `coldStartDeepLinkPromise` IIFE + `coldStartLinkConsumed` flag were removed; do not reintroduce a second consumer.

## Supabase ruled out
This freeze was a navigation-architecture bug, not a Supabase/env issue — `EXPO_PUBLIC_SUPABASE_URL` matched `eas.json`. Don't chase env config for symptoms of a frozen navy screen after login.

## Requires a fresh native build
`app/_layout.tsx` changes ship only via a new `eas build` — they are NOT picked up by an OTA/JS reload of an existing build.
