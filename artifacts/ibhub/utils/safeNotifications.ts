// Dynamic require to avoid module-load failure in Expo Go (SDK 53+).
// expo-notifications throws at import time in Expo Go because remote push
// is not supported there. We lazy-require to prevent the crash entirely.
// In dev-client and production EAS builds, the real module is used.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let N: Record<string, any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  N = require("expo-notifications");
} catch {
  // Expo Go: push notifications unavailable — graceful no-op
}

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
    if (!N) return { status: "unavailable" };
    return await N.getPermissionsAsync();
  } catch {
    return { status: "unavailable" };
  }
};

export const requestPermissionsAsync = async (): Promise<PermissionResult> => {
  try {
    if (!N) return { status: "denied" };
    return await N.requestPermissionsAsync();
  } catch {
    return { status: "denied" };
  }
};

export const getExpoPushTokenAsync = async (
  options?: { projectId?: string },
): Promise<{ data: string | null }> => {
  try {
    if (!N) return { data: null };
    const result = await N.getExpoPushTokenAsync(options);
    return { data: result?.data ?? null };
  } catch {
    return { data: null };
  }
};

export const getLastNotificationResponseAsync = async (): Promise<NotificationResponse | null> => {
  try {
    if (!N) return null;
    return (await N.getLastNotificationResponseAsync()) ?? null;
  } catch {
    return null;
  }
};

export const addNotificationResponseReceivedListener = (
  handler: (response: NotificationResponse) => void,
): Subscription => {
  try {
    if (!N) return { remove: () => {} };
    return N.addNotificationResponseReceivedListener(handler);
  } catch {
    return { remove: () => {} };
  }
};

export const addNotificationReceivedListener = (
  handler: (notification: unknown) => void,
): Subscription => {
  try {
    if (!N) return { remove: () => {} };
    return N.addNotificationReceivedListener(handler);
  } catch {
    return { remove: () => {} };
  }
};

export const setNotificationHandler = (handler: unknown): void => {
  try {
    N?.setNotificationHandler(handler);
  } catch {
    // unavailable in Expo Go
  }
};

export const scheduleNotificationAsync = async (_config: unknown): Promise<string | null> => {
  try {
    if (!N) return null;
    return await N.scheduleNotificationAsync(_config);
  } catch {
    return null;
  }
};

export const cancelAllScheduledNotificationsAsync = async (): Promise<void> => {
  try {
    await N?.cancelAllScheduledNotificationsAsync();
  } catch {
    // unavailable in Expo Go
  }
};

export const SchedulableTriggerInputTypes = N?.SchedulableTriggerInputTypes ?? {};
