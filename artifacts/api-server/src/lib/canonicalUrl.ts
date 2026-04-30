const CANONICAL_HOST = "www.ibhub.com.br";
const APEX_HOST = "ibhub.com.br";

export function canonicalizeWebHost(host: string | undefined | null): string | null {
  if (!host) return null;
  const trimmed = host.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === APEX_HOST) return CANONICAL_HOST;
  return trimmed;
}

export function getCanonicalWebBaseUrl(): string {
  const canon = canonicalizeWebHost(process.env["EXPO_PUBLIC_DOMAIN"]);
  return canon ? `https://${canon}` : `https://${CANONICAL_HOST}`;
}

export function pairApexAndWwwOrigins(origins: string[]): string[] {
  const out = new Set<string>(origins);
  for (const origin of origins) {
    try {
      const u = new URL(origin);
      const host = u.host.toLowerCase();
      if (host === APEX_HOST) {
        out.add(`${u.protocol}//${CANONICAL_HOST}`);
      } else if (host === CANONICAL_HOST) {
        out.add(`${u.protocol}//${APEX_HOST}`);
      }
    } catch {
      continue;
    }
  }
  return Array.from(out);
}

export { CANONICAL_HOST, APEX_HOST };
