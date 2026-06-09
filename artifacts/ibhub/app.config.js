// Dynamic Expo config — extends app.json to inject the Android
// google-services.json from an EAS environment variable and to derive
// the API base URL for the current build environment.
//
// Priority order for apiUrl:
//   1. EXPO_PUBLIC_API_URL env var (EAS secret / .env override)
//   2. Replit dev environment — derived from REPLIT_DEV_DOMAIN
//   3. Canonical production domain fallback
//
// On EAS Build, GOOGLE_SERVICES_JSON is configured as a "file" type
// environment variable. EAS writes the file to a temp path on the build
// machine and sets process.env.GOOGLE_SERVICES_JSON to its absolute path.
// Locally, the env var is unset, so we fall back to the file checked into
// the artifact directory (./google-services.json), keeping `expo run:android`
// usable for native dev without additional setup.

const PROD_API_URL = "https://www.ibhub.com.br/api";

const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api`
    : null) ||
  PROD_API_URL;

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
  extra: {
    ...config.extra,
    apiUrl,
  },
});
