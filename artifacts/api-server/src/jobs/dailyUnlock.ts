import { supabaseAdmin, applyDeliveryStrategy, type DeliveryStrategy, type PresentationGroup } from "../lib/deliveryStrategies.js";
import { sendPushToUser } from "../lib/pushUtils.js";
import { logger } from "../lib/logger.js";

export async function dailyUnlockJob(): Promise<void> {
  logger.info("Starting daily presentation unlock…");

  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("profiles")
    .select("id, plan, created_at")
    .not("plan", "is", null);

  if (profilesErr || !profiles || profiles.length === 0) {
    logger.warn({ err: profilesErr }, "dailyUnlockJob: no profiles found or error");
    return;
  }

  const { data: plans, error: plansErr } = await supabaseAdmin
    .from("plans")
    .select("id, delivery_strategy");

  if (plansErr || !plans) {
    logger.warn({ err: plansErr }, "dailyUnlockJob: failed to fetch plans");
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
    logger.info("dailyUnlockJob: no active presentations");
    return;
  }

  const presentationIds = (presentations as { id: string; created_at: string }[]).map((p) => p.id);

  const { data: allSlides, error: slidesErr } = await supabaseAdmin
    .from("slides")
    .select("id, presentation_id, sequence_order")
    .in("presentation_id", presentationIds)
    .order("sequence_order", { ascending: true });

  if (slidesErr || !allSlides) {
    logger.warn({ err: slidesErr }, "dailyUnlockJob: failed to fetch slides");
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
  const usersWithNewContent: string[] = [];

  for (const profile of profiles as { id: string; plan: string; created_at: string }[]) {
    const strategy = planStrategyMap.get(profile.plan) ?? "NONE";
    if (strategy === "NONE") continue;

    try {
      const newlyUnlocked = await applyDeliveryStrategy(profile.id, profile, strategy, allPresentationGroups);
      processed++;

      // Only notify users who actually received new content today
      if (newlyUnlocked > 0) {
        usersWithNewContent.push(profile.id);
      }
    } catch (e) {
      errors++;
      logger.error({ err: e, userId: profile.id }, "dailyUnlockJob: error for user");
    }
  }

  logger.info({ processed, errors, notifying: usersWithNewContent.length }, "dailyUnlockJob: unlock phase done");

  // Send push notifications to users who had content unlocked today.
  // Fire concurrently in chunks to avoid overwhelming the Expo API.
  const CHUNK = 20;
  for (let i = 0; i < usersWithNewContent.length; i += CHUNK) {
    const batch = usersWithNewContent.slice(i, i + CHUNK);
    await Promise.allSettled(
      batch.map((userId) =>
        sendPushToUser({
          userId,
          title: "📚 Novo conteúdo disponível",
          body: "Suas apresentações de hoje foram liberadas. Toque para ver.",
          data: { type: "content_unlock", deepLink: "/(tabs)/mercado" },
        }),
      ),
    );
  }

  logger.info({ notified: usersWithNewContent.length }, "dailyUnlockJob: done");
}
