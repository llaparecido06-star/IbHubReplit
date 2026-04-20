import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId, requirePlanFeature } from "../lib/planCheck.js";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * POST /community/groups
 * Creates a new group. Requires "Criar Grupos" plan feature.
 */
router.post("/community/groups", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "Criar Grupos");
  if (!allowed) return;

  const { name, description, category, access, avatar_url } = req.body as {
    name?: string;
    description?: string | null;
    category?: string;
    access?: "aberto" | "fechado" | "restrito";
    avatar_url?: string | null;
  };

  if (!name?.trim() || !category || !access) {
    res.status(400).json({ error: "name, category and access are required" });
    return;
  }

  const { data: group, error } = await supabaseAdmin
    .from("groups")
    .insert({
      owner_id: userId,
      name: name.trim(),
      description: description ?? null,
      category,
      access,
      avatar_url: avatar_url ?? null,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const { error: convErr } = await supabaseAdmin.from("conversations").insert({
    id: group.id,
    is_group: true,
    name: group.name,
    created_at: group.created_at,
  });

  if (convErr) {
    await supabaseAdmin.from("groups").delete().eq("id", group.id);
    res.status(500).json({ error: "Failed to create group conversation" });
    return;
  }

  // Add creator to both conversation_participants (for RLS messaging) and
  // group_members (for member count + "my groups" list) with role "owner"
  await Promise.all([
    supabaseAdmin.from("conversation_participants").upsert(
      { conversation_id: group.id, user_id: userId },
      { onConflict: "conversation_id,user_id", ignoreDuplicates: true }
    ),
    supabaseAdmin.from("group_members").upsert(
      { group_id: group.id, user_id: userId, role: "owner" },
      { onConflict: "group_id,user_id", ignoreDuplicates: true }
    ),
  ]);

  res.status(201).json({ group });
});

/**
 * POST /community/opportunities
 * Creates a new opportunity/vaga. Requires "Publicar Vagas" plan feature.
 */
router.post("/community/opportunities", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "Publicar Vagas");
  if (!allowed) return;

  const {
    type, title, description, category, company, location,
    price, salary, contract_type, contact_email, expires_at,
  } = req.body as {
    type?: "marketplace" | "vaga";
    title?: string;
    description?: string | null;
    category?: string | null;
    company?: string | null;
    location?: string | null;
    price?: string | null;
    salary?: string | null;
    contract_type?: string | null;
    contact_email?: string | null;
    expires_at?: string | null;
  };

  if (!title?.trim() || !type) {
    res.status(400).json({ error: "title and type are required" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("opportunities")
    .insert({
      created_by: userId,
      type,
      title: title.trim(),
      description: description ?? null,
      category: category ?? null,
      company: company ?? null,
      location: location ?? null,
      price: price ?? null,
      salary: salary ?? null,
      contract_type: contract_type ?? null,
      contact_email: contact_email ?? null,
      expires_at: expires_at ?? null,
      is_active: true,
    })
    .select("id, type, title, description, category, company, location, price, salary, contract_type, contact_email, expires_at, created_at, created_by, is_active")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ opportunity: data });
});

/**
 * POST /community/companies
 * Creates a new company page. Requires "Criar Página Empresa" plan feature.
 */
router.post("/community/companies", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const allowed = await requirePlanFeature(req, res, userId, "Criar Página Empresa");
  if (!allowed) return;

  const { name, username, bio, website, industry, location } = req.body as {
    name?: string;
    username?: string | null;
    bio?: string | null;
    website?: string | null;
    industry?: string | null;
    location?: string | null;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("company_pages")
    .insert({
      owner_id: userId,
      name: name.trim(),
      username: username ?? null,
      bio: bio ?? null,
      website: website ?? null,
      industry: industry ?? null,
      location: location ?? null,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ company: data });
});

/**
 * POST /community/groups/:id/notify-request
 * Sends a "join request" notification to the group owner using the service role key
 * (bypasses the v50 RLS policy that blocks direct client-side notification inserts).
 * Body: { requester_name: string }
 */
router.post("/community/groups/:id/notify-request", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const groupId = req.params.id as string;

  // Fetch the group to get owner_id and name
  const { data: group, error: groupErr } = await supabaseAdmin
    .from("groups")
    .select("owner_id, name, access")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr || !group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (group.access !== "fechado") {
    res.status(400).json({ error: "Notifications are only sent for closed (fechado) groups" });
    return;
  }

  if (group.owner_id === userId) {
    res.status(200).json({ ok: true, skipped: "owner cannot request to join their own group" });
    return;
  }

  const { error: notifErr } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id:  group.owner_id,
      actor_id: userId,
      type:     "group_request",
      message:  `solicitou participação no grupo "${group.name}"`,
      metadata: { group_id: groupId },
    });

  if (notifErr) {
    console.error("notify-request insert:", notifErr);
    res.status(500).json({ error: notifErr.message });
    return;
  }

  res.status(200).json({ ok: true });
});

/**
 * POST /community/groups/:id/members/:userId/approve
 * Admin approves a pending join request: promotes role to "member" and adds
 * the user to conversation_participants so they can see the group chat.
 */
router.post("/community/groups/:id/members/:userId/approve", async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const groupId    = req.params.id as string;
  const memberId   = req.params.userId as string;

  // Verify the caller is the group owner
  const { data: group, error: groupErr } = await supabaseAdmin
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr || !group) { res.status(404).json({ error: "Group not found" }); return; }
  if (group.owner_id !== callerId) { res.status(403).json({ error: "Only the group owner can approve members" }); return; }

  // Promote to member
  const { error: updateErr } = await supabaseAdmin
    .from("group_members")
    .update({ role: "member" })
    .eq("group_id", groupId)
    .eq("user_id", memberId)
    .eq("role", "pending");

  if (updateErr) { res.status(500).json({ error: updateErr.message }); return; }

  // Grant chat access
  const { error: cpErr } = await supabaseAdmin
    .from("conversation_participants")
    .upsert(
      { conversation_id: groupId, user_id: memberId },
      { onConflict: "conversation_id,user_id,company_page_id", ignoreDuplicates: true }
    );
  if (cpErr) console.warn("approve — conversation_participants:", cpErr.message);

  res.status(200).json({ ok: true });
});

/**
 * DELETE /community/groups/:id/members/:userId/reject
 * Admin rejects a pending join request: removes the pending group_members row.
 */
router.delete("/community/groups/:id/members/:userId/reject", async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const groupId  = req.params.id as string;
  const memberId = req.params.userId as string;

  // Verify the caller is the group owner
  const { data: group, error: groupErr } = await supabaseAdmin
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr || !group) { res.status(404).json({ error: "Group not found" }); return; }
  if (group.owner_id !== callerId) { res.status(403).json({ error: "Only the group owner can reject members" }); return; }

  const { error: deleteErr } = await supabaseAdmin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId)
    .eq("role", "pending");

  if (deleteErr) { res.status(500).json({ error: deleteErr.message }); return; }

  res.status(200).json({ ok: true });
});

export default router;
