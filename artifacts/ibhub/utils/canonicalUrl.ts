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
  const fromDomain = canonicalizeWebHost(process.env.EXPO_PUBLIC_DOMAIN);
  if (fromDomain) return `https://${fromDomain}`;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  if (apiUrl) {
    const stripped = apiUrl.replace(/\/api\/?$/, "");
    const canon = canonicalizeWebHost(stripped);
    if (canon) return `https://${canon}`;
  }
  return `https://${CANONICAL_HOST}`;
}
