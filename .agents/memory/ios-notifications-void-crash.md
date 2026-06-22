---
name: iOS void-TurboModule startup crash (expo-notifications)
description: Why a native VOID method throwing at boot crashes iOS under New Arch, and how the notifications wrapper avoids it.
---

# iOS EXC_BAD_ACCESS at startup from a void native method that throws

**Symptom:** iOS-only. App opens, logo flashes, closes in <1s on every launch (even
pre-login). Crash log shows `EXC_BAD_ACCESS (SIGSEGV)` on a background libdispatch
queue running `ObjCTurboModule::performVoidMethodInvocation` →
`convertNSExceptionToJSError` → Hermes `setPropertyValue`, while the JS thread is
also inside Hermes.

**Rule:** Under the New Architecture, a **VOID** native TurboModule method that
throws an `NSException` crashes the app. RN's New-Arch error converter
(`convertNSExceptionToJSError`) mutates the Hermes runtime **from the background
queue the method ran on**, racing the JS thread (Hermes is single-threaded) →
heap corruption. A JS `try/catch` CANNOT catch this — the throw is native and
off the JS thread.

**Why:** `performVoidMethodInvocation` has no JS-side promise to reject, so its
exception handling reaches into Hermes off-thread. Promise/async methods
(`performPromiseMethodInvocation`) are SAFE — they reject on the JS thread.

**How to apply (expo-notifications specifically):**
- The void/crashing entrypoints are the event-emitter ones: `setNotificationHandler`,
  `addNotificationResponseReceivedListener`, `addNotificationReceivedListener`
  (all funnel into the native `addListener` void method).
- `setNotificationHandler` at MODULE LOAD is the deterministic every-launch trigger
  (it runs before login).
- Async methods (`getPermissionsAsync`, `requestPermissionsAsync`,
  `getExpoPushTokenAsync`, `getLastNotificationResponseAsync`,
  `scheduleNotificationAsync`, `cancelAllScheduledNotificationsAsync`) are safe.
- Mitigation that keeps Android intact: in the `safeNotifications` wrapper, (1)
  `require("expo-notifications")` LAZILY (never at module eval), (2) make the three
  void emitter methods no-op on iOS, (3) move any boot-time handler registration
  into a post-mount effect, (4) expose enum maps like `SchedulableTriggerInputTypes`
  via a lazy Proxy so `.DATE` resolves at schedule-time (runtime, safe) instead of
  forcing a module-load require. This keeps iOS permissions + local reminders
  working while only push display/tap is temporarily off.
- Re-enabling iOS push later: reintroduce ONE void call at a time per EAS build; if
  it still throws, capture the underlying NSException name/reason (patch RN's
  converter to log+abort) to learn WHY `addListener` throws before fixing it.

**Validation constraint:** This is native-only and cannot be reproduced in the dev
server / Expo Go — it only manifests in a production EAS build. Each test = a full
EAS/TestFlight build the USER must trigger (agent cannot build). Typecheck + clean
Metro bundle is the most that can be verified locally.

Related: `ios-new-arch-conflict.md` (other iOS New-Arch native crash history).
