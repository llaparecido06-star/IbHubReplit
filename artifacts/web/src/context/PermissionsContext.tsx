import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { fetchPlanFeatures } from "@/services/api";

function resolveEntitlement(profile: { stripe_subscription_status?: string | null; courtesy_until?: string | null; plan?: string | null } | null) {
  if (!profile) return "free";
  if (profile.stripe_subscription_status === "active")   return "active";
  if (profile.stripe_subscription_status === "trialing") return "trialing";
  if (profile.stripe_subscription_status === "past_due") return "past_due";
  if (profile.courtesy_until && new Date(profile.courtesy_until) > new Date()) return "courtesy";
  return "free";
}

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadFeatures = useCallback(async (prof: typeof profile) => {
    setIsLoading(true);
    if (!prof) {
      setFeatures([]);
      setIsLoading(false);
      return;
    }
    const entitle = resolveEntitlement(prof);
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
      const feats = await fetchPlanFeatures(prof.plan ?? "gratuito");
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
      .channel(`web-permissions:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new as { plan?: string; stripe_subscription_status?: string; courtesy_until?: string | null };
          const merged = { ...profile, ...updated };
          loadFeatures(merged as typeof profile);
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
