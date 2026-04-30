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
