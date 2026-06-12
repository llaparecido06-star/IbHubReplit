import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { applyPlanChangeToCredits, addOneTimeCredits } from "../lib/creditUtils.js";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

/** Fetch all plans that have a stripe_price_id set from the admin plan builder, returns map planId→priceId */
async function fetchPlanPriceIds(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const { data } = await supabaseAdmin
    .from("plans")
    .select("id, stripe_price_id")
    .not("stripe_price_id", "is", null);
  for (const row of (data ?? []) as { id: string; stripe_price_id: string | null }[]) {
    if (row.stripe_price_id) m.set(row.id, row.stripe_price_id);
  }
  return m;
}

/**
 * Reverse map from Stripe price ID → internal plan name.
 * Used by webhooks to identify which plan a payment was for.
 */
async function buildPriceToplanMap(): Promise<Map<string, string>> {
  const planPrices = await fetchPlanPriceIds();
  const m = new Map<string, string>();
  for (const [planId, priceId] of planPrices) {
    m.set(priceId, planId);
  }
  return m;
}

/**
 * Safely extract current_period_end from a Stripe subscription.
 * In API versions >= 2024-09-30, the field moved from the subscription root
 * to each subscription item. We try both locations and return null if neither
 * is a valid unix timestamp, avoiding RangeError in Date.toISOString().
 */
function getPeriodEnd(sub: Stripe.Subscription): string | null {
  // New location (per-item) — preferred in API 2024-09-30+
  const fromItem = (sub.items?.data?.[0] as any)?.current_period_end;
  // Legacy root field — still present in some API versions
  const fromRoot = (sub as any).current_period_end;
  const ts = typeof fromItem === "number" ? fromItem : typeof fromRoot === "number" ? fromRoot : null;
  if (!ts || !isFinite(ts)) return null;
  return new Date(ts * 1000).toISOString();
}

/**
 * Determine the plan from a Stripe subscription's price items.
 *
 * Priority:
 *   1. Subscription item price IDs (always current after portal upgrade/downgrade)
 *   2. metadata.plan (fallback only if no price match found — catches custom/one-off prices)
 *
 * Returns null if neither resolves to a known plan.
 */
function resolvePlanFromSubscription(
  sub: Stripe.Subscription,
  priceToplan: Map<string, string>,
): string | null {
  // Primary: inspect subscription items — always reflects latest plan after portal changes
  for (const item of sub.items.data) {
    const plan = priceToplan.get(item.price.id);
    if (plan) return plan;
  }
  // Fallback: metadata (set at checkout; may be stale after portal plan change)
  return sub.metadata?.plan ?? null;
}

// ─── Allowed return URL hosts (security: prevent open-redirect) ───────────────
const ALLOWED_HOSTS: string[] = (() => {
  const webBase = process.env.WEB_BASE_URL ?? "";
  const hosts: string[] = [];
  try {
    if (webBase) hosts.push(new URL(webBase).hostname);
  } catch { /* ignore */ }
  return hosts;
})();

function isAllowedReturnUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

/** Resolve authenticated user ID from Bearer token */
async function getUserId(req: Request, res: Response): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return null;
  }
  const { data, error } = await supabaseAnon.auth.getUser(auth.slice(7));
  if (error || !data?.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  return data.user.id;
}

/** Profile row shape returned from Supabase select */
interface ProfileRow {
  stripe_customer_id: string | null;
  full_name: string | null;
}

/**
 * Resolve user ID from metadata (primary) or by looking up stripe_customer_id (fallback).
 * This handles manually-created subscriptions that lack the supabase_user_id metadata.
 */
async function resolveUserId(
  userIdFromMeta: string | undefined,
  customerId: string | undefined,
): Promise<string | null> {
  if (userIdFromMeta) return userIdFromMeta;
  if (!customerId) return null;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}

