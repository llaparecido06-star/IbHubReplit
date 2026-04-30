/**
 * Build OpenGraph / Twitter Card metadata for a post so that link unfurlers
 * (WhatsApp, iMessage, Twitter/X, LinkedIn, Slack, …) can show a per-post
 * preview when someone shares `https://www.ibhub.com.br/post/<id>`.
 *
 * The web SPA at `/post/<id>` only renders meaningful tags after JavaScript
 * runs, which unfurlers don't do. The api-server intercepts that path and
 * serves the same `index.html` shell with these tags injected into the
 * `<head>`, so bots see real wine / poll info while real users still get
 * the React app hydrating exactly as before.
 */

import { extractWineName, truncate } from "./winePost.js";

const FALLBACK_IMAGE = "https://www.ibhub.com.br/opengraph.jpg";
const SITE_NAME = "ibhub — Rede do Vinho";

export type PostMeta = {
  title: string;
  description: string;
  image: string;
  url: string;
};

type PollOption = { text?: string | null };
type PollLike = { options?: PollOption[] | null } | null | undefined;

type PostRow = {
  id: string;
  content?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  poll?: PollLike;
  author?: { full_name?: string | null } | null;
};

const WINE_PREFIXES: Record<string, string> = {
  "🍷 Degustação:": "title",
  "🏠 Produtor:": "producer",
  "🏭 Produtor:": "producer", // legacy
  "🌿 Uva/Casta:": "grape",
  "🍇 Uva/Casta:": "grape", // legacy
  "📅 Safra:": "year",
  "📍 Região:": "region",
  "🌍 País:": "country",
  "⭐ Pontuação:": "score",
  "📊 Pontuação:": "score", // legacy
  "👃 Aroma:": "aroma",
  "👅 Sabor:": "taste",
  "🍽️ Harmonização:": "pairing",
  "📝 Notas:": "notes",
  "🍷 Notas:": "notes", // legacy
};

function stripVariationSelectors(s: string): string {
  return s.replace(/\uFE0F/g, "");
}

/** Parse the structured wine post layout into a flat map of fields. */
function parseWineFields(rawContent: string): Record<string, string> {
  const out: Record<string, string> = {};
  const content = stripVariationSelectors(rawContent);
  for (const line of content.split("\n").map((l) => l.trim()).filter(Boolean)) {
    for (const [prefix, key] of Object.entries(WINE_PREFIXES)) {
      const normalizedPrefix = stripVariationSelectors(prefix);
      if (line.startsWith(normalizedPrefix)) {
        const value = line.slice(normalizedPrefix.length).trim();
        if (value) out[key] = value;
        break;
      }
    }
  }
  return out;
}

function isWinePost(content: string): boolean {
  if (!content) return false;
  if (extractWineName(content)) return true;
  return /^⭐/.test(content) && /Pontuação/.test(content);
}

function pickImage(post: PostRow): string {
  if (post.image_url) return post.image_url;
  if (Array.isArray(post.image_urls) && post.image_urls[0]) return post.image_urls[0];
  return FALLBACK_IMAGE;
}

function canonicalUrl(baseUrl: string, postId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/post/${postId}`;
}

export function buildPostMeta(post: PostRow, baseUrl: string): PostMeta {
  const url = canonicalUrl(baseUrl, post.id);
  const image = pickImage(post);
  const content = (post.content ?? "").trim();
  const author = post.author?.full_name?.trim() || null;

  // ─── Wine review ──────────────────────────────────────────────────────────
  if (isWinePost(content)) {
    const fields = parseWineFields(content);
    const wineName = fields["title"] || extractWineName(content) || "Avaliação de vinho";
    const score = fields["score"];
    const producer = fields["producer"];
    const region = fields["region"] || fields["country"];
    const year = fields["year"];

    const titleBits = [wineName];
    if (score) titleBits.push(`⭐ ${score}`);
    const title = `🍷 ${titleBits.join(" · ")} | ${SITE_NAME}`;

    const descBits: string[] = [];
    if (producer) descBits.push(producer);
    if (year) descBits.push(year);
    if (region) descBits.push(region);
    if (score) descBits.push(`Pontuação ${score}`);
    if (author) descBits.push(`Avaliado por ${author}`);
    const fallbackDesc = fields["notes"] || fields["aroma"] || fields["taste"] || "";
    if (descBits.length === 0 && fallbackDesc) descBits.push(fallbackDesc);
    const description = truncate(descBits.join(" · ") || "Avaliação de vinho na rede ibhub.", 280);

    return { title: truncate(title, 200), description, image, url };
  }

  // ─── Poll ────────────────────────────────────────────────────────────────
  const poll = post.poll;
  if (poll && Array.isArray(poll.options) && poll.options.length > 0) {
    const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean) || "Enquete";
    const opts = poll.options
      .map((o) => (o?.text ?? "").trim())
      .filter((t): t is string => Boolean(t));
    const title = truncate(`📊 ${firstLine} | ${SITE_NAME}`, 200);

    const optionsLine = opts.length > 0
      ? `Opções: ${opts.slice(0, 3).join(" · ")}${opts.length > 3 ? "…" : ""}`
      : "Vote agora na ibhub.";
    const descBits = [optionsLine];
    if (author) descBits.push(`Por ${author}`);
    const description = truncate(descBits.join(" — "), 280);

    return { title, description, image, url };
  }

  // ─── Generic post ────────────────────────────────────────────────────────
  const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean) || "Publicação";
  const headline = truncate(firstLine, 90);
  const title = truncate(`${headline} | ${SITE_NAME}`, 200);
  const descSource = content.replace(/\s+/g, " ").trim() || "Publicação na rede ibhub.";
  const descPrefix = author ? `${author}: ` : "";
  const description = truncate(`${descPrefix}${descSource}`, 280);

  return { title, description, image, url };
}

/**
 * Escape a string for safe inclusion in an HTML attribute value.
 * We use double-quoted attributes everywhere, so escaping `&`, `<`, `>`, `"`
 * is sufficient.
 */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Inject (or replace) the post-specific meta tags inside a copy of the web
 * `index.html` shell. We rewrite known og:/twitter: tags and the page
 * `<title>` / `description`, then append a self-marker so we can detect a
 * second pass and short-circuit.
 */
export function injectPostMeta(html: string, meta: PostMeta): string {
  if (html.includes('data-ibhub-post-meta="1"')) return html;

  const t = escapeHtmlAttr(meta.title);
  const d = escapeHtmlAttr(meta.description);
  const i = escapeHtmlAttr(meta.image);
  const u = escapeHtmlAttr(meta.url);

  let next = html;

  // <title>…</title>
  next = next.replace(/<title>[\s\S]*?<\/title>/i, `<title>${t}</title>`);

  // <meta name="description" content="…">
  next = next.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>(\s*)/i,
    `<meta name="description" content="${d}" />$1`,
  );

  const ogReplacements: Array<[RegExp, string]> = [
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${u}" />`],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${t}" />`],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${d}" />`],
    [/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${i}" />`],
    [/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:type" content="article" />`],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${t}" />`],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${d}" />`],
    [/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${i}" />`],
  ];
  for (const [re, replacement] of ogReplacements) {
    next = next.replace(re, replacement);
  }

  // Mark + add canonical + ensure og:url is present even if shell didn't have it.
  const headInjection = [
    `<meta name="ibhub:post-meta" data-ibhub-post-meta="1" content="1" />`,
    `<link rel="canonical" href="${u}" />`,
  ].join("\n    ");

  next = next.replace(/<\/head>/i, `    ${headInjection}\n  </head>`);
  return next;
}
