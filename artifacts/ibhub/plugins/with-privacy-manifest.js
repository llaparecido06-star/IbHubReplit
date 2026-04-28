const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withPrivacyManifest = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosDir = cfg.modRequest.platformProjectRoot;

      const src = path.join(projectRoot, "plugins", "privacy-manifest.xml");
      const dest = path.join(iosDir, "PrivacyInfo.xcprivacy");

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log("[with-privacy-manifest] PrivacyInfo.xcprivacy copiado para", dest);
      } else {
        console.warn("[with-privacy-manifest] Arquivo source não encontrado:", src);
      }

      return cfg;
    },
  ]);
};

module.exports = withPrivacyManifest;
