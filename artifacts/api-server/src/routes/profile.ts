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
    .avatar-wrap{margin-bottom:4px}
    .name{font-size:22px;font-weight:700;color:#0d1b2a;margin-bottom:4px}
    .username{font-size:14px;color:#888;margin-bottom:10px}
    .bio{font-size:14px;color:#555;margin-bottom:24px;line-height:1.5}
    .btn-primary{display:block;background:#c9a84c;color:#fff;font-size:16px;font-weight:600;padding:14px 20px;border-radius:12px;text-decoration:none;margin-bottom:12px;transition:opacity .15s}
    .btn-primary:hover{opacity:.9}
    .divider{display:flex;align-items:center;gap:10px;color:#bbb;font-size:12px;margin-bottom:12px}
    .divider::before,.divider::after{content:"";flex:1;height:1px;background:#e5e5e5}
    .store-row{display:flex;gap:10px;justify-content:center}
    .store-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 8px;border:1.5px solid #ddd;border-radius:10px;text-decoration:none;color:#333;font-size:13px;font-weight:500;transition:background .15s}
    .store-btn:hover{background:#f5f5f5}
    .store-btn svg{flex-shrink:0}
    .loading{display:none;padding:40px 0;color:#888;font-size:15px}
    .spinner{width:36px;height:36px;border:3px solid #eee;border-top-color:#c9a84c;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media(prefers-color-scheme:dark){
      body{background:#0d1b2a}
      .card{background:#1a2a3a;box-shadow:0 4px 24px rgba(0,0,0,.4)}
      .name{color:#f0e6c8}
      .username,.bio{color:#aaa}
      .divider{color:#555}
      .divider::before,.divider::after{background:#2a3a4a}
      .store-btn{border-color:#2a3a4a;color:#ccc;background:#1a2a3a}
      .store-btn:hover{background:#243444}
      .loading{color:#aaa}
      .spinner{border-color:#2a3a4a;border-top-color:#c9a84c}
    }
  </style>
</head>
<body>
  <div class="card" id="main-card">
    <div class="logo">ibhub — Rede do Vinho</div>
    <div class="avatar-wrap">${avatarHtml}</div>
    <div class="name">${name}</div>
    ${username ? `<div class="username">${username}</div>` : ""}
    ${bio ? `<div class="bio">${bio}</div>` : ""}
    <a href="${deepLink}" class="btn-primary" id="open-app-btn">Abrir perfil no ibhub</a>
    <div class="divider">ou baixe o app</div>
    <div class="store-row">
      <a href="${appStoreUrl}" class="store-btn" target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        App Store
      </a>
      <a href="${playStoreUrl}" class="store-btn" target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>
        Google Play
      </a>
    </div>
  </div>
  <div class="card loading" id="loading-card">
    <div class="spinner"></div>
    Abrindo perfil no ibhub...
  </div>
  <script>
    (function(){
      var ua = navigator.userAgent;
      var isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
      var deepLink = "${deepLink}";
      if (isMobile) {
        document.getElementById("main-card").style.display = "none";
        document.getElementById("loading-card").style.display = "block";
        var t = setTimeout(function(){
          document.getElementById("main-card").style.display = "block";
          document.getElementById("loading-card").style.display = "none";
        }, 1800);
        window.addEventListener("visibilitychange", function(){
          if (document.hidden) clearTimeout(t);
        });
        window.location.href = deepLink;
      }
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
