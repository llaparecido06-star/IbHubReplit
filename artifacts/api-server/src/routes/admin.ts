import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { broadcastPushToAllUsers, sendPushToUser } from "../lib/pushUtils.js";

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
    .select("id, full_name, username, plan, courtesy_until, areas_of_expertise, created_at, is_banned, is_shadowbanned, is_admin")
    .in("id", ids)
    .order("created_at", { ascending: false });

  const { data: profiles, error: profErr } = await profileQuery;
  if (profErr) {
    res.status(500).json({ error: profErr.message });
    return;
  }

  const result = ((profiles as Array<Record<string, unknown>>) ?? [])
    .map((p) => ({ ...p, email: userMap.get(p.id as string) ?? null }) as Record<string, unknown> & { email: string | null })
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

router.post("/admin/set-password", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { userId, newPassword } = req.body as { userId?: string; newPassword?: string };
  if (!userId || !newPassword) {
    res.status(400).json({ error: "userId and newPassword are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  // 1. Update password
  const { error: passErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (passErr) {
    res.status(500).json({ error: passErr.message });
    return;
  }

  // 2. Set must_change_password flag in user_metadata so the app forces a change on next login
  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { must_change_password: true },
  });
  if (metaErr) {
    // Non-fatal: password is set, but flag failed — log and continue
    req.log.error({ supabaseError: metaErr.message }, "[set-password] Failed to set must_change_password metadata");
  }

  res.json({ success: true });
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

// Search existing users by email or name (for admin promotion)
router.get("/admin/search-users", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const query = String(req.query.q ?? "").trim().toLowerCase();
  if (!query || query.length < 2) {
    res.json({ users: [] });
    return;
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, username, avatar_url, is_admin")
    .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(10);

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Enrich with email from auth.users
  const ids = (profiles ?? []).map((p: any) => p.id);
  const emailMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authUsers?.users ?? []) emailMap.set(u.id, u.email ?? "");
  }

  // Try email-based search as well (by looking up auth users)
  let extraProfile: any | null = null;
  if (query.includes("@")) {
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const matched = authUsers?.users.find((u) => u.email?.toLowerCase().includes(query));
    if (matched && !ids.includes(matched.id)) {
      const { data: p } = await supabaseAdmin.from("profiles").select("id, full_name, username, avatar_url, is_admin").eq("id", matched.id).maybeSingle();
      if (p) extraProfile = { ...p, email: matched.email ?? null };
    }
  }

  const result = (profiles ?? []).map((p: any) => ({
    ...p,
    email: emailMap.get(p.id) ?? null,
  }));
  if (extraProfile) result.push(extraProfile);

  res.json({ users: result });
});

// Grant admin access to an existing user
router.post("/admin/grant-admin", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { userId } = req.body as { userId?: string };
  if (!userId) { res.status(400).json({ error: "userId is required" }); return; }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_admin: true })
    .eq("id", userId);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

// Revoke admin access from a user
router.post("/admin/revoke-admin", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { userId } = req.body as { userId?: string };
  if (!userId) { res.status(400).json({ error: "userId is required" }); return; }
  if (userId === adminId) { res.status(400).json({ error: "Você não pode revogar o seu próprio acesso." }); return; }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_admin: false })
    .eq("id", userId);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

// Ban or unban a user
router.post("/admin/ban-user", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { userId, ban } = req.body as { userId?: string; ban?: boolean };
  if (!userId || ban === undefined) {
    res.status(400).json({ error: "userId and ban are required" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_banned: ban })
    .eq("id", userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Revoke all active sessions for the user via Supabase Auth
  const banDuration = ban ? "876600h" : "none";
  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: banDuration });
  if (authErr) {
    res.status(500).json({ error: `Auth session revocation failed: ${authErr.message}` });
    return;
  }

  res.json({ success: true });
});

// Shadowban or un-shadowban a user
router.post("/admin/shadowban-user", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { userId, shadowban } = req.body as { userId?: string; shadowban?: boolean };
  if (!userId || shadowban === undefined) {
    res.status(400).json({ error: "userId and shadowban are required" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_shadowbanned: shadowban })
    .eq("id", userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true });
});

