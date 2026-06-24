// Re-applies the iOS-only React Native fix during EAS builds, in pure Node.
//
// Why this exists (and is NOT a pnpm `patchedDependencies` entry):
//   pnpm's native patch mechanism renames the package — and EVERY package that
//   depends on it — inside the virtual store, injecting `..._patch_hash=<hash>`
//   into the directory name. The `=` in that path breaks the Android `prefab`
//   CLI during the native C++ configure step (`[CXX1429] ... Error: no such
//   option ...patch_hash`), failing the whole Android build.
//
//   The fix itself only touches an iOS-only file (RCTTurboModule.mm), so we keep
//   the iOS startup-crash fix by re-applying it here — after install, before the
//   native build — WITHOUT polluting the store directory names.
//
// This module is invoked from TWO places so the patch ALWAYS lands:
//   1. The `eas-build-post-install` npm hook (CLI: `node apply-ios-rn-patch.js`).
//      In a pnpm monorepo EAS may read lifecycle hooks from the ROOT package.json
//      and never run the per-app hook, so this path is best-effort.
//   2. The Expo config plugin `plugins/with-rn-turbomodule-void-guard.js`, which
//      runs during `expo prebuild` (always executed on EAS managed builds) and
//      calls `applyPatch()` directly. This is the reliable path.
//
// Pure Node (no external `patch` binary) so it runs on any EAS build image.
// Idempotent: skips if the marker is already present.
// Fails loudly (throws -> non-zero exit / failed prebuild) on anything
// unexpected, so we never ship an accidentally-unpatched iOS build.

const fs = require("fs");
const path = require("path");

const MARKER = "RNVoidTurboModuleGuard";
const TARGET_RELATIVE =
  "ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm";

// Each edit's `find` must match the pristine RN 0.81.5 source exactly. If a
// future RN bump changes this source, `find` stops matching and we fail loudly
// rather than silently shipping an unpatched (crash-prone) iOS build.
const EDITS = [
  {
    find:
      "    NSMutableArray *retainedObjectsForInvocation)\n" +
      "{\n" +
      "  __weak id<RCTBridgeModule> weakModule = instance_;\n",
    replace:
      "    NSMutableArray *retainedObjectsForInvocation)\n" +
      "{\n" +
      "  // [RNVoidTurboModuleGuard] `runtime` is intentionally unused: the only former\n" +
      "  // use was convertNSExceptionToJSError(runtime, ...) in the @catch below, which\n" +
      "  // we removed to stop off-thread Hermes corruption. Silence -Wunused-parameter.\n" +
      "  (void)runtime;\n" +
      "  __weak id<RCTBridgeModule> weakModule = instance_;\n",
  },
  {
    find:
      "    @try {\n" +
      "      [inv invokeWithTarget:strongModule];\n" +
      "    } @catch (NSException *exception) {\n" +
      "      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);\n" +
      "    } @finally {\n" +
      "      [retainedObjectsForInvocation removeAllObjects];\n" +
      "    }\n" +
      "\n" +
      "    if (shouldVoidMethodsExecuteSync_) {\n",
    replace:
      "    BOOL nativeVoidException = NO;\n" +
      "    @try {\n" +
      "      [inv invokeWithTarget:strongModule];\n" +
      "    } @catch (NSException *exception) {\n" +
      "      // [RNVoidTurboModuleGuard] Do NOT rethrow as a JS error here. Under the\n" +
      "      // New Architecture on iOS this block may run on a background dispatch\n" +
      "      // queue, and convertNSExceptionToJSError() mutates the Hermes runtime off\n" +
      "      // the JS thread — corrupting the VM and crashing the app at startup with\n" +
      "      // EXC_BAD_ACCESS before the user can even reach the login screen. A void\n" +
      "      // native method has no return value to satisfy, so we suppress + log the\n" +
      "      // native exception instead of letting it take down the whole app.\n" +
      "      nativeVoidException = YES;\n" +
      '      NSLog(@"[RNVoidTurboModuleGuard] Suppressed NSException in %s.%s: %@: %@\\n%@",\n' +
      "            moduleName, methodName, exception.name, exception.reason, exception.callStackSymbols);\n" +
      "    } @finally {\n" +
      "      [retainedObjectsForInvocation removeAllObjects];\n" +
      "    }\n" +
      "\n" +
      "    if (nativeVoidException) {\n" +
      "      if (shouldVoidMethodsExecuteSync_) {\n" +
      "        TurboModulePerfLogger::syncMethodCallExecutionEnd(moduleName, methodName);\n" +
      "      } else {\n" +
      "        TurboModulePerfLogger::asyncMethodCallExecutionEnd(moduleName, methodName, asyncCallCounter);\n" +
      "      }\n" +
      "      return;\n" +
      "    }\n" +
      "\n" +
      "    if (shouldVoidMethodsExecuteSync_) {\n",
  },
];

