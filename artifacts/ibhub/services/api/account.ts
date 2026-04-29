import { API_URL } from "./_shared";

export async function deleteAccount(token: string): Promise<{ success: boolean; warnings?: string[]; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error ?? "Erro ao excluir conta." };
    return { success: true, warnings: json.warnings ?? [] };
  } catch (e) {
    console.error("deleteAccount:", e);
    return { success: false, error: "Erro de conexão. Tente novamente." };
  }
}
