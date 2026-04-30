import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  AdminUser,
  UserCredits,
  fetchAdminUsers,
  banUser,
  shadowbanUser,
  changeUserPlan,
  resetUserPassword,
  getUserCredits,
  addUserCredits,
} from "@/services/adminApi";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const AVATAR_COLORS = ["#0d1b2a", "#1e3a5f", "#7c3aed", "#e11d48", "#059669", "#374151"];

interface PlanOption { id: string; name: string; }

function getInitial(name: string | null, email: string | null): string {
  return ((name ?? email ?? "?").charAt(0)).toUpperCase();
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

export default function AdminCRM() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [planEdit, setPlanEdit] = useState("gratuito");
  const [isCourtesy, setIsCourtesy] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resetLinkMsg, setResetLinkMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [userCredits, setUserCredits] = useState<UserCredits | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState("");

  useEffect(() => {
    supabase.from("plans").select("id, name").eq("is_active", true).order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setPlanOptions(data as PlanOption[]); });
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (u.full_name ?? "").toLowerCase().includes(s) ||
      (u.username ?? "").toLowerCase().includes(s) ||
      (u.email ?? "").toLowerCase().includes(s)
    );
  });

  const selectUser = (user: AdminUser, isSel: boolean) => {
    if (isSel) {
      setSelectedUser(null);
      setResetLinkMsg(null);
      setUserCredits(null);
      setCreditsToAdd("");
    } else {
      setSelectedUser(user);
      setPlanEdit(user.plan);
      setIsCourtesy(!!user.courtesy_until && new Date(user.courtesy_until) > new Date());
      setResetLinkMsg(null);
      setUserCredits(null);
      setCreditsToAdd("");
      getUserCredits(user.id).then(setUserCredits).catch(() => {});
    }
  };

  const handleBan = async (user: AdminUser) => {
    const isBanned = user.is_banned;
    if (!confirm(`${isBanned ? "Desbanir" : "Banir"} "${user.full_name ?? user.username}"?`)) return;
    setActionLoading(true);
    const ok = await banUser(user.id, !isBanned);
    setActionLoading(false);
    if (ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_banned: !isBanned } : u));
      setSelectedUser((prev) => prev ? { ...prev, is_banned: !isBanned } : prev);
    } else {
      alert("Erro ao executar ação.");
    }
  };

  const handleShadowban = async (user: AdminUser) => {
    const isShadowbanned = user.is_shadowbanned;
    if (!confirm(`${isShadowbanned ? "Remover shadowban de" : "Aplicar shadowban em"} "${user.full_name ?? user.username}"?`)) return;
    setActionLoading(true);
    const ok = await shadowbanUser(user.id, !isShadowbanned);
    setActionLoading(false);
    if (ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_shadowbanned: !isShadowbanned } : u));
      setSelectedUser((prev) => prev ? { ...prev, is_shadowbanned: !isShadowbanned } : prev);
    } else {
      alert("Erro ao executar ação.");
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    if (!confirm(`Gerar link de reset de senha para "${user.full_name ?? user.email}"?`)) return;
    setActionLoading(true);
    setResetLinkMsg(null);
    const result = await resetUserPassword(user.id);
    setActionLoading(false);
    if (result.success && result.resetLink) {
      setResetLinkMsg({ type: "success", text: result.resetLink });
    } else {
      setResetLinkMsg({ type: "error", text: result.error ?? "Erro ao gerar link." });
    }
  };

  const handleSavePlan = async (user: AdminUser) => {
    setSavingPlan(true);
    const ok = await changeUserPlan(user.id, planEdit, isCourtesy);
    setSavingPlan(false);
    if (ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, plan: planEdit } : u));
      setSelectedUser((prev) => prev ? { ...prev, plan: planEdit } : prev);
      // Refresh credits as plan change may have adjusted them
      getUserCredits(user.id).then(setUserCredits).catch(() => {});
      alert(`Plano atualizado para "${planEdit}"${isCourtesy ? " (Cortesia)" : ""}.`);
    } else {
      alert("Erro ao atualizar plano.");
    }
  };

  const handleAddCredits = async (user: AdminUser) => {
    const amount = parseInt(creditsToAdd, 10);
    if (isNaN(amount) || amount === 0) {
      alert("Insira uma quantidade válida (diferente de zero).");
      return;
    }
    try {
      const updated = await addUserCredits(user.id, amount);
      setUserCredits(updated);
      setCreditsToAdd("");
      alert(`${amount > 0 ? `+${amount}` : amount} crédito${Math.abs(amount) === 1 ? "" : "s"} aplicado${Math.abs(amount) === 1 ? "" : "s"}. Agora: ${updated.credits_remaining}/${updated.credits_total}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao ajustar créditos.");
    }
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>CRM Usuários</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Busca global e gestão de usuários</p>
          </div>
          <button
            onClick={() => fetchUsers()}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >↻ Atualizar</button>
        </div>

        <div style={{ position: "relative", marginBottom: 20 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou username..."
            style={{ width: "100%", padding: "11px 12px 11px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: "#fff", boxSizing: "border-box" }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando usuários...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
            <p style={{ color: "#dc2626" }}>{error}</p>
            <button onClick={() => fetchUsers()} style={{ marginTop: 12, padding: "8px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Tentar novamente</button>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Nenhum usuário encontrado.</div>
            ) : (
              filtered.map((user, idx) => {
                const isSel = selectedUser?.id === user.id;
                const initial = getInitial(user.full_name, user.email);
                return (
                  <div key={user.id}>
                    <div
                      onClick={() => selectUser(user, isSel)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 18px",
                        cursor: "pointer",
                        borderBottom: !isSel && idx < filtered.length - 1 ? "1px solid #e8eaed" : "none",
                        backgroundColor: isSel ? `${GOLD}08` : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: 14, fontWeight: 800 }}>
                        {initial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{user.full_name ?? user.username ?? "—"}</span>
                          {user.is_banned && <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#fee2e2", color: "#dc2626", padding: "1px 6px", borderRadius: 5 }}>BANIDO</span>}
                          {user.is_shadowbanned && <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#f3f4f6", color: "#6b7280", padding: "1px 6px", borderRadius: 5 }}>SHADOW</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {user.email ?? `@${user.username ?? "—"}`} · {user.plan}
                        </div>
                      </div>
                      <span style={{ color: "#aaa", fontSize: 18 }}>{isSel ? "▾" : "›"}</span>
                    </div>

                    {isSel && (
                      <div style={{ backgroundColor: "#fafbfc", borderBottom: idx < filtered.length - 1 ? "1px solid #e8eaed" : "none", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: 20, fontWeight: 800, flexShrink: 0 }}>
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{user.full_name ?? "—"}</div>
                            <div style={{ fontSize: 13, color: "#8a93a2" }}>{user.email ?? `@${user.username}`}</div>
                            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>Cadastrado em {formatDate(user.created_at)}</div>
                          </div>
                        </div>

                        <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Plano & Acesso</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <select
                              value={planEdit}
                              onChange={(e) => setPlanEdit(e.target.value)}
                              style={{ flex: 1, padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none", cursor: "pointer" }}
                            >
                                {planOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#555", flexShrink: 0 }}>
                              <input
                                type="checkbox"
                                checked={isCourtesy}
                                onChange={(e) => setIsCourtesy(e.target.checked)}
                                style={{ width: 16, height: 16, cursor: "pointer" }}
                              />
                              Cortesia
                            </label>
                          </div>
                          <button
                            onClick={() => handleSavePlan(user)}
                            disabled={savingPlan}
                            style={{ padding: "8px 20px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: savingPlan ? 0.6 : 1 }}
                          >{savingPlan ? "Salvando..." : "Salvar Plano"}</button>
                        </div>

                        <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Créditos de IA</div>
                          <div style={{ fontSize: 12, color: "#8a93a2", marginBottom: 12 }}>
                            {userCredits
                              ? `Disponível: ${userCredits.credits_remaining} / ${userCredits.credits_total} este mês`
                              : "Carregando..."}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="number"
                              value={creditsToAdd}
                              onChange={(e) => setCreditsToAdd(e.target.value)}
                              placeholder="Ex: 5 ou -2"
                              style={{ width: 110, padding: "8px 10px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none" }}
                            />
                            <button
                              onClick={() => handleAddCredits(user)}
                              disabled={!creditsToAdd || creditsToAdd === "0"}
                              style={{ padding: "8px 16px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !creditsToAdd || creditsToAdd === "0" ? 0.5 : 1 }}
                            >Aplicar</button>
                          </div>
                          <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>Positivo = acrescentar · Negativo = remover</div>
                        </div>

                        <div style={{ backgroundColor: "#fff", border: "1px solid #fca5a5", borderRadius: 12, padding: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 12 }}>⚠ Zona de Risco</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button
                              onClick={() => handleBan(user)}
                              disabled={actionLoading}
                              style={{ padding: "8px 16px", backgroundColor: user.is_banned ? "#dcfce7" : "#fef2f2", color: user.is_banned ? "#16a34a" : "#dc2626", border: `1px solid ${user.is_banned ? "#86efac" : "#fca5a5"}`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            >{user.is_banned ? "✓ Desbanir" : "✗ Banir"}</button>
                            <button
                              onClick={() => handleShadowban(user)}
                              disabled={actionLoading}
                              style={{ padding: "8px 16px", backgroundColor: user.is_shadowbanned ? "#f0fdf4" : "#f9fafb", color: user.is_shadowbanned ? "#16a34a" : "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            >{user.is_shadowbanned ? "Remover Shadow" : "Shadowban"}</button>
                            <button
                              onClick={() => handleResetPassword(user)}
                              disabled={actionLoading}
                              style={{ padding: "8px 16px", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                            >🔗 Resetar Senha</button>
                          </div>
                          {resetLinkMsg && (
                            <div style={{ marginTop: 12, padding: "10px 14px", backgroundColor: resetLinkMsg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${resetLinkMsg.type === "success" ? "#86efac" : "#fca5a5"}`, borderRadius: 8 }}>
                              {resetLinkMsg.type === "success" ? (
                                <>
                                  <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 6 }}>Link gerado! Copie e envie ao usuário:</div>
                                  <div style={{ fontSize: 11, color: "#374151", wordBreak: "break-all", fontFamily: "monospace", backgroundColor: "#fff", padding: "6px 8px", borderRadius: 6, border: "1px solid #e8eaed" }}>
                                    {resetLinkMsg.text}
                                  </div>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(resetLinkMsg.text)}
                                    style={{ marginTop: 6, padding: "4px 10px", fontSize: 11, backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 600 }}
                                  >Copiar</button>
                                </>
                              ) : (
                                <div style={{ fontSize: 12, color: "#dc2626" }}>{resetLinkMsg.text}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
