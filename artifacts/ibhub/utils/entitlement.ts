/**
 * Centralized entitlement logic for plan access gating.
 *
 * A user has an active paid entitlement when:
 *   - Stripe subscription status is 'active' or 'trialing', OR
 *   - A manual courtesy grant hasn't expired yet.
 *
 * All access gates in the app should call `hasPlanAccess()` instead of
 * checking `profile.plan` directly.
 */

import type { Profile } from "@/context/AuthContext";

export type EntitlementStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "courtesy"
  | "free";

/**
 * Returns the effective entitlement status for a profile.
 *   - "active"   → paid Stripe subscription, currently active
 *   - "trialing" → Stripe trial period
 *   - "past_due" → payment failed; access should be restricted
 *   - "courtesy" → admin-granted access within the courtesy window
 *   - "free"     → no active paid access
 */
export function getEntitlementStatus(profile: Profile | null): EntitlementStatus {
  if (!profile) return "free";

  const stripeStatus = profile.stripe_subscription_status;
  const courtesyUntil = profile.courtesy_until;

  if (stripeStatus === "active")   return "active";
  if (stripeStatus === "trialing") return "trialing";
  if (stripeStatus === "past_due") return "past_due";

  if (courtesyUntil && new Date(courtesyUntil) > new Date()) return "courtesy";

  return "free";
}

/**
 * Returns true if the user has full paid access (active or courtesy).
 * Returns false for past_due and free.
 */
export function hasPlanAccess(profile: Profile | null): boolean {
  const status = getEntitlementStatus(profile);
  return status === "active" || status === "trialing" || status === "courtesy";
}

/**
 * Returns true if the user's plan matches or exceeds the required tier,
 * AND the user has an active entitlement.
 *
 * Tier order: basico < premium < exclusive < business
 */
const TIER_ORDER: Record<string, number> = {
  basico:    0,
  premium:   1,
  exclusive: 2,
  business:  3,
};

export function hasMinimumPlan(profile: Profile | null, requiredPlan: string): boolean {
  if (!hasPlanAccess(profile)) return false;
  const userTier     = TIER_ORDER[profile?.plan ?? "basico"] ?? 0;
  const requiredTier = TIER_ORDER[requiredPlan] ?? 0;
  return userTier >= requiredTier;
}