// Change a user's plan
router.post("/admin/change-plan", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { userId, plan, isCourtesy } = req.body as { userId?: string; plan?: string; isCourtesy?: boolean };
  if (!userId || !plan) {
    res.status(400).json({ error: "userId and plan are required" });
    return;
  }

  const VALID_PLANS = ["gratuito", "profissional", "basico", "empresa", "executivo"];
  if (!VALID_PLANS.includes(plan)) {
    res.status(400).json({ error: `Invalid plan. Valid values: ${VALID_PLANS.join(", ")}` });
    return;
  }

  const update: Record<string, unknown> = { plan };

  if (isCourtesy === true) {
    // Grant courtesy access for 10 years (effectively permanent until admin revokes)
    const courtesyUntil = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
    update.courtesy_until = courtesyUntil;
  } else if (isCourtesy === false) {
    update.courtesy_until = null;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(update)
    .eq("id", userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true });
});

// Delete a post (content moderation)
router.delete("/admin/posts/:postId", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { postId } = req.params as { postId: string };
  if (!postId) {
    res.status(400).json({ error: "postId is required" });
    return;
  }

  const { error } = await supabaseAdmin.from("posts").delete().eq("id", postId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true });
});

// Toggle pin on a post
router.patch("/admin/posts/:postId/pin", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { postId } = req.params as { postId: string };
  const body = req.body as { is_pinned: boolean };
  if (typeof body.is_pinned !== "boolean") {
    res.status(400).json({ error: "is_pinned (boolean) is required" });
    return;
  }

  const { error } = await supabaseAdmin.from("posts").update({ is_pinned: body.is_pinned }).eq("id", postId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true, is_pinned: body.is_pinned });
});

// List recent posts for moderation
router.get("/admin/posts", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const search = String(req.query.search ?? "").trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id, content, image_url, created_at, user_id, is_pinned")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  type RawPost = { id: string; content: string | null; image_url: string | null; created_at: string; user_id: string };
  const posts = (data ?? []) as RawPost[];
  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds);
  type RawProfile = { id: string; full_name: string | null };
  const nameMap = new Map(((profiles ?? []) as RawProfile[]).map((p) => [p.id, p.full_name]));

  const result = posts.map((p) => ({ ...p, author_name: nameMap.get(p.user_id) ?? null }));
  const filtered = search
    ? result.filter((p) =>
        (p.content ?? "").toLowerCase().includes(search) ||
        (p.author_name ?? "").toLowerCase().includes(search)
      )
    : result;

  res.json({ posts: filtered });
});

// Generate a short-lived signed URL for a private CV in Supabase Storage.
// Caller must be authenticated (any user). RLS on the 'cvs' bucket ensures
// only the file owner or service role can sign — here we use service role
// on behalf of the caller (caller proves identity via JWT).
router.post("/cv/signed-url", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { path, application_id } = req.body as { path?: string; application_id?: string };
  if (!path || typeof path !== "string" || !path.startsWith("cvs/")) {
    res.status(400).json({ error: "Invalid or missing storage path" });
    return;
  }

  const userId = userData.user.id;
  const expectedPrefix = `cvs/${userId}/`;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;

  let authorized = path.startsWith(expectedPrefix) || isAdmin;

  // Recruiter access: caller is opportunity owner or company-page admin
  // for the application that holds this cv_url.
  if (!authorized && application_id) {
    const { data: app } = await supabaseAdmin
      .from("opportunity_applications")
      .select("opportunity_id, cv_url")
      .eq("id", application_id)
      .maybeSingle();
    const appRow = app as { opportunity_id?: string; cv_url?: string | null } | null;
    if (appRow?.opportunity_id) {
      // Confirm the requested path matches the stored cv_url for this application.
      const stored = appRow.cv_url ?? "";
      const storedPath = stored.startsWith("cvs://") ? stored.slice("cvs://".length) : null;
      if (storedPath === path) {
        const { data: opp } = await supabaseAdmin
          .from("opportunities")
          .select("created_by, company_page_id")
          .eq("id", appRow.opportunity_id)
          .maybeSingle();
        const oppRow = opp as { created_by?: string; company_page_id?: string | null } | null;
        if (oppRow?.created_by === userId) {
          authorized = true;
        } else if (oppRow?.company_page_id) {
          const { data: pageOwner } = await supabaseAdmin
            .from("company_pages")
            .select("owner_id")
            .eq("id", oppRow.company_page_id)
            .maybeSingle();
          if ((pageOwner as { owner_id?: string } | null)?.owner_id === userId) {
            authorized = true;
          } else {
            const { data: adminRow } = await supabaseAdmin
              .from("company_page_admins")
              .select("user_id")
              .eq("company_page_id", oppRow.company_page_id)
              .eq("user_id", userId)
              .maybeSingle();
            if (adminRow) authorized = true;
          }
        }
      }
    }
  }

  if (!authorized) {
    res.status(403).json({ error: "Access denied: you cannot access this CV" });
    return;
  }

  const { data, error } = await supabaseAdmin.storage.from("cvs").createSignedUrl(path, 3600);
  if (error || !data) {
    res.status(500).json({ error: "Failed to generate signed URL" });
    return;
  }

  res.json({ signedUrl: data.signedUrl, expiresIn: 3600 });
});

