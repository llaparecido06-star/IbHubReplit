import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { useAuth } from "@/context/AuthContext";
import {
  AdminUser,
  UserBadgeRow,
  fetchAdminUsers,
  fetchAllUserBadges,
  grantBadge,
  revokeBadge,
} from "@/services/adminApi";
import { ADMIN_BADGE_DEFS, BadgeDef } from "@/constants/badges";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f5f5f0";
const GREEN  = "#16a34a";
const RED    = "#dc2626";

function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [broken, setBroken] = React.useState(false);
  if (src && !broken)
    return <img src={src} alt={name} onError={() => setBroken(true)} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: "#722f37", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0 }}>
      {(name?.[0] ?? "U").toUpperCase()}
    </div>
  );
}

interface UserWithBadges extends AdminUser {
  avatar_url?: string | null;
  badges: UserBadgeRow[];
}

export default function AdminBadges() {
  const { user } = useAuth();
  const adminId = user?.id ?? "";

  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [allBadges, setAllBadges]     = useState<UserBadgeRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<UserWithBadges | null>(null);
  const [grantKey, setGrantKey]       = useState<string>(ADMIN_BADGE_DEFS[0]?.key ?? "");
  const [grantNotes, setGrantNotes]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tab, setTab]                 = useState<"users" | "stats">("users");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, badgesData] = await Promise.all([
        fetchAdminUsers(),
        fetchAllUserBadges(),
      ]);
      setUsers(usersData);
      setAllBadges(badgesData);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const badgesByUser = useMemo(() => {
    const map = new Map<string, UserBadgeRow[]>();
    for (const b of allBadges) {
      if (!map.has(b.user_id)) map.set(b.user_id, []);
      map.get(b.user_id)!.push(b);
    }
    return map;
  }, [allBadges]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (!q) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.username ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const statsPerBadge = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of allBadges) {
      map[b.badge_key] = (map[b.badge_key] ?? 0) + 1;
    }
    return map;
  }, [allBadges]);

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleSelect = (user: AdminUser) => {
    const badges = badgesByUser.get(user.id) ?? [];
    setSelected({ ...user, badges });
    setGrantKey(ADMIN_BADGE_DEFS[0]?.key ?? "");
    setGrantNotes("");
  };

  const handleGrant = async () => {
    if (!selected || !grantKey || !adminId) return;
    if (selected.badges.some((b) => b.badge_key === grantKey)) {
      flash("err", "Este usuário já possui esse badge.");
      return;
    }
    setSaving(true);
    const ok = await grantBadge(selected.id, grantKey, adminId, grantNotes || undefined);
    if (ok) {
      const newRow: UserBadgeRow = {
        id: crypto.randomUUID(),
        user_id: selected.id,
        badge_key: grantKey,
        granted_by: adminId,
        notes: grantNotes || null,
        granted_at: new Date().toISOString(),
      };
      const updated = [...selected.badges, newRow];
      setSelected({ ...selected, badges: updated });
      setAllBadges((prev) => [...prev, newRow]);
      setGrantNotes("");
      flash("ok", "Badge concedido com sucesso!");
    } else {
      flash("err", "Erro ao conceder badge.");
    }
    setSaving(false);
  };

  const handleRevoke = async (row: UserBadgeRow) => {
    if (!selected) return;
    const ok = await revokeBadge(row.id);
    if (ok) {
      const updated = selected.badges.filter((b) => b.id !== row.id);
      setSelected({ ...selected, badges: updated });
      setAllBadges((prev) => prev.filter((b) => b.id !== row.id));
      flash("ok", "Badge removido.");
    } else {
      flash("err", "Erro ao remover badge.");
    }
  };

  const getBadgeDef = (key: string): BadgeDef | undefined =>
    ADMIN_BADGE_DEFS.find((b) => b.key === key);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <AdminShell>
      <div style={{ padding: "28px 24px", maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: 0 }}>Central de Badges</h1>
          <p style={{ fontSize: 14, color: MUTED, margin: "4px 0 0" }}>Conceda e gerencie badges especiais para usuários da plataforma.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
          {(["users", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 20px", background: "none", border: "none", borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent",
                cursor: "pointer", fontWeight: tab === t ? 700 : 400, color: tab === t ? NAVY : MUTED, fontSize: 14, marginBottom: -1,
              }}
            >
              {t === "users" ? "👤 Usuários" : "📊 Estatísticas"}
            </button>
          ))}
        </div>

        {/* Flash */}
        {msg && (
          <div style={{ padding: "10px 16px", borderRadius: 10, backgroundColor: msg.type === "ok" ? "#dcfce7" : "#fee2e2", color: msg.type === "ok" ? GREEN : RED, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {msg.type === "ok" ? "✓ " : "✗ "}{msg.text}
          </div>
        )}

        {tab === "stats" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>
              Badges concedidos — total: {allBadges.length}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {ADMIN_BADGE_DEFS.map((def) => {
                const count = statsPerBadge[def.key] ?? 0;
                return (
                  <div key={def.key} style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{def.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{def.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>{count}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>usuário{count !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "users" && (
          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 20 }}>

            {/* Left — user list */}
            <div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, @username ou e-mail…"
                style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, color: NAVY, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
              />

              {loading ? (
                <div style={{ textAlign: "center", padding: 40, color: MUTED }}>Carregando…</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 560, overflowY: "auto" }}>
                  {filtered.map((u) => {
                    const userBadges = badgesByUser.get(u.id) ?? [];
                    const isSel = selected?.id === u.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleSelect(u)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                          backgroundColor: isSel ? `${GOLD}15` : WHITE,
                          border: `1px solid ${isSel ? GOLD : BORDER}`,
                          borderRadius: 10, cursor: "pointer", transition: "all 0.12s",
                        }}
                        onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = BG; }}
                        onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = WHITE; }}
                      >
                        <Avatar src={(u as any).avatar_url} name={u.full_name ?? u.email ?? "?"} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {u.full_name ?? u.email ?? "Sem nome"}
                          </div>
                          <div style={{ fontSize: 12, color: MUTED }}>{u.username ? `@${u.username}` : u.email}</div>
                        </div>
                        {userBadges.length > 0 && (
                          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                            {userBadges.slice(0, 3).map((b) => {
                              const def = getBadgeDef(b.badge_key);
                              return <span key={b.id} style={{ fontSize: 16 }} title={def?.label ?? b.badge_key}>{def?.icon ?? "🏅"}</span>;
                            })}
                            {userBadges.length > 3 && <span style={{ fontSize: 11, color: MUTED, alignSelf: "center" }}>+{userBadges.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: 32, color: MUTED, fontSize: 14 }}>Nenhum usuário encontrado.</div>
                  )}
                </div>
              )}
            </div>

            {/* Right — selected user detail */}
            {selected && (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                {/* User info */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
                  <Avatar src={(selected as any).avatar_url} name={selected.full_name ?? selected.email ?? "?"} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{selected.full_name ?? "Sem nome"}</div>
                    <div style={{ fontSize: 13, color: MUTED }}>{selected.username ? `@${selected.username}` : selected.email}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Plano: <strong style={{ color: GOLD }}>{selected.plan}</strong></div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20, lineHeight: 1, padding: 4 }}
                    title="Fechar"
                  >
                    ×
                  </button>
                </div>

                {/* Current badges */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>
                    Badges atribuídos ({selected.badges.length})
                  </div>
                  {selected.badges.length === 0 ? (
                    <div style={{ fontSize: 13, color: MUTED, padding: "12px 0" }}>Nenhum badge concedido ainda.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selected.badges.map((row) => {
                        const def = getBadgeDef(row.badge_key);
                        return (
                          <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", backgroundColor: BG, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                            <span style={{ fontSize: 20 }}>{def?.icon ?? "🏅"}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{def?.label ?? row.badge_key}</div>
                              <div style={{ fontSize: 11, color: MUTED }}>
                                {formatDate(row.granted_at)}{row.notes ? ` · ${row.notes}` : ""}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevoke(row)}
                              style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer", color: RED, fontSize: 11, fontWeight: 700, padding: "4px 10px" }}
                              title="Remover badge"
                            >
                              Remover
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Grant new badge */}
                <div style={{ backgroundColor: BG, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>➕ Conceder badge</div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 4 }}>Badge</label>
                    <select
                      value={grantKey}
                      onChange={(e) => setGrantKey(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, color: NAVY, backgroundColor: WHITE, outline: "none" }}
                    >
                      {ADMIN_BADGE_DEFS.map((def) => {
                        const alreadyHas = selected.badges.some((b) => b.badge_key === def.key);
                        return (
                          <option key={def.key} value={def.key} disabled={alreadyHas}>
                            {def.icon} {def.label}{alreadyHas ? " (já possui)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 4 }}>Observação (opcional)</label>
                    <input
                      value={grantNotes}
                      onChange={(e) => setGrantNotes(e.target.value)}
                      placeholder="Ex: Certificado WSET Level 3"
                      style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: NAVY, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <button
                    onClick={handleGrant}
                    disabled={saving || !grantKey}
                    style={{
                      width: "100%", padding: "10px 0", backgroundColor: saving ? "#c5c5c5" : GOLD, color: WHITE,
                      border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Salvando…" : "Conceder Badge"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
