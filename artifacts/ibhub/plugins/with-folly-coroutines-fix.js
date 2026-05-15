const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# >>> with-folly-coroutines-fix";
const PATCH = `
    ${MARKER}
    # Disable Folly coroutines to fix Xcode 26 / iPhoneOS26 SDK build error:
    #   'folly/coro/Coroutine.h' file not found in RCT-Folly/folly/Expected.h
    # The header is included only when FOLLY_HAS_COROUTINES != 0; the app
    # does not use folly coroutines, so disabling this flag is safe.
    # Inserted AFTER react_native_post_install so it cannot be overridden.
    Pod::UI.puts "[with-folly-coroutines-fix] Forcing FOLLY_CFG_NO_COROUTINES=1 + FOLLY_HAS_COROUTINES=0 on ALL targets"
    folly_defs = ['FOLLY_CFG_NO_COROUTINES=1', 'FOLLY_HAS_COROUTINES=0']
    folly_cxxflags = ['-DFOLLY_CFG_NO_COROUTINES=1', '-DFOLLY_HAS_COROUTINES=0']
    apply_folly_fix = lambda do |build_configurations|
      build_configurations.each do |config|
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
        defs = [defs] unless defs.is_a?(Array)
        defs = defs.reject { |d| d.to_s.start_with?('FOLLY_CFG_NO_COROUTINES=') || d.to_s.start_with?('FOLLY_HAS_COROUTINES=') }
        defs.concat(folly_defs)
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(inherited)']
        cxxflags = config.build_settings['OTHER_CPLUSPLUSFLAGS']
        cxxflags = [cxxflags] unless cxxflags.is_a?(Array)
        cxxflags = cxxflags.reject { |f| f.to_s.include?('FOLLY_CFG_NO_COROUTINES=') || f.to_s.include?('FOLLY_HAS_COROUTINES=') }
        cxxflags.concat(folly_cxxflags)
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] = cxxflags
      end
    end
    # Apply to pod targets (RNReanimated, RCT-Folly, etc.)
    installer.pods_project.targets.each { |t| apply_folly_fix.call(t.build_configurations) }
    # Also apply to aggregate targets (Pods-<App>) so consumer apps inherit
    installer.aggregate_targets.each { |t| apply_folly_fix.call(t.user_build_configurations.values) rescue nil }
    Pod::UI.puts "[with-folly-coroutines-fix] Applied to #{installer.pods_project.targets.length} pod targets"
    # <<< with-folly-coroutines-fix
`;

// Find the matching closing ')' for a call starting at openParenIdx (which points to '(')
function matchParen(str, openParenIdx) {
  let depth = 0;
  for (let i = openParenIdx; i < str.length; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

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

      const callStart = contents.indexOf("react_native_post_install(");
      if (callStart >= 0) {
        const openParen = contents.indexOf("(", callStart);
        const closeParen = matchParen(contents, openParen);
        if (closeParen > 0) {
          contents =
            contents.slice(0, closeParen + 1) +
            "\n" +
            PATCH +
            contents.slice(closeParen + 1);
          fs.writeFileSync(podfilePath, contents);
          console.log(
            "[with-folly-coroutines-fix] Podfile patched AFTER react_native_post_install (FOLLY_HAS_COROUTINES=0)",
          );
          return cfg;
        }
      }

      // Fallback: inject at the start of post_install block
      if (/post_install do \|installer\|/.test(contents)) {
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|\n${PATCH}`,
        );
      } else {
        contents += `\npost_install do |installer|\n${PATCH}end\n`;
      }
      fs.writeFileSync(podfilePath, contents);
      console.log(
        "[with-folly-coroutines-fix] Podfile patched (fallback path; FOLLY_HAS_COROUTINES=0)",
      );
      return cfg;
    },
  ]);
};

module.exports = withFollyCoroutinesFix;
