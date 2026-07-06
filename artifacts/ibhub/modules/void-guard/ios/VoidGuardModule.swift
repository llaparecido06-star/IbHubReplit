import ExpoModulesCore

// Minimal Expo module. Its PRIMARY job is to be registered by Expo autolinking so
// this pod (VoidGuard) is compiled and linked into the app — the actual guard is
// installed in ObjC `+load` (see VoidGuard.m), which runs at image load, before
// `main()` and before any TurboModule call.
//
// It ALSO exposes two synchronous JS functions used by the boot-diagnostics
// prelude to retrieve NSException suppressions that VoidGuard.m persisted to
// NSUserDefaults on a prior boot (so they can be uploaded even if the native
// POST failed while offline). TEMPORARY diagnostic API — remove with the rest of
// the boot instrumentation once the culprit module is fixed.
public class VoidGuardModule: Module {
  private static let reportsKey = "IBVoidGuardReports"

  public func definition() -> ModuleDefinition {
    Name("VoidGuard")

    // Returns a JSON array string of persisted native crash reports (each element
    // is itself a JSON object string written by VoidGuard.m).
    Function("getSuppressedReports") { () -> String in
      let arr = UserDefaults.standard.stringArray(forKey: VoidGuardModule.reportsKey) ?? []
      return "[" + arr.joined(separator: ",") + "]"
    }

    Function("clearSuppressedReports") { () -> Void in
      UserDefaults.standard.removeObject(forKey: VoidGuardModule.reportsKey)
    }
  }
}
