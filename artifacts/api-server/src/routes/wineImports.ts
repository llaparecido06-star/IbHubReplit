import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId } from "../lib/planCheck.js";

const router: IRouter = Router();

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CREDITS_BY_PLAN: Record<string, number> = {
  free:      0,
  premium:   3,
  business:  10,
  exclusive: 25,
};
const DEFAULT_CREDITS = 0;

function currentPeriodStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function getUserPlan(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();
  return (data?.plan as string | null)?.toLowerCase() ?? "free";
}

async function getOrCreateCredits(userId: string): Promise<{
  credits_remaining: number;
  credits_total: number;
  period_start: string;
}> {
  const period = currentPeriodStart();

  const { data: existing } = await supabaseAdmin
    .from("ai_search_credits")
    .select("credits_remaining, credits_total, period_start")
    .eq("user_id", userId)
    .single();

  if (!existing) {
    const plan  = await getUserPlan(userId);
    const total = CREDITS_BY_PLAN[plan] ?? DEFAULT_CREDITS;
    await supabaseAdmin.from("ai_search_credits").insert({
      user_id: userId,
      credits_remaining: total,
      credits_total: total,
      period_start: period,
    });
    return { credits_remaining: total, credits_total: total, period_start: period };
  }

  if (existing.period_start < period) {
    const plan  = await getUserPlan(userId);
    const total = CREDITS_BY_PLAN[plan] ?? DEFAULT_CREDITS;
    await supabaseAdmin
      .from("ai_search_credits")
      .update({ credits_remaining: total, credits_total: total, period_start: period, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { credits_remaining: total, credits_total: total, period_start: period };
  }

  return existing as { credits_remaining: number; credits_total: number; period_start: string };
}

router.get("/wine-imports/credits", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const credits = await getOrCreateCredits(userId);
  return res.json(credits);
});

router.get("/wine-imports/search", async (req: Request, res: Response) => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const credits = await getOrCreateCredits(userId);
  if (credits.credits_remaining <= 0) {
    return res.status(402).json({
      error: "Sem créditos",
      credits_remaining: 0,
      credits_total: credits.credits_total,
    });
  }

  const q = (req.query.q as string | undefined)?.trim();
  if (!q || q.length < 2) {
    return res.json({ data: [], credits_remaining: credits.credits_remaining, credits_total: credits.credits_total });
  }

  const pattern = `%${q}%`;
  const { data, error } = await supabaseAdmin
    .from("wine_imports")
    .select("id, marca_completa, marca_relatorio, pais_de_origem, distribuidor")
    .or(`marca_completa.ilike.${pattern},marca_relatorio.ilike.${pattern}`)
    .order("marca_completa")
    .limit(20);

  if (error) {
    console.error("wine-imports search error", error);
    return res.status(500).json({ error: "Erro ao buscar dados" });
  }

  const rows = data ?? [];

  if (rows.length > 0) {
    const newRemaining = credits.credits_remaining - 1;
    await supabaseAdmin
      .from("ai_search_credits")
      .update({ credits_remaining: newRemaining, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    return res.json({ data: rows, credits_remaining: newRemaining, credits_total: credits.credits_total });
  }

  return res.json({ data: [], credits_remaining: credits.credits_remaining, credits_total: credits.credits_total });
});

export default router;
