// Expo config plugin: re-applies the iOS-only RCTTurboModule.mm crash fix during
// `expo prebuild`.
//
// Why a config plugin (and not just the `eas-build-post-install` npm hook):
//   In this pnpm monorepo, EAS runs `pnpm install` at the workspace ROOT and
//   reads npm lifecycle hooks from the ROOT package.json — which has no
//   `eas-build-post-install` — so the per-app hook never ran and build 1.1.5(19)
//   shipped an UNPATCHED React core (crash stack mapped to the pristine
//   `throw convertNSExceptionToJSError(...)` line). Config plugins, by contrast,
//   ALWAYS run during `expo prebuild` on EAS managed builds (proven by the
//   sibling `with-folly-coroutines-fix` plugin), and the dangerous mod executes
//   BEFORE CocoaPods install + xcodebuild, so the patched node_modules source is
//   what React-Core compiles from source.
//
// Requires `ios.buildReactNativeFromSource: true` (expo-build-properties) and/or
// `RCT_USE_PREBUILT_RNCORE=0` so React core is compiled from source — otherwise
// a prebuilt React binary is linked and this source patch has no effect.

const { withDangerousMod } = require("@expo/config-plugins");
const {
  applyPatch,
  resolveReactNativeDir,
} = require("../scripts/apply-ios-rn-patch.js");

const withRnTurboModuleVoidGuard = (config) => {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const reactNativeDir = resolveReactNativeDir([
        cfg.modRequest.projectRoot,
        __dirname,
      ]);
      // Throws (fails prebuild) on any unexpected state, so EAS can never
      // produce another silently-unpatched iOS binary.
      applyPatch(reactNativeDir);
      return cfg;
    },
  ]);
};

module.exports = withRnTurboModuleVoidGuard;
