import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type DeliveryStrategy = "FULL_ACCESS" | "SEQUENTIAL_MONTHLY" | "RANDOM_DAILY" | "NONE";

export interface Slide {
  id: string;
  presentation_id: string;
  sequence_order: number;
}

export interface PresentationGroup {
  id: string;
  slides: Slide[];
}

export interface UserProfile {
  id: string;
  plan: string;
  created_at: string;
}

/**
 * Applies a delivery strategy at the slide level.
 *
 * - FULL_ACCESS:        unlocks all slides of every presentation immediately
 * - SEQUENTIAL_MONTHLY: divides total slides by 30 days; unlocks the proportional
 *                        number of slides (in sequence_order) based on days elapsed
 *                        since the user's account was created. After 30 days all slides
 *                        are fully unlocked.
 * - RANDOM_DAILY:       unlocks exactly one random locked presentation per day (cron only)
 * - NONE:               no-op
 *
 * Presentations are expected to be passed in canonical display order (sorted by created_at asc).
 * Slide-level `user_unlocked_slides` rows are used for persistence and serve as the
 * authoritative unlock record.
 */
export async function applyDeliveryStrategy(
  userId: string,
  profile: UserProfile,
  strategy: DeliveryStrategy,
  presentations: PresentationGroup[],
): Promise<void> {
  if (strategy === "NONE" || presentations.length === 0) return;

  const allSlideIds = presentations.flatMap((p) => p.slides.map((s) => s.id));
  if (allSlideIds.length === 0) return;

  const { data: alreadyUnlocked } = await supabaseAdmin
    .from("user_unlocked_slides")
    .select("slide_id")
    .eq("user_id", userId)
    .in("slide_id", allSlideIds);

  const unlockedIds = new Set((alreadyUnlocked ?? []).map((r: { slide_id: string }) => r.slide_id));

  const isPresentationUnlocked = (p: PresentationGroup): boolean =>
    p.slides.length > 0 && p.slides.every((s) => unlockedIds.has(s.id));

  const lockedPresentations = presentations.filter((p) => !isPresentationUnlocked(p));

  if (strategy === "FULL_ACCESS") {
    const toUnlock = presentations.flatMap((p) => p.slides).filter((s) => !unlockedIds.has(s.id));
    if (toUnlock.length === 0) return;
    await supabaseAdmin
      .from("user_unlocked_slides")
      .upsert(toUnlock.map((s) => ({ user_id: userId, slide_id: s.id })), { onConflict: "user_id,slide_id" });
    return;
  }

  if (strategy === "SEQUENTIAL_MONTHLY") {
    // All slides flattened in canonical order (presentation order → sequence_order within each)
    const allSlides = presentations.flatMap((p) =>
      [...p.slides].sort((a, b) => a.sequence_order - b.sequence_order),
    );
    const totalSlides = allSlides.length;
    if (totalSlides === 0) return;

    // How many days has this user been active?
    const createdAt = new Date(profile.created_at);
    const now = new Date();
    const daysElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Unlock (totalSlides / 30) slides per day, capped at totalSlides
    const slidesPerDay = totalSlides / 30;
    const targetCount = Math.min(totalSlides, Math.ceil(daysElapsed * slidesPerDay));

    const toUnlock = allSlides.slice(0, targetCount).filter((s) => !unlockedIds.has(s.id));
    if (toUnlock.length === 0) return;
    await supabaseAdmin
      .from("user_unlocked_slides")
      .upsert(toUnlock.map((s) => ({ user_id: userId, slide_id: s.id })), { onConflict: "user_id,slide_id" });
    return;
  }

  if (strategy === "RANDOM_DAILY") {
    if (lockedPresentations.length === 0) return;
    const pick = lockedPresentations[Math.floor(Math.random() * lockedPresentations.length)];
    const toUnlock = pick.slides.filter((s) => !unlockedIds.has(s.id));
    if (toUnlock.length === 0) return;
    await supabaseAdmin
      .from("user_unlocked_slides")
      .upsert(toUnlock.map((s) => ({ user_id: userId, slide_id: s.id })), { onConflict: "user_id,slide_id" });
    return;
  }
}

export { supabaseAdmin };
