import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { useAuth } from "@/context/AuthContext";
import {
  AdminUser,
  BadgeDefinition,
  UserBadgeRow,
  createBadgeDefinition,
  deleteBadgeDefinition,
  fetchAdminUsers,
  fetchAllUserBadges,
  fetchBadgeDefinitions,
  grantBadge,
  revokeBadge,
  updateBadgeDefinition,
} from "@/services/adminApi";
import { ADMIN_BADGE_DEFS } from "@/constants/badges";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f5f5f0";
const GREEN  = "#16a34a";
const RED    = "#dc2626";

const EMOJI_GRID = [
  "🥇","🥈","🥉","🏆","🎖️","🏅","🎗️","⭐",
  "🌟","💫","✨","🔥","💎","👑","🎯","🚀",
  "🍷","🍾","🥂","🍸","🫗","🌿","🌱","🍃",
  "👥","🤝","🌍","🌎","🌐","🏢","📢","🎁",
  "✅","🔐","🛡️","💡","🦅","🦁","🌺","🧩",
];

function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState("");

  const handleCustomChange = (raw: string) => {
    setCustom(raw);
    const chars = [...raw];
    if (chars.length > 0) onChange(chars[0]);
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 5, marginBottom: 12 }}>
        {EMOJI_GRID.map((emoji) => {
          const selected = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => { onChange(emoji); setCustom(""); }}
              style={{
                fontSize: 20, padding: "6px 0", borderRadius: 8,
                border: `2px solid ${selected ? GOLD : "transparent"}`,
                backgroundColor: selected ? `${GOLD}22` : "transparent",
                cursor: "pointer", transition: "all 0.1s", lineHeight: 1,
              }}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>Outro emoji:</span>
        <input
          value={custom}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="Cole aqui…"
          maxLength={8}
          style={{ flex: 1, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 18, color: NAVY, outline: "none" }}
        />
        <div style={{ fontSize: 32, lineHeight: 1, minWidth: 40, textAlign: "center" }}>{value}</div>
      </div>
    </div>
  );
}

interface UserWithBadges extends AdminUser {
  avatar_url?: string | null;
  badges: UserBadgeRow[];
}

type ActiveTab = "users" | "stats" | "types";
type DefModal  = "create" | "edit" | null;

