---
name: iOS prebuilt-core void-guard (NSInvocation swizzle)
description: How the iOS boot void-TurboModule crash is fixed when React core is PREBUILT (RN .mm patch is inert); plus the confirmed source-build-vs-JS tradeoff.
---

# iOS boot: prebuilt core runs JS, but the RN void-guard .mm patch goes inert

**Two mutually-exclusive facts nailed down (Expo SDK 54 / RN 0.81.5, New Arch, Hermes):**
- **Source-built React core** (RCT_USE_PREBUILT_RNCORE=0 + expo-build-properties ios.buildReactNativeFromSource:true) → the JS engine NEVER executes (silent hang on the native root view). The RN `RCTTurboModule.mm` void-guard source patch DOES apply here, but JS is dead so it doesn't matter.
- **Prebuilt React core** (buildReactNativeFromSource:false) → **JS runs** (crash log shows Hermes actively interpreting on the JS thread). BUT the `.mm` source patch is INERT (can't patch a prebuilt binary) → the void-TurboModule NSException crash is EXPOSED: `performVoidMethodInvocation` → `convertNSExceptionToJSError` mutates Hermes off the JS thread → EXC_BAD_ACCESS at boot.

So you cannot get both "JS runs" and "the .mm patch protects you" from build config alone.

## The fix that works on PREBUILT core
A local Expo native module `modules/void-guard/` (apple-only) whose ObjC `+load` swizzles `-[NSInvocation invokeWithTarget:]` and wraps the call in `@try/@catch`, suppressing + `NSLog`-ing the NSException and returning. RN's void path runs the module method via `[inv invokeWithTarget:module]`, so this catches the exception BEFORE RN's own `@catch`/converter ever runs. Works because it lives in the app's own pod (autolinked), not in prebuilt React.
- **Why not source-patch RN:** prebuilt React.framework is a binary — no source to patch.
- **Why not NSUncaughtExceptionHandler:** the exception is CAUGHT by RN; it never becomes uncaught. The crash is the off-thread Hermes mutation, not an uncaught throw.
- **Tradeoff (accepted to ship):** the swizzle is process-wide; a NON-void TurboModule method that throws would also be swallowed (JS sees `undefined`). Every suppression is logged so the real culprit can be found and later no-op'd precisely in JS.
- **`+load` reliability:** relies on `-ObjC` being in the app link flags (always true in an RN app because of the React pods) so the ObjC class isn't dead-stripped from the static lib.

## Path that is REFUTED — don't waste a build on it
"Source core + remove with-folly-coroutines-fix (to fix the dead JS) + keep the .mm patch" does NOT work. RN 0.81.5's own folly config (`scripts/cocoapods/helpers.rb`) already sets `FOLLY_CFG_NO_COROUTINES=1`, so the plugin only re-asserts RN's own value — it never created a folly ABI/ODR mismatch. Removing it will not revive JS on source core; the source-core dead-JS cause is elsewhere and unidentified. **Why:** verified against RN source, not guessed.

## Diagnosing WHICH void method throws (the .ips won't tell you)
The crash `.ips` has NO NSException name/reason (RN caught + converted it; the SEGV carries no message). Appetize/simulator syslog alone won't show it either. To identify the culprit: read the VoidGuard `+load` swizzle's `[VoidGuard] Suppressed NSException in …` NSLog (device/simulator logs), OR a JS-side TurboModuleRegistry tracer. Notifications were already fully no-op'd on iOS, so the boot culprit is a LIBRARY's NativeEventEmitter/addListener, not app code.
