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
const PRICE_IDS: Record<string, string> = {
  premium:   process.env.STRIPE_PRICE_PREMIUM   ?? "",
  exclusive: process.env.STRIPE_PRICE_EXCLUSIVE ?? "",
  business:  process.env.STRIPE_PRICE_BUSINESS  ?? "",
};

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

/** Profile row shape returned from Supabase select */
interface ProfileRow {
  stripe_customer_id: string | null;
  full_name: string | null;
}

/** Get or create a Stripe customer for a user */
async function getOrCreateCustomer(stripe: Stripe, userId: string, email: string | null): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  const profile = data as ProfileRow | null;

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

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

  if (!plan || !PRICE_IDS[plan]) {
    res.status(400).json({ error: `Plano inválido. Use: ${Object.keys(PRICE_IDS).join(", ")}` });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Pagamentos ainda não configurados. Contate o suporte." });
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
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
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
            stripe_current_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
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
            stripe_current_period_end:  new Date(sub.current_period_end * 1000).toISOString(),
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
        const customerId = inv.customer;
        if (customerId && typeof customerId === "string") {
          await supabaseAdmin.from("profiles")
            .update({ stripe_subscription_status: "past_due" })
            .eq("stripe_customer_id", customerId);
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

export default router;
