// Lazy, defensive wrapper around expo-notifications.
//
// Two problems this guards against:
//   1. Expo Go (SDK 53+): expo-notifications throws at IMPORT time because remote
//      push is unsupported there.
//   2. iOS + New Architecture (production EAS builds): the native event-emitter
//      path (setNotificationHandler / addNotification*Listener -> native
//      `addListener`, a VOID TurboModule method) throws an NSException on a
//      background dispatch queue at startup. RN's New-Arch error converter
//      (`convertNSExceptionToJSError`) then mutates the Hermes runtime FROM that
//      background thread, racing the JS thread -> heap corruption -> the app
//      crashes instantly with EXC_BAD_ACCESS (SIGSEGV). A JS try/catch cannot
//      catch this because the throw happens natively, off the JS thread.
//
// Strategy:
//   - require("expo-notifications") LAZILY, only when a method is actually used,
//     so nothing native runs during module evaluation / app boot.
//   - Make the VOID emitter methods (the crashing path) no-ops on iOS for now.
//     Async/promise methods (permissions, token, scheduling) use the safe
//     promise path and keep working on every platform.

import { Platform } from "react-native";

// undefined = not yet attempted; null = unavailable (Expo Go); object = loaded
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let N: Record<string, any> | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getN(): Record<string, any> | null {
  if (N === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      N = require("expo-notifications");
    } catch {
      N = null; // Expo Go: push notifications unavailable — graceful no-op
    }
  }
  return N ?? null;
}

// iOS: the native `addListener` path throws an NSException during startup under
// the New Architecture, corrupting Hermes and crashing the app. Until iOS push
// is re-enabled safely (step by step), all VOID emitter methods no-op on iOS.
const IOS_VOID_NOTIFICATIONS_DISABLED = Platform.OS === "ios";

type PermissionResult = { status: string };
type Subscription = { remove: () => void };
type NotificationResponse = {
  notification: {
    request: {
      content: {
        data: Record<string, unknown>;
      };
    };
  };
};

export const getPermissionsAsync = async (): Promise<PermissionResult> => {
  try {
    const n = getN();
    if (!n) return { status: "unavailable" };
    return await n.getPermissionsAsync();
  } catch {
    return { status: "unavailable" };
  }
};

export const requestPermissionsAsync = async (): Promise<PermissionResult> => {
  try {
    const n = getN();
    if (!n) return { status: "denied" };
    return await n.requestPermissionsAsync();
  } catch {
    return { status: "denied" };
  }
};

export const getExpoPushTokenAsync = async (
  options?: { projectId?: string },
): Promise<{ data: string | null }> => {
  try {
    const n = getN();
    if (!n) return { data: null };
    const result = await n.getExpoPushTokenAsync(options);
    return { data: result?.data ?? null };
  } catch {
    return { data: null };
  }
};

export const getLastNotificationResponseAsync = async (): Promise<NotificationResponse | null> => {
  try {
    const n = getN();
    if (!n) return null;
    return (await n.getLastNotificationResponseAsync()) ?? null;
  } catch {
    return null;
  }
};

// VOID emitter method — disabled on iOS (crashing path).
export const addNotificationResponseReceivedListener = (
  handler: (response: NotificationResponse) => void,
): Subscription => {
  if (IOS_VOID_NOTIFICATIONS_DISABLED) return { remove: () => {} };
  try {
    const n = getN();
    if (!n) return { remove: () => {} };
    return n.addNotificationResponseReceivedListener(handler);
  } catch {
    return { remove: () => {} };
  }
};

// VOID emitter method — disabled on iOS (crashing path).
export const addNotificationReceivedListener = (
  handler: (notification: unknown) => void,
): Subscription => {
  if (IOS_VOID_NOTIFICATIONS_DISABLED) return { remove: () => {} };
  try {
    const n = getN();
    if (!n) return { remove: () => {} };
    return n.addNotificationReceivedListener(handler);
  } catch {
    return { remove: () => {} };
  }
};

// VOID emitter method — registering the foreground handler internally calls the
// native `addListener`. Disabled on iOS (crashing path).
export const setNotificationHandler = (handler: unknown): void => {
  if (IOS_VOID_NOTIFICATIONS_DISABLED) return;
  try {
    getN()?.setNotificationHandler(handler);
  } catch {
    // unavailable in Expo Go
  }
};

export const scheduleNotificationAsync = async (_config: unknown): Promise<string | null> => {
  try {
    const n = getN();
    if (!n) return null;
    return await n.scheduleNotificationAsync(_config);
  } catch {
    return null;
  }
};

export const cancelAllScheduledNotificationsAsync = async (): Promise<void> => {
  try {
    await getN()?.cancelAllScheduledNotificationsAsync();
  } catch {
    // unavailable in Expo Go
  }
};

// Lazily resolved via a Proxy so it NEVER requires expo-notifications at module
// load (keeps iOS app boot free of any native notification work). Consumers read
// `.DATE` etc. only at schedule time (inside event handlers), at which point the
// lazy require is safe on every platform — local reminders keep working on iOS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SchedulableTriggerInputTypes: Record<string, any> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      return getN()?.SchedulableTriggerInputTypes?.[prop];
    },
  },
);
