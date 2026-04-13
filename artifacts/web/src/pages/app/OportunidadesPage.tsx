import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  AppOpportunity,
  AppEvent,
  fetchOpportunities,
  fetchEvents,
  toggleSaveOpportunity,
  registerForEvent,
  unregisterFromEvent,
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

export default function OportunidadesPage() {
  const { user } = useAuth();
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

  const loadData = useCallback(async () => {
    setLoading(true);
    const uid = user?.id ?? "";
    const [m, v, ev] = await Promise.all([
      fetchOpportunities("marketplace", uid),
      fetchOpportunities("vaga", uid),
      fetchEvents(uid),
    ]);
    setMarket(m);
    setVagas(v);
    setEventos(ev);
    setLoading(false);
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

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: 0 }}>Oportunidades</h1>
          <p style={{ fontSize: 14, color: "#8a93a2", margin: "4px 0 0" }}>Marketplace, vagas e eventos do setor vitivinícola</p>
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
            {isFree ? "Gratuito" : ev.price ? `R$ ${ev.price}` : "Pago"}
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
