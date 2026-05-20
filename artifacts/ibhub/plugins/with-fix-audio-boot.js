/**
 * with-fix-audio-boot.js
 *
 * Android 15 (API 35) restricts starting certain foreground service types
 * (mediaPlayback, microphone) from BOOT_COMPLETED broadcast receivers.
 * expo-audio registers receivers for AudioRecordingService and
 * AudioControlsService with BOOT_COMPLETED, which triggers the Play Store
 * policy warning.
 *
 * This plugin removes the android.intent.action.BOOT_COMPLETED action from
 * all receivers in the generated AndroidManifest so those services are no
 * longer started at boot. The app does not need audio to resume after a
 * device reboot.
 */

const { withAndroidManifest } = require("@expo/config-plugins");

const BOOT_COMPLETED = "android.intent.action.BOOT_COMPLETED";

const withFixAudioBoot = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest?.application?.[0];
    if (!app) return cfg;

    const receivers = app.receiver;
    if (!Array.isArray(receivers) || receivers.length === 0) return cfg;

    let removed = 0;

    app.receiver = receivers
      .map((receiver) => {
        const filters = receiver["intent-filter"];
        if (!Array.isArray(filters)) return receiver;

        const filtered = filters.map((f) => {
          const actions = f.action;
          if (!Array.isArray(actions)) return f;
          const cleaned = actions.filter(
            (a) => a?.$?.["android:name"] !== BOOT_COMPLETED
          );
          if (cleaned.length !== actions.length) removed++;
          return { ...f, action: cleaned };
        });

        return { ...receiver, "intent-filter": filtered };
      })
      // Drop receivers left with empty intent-filter arrays
      .filter((receiver) => {
        const filters = receiver["intent-filter"];
        if (!Array.isArray(filters)) return true;
        return filters.some(
          (f) => Array.isArray(f.action) && f.action.length > 0
        );
      });

    if (removed > 0) {
      console.log(
        `[with-fix-audio-boot] Removed ${removed} BOOT_COMPLETED action(s) from AndroidManifest receivers.`
      );
    }

    return cfg;
  });
};

module.exports = withFixAudioBoot;