export default function AdminBadges() {
  const { user } = useAuth();
  const adminId = user?.id ?? "";

  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [allBadges, setAllBadges]   = useState<UserBadgeRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<UserWithBadges | null>(null);
  const [grantKey, setGrantKey]     = useState<string>("");
  const [grantNotes, setGrantNotes] = useState("");
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tab, setTab]               = useState<ActiveTab>("users");

  const [badgeDefs, setBadgeDefs]         = useState<BadgeDefinition[]>([]);
  const [loadingDefs, setLoadingDefs]     = useState(true);
  const [defModal, setDefModal]           = useState<DefModal>(null);
  const [editingDef, setEditingDef]       = useState<BadgeDefinition | null>(null);
  const [formIcon, setFormIcon]           = useState("🏅");
  const [formLabel, setFormLabel]         = useState("");
  const [formKey, setFormKey]             = useState("");
  const [formDesc, setFormDesc]           = useState("");
  const [keyEdited, setKeyEdited]         = useState(false);
  const [savingDef, setSavingDef]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadDefs = useCallback(async () => {
    setLoadingDefs(true);
    try {
      const defs = await fetchBadgeDefinitions();
      setBadgeDefs(defs);
    } catch {
      setBadgeDefs([]);
    } finally {
      setLoadingDefs(false);
    }
  }, []);

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

  useEffect(() => { void load(); void loadDefs(); }, [load, loadDefs]);

  const activeDefs = useMemo(() => {
    if (badgeDefs.length > 0) return badgeDefs.filter((d) => d.is_active);
    return ADMIN_BADGE_DEFS.map((d) => ({ ...d, id: d.key, is_active: true, sort_order: 0, created_at: "", updated_at: "", description: "" } as BadgeDefinition));
  }, [badgeDefs]);

  useEffect(() => {
    if (activeDefs.length > 0 && !grantKey) {
      setGrantKey(activeDefs[0].key);
    }
  }, [activeDefs, grantKey]);

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
    for (const b of allBadges) map[b.badge_key] = (map[b.badge_key] ?? 0) + 1;
    return map;
  }, [allBadges]);

  const usersPerBadge = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const b of allBadges) {
      if (!map[b.badge_key]) map[b.badge_key] = new Set();
      map[b.badge_key].add(b.user_id);
    }
    return map;
  }, [allBadges]);

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const getBadgeDef = (key: string) =>
    badgeDefs.find((d) => d.key === key) ??
    ADMIN_BADGE_DEFS.find((d) => d.key === key);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const handleSelect = (u: AdminUser) => {
    setSelected({ ...u, badges: badgesByUser.get(u.id) ?? [] });
    const firstKey = activeDefs[0]?.key ?? "";
    setGrantKey(firstKey);
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
      setSelected({ ...selected, badges: [...selected.badges, newRow] });
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
      setSelected({ ...selected, badges: selected.badges.filter((b) => b.id !== row.id) });
      setAllBadges((prev) => prev.filter((b) => b.id !== row.id));
      flash("ok", "Badge removido.");
    } else {
      flash("err", "Erro ao remover badge.");
    }
  };

  const openCreate = () => {
    setEditingDef(null);
    setFormIcon("🏅");
    setFormLabel("");
    setFormKey("");
    setFormDesc("");
    setKeyEdited(false);
    setDefModal("create");
  };

  const openEdit = (def: BadgeDefinition) => {
    setEditingDef(def);
    setFormIcon(def.icon);
    setFormLabel(def.label);
    setFormKey(def.key);
    setFormDesc(def.description);
    setKeyEdited(true);
    setDefModal("edit");
  };

  const handleFormLabelChange = (v: string) => {
    setFormLabel(v);
    if (!keyEdited) setFormKey(labelToKey(v));
  };

  const handleFormKeyChange = (v: string) => {
    setFormKey(v.toLowerCase().replace(/[^a-z0-9_]/g, ""));
    setKeyEdited(true);
  };

  const closeModal = () => { setDefModal(null); setEditingDef(null); };

  const handleSaveDef = async () => {
    if (!formLabel.trim() || !formKey.trim()) {
      flash("err", "Preencha o nome e o identificador do badge.");
      return;
    }
    setSavingDef(true);
    if (defModal === "create") {
      const sortOrder = badgeDefs.length > 0
        ? Math.max(...badgeDefs.map((d) => d.sort_order)) + 10
        : 90;
      const created = await createBadgeDefinition(
        { key: formKey, icon: formIcon, label: formLabel, description: formDesc },
        sortOrder,
      );
      if (created) {
        setBadgeDefs((prev) => [...prev, created]);
        flash("ok", `Badge "${formLabel}" criado!`);
        closeModal();
      } else {
        flash("err", "Erro ao criar badge. O identificador pode já existir.");
      }
    } else if (defModal === "edit" && editingDef) {
      const ok = await updateBadgeDefinition(editingDef.id, {
        icon: formIcon,
        label: formLabel,
        description: formDesc,
      });
      if (ok) {
        setBadgeDefs((prev) =>
          prev.map((d) =>
            d.id === editingDef.id
              ? { ...d, icon: formIcon, label: formLabel, description: formDesc }
              : d,
          ),
        );
        flash("ok", "Badge atualizado!");
        closeModal();
      } else {
        flash("err", "Erro ao salvar alterações.");
      }
    }
    setSavingDef(false);
  };

  const handleToggleActive = async (def: BadgeDefinition) => {
    const ok = await updateBadgeDefinition(def.id, { is_active: !def.is_active });
    if (ok) {
      setBadgeDefs((prev) => prev.map((d) => d.id === def.id ? { ...d, is_active: !d.is_active } : d));
    } else {
      flash("err", "Erro ao alterar status do badge.");
    }
  };

  const handleDeleteDef = async (id: string) => {
    const ok = await deleteBadgeDefinition(id);
    if (ok) {
      setBadgeDefs((prev) => prev.filter((d) => d.id !== id));
      setConfirmDelete(null);
      flash("ok", "Tipo de badge removido.");
    } else {
      flash("err", "Erro ao remover. Verifique se há usuários com esse badge.");
    }
  };

  const TAB_LABELS: { id: ActiveTab; label: string }[] = [
    { id: "users",  label: "👤 Usuários"       },
    { id: "stats",  label: "📊 Estatísticas"   },
    { id: "types",  label: "🏷️ Tipos de Badge" },
  ];

  return (
    <AdminShell>
      <div style={{ padding: "28px 24px", maxWidth: 960, margin: "0 auto" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: 0 }}>Central de Badges</h1>
          <p style={{ fontSize: 14, color: MUTED, margin: "4px 0 0" }}>
            Conceda, gerencie e crie tipos de badges para usuários da plataforma.
          </p>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${BORDER}` }}>
          {TAB_LABELS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "8px 20px", background: "none", border: "none",
                borderBottom: tab === id ? `2px solid ${GOLD}` : "2px solid transparent",
                cursor: "pointer", fontWeight: tab === id ? 700 : 400,
                color: tab === id ? NAVY : MUTED, fontSize: 14, marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {msg && (
          <div style={{ padding: "10px 16px", borderRadius: 10, backgroundColor: msg.type === "ok" ? "#dcfce7" : "#fee2e2", color: msg.type === "ok" ? GREEN : RED, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {msg.type === "ok" ? "✓ " : "✗ "}{msg.text}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {tab === "stats" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>
              Badges concedidos — total: {allBadges.length}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {activeDefs.map((def) => {
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

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 20 }}>
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
                        <Avatar src={u.avatar_url ?? null} name={u.full_name ?? u.email ?? "?"} size={36} />
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

            {selected && (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
                  <Avatar src={selected.avatar_url ?? null} name={selected.full_name ?? selected.email ?? "?"} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{selected.full_name ?? "Sem nome"}</div>
                    <div style={{ fontSize: 13, color: MUTED }}>{selected.username ? `@${selected.username}` : selected.email}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Plano: <strong style={{ color: GOLD }}>{selected.plan}</strong></div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
                </div>

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
                            >
                              Remover
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: BG, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>➕ Conceder badge</div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 4 }}>Badge</label>
                    <select
                      value={grantKey}
                      onChange={(e) => setGrantKey(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, color: NAVY, backgroundColor: WHITE, outline: "none" }}
                    >
                      {activeDefs.map((def) => {
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
                    style={{ width: "100%", padding: "10px 0", backgroundColor: saving ? "#c5c5c5" : GOLD, color: WHITE, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
                  >
                    {saving ? "Salvando…" : "Conceder Badge"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TYPES TAB ── */}
        {tab === "types" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{badgeDefs.length} tipos</span>
                <span style={{ fontSize: 13, color: MUTED, marginLeft: 8 }}>
                  · {badgeDefs.filter((d) => d.is_active).length} ativos
                </span>
              </div>
              <button
                onClick={openCreate}
                style={{ padding: "9px 18px", backgroundColor: GOLD, color: WHITE, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                + Criar novo badge
              </button>
            </div>

            {loadingDefs ? (
              <div style={{ textAlign: "center", padding: 40, color: MUTED }}>Carregando…</div>
            ) : badgeDefs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: MUTED, fontSize: 14, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏅</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Nenhum tipo de badge encontrado no banco</div>
                <div>Execute a migration <code style={{ background: BG, padding: "2px 6px", borderRadius: 4 }}>v78_badge_definitions.sql</code> no Supabase para começar.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {badgeDefs.map((def) => {
                  const count = usersPerBadge[def.key]?.size ?? 0;
                  const isDeleting = confirmDelete === def.id;
                  return (
                    <div
                      key={def.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 16, padding: "14px 18px",
                        backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12,
                        opacity: def.is_active ? 1 : 0.55,
                      }}
                    >
                      <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{def.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{def.label}</span>
                          {!def.is_active && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, backgroundColor: `${MUTED}20`, padding: "2px 8px", borderRadius: 20 }}>inativo</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                          <code style={{ fontSize: 11, backgroundColor: BG, padding: "1px 6px", borderRadius: 4, marginRight: 8 }}>{def.key}</code>
                          {def.description || "Sem descrição"}
                        </div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                          {count} usuário{count !== 1 ? "s" : ""} com esse badge
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => openEdit(def)}
                          style={{ padding: "6px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, backgroundColor: WHITE, color: NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(def)}
                          style={{ padding: "6px 14px", border: `1px solid ${BORDER}`, borderRadius: 7, backgroundColor: WHITE, color: def.is_active ? MUTED : GREEN, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {def.is_active ? "Desativar" : "Ativar"}
                        </button>
                        {isDeleting ? (
                          <>
                            <button
                              onClick={() => handleDeleteDef(def.id)}
                              style={{ padding: "6px 14px", border: "none", borderRadius: 7, backgroundColor: RED, color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              Confirmar exclusão
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              style={{ padding: "6px 12px", border: `1px solid ${BORDER}`, borderRadius: 7, backgroundColor: WHITE, color: MUTED, fontSize: 12, cursor: "pointer" }}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(def.id)}
                            style={{ padding: "6px 12px", border: `1px solid ${BORDER}`, borderRadius: 7, backgroundColor: WHITE, color: RED, fontSize: 12, cursor: "pointer" }}
                            title="Excluir tipo de badge"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL CREATE / EDIT ── */}
      {defModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(13,27,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div style={{ backgroundColor: WHITE, borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>
                {defModal === "create" ? "Criar novo tipo de badge" : "Editar badge"}
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 8 }}>Ícone do badge</label>
              <EmojiPicker value={formIcon} onChange={setFormIcon} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Nome do badge <span style={{ color: RED }}>*</span></label>
              <input
                value={formLabel}
                onChange={(e) => handleFormLabelChange(e.target.value)}
                placeholder="Ex: Sommelier Certificado"
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, color: NAVY, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>
                Identificador (chave) <span style={{ color: RED }}>*</span>
                {defModal === "edit" && <span style={{ color: MUTED, fontWeight: 400, marginLeft: 6 }}>— não editável após criação</span>}
              </label>
              <input
                value={formKey}
                onChange={(e) => handleFormKeyChange(e.target.value)}
                disabled={defModal === "edit"}
                placeholder="ex: sommelier_certificado"
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, color: defModal === "edit" ? MUTED : NAVY, backgroundColor: defModal === "edit" ? BG : WHITE, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
              />
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Apenas letras minúsculas, números e underscores (_). Gerado automaticamente a partir do nome.</div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Descrição</label>
              <input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Ex: Profissional com certificação WSET ou CMS validada"
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14, color: NAVY, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={closeModal}
                style={{ flex: 1, padding: "11px 0", border: `1px solid ${BORDER}`, borderRadius: 9, backgroundColor: WHITE, color: NAVY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDef}
                disabled={savingDef || !formLabel.trim() || !formKey.trim()}
                style={{ flex: 2, padding: "11px 0", backgroundColor: !formLabel.trim() || !formKey.trim() ? "#c5c5c5" : GOLD, color: WHITE, border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: savingDef || !formLabel.trim() || !formKey.trim() ? "not-allowed" : "pointer" }}
              >
                {savingDef ? "Salvando…" : defModal === "create" ? "Criar badge" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
