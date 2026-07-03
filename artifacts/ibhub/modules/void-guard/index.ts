// void-guard is an iOS-only NATIVE local Expo module. It has no JavaScript API.
//
// Purpose: install (via ObjC `+load`, before `main()`) a guard around
// `-[NSInvocation invokeWithTarget:]` so that an NSException thrown by a VOID
// TurboModule method at boot is caught + logged instead of reaching React
// Native's `convertNSExceptionToJSError`, which would mutate the Hermes runtime
// off the JS thread and crash the app with EXC_BAD_ACCESS before it can render.
//
// All of the logic lives in `ios/VoidGuard.m`. This file exists only so the
// directory is a well-formed module; nothing imports it from JS.
export {};
