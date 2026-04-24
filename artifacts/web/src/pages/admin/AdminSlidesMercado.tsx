import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const MAIN_TABS = ["Apresentações", "Dados de Mercado", "Categorias"] as const;
type MainTab = typeof MAIN_TABS[number];
type Period = "mes" | "trimestre" | "ano";
const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "trimestre", label: "Trimestre" },
  { key: "ano", label: "Ano" },
];
const MARKET_ICONS = ["activity", "bar-chart-2", "trending-up", "map-pin", "git-merge", "pie-chart", "globe", "layers", "star", "zap", "filter", "award"];

interface MarketPresentation { id: string; title: string; icon: string | null; is_active: boolean; sort_order: number; created_at: string; }
interface MarketKPI { id: string; period: Period; titulo: string; valor: string; descricao: string | null; variacao_pct: number | null; icon: string | null; sort_order: number; }
interface MarketTendencia { id: string; period: Period; titulo: string; descricao: string | null; variacao_pct: number | null; sort_order: number; }
interface MarketRegiao { id: string; period: Period; nome: string; volume_litros: number | null; pct_total: number | null; sort_order: number; }
interface MarketVariedade { id: string; period: Period; nome: string; volume_litros: number | null; variacao_pct: number | null; sort_order: number; }
interface MarketPermission { id: string; plan_id: string; section_key: string; label: string; icon: string; is_enabled: boolean; sort_order: number; }

const DEFAULT_PERM_IDS = new Set(["kpis", "graficos", "tendencias", "regioes", "variedades"]);

