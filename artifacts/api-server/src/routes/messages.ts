import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveUserId } from "../lib/planCheck.js";
import { validateBody } from "../middlewares/validate.js";
import { sendPushToUser } from "../lib/pushUtils.js";
import { sendWebPushToUser } from "../lib/webPushUtils.js";
import { logger } from "../lib/logger.js";

const router = Router();

const supabaseUrl        = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Validation schemas ──────────────────────────────────────────────────
// Hard limits chosen to match the existing UI: chat messages are typed by
// hand (10k chars is generous). Media URLs are bounded so an attacker can't
// stuff multi-MB strings into the DB through this endpoint. UUIDs are
// validated structurally so malformed ids fail fast at the edge.
const SendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string().max(10_000),
  message_type: z.string().max(40).optional().default("text"),
  media_url: z.string().url().max(2048).optional(),
  reply_to_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  from_company_page_id: z.string().uuid().optional(),
});

const DirectConversationSchema = z.object({
  user_id_1: z.string().uuid(),
  user_id_2: z.string().uuid(),
  company_page_id: z.string().uuid().nullable().optional(),
  force_accepted: z.boolean().optional().default(false),
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * POST /messages/send
 *
 * Inserts a chat message using the service role key (bypasses RLS).
 * The caller must be an authenticated user. If their participant row is
 * missing (can happen due to an RLS insert bug in conversation creation),
 * it is auto-repaired before inserting the message.
 *
 * Body:
 *   conversation_id       string  (required)
 *   sender_id             string  (required — must match auth.uid() or own profile.id)
 *   content               string  (required)
 *   message_type          string  (default: "text")
 *   media_url             string  (optional)
 *   reply_to_id           string  (optional)
 *   metadata              object  (optional)
 *   from_company_page_id  string  (optional)
 */
router.post("/messages/send", validateBody(SendMessageSchema), async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const {
    conversation_id,
    sender_id,
    content,
    message_type,
    media_url,
    reply_to_id,
    metadata,
    from_company_page_id,
  } = req.body as z.infer<typeof SendMessageSchema>;

  // Verify the sender_id corresponds to the authenticated user.
  // Accept direct match (auth.uid() === sender_id) OR legacy profile where
  // profile.id === sender_id but profile.user_id === auth.uid().
  if (sender_id !== callerId) {
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", sender_id)
      .eq("user_id", callerId)
      .maybeSingle();

    if (!profileRow) {
      res.status(403).json({ error: "sender_id não corresponde ao usuário autenticado." });
      return;
    }
  }

  // Check if the conversation exists.
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, is_group")
    .eq("id", conversation_id)
    .maybeSingle();

  if (!conversation) {
    res.status(404).json({ error: "Conversa não encontrada." });
    return;
  }

  // Check if the caller has a participant row (using both auth.uid() and sender_id
  // to handle legacy profiles where user_id in conversation_participants = profile.id).
  const idsToCheck = [...new Set([callerId, sender_id])];
  const orFilter   = idsToCheck.map(id => `user_id.eq.${id}`).join(",");

  const { data: participantRows } = await supabaseAdmin
    .from("conversation_participants")
    .select("user_id, accepted")
    .eq("conversation_id", conversation_id)
    .or(orFilter)
    .limit(2);

  const found = (participantRows ?? []).length > 0;

  if (!found) {
    // Auto-repair: participant row is missing (likely because the RLS INSERT policy
    // prevented the conversation creator from inserting a row for this user).
    // Only do this for direct (non-group) conversations to limit the blast radius.
    if (conversation.is_group) {
      res.status(403).json({ error: "Você não é participante desta conversa." });
      return;
    }

    // Upsert the missing participant row so this user can now send messages.
    await supabaseAdmin
      .from("conversation_participants")
      .upsert(
        { conversation_id, user_id: callerId, accepted: true },
        { onConflict: "conversation_id,user_id" },
      );
  }

  const payload: Record<string, any> = {
    conversation_id,
    sender_id,
    content,
    message_type,
  };
  if (media_url)   payload.media_url   = media_url;
  if (reply_to_id) payload.reply_to_id = reply_to_id;
  if (metadata)    payload.metadata    = metadata;

  // Anti-spoofing: a message can only be authored "as" a company if the
  // sender is the owner OR a registered admin of that company page.
  // Without this check, any caller able to send a message could pass an
  // arbitrary `from_company_page_id` and impersonate that company in the
  // recipient's UI (the per-message identity swap renders company name +
  // avatar instead of the personal sender).
  if (from_company_page_id) {
    const ownerCheckIds = [...new Set([callerId, sender_id])];
    const { data: ownerRow } = await supabaseAdmin
      .from("company_pages")
      .select("id")
      .eq("id", from_company_page_id)
      .in("owner_id", ownerCheckIds)
      .maybeSingle();

    let allowed = !!ownerRow;
    if (!allowed) {
      const { data: adminRow } = await supabaseAdmin
        .from("company_page_admins")
        .select("id")
        .eq("company_id", from_company_page_id)
        .in("user_id", ownerCheckIds)
        .maybeSingle();
      allowed = !!adminRow;
    }

    if (!allowed) {
      res.status(403).json({ error: "not_company_member" });
      return;
    }
    payload.from_company_page_id = from_company_page_id;
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert(payload)
    .select()
    .single();

  if (error) {
    req.log.error({ supabaseError: error.message }, "[messages/send] insert error");
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ data });

  // ── DM push fan-out (fire-and-forget) ───────────────────────────────────────
  // Sends mobile (Expo) + web push to the other participant(s) in a DM.
  if (!conversation.is_group) {
    void (async () => {
      try {
        const [participantsRes, senderRes] = await Promise.all([
          supabaseAdmin
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conversation_id)
            .neq("user_id", sender_id),
          supabaseAdmin
            .from("profiles")
            .select("full_name, username")
            .eq("id", sender_id)
            .maybeSingle(),
        ]);

        const recipientIds = ((participantsRes.data ?? []) as { user_id: string }[])
          .map((p) => p.user_id)
          .filter((uid) => uid !== callerId);

        if (recipientIds.length === 0) return;

        const senderName =
          (senderRes.data as { full_name?: string; username?: string } | null)?.full_name
          ?? (senderRes.data as { full_name?: string; username?: string } | null)?.username
          ?? "Alguém";

        const preview =
          message_type === "text" && content ? content.slice(0, 80)
          : message_type === "image"         ? "📷 Foto"
          : message_type === "video"         ? "🎥 Vídeo"
          : message_type === "audio"         ? "🎤 Áudio"
          :                                    "Nova mensagem";

        await Promise.all(
          recipientIds.flatMap((userId) => [
            sendPushToUser({
              userId,
              title: senderName,
              body: preview,
              data: {
                type: "direct_message",
                conversationId: conversation_id,
                deepLink: `/mensagens/${conversation_id}`,
              },
            }),
            sendWebPushToUser(userId, {
              title: senderName,
              body: preview,
              url: `/app/mensagens/${conversation_id}`,
              tag: `dm-${conversation_id}`,
            }),
          ]),
        );

        logger.info(
          { conversationId: conversation_id, recipients: recipientIds.length },
          "dm push: fan-out complete",
        );
      } catch (err) {
        logger.error({ err, conversationId: conversation_id }, "dm push: fan-out error");
      }
    })();
  }

  // ── Group push fan-out (fire-and-forget, does not block the response) ──────
  if (conversation.is_group) {
    void (async () => {
      try {
        // 1. Fetch group name + all participants in parallel
        const [groupRes, participantsRes] = await Promise.all([
          supabaseAdmin
            .from("conversations")
            .select("name")
            .eq("id", conversation_id)
            .maybeSingle(),
          supabaseAdmin
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conversation_id),
        ]);

        const groupName = (groupRes.data as { name?: string } | null)?.name ?? "Grupo";

        // Exclude the sender from the recipient list
        const allParticipantIds = ((participantsRes.data ?? []) as { user_id: string }[])
          .map((p) => p.user_id)
          .filter((uid) => uid !== callerId && uid !== sender_id);

        if (allParticipantIds.length === 0) return;

        // 2. Filter out users who have muted this group
        const { data: mutedRows } = await supabaseAdmin
          .from("group_mutes")
          .select("user_id")
          .eq("group_id", conversation_id)
          .in("user_id", allParticipantIds);

        const mutedIds = new Set(((mutedRows ?? []) as { user_id: string }[]).map((r) => r.user_id));
        const targetIds = allParticipantIds.filter((uid) => !mutedIds.has(uid));

        if (targetIds.length === 0) return;

        // 3. Fetch sender display name
        const { data: senderProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, username")
          .eq("id", sender_id)
          .maybeSingle();

        const senderName = (senderProfile as { full_name?: string; username?: string } | null)?.full_name
          ?? (senderProfile as { full_name?: string; username?: string } | null)?.username
          ?? "Alguém";

        // 4. Build notification body with a content preview
        const preview =
          message_type === "text" && content ? content.slice(0, 80)
          : message_type === "image"         ? "📷 Foto"
          : message_type === "video"         ? "🎥 Vídeo"
          : message_type === "audio"         ? "🎤 Áudio"
          :                                    "Nova mensagem";

        // 5. Fan out — mobile (Expo) + web push per recipient
        await Promise.all(
          targetIds.flatMap((userId) => [
            sendPushToUser({
              userId,
              title: `${senderName} em ${groupName}`,
              body: preview,
              data: {
                type: "group_message",
                conversationId: conversation_id,
                deepLink: `/group-chat/${conversation_id}`,
              },
            }),
            sendWebPushToUser(userId, {
              title: `${senderName} em ${groupName}`,
              body: preview,
              url: `/app/grupo-chat/${conversation_id}`,
              tag: `group-${conversation_id}`,
            }),
          ]),
        );

        logger.info(
          { conversationId: conversation_id, recipients: targetIds.length, muted: mutedIds.size },
          "group push: fan-out complete",
        );
      } catch (err) {
        logger.error({ err, conversationId: conversation_id }, "group push: fan-out error");
      }
    })();
  }
});

