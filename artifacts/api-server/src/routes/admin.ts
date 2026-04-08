import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
  throw new Error(
    "Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and/or EXPO_PUBLIC_SUPABASE_ANON_KEY"
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return null;
  }
  const token = authHeader.slice(7);
  const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  const userId = userData.user.id;
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr || !profile || !(profile as { is_admin: boolean }).is_admin) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return userId;
}

router.get("/admin/users", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const search = String(req.query.search ?? "").trim();

  const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
    perPage: limit,
  });
  if (authErr) {
    res.status(500).json({ error: authErr.message });
    return;
  }

  const userMap = new Map(
    authUsers.users.map((u) => [u.id, u.email ?? null])
  );
  const ids = authUsers.users.map((u) => u.id);

  let profileQuery = supabaseAdmin
    .from("profiles")
    .select("id, full_name, username, plan, areas_of_expertise, created_at, is_banned, is_shadowbanned")
    .in("id", ids)
    .order("created_at", { ascending: false });

  const { data: profiles, error: profErr } = await profileQuery;
  if (profErr) {
    res.status(500).json({ error: profErr.message });
    return;
  }

  const result = ((profiles as Array<Record<string, unknown>>) ?? [])
    .map((p) => ({ ...p, email: userMap.get(p.id as string) ?? null }))
    .filter((p) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        String(p.full_name ?? "").toLowerCase().includes(s) ||
        String(p.username ?? "").toLowerCase().includes(s) ||
        String(p.email ?? "").toLowerCase().includes(s)
      );
    });

  res.json({ users: result });
});

router.post("/admin/reset-password", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: await (async () => {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
      return u?.user?.email ?? "";
    })(),
  });

  if (error || !data?.properties?.action_link) {
    res.status(500).json({ error: error?.message ?? "Could not generate reset link" });
    return;
  }

  res.json({ resetLink: data.properties.action_link });
});

router.get("/admin/user-by-email", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const email = String(req.query.email ?? "").trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: "email query param is required" });
    return;
  }

  const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) {
    res.status(500).json({ error: authErr.message });
    return;
  }

  const found = authUsers.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!found) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, username, plan, courtesy_until")
    .eq("id", found.id)
    .maybeSingle();

  res.json({ user: { ...profile, email: found.email } });
});

router.get("/admin/admin-list", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .eq("is_admin", true)
    .order("full_name", { ascending: true });

  if (profErr) {
    res.status(500).json({ error: profErr.message });
    return;
  }

  const adminProfiles = (profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  }>;

  const emailMap = new Map<string, string | null>();
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const { data: authPage, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page });
    if (authErr) {
      res.status(500).json({ error: authErr.message });
      return;
    }
    for (const u of authPage.users) emailMap.set(u.id, u.email ?? null);
    hasMore = authPage.users.length === 1000;
    page += 1;
  }

  const result = adminProfiles.map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? null,
  }));

  res.json({ admins: result });
});

router.post("/admin/create-admin", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { fullName, email, password } = req.body as {
    fullName?: string;
    email?: string;
    password?: string;
  };

  if (!fullName || !email || !password) {
    res.status(400).json({ error: "fullName, email and password are required" });
    return;
  }

  const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim() },
  });

  if (createErr || !createData?.user) {
    res.status(500).json({ error: createErr?.message ?? "Failed to create user" });
    return;
  }

  const newUserId = createData.user.id;

  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: newUserId, full_name: fullName.trim(), is_admin: true }, { onConflict: "id" });

  if (profileErr) {
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    res.status(500).json({ error: "Failed to set admin flag; user creation rolled back: " + profileErr.message });
    return;
  }

  res.json({ success: true, userId: newUserId });
});

export default router;