// Broadcast notification (in-app) to segments
router.post("/admin/broadcast-notification", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { title, body, segment } = req.body as { title?: string; body?: string; segment?: string };
  if (!title || !body) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }

  const VALID_SEGMENTS = ["all", "gratuito", "profissional", "basico", "empresa", "executivo"];
  const seg = segment ?? "all";
  if (!VALID_SEGMENTS.includes(seg)) {
    res.status(400).json({ error: `Invalid segment. Valid values: ${VALID_SEGMENTS.join(", ")}` });
    return;
  }

  let query = supabaseAdmin.from("profiles").select("id");
  if (seg !== "all") {
    query = query.eq("plan", seg);
  }

  const { data: recipients, error: recipError } = await query;
  if (recipError || !recipients) {
    res.status(500).json({ error: "Failed to fetch recipients" });
    return;
  }

  const count = recipients.length;
  type Recipient = { id: string };
  const notifs = (recipients as Recipient[]).map((r) => ({
    user_id: r.id,
    type: "broadcast",
    message: `${title}: ${body}`,
    read: false,
  }));

  const BATCH_SIZE = 500;
  const batchErrors: string[] = [];
  for (let i = 0; i < notifs.length; i += BATCH_SIZE) {
    const { error: batchErr } = await supabaseAdmin
      .from("notifications")
      .insert(notifs.slice(i, i + BATCH_SIZE));
    if (batchErr) batchErrors.push(batchErr.message);
  }

  if (batchErrors.length > 0) {
    res.status(500).json({ error: "Failed to insert some notifications", details: batchErrors });
    return;
  }

  const { error: logErr } = await supabaseAdmin.from("notification_broadcasts").insert({
    title,
    body,
    segment: seg,
    sent_at: new Date().toISOString(),
    sent_count: count,
  });

  if (logErr) {
    res.status(500).json({ error: "Notifications sent but failed to log broadcast", details: logErr.message });
    return;
  }

  res.json({ success: true, count, message: `Notificação enviada para ${count} usuário(s).` });
});

// Broadcast push notification to a segment of users
router.post("/admin/broadcast-push", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { title, body, segment, deepLink, logId } = req.body as {
    title?: string;
    body?: string;
    segment?: string;
    deepLink?: string;
    logId?: string;
  };

  if (!title || !body) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }

  // Build query for push tokens based on segment
  let tokenQuery = supabaseAdmin
    .from("push_tokens")
    .select("token, user_id, profiles!inner(plan)")
    .not("token", "is", null);

  // Filter by plan — clients pass either "all" / "Todos os usuários" or a specific plan value.
  // Both English plan keys and Portuguese display labels are accepted; unknown values → 400.
  const planMap: Record<string, string> = {
    "gratuito": "gratuito",
    "basico": "basico",
    "profissional": "profissional",
    "empresarial": "empresarial",
    "premium": "premium",
    // Portuguese display label equivalents (mobile admin screen)
    "Gratuito": "gratuito",
    "Básico": "basico",
    "Profissional": "profissional",
    "Empresarial": "empresarial",
    "Premium": "premium",
  };
  const broadcastAll = !segment || segment === "all" || segment === "Todos os usuários";
  if (!broadcastAll) {
    const planValue = planMap[segment];
    if (!planValue) {
      res.status(400).json({
        error: `Invalid segment "${segment}". Valid values: all, ${Object.keys(planMap).join(", ")}.`,
      });
      return;
    }
    tokenQuery = tokenQuery.eq("profiles.plan", planValue);
  }

  const { data: tokenRows, error: tokenErr } = await tokenQuery;
  if (tokenErr) {
    res.status(500).json({ error: "Failed to fetch push tokens: " + tokenErr.message });
    return;
  }

  const tokens = (tokenRows ?? []).map((r: any) => r.token as string).filter(Boolean);

  if (tokens.length === 0) {
    res.json({ success: true, sent: 0, message: "No tokens found for this segment" });
    return;
  }

  // Send in batches of 100 via Expo push API
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    chunks.push(tokens.slice(i, i + 100));
  }

  let sent = 0;
  for (const chunk of chunks) {
    const messages = chunk.map((token) => ({
      to: token,
      title,
      body,
      sound: "default" as const,
      data: deepLink ? { deepLink } : {},
    }));
    try {
      const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (pushRes.ok) sent += chunk.length;
    } catch {}
  }

  // Mark log entry as sent if logId provided
  if (logId) {
    try {
      await supabaseAdmin
        .from("push_notification_logs")
        .update({ sent_at: new Date().toISOString(), recipients_count: sent })
        .eq("id", logId);
    } catch (_) { /* ignore log update errors */ }
  }

  res.json({ success: true, sent, total: tokens.length });
});

