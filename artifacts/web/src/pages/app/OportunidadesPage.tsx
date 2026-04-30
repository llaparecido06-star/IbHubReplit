import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  AppOpportunity,
  AppEvent,
  fetchOpportunities,
  fetchEvents,
  toggleSaveOpportunity,
  registerForEvent,
  unregisterFromEvent,
  createOpportunity,
} from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

type OporTab = "market" | "vagas" | "eventos";
type MarketSort = "recente" | "expirando" | "mais-visualizados";

const MARKET_CATS = ["Vinho", "Insumo", "Equipamento", "Serviço", "Outros"];
const MODALIDADES = ["Remoto", "Presencial", "Híbrido"];
const CONTRATOS = ["CLT", "PJ", "Estágio", "Freelancer"];
const EVENTO_TIPOS = ["Online", "Presencial", "Gratuito", "Pago"];

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 3 * 24 * 60 * 60 * 1000;
}
function isUrgent(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff < 48 * 60 * 60 * 1000;
}
function isPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

const chip = (label: string, active: boolean, onClick: () => void) => (
  <button
    key={label}
    onClick={onClick}
    style={{
      padding: "6px 14px",
      borderRadius: 20,
      border: `1px solid ${active ? GOLD : "#e8eaed"}`,
      backgroundColor: active ? GOLD : "#fff",
      color: active ? "#fff" : "#555",
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      cursor: "pointer",
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </button>
);

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

const BG   = "#f2f3f5";
const WHITE = "#fff";
const BORDER = "#e8eaed";
const MUTED  = "#8a93a2";

export default function OportunidadesPage() {
  const { user, profile, activeCompany } = useAuth();
  const { hasFeature } = usePermissions();
  const canPublish = (profile?.is_admin ?? false) || (!!activeCompany);
  const isMobile = useWindowWidth() < 768;
  const [lockedPublish, setLockedPublish] = useState(false);
  const [location, setLocation] = useLocation();

  const initialTab = (): OporTab => {
    if (location.includes("/vagas")) return "vagas";
    if (location.includes("/eventos")) return "eventos";
    return "market";
  };

  const [tab, setTab] = useState<OporTab>(initialTab);
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState<AppOpportunity[]>([]);
  const [vagas, setVagas] = useState<AppOpportunity[]>([]);
  const [eventos, setEventos] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [marketSort, setMarketSort] = useState<MarketSort>("recente");
  const [marketCat, setMarketCat] = useState<string | null>(null);
  const [vagasModalidade, setVagasModalidade] = useState<string | null>(null);
  const [vagasContrato, setVagasContrato] = useState<string | null>(null);
  const [eventoTipo, setEventoTipo] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createTab, setCreateTab] = useState<"marketplace" | "vaga">("marketplace");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "", description: "", category: "", company: activeCompany?.name ?? "",
    location: "", price: "", salary: "", contract_type: "",
    contact_email: "", expires_at: "",
  });

  const resetCreateForm = () => setCreateForm({
    title: "", description: "", category: "", company: activeCompany?.name ?? "",
    location: "", price: "", salary: "", contract_type: "",
    contact_email: "", expires_at: "",
  });

  const handleCreate = async () => {
    if (!user?.id || !createForm.title.trim()) return;
    setCreating(true);
    const result = await createOpportunity({
      type: createTab,
      title: createForm.title.trim(),
      description: createForm.description.trim() || null,
      category: createForm.category.trim() || null,
      company: createForm.company.trim() || null,
      location: createForm.location.trim() || null,
      price: createTab === "marketplace" ? (createForm.price.trim() || null) : null,
      salary: createTab === "vaga" ? (createForm.salary.trim() || null) : null,
      contract_type: createTab === "vaga" ? (createForm.contract_type.trim() || null) : null,
      contact_email: createForm.contact_email.trim() || null,
      expires_at: createForm.expires_at ? new Date(createForm.expires_at).toISOString() : null,
      created_by: user.id,
    });
    setCreating(false);
    if (result) {
      setShowCreate(false);
      resetCreateForm();
      loadData();
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const uid = user?.id ?? "";
      const [m, v, ev] = await Promise.all([
        fetchOpportunities("marketplace", uid),
        fetchOpportunities("vaga", uid),
        fetchEvents(uid),
      ]);
      setMarket(m);
      setVagas(v);
      setEventos(ev);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleSave = async (item: AppOpportunity) => {
    if (!user?.id) return;
    const wasSaved = !!item.is_saved;
    const updater = (list: AppOpportunity[]) =>
      list.map((i) => i.id === item.id ? { ...i, is_saved: !wasSaved } : i);
    if (item.type === "marketplace") setMarket(updater);
    else setVagas(updater);
    await toggleSaveOpportunity(item.id, user.id, wasSaved);
  };

  const handleEventToggle = async (ev: AppEvent) => {
    if (!user?.id) return;
    const wasReg = !!ev.is_registered;
    setEventos((prev) => prev.map((e) => e.id === ev.id ? { ...e, is_registered: !wasReg } : e));
    if (wasReg) await unregisterFromEvent(ev.id, user.id);
    else await registerForEvent(ev.id, user.id);
  };

  const filteredMarket = (() => {
    let list = market.filter((i) => {
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (marketCat && i.category !== marketCat) return false;
      return true;
    });
    if (marketSort === "expirando") {
      list = [...list].sort((a, b) => {
        if (!a.expires_at && !b.expires_at) return 0;
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      });
    } else if (marketSort === "mais-visualizados") {
      list = [...list].sort((a, b) => (b.interests_count ?? 0) - (a.interests_count ?? 0));
    }
    return list;
  })();

  const filteredVagas = (() => {
    let list = vagas.filter((i) =>
      !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.company ?? "").toLowerCase().includes(search.toLowerCase())
    );
    if (vagasContrato) list = list.filter((i) => i.contract_type === vagasContrato);
    if (vagasModalidade === "Remoto") {
      list = list.filter((i) => {
        const loc = (i.location ?? "").toLowerCase();
        return loc.includes("remot") || loc.includes("online");
      });
    } else if (vagasModalidade === "Presencial") {
      list = list.filter((i) => {
        if (!i.location) return false;
        const loc = i.location.toLowerCase();
        return !loc.includes("remot") && !loc.includes("online") && !loc.includes("híbrido") && !loc.includes("hibrido");
      });
    } else if (vagasModalidade === "Híbrido") {
      list = list.filter((i) => {
        const loc = (i.location ?? "").toLowerCase();
        return loc.includes("híbrido") || loc.includes("hibrido");
      });
    }
    return list;
  })();

  const filteredEventos = eventos.filter((i) => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (eventoTipo === "Online") return i.location_type === "online";
    if (eventoTipo === "Presencial") return i.location_type === "presencial";
    if (eventoTipo === "Gratuito") return i.entry_type === "gratuito";
    if (eventoTipo === "Pago") return i.entry_type !== "gratuito";
    return true;
  });

  const upcomingEvents = filteredEventos.filter((i) => !isPast(i.start_date));
  const pastEvents = filteredEventos.filter((i) => isPast(i.start_date));

  const tabs: { key: OporTab; label: string; icon: string; count: number }[] = [
    { key: "market", label: "Market", icon: "🛍️", count: market.length },
    { key: "vagas", label: "Vagas", icon: "💼", count: vagas.length },
    { key: "eventos", label: "Eventos", icon: "📅", count: eventos.length },
  ];

  const card: React.CSSProperties = {
    backgroundColor: "#fff",
    border: "1px solid #e8eaed",
    borderRadius: 14,
    padding: 18,
    cursor: "pointer",
    transition: "box-shadow 0.15s",
  };

  /* ─────────────────────────── MOBILE LAYOUT ─────────────────────────── */
  if (isMobile) {
    const filterChips = (() => {
      if (tab === "market") return (
        <>
          {(["recente", "expirando", "mais-visualizados"] as MarketSort[]).map((s) => {
            const lbl = s === "recente" ? "Mais recentes" : s === "expirando" ? "Expirando" : "Mais vistos";
            return chip(lbl, marketSort === s, () => setMarketSort(s));
          })}
          <span style={{ color: "#ccc", lineHeight: "30px" }}>|</span>
          {MARKET_CATS.map(c => chip(c, marketCat === c, () => setMarketCat(marketCat === c ? null : c)))}
        </>
      );
      if (tab === "vagas") return (
        <>
          {MODALIDADES.map(m => chip(m, vagasModalidade === m, () => setVagasModalidade(vagasModalidade === m ? null : m)))}
          <span style={{ color: "#ccc", lineHeight: "30px" }}>|</span>
          {CONTRATOS.map(c => chip(c, vagasContrato === c, () => setVagasContrato(vagasContrato === c ? null : c)))}
        </>
      );
      return <>{EVENTO_TIPOS.map(t => chip(t, eventoTipo === t, () => setEventoTipo(eventoTipo === t ? null : t)))}</>;
    })();

    return (
      <AppShell>
        <div style={{ backgroundColor: BG, minHeight: "100vh" }}>

          {/* Sticky header */}
          <div style={{ position: "sticky", top: 56, zIndex: 20, backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}` }}>
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>Oportunidades</span>
              <button
                onClick={() => {
                  if (!canPublish) { setLockedPublish(true); return; }
                  resetCreateForm();
                  setShowCreate(true);
                  setCreateTab(tab === "vagas" ? "vaga" : "marketplace");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", borderRadius: 20, border: "none",
                  backgroundColor: canPublish ? GOLD : BG,
                  color: canPublish ? WHITE : MUTED,
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  ...(canPublish ? {} : { border: `1px solid ${BORDER}` }),
                }}
              >
                {canPublish ? "+" : "🔒"} {canPublish ? (tab === "eventos" ? "Evento" : "Publicar") : "Empresas"}
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: "0 16px 10px" }}>
              <div style={{ backgroundColor: BG, borderRadius: 10, padding: "9px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: NAVY, fontFamily: "inherit" }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 15, padding: 0 }}>✕</button>
                )}
              </div>
            </div>

            {/* Pill tabs */}
            <div style={{ display: "flex", padding: "0 16px", gap: 8, paddingBottom: 12 }}>
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "8px 4px", borderRadius: 10, border: "none",
                    backgroundColor: tab === t.key ? GOLD : BG,
                    color: tab === t.key ? WHITE : MUTED,
                    fontWeight: tab === t.key ? 700 : 500, fontSize: 13,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {t.icon} {t.label}
                  {t.count > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                      backgroundColor: tab === t.key ? "rgba(255,255,255,0.3)" : BORDER,
                      color: tab === t.key ? WHITE : MUTED,
                    }}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Filter chips (horizontal scroll) */}
            <div style={{ display: "flex", gap: 8, padding: "0 16px 12px", overflowX: "auto", scrollbarWidth: "none" as const, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
              {filterChips}
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "12px 16px 80px", display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: MUTED }}>⏳ Carregando...</div>
            ) : (
              <>
                {/* ── Market ── */}
                {tab === "market" && (
                  filteredMarket.length === 0
                    ? <EmptyState icon="🛍️" title="Nenhum produto encontrado" sub="Tente ajustar os filtros." />
                    : filteredMarket.map(item => {
                        const novo = isNew(item.created_at);
                        const urgente = isUrgent(item.expires_at);
                        return (
                          <div
                            key={item.id}
                            onClick={() => setLocation(`/app/oportunidades/${item.id}`)}
                            style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", cursor: "pointer" }}
                          >
                            {item.cover_image_url && (
                              <img src={item.cover_image_url} alt={item.title} style={{ width: "100%", height: 160, objectFit: "cover" }} />
                            )}
                            <div style={{ padding: 14 }}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                {novo && <span style={{ backgroundColor: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Novo</span>}
                                {urgente && <span style={{ backgroundColor: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Urgente</span>}
                                {item.category && <span style={{ backgroundColor: BG, color: MUTED, fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>{item.category}</span>}
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, color: NAVY, flex: 1, lineHeight: 1.3 }}>{item.title}</span>
                                <button onClick={e => { e.stopPropagation(); handleToggleSave(item); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "0 0 0 8px", color: item.is_saved ? GOLD : MUTED }}>
                                  {item.is_saved ? "🔖" : "📎"}
                                </button>
                              </div>
                              {item.company && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>🏢 {item.company}</div>}
                              {item.price && <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 4 }}>{item.price}</div>}
                              {item.location && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>📍 {item.location}</div>}
                              {item.expires_at && <div style={{ fontSize: 12, color: urgente ? "#dc2626" : "#aaa" }}>⏰ Expira: {fmtDate(item.expires_at)}</div>}
                            </div>
                          </div>
                        );
                      })
                )}

                {/* ── Vagas ── */}
                {tab === "vagas" && (
                  filteredVagas.length === 0
                    ? <EmptyState icon="💼" title="Nenhuma vaga encontrada" sub="Tente ajustar os filtros." />
                    : filteredVagas.map(item => {
                        const nova = isNew(item.created_at);
                        const isRemote = (item.location ?? "").toLowerCase().includes("remot") || (item.location ?? "").toLowerCase().includes("online");
                        return (
                          <div
                            key={item.id}
                            onClick={() => setLocation(`/app/oportunidades/${item.id}`)}
                            style={{ backgroundColor: WHITE, border: `1px solid ${item.is_applied ? GOLD : BORDER}`, borderRadius: 14, padding: 14, cursor: "pointer" }}
                          >
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                              {nova && <span style={{ backgroundColor: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Nova</span>}
                              {item.location && (
                                <span style={{ backgroundColor: isRemote ? "#ede9fe" : "#f0f9ff", color: isRemote ? "#7c3aed" : "#0369a1", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
                                  {isRemote ? "Remoto" : "Presencial"}
                                </span>
                              )}
                              {item.contract_type && <span style={{ backgroundColor: BG, color: MUTED, fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>{item.contract_type}</span>}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 16, fontWeight: 700, color: NAVY, flex: 1 }}>{item.title}</span>
                              {item.is_applied
                                ? <span style={{ fontSize: 12, color: GOLD, fontWeight: 700, backgroundColor: `${GOLD}18`, padding: "3px 10px", borderRadius: 8 }}>✓ Candidatado</span>
                                : <button onClick={e => { e.stopPropagation(); handleToggleSave(item); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: item.is_saved ? GOLD : MUTED }}>
                                    {item.is_saved ? "🔖" : "📎"}
                                  </button>
                              }
                            </div>
                            <div style={{ display: "flex", gap: 12, color: MUTED, fontSize: 13, flexWrap: "wrap" }}>
                              {item.company && <span>🏢 {item.company}</span>}
                              {item.location && <span>📍 {item.location}</span>}
                            </div>
                            {(item.salary || (item.applications_count ?? 0) > 0) && (
                              <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center" }}>
                                {item.salary && <span style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>{item.salary}</span>}
                                {(item.applications_count ?? 0) > 0 && <span style={{ color: MUTED, fontSize: 12 }}>👥 {item.applications_count} candidato{item.applications_count !== 1 ? "s" : ""}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })
                )}

                {/* ── Eventos ── */}
                {tab === "eventos" && (
                  upcomingEvents.length === 0 && pastEvents.length === 0
                    ? <EmptyState icon="📅" title="Nenhum evento encontrado" sub="Novos eventos serão publicados em breve." />
                    : <>
                        {upcomingEvents.length > 0 && <>
                          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, paddingLeft: 4 }}>Próximos Eventos</div>
                          {upcomingEvents.map(ev => <EventCard key={ev.id} ev={ev} onToggle={handleEventToggle} />)}
                        </>}
                        {pastEvents.length > 0 && <>
                          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, paddingLeft: 4, marginTop: 8 }}>Eventos Passados</div>
                          {pastEvents.map(ev => <EventCard key={ev.id} ev={ev} onToggle={handleEventToggle} past />)}
                        </>}
                      </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Modals (shared) ── */}
        {showCreate && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowCreate(false)}>
            <div style={{ backgroundColor: WHITE, borderRadius: "22px 22px 0 0", width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, backgroundColor: WHITE, zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: NAVY }}>Publicar Oportunidade</h2>
                <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
              </div>
              <div style={{ padding: "20px 24px 60px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 8 }}>Tipo *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([["marketplace", "🛍️ Marketplace"], ["vaga", "💼 Vaga"]] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setCreateTab(key)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${createTab === key ? GOLD : BORDER}`, backgroundColor: createTab === key ? `${GOLD}15` : WHITE, color: createTab === key ? GOLD : MUTED, fontWeight: createTab === key ? 700 : 500, fontSize: 14, cursor: "pointer" }}>{label}</button>
                    ))}
                  </div>
                </div>
                <input placeholder="Título *" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                <textarea placeholder="Descrição (opcional)" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                {createTab === "marketplace" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input placeholder="Categoria (ex: Vinho)" value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))} style={{ padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none" }} />
                    <input placeholder="Preço (ex: R$ 89,90)" value={createForm.price} onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))} style={{ padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none" }} />
                  </div>
                )}
                {createTab === "vaga" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input placeholder="Salário (ex: R$ 4.000–6.000)" value={createForm.salary} onChange={e => setCreateForm(f => ({ ...f, salary: e.target.value }))} style={{ padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none" }} />
                    <select value={createForm.contract_type} onChange={e => setCreateForm(f => ({ ...f, contract_type: e.target.value }))} style={{ padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: WHITE }}>
                      <option value="">Tipo de contrato</option>
                      {CONTRATOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <input placeholder="Empresa" value={createForm.company} onChange={e => setCreateForm(f => ({ ...f, company: e.target.value }))} style={{ padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none" }} />
                <input placeholder="Localização" value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))} style={{ padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none" }} />
                <input placeholder="E-mail de contato" value={createForm.contact_email} onChange={e => setCreateForm(f => ({ ...f, contact_email: e.target.value }))} style={{ padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none" }} />
                <div>
                  <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 4 }}>Expira em</label>
                  <input type="date" value={createForm.expires_at} onChange={e => setCreateForm(f => ({ ...f, expires_at: e.target.value }))} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <button onClick={handleCreate} disabled={!createForm.title.trim() || creating} style={{ padding: "14px 0", backgroundColor: !createForm.title.trim() || creating ? "#ccc" : GOLD, color: WHITE, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: !createForm.title.trim() || creating ? "not-allowed" : "pointer" }}>
                  {creating ? "Publicando..." : "✓ Publicar oportunidade"}
                </button>
              </div>
            </div>
          </div>
        )}
        {lockedPublish && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setLockedPublish(false)}>
            <div style={{ backgroundColor: WHITE, borderRadius: 18, padding: 40, maxWidth: 380, width: "90%", textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🏢</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Apenas empresas podem publicar</h3>
              <p style={{ fontSize: 14, color: MUTED, marginBottom: 24, lineHeight: 1.6 }}>
                A publicação de vagas, eventos e oportunidades de marketplace é exclusiva para perfis de empresa. Crie uma página de empresa ou alterne para uma já existente no seu perfil para continuar.
              </p>
              <a href="/app/perfil" style={{ display: "inline-block", padding: "11px 28px", backgroundColor: GOLD, color: NAVY, borderRadius: 10, fontWeight: 800, fontSize: 14, textDecoration: "none" }}>Ir para Perfil</a>
              <button onClick={() => setLockedPublish(false)} style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", fontSize: 13, color: MUTED, cursor: "pointer" }}>Fechar</button>
            </div>
          </div>
        )}
      </AppShell>
    );
  }
  /* ─────────────────────────── END MOBILE ─────────────────────────── */

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: 0 }}>Oportunidades</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: "4px 0 0" }}>Marketplace, vagas e eventos do setor vitivinícola</p>
          </div>
          <button
            onClick={() => {
              if (!canPublish) { setLockedPublish(true); return; }
              resetCreateForm();
              setShowCreate(true);
              setCreateTab(tab === "vagas" ? "vaga" : "marketplace");
            }}
            style={{ backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            + Publicar
          </button>
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{
                width: "100%",
                padding: "10px 12px 10px 38px",
                border: "1px solid #e8eaed",
                borderRadius: 10,
                fontSize: 14,
                backgroundColor: "#fff",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #e8eaed", paddingBottom: 0 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: "none",
                border: "none",
                padding: "10px 16px",
                borderBottom: tab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
                color: tab === t.key ? GOLD : "#8a93a2",
                fontWeight: tab === t.key ? 700 : 500,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: -2,
                transition: "all 0.15s",
              }}
            >
              {t.icon} {t.label}
              {t.count > 0 && (
                <span style={{
                  backgroundColor: tab === t.key ? GOLD : "#e8eaed",
                  color: tab === t.key ? "#fff" : "#555",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 10,
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        {tab === "market" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {chip("Mais recentes", marketSort === "recente", () => setMarketSort("recente"))}
            {chip("Expirando", marketSort === "expirando", () => setMarketSort("expirando"))}
            {chip("Mais vistos", marketSort === "mais-visualizados", () => setMarketSort("mais-visualizados"))}
            <span style={{ color: "#ccc" }}>|</span>
            {MARKET_CATS.map((c) => chip(c, marketCat === c, () => setMarketCat(marketCat === c ? null : c)))}
          </div>
        )}
        {tab === "vagas" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {MODALIDADES.map((m) => chip(m, vagasModalidade === m, () => setVagasModalidade(vagasModalidade === m ? null : m)))}
            <span style={{ color: "#ccc" }}>|</span>
            {CONTRATOS.map((c) => chip(c, vagasContrato === c, () => setVagasContrato(vagasContrato === c ? null : c)))}
          </div>
        )}
        {tab === "eventos" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {EVENTO_TIPOS.map((t) => chip(t, eventoTipo === t, () => setEventoTipo(eventoTipo === t ? null : t)))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <p>Carregando...</p>
          </div>
        ) : (
          <>
            {/* ── Market ── */}
            {tab === "market" && (
              <>
                {filteredMarket.length === 0 ? (
                  <EmptyState icon="🛍️" title="Nenhum produto encontrado" sub="Tente ajustar os filtros de busca." />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                    {filteredMarket.map((item) => {
                      const novo = isNew(item.created_at);
                      const urgente = isUrgent(item.expires_at);
                      return (
                        <div
                          key={item.id}
                          style={card}
                          onClick={() => setLocation(`/app/oportunidades/${item.id}`)}
                          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                        >
                          {item.cover_image_url && (
                            <img
                              src={item.cover_image_url}
                              alt={item.title}
                              style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10, marginBottom: 12 }}
                            />
                          )}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            {novo && <span style={{ backgroundColor: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Novo</span>}
                            {urgente && <span style={{ backgroundColor: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Urgente</span>}
                            {item.category && <span style={{ backgroundColor: "#f2f3f5", color: "#555", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>{item.category}</span>}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0, flex: 1, lineHeight: 1.3 }}>{item.title}</h3>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleSave(item); }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "0 0 0 8px" }}
                            >{item.is_saved ? "🔖" : "📎"}</button>
                          </div>
                          {item.company && <p style={{ fontSize: 12, color: "#8a93a2", margin: "4px 0 0" }}>🏢 {item.company}</p>}
                          {item.price && <p style={{ fontSize: 14, fontWeight: 700, color: GOLD, margin: "6px 0 0" }}>{item.price}</p>}
                          {item.location && <p style={{ fontSize: 12, color: "#8a93a2", margin: "4px 0 0" }}>📍 {item.location}</p>}
                          {item.expires_at && (
                            <p style={{ fontSize: 11, color: urgente ? "#dc2626" : "#aaa", margin: "4px 0 0" }}>
                              ⏰ Expira: {fmtDate(item.expires_at)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Vagas ── */}
            {tab === "vagas" && (
              <>
                {filteredVagas.length === 0 ? (
                  <EmptyState icon="💼" title="Nenhuma vaga encontrada" sub="Tente ajustar os filtros." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filteredVagas.map((item) => {
                      const nova = isNew(item.created_at);
                      const isRemote = (item.location ?? "").toLowerCase().includes("remot") || (item.location ?? "").toLowerCase().includes("online");
                      return (
                        <div
                          key={item.id}
                          style={{ ...card, border: `1px solid ${item.is_applied ? GOLD : "#e8eaed"}` }}
                          onClick={() => setLocation(`/app/oportunidades/${item.id}`)}
                          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")}
                          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                        >
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                            {nova && <span style={{ backgroundColor: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Nova</span>}
                            {item.location && (
                              <span style={{ backgroundColor: isRemote ? "#ede9fe" : "#f0f9ff", color: isRemote ? "#7c3aed" : "#0369a1", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
                                {isRemote ? "Remoto" : "Presencial"}
                              </span>
                            )}
                            {item.contract_type && (
                              <span style={{ backgroundColor: "#f2f3f5", color: "#555", fontSize: 11, padding: "2px 8px", borderRadius: 6 }}>{item.contract_type}</span>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, margin: 0 }}>{item.title}</h3>
                            {item.is_applied ? (
                              <span style={{ fontSize: 12, color: GOLD, fontWeight: 700, backgroundColor: `${GOLD}18`, padding: "3px 10px", borderRadius: 8 }}>✓ Candidatado</span>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleSave(item); }}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
                              >{item.is_saved ? "🔖" : "📎"}</button>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 16, marginTop: 6, color: "#8a93a2", fontSize: 13 }}>
                            {item.company && <span>🏢 {item.company}</span>}
                            {item.location && <span>📍 {item.location}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 16, marginTop: 6, color: "#8a93a2", fontSize: 12 }}>
                            {item.salary && <span style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>{item.salary}</span>}
                            {(item.applications_count ?? 0) > 0 && (
                              <span>👥 {item.applications_count} candidato{item.applications_count !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Eventos ── */}
            {tab === "eventos" && (
              <>
                {/* Meus Eventos section */}
                {(() => {
                  const meusEventos = eventos.filter((e) => !!e.is_registered);
                  if (meusEventos.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 28 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 12 }}>
                        🎟️ Meus Eventos ({meusEventos.length})
                      </h2>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                        {meusEventos.map((ev) => (
                          <EventCard key={ev.id} ev={ev} onToggle={handleEventToggle} highlighted />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
                  <EmptyState icon="📅" title="Nenhum evento encontrado" sub="Novos eventos serão publicados em breve." />
                ) : (
                  <>
                    {upcomingEvents.length > 0 && (
                      <>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Próximos Eventos</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
                          {upcomingEvents.map((ev) => (
                            <EventCard key={ev.id} ev={ev} onToggle={handleEventToggle} />
                          ))}
                        </div>
                      </>
                    )}
                    {pastEvents.length > 0 && (
                      <>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#8a93a2", marginBottom: 12 }}>Eventos Passados</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                          {pastEvents.map((ev) => (
                            <EventCard key={ev.id} ev={ev} onToggle={handleEventToggle} past />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Criar Oportunidade Modal ── */}
      {showCreate && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{ backgroundColor: "#fff", borderRadius: "22px 22px 0 0", width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e8eaed", position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: NAVY }}>Publicar Oportunidade</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type selector */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 8 }}>Tipo *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([["marketplace", "🛍️ Marketplace"], ["vaga", "💼 Vaga"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCreateTab(key)}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 10,
                        border: `1.5px solid ${createTab === key ? GOLD : "#e8eaed"}`,
                        backgroundColor: createTab === key ? `${GOLD}15` : "#fff",
                        color: createTab === key ? GOLD : "#555",
                        fontWeight: createTab === key ? 700 : 500, fontSize: 14, cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Common fields */}
              <input
                placeholder="Título *"
                value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
              <textarea
                placeholder="Descrição (opcional)"
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
              />

              {/* Marketplace fields */}
              {createTab === "marketplace" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      placeholder="Categoria (ex: Vinho)"
                      value={createForm.category}
                      onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                      style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none" }}
                    />
                    <input
                      placeholder="Preço (ex: R$ 89,90)"
                      value={createForm.price}
                      onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                      style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none" }}
                    />
                  </div>
                </>
              )}

              {/* Vaga fields */}
              {createTab === "vaga" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      placeholder="Salário (ex: R$ 4.000–6.000)"
                      value={createForm.salary}
                      onChange={e => setCreateForm(f => ({ ...f, salary: e.target.value }))}
                      style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none" }}
                    />
                    <select
                      value={createForm.contract_type}
                      onChange={e => setCreateForm(f => ({ ...f, contract_type: e.target.value }))}
                      style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: "#fff", color: createForm.contract_type ? "#000" : "#aaa" }}
                    >
                      <option value="">Tipo de contrato</option>
                      {CONTRATOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Shared bottom fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  placeholder="Empresa"
                  value={createForm.company}
                  onChange={e => setCreateForm(f => ({ ...f, company: e.target.value }))}
                  style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none" }}
                />
                <input
                  placeholder="Localização"
                  value={createForm.location}
                  onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))}
                  style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  placeholder="E-mail de contato"
                  value={createForm.contact_email}
                  onChange={e => setCreateForm(f => ({ ...f, contact_email: e.target.value }))}
                  style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none" }}
                />
                <div>
                  <label style={{ fontSize: 12, color: "#8a93a2", display: "block", marginBottom: 4 }}>Expira em</label>
                  <input
                    type="date"
                    value={createForm.expires_at}
                    onChange={e => setCreateForm(f => ({ ...f, expires_at: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={!createForm.title.trim() || creating}
                style={{
                  padding: "14px 0", backgroundColor: !createForm.title.trim() || creating ? "#ccc" : GOLD,
                  color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800,
                  cursor: !createForm.title.trim() || creating ? "not-allowed" : "pointer", marginTop: 4,
                }}
              >
                {creating ? "Publicando..." : "✓ Publicar oportunidade"}
              </button>
            </div>
          </div>
        </div>
      )}
      {lockedPublish && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLockedPublish(false)}>
          <div style={{ backgroundColor: "#fff", borderRadius: 18, padding: 40, maxWidth: 380, width: "90%", textAlign: "center" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🏢</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0d1b2a", marginBottom: 8 }}>Apenas empresas podem publicar</h3>
            <p style={{ fontSize: 14, color: "#7a8494", marginBottom: 24, lineHeight: 1.6 }}>
              A publicação de vagas, eventos e oportunidades de marketplace é exclusiva para perfis de empresa. Crie uma página de empresa ou alterne para uma já existente no seu perfil para continuar.
            </p>
            <a href="/app/perfil" style={{ display: "inline-block", padding: "11px 28px", backgroundColor: "#c9a84c", color: "#0d1b2a", borderRadius: 10, fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
              Ir para Perfil
            </a>
            <button onClick={() => setLockedPublish(false)} style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", fontSize: 13, color: "#7a8494", cursor: "pointer" }}>Fechar</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0d1b2a", margin: "0 0 8px" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>{sub}</p>
    </div>
  );
}

function EventCard({ ev, onToggle, past = false, highlighted = false }: { ev: AppEvent; onToggle: (ev: AppEvent) => void; past?: boolean; highlighted?: boolean }) {
  const GOLD = "#c9a84c";
  const NAVY = "#0d1b2a";
  const [, setLocation] = useLocation();
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const isOnline = ev.location_type === "online";
  const isFree = ev.entry_type === "gratuito";

  return (
    <div
      style={{
        backgroundColor: highlighted ? `${GOLD}08` : past ? "#fafafa" : "#fff",
        border: `1px solid ${ev.is_registered || highlighted ? GOLD : "#e8eaed"}`,
        borderRadius: 14,
        overflow: "hidden",
        opacity: past ? 0.75 : 1,
        boxShadow: highlighted ? `0 0 0 2px ${GOLD}33` : "none",
        cursor: "pointer",
      }}
      onClick={() => setLocation(`/app/eventos/${ev.id}`)}
    >
      {ev.cover_image_url && (
        <img src={ev.cover_image_url} alt={ev.title} style={{ width: "100%", height: 130, objectFit: "cover" }} />
      )}
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <span style={{ backgroundColor: isOnline ? "#ede9fe" : "#f0f9ff", color: isOnline ? "#7c3aed" : "#0369a1", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
            {isOnline ? "Online" : "Presencial"}
          </span>
          <span style={{ backgroundColor: isFree ? "#dcfce7" : "#fff7ed", color: isFree ? "#16a34a" : "#ea580c", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
            {isFree ? "Gratuito" : "Pago"}
          </span>
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: "0 0 6px", lineHeight: 1.3 }}>{ev.title}</h3>
        <p style={{ fontSize: 12, color: "#8a93a2", margin: "0 0 6px" }}>📅 {fmtDate(ev.start_date)}</p>
        {ev.location && <p style={{ fontSize: 12, color: "#8a93a2", margin: "0 0 10px" }}>📍 {ev.location}</p>}
        {!past && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(ev); }}
            style={{
              width: "100%",
              padding: "9px 0",
              backgroundColor: ev.is_registered ? "#f2f3f5" : GOLD,
              color: ev.is_registered ? "#555" : "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {ev.is_registered ? "✓ Inscrito — Cancelar" : "Inscrever-se"}
          </button>
        )}
      </div>
    </div>
  );
}
