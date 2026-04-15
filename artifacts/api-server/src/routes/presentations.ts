import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return null;
  }
  const token = authHeader.slice(7);
  const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  return userData.user.id;
}

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = await requireAuth(req, res);
  if (!userId) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || !(profile as { is_admin: boolean }).is_admin) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return userId;
}

// GET /api/presentations/:id/slides
// Returns ALL slides for a presentation, with signed URLs (5 min) for unlocked entries
// and url=null for locked entries. This intentional "full manifest with holes" contract
// lets the mobile client render locked placeholders without exposing private storage paths.
// Only published presentations are accessible to non-admin users.
router.get("/presentations/:id/slides", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const presentationId = req.params.id;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, is_admin, courtesy_until")
    .eq("id", userId)
    .maybeSingle();

  const typedProfile2 = profile as { plan?: string; is_admin?: boolean; courtesy_until?: string | null } | null;
  const isAdmin = !!typedProfile2?.is_admin;
  const isCourtesy2 = !!typedProfile2?.courtesy_until && new Date(typedProfile2.courtesy_until) > new Date();

  // Server-side feature gate: non-admin, non-courtesy users must have a plan with mercado features
  if (!isAdmin && !isCourtesy2) {
    const planId2 = typedProfile2?.plan ?? "gratuito";
    const { data: planFeatures } = await supabaseAdmin
      .from("plans")
      .select("features")
      .eq("id", planId2)
      .maybeSingle();
    const features = (planFeatures as { features?: string[] } | null)?.features ?? [];
    const hasMercadoAccess = features.some((f) => f.startsWith("mercado:"));
    if (!hasMercadoAccess) {
      res.status(403).json({ error: "Plano atual não inclui acesso ao mercado de dados." });
      return;
    }
  }

  // For non-admin callers, verify the presentation is published
  if (!isAdmin) {
    const { data: pres } = await supabaseAdmin
      .from("market_presentations")
      .select("id, published")
      .eq("id", presentationId)
      .maybeSingle();
    if (!pres || !(pres as { published: boolean }).published) {
      res.status(404).json({ error: "Presentation not found" });
      return;
    }
  }

  const { data: allSlides, error: slidesErr } = await supabaseAdmin
    .from("slides")
    .select("id, sequence_order, storage_path")
    .eq("presentation_id", presentationId)
    .order("sequence_order", { ascending: true });

  if (slidesErr) {
    res.status(500).json({ error: "Failed to fetch slides" });
    return;
  }

  const slides = (allSlides ?? []) as { id: string; sequence_order: number; storage_path: string }[];
  const totalSlides = slides.length;

  if (totalSlides === 0) {
    res.json({ slides: [], total: 0 });
    return;
  }

  let unlockedSlideIds: Set<string>;

  if (isAdmin || isCourtesy2) {
    unlockedSlideIds = new Set(slides.map((s) => s.id));
  } else {
    const planId = typedProfile2?.plan ?? "gratuito";
    const { data: planData } = await supabaseAdmin
      .from("plans")
      .select("delivery_strategy")
      .eq("id", planId)
      .maybeSingle();

    const strategy = (planData as { delivery_strategy?: string } | null)?.delivery_strategy ?? "NONE";

    if (strategy === "FULL_ACCESS") {
      unlockedSlideIds = new Set(slides.map((s) => s.id));
    } else {
      const { data: unlocked } = await supabaseAdmin
        .from("user_unlocked_slides")
        .select("slide_id")
        .eq("user_id", userId)
        .in("slide_id", slides.map((s) => s.id));

      unlockedSlideIds = new Set((unlocked ?? []).map((r: { slide_id: string }) => r.slide_id));
    }
  }

  const SIGNED_URL_EXPIRES = 300;

  const results: { slide_id: string; sequence_order: number; url: string | null; locked: boolean }[] = [];

  for (const slide of slides) {
    const locked = !unlockedSlideIds.has(slide.id);
    if (locked) {
      results.push({ slide_id: slide.id, sequence_order: slide.sequence_order, url: null, locked: true });
      continue;
    }
    const { data: signedData, error: signErr } = await supabaseAdmin.storage
      .from("presentation-slides")
      .createSignedUrl(slide.storage_path, SIGNED_URL_EXPIRES);

    results.push({
      slide_id: slide.id,
      sequence_order: slide.sequence_order,
      url: signErr || !signedData ? null : signedData.signedUrl,
      locked: false,
    });
  }

  res.json({ slides: results, total: totalSlides, unlocked: unlockedSlideIds.size });
});

