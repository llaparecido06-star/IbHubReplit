import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  AdminUser,
  fetchAdminUsers,
  banUser,
  changeUserPlan,
  resetUserPassword,
  shadowbanUser,
} from "@/services/adminApi";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

const PLANS = ["gratuito", "basico", "profissional", "empresarial", "premium"];

const planColor: Record<string, { bg: string; color: string }> = {
  gratuito: { bg: "#f5f5f5", color: "#9ca3af" },
  basico: { bg: "#f2f3f5", color: "#8a93a2" },
  profissional: { bg: "#ede9fe", color: "#6d28d9" },
  empresarial: { bg: "#dcfce7", color: "#16a34a" },
  premium: { bg: `${GOLD}18`, color: GOLD },
};

export default function AdminUsuarios() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [planFilter, setPlanFilter] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [planEdit, setPlanEdit] = useState("");
  const [isCourtesy, setIsCourtesy] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = async (q?: string) => {
    setLoading(true);
    const data = await fetchAdminUsers(q);
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSearch = () => {
    setSearch(searchInput);
    loadUsers(searchInput || undefined);
  };

  const handleBan = async (user: AdminUser, ban: boolean) => {
    if (!confirm(`${ban ? "Banir" : "Desbanir"} "${user.full_name ?? user.username}"?`)) return;
    setActionLoading(true);
    const ok = await banUser(user.id, ban);
    setActionLoading(false);
    if (ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_banned: ban } : u));
      if (selectedUser?.id === user.id) setSelectedUser((prev) => prev ? { ...prev, is_banned: ban } : prev);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedUser || !planEdit) return;
    setActionLoading(true);
    const ok = await changeUserPlan(selectedUser.id, planEdit, isCourtesy);
    setActionLoading(false);
    if (ok) {
      setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, plan: planEdit } : u));
      setSelectedUser((prev) => prev ? { ...prev, plan: planEdit } : prev);
    }
  };

  const handleShadowban = async (user: AdminUser, shadowban: boolean) => {
    if (!confirm(`${shadowban ? "Aplicar shadowban" : "Remover shadowban"} em "${user.full_name ?? user.username}"?`)) return;
    setActionLoading(true);
    await shadowbanUser(user.id, shadowban);
    setActionLoading(false);
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_shadowbanned: shadowban } : u));
    if (selectedUser?.id === user.id) setSelectedUser((prev) => prev ? { ...prev, is_shadowbanned: shadowban } : prev);
  };

  const filtered = users.filter((u) => {
    if (planFilter && u.plan !== planFilter) return false;
    return true;
  });

  return (
    <AdminShell>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Usuários</h1>
        <p style={{ fontSize: 14, color: "#8a93a2", margin: "0 0 24px" }}>Gerenciamento de contas e planos</p>

        {/* Search and filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 240 }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Buscar por nome ou username..."
              style={{
                flex: 1,
                padding: "10px 14px",
                border: "1px solid #e8eaed",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
                backgroundColor: "#fff",
              }}
            />
            <button
              onClick={handleSearch}
              style={{ padding: "10px 20px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >Buscar</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPlanFilter(null)}
              style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${!planFilter ? GOLD : "#e8eaed"}`, backgroundColor: !planFilter ? GOLD : "#fff", color: !planFilter ? "#fff" : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >Todos</button>
            {PLANS.map((p) => {
              const pc = planColor[p];
              return (
                <button
                  key={p}
                  onClick={() => setPlanFilter(planFilter === p ? null : p)}
                  style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${planFilter === p ? pc.color : "#e8eaed"}`, backgroundColor: planFilter === p ? pc.bg : "#fff", color: planFilter === p ? pc.color : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selectedUser ? "1fr 340px" : "1fr", gap: 20 }}>
          {/* User list */}
          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th style={th}>Nome</th>
                    <th style={th}>Username</th>
                    <th style={th}>Plano</th>
                    <th style={th}>Status</th>
                    <th style={th}>Cadastro</th>
                    <th style={th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, idx) => {
                    const pc = planColor[u.plan] ?? planColor.basico;
                    return (
                      <tr
                        key={u.id}
                        style={{ borderTop: "1px solid #f2f3f5", backgroundColor: selectedUser?.id === u.id ? `${GOLD}08` : idx % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}
                        onClick={() => { setSelectedUser(u); setPlanEdit(u.plan); setIsCourtesy(false); }}
                      >
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#722f37", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                              {(u.full_name ?? u.username ?? "?")?.[0]?.toUpperCase()}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{u.full_name ?? "—"}</span>
                            {u.is_admin && <span style={{ fontSize: 10, backgroundColor: GOLD, color: "#fff", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>ADMIN</span>}
                          </div>
                        </td>
                        <td style={td}><span style={{ fontSize: 12, color: "#8a93a2" }}>@{u.username ?? "—"}</span></td>
                        <td style={td}>
                          <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: pc.bg, color: pc.color, padding: "2px 8px", borderRadius: 6 }}>
                            {u.plan}
                          </span>
                        </td>
                        <td style={td}>
                          <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: u.is_banned ? "#fef2f2" : "#f0fdf4", color: u.is_banned ? "#dc2626" : "#16a34a", padding: "2px 8px", borderRadius: 6 }}>
                            {u.is_banned ? "Banido" : "Ativo"}
                          </span>
                        </td>
                        <td style={td}><span style={{ fontSize: 12, color: "#aaa" }}>{new Date(u.created_at).toLocaleDateString("pt-BR")}</span></td>
                        <td style={td}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleBan(u, !u.is_banned); }}
                            disabled={actionLoading}
                            style={{ padding: "4px 10px", backgroundColor: u.is_banned ? "#f0fdf4" : "#fef2f2", color: u.is_banned ? "#16a34a" : "#dc2626", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >{u.is_banned ? "Desbanir" : "Banir"}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 14 }}>Nenhum usuário encontrado.</div>
            )}
          </div>

          {/* User detail panel */}
          {selectedUser && (
            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 24, height: "fit-content" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: NAVY }}>Detalhes do usuário</h3>
                <button onClick={() => setSelectedUser(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#aaa" }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "#722f37", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 12 }}>
                  {(selectedUser.full_name ?? selectedUser.username ?? "?")?.[0]?.toUpperCase()}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{selectedUser.full_name ?? "—"}</div>
                <div style={{ fontSize: 13, color: "#8a93a2" }}>@{selectedUser.username ?? "—"}</div>
                {selectedUser.is_admin && (
                  <span style={{ marginTop: 6, fontSize: 11, backgroundColor: GOLD, color: "#fff", padding: "2px 10px", borderRadius: 6, fontWeight: 800 }}>ADMIN</span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ padding: 14, backgroundColor: "#f9fafb", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Status</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: selectedUser.is_banned ? "#dc2626" : "#16a34a" }}>
                    {selectedUser.is_banned ? "🚫 Banido" : "✅ Ativo"}
                  </span>
                </div>

                <div style={{ padding: 14, backgroundColor: "#f9fafb", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Plano atual</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{selectedUser.plan}</span>
                </div>

                <div style={{ padding: 14, backgroundColor: "#f9fafb", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Cadastrado em</div>
                  <span style={{ fontSize: 13, color: NAVY }}>{new Date(selectedUser.created_at).toLocaleDateString("pt-BR")}</span>
                </div>

                {selectedUser.areas_of_expertise && selectedUser.areas_of_expertise.length > 0 && (
                  <div style={{ padding: 14, backgroundColor: "#f9fafb", borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>Áreas de expertise</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedUser.areas_of_expertise.map((a) => (
                        <span key={a} style={{ fontSize: 11, backgroundColor: "#e8eaed", color: "#555", padding: "2px 8px", borderRadius: 6 }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Change plan */}
                <div style={{ padding: 14, backgroundColor: "#f9fafb", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>Alterar plano</div>
                  <select
                    value={planEdit}
                    onChange={(e) => setPlanEdit(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, marginBottom: 10 }}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, cursor: "pointer" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Cortesia</div>
                      <div style={{ fontSize: 11, color: "#8a93a2" }}>Acesso sem validação Stripe</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isCourtesy}
                      onChange={(e) => setIsCourtesy(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: "pointer" }}
                    />
                  </label>
                  <button
                    onClick={handleChangePlan}
                    disabled={actionLoading}
                    style={{
                      width: "100%", padding: "9px 0",
                      backgroundColor: GOLD,
                      color: "#fff",
                      border: "none", borderRadius: 8,
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}
                  >{actionLoading ? "Salvando..." : "Salvar Plano"}</button>
                </div>

                {/* Reset password */}
                <button
                  onClick={async () => {
                    if (!confirm("Gerar link de redefinição de senha para este usuário?")) return;
                    setActionLoading(true);
                    const result = await resetUserPassword(selectedUser.id);
                    setActionLoading(false);
                    if (result.success && result.resetLink) {
                      prompt("Link de redefinição gerado (copie e envie ao usuário):", result.resetLink);
                    } else {
                      alert("Erro: " + (result.error ?? "Não foi possível gerar o link."));
                    }
                  }}
                  disabled={actionLoading}
                  style={{
                    padding: "10px 0",
                    backgroundColor: "#eff6ff",
                    color: "#2563eb",
                    border: "1px solid #bfdbfe",
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >🔑 Redefinir senha</button>

                {/* Shadowban action */}
                <button
                  onClick={() => handleShadowban(selectedUser, !selectedUser.is_shadowbanned)}
                  disabled={actionLoading}
                  style={{
                    padding: "10px 0",
                    backgroundColor: selectedUser.is_shadowbanned ? "#f3f4f6" : "#f9fafb",
                    color: selectedUser.is_shadowbanned ? "#6b7280" : "#374151",
                    border: "1px solid #e8eaed",
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >{selectedUser.is_shadowbanned ? "👁️ Remover shadowban" : "🕵️ Aplicar shadowban"}</button>

                {/* Ban action */}
                <button
                  onClick={() => handleBan(selectedUser, !selectedUser.is_banned)}
                  disabled={actionLoading}
                  style={{
                    padding: "10px 0",
                    backgroundColor: selectedUser.is_banned ? "#f0fdf4" : "#fef2f2",
                    color: selectedUser.is_banned ? "#16a34a" : "#dc2626",
                    border: `1px solid ${selectedUser.is_banned ? "#86efac" : "#fca5a5"}`,
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >{selectedUser.is_banned ? "✅ Desbanir usuário" : "🚫 Banir usuário"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

const th: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: "#8a93a2",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 13,
  verticalAlign: "middle",
};
