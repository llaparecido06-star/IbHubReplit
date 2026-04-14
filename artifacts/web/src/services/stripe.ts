const API_URL = (import.meta.env.VITE_API_URL as string) ?? "";

async function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

export async function createCheckoutSession(
  token: string,
  plan: string,
): Promise<{ url: string }> {
  const res = await fetch(`${API_URL}/stripe/create-checkout-session`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao iniciar checkout");
  return data as { url: string };
}

export async function createPortalSession(
  token: string,
): Promise<{ url: string }> {
  const res = await fetch(`${API_URL}/stripe/create-portal-session`, {
    method: "POST",
    headers: await authHeaders(token),
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao abrir portal");
  return data as { url: string };
}
