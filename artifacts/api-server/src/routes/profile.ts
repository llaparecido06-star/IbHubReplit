import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { getCanonicalWebBaseUrl } from "../lib/canonicalUrl.js";

const router: IRouter = Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

router.get("/profile/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const webBaseUrl = process.env.EXPO_PUBLIC_DOMAIN ? getCanonicalWebBaseUrl() : null;

  if (webBaseUrl) {
    res.redirect(302, `${webBaseUrl}/u/${id}`);
    return;
  }

  let name = "Usuário ibhub";
  let username = "";
  let avatarUrl = "";
  let bio = "";

  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("full_name, username, avatar_url, bio")
      .eq("id", id)
      .single();

    if (data) {
      name = data.full_name ?? name;
      username = data.username ? `@${data.username}` : "";
      avatarUrl = data.avatar_url ?? "";
      bio = data.bio ?? "";
    }
  } catch (_) {}

  const deepLink = `ibhub://profile/${id}`;
  const appleAppId = process.env.APPLE_APP_STORE_ID ?? "id000000000";
  const appStoreUrl = `https://apps.apple.com/app/ibhub/${appleAppId}`;
  const playStoreUrl = "https://play.google.com/store/apps/details?id=com.ibhub.app";

  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" alt="${name}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #c9a84c;margin-bottom:12px;" />`
    : `<div style="width:80px;height:80px;border-radius:50%;background:#0d1b2a;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:32px;color:#c9a84c;font-weight:700;border:3px solid #c9a84c;">${name.charAt(0).toUpperCase()}</div>`;

  const webBaseUrl2 = process.env.EXPO_PUBLIC_DOMAIN ? getCanonicalWebBaseUrl() : "https://www.ibhub.com.br";
  const webProfileUrl = `${webBaseUrl2}/u/${id}`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${name} — ibhub</title>
  <meta property="og:title" content="${name} — ibhub"/>
  <meta property="og:description" content="${bio || "Conecte-se na maior rede do vinho do Brasil"}"/>
  ${avatarUrl ? `<meta property="og:image" content="${avatarUrl}"/>` : ""}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f0e8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
    .card{background:#fff;border-radius:20px;padding:32px 24px;max-width:400px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.1)}
    .logo{font-size:13px;color:#c9a84c;font-weight:700;letter-spacing:2px;margin-bottom:24px;text-transform:uppercase}
    .name{font-size:22px;font-weight:700;color:#0d1b2a;margin-bottom:4px}
    .username{font-size:14px;color:#888;margin-bottom:10px}
    .bio{font-size:14px;color:#555;margin-bottom:24px;line-height:1.5}
    .btn-primary{display:block;background:#c9a84c;color:#fff;font-size:16px;font-weight:600;padding:14px 20px;border-radius:12px;text-decoration:none;transition:opacity .15s}
    .btn-primary:hover{opacity:.9}
    @media(prefers-color-scheme:dark){
      body{background:#0d1b2a}
      .card{background:#1a2a3a;box-shadow:0 4px 24px rgba(0,0,0,.4)}
      .name{color:#f0e6c8}
      .username,.bio{color:#aaa}
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ibhub — Rede do Vinho</div>
    <div style="margin-bottom:4px">${avatarHtml}</div>
    <div class="name">${name}</div>
    ${username ? `<div class="username">${username}</div>` : ""}
    ${bio ? `<div class="bio">${bio}</div>` : ""}
    <a href="${webProfileUrl}" class="btn-primary">Ver perfil no ibhub</a>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
