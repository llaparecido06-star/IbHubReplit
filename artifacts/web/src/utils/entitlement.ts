/**
 * Centralized entitlement logic for plan access gating on the web.
 *
 * A user has an active paid entitlement when:
 *   - Stripe subscription status is 'active' or 'trialing', OR
 *   - A manual courtesy grant hasn't expired yet.
 */

export type EntitlementStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "courtesy"
  | "free";

interface ProfileLike {
  plan?: string | null;
  stripe_subscription_status?: string | null;
  stripe_current_period_end?: string | null;
  courtesy_until?: string | null;
}

export function getEntitlementStatus(profile: ProfileLike | null): EntitlementStatus {
  if (!profile) return "free";

  const stripeStatus  = profile.stripe_subscription_status;
  const courtesyUntil = profile.courtesy_until;

  if (stripeStatus === "active")   return "active";
  if (stripeStatus === "trialing") return "trialing";
  if (stripeStatus === "past_due") return "past_due";

  if (courtesyUntil && new Date(courtesyUntil) > new Date()) return "courtesy";

  return "free";
}

export function hasPlanAccess(profile: ProfileLike | null): boolean {
  const status = getEntitlementStatus(profile);
  return status === "active" || status === "trialing" || status === "courtesy";
}

const TIER_ORDER: Record<string, number> = {
  gratuito:      0,
  profissional:  1,
  empresas:      2,
  premium:       3,
  // legacy aliases kept for backward compatibility
  basico:        0,
  exclusive:     2,
  business:      3,
};

export function hasMinimumPlan(profile: ProfileLike | null, requiredPlan: string): boolean {
  if (!hasPlanAccess(profile)) return false;
  const userTier     = TIER_ORDER[profile?.plan ?? "basico"] ?? 0;
  const requiredTier = TIER_ORDER[requiredPlan] ?? 0;
  return userTier >= requiredTier;
}
