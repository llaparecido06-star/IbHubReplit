import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveUserId } from "../lib/planCheck.js";
import { validateBody } from "../middlewares/validate.js";

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
  if (media_url)            payload.media_url            = media_url;
  if (reply_to_id)          payload.reply_to_id          = reply_to_id;
  if (metadata)             payload.metadata             = metadata;
  if (from_company_page_id) payload.from_company_page_id = from_company_page_id;

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[messages/send] insert error:", JSON.stringify(error));
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ data });
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
    // Return the first matching direct conversation.
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
    console.error("[conversations/direct] insert conversation:", JSON.stringify(convErr));
    res.status(500).json({ error: convErr.message });
    return;
  }

  // Insert BOTH participant rows using supabaseAdmin (no RLS restrictions).
  await supabaseAdmin.from("conversation_participants").insert([
    { conversation_id: newId, user_id: user_id_1, accepted: true },
    { conversation_id: newId, user_id: user_id_2, accepted: recipientAccepted },
  ]);

  res.json({ conversation_id: newId });
});

export default router;