export default function AdminSlidesMercado() {
  const [tab, setTab] = useState<MainTab>("Apresentações");
  const [period, setPeriod] = useState<Period>("mes");

  const [presentations, setPresentations] = useState<MarketPresentation[]>([]);
  const [loadingPres, setLoadingPres] = useState(true);
  const [showNewPres, setShowNewPres] = useState(false);
  const [newPresTitle, setNewPresTitle] = useState("");
  const [newPresIcon, setNewPresIcon] = useState(MARKET_ICONS[0]);
  const [creatingPres, setCreatingPres] = useState(false);
  const [deletingPresId, setDeletingPresId] = useState<string | null>(null);

  const [kpis, setKpis] = useState<MarketKPI[]>([]);
  const [tendencias, setTendencias] = useState<MarketTendencia[]>([]);
  const [regioes, setRegioes] = useState<MarketRegiao[]>([]);
  const [variedades, setVariedades] = useState<MarketVariedade[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [permissions, setPermissions] = useState<MarketPermission[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [togglingPerm, setTogglingPerm] = useState<string | null>(null);

  const [showItemModal, setShowItemModal] = useState(false);
  const [itemType, setItemType] = useState<"kpi" | "tendencia" | "regiao" | "variedade">("kpi");
  const [itemEdit, setItemEdit] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState(false);
  const [itemMsg, setItemMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadPresentations = useCallback(async () => {
    setLoadingPres(true);
    const { data } = await supabase.from("market_presentations").select("*").order("sort_order", { ascending: true });
    setPresentations((data ?? []) as MarketPresentation[]);
    setLoadingPres(false);
  }, []);

  const loadMarketData = useCallback(async () => {
    setLoadingData(true);
    const [kpisRes, tendRes, regRes, varRes] = await Promise.all([
      supabase.from("market_kpis").select("*").eq("period", period).order("sort_order", { ascending: true }),
      supabase.from("market_tendencias").select("*").eq("period", period).order("sort_order", { ascending: true }),
      supabase.from("market_regioes").select("*").eq("period", period).order("sort_order", { ascending: true }),
      supabase.from("market_variedades").select("*").eq("period", period).order("sort_order", { ascending: true }),
    ]);
    setKpis((kpisRes.data ?? []) as MarketKPI[]);
    setTendencias((tendRes.data ?? []) as MarketTendencia[]);
    setRegioes((regRes.data ?? []) as MarketRegiao[]);
    setVariedades((varRes.data ?? []) as MarketVariedade[]);
    setLoadingData(false);
  }, [period]);

  const loadPermissions = useCallback(async () => {
    setLoadingPerms(true);
    const { data } = await supabase.from("market_permissions").select("*").order("sort_order", { ascending: true });
    setPermissions((data ?? []) as MarketPermission[]);
    setLoadingPerms(false);
  }, []);

  useEffect(() => { void loadPresentations(); }, [loadPresentations]);
  useEffect(() => { if (tab === "Dados de Mercado") void loadMarketData(); }, [tab, loadMarketData]);
  useEffect(() => { if (tab === "Categorias") void loadPermissions(); }, [tab, loadPermissions]);

  const handleTogglePres = async (p: MarketPresentation) => {
    await supabase.from("market_presentations").update({ is_active: !p.is_active }).eq("id", p.id);
    void loadPresentations();
  };

  const handleDeletePres = async (p: MarketPresentation) => {
    if (!confirm(`Excluir apresentação "${p.title}"? Esta ação é irreversível.`)) return;
    setDeletingPresId(p.id);
    await supabase.from("market_presentations").delete().eq("id", p.id);
    setPresentations((prev) => prev.filter((x) => x.id !== p.id));
    setDeletingPresId(null);
  };

  const handleCreatePresentation = async () => {
    if (!newPresTitle.trim()) return;
    setCreatingPres(true);
    const maxOrder = presentations.reduce((m, p) => Math.max(m, p.sort_order ?? 0), -1);
    const { error } = await supabase.from("market_presentations").insert({ title: newPresTitle.trim(), icon: newPresIcon, is_active: true, sort_order: maxOrder + 1 });
    if (!error) { setNewPresTitle(""); setShowNewPres(false); void loadPresentations(); }
    else alert("Erro ao criar apresentação: " + error.message);
    setCreatingPres(false);
  };

  const openNewItem = (type: typeof itemType) => {
    setItemType(type);
    setItemEdit({});
    setItemMsg(null);
    setShowItemModal(true);
  };

  const handleDeleteItem = async (type: typeof itemType, id: string) => {
    if (!confirm("Excluir este item?")) return;
    const table = type === "kpi" ? "market_kpis" : type === "tendencia" ? "market_tendencias" : type === "regiao" ? "market_regioes" : "market_variedades";
    await supabase.from(table as string).delete().eq("id", id);
    void loadMarketData();
  };

  const handleSaveItem = async () => {
    setSavingItem(true);
    setItemMsg(null);
    try {
      const table = itemType === "kpi" ? "market_kpis" : itemType === "tendencia" ? "market_tendencias" : itemType === "regiao" ? "market_regioes" : "market_variedades";
      const data: Record<string, unknown> = { period };
      if (itemType === "kpi") {
        data.titulo = itemEdit.titulo ?? "";
        data.valor = itemEdit.valor ?? "";
        data.descricao = itemEdit.descricao ?? null;
        data.variacao_pct = itemEdit.variacao_pct ? parseFloat(itemEdit.variacao_pct) : null;
        data.icon = itemEdit.icon ?? "activity";
        data.sort_order = kpis.length;
      } else if (itemType === "tendencia") {
        data.titulo = itemEdit.titulo ?? "";
        data.descricao = itemEdit.descricao ?? null;
        data.variacao_pct = itemEdit.variacao_pct ? parseFloat(itemEdit.variacao_pct) : null;
        data.sort_order = tendencias.length;
      } else if (itemType === "regiao") {
        data.nome = itemEdit.nome ?? "";
        data.volume_litros = itemEdit.volume_litros ? parseFloat(itemEdit.volume_litros) : null;
        data.pct_total = itemEdit.pct_total ? parseFloat(itemEdit.pct_total) : null;
        data.sort_order = regioes.length;
      } else {
        data.nome = itemEdit.nome ?? "";
        data.volume_litros = itemEdit.volume_litros ? parseFloat(itemEdit.volume_litros) : null;
        data.variacao_pct = itemEdit.variacao_pct ? parseFloat(itemEdit.variacao_pct) : null;
        data.sort_order = variedades.length;
      }
      const { error } = await supabase.from(table as string).insert(data as Record<string, unknown>);
      if (error) throw error;
      setItemMsg({ type: "success", text: "Item adicionado com sucesso!" });
      void loadMarketData();
    } catch (e) {
      setItemMsg({ type: "error", text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSavingItem(false);
    }
  };

  const handleTogglePerm = async (perm: MarketPermission) => {
    setTogglingPerm(perm.id);
    await supabase.from("market_permissions").update({ is_enabled: !perm.is_enabled }).eq("id", perm.id);
    setPermissions((prev) => prev.map((p) => p.id === perm.id ? { ...p, is_enabled: !perm.is_enabled } : p));
    setTogglingPerm(null);
  };

  const planGroups: Record<string, MarketPermission[]> = {};
  for (const p of permissions) {
    planGroups[p.plan_id] = [...(planGroups[p.plan_id] ?? []), p];
  }

  const inp = (label: string, key: string, placeholder?: string, type?: string) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", marginBottom: 5 }}>{label}</label>
      <input value={itemEdit[key] ?? ""} onChange={(e) => setItemEdit((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} type={type ?? "text"} style={{ width: "100%", padding: "8px 12px", border: "1px solid #e8eaed", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
    </div>
  );

  const itemFormFields = () => {
    if (itemType === "kpi") return <>{inp("Título", "titulo", "Ex: Volume Total")}{inp("Valor", "valor", "Ex: 12.4M litros")}{inp("Variação %", "variacao_pct", "Ex: 5.2", "number")}{inp("Descrição", "descricao", "Contexto adicional")}</>;
    if (itemType === "tendencia") return <>{inp("Título", "titulo", "Ex: Alta do vinho natural")}{inp("Variação %", "variacao_pct", "Ex: 12.3", "number")}{inp("Descrição", "descricao", "Descrição da tendência")}</>;
    if (itemType === "regiao") return <>{inp("Nome", "nome", "Ex: São Paulo")}{inp("Volume (litros)", "volume_litros", "Ex: 450000", "number")}{inp("% do total", "pct_total", "Ex: 28.5", "number")}</>;
    return <>{inp("Nome", "nome", "Ex: Cabernet Sauvignon")}{inp("Volume (litros)", "volume_litros", "Ex: 320000", "number")}{inp("Variação %", "variacao_pct", "Ex: 8.1", "number")}</>;
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Mercado</h1>
          <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Conteúdo de dados de mercado vinícola</p>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #e8eaed" }}>
          {MAIN_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: tab === t ? 700 : 400, color: tab === t ? GOLD : "#555", borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent", marginBottom: -2, transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Apresentações" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={() => setShowNewPres(true)} style={{ padding: "9px 18px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Nova Apresentação</button>
            </div>

            {showNewPres && (
              <div style={{ marginBottom: 20, padding: 20, backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Nova Apresentação</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Título *</label>
                  <input value={newPresTitle} onChange={(e) => setNewPresTitle(e.target.value)} placeholder="Ex: Relatório de Vinhos 2024" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Ícone</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {MARKET_ICONS.map((icon) => (
                      <button key={icon} onClick={() => setNewPresIcon(icon)} style={{ padding: "6px 10px", border: `1px solid ${newPresIcon === icon ? GOLD : "#e8eaed"}`, borderRadius: 6, backgroundColor: newPresIcon === icon ? `${GOLD}12` : "#fff", cursor: "pointer", fontSize: 12, color: newPresIcon === icon ? GOLD : "#555" }}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowNewPres(false)} style={{ flex: 1, padding: "8px", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                  <button onClick={handleCreatePresentation} disabled={creatingPres} style={{ flex: 2, padding: "8px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>{creatingPres ? "Criando..." : "Criar"}</button>
                </div>
              </div>
            )}

            {loadingPres ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando...</div>
            ) : presentations.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                Nenhuma apresentação. Crie a primeira!
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {presentations.map((p) => (
                  <div key={p.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18, opacity: p.is_active ? 1 : 0.6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${GOLD}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📊</div>
                      <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: p.is_active ? "#d1fae5" : "#f3f4f6", color: p.is_active ? "#059669" : "#6b7280", padding: "2px 8px", borderRadius: 5 }}>{p.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 14 }}>{new Date(p.created_at).toLocaleDateString("pt-BR")}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleTogglePres(p)} style={{ flex: 1, padding: "7px", backgroundColor: p.is_active ? "#fef2f2" : "#f0fdf4", color: p.is_active ? "#dc2626" : "#16a34a", border: `1px solid ${p.is_active ? "#fca5a5" : "#86efac"}`, borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        {p.is_active ? "Pausar" : "Ativar"}
                      </button>
                      <button onClick={() => handleDeletePres(p)} disabled={deletingPresId === p.id} style={{ padding: "7px 12px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>
                        {deletingPresId === p.id ? "..." : "🗑"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Dados de Mercado" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
              {PERIODS.map((p) => (
                <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding: "8px 20px", border: `1px solid ${period === p.key ? GOLD : "#e8eaed"}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: period === p.key ? 700 : 400, backgroundColor: period === p.key ? `${GOLD}12` : "#fff", color: period === p.key ? GOLD : "#555" }}>
                  {p.label}
                </button>
              ))}
            </div>

            {loadingData ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando dados...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {([
                  { key: "kpi", label: "KPIs", items: kpis, fields: ["titulo", "valor", "variacao_pct"] },
                  { key: "tendencia", label: "Tendências", items: tendencias, fields: ["titulo", "variacao_pct"] },
                  { key: "regiao", label: "Regiões", items: regioes, fields: ["nome", "volume_litros", "pct_total"] },
                  { key: "variedade", label: "Variedades", items: variedades, fields: ["nome", "volume_litros", "variacao_pct"] },
                ] as Array<{ key: typeof itemType; label: string; items: Array<Record<string, unknown>>; fields: string[] }>).map((section) => (
                  <div key={section.key} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{section.label}</div>
                      <button onClick={() => openNewItem(section.key)} style={{ padding: "5px 12px", backgroundColor: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Add</button>
                    </div>
                    {section.items.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 24, color: "#aaa", fontSize: 13 }}>Sem dados para este período.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {section.items.map((item) => (
                          <div key={item.id as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", backgroundColor: "#fafbfc", border: "1px solid #e8eaed", borderRadius: 9 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {(item.titulo ?? item.nome) as string}
                              </div>
                              <div style={{ fontSize: 11, color: "#8a93a2" }}>
                                {section.fields.slice(1).map((f) => item[f] != null ? `${f}: ${item[f]}` : null).filter(Boolean).join(" · ")}
                              </div>
                            </div>
                            <button onClick={() => handleDeleteItem(section.key, item.id as string)} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>🗑</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Categorias" && (
          <div>
            <p style={{ fontSize: 14, color: "#8a93a2", marginBottom: 20 }}>Configure quais seções do Mercado cada plano pode acessar.</p>
            {loadingPerms ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando...</div>
            ) : Object.keys(planGroups).length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>Nenhuma permissão configurada.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {Object.entries(planGroups).map(([planId, perms]) => (
                  <div key={planId} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 14 }}>Plano: {planId}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {perms.map((perm) => (
                        <div key={perm.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ flex: 1, fontSize: 13, color: "#333" }}>{perm.label}</div>
                          <div
                            onClick={() => !DEFAULT_PERM_IDS.has(perm.section_key) && handleTogglePerm(perm)}
                            style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: perm.is_enabled ? NAVY : "#d1d5db", cursor: DEFAULT_PERM_IDS.has(perm.section_key) ? "not-allowed" : "pointer", position: "relative", opacity: togglingPerm === perm.id ? 0.6 : 1, transition: "background 0.2s" }}
                          >
                            <div style={{ position: "absolute", top: 2, left: perm.is_enabled ? 22 : 2, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: perm.is_enabled ? NAVY : "#9ca3af", minWidth: 28 }}>{perm.is_enabled ? "ON" : "OFF"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showItemModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: 0 }}>
                Adicionar {itemType === "kpi" ? "KPI" : itemType === "tendencia" ? "Tendência" : itemType === "regiao" ? "Região" : "Variedade"}
              </h2>
              <button onClick={() => setShowItemModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>
            {itemFormFields()}
            {itemMsg && (
              <div style={{ marginBottom: 14, padding: "10px 14px", backgroundColor: itemMsg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${itemMsg.type === "success" ? "#86efac" : "#fca5a5"}`, borderRadius: 8, fontSize: 13, color: itemMsg.type === "success" ? "#16a34a" : "#dc2626" }}>
                {itemMsg.text}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={() => setShowItemModal(false)} style={{ flex: 1, padding: "10px", backgroundColor: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSaveItem} disabled={savingItem} style={{ flex: 2, padding: "10px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: savingItem ? 0.6 : 1 }}>
                {savingItem ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
