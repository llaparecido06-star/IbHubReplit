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

const REVEAL_CREDITS_FALLBACK: Record<string, number> = {
  gratuito: 0, free: 0, basico: 0, profissional: 0,
  premium: 3, empresa: 5, empresas: 5, business: 5,
  executivo: 15, exclusive: 15,
};

/**
 * Returns how many reveal credits the user's current plan grants per month.
 * Mirrors the logic in wineImports.ts getRevealPlanCredits to stay in sync.
 */
async function getRevealPlanCreditCount(userId: string): Promise<number> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, reveal_credits_override")
    .eq("id", userId)
    .maybeSingle() as { data: { plan?: string | null; reveal_credits_override?: number | null } | null };
  const override = profile?.reveal_credits_override;
  if (override != null) return override;
  const planId = (profile?.plan ?? "free").toLowerCase();
  const { data: planRow } = await supabaseAdmin
    .from("plans")
    .select("reveal_credits")
    .eq("id", planId)
    .maybeSingle() as { data: { reveal_credits?: number | null } | null };
  if (typeof planRow?.reveal_credits === "number") return planRow.reveal_credits;
  return REVEAL_CREDITS_FALLBACK[planId] ?? 0;
}

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
  const [newTotal, billingDay] = await Promise.all([
    getPlanCreditsForUser(userId),
    getBillingDayForUser(userId),
  ]);

  const { data: existing } = await supabaseAdmin
    .from("ai_search_credits")
    .select("credits_remaining, credits_total")
    .eq("user_id", userId)
    .maybeSingle() as {
      data: { credits_remaining: number; credits_total: number } | null;
    };

  const periodStart = currentPeriodStart(billingDay);

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

/**
 * Adds one-time (avulso) credits to both AI search and reveal credit balances.
 * These credits do NOT affect credits_total or period_start —
 * they are additive on top of the user's current monthly quota.
 *
 * Call after a confirmed one-time Stripe payment (mode: "payment").
 */
export async function addOneTimeCredits(
  userId: string,
  aiCredits: number,
  revelationCredits: number,
): Promise<void> {
  const now = new Date().toISOString();
  const billingDay = await getBillingDayForUser(userId);

  if (aiCredits > 0) {
    const { data: existing } = await supabaseAdmin
      .from("ai_search_credits")
      .select("credits_remaining, credits_total")
      .eq("user_id", userId)
      .maybeSingle() as { data: { credits_remaining: number; credits_total: number } | null };

    if (!existing) {
      const planTotal = await getPlanCreditsForUser(userId);
      await supabaseAdmin.from("ai_search_credits").insert({
        user_id:           userId,
        credits_remaining: planTotal + aiCredits,
        credits_total:     planTotal,
        period_start:      currentPeriodStart(billingDay),
      });
    } else {
      await supabaseAdmin
        .from("ai_search_credits")
        .update({ credits_remaining: existing.credits_remaining + aiCredits, updated_at: now })
        .eq("user_id", userId);
    }
  }

  if (revelationCredits > 0) {
    const period = currentPeriodStart(billingDay);
    const { data: existing } = await supabaseAdmin
      .from("bi_reveal_credits")
      .select("credits_remaining, credits_total, period_start")
      .eq("user_id", userId)
      .maybeSingle() as {
        data: { credits_remaining: number; credits_total: number; period_start: string } | null;
      };

    if (!existing) {
      // Use the user's plan-based quota as the base total so monthly entitlement is preserved
      const planTotal = await getRevealPlanCreditCount(userId);
      await supabaseAdmin.from("bi_reveal_credits").insert({
        user_id:           userId,
        credits_remaining: planTotal + revelationCredits,
        credits_total:     planTotal,
        period_start:      period,
      });
    } else {
      await supabaseAdmin
        .from("bi_reveal_credits")
        .update({ credits_remaining: existing.credits_remaining + revelationCredits, updated_at: now })
        .eq("user_id", userId);
    }
  }

  logger.info({ userId, aiCredits, revelationCredits }, "creditUtils: one-time credits added");
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute the ISO date (YYYY-MM-DD) for the start of the current billing period,
 * anchored to the user's subscription renewal day.
 * billingDay = null/undefined → 1st of month (free users).
 */
function currentPeriodStart(billingDay?: number | null): string {
  const now      = new Date();
  const todayDay = now.getUTCDate();
  const anchor   = billingDay && billingDay >= 1 && billingDay <= 31 ? billingDay : 1;
  const year     = now.getUTCFullYear();
  const month    = now.getUTCMonth();

  if (todayDay >= anchor) {
    const daysInMonth  = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const effectiveDay = Math.min(anchor, daysInMonth);
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(effectiveDay).padStart(2, "0")}`;
  } else {
    const prevMonth    = month === 0 ? 11 : month - 1;
    const prevYear     = month === 0 ? year - 1 : year;
    const daysInPrev   = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
    const effectiveDay = Math.min(anchor, daysInPrev);
    return `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(effectiveDay).padStart(2, "0")}`;
  }
}

/** Fetch the billing anchor day for a user from their profile. Returns null for free users. */
async function getBillingDayForUser(userId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("billing_day")
    .eq("id", userId)
    .maybeSingle() as { data: { billing_day: number | null } | null };
  return data?.billing_day ?? null;
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
