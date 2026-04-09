// Safe wrapper around expo-notifications.
// In Expo Go SDK 53+, Android push notification functionality was removed.
// This shim wraps the require() in a try/catch so the app loads without
// crashing in Expo Go. Full functionality is preserved in development builds
// and production.

let mod: any = null;
try {
  mod = require("expo-notifications");
} catch {
  // expo-notifications unavailable or crashes in this environment
}

type PermissionResult = { status: string };

export const getPermissionsAsync = (): Promise<PermissionResult> =>
  mod?.getPermissionsAsync?.() ?? Promise.resolve({ status: "unavailable" });

export const requestPermissionsAsync = (): Promise<PermissionResult> =>
  mod?.requestPermissionsAsync?.() ?? Promise.resolve({ status: "denied" });

export const getExpoPushTokenAsync = (): Promise<{ data: string | null }> =>
  mod?.getExpoPushTokenAsync?.() ?? Promise.resolve({ data: null });

export const scheduleNotificationAsync = (config: unknown): Promise<string | null> =>
  mod?.scheduleNotificationAsync?.(config) ?? Promise.resolve(null);

export const cancelAllScheduledNotificationsAsync = (): Promise<void> =>
  mod?.cancelAllScheduledNotificationsAsync?.() ?? Promise.resolve();

export const SchedulableTriggerInputTypes: Record<string, string> =
  mod?.SchedulableTriggerInputTypes ?? { DATE: "date" };