// POST /presentations/:id/access
// Called when a user opens a presentation — triggers the delivery strategy for their plan
// so they receive slides immediately (in addition to the daily cron job).
router.post("/presentations/:id/access", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const presentationId = String(req.params.id);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, plan, is_admin, stripe_subscription_status, courtesy_until, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const typedProfile = profile as { id: string; plan?: string; is_admin?: boolean; stripe_subscription_status?: string; courtesy_until?: string | null; created_at: string };

  if (typedProfile.is_admin) {
    res.json({ ok: true, applied: false, reason: "admin" });
    return;
  }

  const { applyDeliveryStrategy } = await import("../lib/deliveryStrategies.js");
  type DS = "FULL_ACCESS" | "SEQUENTIAL_MONTHLY" | "RANDOM_DAILY" | "NONE";

  // Courtesy users get FULL_ACCESS regardless of their plan strategy
  const isCourtesy = !!typedProfile.courtesy_until && new Date(typedProfile.courtesy_until) > new Date();

  let strategy: DS;
  if (isCourtesy) {
    strategy = "FULL_ACCESS";
  } else {
    const planId = typedProfile.plan ?? "gratuito";
    const { data: planData } = await supabaseAdmin
      .from("plans")
      .select("delivery_strategy")
      .eq("id", planId)
      .maybeSingle();
    strategy = (((planData as { delivery_strategy?: string } | null)?.delivery_strategy) ?? "NONE") as DS;
  }

  const { data: slidesRaw } = await supabaseAdmin
    .from("slides")
    .select("id, sequence_order")
    .eq("presentation_id", presentationId)
    .order("sequence_order", { ascending: true });

  if (!slidesRaw || slidesRaw.length === 0) {
    res.json({ ok: true, applied: false, reason: "no_slides" });
    return;
  }

  const slides = (slidesRaw as { id: string; sequence_order: number }[]).map(s => ({
    ...s,
    presentation_id: presentationId,
  }));

  await applyDeliveryStrategy(
    userId,
    { id: typedProfile.id, plan: typedProfile.plan ?? "gratuito", created_at: typedProfile.created_at },
    strategy,
    presentationId,
    slides,
  );

  res.json({ ok: true, applied: true, strategy });
});

// POST /admin/update-plan-strategy
router.post("/admin/update-plan-strategy", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { plan_id, delivery_strategy } = req.body as { plan_id?: string; delivery_strategy?: string };
  if (!plan_id || !delivery_strategy) {
    res.status(400).json({ error: "plan_id and delivery_strategy are required" });
    return;
  }

  const valid = ["RANDOM_DAILY", "SEQUENTIAL_MONTHLY", "FULL_ACCESS", "NONE"];
  if (!valid.includes(delivery_strategy)) {
    res.status(400).json({ error: `delivery_strategy must be one of: ${valid.join(", ")}` });
    return;
  }

  const { error } = await supabaseAdmin
    .from("plans")
    .update({ delivery_strategy })
    .eq("id", plan_id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
});

// POST /admin/presentations/:id/slides — Upload slide metadata (storage upload happens on client)
router.post("/admin/presentations/:id/slides", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const presentationId = req.params.id;
  const { slides } = req.body as { slides?: { storage_path: string; sequence_order: number }[] };

  if (!slides || !Array.isArray(slides) || slides.length === 0) {
    res.status(400).json({ error: "slides array is required" });
    return;
  }

  const rows = slides.map((s) => ({
    presentation_id: presentationId,
    storage_path: s.storage_path,
    sequence_order: s.sequence_order,
  }));

  const { data, error } = await supabaseAdmin.from("slides").insert(rows).select();
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true, slides: data });
});

// DELETE /admin/slides/:slideId
router.delete("/admin/slides/:slideId", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const slideId = req.params.slideId;

  const { data: slide } = await supabaseAdmin
    .from("slides")
    .select("storage_path")
    .eq("id", slideId)
    .maybeSingle();

  if (slide) {
    await supabaseAdmin.storage
      .from("presentation-slides")
      .remove([(slide as { storage_path: string }).storage_path])
      .catch(() => {});
  }

  const { error } = await supabaseAdmin.from("slides").delete().eq("id", slideId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
});

// POST /admin/presentations/:id/slides/signed-upload — Get signed upload URL for a slide
router.post("/admin/presentations/:id/slides/signed-upload", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const presentationId = req.params.id;
  const { filename, sequence_order } = req.body as { filename?: string; sequence_order?: number };
  if (!filename) {
    res.status(400).json({ error: "filename is required" });
    return;
  }

  const storagePath = `${presentationId}/${sequence_order ?? 0}_${filename}`;
  const { data, error } = await supabaseAdmin.storage
    .from("presentation-slides")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    res.status(500).json({ error: error?.message ?? "Failed to create signed upload URL" });
    return;
  }

  res.json({ signedUrl: data.signedUrl, path: storagePath, token: data.token });
});

export default router;
