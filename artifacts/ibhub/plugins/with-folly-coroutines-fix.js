const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# >>> with-folly-coroutines-fix";
const PATCH = `
    ${MARKER}
    # Disable Folly coroutines to fix Xcode 26 / iPhoneOS26 SDK build error:
    #   'folly/coro/Coroutine.h' file not found in RCT-Folly/folly/Expected.h
    # The header is included only when FOLLY_HAS_COROUTINES != 0; the app does
    # not use folly coroutines, so disabling this preprocessor flag is safe.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        unless config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'].include?('FOLLY_HAS_COROUTINES=0')
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_HAS_COROUTINES=0'
        end
      end
    end
    # <<< with-folly-coroutines-fix
`;

const withFollyCoroutinesFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      if (!fs.existsSync(podfilePath)) {
        console.warn("[with-folly-coroutines-fix] Podfile não encontrado:", podfilePath);
        return cfg;
      }
      let contents = fs.readFileSync(podfilePath, "utf8");
      if (contents.includes(MARKER)) {
        console.log("[with-folly-coroutines-fix] Podfile já contém o patch — pulando");
        return cfg;
      }
      if (/post_install do \|installer\|/.test(contents)) {
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|\n${PATCH}`,
        );
      } else {
        contents += `\npost_install do |installer|\n${PATCH}end\n`;
      }
      fs.writeFileSync(podfilePath, contents);
      console.log("[with-folly-coroutines-fix] Podfile aplicado (FOLLY_HAS_COROUTINES=0)");
      return cfg;
    },
  ]);
};

module.exports = withFollyCoroutinesFix;
