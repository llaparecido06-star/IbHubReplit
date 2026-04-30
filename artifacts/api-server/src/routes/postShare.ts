/**
 * Server-side rendering shim for `/post/:id`.
 *
 * The web SPA owns the visible page, but link unfurlers (WhatsApp, iMessage,
 * Twitter, LinkedIn, Slack) request the URL without running JavaScript and
 * therefore only see the default OpenGraph tags from `index.html`. This route
 * fetches the post once on the server, injects per-post `og:`/`twitter:` tags
 * into the same shell, and serves it. Real users still get the SPA hydrating
 * exactly as before — they just receive the enriched `<head>`.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";
import { getCanonicalWebBaseUrl } from "../lib/canonicalUrl.js";
import { buildPostMeta, escapeHtmlAttr, injectPostMeta, type PostMeta } from "../lib/postShareMeta.js";

const router: IRouter = Router();

const supabaseUrl = process.env["EXPO_PUBLIC_SUPABASE_URL"];
const supabaseServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const POST_ID_RE = /^[a-zA-Z0-9_-]{6,64}$/;

// Cache the index.html shell in production: it's a static file written once
// at build time and re-read on every share request would be wasteful. In dev
// we always refetch so we pick up template edits on the fly.
let cachedShell: string | null = null;

async function loadIndexHtmlShell(): Promise<string> {
  if (process.env["NODE_ENV"] === "production" && cachedShell) {
    return cachedShell;
  }

  // Production / static-served web: read from the built artifact directory.
  const builtPath = path.resolve(process.cwd(), "artifacts/web/dist/public/index.html");
  try {
    const html = await fs.readFile(builtPath, "utf-8");
    if (process.env["NODE_ENV"] === "production") cachedShell = html;
    return html;
  } catch {
    // Dev: web is served by Vite. Fetch its index.html via the loopback
    // shared proxy so we don't need to know the per-port assignment.
    const port = process.env["WEB_DEV_PORT"] ?? "22333";
    const res = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: "text/html" },
    });
    if (!res.ok) {
      throw new Error(`Failed to load web index.html (status ${res.status})`);
    }
    return await res.text();
  }
}

/**
 * Fallback HTML used when the web shell is unavailable. Still surfaces the
 * per-post OpenGraph tags so link previews work even if static assets are
 * down. Avoids any meta-refresh: this response is served at the same URL as
 * the SPA, so refreshing back to the same URL would loop a real user. The
 * body just shows a plain link/CTA pointing at the home page.
 */
function fallbackHtml(meta: PostMeta, baseUrl: string): string {
  const t = escapeHtmlAttr(meta.title);
  const d = escapeHtmlAttr(meta.description);
  const i = escapeHtmlAttr(meta.image);
  const u = escapeHtmlAttr(meta.url);
  const home = escapeHtmlAttr(baseUrl.replace(/\/+$/, "") + "/");
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${u}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${i}" />
    <meta property="og:locale" content="pt_BR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${i}" />
  </head>
  <body>
    <p>${t}</p>
    <p><a href="${home}">Abrir ibhub</a></p>
  </body>
</html>`;
}

async function fetchPostForShare(id: string): Promise<Parameters<typeof buildPostMeta>[0] | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id, content, image_url, image_urls, poll, user_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  let author: { full_name?: string | null } | null = null;
  if (data.user_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.user_id)
      .maybeSingle();
    if (profile) author = { full_name: profile.full_name ?? null };
  }

  return {
    id: data.id as string,
    content: data.content as string | null,
    image_url: data.image_url as string | null,
    image_urls: data.image_urls as string[] | null,
    poll: data.poll as Parameters<typeof buildPostMeta>[0]["poll"],
    author,
  };
}

router.get("/post/:id", async (req: Request, res: Response): Promise<void> => {
  const rawId = req.params["id"];
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  res.set("Content-Type", "text/html; charset=utf-8");
  // OG previews are cached by unfurlers; allow a short shared cache so we
  // don't re-query Supabase on every WhatsApp / Slack hit, but keep it tight
  // so edits to a post propagate quickly.
  res.set("Cache-Control", "public, max-age=60, s-maxage=300");

  if (!id || !POST_ID_RE.test(id)) {
    // Hand off to the SPA shell anyway so the user sees the "not found" UI.
    try {
      const shell = await loadIndexHtmlShell();
      res.status(404).send(shell);
    } catch (e) {
      logger.warn({ err: e }, "post-share: failed to load shell for invalid id");
      res.status(404).type("text/plain").send("Not found");
    }
    return;
  }

  const baseUrl = getCanonicalWebBaseUrl();

  let post: Awaited<ReturnType<typeof fetchPostForShare>> = null;
  try {
    post = await fetchPostForShare(id);
  } catch (e) {
    logger.warn({ err: e, postId: id }, "post-share: failed to load post");
  }

  let shell: string | null = null;
  try {
    shell = await loadIndexHtmlShell();
  } catch (e) {
    logger.warn({ err: e }, "post-share: failed to load index.html shell");
  }

  if (!post) {
    // Post missing or DB call failed: serve the SPA shell so the React app
    // can render its own "not found" state for real users.
    if (shell) {
      res.status(200).send(shell);
    } else {
      res.status(503).type("text/plain").send("Service unavailable");
    }
    return;
  }

  const meta = buildPostMeta(post, baseUrl);

  if (!shell) {
    res.status(200).send(fallbackHtml(meta, baseUrl));
    return;
  }

  res.status(200).send(injectPostMeta(shell, meta));
});

export default router;
