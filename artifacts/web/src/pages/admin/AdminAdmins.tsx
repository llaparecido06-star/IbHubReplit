import React, { useCallback, useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";
import { getCachedSession } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

interface AdminProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  is_admin?: boolean;
}

async function authFetch(path: string, options: RequestInit = {}) {
  const session = await getCachedSession();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}`, ...(options.headers ?? {}) },
  });
}

function Avatar({ name, size = 40 }: { name: string | null; size?: number }) {
  const initial = (name ?? "?").split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: `${GOLD}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ color: GOLD, fontSize: size * 0.35, fontWeight: 700 }}>{initial}</span>
    </div>
  );
}

export default function AdminAdmins() {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [granting, setGranting] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    setFetchError(null);
    try {
      const res = await authFetch("/admin/admin-list");
      if (res.ok) {
        const json = await res.json() as { admins?: AdminProfile[] };
        setAdmins(json.admins ?? []);
      } else {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setFetchError(json.error ?? "Erro ao carregar admins.");
      }
    } catch {
      setFetchError("Falha de conexão.");
    }
    setLoadingAdmins(false);
  }, []);

  useEffect(() => { void fetchAdmins(); }, [fetchAdmins]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await authFetch(`/admin/search-users?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const json = await res.json() as { users?: AdminProfile[] };
        setSearchResults(json.users ?? []);
      }
    } catch {}
    setSearching(false);
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(text), 400);
  };

  const handleGrant = async (user: AdminProfile) => {
    if (!confirm(`Conceder acesso admin para "${user.full_name ?? user.email}"?`)) return;
    setGranting(user.id);
    try {
      const res = await authFetch("/admin/grant-admin", { method: "POST", body: JSON.stringify({ userId: user.id }) });
      const json = await res.json() as { error?: string };
      if (res.ok) {
        alert(`${user.full_name ?? "Usuário"} agora é administrador.`);
        setSearchQuery("");
        setSearchResults([]);
        void fetchAdmins();
      } else {
        alert(json.error ?? "Não foi possível conceder acesso.");
      }
    } catch {
      alert("Falha de conexão. Tente novamente.");
    }
    setGranting(null);
  };

  const handleRevoke = async (user: AdminProfile) => {
    if (!confirm(`Remover acesso admin de "${user.full_name ?? user.email}"?`)) return;
    setRevoking(user.id);
    try {
      const res = await authFetch("/admin/revoke-admin", { method: "POST", body: JSON.stringify({ userId: user.id }) });
      const json = await res.json() as { error?: string };
      if (res.ok) {
        alert(`Acesso removido de ${user.full_name ?? "usuário"}.`);
        void fetchAdmins();
      } else {
        alert(json.error ?? "Não foi possível remover acesso.");
      }
    } catch {
      alert("Falha de conexão. Tente novamente.");
    }
    setRevoking(null);
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Admins</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Gerencie o acesso ao painel administrativo</p>
          </div>
          <button onClick={() => fetchAdmins()} style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}>↻</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 16 }}>🔐 Administradores Atuais</div>
            {loadingAdmins ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>Carregando...</div>
            ) : fetchError ? (
              <div style={{ padding: 16, backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, color: "#dc2626", fontSize: 13 }}>{fetchError}</div>
            ) : admins.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>Nenhum administrador cadastrado.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {admins.map((admin) => (
                  <div key={admin.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", backgroundColor: "#fafbfc", border: "1px solid #e8eaed", borderRadius: 12 }}>
                    <Avatar name={admin.full_name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{admin.full_name ?? "—"}</div>
                      <div style={{ fontSize: 12, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{admin.email ?? `@${admin.username ?? "—"}`}</div>
                    </div>
                    <button
                      onClick={() => handleRevoke(admin)}
                      disabled={revoking === admin.id}
                      style={{ padding: "6px 12px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                    >{revoking === admin.id ? "..." : "Revogar"}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 16 }}>➕ Adicionar Admin</div>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar usuário por nome ou email..."
                style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {searching && <div style={{ textAlign: "center", padding: 20, color: "#aaa", fontSize: 13 }}>Buscando...</div>}
            {searchResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {searchResults.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", backgroundColor: "#fafbfc", border: "1px solid #e8eaed", borderRadius: 10 }}>
                    <Avatar name={u.full_name} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name ?? "—"}</div>
                      <div style={{ fontSize: 12, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email ?? `@${u.username ?? "—"}`}</div>
                    </div>
                    <button
                      onClick={() => handleGrant(u)}
                      disabled={granting === u.id}
                      style={{ padding: "6px 12px", backgroundColor: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                    >{granting === u.id ? "..." : "Conceder"}</button>
                  </div>
                ))}
              </div>
            )}
            {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: "#aaa", fontSize: 13 }}>Nenhum usuário encontrado.</div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