// ─── PUT /admin/presentations/:id/published ───────────────────────────────────
/**
 * Toggles the `published` flag on a market_presentation.
 * When publishing (draft → published), broadcasts a push to all users.
 * Admin-only.
 *
 * Body: { published: boolean }
 */
router.put("/admin/presentations/:id/published", async (req: Request, res: Response): Promise<void> => {
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
    (req.headers.authorization ?? "").replace("Bearer ", ""),
  );

  if (authErr || !user) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle() as { data: { is_admin: boolean } | null };

  if (!profile?.is_admin) {
    res.status(403).json({ error: "Apenas administradores podem alterar o status de publicação." });
    return;
  }

  const { published } = req.body as { published?: boolean };
  if (typeof published !== "boolean") {
    res.status(400).json({ error: "published (boolean) é obrigatório" });
    return;
  }

  const presentationId = req.params.id;

  // Fetch current status to detect the draft → published transition
  const { data: current } = await supabaseAdmin
    .from("market_presentations")
    .select("id, title, published")
    .eq("id", presentationId)
    .maybeSingle() as { data: { id: string; title: string; published: boolean } | null };

  if (!current) {
    res.status(404).json({ error: "Apresentação não encontrada." });
    return;
  }

  const wasPublished = current.published;

  const { error: updateErr } = await supabaseAdmin
    .from("market_presentations")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", presentationId);

  if (updateErr) {
    res.status(500).json({ error: updateErr.message });
    return;
  }

  // Broadcast push only on the draft → published transition
  if (!wasPublished && published) {
    const titleLabel = current.title.length > 60 ? current.title.slice(0, 60) + "…" : current.title;
    void broadcastPushToAllUsers({
      title: "🎬 Nova apresentação disponível!",
      body: titleLabel,
      data: {
        type: "new_presentation",
        presentationId,
        deepLink: "/(tabs)/mercado",
      },
    });
  }

  res.json({ ok: true, published });
});

// ─── GET /admin/users/:id/credits ─────────────────────────────────────────────
/** Returns the current AI search credits state for a user. Admin-only. */
router.get("/admin/users/:id/credits", async (req: Request, res: Response): Promise<void> => {
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
    (req.headers.authorization ?? "").replace("Bearer ", ""),
  );
  if (authErr || !user) { res.status(401).json({ error: "Não autenticado." }); return; }

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("is_admin").eq("id", user.id).maybeSingle() as { data: { is_admin: boolean } | null };
  if (!profile?.is_admin) { res.status(403).json({ error: "Acesso negado." }); return; }

  const { data } = await supabaseAdmin
    .from("ai_search_credits")
    .select("credits_remaining, credits_total")
    .eq("user_id", req.params.id)
    .maybeSingle() as { data: { credits_remaining: number; credits_total: number } | null };

  res.json({ credits_remaining: data?.credits_remaining ?? 0, credits_total: data?.credits_total ?? 0 });
});

