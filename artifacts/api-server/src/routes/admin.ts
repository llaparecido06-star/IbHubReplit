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
    .select("id, full_name, username, plan, courtesy_until, areas_of_expertise, created_at, is_banned, is_shadowbanned, is_admin")
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
    console.error("[set-password] Failed to set must_change_password metadata:", metaErr.message);
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

  const VALID_PLANS = ["gratuito", "basico", "profissional", "empresarial", "premium"];
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

// List recent posts for moderation
router.get("/admin/posts", async (req: Request, res: Response) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const search = String(req.query.search ?? "").trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id, content, image_url, created_at, user_id")
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

  const { path } = req.body as { path?: string };
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

  if (!path.startsWith(expectedPrefix) && !isAdmin) {
    res.status(403).json({ error: "Access denied: you can only access your own CVs" });
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

  const VALID_SEGMENTS = ["all", "profissional", "empresarial", "premium", "basico"];
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

export default router;
