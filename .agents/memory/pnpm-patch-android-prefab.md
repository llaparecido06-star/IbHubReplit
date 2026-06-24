---
name: pnpm patchedDependencies breaks Android prefab
description: Why iOS-only RN patches must NOT use pnpm patchedDependencies in this Expo monorepo, and how to apply them instead.
---

# pnpm `patchedDependencies` breaks Android EAS (prefab `[CXX1429]`)

Do NOT register a React Native (or any native-dep) patch via pnpm
`patchedDependencies` in the Expo app. pnpm encodes a patched package by
injecting `..._patch_hash=<hash>` (note the `=`) into the `.pnpm` virtual-store
directory name — for the package AND every package that transitively depends on
it (RN → ~52 dirs). The Android `prefab` CLI receives one of those dir paths as
a command-line argument; its option parser splits on `=` and dies with
`Error: no such option: ...patch_hash`, failing the native C++ configure step
(`[CXX1429]`, first surfaced on `react-native-gesture-handler` arm64-v8a).

**Why:** an iOS startup-crash fix (the void-TurboModule Hermes patch) was added
as a pnpm patch; it silently regressed Android even though the patch only edits
an iOS-only file (`RCTTurboModule.mm`).

**How to apply instead:** deliver iOS-only RN source patches via an Expo config
plugin (`withDangerousMod(['ios'])`) registered in `app.json`, which runs during
`expo prebuild` before native compile. Do NOT rely on the `eas-build-post-install`
npm hook alone: in this pnpm monorepo EAS runs install/hooks from the ROOT
package.json, so a per-app hook silently never fires and an unpatched binary ships
(keep the npm hook only as a redundant backup). Keep the root `pnpm-lock.yaml`
free of `patch_hash` (verify: `rg -c patch_hash pnpm-lock.yaml` → 0; resolved
`react-native`/`gesture-handler` paths must contain no `patch_hash=`).

**Patcher gotchas (pure Node, no `patch` binary — it's absent in some images):**
- Break the pnpm store hardlink before writing (rm + write a fresh inode) so you
  never mutate the shared global store.
- Idempotency/completeness must be defined by the edits themselves (every
  replacement present AND its `find` block gone), NOT by the raw
  `throw convertNSExceptionToJSError(...)` line — that exact signature also
  appears in the non-void `performMethodInvocation`, which the patch leaves
  untouched, so it's always present and falsely reads as "unpatched/partial".
- Fail loudly (non-zero exit) on no-match / partial state so an unpatched
  (crash-prone) iOS build can never ship silently.
