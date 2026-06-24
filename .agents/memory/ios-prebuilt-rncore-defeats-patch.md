---
name: Making the iOS React Native .mm patch actually land in the EAS binary
description: Two independent requirements that must BOTH hold or the RCTTurboModule.mm void-guard patch silently never reaches the shipped iOS binary.
---

The iOS void-TurboModule Hermes crash fix is a source patch to
`RCTTurboModule.mm` (see `ios-void-turbomodule-rn-patch.md`). For that patch to
exist in the shipped binary, TWO independent things must hold. Miss either and
the crash stack still shows the pristine `throw convertNSExceptionToJSError`
(`performVoidMethodInvocation` @ `:438`) — patched local `node_modules` +
unpatched crash stack = the patch never compiled, NOT a bad patch.

## Requirement 1 — React core must compile from SOURCE
On Expo SDK 54 / RN 0.81 the build links a **prebuilt React core**
(`React-Core-prebuilt` pod; crash Binary Images show `React.framework` +
`ReactNativeDependencies.framework`) by default, so `node_modules` source is
never compiled. `scripts/cocoapods/rncore.rb` flips to prebuilt when
`ENV["RCT_USE_PREBUILT_RNCORE"] == "1"`. Force source: in `eas.json`
`build.<profile>.env` set `"RCT_USE_PREBUILT_RNCORE": "0"` AND add
`expo-build-properties` `ios.buildReactNativeFromSource: true` (the
Expo-supported declarative control). Deps are independent (`RCT_USE_RN_DEP`,
`scripts/cocoapods/rndependencies.rb`); keep `"RCT_USE_RN_DEP": "1"` to keep
third-party deps prebuilt (avoids the slow boost/folly compile) — though
`buildReactNativeFromSource` may pull deps from source too. Correctness > speed.

## Requirement 2 — the patch must actually be APPLIED during the build
Deliver the edit via an **Expo config plugin** (`withDangerousMod(['ios'])`)
registered in `app.json`. Config plugins ALWAYS run during `expo prebuild` on EAS
managed builds (proven by sibling `with-folly-coroutines-fix`), and the dangerous
mod runs before CocoaPods/xcodebuild, so the patched `node_modules` source is what
compiles. Patch `node_modules/react-native` (not generated `ios/Pods`) — for a
source build, React-Core's podspec reads sources from `node_modules`.

**Why NOT the `eas-build-post-install` npm hook alone:** in a pnpm monorepo EAS
runs `pnpm install` AND npm lifecycle hooks from the ROOT package.json. A per-app
hook in `artifacts/<app>/package.json` silently never fires → an unpatched binary
ships. Keep the npm hook only as a redundant backup; the config plugin is the
reliable path.

**Why:** the off-thread void-TurboModule NSException → `convertNSExceptionToJSError`
→ Hermes mutation crash is generic (any native void method can trigger it; JS
guards like `safeNotifications` only cover known modules). The C++ suppression
patch is the only generic safety net, and it requires BOTH requirements above.

## Verify
After the next EAS build, check the iOS log for `[apply-ios-rn-patch] ... applied
successfully` (or "already fully patched"), confirm pods are NOT using
`React-Core-prebuilt`, and that the new crash (if any) no longer maps `:438` to
the throw. If it STILL crashes, read the `RNVoidTurboModuleGuard` NSLog line — it
prints the exact `moduleName.methodName` of the throwing native call so you can
target the real culprit module directly.
