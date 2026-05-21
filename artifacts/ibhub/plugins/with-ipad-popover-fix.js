/**
 * with-ipad-popover-fix.js
 *
 * On iPad, UIKit requires that every UIViewController presented as a popover
 * (including action sheets, share sheets and alerts styled as popovers) has a
 * non-nil `popoverPresentationController.sourceView` or `barButtonItem`.
 * React Native and some of its native modules omit the anchor on iPhone builds,
 * which is fine there but causes a fatal NSException on iPad:
 *
 *   "UIPopoverPresentationController presented from a view that does not have
 *    a window."
 *
 * This plugin injects a small Swift extension into the generated Xcode project
 * via a method-swizzling approach that sets a safe default anchor (the centre
 * of the key window's root view) whenever a popover is about to be presented
 * without one.
 *
 * Scope: iOS only. The file is only compiled when `UIDevice.current.userInterfaceIdiom == .pad`.
 */

const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs   = require("fs");
const path = require("path");

const SWIFT_FILE_NAME = "IPadPopoverFix.swift";

const SWIFT_SOURCE = `
import UIKit

// Swizzle UIViewController.present(_:animated:completion:) so that every
// popover presented without a source anchor gets a safe default one (the
// center of the key window's root view).  Only active on iPad.
private let _swizzlePopoverOnce: Void = {
  guard UIDevice.current.userInterfaceIdiom == .pad else { return }
  let original = class_getInstanceMethod(UIViewController.self, #selector(UIViewController.present(_:animated:completion:)))
  let swizzled = class_getInstanceMethod(UIViewController.self, #selector(UIViewController.ibhub_present(_:animated:completion:)))
  if let orig = original, let swiz = swizzled {
    method_exchangeImplementations(orig, swiz)
  }
}()

extension UIViewController {
  @objc func ibhub_present(
    _ viewControllerToPresent: UIViewController,
    animated flag: Bool,
    completion: (() -> Void)? = nil
  ) {
    // Trigger swizzle registration exactly once.
    _ = _swizzlePopoverOnce

    // Fix popover anchor for iPad if missing.
    if UIDevice.current.userInterfaceIdiom == .pad,
       let popover = viewControllerToPresent.popoverPresentationController,
       popover.sourceView == nil,
       popover.barButtonItem == nil {
      // Use the centre of the presenting view as a safe fallback anchor.
      popover.sourceView = self.view
      popover.sourceRect = CGRect(
        x: self.view.bounds.midX,
        y: self.view.bounds.midY,
        width: 0,
        height: 0
      )
      popover.permittedArrowDirections = []
    }

    self.ibhub_present(viewControllerToPresent, animated: flag, completion: completion)
  }
}
`;

const withIpadPopoverFix = (config) => {
  // Step 1: Write the Swift file into the ios/ source tree.
  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;
      // Place the file next to AppDelegate — it will be picked up automatically
      // by Xcode since all .swift files in the project root are compiled.
      const destPath = path.join(iosDir, SWIFT_FILE_NAME);
      fs.writeFileSync(destPath, SWIFT_SOURCE.trimStart());
      console.log(`[with-ipad-popover-fix] Wrote ${SWIFT_FILE_NAME}`);
      return cfg;
    },
  ]);

  // Step 2: Add the Swift file to the Xcode project so it is compiled.
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const group = project.getFirstProject().firstProject.mainGroup;

    // Avoid adding the file twice on repeated prebuild runs.
    const alreadyAdded = Object.values(project.hash.project.objects["PBXFileReference"] || {}).some(
      (ref) => typeof ref === "object" && ref.path === SWIFT_FILE_NAME,
    );

    if (!alreadyAdded) {
      project.addSourceFile(SWIFT_FILE_NAME, {}, group);
      console.log(`[with-ipad-popover-fix] Added ${SWIFT_FILE_NAME} to Xcode project`);
    } else {
      console.log(`[with-ipad-popover-fix] ${SWIFT_FILE_NAME} already in Xcode project`);
    }

    return cfg;
  });

  return config;
};

module.exports = withIpadPopoverFix;
