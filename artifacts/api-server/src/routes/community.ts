import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { resolveUserId, requirePlanFeature } from "../lib/planCheck.js";
import { sendPushToUser } from "../lib/pushUtils.js";

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

  // Pre-generate a shared UUID for both the group and its conversation.
  // The conversation MUST be created first so the auto_add_group_owner trigger
  // (which inserts into conversation_participants) satisfies the FK constraint.
  const groupId = randomUUID();

  const { error: convErr } = await supabaseAdmin.from("conversations").insert({
    id: groupId,
    is_group: true,
    name: name.trim(),
    created_at: new Date().toISOString(),
  });

  if (convErr) {
    req.log.error({ err: convErr, groupId }, "Failed to create group conversation");
    res.status(500).json({ error: `Failed to create group conversation: ${convErr.message}` });
    return;
  }

  const { data: group, error } = await supabaseAdmin
    .from("groups")
    .insert({
      id: groupId,
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
    req.log.error({ err: error, groupId }, "Failed to create group row");
    // Roll back the conversation
    await supabaseAdmin.from("conversations").delete().eq("id", groupId);
    res.status(500).json({ error: error.message });
    return;
  }

  // Manually add the owner to group_members and conversation_participants.
  // We do this in the API instead of relying on the DB trigger so the operation
  // works even if the trigger or ON CONFLICT constraint has not been migrated yet.
  // onConflict must reference the exact 3-column constraint
  // UNIQUE NULLS NOT DISTINCT (group_id, user_id, company_page_id).
  // ignoreDuplicates must be false (the default) so that if the DB trigger already
  // inserted this user with role='admin' (legacy), the upsert UPDATES it to 'owner'.
  await supabaseAdmin.from("group_members").upsert(
    { group_id: groupId, user_id: userId, role: "owner", company_page_id: null },
    { onConflict: "group_id,user_id,company_page_id" },
  );
  // onConflict must reference the exact 3-column constraint
  // UNIQUE NULLS NOT DISTINCT (conversation_id, user_id, company_page_id).
  await supabaseAdmin.from("conversation_participants").upsert(
    { conversation_id: groupId, user_id: userId, company_page_id: null },
    { onConflict: "conversation_id,user_id,company_page_id", ignoreDuplicates: true },
  );

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

  // Authorization: only company-backed profiles (or admins) may publish.
  // Mirrors the client-side `canPublish` gate in OportunidadesPage so a
  // personal user cannot bypass the UI by calling the endpoint directly.
  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (!profileRow?.is_admin) {
    const { count: companyCount, error: companyErr } = await supabaseAdmin
      .from("company_pages")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    if (companyErr) {
      req.log.error({ err: companyErr, userId }, "failed to verify company ownership");
      res.status(500).json({ error: "failed to verify company ownership" });
      return;
    }

    if (!companyCount) {
      res.status(403).json({
        error: "company_required",
        message: "Apenas perfis empresariais podem publicar oportunidades. Crie uma página de empresa antes de continuar.",
      });
      return;
    }
  }

  const {
    type, title, description, category, company, company_page_id, location,
    price, salary, contract_type, contact_email, expires_at, cover_image_url,
  } = req.body as {
    type?: "marketplace" | "vaga";
    title?: string;
    description?: string | null;
    category?: string | null;
    company?: string | null;
    company_page_id?: string | null;
    location?: string | null;
    price?: string | null;
    salary?: string | null;
    contract_type?: string | null;
    contact_email?: string | null;
    expires_at?: string | null;
    cover_image_url?: string | null;
  };

  if (!title?.trim() || !type) {
    res.status(400).json({ error: "title and type are required" });
    return;
  }

  // Validate that the caller owns or admins the company page they want to publish under.
  let resolvedCompanyPageId: string | null = null;
  if (company_page_id) {
    const { data: cp, error: cpErr } = await supabaseAdmin
      .from("company_pages")
      .select("id, owner_id")
      .eq("id", company_page_id)
      .maybeSingle();
    if (cpErr || !cp) {
      res.status(400).json({ error: "company_page_not_found" });
      return;
    }

    let allowed = cp.owner_id === userId || !!profileRow?.is_admin;
    if (!allowed) {
      const { data: adminRow } = await supabaseAdmin
        .from("company_page_admins")
        .select("user_id")
        .eq("company_id", company_page_id)
        .eq("user_id", userId)
        .maybeSingle();
      allowed = !!adminRow;
    }

    if (!allowed) {
      res.status(403).json({ error: "not_company_admin" });
      return;
    }
    resolvedCompanyPageId = company_page_id;
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
      company_page_id: resolvedCompanyPageId,
      location: location ?? null,
      price: price ?? null,
      salary: salary ?? null,
      contract_type: contract_type ?? null,
      contact_email: contact_email ?? null,
      expires_at: expires_at ?? null,
      cover_image_url: cover_image_url ?? null,
      is_active: true,
    })
    .select("id, type, title, description, category, company, company_page_id, location, price, salary, contract_type, contact_email, expires_at, cover_image_url, created_at, created_by, is_active")
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
 * POST /community/opportunities/:id/apply
 * Inserts an `opportunity_applications` row and a recipient notification.
 * If the opportunity is owned by a company page (`opportunities.company_page_id`),
 * the notification is routed to the company inbox via `target_company_id`
 * (and `user_id` = company owner). Otherwise it's a personal notification.
 *
 * Body: { cv_url?: string|null, message?: string|null }
 */