// Throw (not process.exit) so callers — both the CLI and the Expo config plugin
// — propagate the failure. An uncaught throw in the CLI still exits non-zero.
function fail(message) {
  throw new Error(`[apply-ios-rn-patch] ${message}`);
}

// Resolve the on-disk react-native package directory from the given lookup paths.
function resolveReactNativeDir(fromPaths) {
  let rnPkgJson;
  try {
    rnPkgJson = require.resolve("react-native/package.json", {
      paths: fromPaths,
    });
  } catch (error) {
    fail(`could not resolve react-native: ${error.message}`);
  }
  return path.dirname(rnPkgJson);
}

// Apply the iOS RCTTurboModule.mm patch into the given react-native directory.
function applyPatch(reactNativeDir) {
  const target = path.join(reactNativeDir, TARGET_RELATIVE);
  if (!fs.existsSync(target)) {
    fail(`target file not found: ${target}`);
  }

  let source = fs.readFileSync(target, "utf8");

  // "Fully patched" is defined directly by the edits: every replacement block is
  // present AND its original `find` block is gone. We do NOT key off the raw
  // throw line — that exact signature also appears in the non-void
  // performMethodInvocation, which this patch intentionally leaves untouched.
  const isFullyPatched = () =>
    EDITS.every((e) => source.includes(e.replace) && !source.includes(e.find));

  if (isFullyPatched()) {
    console.log("[apply-ios-rn-patch] already fully patched — skipping.");
    return;
  }
  // Marker present but not fully patched => partial / corrupted tree (e.g. a
  // half-written cache). Fail rather than silently skip and ship a crash-prone
  // iOS build.
  if (source.includes(MARKER)) {
    fail(
      "file is partially patched (marker present but edits incomplete) — " +
        "refusing to proceed on an inconsistent source.",
    );
  }

  for (let i = 0; i < EDITS.length; i++) {
    const { find, replace } = EDITS[i];
    const idx = source.indexOf(find);
    if (idx === -1) {
      fail(
        `edit #${i + 1} did not match — RCTTurboModule.mm may have changed for ` +
          `this RN version. Refusing to ship an unpatched iOS build.`,
      );
    }
    if (source.indexOf(find, idx + find.length) !== -1) {
      fail(`edit #${i + 1} matched more than once — ambiguous, aborting.`);
    }
    source = source.replace(find, replace);
  }

  if (!source.includes(MARKER) || !isFullyPatched()) {
    fail("edits applied but result is inconsistent — aborting.");
  }

  // Break the pnpm store hardlink before writing so we never mutate the shared
  // global store: remove the entry, then write a fresh inode.
  try {
    fs.rmSync(target);
  } catch (error) {
    fail(`could not remove target before rewrite: ${error.message}`);
  }
  fs.writeFileSync(target, source, "utf8");

  console.log("[apply-ios-rn-patch] React Native iOS fix applied successfully.");
}

function main() {
  const reactNativeDir = resolveReactNativeDir([__dirname]);
  applyPatch(reactNativeDir);
}

if (require.main === module) {
  main();
}

module.exports = {
  EDITS,
  MARKER,
  TARGET_RELATIVE,
  applyPatch,
  resolveReactNativeDir,
};
