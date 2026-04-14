import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type DeliveryStrategy = "FULL_ACCESS" | "SEQUENTIAL_MONTHLY" | "RANDOM_DAILY" | "NONE";

interface Slide {
  id: string;
  presentation_id: string;
  sequence_order: number;
}

interface UserProfile {
  id: string;
  plan: string;
  created_at: string;
}

export async function applyDeliveryStrategy(
  userId: string,
  profile: UserProfile,
  strategy: DeliveryStrategy,
  presentationId: string,
  allSlides: Slide[],
): Promise<void> {
  if (strategy === "NONE" || allSlides.length === 0) return;

  const sorted = [...allSlides].sort((a, b) => a.sequence_order - b.sequence_order);

  const { data: alreadyUnlocked } = await supabaseAdmin
    .from("user_unlocked_slides")
    .select("slide_id")
    .eq("user_id", userId)
    .in("slide_id", sorted.map((s) => s.id));

  const unlockedIds = new Set((alreadyUnlocked ?? []).map((r: { slide_id: string }) => r.slide_id));
  const locked = sorted.filter((s) => !unlockedIds.has(s.id));

  if (strategy === "FULL_ACCESS") {
    if (locked.length === 0) return;
    const rows = locked.map((s) => ({ user_id: userId, slide_id: s.id }));
    await supabaseAdmin
      .from("user_unlocked_slides")
      .upsert(rows, { onConflict: "user_id,slide_id" });
    return;
  }

  if (strategy === "SEQUENTIAL_MONTHLY") {
    const createdAt = new Date(profile.created_at);
    const now = new Date();
    const daysElapsed = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const targetCount = Math.min(
      sorted.length,
      Math.floor((daysElapsed / 30) * sorted.length),
    );
    const currentUnlocked = unlockedIds.size;
    if (targetCount <= currentUnlocked) return;
    const toUnlock = sorted.slice(currentUnlocked, targetCount);
    if (toUnlock.length === 0) return;
    const rows = toUnlock.map((s) => ({ user_id: userId, slide_id: s.id }));
    await supabaseAdmin
      .from("user_unlocked_slides")
      .upsert(rows, { onConflict: "user_id,slide_id" });
    return;
  }

  if (strategy === "RANDOM_DAILY") {
    if (locked.length === 0) return;
    const pick = locked[Math.floor(Math.random() * locked.length)];
    await supabaseAdmin
      .from("user_unlocked_slides")
      .upsert([{ user_id: userId, slide_id: pick.id }], { onConflict: "user_id,slide_id" });
    return;
  }
}

export { supabaseAdmin, type DeliveryStrategy, type Slide, type UserProfile };
