/**
 * Web mirror of artifacts/ibhub/utils/notificationPrefs.ts.
 * Stores per-user notification toggles in localStorage.
 *
 * Storage is keyed per-user so prefs do not bleed across accounts on
 * shared browsers. Pass the current user id to load/save; legacy
 * unscoped data (from earlier versions) is migrated on first load.
 */

export type PrefKey =
  | "followers"
  | "messages"
  | "jobs"
  | "likes"
  | "comments"
  | "mentions";

export const DEFAULT_PREFS: Record<PrefKey, boolean> = {
  followers: true,
  messages:  true,
  jobs:      true,
  likes:     true,
  comments:  true,
  mentions:  true,
};

const LEGACY_KEY = "ibhub.notif_prefs.v1";
const KEY_PREFIX = "ibhub.notif_prefs.v2:";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function keyFor(userId: string | null | undefined): string {
  return KEY_PREFIX + (userId && userId.length > 0 ? userId : "anonymous");
}

export function loadPrefs(userId?: string | null): Record<PrefKey, boolean> {
  const store = safeStorage();
  if (!store) return { ...DEFAULT_PREFS };
  try {
    let raw = store.getItem(keyFor(userId));
    if (!raw && userId) {
      // One-time migration of legacy global key into the user-scoped slot
      const legacy = store.getItem(LEGACY_KEY);
      if (legacy) {
        try { store.setItem(keyFor(userId), legacy); } catch { /* ignore */ }
        try { store.removeItem(LEGACY_KEY); } catch { /* ignore */ }
        raw = legacy;
      }
    }
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<Record<PrefKey, boolean>>;
    const merged: Record<PrefKey, boolean> = { ...DEFAULT_PREFS };
    (Object.keys(DEFAULT_PREFS) as PrefKey[]).forEach((k) => {
      if (typeof parsed?.[k] === "boolean") merged[k] = parsed[k] as boolean;
    });
    return merged;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Record<PrefKey, boolean>, userId?: string | null): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(keyFor(userId), JSON.stringify(prefs));
  } catch {
    /* quota exceeded or unavailable — non-fatal */
  }
}
