---
name: iOS New Architecture conflict
description: expo-build-properties plugin overrides root-level newArchEnabled for iOS; Reanimated 4.x requires New Architecture — this was why iOS never worked.
---

## The Rule
Enabling New Architecture for iOS needs BOTH to be true at the same time, or the setting is silently ignored in the native build:
1. `ios.newArchEnabled: true` (root `app.json` and/or the `expo-build-properties` per-platform override — the plugin override wins over the root flag).
2. `expo-build-properties` must be the version that MATCHES the installed Expo SDK. A wrong-major version (e.g. `^56.x` on an SDK 54 project) builds fine but does NOT correctly write `newArchEnabled` into the Podfile/Xcode settings — so iOS keeps building Old Architecture even though the config says `true`.

**Setting the flag is necessary but NOT sufficient — the plugin version must match the SDK or the flag does nothing.**

## What Happened (the full story — why iOS "never worked")
1. A commit deliberately set `expo-build-properties` `ios.newArchEnabled: false` ("keeping it disabled for iOS"). Old Architecture + Reanimated 4.x → native startup crash (splash logo shows, then crash <1s).
2. A later commit ("Fix app not working on iOS by enabling the new architecture") set `ios.newArchEnabled: true` — BUT left `expo-build-properties` at `^56.0.14` (wrong major for SDK 54). The setting was silently ignored, so iOS STILL built Old Architecture and STILL crashed. This is why the "fix" appeared not to work.
3. The real fix required ALSO downgrading `expo-build-properties` to the SDK-54-matching `~1.0.10`. Only with the correct plugin version does `ios.newArchEnabled: true` actually take effect.

**Why:** `react-native-reanimated 4.x` dropped Old Architecture support entirely (Reanimated 4.0, late 2024). On Old Architecture iOS it crashes natively at startup — before JS runs, so the in-app `crashReporter` (writes to Supabase `crash_reports`) can NEVER capture it. An EMPTY `crash_reports` table for iOS + "logo then crash <1s" is the signature of a native startup crash, not a JS bug.

**How to Apply:** iOS "never works" while Android works + Reanimated 4.x present → verify New Architecture is ACTUALLY taking effect, not just configured. Check (a) `ios.newArchEnabled: true` AND (b) `expo-build-properties` version matches the SDK (`expo install --check` / `expo-doctor` must pass). Both fixes only take effect on a fresh `eas build`.

## Additional context
- The `with-folly-coroutines-fix` plugin (already in place) handles the Xcode 26 / iPhoneOS26 SDK Folly coroutines build error that appears with New Architecture + recent Xcode. It must remain in place.
- Android had `newArchEnabled: true` in expo-build-properties (correct) — that's why Android worked.
- Reanimated 4.x is the default for Expo SDK 52+ (RN 0.76+). Any project using SDK 52+ must have New Architecture enabled on iOS.