// ─── POST /admin/users/:id/credits ────────────────────────────────────────────
/**
 * Manually grants extra AI search credits to a user.
 * Body: { amount: number }  — positive integer, added on top of current remaining.
 * credits_total is also bumped by the same amount so the UI shows the correct quota.
 * Admin-only.
 */
router.post("/admin/users/:id/credits", async (req: Request, res: Response): Promise<void> => {
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
    (req.headers.authorization ?? "").replace("Bearer ", ""),
  );
  if (authErr || !user) { res.status(401).json({ error: "Não autenticado." }); return; }

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("is_admin, full_name").eq("id", user.id).maybeSingle() as { data: { is_admin: boolean; full_name: string | null } | null };
  if (!profile?.is_admin) { res.status(403).json({ error: "Acesso negado." }); return; }

  const { amount } = req.body as { amount?: number };
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount === 0) {
    res.status(400).json({ error: "amount deve ser um inteiro diferente de zero." });
    return;
  }

  const targetId = req.params.id as string;

  const { data: existing } = await supabaseAdmin
    .from("ai_search_credits")
    .select("credits_remaining, credits_total")
    .eq("user_id", targetId)
    .maybeSingle() as { data: { credits_remaining: number; credits_total: number } | null };

  const now = new Date().toISOString();
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  let credits_remaining: number;
  let credits_total: number;

  if (!existing) {
    credits_remaining = Math.max(0, amount);
    credits_total     = Math.max(0, amount);
    await supabaseAdmin.from("ai_search_credits").insert({
      user_id: targetId, credits_remaining, credits_total, period_start: period,
    });
  } else {
    credits_remaining = Math.max(0, existing.credits_remaining + amount);
    credits_total     = Math.max(0, existing.credits_total + amount);
    await supabaseAdmin.from("ai_search_credits")
      .update({ credits_remaining, credits_total, updated_at: now })
      .eq("user_id", targetId);
  }

  // Notify the user about the manual grant
  if (amount > 0) {
    void sendPushToUser({
      userId: targetId,
      title: "🎁 Créditos de IA adicionados!",
      body: `+${amount} crédito${amount === 1 ? "" : "s"} de busca IA adicionado${amount === 1 ? "" : "s"} à sua conta. Total disponível: ${credits_remaining}.`,
      data: { type: "credits_granted", deepLink: "/(tabs)/mercado" },
    });
  }

  res.json({ ok: true, credits_remaining, credits_total });
});

// ─── GET /admin/users/:id/reveal-credits ──────────────────────────────────────
/** Returns the current reveal (financial data) credits for a user. Admin-only. */
router.get("/admin/users/:id/reveal-credits", async (req: Request, res: Response): Promise<void> => {
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
    (req.headers.authorization ?? "").replace("Bearer ", ""),
  );
  if (authErr || !user) { res.status(401).json({ error: "Não autenticado." }); return; }

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("is_admin").eq("id", user.id).maybeSingle() as { data: { is_admin: boolean } | null };
  if (!profile?.is_admin) { res.status(403).json({ error: "Acesso negado." }); return; }

  const { data } = await supabaseAdmin
    .from("bi_reveal_credits")
    .select("credits_remaining, credits_total")
    .eq("user_id", req.params.id)
    .maybeSingle() as { data: { credits_remaining: number; credits_total: number } | null };

  res.json({ credits_remaining: data?.credits_remaining ?? 0, credits_total: data?.credits_total ?? 0 });
});

// ─── POST /admin/users/:id/reveal-credits ─────────────────────────────────────
/**
 * Manually adjusts reveal (financial data) credits for a user.
 * Body: { amount: number } — positive = grant, negative = deduct.
 * Admin-only.
 */
