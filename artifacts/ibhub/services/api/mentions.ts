import { supabase } from "@/context/AuthContext";
import { getSessionSafe, API_URL, guardedFetch } from "./_shared";

// ─── MENTIONS ────────────────────────────────────────────────────────────────

export interface MentionSuggestion {
  id: string;
  type: "user" | "company";
  display_name: string;
  username: string;
  avatar_url: string | null;
}

/**
 * Searches for users and companies by username/name to suggest in @mention pickers.
 */
export async function searchUsersForMention(q: string): Promise<MentionSuggestion[]> {
  if (!q || q.length < 1) return [];
  try {
    const [{ data: people }, { data: companies }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .not("username", "is", null)
        .limit(8),
      supabase
        .from("company_pages")
        .select("id, name, avatar_url, slug")
        .ilike("name", `%${q}%`)
        .limit(5),
    ]);

    const results: MentionSuggestion[] = [];
    for (const p of (people ?? [])) {
      if (!p.username) continue;
      results.push({ id: p.id, type: "user", display_name: p.full_name ?? p.username, username: p.username, avatar_url: p.avatar_url });
    }
    for (const c of (companies ?? [])) {
      const slug = (c as any).slug ?? c.name.toLowerCase().replace(/\s+/g, "_");
      results.push({ id: c.id, type: "company", display_name: c.name, username: slug, avatar_url: c.avatar_url });
    }
    return results;
  } catch { return []; }
}

/**
 * Parses @mentions from text, looks up user/company IDs and sends notifications + push.
 */
export async function sendMentionNotifications(
  text: string,
  actorId: string,
  actorName: string,
  postId?: string,
  commentId?: string,
): Promise<void> {
  try {
    const handles = [...new Set((text.match(/@([\w.]+)/g) ?? []).map(m => m.slice(1).toLowerCase()))];
    if (!handles.length) return;

    const [{ data: people }, { data: companies }] = await Promise.all([
      supabase.from("profiles").select("id, username").in("username", handles),
      supabase.from("company_pages").select("id, name, slug").in("slug", handles),
    ]);

    const mentionedUserIds: string[] = [];
    const notifs: Array<Record<string, unknown>> = [];
    const where = commentId ? "comentário" : "publicação";

    for (const p of (people ?? [])) {
      if (p.id === actorId) continue;
      mentionedUserIds.push(p.id);
      notifs.push({ user_id: p.id, actor_id: actorId, type: "mention", message: `mencionou você em um ${where}`, post_id: postId ?? null, comment_id: commentId ?? null });
    }
    for (const c of (companies ?? [])) {
      // For companies, notify their admins
      const { data: admins } = await supabase
        .from("company_page_admins")
        .select("user_id")
        .eq("company_page_id", c.id);
      for (const a of (admins ?? [])) {
        if (a.user_id === actorId) continue;
        mentionedUserIds.push(a.user_id);
        notifs.push({ user_id: a.user_id, actor_id: actorId, type: "mention", message: `mencionou ${c.name || "sua empresa"} em um ${where}`, post_id: postId ?? null, comment_id: commentId ?? null });
      }
    }

    if (!notifs.length) return;
    await supabase.from("notifications").insert(notifs);

    // Fire push notification (best-effort)
    if (API_URL && mentionedUserIds.length) {
      const { data: { session } } = await getSessionSafe();
      if (session?.access_token) {
        guardedFetch(`${API_URL}/push/mention`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ mentionedUserIds, actorName, postId, commentId, contextText: text.slice(0, 100) }),
        }).catch(() => {});
      }
    }
  } catch { /* best-effort — never throw */ }
}
