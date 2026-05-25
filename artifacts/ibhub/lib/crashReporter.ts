/**
 * crashReporter.ts
 *
 * Crash reporting for the ibhub mobile app via our own API (/api/crash-reports → Supabase).
 *   ✅ React render errors with component stack
 *   ✅ Fatal/non-fatal JS exceptions
 *   ❌ Native startup crashes (JS never runs, so can't send)
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

// ─── Sentry no-op stub ───────────────────────────────────────────────────────
// Keeps the public API so callers don't need to change, but does nothing.
// @sentry/react-native has been removed from this project.

export const Sentry = {
  wrap: <T>(component: T): T => component,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  captureException: (_err: unknown, _ctx?: unknown): void => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  captureMessage: (_msg: string): void => {},
};

// ─── Sentry init (no-op) ─────────────────────────────────────────────────────

/**
 * No-op — kept for call-site compatibility in _layout.tsx.
 * Sentry has been removed from this project.
 */
export function initSentry(): void {
  // intentional no-op
}

// ─── JS crash reporter (our own API) ────────────────────────────────────────

export type CrashType = "js_error" | "render_error" | "unhandled_rejection";

interface CrashPayload {
  type: CrashType;
  message?: string;
  stack?: string;
  component_stack?: string;
}

/**
 * Report an error to our own API server.
 * Always fails silently — must never throw or cause a secondary crash.
 */
export async function reportCrash(payload: CrashPayload): Promise<void> {
  if (!API_BASE) return;
  try {
    const deviceInfo: Record<string, unknown> = {
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
      deviceName: Constants.deviceName ?? undefined,
      isDevice: Constants.isDevice,
    };

    await fetch(`${API_BASE}/crash-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        device_info: deviceInfo,
        app_version: Constants.expoConfig?.version ?? "unknown",
        build_version:
          Constants.expoConfig?.ios?.buildNumber ??
          String(Constants.expoConfig?.android?.versionCode ?? "unknown"),
      }),
    });
  } catch {
    // Intentionally swallowed — crash reporter must never throw.
  }
}

// ─── Global JS error handler ─────────────────────────────────────────────────

/**
 * Installs a global React Native error handler via ErrorUtils.
 * Call once at module load (top of _layout.tsx) before any provider renders.
 * Preserves and chains the original handler so dev red-screen still works.
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