/**
 * POST /conversations/direct
 *
 * Creates (or retrieves) a direct conversation between two users,
 * ensuring both participant rows are inserted with supabaseAdmin
 * (bypasses the RLS INSERT restriction that only allows inserting own user_id).
 *
 * Body:
 *   user_id_1         string  (required — must be the authenticated user or their profile.id)
 *   user_id_2         string  (required — the other participant)
 *   company_page_id   string  (optional)
 *   force_accepted    boolean (optional, default false)
 */
router.post("/conversations/direct", validateBody(DirectConversationSchema), async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const {
    user_id_1,
    user_id_2,
    company_page_id = null,
    force_accepted  = false,
  } = req.body as z.infer<typeof DirectConversationSchema>;

  // Verify the caller owns user_id_1 (auth.uid() or legacy profile.id).
  if (user_id_1 !== callerId) {
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user_id_1)
      .eq("user_id", callerId)
      .maybeSingle();

    if (!profileRow) {
      res.status(403).json({ error: "user_id_1 não corresponde ao usuário autenticado." });
      return;
    }
  }

  // Anti-spoofing: a conversation may carry a `company_page_id` only when
  // it actually relates to that company — either the SENDER is sending
  // "as" the company (caller / user_id_1 owns or admins it) OR the
  // RECIPIENT is the company (user_id_2 owns or admins it; this is the
  // common job-application / marketplace-inquiry flow where a candidate
  // contacts a company-owned listing). Without this check, anyone could
  // tag a thread with an arbitrary company id and have it appear in that
  // company's inbox.
  if (company_page_id) {
    const candidateIds = [...new Set([callerId, user_id_1, user_id_2])];
    const { data: ownerRows } = await supabaseAdmin
      .from("company_pages")
      .select("id")
      .eq("id", company_page_id)
      .in("owner_id", candidateIds);

    let allowed = (ownerRows ?? []).length > 0;
    if (!allowed) {
      const { data: adminRows } = await supabaseAdmin
        .from("company_page_admins")
        .select("id")
        .eq("company_id", company_page_id)
        .in("user_id", candidateIds);
      allowed = (adminRows ?? []).length > 0;
    }

    if (!allowed) {
      res.status(403).json({ error: "not_company_member" });
      return;
    }
  }

  // Check for an existing direct conversation between the two users.
  // We query conversation_participants for conversations where BOTH users are listed.
  const { data: cp1Rows } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id")
    .or(`user_id.eq.${user_id_1},user_id.eq.${callerId}`);

  const { data: cp2Rows } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user_id_2);

  const cp1Ids = new Set((cp1Rows ?? []).map((r: any) => r.conversation_id));
  const shared = (cp2Rows ?? [])
    .map((r: any) => r.conversation_id)
    .filter((id: string) => cp1Ids.has(id));

  if (shared.length > 0) {
    // First try an exact match on company_page_id so personal and company
    // inboxes stay separate when the user deliberately switches context.
    const { data: convos } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .in("id", shared)
      .eq("is_group", false)
      .eq("company_page_id", company_page_id ?? null);

    const existing = (convos ?? [])[0];
    if (existing) {
      res.json({ conversation_id: existing.id });
      return;
    }

    // Fallback: no exact-match found (e.g. a company-tagged DM exists but
    // the caller is now requesting a personal one). Return the existing DM
    // regardless of company_page_id rather than creating a duplicate thread
    // — this preserves message history.
    const { data: anyConvos } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .in("id", shared)
      .eq("is_group", false);

    const anyExisting = (anyConvos ?? [])[0];
    if (anyExisting) {
      res.json({ conversation_id: anyExisting.id });
      return;
    }
  }

  // Determine if the new conversation starts as accepted for user_id_2.
  let recipientAccepted = force_accepted;
  if (!recipientAccepted) {
    const { count: connCount } = await supabaseAdmin
      .from("connections")
      .select("id", { count: "exact", head: true })
      .or(
        `and(requester_id.eq.${user_id_1},receiver_id.eq.${user_id_2}),and(requester_id.eq.${user_id_2},receiver_id.eq.${user_id_1})`,
      )
      .eq("status", "accepted");
    recipientAccepted = (connCount ?? 0) > 0;

    if (!recipientAccepted) {
      const { count: cpCount } = await supabaseAdmin
        .from("company_pages")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user_id_2);
      recipientAccepted = (cpCount ?? 0) > 0;
    }
  }

  // Generate a UUID for the new conversation.
  const newId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

  const { error: convErr } = await supabaseAdmin
    .from("conversations")
    .insert({ id: newId, is_group: false, company_page_id: company_page_id ?? null });

  if (convErr) {
    req.log.error({ supabaseError: convErr.message }, "[conversations/direct] insert conversation");
    res.status(500).json({ error: convErr.message });
    return;
  }

  // Insert BOTH participant rows using supabaseAdmin (no RLS restrictions).
  const { error: cpInsertError } = await supabaseAdmin.from("conversation_participants").insert([
    { conversation_id: newId, user_id: user_id_1, accepted: true },
    { conversation_id: newId, user_id: user_id_2, accepted: recipientAccepted },
  ]);

  if (cpInsertError) {
    req.log.error({ supabaseError: cpInsertError.message }, "[conversations/direct] insert participants failed");
    res.status(500).json({ error: "Falha ao adicionar participantes à conversa." });
    return;
  }

  res.json({ conversation_id: newId });
});

