---
name: iOS New-Arch void TurboModule crash — class-level RN patch
description: The robust fix for "a void native method throws at boot and corrupts Hermes off-thread" is patching React Native itself, not whacking modules one by one.
---

# Class-level fix for iOS void-TurboModule startup crashes (New Architecture)

**Symptom:** iOS-only TestFlight startup crash (EXC_BAD_ACCESS/SIGSEGV) on a
background libdispatch queue, stack = `ObjCTurboModule::performVoidMethodInvocation`
→ `convertNSExceptionToJSError` → Hermes `setPropertyValue`. A *void* native
TurboModule method threw an NSException; the New-Arch error converter then mutated
the Hermes VM off the JS thread, corrupting it. JS try/catch CANNOT catch this.

**Why per-module no-ops are not enough:** disabling one offender (e.g.
expo-notifications void emitter methods on iOS) only closes one door. ANY void
native method that throws at boot (NativeEventEmitter addListener/removeListeners
bookkeeping, Linking deep-link subscription, etc.) hits the same converter and
crashes the app the same way. After a notifications-only no-op shipped and the
crash persisted, the conclusion was: fix the whole class at the RN layer.

**The fix (durable):** patch `react-native`'s
`ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm`,
function `ObjCTurboModule::performVoidMethodInvocation`. In the `@catch
(NSException *)` block, do NOT `throw convertNSExceptionToJSError(...)`. Instead
log it (NSLog) and `return` cleanly (a void method has no return value to
satisfy). This neutralizes the entire crash class while keeping the app alive.

**Persist for EAS (delivery matters — see `ios-prebuilt-rncore-defeats-patch.md`):**
do NOT use `pnpm patch` (breaks Android prefab) and do NOT rely on the
`eas-build-post-install` npm hook alone (in this pnpm monorepo EAS runs
install/hooks from the ROOT package.json, so a per-app hook never fires — that
shipped an unpatched binary once). Deliver the `.mm` edit via an Expo config
plugin (`withDangerousMod(['ios'])`) registered in `app.json` (always runs during
`expo prebuild`), AND force source-built core, or the recompiled `.mm` never
lands. newArchEnabled cannot be turned off (Reanimated 4.x requires New Arch).

**Gotchas (both cost real time):**
- Removing the `convertNSExceptionToJSError(runtime, ...)` call leaves the
  `jsi::Runtime &runtime` parameter unused → `-Wunused-parameter` can fail the
  iOS compile. Add `(void)runtime;` at the top of the function.
- `pnpm patch-commit` runs a full reinstall that can exceed a 120s tool timeout
  and exit -1 WITHOUT finishing the lockfile write — leaving the patch file new
  but the lockfile `patch_hash` stale (which then fails EAS `--frozen-lockfile`).
  After patch-commit, ALWAYS verify the lockfile `patch_hash` matches the new
  patch; if stale, run `pnpm install --lockfile-only` (fast, ~1s) to reconcile,
  then confirm with `pnpm install --frozen-lockfile --lockfile-only`.

Related: `ios-notifications-void-crash.md` (the per-module no-op, kept as defence
in depth), `ios-crash-build-correlation.md` (diagnosing repeat crash reports).
