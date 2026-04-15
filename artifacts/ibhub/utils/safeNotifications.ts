// Thin wrapper around expo-notifications that gracefully degrades in Expo Go
// (expo-notifications is unavailable in Expo Go SDK 53+).
// In real dev-client / production builds, real expo-notifications is used.

import * as Notifications from "expo-notifications";

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
    return await Notifications.getPermissionsAsync();
  } catch {
    return { status: "unavailable" };
  }
};

export const requestPermissionsAsync = async (): Promise<PermissionResult> => {
  try {
    return await Notifications.requestPermissionsAsync();
  } catch {
    return { status: "denied" };
  }
};

export const getExpoPushTokenAsync = async (
  options?: { projectId?: string },
): Promise<{ data: string | null }> => {
  try {
    const result = await Notifications.getExpoPushTokenAsync(options);
    return { data: result.data ?? null };
  } catch {
    return { data: null };
  }
};

export const getLastNotificationResponseAsync = async (): Promise<NotificationResponse | null> => {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return response as NotificationResponse | null;
  } catch {
    return null;
  }
};

export const addNotificationResponseReceivedListener = (
  handler: (response: NotificationResponse) => void,
): Subscription => {
  try {
    return Notifications.addNotificationResponseReceivedListener(
      handler as (response: Notifications.NotificationResponse) => void,
    );
  } catch {
    return { remove: () => {} };
  }
};

export const addNotificationReceivedListener = (
  handler: (notification: unknown) => void,
): Subscription => {
  try {
    return Notifications.addNotificationReceivedListener(
      handler as (notification: Notifications.Notification) => void,
    );
  } catch {
    return { remove: () => {} };
  }
};

export const setNotificationHandler = (
  handler: Notifications.NotificationHandler | null,
): void => {
  try {
    Notifications.setNotificationHandler(handler);
  } catch {
    // unavailable in Expo Go
  }
};

export const scheduleNotificationAsync = async (_config: unknown): Promise<string | null> => {
  try {
    return await Notifications.scheduleNotificationAsync(
      _config as Notifications.NotificationRequestInput,
    );
  } catch {
    return null;
  }
};

export const cancelAllScheduledNotificationsAsync = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // unavailable in Expo Go
  }
};

export const SchedulableTriggerInputTypes = Notifications.SchedulableTriggerInputTypes;
