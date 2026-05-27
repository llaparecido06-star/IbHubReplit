import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth, supabase } from "@/context/AuthContext";

interface FeatureFlagsContextValue {
  flags: Record<string, boolean>;
  isEnabled: (key: string) => boolean;
  isLoading: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: {},
  isEnabled: () => true,
  isLoading: true,
});

const FLAG_KEYS = ["enquetes", "stories", "manutencao"];
const CACHE_KEY = "@ibhub/feature_flags_cache";

async function readCache(): Promise<Record<string, boolean> | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return null;
  }
}

async function writeCache(flags: Record<string, boolean>): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(flags));
  } catch {
    // best-effort
  }
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { profile, session } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const applyFlags = useCallback((map: Record<string, boolean>, persist: boolean) => {
    setFlags(map);
    if (persist) writeCache(map);
  }, []);

  const loadFlags = useCallback(async (fromCache: boolean) => {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, enabled")
      .in("key", FLAG_KEYS);
    if (error) {
      if (!fromCache) setIsLoading(false);
      return;
    }
    const map: Record<string, boolean> = {};
    for (const f of FLAG_KEYS) {
      const found = (data ?? []).find((d: { key: string; enabled: boolean }) => d.key === f);
      map[f] = found ? found.enabled : false;
    }
    applyFlags(map, true);
    setIsLoading(false);
  }, [applyFlags]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Try to seed from cache first — eliminates the spinner on warm starts
      const cached = await readCache();
      if (cancelled) return;

      if (cached) {
        // Cache hit: show flags immediately, refresh silently in background
        setFlags(cached);
        setIsLoading(false);
        loadFlags(true);
      } else {
        // No cache: show spinner until network resolves (first cold start)
        const timeoutId = setTimeout(() => {
          if (!cancelled) setIsLoading(false);
        }, 5_000);
        loadFlags(false).finally(() => clearTimeout(timeoutId));
      }
    })();

    return () => { cancelled = true; };
  }, [loadFlags]);

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel("feature-flags-global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feature_flags" },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as { key?: string; enabled?: boolean };
          if (row.key && FLAG_KEYS.includes(row.key)) {
            setFlags((prev) => {
              const next = { ...prev, [row.key!]: !!row.enabled };
              writeCache(next);
              return next;
            });
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const isEnabled = useCallback(
    (key: string): boolean => {
      if (isLoading) return false;
      return flags[key] ?? false;
    },
    [flags, isLoading],
  );

  return (
    <FeatureFlagsContext.Provider value={{ flags, isEnabled, isLoading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
