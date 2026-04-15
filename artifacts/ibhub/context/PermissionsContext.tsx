import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
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
  const { profile } = useAuth();
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      if (!profile) {
        if (!cancelled) { setFeatures([]); setIsLoading(false); }
        return;
      }
      const entitle = getEntitlementStatus(profile);
      if (entitle === "courtesy") {
        if (!cancelled) { setFeatures(["__all__"]); setIsLoading(false); }
        return;
      }
      if (entitle === "past_due" || entitle === "free") {
        if (!cancelled) { setFeatures([]); setIsLoading(false); }
        return;
      }
      try {
        const planId = profile.plan ?? "gratuito";
        const feats = await fetchPlanFeatures(planId);
        if (!cancelled) { setFeatures(feats); setIsLoading(false); }
      } catch {
        if (!cancelled) { setFeatures([]); setIsLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile?.plan, profile?.stripe_subscription_status, profile?.courtesy_until]);

  const hasFeature = useCallback(
    (key: string): boolean => {
      if (isLoading) return true;
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
