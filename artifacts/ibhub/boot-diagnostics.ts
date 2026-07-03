/**
 * boot-diagnostics.ts — TEMPORARY boot instrumentation.
 *
 * Imported FIRST (see index.js), before `expo-router/entry`, so it observes
 * failures that happen while the app's module graph evaluates. It MUST NOT
 * import any app code (nothing from "@/…") and MUST NEVER throw — every block
 * is independently wrapped in try/catch.
 *
 * What it does:
 *   1. iOS "green sentinel": overwrites the device's cached navy background
 *      (persisted in UserDefaults by earlier builds, which defeats app.json's
 *      backgroundColor) with green (#1b5e20). On the next cold start:
 *        • flat NAVY  = JS never reached this prelude (native death before JS),
 *        • flat GREEN = JS ran the prelude but React never committed a screen,
 *        • real UI    = healthy.
 *   2. Global JS error handler installed before the app graph evaluates, so it
 *      catches module-evaluation throws. Shows a photographable Alert and
 *      uploads the error (works even without a Mac / device logs).
 *   3. Uploads any native VoidGuard NSException suppressions that were persisted
 *      on a PRIOR boot (in case the native-side POST failed while offline).
 *
 * Remove this file (and revert package.json "main" to "expo-router/entry") once
 * the iOS cold-start boot path is confirmed healthy.
 */
import { Alert, Platform } from "react-native";

const CRASH_URL = "https://www.ibhub.com.br/api/crash-reports";

function truncate(s: string | undefined | null, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function post(type: string, message: string, stack?: string): void {
  try {
    void fetch(CRASH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        message: truncate(message, 2000),
        stack: truncate(stack, 10000),
        device_info: { platform: Platform.OS, source: "boot-prelude" },
      }),
    }).catch(() => {});
  } catch {
    /* crash reporting must never throw */
  }
}

// 1) iOS green sentinel — restore it in JS (app.json is defeated by the device's
//    cached UserDefaults value). iOS-only so Android's appearance is unchanged.
try {
  if (Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SystemUI = require("expo-system-ui");
    void SystemUI?.setBackgroundColorAsync?.("#1b5e20");
  }
} catch {
  /* ignore */
}

// 2) Early global JS error handler (before the app graph evaluates).
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const EU = (globalThis as any).ErrorUtils;
  if (EU?.setGlobalHandler) {
    const original = EU.getGlobalHandler?.() as
      | ((error: unknown, isFatal?: boolean) => void)
      | undefined;
    EU.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      try {
        const err = error instanceof Error ? error : new Error(String(error));
        post(
          "js_error",
          `[boot ${isFatal ? "FATAL" : "non-fatal"}] ${err.message}`,
          err.stack,
        );
        Alert.alert(
          "Erro de inicialização",
          `${err.message}\n\n${truncate(err.stack, 600)}`,
        );
      } catch {
        /* ignore */
      }
      try {
        original?.(error, isFatal);
      } catch {
        /* ignore */
      }
    });
  }
} catch {
  /* ignore */
}

// 3) Upload native VoidGuard suppressions persisted on a prior boot (iOS only).
try {
  if (Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require("expo-modules-core");
    const mod = requireOptionalNativeModule?.("VoidGuard");
    const raw: string | undefined = mod?.getSuppressedReports?.();
    if (raw) {
      let reports: Array<{ type?: string; message?: string; stack?: string }> = [];
      try {
        reports = JSON.parse(raw);
      } catch {
        reports = [];
      }
      if (Array.isArray(reports) && reports.length > 0) {
        for (const r of reports) {
          post(
            r?.type ?? "js_error",
            r?.message ?? "[VoidGuard-native persisted]",
            r?.stack,
          );
        }
        try {
          mod?.clearSuppressedReports?.();
        } catch {
          /* ignore */
        }
      }
    }
  }
} catch {
  /* ignore */
}

export {};
