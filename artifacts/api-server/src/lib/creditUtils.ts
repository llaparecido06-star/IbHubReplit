/**
 * creditUtils.ts
 *
 * Shared helpers for managing AI search credits across plan changes.
 * Used by wineImports (monthly reset) and stripe webhook (immediate plan upgrade).
 */

import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "./pushUtils.js";
import { logger } from "./logger.js";

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CREDITS_FALLBACK: Record<string, number> = {
  gratuito:     0,
  free:         0,
  profissional: 3,
  basico:       3,
  premium:      3,
  empresa:      10,
  empresas:     10,
  business:     10,
  executivo:    25,
  exclusive:    25,
};

/** Returns how many AI search credits the user's current plan grants per month. */
export async function getPlanCreditsForUser(userId: string): Promise<number> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  const planId = (profile?.plan as string | null)?.toLowerCase() ?? "free";

  const { data: planRow } = await supabaseAdmin
    .from("plans")
    .select("ai_search_credits")
    .eq("id", planId)
    .maybeSingle();

  if (planRow && typeof planRow.ai_search_credits === "number") {
    return planRow.ai_search_credits;
  }

  return CREDITS_FALLBACK[planId] ?? 0;
}

/**
 * Adjusts the user's AI search credits immediately after a plan change.
 *
 * Logic:
 * - Upgrade (newTotal > oldTotal): adds the difference to credits_remaining.
 *   The user gets the extra credits right now, no need to wait for next month.
 * - Downgrade (newTotal < oldTotal): clamps credits_remaining to newTotal.
 *   credits_total is updated so the UI reflects the new quota.
 * - Same plan: no-op.
 *
 * Call AFTER the profile.plan column has already been updated.
 * Returns the final credit state written to the DB.
 */
export async function applyPlanChangeToCredits(userId: string): Promise<{
  credits_remaining: number;
  credits_total: number;
  changed: boolean;
}> {
  const newTotal = await getPlanCreditsForUser(userId);

  const { data: existing } = await supabaseAdmin
    .from("ai_search_credits")
    .select("credits_remaining, credits_total")
    .eq("user_id", userId)
    .maybeSingle() as {
      data: { credits_remaining: number; credits_total: number } | null;
    };

  const periodStart = currentPeriodStart();

  // No row yet — create it with the full new-plan credit amount
  if (!existing) {
    await supabaseAdmin.from("ai_search_credits").insert({
      user_id:           userId,
      credits_remaining: newTotal,
      credits_total:     newTotal,
      period_start:      periodStart,
    });
    logger.info({ userId, newTotal, op: "insert" }, "creditUtils: new credits row created on plan change");

    if (newTotal > 0) {
      void sendPlanChangePush(userId, newTotal, 0, newTotal);
    }
    return { credits_remaining: newTotal, credits_total: newTotal, changed: true };
  }

  const oldTotal    = existing.credits_total;
  const oldRemaining = existing.credits_remaining;

  if (newTotal === oldTotal) {
    // Same quota — nothing to do
    return { credits_remaining: oldRemaining, credits_total: oldTotal, changed: false };
  }

  let newRemaining: number;

  if (newTotal > oldTotal) {
    // Upgrade: add the delta immediately
    const delta = newTotal - oldTotal;
    newRemaining = Math.min(oldRemaining + delta, newTotal);
  } else {
    // Downgrade: clamp remaining to the new (lower) total
    newRemaining = Math.min(oldRemaining, newTotal);
  }

  await supabaseAdmin
    .from("ai_search_credits")
    .update({
      credits_remaining: newRemaining,
      credits_total:     newTotal,
      updated_at:        new Date().toISOString(),
    })
    .eq("user_id", userId);

  logger.info(
    { userId, oldTotal, newTotal, oldRemaining, newRemaining },
    "creditUtils: credits adjusted on plan change",
  );

  // Notify the user regardless of direction (upgrade or downgrade)
  if (newRemaining !== oldRemaining) {
    void sendPlanChangePush(userId, newRemaining, oldRemaining, newTotal);
  }

  return { credits_remaining: newRemaining, credits_total: newTotal, changed: true };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function currentPeriodStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function sendPlanChangePush(
  userId: string,
  newRemaining: number,
  previousRemaining: number,
  newTotal: number,
): Promise<void> {
  const diff = newRemaining - previousRemaining;
  let title: string;
  let body: string;

  if (diff > 0) {
    title = "✨ Créditos de IA atualizados!";
    body  = `Você ganhou +${diff} crédito${diff === 1 ? "" : "s"} de IA. Disponível agora: ${newRemaining}/${newTotal}.`;
  } else if (newRemaining === 0) {
    title = "Créditos de IA removidos";
    body  = "Seu plano atual não inclui busca por IA. Faça upgrade para ter acesso.";
  } else {
    const lost = Math.abs(diff);
    title = "Créditos de IA ajustados";
    body  = `${lost} crédito${lost === 1 ? "" : "s"} de IA removido${lost === 1 ? "" : "s"}. Você tem ${newRemaining}/${newTotal} disponíve${newRemaining === 1 ? "l" : "is"} este mês.`;
  }

  await sendPushToUser({
    userId,
    title,
    body,
    data: { type: "credits_updated", deepLink: "/(tabs)/mercado" },
  });
}
