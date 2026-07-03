---
name: iOS boot observability (dead-runtime navy screen)
description: Why an iOS cold-start can show a flat navy screen with no crash/React, and how to make boot observable without a Mac.
---

# iOS boot observability — dead-runtime navy screen

Symptom: iOS standalone build cold-starts to a FLAT navy screen forever — no
crash, no spinner, no boot HUD, no error text — while the SAME JS on Android
boots fine.

## Non-obvious truths

- **Navy ≠ JS alive.** Expo's SystemUI persists the background color to the
  device's `UserDefaults` (`ExpoSystemUI.backgroundColor`) on first run and reads
  it BEFORE the Info.plist. Every build ≤ a certain point used navy `#0d1b2a`, so
  the device cached navy. Later `app.json` `backgroundColor` changes (e.g. a green
  sentinel) are **never applied** on that device — the cached value wins. A fully
  dead JS runtime therefore shows navy natively. To use a color as a liveness
  sentinel you MUST set it from JS via `expo-system-ui`
  `setBackgroundColorAsync(...)`, not from `app.json`.

- **iOS-only failure + Android fine (same JS) ⇒ native interop, not shared JS.**
  A pure JS module-eval error would fail on both platforms.

- **VoidGuard can convert a crash into a silent dead runtime.** The global
  `-[NSInvocation invokeWithTarget:]` swizzle that suppresses the boot NSException
  (fixing the SIGSEGV) can leave a boot-critical native call silently failed →
  runtime never commits React → navy screen, no crash.

- **`ErrorUtils.setGlobalHandler` inside `_layout.tsx` is installed TOO LATE.** ES
  imports are hoisted, so the handler in `_layout`'s module body runs AFTER every
  app import has already evaluated. It cannot catch a throw during module
  evaluation. An empty `crash_reports` table is therefore INCONCLUSIVE unless an
  earlier handler exists.

## How to make boot observable (the pattern that worked)

- **Custom entry prelude:** `package.json` `main` → `index.js` that does
  `import "./boot-diagnostics"; import "expo-router/entry";`. `boot-diagnostics`
  has ZERO app imports, every block try/catch'd (must never throw), and installs
  `ErrorUtils.setGlobalHandler` + `Alert.alert` (photographable, works without a
  Mac and without React) + a POST to the crash endpoint BEFORE the app graph
  evaluates. This is the documented expo-router custom-entry pattern; no Metro/EAS
  risk.

- **Native self-report from the swizzle:** in VoidGuard's `@catch`, besides
  NSLog, persist the NSException (name/reason/target class/first ~15
  `callStackSymbols`) to `NSUserDefaults` (bounded) AND async `NSURLSession` POST
  it. Guard rails: `__thread BOOL` reentrancy flag, `atomic_int` cap (~5 reports,
  NOT report-once — the killer may be the 3rd), async only (never block the
  turbomodule/boot thread), persist-first so the JS prelude can upload it on a
  later launch if the POST didn't flush offline. Expose sync Expo `Function`s
  (`getSuppressedReports`/`clearSuppressedReports`) read via
  `requireOptionalNativeModule("VoidGuard")` (returns null on Android — safe).

- **Crash endpoint gotcha:** the `/crash-reports` route enforces
  `type ∈ {js_error, render_error, unhandled_rejection}` and returns 400
  otherwise. Native reports must use `type:"js_error"` with a `[VoidGuard-native]`
  message prefix; message ≤2000, stack ≤10000. Curl-test the exact payload before
  a ~40-min build.

## Tri-state readout on the next cold start

- flat **navy** = JS never reached the prelude (native death before JS ran).
- flat **green** = JS ran the prelude but React never committed a screen
  (check `crash_reports` for `[boot FATAL]` / `[VoidGuard-native]` rows + Alert).
- real **UI** = healthy.

**Why:** each state points at a different layer, so one instrumented build
localizes the failure instead of guessing blindly across ~40-min build cycles.
