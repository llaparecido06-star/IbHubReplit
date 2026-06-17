---
name: iOS New Architecture conflict
description: expo-build-properties plugin overrides root-level newArchEnabled for iOS; Reanimated 4.x requires New Architecture — this was why iOS never worked.
---

## The Rule
When using `expo-build-properties`, the plugin's per-platform `newArchEnabled` **overrides** the root-level `"newArchEnabled"` in `app.json`. Always check both locations.

## What Happened
`app.json` had `"newArchEnabled": true` at the root (line ~10), but `expo-build-properties` had:
```json
"ios": { "newArchEnabled": false }
```
The plugin writes directly into the Podfile/Xcode build settings and wins over the JS-level root flag. iOS was building with Old Architecture (Paper renderer).

**Why:** `react-native-reanimated 4.x` dropped Old Architecture support entirely (announced in Reanimated 4.0 release, Nov 2024). With Old Architecture on iOS, the app crashed or rendered broken gestures/animations on every iPhone and iPad.

**How to Apply:** Any time iOS builds "never work" and Android works fine, check whether `expo-build-properties` has `ios.newArchEnabled: false` while the package.json has `react-native-reanimated@4.x`. The fix is `ios.newArchEnabled: true` in the plugin config.

## Additional context
- The `with-folly-coroutines-fix` plugin (already in place) handles the Xcode 26 / iPhoneOS26 SDK Folly coroutines build error that appears with New Architecture + recent Xcode. It must remain in place.
- Android had `newArchEnabled: true` in expo-build-properties (correct) — that's why Android worked.
- Reanimated 4.x is the default for Expo SDK 52+ (RN 0.76+). Any project using SDK 52+ must have New Architecture enabled on iOS.
