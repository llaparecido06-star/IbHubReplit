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

  await supabaseAdmin.from("conversation_participants").insert({
    conversation_id: group.id,
    user_id: userId,
  });

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

export default router;
