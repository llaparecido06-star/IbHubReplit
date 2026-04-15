// expo-notifications was removed from Expo Go in SDK 53.
// All functions below are no-op stubs that keep the app running in Expo Go.
// In a production development build, replace this file with the real module.

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

export const getPermissionsAsync = (): Promise<PermissionResult> =>
  Promise.resolve({ status: "unavailable" });

export const requestPermissionsAsync = (): Promise<PermissionResult> =>
  Promise.resolve({ status: "denied" });

export const getExpoPushTokenAsync = (_options?: { projectId?: string }): Promise<{ data: string | null }> =>
  Promise.resolve({ data: null });

export const scheduleNotificationAsync = (_config: unknown): Promise<string | null> =>
  Promise.resolve(null);

export const cancelAllScheduledNotificationsAsync = (): Promise<void> =>
  Promise.resolve();

export const setNotificationHandler = (_handler: unknown): void => {
  // no-op in Expo Go
};

export const addNotificationResponseReceivedListener = (
  _handler: (response: NotificationResponse) => void,
): Subscription => {
  return { remove: () => {} };
};

export const addNotificationReceivedListener = (
  _handler: (notification: unknown) => void,
): Subscription => {
  return { remove: () => {} };
};

export const getLastNotificationResponseAsync = (): Promise<NotificationResponse | null> =>
  Promise.resolve(null);

export const SchedulableTriggerInputTypes: Record<string, string> = {
  DATE: "date",
};
