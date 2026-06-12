/**
 * Centralized entitlement logic for plan access gating.
 *
 * A user has an active paid entitlement when:
 *   - Stripe subscription status is 'active' or 'trialing', OR
 *   - A manual courtesy grant hasn't expired yet, OR
 *   - A one-time annual purchase is within its 12-month access window.
 *
 * All access gates in the app should call `hasPlanAccess()` instead of
 * checking `profile.plan` directly.
 */

/**
 * Minimal profile shape needed by entitlement helpers.
 * Kept local to avoid circular imports with AuthContext.
 */
export interface EntitlementProfile {
  plan?: string | null;
  stripe_subscription_status?: string | null;
  courtesy_until?: string | null;
  annual_plan?: string | null;
  annual_plan_expires_at?: string | null;
}

export type EntitlementStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "courtesy"
  | "annual"
  | "free";

/**
 * Returns the effective entitlement status for a profile.
 *   - "active"   → paid Stripe subscription, currently active
 *   - "trialing" → Stripe trial period
 *   - "past_due" → payment failed; access should be restricted
 *   - "annual"   → one-time annual purchase within 12-month window
 *   - "courtesy" → admin-granted access within the courtesy window
 *   - "free"     → no active paid access
 */
export function getEntitlementStatus(profile: EntitlementProfile | null): EntitlementStatus {
  if (!profile) return "free";

  const stripeStatus      = profile.stripe_subscription_status;
  const courtesyUntil     = profile.courtesy_until;
  const annualPlanExpires = profile.annual_plan_expires_at;

  if (courtesyUntil && new Date(courtesyUntil) > new Date()) return "courtesy";

  if (stripeStatus === "active")   return "active";
  if (stripeStatus === "trialing") return "trialing";
  if (stripeStatus === "past_due") return "past_due";

  if (annualPlanExpires && new Date(annualPlanExpires) > new Date()) return "annual";

  return "free";
}

/**
 * Returns true if the user has full paid access (active, trialing, annual, or courtesy).
 * Returns false for past_due and free.
 */
export function hasPlanAccess(profile: EntitlementProfile | null): boolean {
  const status = getEntitlementStatus(profile);
  return status === "active" || status === "trialing" || status === "courtesy" || status === "annual";
}

/**
 * Returns the effective plan ID for the user, preferring annual_plan when
 * the annual entitlement is active.
 */
export function getEffectivePlan(profile: EntitlementProfile | null): string {
  if (!profile) return "gratuito";
  const status = getEntitlementStatus(profile);
  if (status === "annual" && profile.annual_plan) return profile.annual_plan;
  return profile.plan ?? "gratuito";
}

/**
 * Returns true if the user's plan matches or exceeds the required tier,
 * AND the user has an active entitlement.
 *
 * Tier order: gratuito(0) < profissional/basico(1) < empresa(2) < executivo(3)
 * Legacy IDs (empresas/exclusive/business/premium) are mapped for backward compatibility.
 */
const TIER_ORDER: Record<string, number> = {
  // Current plan IDs (canonical)
  gratuito:     0,
  profissional: 1,
  empresa:      2,
  executivo:    3,
  // Legacy plan IDs — kept for backward compatibility
  basico:       1,
  empresas:     2,
  exclusive:    2,
  business:     3,
  premium:      3,
};

export function hasMinimumPlan(profile: EntitlementProfile | null, requiredPlan: string): boolean {
  if (!hasPlanAccess(profile)) return false;
  const effectivePlan = getEffectivePlan(profile);
  const userTier     = TIER_ORDER[effectivePlan] ?? 0;
  const requiredTier = TIER_ORDER[requiredPlan] ?? 0;
  return userTier >= requiredTier;
}
