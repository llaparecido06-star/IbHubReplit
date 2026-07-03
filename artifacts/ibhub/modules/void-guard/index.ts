// void-guard is an iOS-only NATIVE local Expo module.
//
// Purpose: install (via ObjC `+load`, before `main()`) a guard around
// `-[NSInvocation invokeWithTarget:]` so that an NSException thrown by a VOID
// TurboModule method at boot is caught + logged instead of reaching React
// Native's `convertNSExceptionToJSError`, which would mutate the Hermes runtime
// off the JS thread and crash the app with EXC_BAD_ACCESS before it can render.
//
// Most logic lives in `ios/VoidGuard.m`. The Swift module (VoidGuardModule.swift)
// additionally exposes two TEMPORARY diagnostic functions —
// `getSuppressedReports()` / `clearSuppressedReports()` — read directly via
// `requireOptionalNativeModule("VoidGuard")` by the boot-diagnostics prelude.
// This barrel is intentionally not imported from app code.
export {};