router.post("/community/opportunities/:id/apply", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const opportunityId = req.params.id as string;
  const { cv_url, message } = req.body as { cv_url?: string | null; message?: string | null };

  const { data: opp, error: oppErr } = await supabaseAdmin
    .from("opportunities")
    .select("id, created_by, title, company_page_id")
    .eq("id", opportunityId)
    .maybeSingle();

  if (oppErr || !opp) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  const { error: appErr } = await supabaseAdmin
    .from("opportunity_applications")
    .insert({
      opportunity_id: opportunityId,
      applicant_id: userId,
      cv_url: cv_url ?? null,
      message: message ?? null,
    });

  if (appErr) {
    // 23505 = unique violation (already applied) — treat as idempotent success
    if (appErr.code !== "23505") {
      req.log.error({ err: appErr, opportunityId, userId }, "applyToJob insert failed");
      res.status(500).json({ error: appErr.message });
      return;
    }
  }

  // Don't notify if applicant is the opportunity creator
  if (opp.created_by !== userId) {
    let recipientUserId: string = opp.created_by;
    let targetCompanyId: string | null = null;

    if (opp.company_page_id) {
      const { data: company } = await supabaseAdmin
        .from("company_pages")
        .select("owner_id")
        .eq("id", opp.company_page_id)
        .maybeSingle();
      if (company?.owner_id) {
        recipientUserId = company.owner_id as string;
        targetCompanyId = opp.company_page_id;
      }
    }

    const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
      user_id: recipientUserId,
      actor_id: userId,
      type: "application",
      opportunity_id: opportunityId,
      message: `se candidatou à vaga "${opp.title}"`,
      target_company_id: targetCompanyId,
    });
    if (notifErr) {
      req.log.warn({ err: notifErr, opportunityId, userId }, "applyToJob notification insert failed");
    }

    // Push — fetch applicant name and fire-and-forget
    void (async () => {
      const { data: applicantProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, username")
        .eq("id", userId)
        .maybeSingle();

      const applicantName =
        (applicantProfile as { full_name?: string; username?: string } | null)?.full_name ??
        (applicantProfile as { full_name?: string; username?: string } | null)?.username ??
        "Alguém";

      await sendPushToUser({
        userId: recipientUserId,
        title: `💼 Nova candidatura — ${opp.title as string}`,
        body: `${applicantName} se candidatou à sua vaga. Toque para ver o perfil.`,
        data: {
          type: "application",
          opportunityId,
          deepLink: `/opportunity/${opportunityId}`,
        },
      });
    })();
  }

  res.status(200).json({ ok: true });
});

/**
 * POST /community/opportunities/:id/interest
 * Records a marketplace interest as a notification (mobile pattern; the
 * `interests_count` trigger reads from `notifications`). If the opportunity is
 * owned by a company page, routes to the company inbox via `target_company_id`.
 * Idempotent: skips when an interest notification already exists for this actor.
 *
 * Body: { } (none required)
 */
router.post("/community/opportunities/:id/interest", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const opportunityId = req.params.id as string;

  const { data: opp, error: oppErr } = await supabaseAdmin
    .from("opportunities")
    .select("id, created_by, title, company_page_id")
    .eq("id", opportunityId)
    .maybeSingle();

  if (oppErr || !opp) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  if (opp.created_by === userId) {
    res.status(200).json({ ok: true, skipped: "creator cannot express interest in own opportunity" });
    return;
  }

  // Dedupe: check for existing interest notification from this actor
  const { data: existing } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("type", "interest")
    .eq("opportunity_id", opportunityId)
    .eq("actor_id", userId)
    .maybeSingle();

  if (existing) {
    res.status(200).json({ ok: true, deduped: true });
    return;
  }

  let recipientUserId: string = opp.created_by;
  let targetCompanyId: string | null = null;

  if (opp.company_page_id) {
    const { data: company } = await supabaseAdmin
      .from("company_pages")
      .select("owner_id")
      .eq("id", opp.company_page_id)
      .maybeSingle();
    if (company?.owner_id) {
      recipientUserId = company.owner_id as string;
      targetCompanyId = opp.company_page_id;
    }
  }

  const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
    user_id: recipientUserId,
    actor_id: userId,
    type: "interest",
    opportunity_id: opportunityId,
    message: `tem interesse no seu anúncio "${opp.title}"`,
    target_company_id: targetCompanyId,
  });

  if (notifErr) {
    req.log.error({ err: notifErr, opportunityId, userId }, "expressInterest notification insert failed");
    res.status(500).json({ error: notifErr.message });
    return;
  }

  res.status(200).json({ ok: true });
});