router.post("/admin/users/:id/reveal-credits", async (req: Request, res: Response): Promise<void> => {
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
    (req.headers.authorization ?? "").replace("Bearer ", ""),
  );
  if (authErr || !user) { res.status(401).json({ error: "Não autenticado." }); return; }

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("is_admin").eq("id", user.id).maybeSingle() as { data: { is_admin: boolean } | null };
  if (!profile?.is_admin) { res.status(403).json({ error: "Acesso negado." }); return; }

  const { amount } = req.body as { amount?: number };
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount === 0) {
    res.status(400).json({ error: "amount deve ser um inteiro diferente de zero." });
    return;
  }

  const targetId = req.params.id as string;
  const now = new Date().toISOString();
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  const { data: existing } = await supabaseAdmin
    .from("bi_reveal_credits")
    .select("credits_remaining, credits_total")
    .eq("user_id", targetId)
    .maybeSingle() as { data: { credits_remaining: number; credits_total: number } | null };

  let credits_remaining: number;
  let credits_total: number;

  if (!existing) {
    credits_remaining = Math.max(0, amount);
    credits_total     = Math.max(0, amount);
    await supabaseAdmin.from("bi_reveal_credits").insert({
      user_id: targetId, credits_remaining, credits_total, period_start: period,
    });
  } else {
    credits_remaining = Math.max(0, existing.credits_remaining + amount);
    credits_total     = Math.max(0, existing.credits_total + amount);
    await supabaseAdmin.from("bi_reveal_credits")
      .update({ credits_remaining, credits_total, updated_at: now })
      .eq("user_id", targetId);
  }

  if (amount > 0) {
    void sendPushToUser({
      userId: targetId,
      title: "🎁 Consultas especiais adicionadas!",
      body: `+${amount} consulta${amount === 1 ? "" : "s"} especial${amount === 1 ? "" : "is"} adicionada${amount === 1 ? "" : "s"} à sua conta.`,
      data: { type: "credits_granted", deepLink: "/(tabs)/mercado" },
    });
  }

  res.json({ ok: true, credits_remaining, credits_total });
});

/**
 * DELETE /admin/delete-user
 * Permanently deletes a user account and all associated data.
 * Body: { userId: string }
 * Admin-only. Cannot delete your own account via this endpoint.
 */