/**
 * GET /conversations
 *
 * Returns the conversation list for the authenticated user, bypassing all
 * client-side RLS (which has a recursive self-reference on conversation_participants
 * that causes direct Supabase client queries to return empty results).
 *
 * Query params:
 *   active_company_id  string  (optional) — when set, scopes list to that company's inbox
 */
router.get("/conversations", async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const activeCompanyId = (req.query.active_company_id as string | undefined) ?? null;

  // Resolve the effective profile.id for this caller.
  // For legacy users, profile.id (the row PK) may differ from auth.uid() (callerId),
  // because conversation_participants rows were inserted using profile.id (user_id_1 from
  // the web client) while callerId is always auth.uid(). We must check both.
  const { data: callerProfileRow } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .or(`id.eq.${callerId},user_id.eq.${callerId}`)
    .limit(1)
    .maybeSingle();

  const effectiveProfileId = (callerProfileRow as { id: string } | null)?.id ?? callerId;
  const participantIds = [...new Set([callerId, effectiveProfileId])];
  const participantFilter = participantIds.map((id) => `user_id.eq.${id}`).join(",");

  // 1. All conversation IDs this user participates in (check both auth.uid and profile.id)
  const { data: cpRows, error: cpError } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id")
    .or(participantFilter);

  if (cpError) {
    req.log.error({ supabaseError: cpError.message }, "[conversations] fetch participants error");
  }

  // 1b. Backfill: ensure conversation_participants rows exist for all group memberships.
  // Users who joined groups before joinGroup was updated to use supabaseAdmin will have
  // group_members rows but no conversation_participants rows — so their groups are invisible
  // in the conversations list. This self-heals that data on every load.
  const existingConvIdSet = new Set<string>(
    (cpRows ?? []).map((r: any) => r.conversation_id as string),
  );

  const { data: groupMemberships } = await supabaseAdmin
    .from("group_members")
    .select("group_id")
    .or(participantIds.map((id) => `user_id.eq.${id}`).join(","))
    .neq("role", "pending");

  const memberGroupIds = ((groupMemberships ?? []) as { group_id: string }[]).map((r) => r.group_id);
  const missingGroupIds = memberGroupIds.filter((id) => !existingConvIdSet.has(id));

  if (missingGroupIds.length > 0) {
    // Ensure conversations rows exist for these groups (older groups may be missing them)
    const { data: groupRows } = await supabaseAdmin
      .from("groups")
      .select("id, name, avatar_url")
      .in("id", missingGroupIds);

    const convUpserts = ((groupRows ?? []) as { id: string; name: string; avatar_url: string | null }[]).map((g) => ({
      id: g.id,
      is_group: true,
      name: g.name,
      avatar_url: g.avatar_url ?? null,
    }));

    if (convUpserts.length > 0) {
      await supabaseAdmin
        .from("conversations")
        .upsert(convUpserts, { onConflict: "id", ignoreDuplicates: true });
    }

    // Upsert the missing participant rows so GET /conversations returns them
    const cpUpserts = missingGroupIds.map((id) => ({
      conversation_id: id,
      user_id: effectiveProfileId,
      company_page_id: null as string | null,
    }));

    const { error: backfillErr } = await supabaseAdmin
      .from("conversation_participants")
      .upsert(cpUpserts, { onConflict: "conversation_id,user_id,company_page_id", ignoreDuplicates: true });

    if (backfillErr) {
      req.log.warn({ supabaseError: backfillErr.message }, "[conversations] backfill participants warn");
    }

    missingGroupIds.forEach((id) => existingConvIdSet.add(id));
  }

  if (existingConvIdSet.size === 0) {
    res.json({ conversations: [] });
    return;
  }

  const convIds = [...existingConvIdSet];

  // 2. Conversation metadata + owned companies (parallel).
  // We also query `groups` directly for ALL of the user's group memberships as a
  // reliable fallback — older groups may not have a corresponding `conversations` row.
  const [convosRes, groupsDirectRes, ownedCompaniesRes, allParticipantsRes] = await Promise.all([
    supabaseAdmin
      .from("conversations")
      .select("id, is_group, name, avatar_url, created_at, company_page_id")
      .in("id", convIds),
    memberGroupIds.length > 0
      ? supabaseAdmin
          .from("groups")
          .select("id, name, avatar_url, created_at")
          .in("id", memberGroupIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabaseAdmin
      .from("company_pages")
      .select("id")
      .eq("owner_id", callerId),
    supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds),
  ]);

  // Merge conversations-table rows with any groups not yet present there.
  const convosDataFromTable = (convosRes.data ?? []) as any[];
  const convosInTableSet = new Set<string>(convosDataFromTable.map((c: any) => c.id as string));
  const supplementGroups = ((groupsDirectRes.data ?? []) as any[])
    .filter((g: any) => !convosInTableSet.has(g.id as string))
    .map((g: any) => ({
      id:              g.id as string,
      is_group:        true,
      name:            (g.name as string | null) ?? null,
      avatar_url:      (g.avatar_url as string | null) ?? null,
      created_at:      g.created_at as string,
      company_page_id: null as string | null,
    }));
  const allConvosData: any[] = [...convosDataFromTable, ...supplementGroups];

  // Catch-all: any convId not yet covered — either a group whose conversation row
  // was never created, or a DM that was inserted directly into conversation_participants
  // (e.g. by the mobile app) without a corresponding conversations row.
  const coveredIds = new Set<string>(allConvosData.map((c: any) => c.id as string));
  const uncoveredIds = convIds.filter((id) => !coveredIds.has(id));

  if (uncoveredIds.length > 0) {
    // Try the groups table first — uncovered IDs may be group IDs
    const { data: fallbackGroups } = await supabaseAdmin
      .from("groups")
      .select("id, name, avatar_url, created_at")
      .in("id", uncoveredIds);

    const foundGroupIds = new Set<string>();
    for (const g of (fallbackGroups ?? []) as any[]) {
      foundGroupIds.add(g.id as string);
      allConvosData.push({
        id:              g.id as string,
        is_group:        true,
        name:            (g.name as string | null) ?? null,
        avatar_url:      (g.avatar_url as string | null) ?? null,
        created_at:      g.created_at as string,
        company_page_id: null as string | null,
      });
    }

    // Remaining IDs are DMs whose conversations row doesn't exist yet.
    // Backfill conversations rows immediately (fire-and-forget) so future
    // calls will find them via the normal convosDataFromTable path.
    const orphanDmIds = uncoveredIds.filter((id) => !foundGroupIds.has(id));
    if (orphanDmIds.length > 0) {
      supabaseAdmin
        .from("conversations")
        .upsert(
          orphanDmIds.map((id) => ({ id, is_group: false })),
          { onConflict: "id", ignoreDuplicates: true },
        )
        .then(({ error }) => {
          if (error) req.log.warn({ supabaseError: error.message }, "[conversations] orphan-DM backfill warn");
        });
    }
    // Build minimal entries — participant + last-message data is fetched later
    // from allParticipantsRes / lastMsgResults so these will render correctly.
    for (const id of orphanDmIds) {
      allConvosData.push({
        id,
        is_group:        false,
        name:            null,
        avatar_url:      null,
        created_at:      new Date(0).toISOString(),
        company_page_id: null as string | null,
      });
    }

    req.log.info(
      {
        uncovered: uncoveredIds.length,
        recoveredAsGroups: foundGroupIds.size,
        recoveredAsDMs: orphanDmIds.length,
      },
      "[conversations] catch-all",
    );
  }

  req.log.info(
    {
      convIds_total: convIds.length,
      convosDataFromTable: convosDataFromTable.length,
      supplementGroups: supplementGroups.length,
      catchAll: uncoveredIds.length,
      allConvosData: allConvosData.length,
      memberGroupIds: memberGroupIds.length,
      missingGroupIds: missingGroupIds.length,
    },
    "[conversations] data-build",
  );

  if (allConvosData.length === 0) {
    res.json({ conversations: [] });
    return;
  }

  const ownedCompanyIds = new Set<string>(
    ((ownedCompaniesRes.data ?? []) as { id: string }[]).map((c) => c.id),
  );

  // 3. Build other-participant map (conversation_id → other user_id)
  // Exclude both callerId (auth.uid) and effectiveProfileId (profile.id) so legacy
  // users don't see themselves listed as the "other" participant in their own DMs.
  const callerIdSet = new Set(participantIds);
  const otherParticipantMap = new Map<string, string>();
  for (const row of (allParticipantsRes.data ?? []) as { conversation_id: string; user_id: string }[]) {
    if (!callerIdSet.has(row.user_id)) {
      otherParticipantMap.set(row.conversation_id, row.user_id);
    }
  }

  // 4. Fetch profiles + company pages (parallel)
  const otherUserIds = [...new Set(otherParticipantMap.values())];
  const companyPageIds = [
    ...new Set(
      allConvosData
        .map((c: any) => c.company_page_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];

  const [profilesRes, companyPagesRes] = await Promise.all([
    otherUserIds.length > 0
      ? supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", otherUserIds)
      : Promise.resolve({ data: [] }),
    companyPageIds.length > 0
      ? supabaseAdmin
          .from("company_pages")
          .select("id, owner_id, name, avatar_url")
          .in("id", companyPageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map<string, any>(
    ((profilesRes.data ?? []) as any[]).map((p: any) => [p.id as string, p]),
  );
  const companyPageMap = new Map<string, any>(
    ((companyPagesRes.data ?? []) as any[]).map((c: any) => [c.id as string, c]),
  );

  // 5. Last message per conversation (fan-out in parallel)
  const lastMsgResults = await Promise.all(
    allConvosData.map((convo: any) =>
      supabaseAdmin
        .from("messages")
        .select("content, created_at, message_type, sender_id")
        .eq("conversation_id", convo.id as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );

  // 5b. Batch-fetch sender names for the last message of group conversations.
  // Used by the MiniChatPanel "Grupos" tab to show "SenderName: preview".
  const groupSenderIds = new Set<string>();
  allConvosData.forEach((convo: any, i: number) => {
    if (convo.is_group) {
      const sid = (lastMsgResults[i].data as any)?.sender_id as string | undefined;
      if (sid) groupSenderIds.add(sid);
    }
  });

  const senderNameMap = new Map<string, string>();
  if (groupSenderIds.size > 0) {
    const { data: senderProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", [...groupSenderIds]);
    for (const p of (senderProfiles ?? []) as { id: string; full_name: string | null; username: string | null }[]) {
      senderNameMap.set(p.id, p.full_name ?? p.username ?? "Alguém");
    }
  }

  // 6. Build result array
  const results = allConvosData.map((convo: any, i: number) => {
    const lastMsg = lastMsgResults[i].data as { content: string; created_at: string; message_type: string | null; sender_id: string | null } | null;
    const lastContent =
      lastMsg?.message_type === "image" ? "📷 Foto"
      : lastMsg?.message_type === "video" ? "🎬 Vídeo"
      : lastMsg?.message_type === "audio" ? "🎤 Áudio"
      : lastMsg?.message_type === "file"  ? "📎 Arquivo"
      : (lastMsg?.content ?? null);

    const otherUserId = otherParticipantMap.get(convo.id as string) ?? null;
    const participant = otherUserId ? (profileMap.get(otherUserId) ?? null) : null;
    const cpId = (convo.company_page_id as string | null) ?? null;
    const company_page = cpId ? (companyPageMap.get(cpId) ?? null) : null;

    const lastMsgSenderId = lastMsg?.sender_id ?? null;
    const last_message_sender_name =
      convo.is_group && lastMsgSenderId ? (senderNameMap.get(lastMsgSenderId) ?? null) : null;

    return {
      id:                       convo.id as string,
      is_group:                 convo.is_group as boolean,
      name:                     (convo.name as string | null) ?? null,
      avatar_url:               (convo.avatar_url as string | null) ?? null,
      last_message:             lastContent,
      last_message_at:          lastMsg?.created_at ?? (convo.created_at as string),
      last_message_sender_name,
      unread_count:             0,
      participant,
      company_page_id:          cpId,
      company_page,
    };
  });

  // 6b. Deduplicate DMs: legacy data may have multiple conversation rows for the same
  // user pair. Collapse them into a single thread — keep the most recently active one.
  const dmByParticipant = new Map<string, (typeof results)[0]>();
  const deduped: (typeof results) = [];
  for (const r of results) {
    if (r.is_group) {
      deduped.push(r);
      continue;
    }
    const key = (r.participant as any)?.id ?? `orphan:${r.id}`;
    const existing = dmByParticipant.get(key);
    if (!existing || new Date(r.last_message_at ?? 0) > new Date(existing.last_message_at ?? 0)) {
      dmByParticipant.set(key, r);
    }
  }
  deduped.push(...dmByParticipant.values());

  const sorted = deduped.sort(
    (a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime(),
  );

  // 7. Identity scoping
  // When a specific company is active, show only that company's conversations + groups.
  // In personal mode (no activeCompanyId), show EVERYTHING the user participates in —
  // including conversations accidentally tagged with company_page_id from legacy behavior.
  // Filtering company-tagged DMs out of personal view caused them to silently disappear.
  let filtered = sorted;
  if (activeCompanyId) {
    filtered = sorted.filter((r) => r.is_group || r.company_page_id === activeCompanyId);
  }

  req.log.info(
    {
      callerId,
      effectiveProfileId,
      participantConvCount: existingConvIdSet.size,
      filteredConvCount: filtered.length,
      activeCompanyId: activeCompanyId ?? null,
    },
    "[conversations] list",
  );

  res.json({ conversations: filtered });
});

/**
 * GET /conversations/:id/messages
 *
 * Returns messages for a conversation, fully enriched with sender profiles,
 * company identities, and reactions. Uses supabaseAdmin to bypass the recursive
 * RLS on conversation_participants / messages that blocks direct client queries.
 */
router.get("/conversations/:id/messages", async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const conversationId = req.params.id;

  // Resolve the effective profile.id for this caller (same legacy-profile handling
  // as GET /conversations: participant rows may have been inserted with profile.id
  // instead of auth.uid() when user_id_1 was sourced from profile?.id on the web).
  const { data: callerProfileRow } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .or(`id.eq.${callerId},user_id.eq.${callerId}`)
    .limit(1)
    .maybeSingle();

  const effectiveProfileId = (callerProfileRow as { id: string } | null)?.id ?? callerId;
  const participantIds = [...new Set([callerId, effectiveProfileId])];
  const participantFilter = participantIds.map((id) => `user_id.eq.${id}`).join(",");

  // Verify caller is a participant (check both auth.uid and profile.id)
  const { data: participantRow } = await supabaseAdmin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .or(participantFilter)
    .limit(1)
    .maybeSingle();

  if (!participantRow) {
    res.status(403).json({ error: "Você não é participante desta conversa." });
    return;
  }

  // Fetch messages
  const { data: messages, error: msgError } = await supabaseAdmin
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at, message_type, media_url, from_company_page_id, deleted_at, reply_to_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (msgError || !messages || messages.length === 0) {
    res.json({ messages: [], current_user_id: callerId });
    return;
  }

  const typedMessages = messages as any[];

  // Parallel: sender profiles, company pages, reactions
  const senderIds   = [...new Set(typedMessages.map((m: any) => m.sender_id as string))];
  const cpIds       = [...new Set(typedMessages.map((m: any) => m.from_company_page_id as string | null).filter(Boolean))] as string[];
  const msgIds      = typedMessages.map((m: any) => m.id as string);

  const [profilesRes, cpRes, reactionsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", senderIds),
    cpIds.length > 0
      ? supabaseAdmin.from("company_pages").select("id, name, avatar_url").in("id", cpIds)
      : Promise.resolve({ data: [] }),
    supabaseAdmin.from("message_reactions").select("message_id, user_id, emoji").in("message_id", msgIds),
  ]);

  const profileMap = new Map<string, any>(
    ((profilesRes.data ?? []) as any[]).map((p: any) => [p.id as string, p]),
  );
  const cpMap = new Map<string, any>(
    ((cpRes.data ?? []) as any[]).map((c: any) => [c.id as string, c]),
  );

  // Build reactions map (emoji counts, but defer "mine" flag to client — it knows the userId)
  const reactionsMap: Record<string, { emoji: string; count: number; users: string[] }[]> = {};
  for (const r of (reactionsRes.data ?? []) as { message_id: string; user_id: string; emoji: string }[]) {
    if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
    const ex = reactionsMap[r.message_id].find((x) => x.emoji === r.emoji);
    if (ex) {
      ex.count++;
      ex.users.push(r.user_id);
    } else {
      reactionsMap[r.message_id].push({ emoji: r.emoji, count: 1, users: [r.user_id] });
    }
  }

  const enriched = typedMessages.map((m: any) => ({
    ...m,
    sender:       profileMap.get(m.sender_id as string) ?? null,
    from_company: m.from_company_page_id ? (cpMap.get(m.from_company_page_id as string) ?? null) : null,
    reactions:    reactionsMap[m.id as string] ?? [],
  }));

  res.json({ messages: enriched, current_user_id: callerId });
});

/**
 * DELETE /conversations/:id
 *
 * Removes the caller from a conversation (leaves it). Removes the row(s) from
 * conversation_participants for this user. If the conversation is a group, also
 * removes the user from group_members.
 */
router.delete("/conversations/:id", async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const conversationId = req.params.id;

  // Resolve effective profile ID (same pattern as GET /conversations).
  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .or(`id.eq.${callerId},user_id.eq.${callerId}`)
    .limit(1)
    .maybeSingle();

  const effectiveProfileId: string = profileRow?.id ?? callerId;

  // Remove all participant rows for this user in this conversation.
  const idsToRemove = [...new Set([callerId, effectiveProfileId])];
  const { error: participantError } = await supabaseAdmin
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .in("user_id", idsToRemove);

  if (participantError) {
    req.log.error({ err: participantError }, "leave conversation: participant delete failed");
    res.status(500).json({ error: "Failed to leave conversation" });
    return;
  }

  // If the conversation is a group, remove from group_members too.
  const { data: groupRow } = await supabaseAdmin
    .from("conversations")
    .select("type, group_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (groupRow?.type === "group" && groupRow?.group_id) {
    await supabaseAdmin
      .from("group_members")
      .delete()
      .eq("group_id", groupRow.group_id)
      .in("user_id", idsToRemove);
  }

  res.json({ ok: true });
});

export default router;
