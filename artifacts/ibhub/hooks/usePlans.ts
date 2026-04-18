import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/context/AuthContext";

export interface DbPlan {
  id: string;
  name: string;
  subtitle: string;
  price_cents: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  stripe_price_id: string | null;
  delivery_strategy?: string | null;
}

export function formatPlanPrice(plan: DbPlan): { main: string; period?: string } {
  if (plan.price_cents === 0) return { main: "Grátis" };
  const val = plan.price_cents / 100;
  return { main: `R$ ${val.toFixed(2).replace(".", ",")}`, period: "/mês" };
}

export function usePlans() {
  const [plans, setPlans]   = useState<DbPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (err) throw err;
      setPlans((data ?? []) as DbPlan[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const paidPlans = plans.filter(p => p.price_cents > 0);
  const freePlan  = plans.find(p => p.price_cents === 0) ?? null;

  function getPlanLabel(planId: string): string {
    return plans.find(p => p.id === planId)?.name ?? planId;
  }

  return { plans, paidPlans, freePlan, loading, error, refetch, getPlanLabel };
}
