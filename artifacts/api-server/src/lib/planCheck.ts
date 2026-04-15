import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Resolves the authenticated user ID from the Authorization header.
 * Returns the user ID or null (and sends a 401 response) on failure.
 */
export async function resolveUserId(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return null;
  }
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  return data.user.id;
}

interface CallerProfile {
  plan: string | null;
  is_admin: boolean;
  courtesy_until: string | null;
  stripe_subscription_status: string | null;
}

/**
 * Loads the caller's profile fields needed for plan-feature checks.
 */
async function loadCallerProfile(userId: string): Promise<CallerProfile | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan, is_admin, courtesy_until, stripe_subscription_status")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const p = data as { plan?: string | null; is_admin?: boolean; courtesy_until?: string | null; stripe_subscription_status?: string | null };
  return {
    plan: p.plan ?? "gratuito",
    is_admin: !!p.is_admin,
    courtesy_until: p.courtesy_until ?? null,
    stripe_subscription_status: p.stripe_subscription_status ?? null,
  };
}

/**
 * Returns true if the caller has an active courtesy period.
 */
function isCourtesyActive(prof: CallerProfile): boolean {
  return !!prof.courtesy_until && new Date(prof.courtesy_until) > new Date();
}

/**
 * Server-side admin gate. Only users with is_admin = true may proceed.
 * Returns `true` if access is granted.
 * Returns `false` and sends a 403 response if access is denied.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  userId: string,
): Promise<boolean> {
  const prof = await loadCallerProfile(userId);
  if (!prof) {
    res.status(404).json({ error: "Profile not found" });
    return false;
  }
  if (!prof.is_admin) {
    res.status(403).json({ error: "Apenas administradores do IbHub podem publicar no feed Ideal.BI." });
    return false;
  }
  return true;
}

/**
 * Server-side plan feature gate. Call this before serving gated resources.
 *
 * - Admins always pass.
 * - Courtesy users always pass.
 * - past_due subscriptions are denied regardless of plan.
 * - Everyone else must have the given featureKey in their plan's features array.
 *
 * Returns `true` if access is granted.
 * Returns `false` and sends the appropriate 403 response if access is denied.
 */
export async function requirePlanFeature(
  req: Request,
  res: Response,
  userId: string,
  featureKey: string,
): Promise<boolean> {
  const prof = await loadCallerProfile(userId);
  if (!prof) {
    res.status(404).json({ error: "Profile not found" });
    return false;
  }

  if (prof.is_admin) return true;
  if (isCourtesyActive(prof)) return true;

  if (prof.stripe_subscription_status === "past_due") {
    res.status(403).json({ error: "Assinatura com pagamento pendente. Regularize para acessar." });
    return false;
  }

  const { data: planRow } = await supabaseAdmin
    .from("plans")
    .select("features")
    .eq("id", prof.plan ?? "gratuito")
    .maybeSingle();
  const planFeatures: string[] = (planRow as { features?: string[] } | null)?.features ?? [];

  if (!planFeatures.includes(featureKey)) {
    res.status(403).json({ error: `Plano atual não inclui acesso à funcionalidade: ${featureKey}.` });
    return false;
  }

  return true;
}
