/**
 * crashReporter.ts
 *
 * Lightweight JS-level crash reporter for the ibhub mobile app.
 *
 * WHAT IT CAPTURES
 * ─────────────────
 * ✅ React render errors (via ErrorBoundary)
 * ✅ Fatal/non-fatal JS exceptions (via global.ErrorUtils handler)
 * ✅ Unhandled promise rejections
 *
 * WHAT IT CANNOT CAPTURE
 * ──────────────────────
 * ❌ Native startup crashes (before JS engine starts — e.g. TurboModule queue)
 *    → These require a native SDK (Sentry) hooked into iOS PLCrashReporter.
 *    → The "com.meta.react.turbomodulemanager.queue" crashes from Apple review
 *      are in this category and will NOT appear here.
 *
 * Reports are sent to POST /api/crash-reports on the ibhub API server and
 * stored in the crash_reports Supabase table (see migrations_v73_crash_reports.sql).
 * The reporter always fails silently — it must never throw or cause a secondary crash.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export type CrashType = "js_error" | "render_error" | "unhandled_rejection";

interface CrashPayload {
  type: CrashType;
  message?: string;
  stack?: string;
  component_stack?: string;
}

export async function reportCrash(payload: CrashPayload): Promise<void> {
  if (!API_BASE) return;

  try {
    const deviceInfo: Record<string, unknown> = {
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
      deviceName: Constants.deviceName ?? undefined,
      isDevice: Constants.isDevice,
    };

    const body = JSON.stringify({
      ...payload,
      device_info: deviceInfo,
      app_version: Constants.expoConfig?.version ?? "unknown",
      build_version:
        Constants.expoConfig?.ios?.buildNumber ??
        String(Constants.expoConfig?.android?.versionCode ?? "unknown"),
    });

    await fetch(`${API_BASE}/crash-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    // Intentionally swallowed — the crash reporter must never throw.
  }
}

/**
 * Installs a global JS error handler that intercepts fatal and non-fatal
 * React Native errors before they crash the app. Call this once at module
 * load time (top of _layout.tsx), before any provider renders.
 *
 * The original handler is preserved and called after reporting so the
 * default red-screen (in dev) and crash behaviour (in prod) still work.
 */
export function installGlobalErrorHandler(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ErrorUtils = (globalThis as any).ErrorUtils;
  if (!ErrorUtils) return;

  const originalHandler = ErrorUtils.getGlobalHandler?.() as
    | ((error: Error, isFatal?: boolean) => void)
    | undefined;

  ErrorUtils.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
    const err = error instanceof Error ? error : new Error(String(error));
    reportCrash({
      type: "js_error",
      message: `[${isFatal ? "FATAL" : "non-fatal"}] ${err.message}`,
      stack: err.stack,
    });

    originalHandler?.(err, isFatal);
  });
}

/**
 * Installs a global unhandled promise rejection handler.
 * Call once at module load alongside installGlobalErrorHandler.
 */
export function installPromiseRejectionHandler(): void {
  const originalHandler = (Promise as unknown as { _unhandledRejectionHandler?: (reason: unknown) => void })._unhandledRejectionHandler;

  // React Native patches global to track unhandled rejections.
  // We piggyback on the existing mechanism rather than replacing it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracking = (global as any).__reactNativeUnhandledRejectionTracker;
  if (!tracking) return;

  const originalOnUnhandled = tracking.onUnhandled;
  tracking.onUnhandled = (id: unknown, rejection: unknown) => {
    const message =
      rejection instanceof Error
        ? rejection.message
        : String(rejection ?? "unhandled rejection");
    const stack = rejection instanceof Error ? rejection.stack : undefined;
    reportCrash({ type: "unhandled_rejection", message, stack });
    originalOnUnhandled?.(id, rejection);
  };
}