/** Get or create a Stripe customer for a user */
async function getOrCreateCustomer(stripe: Stripe, userId: string, email: string | null): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  const profile = data as ProfileRow | null;

  if (profile?.stripe_customer_id) {
    // Verify the customer exists in the current Stripe mode (test vs live).
    // A customer created in test mode will fail with "No such customer" when
    // the live-mode key is used (and vice-versa). In that case, clear the
    // stale ID and fall through to create a fresh one in the correct mode.
    try {
      const existing = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (!(existing as Stripe.DeletedCustomer).deleted) {
        return profile.stripe_customer_id;
      }
      // Customer was deleted in Stripe — clear it and create a new one
    } catch (err: unknown) {
      if (!(err instanceof Stripe.errors.StripeError) || err.code !== "resource_missing") throw err;
      // resource_missing = customer belongs to the other mode — fall through
    }
    // Clear the stale or deleted customer ID before creating a new one
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: null })
      .eq("id", userId);
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: profile?.full_name ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

// ─── POST /stripe/create-checkout-session ─────────────────────────────────────
router.post("/stripe/create-checkout-session", async (req: Request, res: Response) => {
  const userId = await getUserId(req, res);
  if (!userId) return;

  const { plan, successUrl, cancelUrl } = req.body as {
    plan?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!plan) {
    res.status(400).json({ error: "Plano não informado." });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Pagamentos ainda não configurados. Contate o suporte." });
    return;
  }

  const planPrices = await fetchPlanPriceIds();
  const priceId = planPrices.get(plan);
  if (!priceId || !priceId.startsWith("price_")) {
    res.status(503).json({
      error: `Configuração incompleta: nenhum Stripe Price ID configurado para o plano "${plan}". ` +
             `Abra o Plan Builder, edite o plano e cole o Price ID (começa com "price_") no campo Stripe Price ID.`
    });
    return;
  }

  // Detect test/live mode mismatch
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const isTestKey = secretKey.startsWith("sk_test_");
  const isTestPrice = priceId.includes("_test_");
  if (isTestKey && !isTestPrice) {
    res.status(503).json({
      error: `Conflito de ambiente: STRIPE_SECRET_KEY está em modo teste (sk_test_) mas o price ID "${priceId}" não é de teste. Configure ambos no mesmo ambiente.`
    });
    return;
  }
  if (!isTestKey && isTestPrice) {
    res.status(503).json({
      error: `Conflito de ambiente: STRIPE_SECRET_KEY está em modo live mas o price ID "${priceId}" é de teste. Configure ambos no mesmo ambiente.`
    });
    return;
  }

  const webBase = process.env.WEB_BASE_URL ?? "";
  const defaultSuccess = `${webBase}/assinar/sucesso?plano=${plan}`;
  const defaultCancel  = `${webBase}/assinar/cancelado?plano=${plan}`;

  // Security: only allow return URLs pointing to our own domain
  const resolvedSuccess = (successUrl && isAllowedReturnUrl(successUrl)) ? successUrl : defaultSuccess;
  const resolvedCancel  = (cancelUrl  && isAllowedReturnUrl(cancelUrl))  ? cancelUrl  : defaultCancel;

  try {
    const stripe = getStripe();

    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authData?.user?.email ?? null;

    const customerId = await getOrCreateCustomer(stripe, userId, email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: resolvedSuccess,
      cancel_url:  resolvedCancel,
      metadata: { supabase_user_id: userId, plan },
      subscription_data: {
        metadata: { supabase_user_id: userId, plan },
      },
      allow_promotion_codes: true,
      locale: "pt-BR",
      // Omit payment_method_types to let Stripe show all enabled methods
      // including card, Pix, and boleto (configured per-product in Stripe Dashboard)
    });

    res.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao criar sessão de checkout";
    res.status(500).json({ error: message });
  }
});

