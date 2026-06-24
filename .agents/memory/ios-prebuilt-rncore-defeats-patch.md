---
name: Expo SDK 54 prebuilt RN core defeats node_modules source patches (iOS)
description: Why patching react-native .mm source has zero effect on iOS under Expo SDK 54, and the env-var fix to make it land.
---

On Expo SDK 54 / RN 0.81 iOS, patching React Native C++/ObjC++ source in
`node_modules` (e.g. `RCTTurboModule.mm` via an `eas-build-post-install` script)
has **ZERO effect on the shipped binary by default** — the build links a
**prebuilt React core** (`React-Core-prebuilt` pod; crash Binary Images show
`React.framework` + `ReactNativeDependencies.framework`), so the patched source
is never compiled.

**Tell-tale sign:** after "applying" a source patch, the crash stack still shows
the SAME unpatched line numbers (e.g. `convertNSExceptionToJSError` @
`RCTTurboModule.mm:221` ← `performVoidMethodInvocation` @ `:438`). Patched local
`node_modules` + unpatched crash stack = prebuilt core bypass, NOT a bad patch.

**Root cause (from RN pod scripts):** `scripts/cocoapods/rncore.rb` defaults
`@@build_from_source = true`, but flips to prebuilt when
`ENV["RCT_USE_PREBUILT_RNCORE"] == "1"` (which Expo SDK 54 / EAS sets for fast
builds). Deps are controlled independently by `ENV["RCT_USE_RN_DEP"]` (prebuilt
when `"1"`), in `scripts/cocoapods/rndependencies.rb`.

**Fix:** in `eas.json` `build.<profile>.env` set
`"RCT_USE_PREBUILT_RNCORE": "0"` (forces RN core to compile from source so the
patch lands). Keep `"RCT_USE_RN_DEP": "1"` so third-party deps stay prebuilt —
source-core + prebuilt-deps is a supported matrix and avoids the slow
boost/folly compile. Keep the post-install patch script.

**Why:** the off-thread void-TurboModule NSException → `convertNSExceptionToJSError`
→ Hermes mutation crash is generic (any native void method can trigger it; JS
guards like `safeNotifications` only cover known modules). The C++ suppression
patch is the only generic safety net, and it requires source-built core.

**How to apply / verify:** after the next EAS build, check the iOS build log for
`[apply-ios-rn-patch] ... applied successfully`, confirm pods are NOT using
`React-Core-prebuilt`, and that core is built from source. Trade-off: iOS builds
are noticeably slower. If it STILL crashes, read the `RNVoidTurboModuleGuard`
NSLog line — it prints the exact `moduleName.methodName` of the throwing native
call so you can target the real culprit module directly.