/**
 * POST /community/groups/:id/request-join
 * Full "request to join closed group" flow using service role key, so it works
 * regardless of the RLS policy applied to group_members on any environment.
 * 1. Checks if already pending / already a member.
 * 2. Inserts a pending row in group_members.
 * 3. Sends a group_request notification to the group owner.
 * Returns: { status: "ok" | "already_pending" | "already_member" }
 */
router.post("/community/groups/:id/request-join", async (req: Request, res: Response): Promise<void> => {
  const userId = await resolveUserId(req, res);
  if (!userId) return;

  const groupId = req.params.id as string;
  const { company_page_id: cpId = null } = req.body as { company_page_id?: string | null };

  // Fetch group info
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
    res.status(400).json({ error: "request-join only applies to fechado groups" });
    return;
  }

  // Check for existing membership / pending request
  const existing = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.data) {
    const status = existing.data.role === "pending" ? "already_pending" : "already_member";
    res.status(200).json({ status });
    return;
  }

  // Insert pending row via service role (bypasses RLS)
  const { error: insertErr } = await supabaseAdmin
    .from("group_members")
    .insert({ group_id: groupId, user_id: userId, role: "pending", company_page_id: cpId });

  if (insertErr) {
    const isConstraint = insertErr.message?.includes("role_check");
    req.log.error({ supabaseError: insertErr.message, isConstraint }, "request-join insert failed");
    if (isConstraint) {
      res.status(500).json({
        error: "role_constraint",
        hint: "Run migration v74_fix_role_constraint_and_trigger.sql from artifacts/ibhub/supabase/ in the Supabase SQL editor.",
      });
    } else {
      res.status(500).json({ error: insertErr.message });
    }
    return;
  }

  // Owner cannot receive a request about themselves
  if (group.owner_id === userId) {
    res.status(200).json({ status: "ok" });
    return;
  }

  // Send notification to admin (fire-and-forget so insert errors don't block the response)
  void (async () => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle();

    const requesterName =
      (profile as { full_name?: string; username?: string } | null)?.full_name ??
      (profile as { full_name?: string; username?: string } | null)?.username ??
      "Alguém";

    await supabaseAdmin.from("notifications").insert({
      user_id:  group.owner_id,
      actor_id: userId,
      type:     "group_request",
      message:  `solicitou participação no grupo "${group.name as string}"`,
      metadata: { group_id: groupId },
    });

    await sendPushToUser({
      userId: group.owner_id as string,
      title: `👥 Solicitação para entrar em ${group.name as string}`,
      body: `${requesterName} quer participar do grupo. Toque para aprovar ou recusar.`,
      data: { type: "group_request", groupId, deepLink: `/group-settings/${groupId}` },
    });
  })();

  res.status(200).json({ status: "ok" });
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
    req.log.error({ supabaseError: notifErr.message }, "notify-request insert");
    res.status(500).json({ error: notifErr.message });
    return;
  }

  // Push notification — fetch requester name first, then fire-and-forget
  void (async () => {
    const { data: requesterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle();

    const requesterName =
      (requesterProfile as { full_name?: string; username?: string } | null)?.full_name ??
      (requesterProfile as { full_name?: string; username?: string } | null)?.username ??
      "Alguém";

    await sendPushToUser({
      userId: group.owner_id as string,
      title: `👥 Solicitação para entrar em ${group.name as string}`,
      body: `${requesterName} quer participar do grupo. Toque para aprovar ou recusar.`,
      data: {
        type: "group_request",
        groupId,
        deepLink: `/group-settings/${groupId}`,
      },
    });
  })();

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

  // Verify the caller is the group owner or a moderator
  const [{ data: group, error: groupErr }, { data: callerMem }] = await Promise.all([
    supabaseAdmin.from("groups").select("owner_id, name").eq("id", groupId).maybeSingle(),
    supabaseAdmin.from("group_members").select("role").eq("group_id", groupId).eq("user_id", callerId).maybeSingle(),
  ]);

  if (groupErr || !group) { res.status(404).json({ error: "Group not found" }); return; }
  const callerRole = callerMem?.role as string | undefined;
  const canManage = group.owner_id === callerId || callerRole === "owner" || callerRole === "moderator";
  if (!canManage) { res.status(403).json({ error: "Only group owners and moderators can approve members" }); return; }

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
  if (cpErr) req.log.warn({ supabaseError: cpErr.message }, "approve — conversation_participants");

  // Notify the approved user (fire-and-forget)
  void (async () => {
    const { data: groupInfo } = await supabaseAdmin
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .maybeSingle();

    const groupName = (groupInfo as { name?: string } | null)?.name ?? "grupo";

    await supabaseAdmin.from("notifications").insert({
      user_id:  memberId,
      actor_id: callerId,
      type:     "group_approved",
      message:  `aprovou sua entrada no grupo "${groupName}"`,
      metadata: { group_id: groupId },
    });

    await sendPushToUser({
      userId: memberId,
      title: `✅ Solicitação aprovada`,
      body: `Você foi aceito no grupo ${groupName}. Acesse o chat agora!`,
      data: { type: "group_approved", groupId, deepLink: `/grupos/${groupId}` },
    });
  })();

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

  // Verify the caller is the group owner or a moderator
  const [{ data: group, error: groupErr }, { data: callerMem }] = await Promise.all([
    supabaseAdmin.from("groups").select("owner_id").eq("id", groupId).maybeSingle(),
    supabaseAdmin.from("group_members").select("role").eq("group_id", groupId).eq("user_id", callerId).maybeSingle(),
  ]);

  if (groupErr || !group) { res.status(404).json({ error: "Group not found" }); return; }
  const callerRole = callerMem?.role as string | undefined;
  const canManage = group.owner_id === callerId || callerRole === "owner" || callerRole === "moderator";
  if (!canManage) { res.status(403).json({ error: "Only group owners and moderators can reject members" }); return; }

  const { error: deleteErr } = await supabaseAdmin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId)
    .eq("role", "pending");

  if (deleteErr) { res.status(500).json({ error: deleteErr.message }); return; }

  res.status(200).json({ ok: true });
});

