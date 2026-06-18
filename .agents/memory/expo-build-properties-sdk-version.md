---
name: expo-build-properties SDK version mismatch
description: expo-build-properties version must match the Expo SDK version; using a newer major causes silent native config corruption on iOS. For Android spinner, expo-router patch version is the more likely culprit.
---

## The Rule
`expo-build-properties` uses Expo SDK-aligned versioning **starting from SDK 55+**. Always pin it to the version declared in `npx expo install --check` or `expo doctor`, not the latest available.

| Expo SDK | expo-build-properties |
|---|---|
| SDK 54 | `~1.0.10` |
| SDK 55 | `~55.0.x` |
| SDK 56 | `~56.0.x` |

## What Happened
`package.json` had `"expo-build-properties": "^56.0.14"` (SDK 56 plugin) while the project ran Expo SDK 54. Additionally, `expo-router` was 7 patch versions behind (`~6.0.17` vs expected `~6.0.24`), and `expo` itself was one patch behind.

Platform-specific effects:
- **iOS**: `ios.newArchEnabled: true` not written correctly to Podfile/Xcode → Old Architecture → Reanimated 4.x crash immediately after splash (<1s). Root cause: **expo-build-properties version mismatch**.
- **Android**: navy spinner with no tabs appears after login, never resolves (`navInitiated` stuck at false). Root cause: **likely expo-router@6.0.17 bug** where `router.replace("/(tabs)")` fails silently on Android. `expo-build-properties` is BUILD-TIME only and cannot cause JS runtime spinner behavior.

**Why:** The `^` semver prefix allowed pnpm to resolve a major version jump (1.x → 56.x) when running `pnpm install` near an SDK 56 release.

**How to Apply:**
- Use `~` (not `^`) for ALL `expo-*` packages.
- Run `npx expo install --check` after any `pnpm install`.
- Android spinner (navy, no tabs) = `navInitiated` stuck → check `expo-router` patch version first, not expo-build-properties.
- iOS crash <1s = native build issue → check expo-build-properties + newArchEnabled.

## Fix Applied (June 2026)
- `expo-build-properties`: `^56.0.14` → `~1.0.10`
- `expo-router`: `~6.0.17` → `~6.0.24`
- `expo`: `~54.0.34` → `~54.0.35`
- `expo-font`: `~14.0.10` → `~14.0.12`
- `expo-file-system`: `^19.0.22` → `^19.0.23`
- App name: `"IBHUB - A Rede do Vinho"`
All platforms require new EAS native builds.
