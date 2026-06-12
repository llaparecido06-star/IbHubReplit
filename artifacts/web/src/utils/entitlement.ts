/**
 * Centralized entitlement logic for plan access gating on the web.
 *
 * A user has an active paid entitlement when:
 *   - Stripe subscription status is 'active' or 'trialing', OR
 *   - A manual courtesy grant hasn't expired yet, OR
 *   - A one-time annual purchase is within its 12-month access window.
 */

export type EntitlementStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "courtesy"
  | "annual"
  | "free";

interface ProfileLike {
  plan?: string | null;
  stripe_subscription_status?: string | null;
  stripe_current_period_end?: string | null;
  courtesy_until?: string | null;
  annual_plan?: string | null;
  annual_plan_expires_at?: string | null;
}

export function getEntitlementStatus(profile: ProfileLike | null): EntitlementStatus {
  if (!profile) return "free";

  const stripeStatus      = profile.stripe_subscription_status;
  const courtesyUntil     = profile.courtesy_until;
  const annualPlanExpires = profile.annual_plan_expires_at;

  if (stripeStatus === "active")   return "active";
  if (stripeStatus === "trialing") return "trialing";
  if (stripeStatus === "past_due") return "past_due";

  if (annualPlanExpires && new Date(annualPlanExpires) > new Date()) return "annual";

  if (courtesyUntil && new Date(courtesyUntil) > new Date()) return "courtesy";

  return "free";
}

export function hasPlanAccess(profile: ProfileLike | null): boolean {
  const status = getEntitlementStatus(profile);
  return status === "active" || status === "trialing" || status === "courtesy" || status === "annual";
}

const TIER_ORDER: Record<string, number> = {
  // Canonical plan IDs from the DB
  gratuito:      0,
  profissional:  1,
  empresa:       2,
  executivo:     3,
  // Legacy / alias names kept for backward compatibility
  basico:        1,
  empresas:      2,
  exclusive:     2,
  business:      3,
  premium:       3,
};

export function hasMinimumPlan(profile: ProfileLike | null, requiredPlan: string): boolean {
  if (!hasPlanAccess(profile)) return false;
  const effectivePlan = getEffectivePlan(profile);
  const userTier     = TIER_ORDER[effectivePlan] ?? 0;
  const requiredTier = TIER_ORDER[requiredPlan] ?? 0;
  return userTier >= requiredTier;
}

/**
 * Returns the effective plan ID for the user, preferring annual_plan when
 * the annual entitlement is active.
 */
export function getEffectivePlan(profile: ProfileLike | null): string {
  if (!profile) return "gratuito";
  const status = getEntitlementStatus(profile);
  if (status === "annual" && profile.annual_plan) return profile.annual_plan;
  return profile.plan ?? "gratuito";
}