/**
 * POST /community/groups/:id/invite
 * Admin/moderator invites a user directly into a group (any access type).
 * Uses service role to bypass RLS — the client cannot write group_members
 * rows for other users or conversation_participants rows on their behalf.
 */
router.post("/community/groups/:id/invite", async (req: Request, res: Response): Promise<void> => {
  const callerId = await resolveUserId(req, res);
  if (!callerId) return;

  const groupId  = req.params.id as string;
  const { user_id: targetUserId } = req.body as { user_id?: string };

  if (!targetUserId) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }

  // Verify caller is owner or moderator
  const [{ data: group, error: groupErr }, { data: callerMem }] = await Promise.all([
    supabaseAdmin.from("groups").select("owner_id, name").eq("id", groupId).maybeSingle(),
    supabaseAdmin.from("group_members").select("role").eq("group_id", groupId).eq("user_id", callerId).maybeSingle(),
  ]);

  if (groupErr || !group) { res.status(404).json({ error: "Group not found" }); return; }
  const callerRole = callerMem?.role as string | undefined;
  const canManage = (group as any).owner_id === callerId || callerRole === "owner" || callerRole === "moderator" || callerRole === "admin";
  if (!canManage) { res.status(403).json({ error: "Only group owners and moderators can invite members" }); return; }

  // Check if already a member
  const { data: existing } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", targetUserId)
    .is("company_page_id", null)
    .maybeSingle();

  if (existing && existing.role !== "pending") {
    res.status(200).json({ ok: true, status: "already_member" });
    return;
  }

  // Upsert membership with service role (bypasses RLS)
  const { error: gmErr } = await supabaseAdmin
    .from("group_members")
    .upsert(
      { group_id: groupId, user_id: targetUserId, role: "member", company_page_id: null },
      { onConflict: "group_id,user_id,company_page_id" },
    );

  if (gmErr) { res.status(500).json({ error: gmErr.message }); return; }

  // Grant chat access with service role (bypasses RLS)
  const { error: cpErr } = await supabaseAdmin
    .from("conversation_participants")
    .upsert(
      { conversation_id: groupId, user_id: targetUserId, company_page_id: null },
      { onConflict: "conversation_id,user_id,company_page_id", ignoreDuplicates: true },
    );

  if (cpErr) req.log.warn({ supabaseError: cpErr.message }, "invite — conversation_participants");

  // Notify the invited user (fire-and-forget)
  void (async () => {
    const groupName = (group as any).name ?? "grupo";
    await supabaseAdmin.from("notifications").insert({
      user_id:  targetUserId,
      actor_id: callerId,
      type:     "group_invite",
      message:  `convidou você para o grupo "${groupName}"`,
      metadata: { group_id: groupId },
    });

    await sendPushToUser({
      userId: targetUserId,
      title: `👥 Convite para grupo`,
      body: `Você foi convidado para participar do grupo ${groupName}.`,
      data: { type: "group_invite", groupId, deepLink: `/group-chat/${groupId}` },
    });
  })();

  res.status(200).json({ ok: true, status: "invited" });
});

export default router;