router.delete("/admin/delete-user", async (req: Request, res: Response): Promise<void> => {
  const { data: { user: adminUser }, error: authErr } = await supabaseAdmin.auth.getUser(
    (req.headers.authorization ?? "").replace("Bearer ", ""),
  );
  if (authErr || !adminUser) { res.status(401).json({ error: "Não autenticado." }); return; }

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("is_admin").eq("id", adminUser.id).maybeSingle() as { data: { is_admin: boolean } | null };
  if (!profile?.is_admin) { res.status(403).json({ error: "Acesso negado." }); return; }

  const { userId } = req.body as { userId?: string };
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId é obrigatório." });
    return;
  }

  if (userId === adminUser.id) {
    res.status(400).json({ error: "Não é possível deletar sua própria conta pelo painel admin." });
    return;
  }

  const storageWarnings: string[] = [];

  const STORAGE_TARGETS: Array<{ bucket: string; prefix: string }> = [
    { bucket: "avatars",          prefix: userId },
    { bucket: "post-images",      prefix: userId },
    { bucket: "post-videos",      prefix: userId },
    { bucket: "stories",          prefix: userId },
    { bucket: "chat-attachments", prefix: `chat/${userId}` },
    { bucket: "chat-attachments", prefix: `portfolio/${userId}` },
    { bucket: "cvs",              prefix: `cvs/${userId}` },
  ];

  const BUCKET_NOT_FOUND_PATTERNS = ["not found", "does not exist", "The resource was not found"];
  const isBucketMissing = (msg: string) =>
    BUCKET_NOT_FOUND_PATTERNS.some((p) => msg.toLowerCase().includes(p.toLowerCase()));

  async function deleteStoragePrefix(bucket: string, prefix: string): Promise<void> {
    const PAGE = 1000;
    for (;;) {
      const { data: files, error: listErr } = await supabaseAdmin.storage
        .from(bucket).list(prefix, { limit: PAGE, offset: 0 });
      if (listErr) {
        if (isBucketMissing(listErr.message)) break;
        storageWarnings.push(`list ${bucket}/${prefix}: ${listErr.message}`);
        break;
      }
      if (!files || files.length === 0) break;
      const paths = files.map((f: { name: string }) => `${prefix}/${f.name}`);
      const { error: removeErr } = await supabaseAdmin.storage.from(bucket).remove(paths);
      if (removeErr) { storageWarnings.push(`remove ${bucket}/${prefix}: ${removeErr.message}`); break; }
      if (files.length < PAGE) break;
    }
  }

  await Promise.all(
    STORAGE_TARGETS.map(async ({ bucket, prefix }) => {
      try { await deleteStoragePrefix(bucket, prefix); }
      catch (e: unknown) { storageWarnings.push(`${bucket}/${prefix}: ${e instanceof Error ? e.message : String(e)}`); }
    })
  );

  async function deleteTable(table: string, query: () => PromiseLike<{ error: { message: string } | null }>): Promise<string | null> {
    try {
      const { error } = await query();
      return error ? `delete ${table}: ${error.message}` : null;
    } catch (e: unknown) {
      return `delete ${table}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const dbResults = await Promise.all([
    deleteTable("comment_likes",  () => supabaseAdmin.from("comment_likes").delete().eq("user_id", userId)),
    deleteTable("likes",          () => supabaseAdmin.from("likes").delete().eq("user_id", userId)),
    deleteTable("bookmarks",      () => supabaseAdmin.from("bookmarks").delete().eq("user_id", userId)),
    deleteTable("wine_cellar",    () => supabaseAdmin.from("wine_cellar").delete().eq("user_id", userId)),
    deleteTable("post_hidden",    () => supabaseAdmin.from("post_hidden").delete().eq("user_id", userId)),
    deleteTable("user_blocks",    () => supabaseAdmin.from("user_blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)),
    deleteTable("comments",       () => supabaseAdmin.from("comments").delete().eq("user_id", userId)),
    deleteTable("stories",        () => supabaseAdmin.from("stories").delete().eq("user_id", userId)),
    deleteTable("posts",          () => supabaseAdmin.from("posts").delete().eq("user_id", userId)),
    deleteTable("bi_reveal_credits", () => supabaseAdmin.from("bi_reveal_credits").delete().eq("user_id", userId)),
    deleteTable("push_tokens",    () => supabaseAdmin.from("push_tokens").delete().eq("user_id", userId)),
    deleteTable("follows",        () => supabaseAdmin.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`)),
    deleteTable("connections",    () => supabaseAdmin.from("connections").delete().or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)),
    deleteTable("company_pages",  () => supabaseAdmin.from("company_pages").delete().eq("owner_id", userId)),
  ]);
  const dbWarnings = dbResults.filter((w): w is string => w !== null);

  // Delete profile row (must happen before auth deletion to avoid FK violations)
  const { error: profileDelErr } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (profileDelErr) {
    req.log.warn({ err: profileDelErr, targetUserId: userId }, "[admin/deleteUser] profile delete warning (non-fatal)");
  }

  const allWarnings = [...storageWarnings, ...dbWarnings];
  if (allWarnings.length > 0) {
    req.log.error({ warnings: allWarnings, targetUserId: userId }, "[admin/deleteUser] cleanup failures, aborting");
    res.status(500).json({ error: "Falha ao limpar dados do usuário. Tente novamente.", warnings: allWarnings });
    return;
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    req.log.error({ err: deleteError, targetUserId: userId }, "[admin/deleteUser] auth deletion failed");
    res.status(500).json({ error: deleteError.message ?? "Falha ao deletar usuário." });
    return;
  }

  req.log.info({ targetUserId: userId, adminId: adminUser.id }, "[admin/deleteUser] user deleted");
  res.status(200).json({ success: true });
});

/* ─── Company Pages — Market Feed Access ────────────────────────────────── */

/**
 * GET /admin/company-pages
 * Returns all company pages with their can_post_market flag. ADMIN ONLY.
 */
router.get("/admin/company-pages", async (req: Request, res: Response): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const q = (req.query.q as string | undefined)?.trim() ?? "";
  let query = supabaseAdmin
    .from("company_pages")
    .select("id, name, avatar_url, can_post_market, created_at")
    .order("name", { ascending: true });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ companies: data ?? [] });
});

/**
 * PATCH /admin/company-pages/:id/market-access
 * Toggle the can_post_market flag for a company page. ADMIN ONLY.
 * Body: { can_post_market: boolean }
 */
router.patch("/admin/company-pages/:id/market-access", async (req: Request, res: Response): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { can_post_market } = req.body as { can_post_market?: boolean };
  if (typeof can_post_market !== "boolean") {
    res.status(400).json({ error: "can_post_market must be a boolean" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("company_pages")
    .update({ can_post_market })
    .eq("id", req.params.id)
    .select("id, name, can_post_market")
    .maybeSingle();

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Empresa não encontrada" }); return; }
  res.json(data);
});

export default router;
