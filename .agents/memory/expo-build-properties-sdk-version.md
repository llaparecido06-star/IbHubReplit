---
name: expo-build-properties SDK version mismatch
description: expo-build-properties version must match the Expo SDK version; using a newer major causes silent native config corruption on both iOS and Android.
---

## The Rule
`expo-build-properties` uses Expo SDK-aligned versioning **starting from SDK 55+**. Always pin it to the version declared in `npx expo install --check` or `expo doctor`, not the latest available.

| Expo SDK | Correct expo-build-properties |
|---|---|
| SDK 54 | `~1.0.10` |
| SDK 55 | `~55.0.x` |
| SDK 56 | `~56.0.x` |

## What Happened
`package.json` had `"expo-build-properties": "^56.0.14"` (SDK 56 plugin) while the project ran Expo SDK 54 (which expects `~1.0.10`). The incompatible plugin silently applied wrong native templates during EAS builds:

- **iOS**: `ios.newArchEnabled: true` not written correctly to Podfile/Xcode → app built with Old Architecture → Reanimated 4.x crashed immediately after splash (<1s)
- **Android**: incorrect gradle/manifest config → `router.replace("/(tabs)")` never committed navigation → spinner hung forever after login

The Expo dev server (`expo start`) does NOT use this plugin, so the issue only manifests in EAS native builds — never caught in development.

**Why:** The `^` semver prefix allowed pnpm to resolve a major version jump (1.x → 56.x) when running `pnpm install` near an SDK 56 release. The plugin's native config template API changed significantly between versions.

**How to Apply:**
- Run `npx expo install --check` after any `pnpm install` to catch version mismatches before building.
- Always use `~` (not `^`) for all expo-* packages so minor bumps are allowed but major version jumps are blocked.
- If iOS crashes immediately on launch AND Android has post-login navigation issues on a new build (but dev server is fine), check `expo doctor` for `expo-build-properties` version mismatch first.

## Fix Applied (June 2026)
Changed `"expo-build-properties": "^56.0.14"` → `"~1.0.10"` in `artifacts/ibhub/package.json`. Both platforms require new EAS native builds to apply the fix.
