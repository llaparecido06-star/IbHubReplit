/**
 * Stripe API service for the web client.
 *
 * API base resolution (same pattern as adminApi.ts):
 *   1. VITE_API_URL env var (set in dev/production config)
 *   2. Fallback: current origin with port stripped + "/api"
 *      e.g. https://myapp.replit.app → https://myapp.replit.app/api
 */
const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)
  ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

async function authHeaders(token: string): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function createCheckoutSession(
  token: string,
  plan: string,
): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/stripe/create-checkout-session`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({ plan }),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? "Erro ao iniciar checkout";
    throw new Error(msg);
  }
  return data as { url: string };
}

export async function createPortalSession(
  token: string,
): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/stripe/create-portal-session`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({}),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? "Erro ao abrir portal";
    throw new Error(msg);
  }
  return data as { url: string };
}
