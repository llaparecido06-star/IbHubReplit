import { supabase } from "@/context/AuthContext";
import { API_URL, fetchCommentProfilesForIds } from "./_shared";
import type { AppConversation, AppMessage, AppMessageReaction } from "./types";
import type { Group } from "./groups";

// ─── MESSAGES ────────────────────────────────────────────────────────────────

export async function fetchMessages(conversationId: string, currentUserId?: string): Promise<AppMessage[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select(`
        id, conversation_id, sender_id, from_company_page_id, content, created_at,
        message_type, media_url, reply_to_id, read_at, metadata,
        from_company_page:company_pages(id, name, avatar_url)
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];

    const msgs = data as any[];

    // Fetch reply-to content for quoted messages
    const replyIds = msgs.filter(m => m.reply_to_id).map(m => m.reply_to_id as string);
    let replyMap: Record<string, { content: string; sender_id: string }> = {};
    if (replyIds.length > 0) {
      const { data: replies } = await supabase
        .from("messages")
        .select("id, content, sender_id")
        .in("id", replyIds);
      (replies ?? []).forEach((r: any) => { replyMap[r.id] = { content: r.content, sender_id: r.sender_id }; });
    }

    // Fetch reactions
    const msgIds = msgs.map(m => m.id);
    let reactionsMap: Record<string, AppMessageReaction[]> = {};
    if (msgIds.length > 0) {
      const { data: rxns } = await supabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", msgIds);
      if (rxns) {
        for (const r of rxns as any[]) {
          if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
          const existing = reactionsMap[r.message_id].find(x => x.emoji === r.emoji);
          if (existing) {
            existing.count++;
            if (r.user_id === currentUserId) existing.mine = true;
            existing.users?.push(r.user_id);
          } else {
            reactionsMap[r.message_id].push({
              emoji: r.emoji,
              count: 1,
              mine: r.user_id === currentUserId,
              users: [r.user_id],
            });
          }
        }
      }
    }

    return msgs.map(m => ({
      ...m,
      reply_to: m.reply_to_id ? (replyMap[m.reply_to_id] ?? null) : null,
      reactions: reactionsMap[m.id] ?? [],
    })) as AppMessage[];
  } catch (e) {
    console.error("fetchMessages:", e);
    return [];
  }
}

// ─── READ RECEIPTS ─────────────────────────────────────────────────────────────

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from("conversation_participants")
        .update({ last_read_at: now })
        .match({ conversation_id: conversationId, user_id: userId }),
      supabase
        .from("messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId)
        .is("read_at", null),
    ]);
  } catch (e) {
    console.error("markConversationRead:", e);
  }
}

// ─── REACTIONS ─────────────────────────────────────────────────────────────────

export async function toggleMessageReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from("message_reactions")
      .select("id")
      .match({ message_id: messageId, user_id: userId, emoji })
      .maybeSingle();

    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      // Remove any other emoji from this user on this message first (one reaction per message)
      await supabase.from("message_reactions").delete().match({ message_id: messageId, user_id: userId });
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
    }
    return true;
  } catch (e) {
    console.error("toggleMessageReaction:", e);
    return false;
  }
}


export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  opts?: { reply_to_id?: string; message_type?: string; metadata?: Record<string, any>; companyPageId?: string | null },
): Promise<AppMessage | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const body: Record<string, any> = {
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: opts?.message_type ?? "text",
    };
    if (opts?.reply_to_id)   body.reply_to_id          = opts.reply_to_id;
    if (opts?.metadata)      body.metadata             = opts.metadata;
    if (opts?.companyPageId) body.from_company_page_id = opts.companyPageId;

    const res = await fetch(`${API_URL}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("sendMessage server error:", res.status, errText);
      return null;
    }

    const json = await res.json();
    return json.data as AppMessage;
  } catch (e) {
    console.error("sendMessage:", e);
    return null;
  }
}


