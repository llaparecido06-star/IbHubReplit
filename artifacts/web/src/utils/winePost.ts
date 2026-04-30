/**
 * Lightweight wine-post helper used in places that don't need the full
 * structured renderer (`WineTastingCardWeb` in AppFeedPage) — for example
 * notification rows that only need to surface the wine name in the preview.
 *
 * Mirrors `artifacts/api-server/src/lib/winePost.ts` and
 * `artifacts/ibhub/utils/winePost.ts` so all three artifacts agree on which
 * posts count as wine reviews.
 */

const WINE_HEADER_RE = /^[ \t]*🍷[ \t]*Degustação:[ \t]*([^\r\n]+?)[ \t]*$/m;
const LEGACY_FIRST_LINE_RE = /^\s*⭐+\s*(.+?)\s*$/;

function stripVariationSelectors(s: string): string {
  return s.replace(/\uFE0F/g, "");
}

export function extractWineName(content: string | null | undefined): string | null {
  if (!content) return null;
  const normalized = stripVariationSelectors(content);

  const m = normalized.match(WINE_HEADER_RE);
  if (m && m[1]) return m[1].trim() || null;

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
