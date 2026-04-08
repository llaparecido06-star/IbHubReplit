import AsyncStorage from "@react-native-async-storage/async-storage";

export const PREF_KEYS = {
  followers: "followers",
  messages: "messages",
  jobs: "jobs",
  likes: "likes",
  comments: "comments",
  mentions: "mentions",
} as const;

export type PrefKey = keyof typeof PREF_KEYS;

const STORAGE_KEY = "@ibhub:notif_prefs";

export const DEFAULT_PREFS: Record<PrefKey, boolean> = {
  followers: true,
  messages: true,
  jobs: true,
  likes: true,
  comments: true,
  mentions: true,
};

export async function loadPrefs(): Promise<Record<PrefKey, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<Record<PrefKey, boolean>>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function savePrefs(prefs: Record<PrefKey, boolean>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // silent fail — UI already updated optimistically
  }
}

export function notifTypeToKey(type: string): PrefKey | null {
  switch (type) {
    case "like":    return "likes";
    case "comment": return "comments";
    case "follow":  return "followers";
    case "mention": return "mentions";
    default:        return null;
  }
}
