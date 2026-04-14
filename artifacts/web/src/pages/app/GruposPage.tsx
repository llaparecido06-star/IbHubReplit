import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  Group,
  fetchGroups,
  createGroup,
  joinGroup,
  leaveGroup,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

const CATEGORIES = ["Todos", "Exportação", "Sommelier", "Produção", "Importação", "Enoturismo", "Marketing", "Outros"];
const ACCESS_ICON: Record<string, string> = { aberto: "🌐", fechado: "🔒", restrito: "🛡️" };
const ACCESS_LABEL: Record<string, string> = { aberto: "Aberto", fechado: "Fechado", restrito: "Restrito" };

const CATEGORY_COLORS: Record<string, string> = {
  Exportação: "#1d4ed8", Sommelier: "#722f37", Produção: "#15803d",
  Importação: "#7c3aed", Enoturismo: "#0e7490", Marketing: "#b45309", Outros: "#6b7280",
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "#6b7280";
}

function GroupAvatar({ group }: { group: Group }) {
  if (group.avatar_url) {
    return <img src={group.avatar_url} alt={group.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />;
  }
  const color = getCategoryColor(group.category);
  const initials = group.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color }}>
      {initials || "G"}
    </div>
  );
}

function GroupCard({ group, userId, onJoin, onLeave }: {
  group: Group;
  userId: string;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
}) {
  const [busy, setBusy]     = useState(false);
  const [, setLocation]     = useLocation();
  const color = getCategoryColor(group.category);

  const handleJoin = async () => {
    if (busy) return;
    setBusy(true);
    await onJoin(group.id);
    setBusy(false);
  };

  const handleLeave = async () => {
    if (busy) return;
    if (!window.confirm(`Sair do grupo "${group.name}"?`)) return;
    setBusy(true);
    await onLeave(group.id);
    setBusy(false);
  };

  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ height: 6, backgroundColor: color }} />
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <GroupAvatar group={group} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: 0, flex: 1 }}>{group.name}</h3>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, backgroundColor: color + "18", color, fontWeight: 700, padding: "2px 8px", borderRadius: 100 }}>{group.category}</span>
              <span style={{ fontSize: 10, backgroundColor: "#f3f4f6", color: MUTED, fontWeight: 600, padding: "2px 8px", borderRadius: 100 }}>
                {ACCESS_ICON[group.access]} {ACCESS_LABEL[group.access]}
              </span>
            </div>
          </div>
        </div>

        {group.description && (
          <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px", lineHeight: 1.5 }}>
            {group.description.length > 100 ? group.description.slice(0, 100) + "…" : group.description}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: MUTED }}>👥 {(group.member_count ?? 0).toLocaleString("pt-BR")} membro{group.member_count !== 1 ? "s" : ""}</span>

          {group.is_member ? (
            <div style={{ display: "flex", gap: 6 }}>
              {group.is_owner && (
                <span style={{ fontSize: 11, backgroundColor: `${GOLD}20`, color: GOLD, fontWeight: 700, padding: "5px 10px", borderRadius: 8 }}>
                  ⭐ Criador
                </span>
              )}
              <button
                onClick={() => setLocation(`/app/grupos/${group.id}`)}
                style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 8, border: "none", backgroundColor: NAVY, color: "#fff", cursor: "pointer" }}
              >
                💬 Chat
              </button>
              <button onClick={handleLeave} disabled={busy} style={{
                fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 8,
                border: `1px solid ${BORDER}`, backgroundColor: "#f5f5f0", color: MUTED, cursor: "pointer",
              }}>
                Sair
              </button>
            </div>
          ) : (
            <button onClick={handleJoin} disabled={busy} style={{
              fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
              border: `1px solid ${GOLD}50`, backgroundColor: `${GOLD}15`,
              color: GOLD, cursor: "pointer",
            }}>
              {busy ? "…" : "Participar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateGroupModalProps {
  userId: string;
  onClose: () => void;
  onCreated: (g: Group) => void;
}

function CreateGroupModal({ userId, onClose, onCreated }: CreateGroupModalProps) {
  const [name, setName]         = useState("");
  const [description, setDesc]  = useState("");
  const [category, setCategory] = useState(CATEGORIES[1]);
  const [access, setAccess]     = useState<"aberto" | "fechado" | "restrito">("aberto");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError("O nome é obrigatório."); return; }
    setLoading(true);
    const g = await createGroup({ owner_id: userId, name: name.trim(), description: description.trim() || undefined, category, access });
    setLoading(false);
    if (!g) { setError("Erro ao criar grupo. Tente novamente."); return; }
    onCreated(g);
  };

  const accessOptions: { value: "aberto" | "fechado" | "restrito"; label: string; desc: string; icon: string }[] = [
    { value: "aberto",   label: "Aberto",   desc: "Qualquer pessoa pode entrar", icon: "🌐" },
    { value: "fechado",  label: "Fechado",  desc: "Precisa de aprovação",        icon: "🔒" },
    { value: "restrito", label: "Restrito", desc: "Somente por convite",         icon: "🛡️" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ backgroundColor: WHITE, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: NAVY, margin: 0 }}>Criar Grupo</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: MUTED }}>×</button>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#b91c1c" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Nome do grupo *</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60}
            placeholder="Ex: Importadores do Nordeste" style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Descrição</label>
          <textarea value={description} onChange={e => setDesc(e.target.value)} maxLength={300} rows={3}
            placeholder="Sobre o grupo..." style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 8 }}>Categoria *</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.slice(1).map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${category === cat ? NAVY : BORDER}`,
                backgroundColor: category === cat ? NAVY : WHITE,
                color: category === cat ? WHITE : MUTED,
                fontFamily: "inherit",
              }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 8 }}>Tipo de acesso</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {accessOptions.map(opt => (
              <button key={opt.value} onClick={() => setAccess(opt.value)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                border: `${access === opt.value ? 2 : 1}px solid ${access === opt.value ? GOLD : BORDER}`,
                backgroundColor: WHITE, fontFamily: "inherit", textAlign: "left",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: access === opt.value ? `${GOLD}20` : "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {opt.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{opt.desc}</div>
                </div>
                {access === opt.value && <span style={{ color: GOLD, fontSize: 18 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleCreate} disabled={loading || !name.trim()} style={{
          width: "100%", padding: "13px", backgroundColor: name.trim() ? GOLD : "#e5e7eb",
          color: name.trim() ? WHITE : MUTED, border: "none", borderRadius: 12,
          fontSize: 15, fontWeight: 800, cursor: name.trim() ? "pointer" : "default", fontFamily: "inherit",
        }}>
          {loading ? "Criando…" : "Criar Grupo"}
        </button>
      </div>
    </div>
  );
}

export default function GruposPage() {
  const { profile, user, activeCompany } = useAuth();
  const userId = profile?.id ?? user?.id ?? "";

  const [mine, setMine]       = useState<Group[]>([]);
  const [explore, setExplore] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch]   = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { mine: m, explore: e } = await fetchGroups(userId);
      setMine(m);
      setExplore(e);
      setDbError(false);
    } catch {
      setDbError(true);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async (groupId: string) => {
    await joinGroup(groupId, userId);
    await load();
  };

  const handleLeave = async (groupId: string) => {
    await leaveGroup(groupId, userId);
    await load();
  };

  const handleCreated = async (g: Group) => {
    setShowCreate(false);
    await load();
  };

  const filter = (g: Group) => {
    if (activeCategory !== "Todos" && g.category !== activeCategory) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) &&
        !(g.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  const filteredMine    = mine.filter(filter);
  const filteredExplore = explore.filter(filter);

  return (
    <AppShell>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Company mode banner */}
        {activeCompany && (
          <div style={{ marginBottom: 16, backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}30`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            {activeCompany.avatar_url
              ? <img src={activeCompany.avatar_url} alt={activeCompany.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: WHITE }}>{activeCompany.name[0]}</div>
            }
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase" }}>Modo Empresa</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Grupos de {activeCompany.name}</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Grupos</h1>
            <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>
              {activeCompany ? `Grupos em que ${activeCompany.name} participa` : "Comunidades de profissionais do vinho"}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} style={{
            backgroundColor: GOLD, color: WHITE, fontWeight: 800, fontSize: 13,
            border: "none", borderRadius: 10, padding: "10px 18px", cursor: "pointer",
          }}>
            + Criar grupo
          </button>
        </div>

        {/* DB error notice */}
        {dbError && (
          <div style={{ marginBottom: 16, backgroundColor: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#9a3412" }}>
            <strong>⚠️ Tabela de grupos não encontrada.</strong> Execute a migração <code>migrations_v45_groups.sql</code> no Supabase SQL Editor para ativar os grupos.
          </div>
        )}

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <svg width="16" height="16" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupos..."
            style={{ border: "none", outline: "none", fontSize: 14, flex: 1, fontFamily: "inherit" }} />
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: activeCategory === cat ? 700 : 500,
              border: `1px solid ${activeCategory === cat ? GOLD : BORDER}`,
              backgroundColor: activeCategory === cat ? GOLD : WHITE,
              color: activeCategory === cat ? WHITE : MUTED,
              cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
            }}>
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍷</div>
            Carregando grupos…
          </div>
        ) : (
          <>
            {/* Meus grupos */}
            {filteredMine.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 12, fontWeight: 800, color: MUTED, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 12px" }}>
                  MEUS GRUPOS ({filteredMine.length})
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                  {filteredMine.map(g => (
                    <GroupCard key={g.id} group={g} userId={userId} onJoin={handleJoin} onLeave={handleLeave} />
                  ))}
                </div>
              </div>
            )}

            {/* Explorar */}
            {filteredExplore.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 12, fontWeight: 800, color: MUTED, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 12px" }}>
                  EXPLORAR ({filteredExplore.length})
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                  {filteredExplore.map(g => (
                    <GroupCard key={g.id} group={g} userId={userId} onJoin={handleJoin} onLeave={handleLeave} />
                  ))}
                </div>
              </div>
            )}

            {filteredMine.length === 0 && filteredExplore.length === 0 && !dbError && (
              <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>
                  {search || activeCategory !== "Todos" ? "Nenhum grupo encontrado" : "Ainda não há grupos"}
                </p>
                <p style={{ fontSize: 13 }}>
                  {search || activeCategory !== "Todos" ? "Tente outra busca ou categoria" : "Seja o primeiro a criar um grupo!"}
                </p>
                {!search && activeCategory === "Todos" && (
                  <button onClick={() => setShowCreate(true)} style={{
                    marginTop: 16, padding: "10px 24px", backgroundColor: GOLD, color: WHITE,
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}>
                    + Criar grupo
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateGroupModal
          userId={userId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </AppShell>
  );
}
