// Dynamic Expo config — extends app.json to inject the Android
// google-services.json from an EAS environment variable.
//
// On EAS Build, GOOGLE_SERVICES_JSON is configured as a "file" type
// environment variable. EAS writes the file to a temp path on the build
// machine and sets process.env.GOOGLE_SERVICES_JSON to its absolute path.
// Locally, the env var is unset, so we fall back to the file checked into
// the artifact directory (./google-services.json), keeping `expo run:android`
// usable for native dev without additional setup.

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
