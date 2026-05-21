/**
 * crashReporter.ts
 *
 * Two-layer crash reporting for the ibhub mobile app:
 *
 * Layer 1 — Sentry (native SDK):
 *   ✅ Native startup crashes (PLCrashReporter on iOS — the "TurboModule queue" crashes)
 *   ✅ JS exceptions with full symbolicated stack traces
 *   ✅ React render errors
 *   ✅ Performance tracing
 *   → Requires EXPO_PUBLIC_SENTRY_DSN to be set.
 *
 * Layer 2 — Our own API (/api/crash-reports → Supabase):
 *   ✅ React render errors with component stack
 *   ✅ Fatal/non-fatal JS exceptions
 *   ✅ Works even without a Sentry account
 *   ❌ Native startup crashes (JS never runs, so can't send)
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

export { Sentry };

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

// ─── Sentry init ────────────────────────────────────────────────────────────

/**
 * Initialize Sentry. Call this once at the very top of _layout.tsx, before
 * any component renders. Sentry hooks into the native crash reporter at this
 * point, enabling it to capture crashes that happen even before JS runs.
 *
 * No-ops if EXPO_PUBLIC_SENTRY_DSN is not set.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    // Only active in production — avoids noise in dev tunnel builds.
    enabled: !__DEV__,
    environment: __DEV__ ? "development" : "production",
    // Capture 10 % of transactions for performance monitoring.
    tracesSampleRate: 0.1,
    // Attach a screenshot to error events when possible.
    attachScreenshot: true,
  });
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
 * Report an error to both Sentry (if configured) and our own API server.
 * Always fails silently — must never throw or cause a secondary crash.
 */
export async function reportCrash(payload: CrashPayload): Promise<void> {
  // Forward to Sentry (no-op if not initialized).
  if (SENTRY_DSN && !__DEV__) {
    try {
      const err = new Error(payload.message ?? payload.type);
      if (payload.stack) err.stack = payload.stack;
      Sentry.captureException(err, {
        extra: {
          type: payload.type,
          component_stack: payload.component_stack,
        },
      });
    } catch {
      // swallow
    }
  }

  // Forward to our own API.
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
