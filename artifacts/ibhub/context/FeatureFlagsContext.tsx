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

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { profile, session } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadFlags = useCallback(async () => {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, enabled")
      .in("key", FLAG_KEYS);
    if (error) {
      setIsLoading(false);
      return;
    }
    const map: Record<string, boolean> = {};
    for (const f of FLAG_KEYS) {
      const found = (data ?? []).find((d: { key: string; enabled: boolean }) => d.key === f);
      map[f] = found ? found.enabled : false;
    }
    setFlags(map);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Safety-net: if the Supabase query hangs (slow network, review device),
    // unblock isLoading after 5s so navigation redirects are never permanently
    // blocked. loadFlags() sets isLoading=false on its own when it resolves.
    const timeoutId = setTimeout(() => setIsLoading(false), 5_000);
    loadFlags().finally(() => clearTimeout(timeoutId));
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
            setFlags((prev) => ({ ...prev, [row.key!]: !!row.enabled }));
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