export async function fetchConversations(userId: string, activeCompanyId?: string | null): Promise<AppConversation[]> {
  try {
    // Use SECURITY DEFINER RPC to get all my conversations + the other participant's user_id
    // (cp_select RLS only shows own row, so a plain JOIN would fail)
    const [participantsRes, convosRes, ownedCompaniesRes] = await Promise.all([
      supabase.rpc("get_my_conversations_participants", { p_user_id: userId }),
      supabase
        .from("conversation_participants")
        .select(`conversation_id, accepted, last_read_at, conversation:conversations(id, is_group, name, created_at, company_page_id)`)
        .eq("user_id", userId),
      // Fetch company pages owned by this user so we can filter them out of personal mode
      supabase.from("company_pages").select("id").eq("owner_id", userId),
    ]);

    // Set of company IDs this user owns (to exclude from personal mode)
    const ownedCompanyIds = new Set<string>(
      ((ownedCompaniesRes.data ?? []) as any[]).map((c: any) => c.id as string)
    );

    if (convosRes.error || !convosRes.data) return [];

    // Build a map: conversation_id → { other_user_id, my_accepted }
    const participantMap = new Map<string, { other_user_id: string | null; my_accepted: boolean }>();
    for (const row of (participantsRes.data ?? []) as any[]) {
      participantMap.set(row.conversation_id, {
        other_user_id: row.other_user_id ?? null,
        my_accepted: row.my_accepted ?? true,
      });
    }

    // Collect all other participant user IDs for bulk profile fetch
    const allOtherIds = [...new Set(
      [...participantMap.values()].map(v => v.other_user_id).filter(Boolean) as string[]
    )];
    const profileMap = allOtherIds.length > 0 ? await fetchCommentProfilesForIds(allOtherIds) : new Map();

    const results: AppConversation[] = [];
    for (const row of convosRes.data as any[]) {
      const convo = row.conversation;
      if (!convo) continue;

      const pInfo = participantMap.get(convo.id);
      const participant = pInfo?.other_user_id ? (profileMap.get(pInfo.other_user_id) ?? null) : null;

      let unreadQuery = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convo.id)
        .neq("sender_id", userId)
        .is("read_at", null);

      if (row.last_read_at) {
        unreadQuery = unreadQuery.gt("created_at", row.last_read_at);
      }

      const [lastMsgRes, unreadRes] = await Promise.all([
        supabase
          .from("messages")
          .select("content, created_at, message_type, sender_id, from_company_page_id")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        unreadQuery,
      ]);

      const lastMsg = lastMsgRes.data;
      const lastContent =
        lastMsg?.message_type === "image" ? "📷 Foto"
        : lastMsg?.message_type === "video" ? "🎬 Vídeo"
        : lastMsg?.message_type === "audio" ? "🎤 Áudio"
        : lastMsg?.message_type === "file"  ? "📎 Arquivo"
        : (lastMsg?.content ?? null);

      const otherSenderCompanyId =
        lastMsg && (lastMsg as any).sender_id !== userId
          ? ((lastMsg as any).from_company_page_id ?? null)
          : null;

      // Use the conversation's own company_page_id as fallback so company name/avatar
      // always shows even when the most recent message was sent by the regular user side.
      const displayCompanyId: string | null = otherSenderCompanyId ?? ((convo as any).company_page_id ?? null);

      results.push({
        id: convo.id,
        is_group: convo.is_group,
        name: convo.name,
        last_message: lastContent,
        last_message_at: lastMsg?.created_at ?? convo.created_at,
        unread_count: unreadRes.count ?? 0,
        participant,
        participant_company: displayCompanyId ? { id: displayCompanyId, name: "", avatar_url: null } : null,
        accepted: pInfo?.my_accepted ?? (row.accepted ?? true),
        company_page_id: (convo as any).company_page_id ?? null,
      });
    }

    // Bulk-fetch company info for conversations where last message was from a company
    const companyIds = [...new Set(results.map(r => r.participant_company?.id).filter(Boolean) as string[])];
    if (companyIds.length > 0) {
      const { data: companyData } = await supabase
        .from("company_pages")
        .select("id, name, avatar_url")
        .in("id", companyIds);
      if (companyData) {
        const companyMap = new Map((companyData as any[]).map(c => [c.id, c]));
        for (const r of results) {
          if (r.participant_company?.id) {
            const cp = companyMap.get(r.participant_company.id);
            if (cp) r.participant_company = { id: cp.id, name: cp.name, avatar_url: cp.avatar_url ?? null };
          }
        }
      }
    }

    // ── Identity filter (personal vs company) ─────────────────────────────────
    // Conversations are tagged at creation with company_page_id (null = personal).
    // Group chats (is_group=true) always appear in both modes.
    //
    // COMPANY MODE  → only show conversations owned by the active company page.
    // PERSONAL MODE → show personal conversations (company_page_id IS NULL) PLUS
    //   any company conversations where this user is the non-owner participant
    //   (e.g. a regular user who messaged a company page from their profile).
    //   Conversations belonging to companies that the user OWNS are excluded so
    //   they appear cleanly in company mode instead.
    const sorted = results.sort(
      (a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime(),
    );
    if (activeCompanyId) {
      return sorted.filter(r => r.is_group || r.company_page_id === activeCompanyId);
    }
    // Personal mode: exclude conversations that belong to a company this user owns
    return sorted.filter(r => r.is_group || !r.company_page_id || !ownedCompanyIds.has(r.company_page_id));
  } catch (e) {
    console.error("fetchConversations:", e);
    return [];
  }
}

export async function acceptConversation(conversationId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("conversation_participants")
      .update({ accepted: true })
      .match({ conversation_id: conversationId, user_id: userId });
    return !error;
  } catch { return false; }
}

export async function declineConversation(conversationId: string, userId: string): Promise<boolean> {
  try {
    await supabase
      .from("conversation_participants")
      .delete()
      .match({ conversation_id: conversationId, user_id: userId });
    return true;
  } catch { return false; }
}

export async function fetchConversationParticipant(
  conversationId: string,
  currentUserId: string,
): Promise<{ id: string; full_name: string; avatar_url: string | null } | null> {
  try {
    // Use SECURITY DEFINER RPC to bypass cp_select RLS (which only shows own row)
    const { data, error } = await supabase.rpc("get_conversation_other_participant", {
      p_conversation_id: conversationId,
      p_current_user_id: currentUserId,
    });
    if (error) { console.warn("fetchConversationParticipant rpc:", error); return null; }
    if (!data || (data as any[]).length === 0) return null;
    const otherId = (data as any[])[0]?.user_id ?? (data as any).user_id;
    if (!otherId) return null;
    const pMap = await fetchCommentProfilesForIds([otherId]);
    return pMap.get(otherId) ?? null;
  } catch { return null; }
}

export async function fetchConversationAccepted(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("conversation_participants")
      .select("accepted")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .single();
    if (error) {
      console.warn("fetchConversationAccepted error:", error);
      return true;
    }
    const accepted = (data as any)?.accepted;
    return accepted === false ? false : true;
  } catch (e) {
    console.warn("fetchConversationAccepted threw:", e);
    return true;
  }
}
