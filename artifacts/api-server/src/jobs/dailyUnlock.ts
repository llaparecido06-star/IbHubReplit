import { supabaseAdmin, applyDeliveryStrategy, type DeliveryStrategy, type PresentationGroup } from "../lib/deliveryStrategies.js";

export async function dailyUnlockJob(): Promise<void> {
  console.info("[dailyUnlockJob] Starting daily presentation unlock...");

  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("profiles")
    .select("id, plan, created_at")
    .not("plan", "is", null);

  if (profilesErr || !profiles || profiles.length === 0) {
    console.warn("[dailyUnlockJob] No profiles found or error:", profilesErr?.message);
    return;
  }

  const { data: plans, error: plansErr } = await supabaseAdmin
    .from("plans")
    .select("id, delivery_strategy");

  if (plansErr || !plans) {
    console.warn("[dailyUnlockJob] Failed to fetch plans:", plansErr?.message);
    return;
  }

  const planStrategyMap = new Map<string, DeliveryStrategy>(
    (plans as { id: string; delivery_strategy: string }[]).map((p) => [
      p.id,
      (p.delivery_strategy ?? "NONE") as DeliveryStrategy,
    ]),
  );

  const { data: presentations, error: presErr } = await supabaseAdmin
    .from("market_presentations")
    .select("id, created_at")
    .eq("published", true)
    .order("created_at", { ascending: true });

  if (presErr || !presentations || presentations.length === 0) {
    console.info("[dailyUnlockJob] No active presentations.");
    return;
  }

  const presentationIds = (presentations as { id: string; created_at: string }[]).map((p) => p.id);

  const { data: allSlides, error: slidesErr } = await supabaseAdmin
    .from("slides")
    .select("id, presentation_id, sequence_order")
    .in("presentation_id", presentationIds)
    .order("sequence_order", { ascending: true });

  if (slidesErr || !allSlides) {
    console.warn("[dailyUnlockJob] Failed to fetch slides:", slidesErr?.message);
    return;
  }

  const slidesByPresentation = new Map<string, { id: string; presentation_id: string; sequence_order: number }[]>();
  for (const slide of allSlides as { id: string; presentation_id: string; sequence_order: number }[]) {
    const arr = slidesByPresentation.get(slide.presentation_id) ?? [];
    arr.push(slide);
    slidesByPresentation.set(slide.presentation_id, arr);
  }

  const allPresentationGroups: PresentationGroup[] = presentationIds.map((pid) => ({
    id: pid,
    slides: slidesByPresentation.get(pid) ?? [],
  }));

  let processed = 0;
  let errors = 0;

  for (const profile of profiles as { id: string; plan: string; created_at: string }[]) {
    const strategy = planStrategyMap.get(profile.plan) ?? "NONE";
    if (strategy === "NONE") continue;

    try {
      await applyDeliveryStrategy(profile.id, profile, strategy, allPresentationGroups);
      processed++;
    } catch (e) {
      errors++;
      console.error(`[dailyUnlockJob] Error for user ${profile.id}:`, e);
    }
  }

  console.info(`[dailyUnlockJob] Done. Processed: ${processed}, Errors: ${errors}`);
}
