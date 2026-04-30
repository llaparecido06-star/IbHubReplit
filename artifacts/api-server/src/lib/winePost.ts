/**
 * Wine post helpers shared across notification dispatch code.
 *
 * Wine review posts are stored in `posts.content` with a structured layout
 * whose first line is `🍷 Degustação: <wine name>`. Older posts may use a
 * legacy layout where the first line is `⭐⭐⭐⭐ <wine name>` followed by
 * detail rows. Both formats are handled here so that notifications dispatched
 * for older posts still surface the wine name.
 *
 * Keep this lightweight (no heavy parser, no client deps) so it is safe to
 * import from any server route or background worker.
 */

const WINE_HEADER_RE = /^[ \t]*🍷[ \t]*Degustação:[ \t]*([^\r\n]+?)[ \t]*$/m;
// Legacy: first line is something like "⭐⭐⭐⭐ Wine Name" — strip leading stars.
const LEGACY_FIRST_LINE_RE = /^\s*⭐+\s*(.+?)\s*$/;

/** Strip Unicode variation selector (U+FE0F) so emoji prefixes match across platforms. */
function stripVariationSelectors(s: string): string {
  return s.replace(/\uFE0F/g, "");
}

/**
 * Extract the wine display name from a post's `content`. Returns `null` when
 * the post is not a wine review.
 */
export function extractWineName(content: string | null | undefined): string | null {
  if (!content) return null;
  const normalized = stripVariationSelectors(content);

  const m = normalized.match(WINE_HEADER_RE);
  if (m && m[1]) return m[1].trim() || null;

  // Legacy layout: ⭐⭐⭐⭐ <Wine Name> on the first non-empty line, with at
  // least one of the structured detail markers below it. We use startsWith
  // for the leading emojis because JS regex character classes do not handle
  // surrogate-pair emoji without the `u` flag.
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const firstMatch = lines[0].match(LEGACY_FIRST_LINE_RE);
    const looksLikeWine = lines.slice(1).some((l) => {
      return l.startsWith("🍇 ") || l.startsWith("📅 ") || l.startsWith("🏭 ")
          || l.startsWith("📍 ") || l.startsWith("🌍 ")
          || /^📊\s*Pontuação:/.test(l) || /^🍷\s*Notas:/.test(l);
    });
    if (firstMatch && firstMatch[1] && looksLikeWine) {
      return firstMatch[1].trim() || null;
    }
  }

  return null;
}

/** Truncate `s` to `max` characters, adding an ellipsis when shortened. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}
