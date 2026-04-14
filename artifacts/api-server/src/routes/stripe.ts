import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// ─── Stripe price IDs — set via env vars ──────────────────────────────────────
// Create these products/prices in your Stripe dashboard and paste the IDs here.
const PRICE_IDS: Record<string, string> = {
  premium:   process.env.STRIPE_PRICE_PREMIUM   ?? "",
  exclusive: process.env.STRIPE_PRICE_EXCLUSIVE ?? "",
  business:  process.env.STRIPE_PRICE_BUSINESS  ?? "",
};

// Map plan id → subscription_tier label stored in profiles
const PLAN_TIER: Record<string, string> = {
  premium:   "premium",
  exclusive: "exclusive",
  business:  "business",
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2024-06-20" });
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

/** Get or create a Stripe customer for a user */
async function getOrCreateCustomer(stripe: Stripe, userId: string, email: string | null): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id as string;

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: (profile as any)?.full_name ?? undefined,
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

  if (!plan || !PRICE_IDS[plan]) {
    res.status(400).json({ error: `Plano inválido. Use: ${Object.keys(PRICE_IDS).join(", ")}` });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Pagamentos ainda não configurados. Contate o suporte." });
    return;
  }

  try {
    const stripe = getStripe();

    // Get user email from auth
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email ?? null;

    const customerId = await getOrCreateCustomer(stripe, userId, email);

    const webBase = process.env.WEB_BASE_URL ?? "";
    const defaultSuccess = `${webBase}/assinar/sucesso?plano=${plan}`;
    const defaultCancel  = `${webBase}/assinar/cancelado?plano=${plan}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: successUrl ?? defaultSuccess,
      cancel_url:  cancelUrl  ?? defaultCancel,
      metadata: { supabase_user_id: userId, plan },
      subscription_data: {
        metadata: { supabase_user_id: userId, plan },
      },
      allow_promotion_codes: true,
      locale: "pt-BR",
      payment_method_types: ["card"],
    });

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Erro ao criar sessão de checkout" });
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

  try {
    const stripe = getStripe();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    const customerId = (profile as any)?.stripe_customer_id as string | null;
    if (!customerId) {
      res.status(400).json({ error: "Nenhuma assinatura encontrada para este usuário." });
      return;
    }

    const webBase = process.env.WEB_BASE_URL ?? "";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${webBase}/minha-conta`,
    });

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Erro ao abrir portal de assinatura" });
  }
});

// ─── POST /stripe/webhook ─────────────────────────────────────────────────────
// Stripe sends raw body; must be parsed before this handler runs.
// In Express, mount with express.raw({ type: "application/json" }) for this route.
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

  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (e: any) {
    res.status(400).json({ error: `Webhook signature verification failed: ${e.message}` });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan   = session.metadata?.plan;
        if (userId && plan && session.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await supabaseAdmin.from("profiles").update({
            plan,
            stripe_subscription_id:     sub.id,
            stripe_subscription_status: sub.status,
            stripe_current_period_end:  new Date((sub as any).current_period_end * 1000).toISOString(),
          }).eq("id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        const plan   = sub.metadata?.plan;
        if (userId) {
          const update: Record<string, unknown> = {
            stripe_subscription_id:     sub.id,
            stripe_subscription_status: sub.status,
            stripe_current_period_end:  new Date((sub as any).current_period_end * 1000).toISOString(),
          };
          if (plan) update.plan = plan;
          await supabaseAdmin.from("profiles").update(update).eq("id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (userId) {
          await supabaseAdmin.from("profiles").update({
            plan:                       "basico",
            stripe_subscription_status: "canceled",
            stripe_current_period_end:  null,
          }).eq("id", userId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = inv.customer as string;
        if (customerId) {
          await supabaseAdmin.from("profiles")
            .update({ stripe_subscription_status: "past_due" })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }
    }
  } catch (e: any) {
    console.error("Stripe webhook handler error:", e);
    res.status(500).json({ error: "Webhook handler error" });
    return;
  }

  res.json({ received: true });
});

export default router;
