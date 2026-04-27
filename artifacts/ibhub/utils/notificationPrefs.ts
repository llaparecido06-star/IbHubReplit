import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/context/AuthContext";

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
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const { data } = await supabase
        .from("profiles")
        .select("notif_feed, notif_msgs, notif_oport")
        .or(`id.eq.${session.user.id},user_id.eq.${session.user.id}`)
        .single();
      if (data) {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const local = raw ? (JSON.parse(raw) as Partial<Record<PrefKey, boolean>>) : {};
        const merged: Record<PrefKey, boolean> = {
          followers:  local.followers  ?? true,
          messages:   data.notif_msgs  ?? true,
          jobs:       data.notif_oport ?? true,
          likes:      data.notif_feed  ?? true,
          comments:   local.comments   ?? (data.notif_feed ?? true),
          mentions:   local.mentions   ?? (data.notif_feed ?? true),
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
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
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const uid = session.user.id;
      const dbUpdate = {
        notif_msgs:  prefs.messages,
        notif_oport: prefs.jobs,
        notif_feed:  prefs.likes || prefs.comments || prefs.mentions,
      };
      await supabase
        .from("profiles")
        .update(dbUpdate)
        .or(`id.eq.${uid},user_id.eq.${uid}`);
    }
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