// ─── POST /stripe/create-portal-session ──────────────────────────────────────
router.post("/stripe/create-portal-session", async (req: Request, res: Response) => {
  const userId = await getUserId(req, res);
  if (!userId) return;

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Pagamentos ainda não configurados. Contate o suporte." });
    return;
  }

  const webBase = process.env.WEB_BASE_URL ?? "";

  try {
    const stripe = getStripe();

    const { data } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
    if (!customerId) {
      res.status(400).json({ error: "Nenhuma assinatura encontrada para este usuário." });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${webBase}/minha-conta`,
    });

    res.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao abrir portal de assinatura";
    res.status(500).json({ error: message });
  }
});

// ─── GET /stripe/credit-packages ─────────────────────────────────────────────
router.get("/stripe/credit-packages", async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from("credit_packages")
    .select("id, label, ai_credits, revelation_credits, price_brl, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data ?? []);
});

// ─── POST /stripe/create-credit-checkout-session ──────────────────────────────
router.post("/stripe/create-credit-checkout-session", async (req: Request, res: Response) => {
  const userId = await getUserId(req, res);
  if (!userId) return;

  const { packageId, successUrl, cancelUrl } = req.body as {
    packageId?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!packageId) {
    res.status(400).json({ error: "packageId é obrigatório." });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Pagamentos ainda não configurados. Contate o suporte." });
    return;
  }

  const { data: pkg, error: pkgErr } = await supabaseAdmin
    .from("credit_packages")
    .select("id, label, ai_credits, revelation_credits, price_brl")
    .eq("id", packageId)
    .eq("active", true)
    .maybeSingle() as {
      data: { id: string; label: string; ai_credits: number; revelation_credits: number; price_brl: number } | null;
      error: unknown;
    };

  if (pkgErr || !pkg) {
    res.status(404).json({ error: "Pacote de créditos não encontrado ou inativo." });
    return;
  }

  const webBase = process.env.WEB_BASE_URL ?? "";
  const resolvedSuccess = (successUrl && isAllowedReturnUrl(successUrl))
    ? successUrl
    : `${webBase}/mercado?creditos=comprado`;
  const resolvedCancel  = (cancelUrl  && isAllowedReturnUrl(cancelUrl))
    ? cancelUrl
    : `${webBase}/mercado`;

  try {
    const stripe = getStripe();
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authData?.user?.email ?? null;
    const customerId = await getOrCreateCustomer(stripe, userId, email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: pkg.price_brl,
            product_data: {
              name: pkg.label,
              description: [
                pkg.ai_credits > 0 ? `${pkg.ai_credits} créditos de Busca IA` : null,
                pkg.revelation_credits > 0 ? `${pkg.revelation_credits} créditos de Revelação` : null,
              ].filter(Boolean).join(" + ") || pkg.label,
            },
          },
        },
      ],
      success_url: resolvedSuccess,
      cancel_url:  resolvedCancel,
      metadata: {
        supabase_user_id:    userId,
        credit_package_id:   pkg.id,
        ai_credits:          String(pkg.ai_credits),
        revelation_credits:  String(pkg.revelation_credits),
      },
      locale: "pt-BR",
    });

    res.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao criar sessão de checkout";
    res.status(500).json({ error: message });
  }
});

// ─── POST /stripe/webhook ─────────────────────────────────────────────────────
router.post("/stripe/webhook", async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "Stripe not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const sess   = event.data.object as Stripe.Checkout.Session;
        const custId = typeof sess.customer === "string" ? sess.customer : undefined;
        const userId = await resolveUserId(sess.metadata?.supabase_user_id, custId);
        if (!userId) break;

        // ── One-time credit purchase ──────────────────────────────────────────
        if (sess.metadata?.credit_package_id) {
          const aiCredits         = parseInt(sess.metadata.ai_credits         ?? "0", 10);
          const revelationCredits = parseInt(sess.metadata.revelation_credits ?? "0", 10);
          void addOneTimeCredits(userId, aiCredits, revelationCredits);
          break;
        }

        // ── Subscription checkout ─────────────────────────────────────────────
        if (sess.subscription) {
          const stripe      = getStripe();
          const priceToplan = await buildPriceToplanMap();
          // Expand items so we can resolve plan from price IDs (portal upgrades have no metadata)
          const sub  = await stripe.subscriptions.retrieve(sess.subscription as string, {
            expand: ["items.data.price"],
          });
          const plan = resolvePlanFromSubscription(sub, priceToplan);
          const periodEnd = getPeriodEnd(sub);
          const update: Record<string, unknown> = {
            stripe_subscription_id:     sub.id,
            stripe_subscription_status: sub.status,
            ...(periodEnd ? { stripe_current_period_end: periodEnd } : {}),
          };
          if (plan) update.plan = plan;
          await supabaseAdmin.from("profiles").update(update).eq("id", userId);
          // Adjust AI credits immediately so the user doesn't wait for next month's reset
          if (plan) void applyPlanChangeToCredits(userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub         = event.data.object as Stripe.Subscription;
        const custId      = typeof sub.customer === "string" ? sub.customer : undefined;
        const userId      = await resolveUserId(sub.metadata?.supabase_user_id, custId);
        const priceToplan = await buildPriceToplanMap();
        const plan        = resolvePlanFromSubscription(sub, priceToplan);
        if (userId) {
          const periodEnd = getPeriodEnd(sub);
          const update: Record<string, unknown> = {
            stripe_subscription_id:     sub.id,
            stripe_subscription_status: sub.status,
            ...(periodEnd ? { stripe_current_period_end: periodEnd } : {}),
          };
          if (plan) update.plan = plan;
          await supabaseAdmin.from("profiles").update(update).eq("id", userId);
          // Adjust AI credits immediately on upgrade or downgrade
          if (plan) void applyPlanChangeToCredits(userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub    = event.data.object as Stripe.Subscription;
        const custId = typeof sub.customer === "string" ? sub.customer : undefined;
        const userId = await resolveUserId(sub.metadata?.supabase_user_id, custId);
        if (userId) {
          const periodEnd = getPeriodEnd(sub);
          await supabaseAdmin.from("profiles").update({
            plan:                       "gratuito",
            stripe_subscription_status: "canceled",
            ...(periodEnd ? { stripe_current_period_end: periodEnd } : {}),
          }).eq("id", userId);
          // Revert credits to the free plan allocation
          void applyPlanChangeToCredits(userId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv      = event.data.object as Stripe.Invoice;
        const custId   = typeof inv.customer === "string" ? inv.customer : undefined;
        const userId   = await resolveUserId(undefined, custId);
        if (userId) {
          await supabaseAdmin.from("profiles")
            .update({ stripe_subscription_status: "past_due" })
            .eq("id", userId);
        } else if (custId) {
          // Fallback: update by customer ID directly (profile may not have id indexed yet)
          await supabaseAdmin.from("profiles")
            .update({ stripe_subscription_status: "past_due" })
            .eq("stripe_customer_id", custId);
        }
        break;
      }
    }
  } catch (err: unknown) {
    console.error("Stripe webhook handler error:", err);
    res.status(500).json({ error: "Webhook handler error" });
    return;
  }

  res.json({ received: true });
});

// ─── GET /stripe/config-check (dev diagnostic) ───────────────────────────────
router.get("/stripe/config-check", async (_req: Request, res: Response) => {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  const mode = secretKey.startsWith("sk_test_") ? "test" : secretKey.startsWith("sk_live_") ? "live" : "unknown";

  const planPrices = await fetchPlanPriceIds();
  const result: Record<string, { configured: boolean; valid_format: boolean; source: string; prefix: string }> = {};

  for (const [planId, priceId] of planPrices) {
    result[planId] = {
      configured: true,
      valid_format: priceId.startsWith("price_"),
      source: "plan_builder",
      prefix: priceId.slice(0, 14) + "…",
    };
  }

  // List all env var NAMES (not values) that contain "STRIPE" — helps debug production
  const stripeEnvKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes("STRIPE"));

  res.json({
    stripe_key_configured: secretKey.length > 0,
    stripe_key_mode: mode,
    stripe_env_keys_present: stripeEnvKeys,
    prices: result,
  });
});

export default router;
