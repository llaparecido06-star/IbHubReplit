import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth, supabase } from "@/context/AuthContext";
import { fetchPlanFeatures } from "@/services/api";
import { getEntitlementStatus } from "@/utils/entitlement";

interface PermissionsContextValue {
  features: string[];
  hasFeature: (key: string) => boolean;
  planTier: string;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  features: [],
  hasFeature: () => true,
  planTier: "gratuito",
  isLoading: true,
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { profile, refreshProfile } = useAuth();
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadFeatures = useCallback(async (prof: typeof profile) => {
    setIsLoading(true);
    if (!prof) {
      setFeatures([]);
      setIsLoading(false);
      return;
    }
    const entitle = getEntitlementStatus(prof);
    if (entitle === "courtesy") {
      setFeatures(["__all__"]);
      setIsLoading(false);
      return;
    }
    if (entitle === "past_due" || entitle === "free") {
      setFeatures([]);
      setIsLoading(false);
      return;
    }
    try {
      const planId = prof.plan ?? "gratuito";
      const feats = await fetchPlanFeatures(planId);
      setFeatures(feats);
    } catch {
      setFeatures([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadFeatures(profile);
  }, [profile?.plan, profile?.stripe_subscription_status, profile?.courtesy_until]);

  useEffect(() => {
    if (!profile?.id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const planId = profile.plan ?? "gratuito";

    const channel = supabase
      .channel(`permissions:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new as {
            plan?: string;
            stripe_subscription_status?: string;
            courtesy_until?: string | null;
          };
          const merged = { ...profile, ...updated };
          loadFeatures(merged as typeof profile);
          refreshProfile().catch(() => {});
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "plans",
          filter: `id=eq.${planId}`,
        },
        () => {
          loadFeatures(profile);
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
  }, [profile?.id, profile?.plan]);

  useEffect(() => {
    if (!profile?.id) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        refreshProfile().catch(() => {});
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [profile?.id, refreshProfile]);

  const hasFeature = useCallback(
    (key: string): boolean => {
      if (isLoading) return false;
      if (features.includes("__all__")) return true;
      return features.includes(key);
    },
    [features, isLoading],
  );

  const planTier = profile?.plan ?? "gratuito";

  return (
    <PermissionsContext.Provider value={{ features, hasFeature, planTier, isLoading }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
