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

// ── Types matching actual Supabase schema ─────────────────────────────────────

interface MarketPresentation {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  content_url: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

interface MarketKPI { label: string; value: string; period: string; change: number; icon?: string; description?: string; }
interface MarketTendencia { title: string; desc: string; change: number; pos: boolean; }
interface MarketRegiao { rank: number; name: string; volume: string; pct: number; }
interface MarketVariedade { name: string; volume: string; change: number; }
interface MarketChartArea { exports: number[]; imports: number[]; labels: string[]; yLabels: string[]; }
interface MarketChartBar { values: number[]; labels: string[]; }
interface MarketOverview {
  period: Period;
  kpis: MarketKPI[];
  chart_area: MarketChartArea;
  chart_bar: MarketChartBar;
  tendencias: MarketTendencia[];
  regioes: MarketRegiao[];
  variedades: MarketVariedade[];
  updated_at: string;
  [key: string]: unknown;
}

interface MarketPermission {
  id: string;
  title: string;
  icon: string;
  sort_order: number;
  section_type: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function numArr(s: string): number[] {
  return s.split(",").map(x => parseFloat(x.trim())).filter(n => !isNaN(n));
}
function strArr(s: string): string[] {
  return s.split(",").map(x => x.trim()).filter(Boolean);
}
function joinNum(arr: number[]): string { return arr.join(", "); }
function joinStr(arr: string[]): string { return arr.join(", "); }
function toSlug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

const inp = (
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { placeholder?: string; type?: string; multiline?: boolean }
) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", marginBottom: 5, textTransform: "uppercase" }}>
      {label}
    </label>
    {opts?.multiline ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        rows={3}
        style={{ width: "100%", padding: "8px 12px", border: "1px solid #e8eaed", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
      />
    ) : (
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        type={opts?.type ?? "text"}
        style={{ width: "100%", padding: "8px 12px", border: "1px solid #e8eaed", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" }}
      />
    )}
  </div>
);

const sectionCard = (title: string, children: React.ReactNode, action?: React.ReactNode) => (
  <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20, marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{title}</div>
      {action}
    </div>
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminSlidesMercado() {
  const [tab, setTab] = useState<MainTab>("Apresentações");
  const [period, setPeriod] = useState<Period>("mes");

  // ── Apresentações ─────────────────────────────────────────────────────────
  const [presentations, setPresentations] = useState<MarketPresentation[]>([]);
  const [loadingPres, setLoadingPres] = useState(true);
  const [presModal, setPresModal] = useState(false);
  const [presEdit, setPresEdit] = useState<MarketPresentation | null>(null);
  const [presTitle, setPresTitle] = useState("");
  const [presDesc, setPresDesc] = useState("");
  const [presCover, setPresCover] = useState("");
  const [presContent, setPresContent] = useState("");
  const [presPublished, setPresPublished] = useState(true);
  const [presSaving, setPresSaving] = useState(false);
  const [deletingPresId, setDeletingPresId] = useState<string | null>(null);

  const loadPresentations = useCallback(async () => {
    setLoadingPres(true);
    const { data } = await supabase
      .from("market_presentations")
      .select("*")
      .order("created_at", { ascending: false });
    setPresentations((data ?? []) as MarketPresentation[]);
    setLoadingPres(false);
  }, []);

  useEffect(() => { if (tab === "Apresentações") void loadPresentations(); }, [tab, loadPresentations]);

  const openNewPres = () => {
    setPresEdit(null);
    setPresTitle(""); setPresDesc(""); setPresCover(""); setPresContent(""); setPresPublished(true);
    setPresModal(true);
  };

  const openEditPres = (p: MarketPresentation) => {
    setPresEdit(p);
    setPresTitle(p.title); setPresDesc(p.description ?? ""); setPresCover(p.cover_url ?? ""); setPresContent(p.content_url); setPresPublished(p.published);
    setPresModal(true);
  };

  const handleSavePres = async () => {
    if (!presTitle.trim()) { alert("Título é obrigatório"); return; }
    if (!presContent.trim()) { alert("Link do conteúdo é obrigatório"); return; }
    setPresSaving(true);
    const payload: Partial<MarketPresentation> & { updated_at: string } = {
      title: presTitle.trim(),
      description: presDesc.trim() || null,
      cover_url: presCover.trim() || null,
      content_url: presContent.trim(),
      published: presPublished,
      updated_at: new Date().toISOString(),
    };
    if (presEdit) {
      await supabase.from("market_presentations").update(payload).eq("id", presEdit.id);
    } else {
      await supabase.from("market_presentations").insert({ ...payload, created_at: new Date().toISOString() });
    }
    setPresSaving(false);
    setPresModal(false);
    void loadPresentations();
  };

  const handleDeletePres = async (p: MarketPresentation) => {
    if (!confirm(`Excluir "${p.title}"?`)) return;
    setDeletingPresId(p.id);
    await supabase.from("market_presentations").delete().eq("id", p.id);
    setPresentations(prev => prev.filter(x => x.id !== p.id));
    setDeletingPresId(null);
  };

  const handleTogglePublished = async (p: MarketPresentation) => {
    await supabase.from("market_presentations").update({ published: !p.published, updated_at: new Date().toISOString() }).eq("id", p.id);
    void loadPresentations();
  };

  // ── Dados de Mercado ──────────────────────────────────────────────────────
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState<MarketKPI[]>([]);
  // Chart area
  const [areaExp, setAreaExp] = useState("");
  const [areaImp, setAreaImp] = useState("");
  const [areaLbl, setAreaLbl] = useState("");
  // Chart bar
  const [barVal, setBarVal] = useState("");
  const [barLbl, setBarLbl] = useState("");
  // Lists
  const [tendencias, setTendencias] = useState<MarketTendencia[]>([]);
  const [regioes, setRegioes] = useState<MarketRegiao[]>([]);
  const [variedades, setVariedades] = useState<MarketVariedade[]>([]);

  const loadOverview = useCallback(async (p: Period) => {
    setLoadingData(true);
    const { data } = await supabase.from("market_overview").select("*").eq("period", p).maybeSingle();
    if (data) {
      const d = data as MarketOverview;
      setOverview(d);
      setKpis(d.kpis ?? []);
      setAreaExp(joinNum(d.chart_area?.exports ?? []));
      setAreaImp(joinNum(d.chart_area?.imports ?? []));
      setAreaLbl(joinStr(d.chart_area?.labels ?? []));
      setBarVal(joinNum(d.chart_bar?.values ?? []));
      setBarLbl(joinStr(d.chart_bar?.labels ?? []));
      setTendencias(d.tendencias ?? []);
      setRegioes(d.regioes ?? []);
      setVariedades(d.variedades ?? []);
    } else {
      setOverview(null);
      setKpis([]); setAreaExp(""); setAreaImp(""); setAreaLbl(""); setBarVal(""); setBarLbl("");
      setTendencias([]); setRegioes([]); setVariedades([]);
    }
    setLoadingData(false);
  }, []);

  useEffect(() => { if (tab === "Dados de Mercado") void loadOverview(period); }, [tab, period, loadOverview]);

  const handleSaveOverview = async () => {
    setSaving(true);
    const payload = {
      period,
      kpis,
      chart_area: { exports: numArr(areaExp), imports: numArr(areaImp), labels: strArr(areaLbl), yLabels: [] },
      chart_bar: { values: numArr(barVal), labels: strArr(barLbl) },
      tendencias,
      regioes,
      variedades,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("market_overview").upsert(payload, { onConflict: "period" });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else alert("Erro ao salvar: " + error.message);
  };

  // item modals
  type ModalKind = "tendencia" | "regiao" | "variedade" | "kpi";
  const [itemModal, setItemModal] = useState<{ kind: ModalKind; idx: number | null } | null>(null);
  const [mLabel, setMLabel] = useState("");
  const [mValue, setMValue] = useState("");
  const [mPeriodF, setMPeriodF] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mChange, setMChange] = useState("");
  const [mPos, setMPos] = useState(true);
  const [mRank, setMRank] = useState("");
  const [mName, setMName] = useState("");
  const [mVolume, setMVolume] = useState("");
  const [mPct, setMPct] = useState("");
  const [mVarName, setMVarName] = useState("");
  const [mVarVol, setMVarVol] = useState("");
  const [mVarChg, setMVarChg] = useState("");

  const openItemModal = (kind: ModalKind, idx: number | null) => {
    if (kind === "tendencia") {
      const t = idx !== null ? tendencias[idx] : null;
      setMTitle(t?.title ?? ""); setMDesc(t?.desc ?? ""); setMChange(t ? String(t.change) : ""); setMPos(t?.pos ?? true);
    } else if (kind === "regiao") {
      const r = idx !== null ? regioes[idx] : null;
      setMRank(r ? String(r.rank) : String(regioes.length + 1)); setMName(r?.name ?? ""); setMVolume(r?.volume ?? ""); setMPct(r ? String(r.pct) : "");
    } else if (kind === "variedade") {
      const v = idx !== null ? variedades[idx] : null;
      setMVarName(v?.name ?? ""); setMVarVol(v?.volume ?? ""); setMVarChg(v ? String(v.change) : "");
    } else if (kind === "kpi") {
      const k = idx !== null ? kpis[idx] : null;
      setMLabel(k?.label ?? ""); setMValue(k?.value ?? ""); setMPeriodF(k?.period ?? ""); setMChange(k ? String(k.change) : "");
    }
    setItemModal({ kind, idx });
  };

  const handleSaveItem = () => {
    if (!itemModal) return;
    const { kind, idx } = itemModal;
    if (kind === "tendencia") {
      const item: MarketTendencia = { title: mTitle.trim(), desc: mDesc.trim(), change: parseFloat(mChange) || 0, pos: mPos };
      setTendencias(prev => idx !== null ? prev.map((x, i) => i === idx ? item : x) : [...prev, item]);
    } else if (kind === "regiao") {
      const item: MarketRegiao = { rank: parseInt(mRank) || regioes.length + 1, name: mName.trim(), volume: mVolume.trim(), pct: parseFloat(mPct) || 0 };
      setRegioes(prev => idx !== null ? prev.map((x, i) => i === idx ? item : x) : [...prev, item]);
    } else if (kind === "variedade") {
      const item: MarketVariedade = { name: mVarName.trim(), volume: mVarVol.trim(), change: parseFloat(mVarChg) || 0 };
      setVariedades(prev => idx !== null ? prev.map((x, i) => i === idx ? item : x) : [...prev, item]);
    } else if (kind === "kpi") {
      const item: MarketKPI = { label: mLabel.trim(), value: mValue.trim(), period: mPeriodF.trim(), change: parseFloat(mChange) || 0, icon: "activity" };
      setKpis(prev => idx !== null ? prev.map((x, i) => i === idx ? item : x) : [...prev, item]);
    }
    setItemModal(null);
  };

  const handleDeleteItem = (kind: ModalKind, idx: number) => {
    if (!confirm("Remover este item?")) return;
    if (kind === "tendencia") setTendencias(prev => prev.filter((_, i) => i !== idx));
    else if (kind === "regiao") setRegioes(prev => prev.filter((_, i) => i !== idx));
    else if (kind === "variedade") setVariedades(prev => prev.filter((_, i) => i !== idx));
    else if (kind === "kpi") setKpis(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Categorias ────────────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState<MarketPermission[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [permModal, setPermModal] = useState(false);
  const [permEdit, setPermEdit] = useState<MarketPermission | null>(null);
  const [permTitle, setPermTitle] = useState("");
  const [permIcon, setPermIcon] = useState("bar-chart-2");
  const [permSectionType, setPermSectionType] = useState("lista");
  const [permSaving, setPermSaving] = useState(false);
  const [deletingPermId, setDeletingPermId] = useState<string | null>(null);

  const SECTION_TYPES = [
    { key: "lista", label: "Lista (título + variação)" },
    { key: "ranking", label: "Ranking (nome + volume + %)" },
    { key: "simples", label: "Simples (nome + volume + variação)" },
    { key: "kpi", label: "KPI (valor + período)" },
    { key: "grafico", label: "Gráfico" },
  ];

  const loadPermissions = useCallback(async () => {
    setLoadingPerms(true);
    const { data } = await supabase.from("market_permissions").select("*").order("sort_order", { ascending: true });
    setPermissions((data ?? []) as MarketPermission[]);
    setLoadingPerms(false);
  }, []);

  useEffect(() => { if (tab === "Categorias") void loadPermissions(); }, [tab, loadPermissions]);

  const openNewPerm = () => {
    setPermEdit(null); setPermTitle(""); setPermIcon("bar-chart-2"); setPermSectionType("lista");
    setPermModal(true);
  };
  const openEditPerm = (p: MarketPermission) => {
    setPermEdit(p); setPermTitle(p.title); setPermIcon(p.icon); setPermSectionType(p.section_type);
    setPermModal(true);
  };

  const handleSavePerm = async () => {
    if (!permTitle.trim()) { alert("Nome obrigatório"); return; }
    setPermSaving(true);
    if (permEdit) {
      await supabase.from("market_permissions").update({ title: permTitle.trim(), icon: permIcon, section_type: permSectionType }).eq("id", permEdit.id);
    } else {
      const slug = toSlug(permTitle.trim()) || `mp_${Date.now()}`;
      const maxOrder = permissions.reduce((m, p) => Math.max(m, p.sort_order ?? 0), -1);
      await supabase.from("market_permissions").insert({ id: slug, title: permTitle.trim(), icon: permIcon, section_type: permSectionType, sort_order: maxOrder + 1 });
    }
    setPermSaving(false);
    setPermModal(false);
    void loadPermissions();
  };

  const handleDeletePerm = async (p: MarketPermission) => {
    if (!confirm(`Remover categoria "${p.title}"?`)) return;
    setDeletingPermId(p.id);
    await supabase.from("market_permissions").delete().eq("id", p.id);
    setPermissions(prev => prev.filter(x => x.id !== p.id));
    setDeletingPermId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const btnPrimary: React.CSSProperties = { padding: "8px 18px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 };
  const btnSecondary: React.CSSProperties = { padding: "8px 14px", backgroundColor: "#f3f4f6", color: "#333", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13 };
  const btnDanger: React.CSSProperties = { padding: "6px 12px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 7, cursor: "pointer", fontSize: 12 };
  const chip = (label: string, onClick?: () => void): React.CSSProperties => ({
    padding: "5px 12px", backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}44`,
    borderRadius: 6, cursor: onClick ? "pointer" : "default", fontSize: 12, fontWeight: 700,
  });

  const renderItemRow = (kind: ModalKind, label: string, sub: string, idx: number) => (
    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", backgroundColor: "#fafbfc", border: "1px solid #e8eaed", borderRadius: 9, marginBottom: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#8a93a2" }}>{sub}</div>}
      </div>
      <button onClick={() => openItemModal(kind, idx)} style={{ ...chip(""), fontSize: 11 }}>Editar</button>
      <button onClick={() => handleDeleteItem(kind, idx)} style={btnDanger}>🗑</button>
    </div>
  );

  return (
    <AdminShell>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Mercado</h1>
          <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Conteúdo de dados de mercado vinícola</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #e8eaed" }}>
          {MAIN_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: tab === t ? 700 : 400, color: tab === t ? GOLD : "#555", borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent", marginBottom: -2, transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Apresentações ── */}
        {tab === "Apresentações" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={openNewPres} style={btnPrimary}>+ Nova Apresentação</button>
            </div>
            {loadingPres ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando...</div>
            ) : presentations.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                Nenhuma apresentação. Crie a primeira!
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {presentations.map(p => (
                  <div key={p.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18, opacity: p.published ? 1 : 0.65 }}>
                    {p.cover_url && (
                      <img src={p.cover_url} alt={p.title} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, marginBottom: 12 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, flex: 1, marginRight: 8 }}>{p.title}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: p.published ? "#d1fae5" : "#f3f4f6", color: p.published ? "#059669" : "#6b7280", padding: "2px 8px", borderRadius: 5, whiteSpace: "nowrap" }}>
                        {p.published ? "Publicado" : "Rascunho"}
                      </span>
                    </div>
                    {p.description && <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, lineHeight: 1.5 }}>{p.description}</p>}
                    <a href={p.content_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: GOLD, wordBreak: "break-all", display: "block", marginBottom: 12 }}>
                      🔗 {p.content_url}
                    </a>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleTogglePublished(p)} style={{ flex: 1, padding: "7px", backgroundColor: p.published ? "#fef2f2" : "#f0fdf4", color: p.published ? "#dc2626" : "#16a34a", border: `1px solid ${p.published ? "#fca5a5" : "#86efac"}`, borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        {p.published ? "Despublicar" : "Publicar"}
                      </button>
                      <button onClick={() => openEditPres(p)} style={{ padding: "7px 12px", backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}40`, borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏️</button>
                      <button onClick={() => handleDeletePres(p)} disabled={deletingPresId === p.id} style={btnDanger}>
                        {deletingPresId === p.id ? "..." : "🗑"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Dados de Mercado ── */}
        {tab === "Dados de Mercado" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {PERIODS.map(p => (
                  <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding: "8px 20px", border: `1px solid ${period === p.key ? GOLD : "#e8eaed"}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: period === p.key ? 700 : 400, backgroundColor: period === p.key ? `${GOLD}12` : "#fff", color: period === p.key ? GOLD : "#555" }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              {saved && <span style={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>✓ Salvo!</span>}
              <button onClick={handleSaveOverview} disabled={saving || loadingData} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>

            {loadingData ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando dados do período...</div>
            ) : (
              <div>
                {!overview && (
                  <div style={{ padding: "16px 20px", backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}40`, borderRadius: 10, marginBottom: 20, fontSize: 13, color: "#92713a" }}>
                    ℹ️ Nenhum dado para este período ainda. Preencha abaixo e clique em "Salvar alterações" para criar.
                  </div>
                )}

                {/* KPIs */}
                {sectionCard(
                  `KPIs (${kpis.length})`,
                  <>
                    {kpis.map((k, i) => renderItemRow("kpi", `${k.label}: ${k.value}`, `Período: ${k.period} · Variação: ${k.change}%`, i))}
                    {kpis.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Sem KPIs. Adicione abaixo.</p>}
                  </>,
                  <button onClick={() => openItemModal("kpi", null)} style={chip("")}>+ Adicionar KPI</button>
                )}

                {/* Gráficos */}
                {sectionCard("Gráficos", (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#8a93a2", marginBottom: 10 }}>ÁREA — Exportações / Importações (separados por vírgula)</p>
                      {inp("Exportações", areaExp, setAreaExp, { placeholder: "3.2, 3.5, 3.8..." })}
                      {inp("Importações", areaImp, setAreaImp, { placeholder: "2.1, 2.4, 2.6..." })}
                      {inp("Labels (meses)", areaLbl, setAreaLbl, { placeholder: "Jan, Fev, Mar..." })}
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#8a93a2", marginBottom: 10 }}>BARRAS — Produção Nacional</p>
                      {inp("Valores", barVal, setBarVal, { placeholder: "320, 290, 345, 310" })}
                      {inp("Labels", barLbl, setBarLbl, { placeholder: "Q1, Q2, Q3, Q4" })}
                    </div>
                  </div>
                ))}

                {/* Tendências */}
                {sectionCard(
                  `Tendências (${tendencias.length})`,
                  <>
                    {tendencias.map((t, i) => renderItemRow("tendencia", t.title, `${t.pos ? "▲" : "▼"} ${t.change}% · ${t.desc}`, i))}
                    {tendencias.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Sem tendências.</p>}
                  </>,
                  <button onClick={() => openItemModal("tendencia", null)} style={chip("")}>+ Adicionar</button>
                )}

                {/* Regiões */}
                {sectionCard(
                  `Regiões (${regioes.length})`,
                  <>
                    {regioes.map((r, i) => renderItemRow("regiao", `${r.rank}. ${r.name}`, `Volume: ${r.volume} · ${r.pct}%`, i))}
                    {regioes.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Sem regiões.</p>}
                  </>,
                  <button onClick={() => openItemModal("regiao", null)} style={chip("")}>+ Adicionar</button>
                )}

                {/* Variedades */}
                {sectionCard(
                  `Variedades (${variedades.length})`,
                  <>
                    {variedades.map((v, i) => renderItemRow("variedade", v.name, `Volume: ${v.volume} · ${v.change > 0 ? "+" : ""}${v.change}%`, i))}
                    {variedades.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Sem variedades.</p>}
                  </>,
                  <button onClick={() => openItemModal("variedade", null)} style={chip("")}>+ Adicionar</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Categorias ── */}
        {tab === "Categorias" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: "#8a93a2", margin: 0, maxWidth: 500 }}>
                Categorias de mercado exibidas no app. Cada categoria corresponde a uma seção na tela de Mercado do usuário.
              </p>
              <button onClick={openNewPerm} style={btnPrimary}>+ Nova Categoria</button>
            </div>

            {loadingPerms ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando...</div>
            ) : permissions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>Nenhuma categoria configurada.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {permissions.map(p => (
                  <div key={p.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: GOLD, flexShrink: 0 }}>
                      📊
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: "#8a93a2" }}>ID: {p.id} · Tipo: {p.section_type} · Ícone: {p.icon}</div>
                    </div>
                    <button onClick={() => openEditPerm(p)} style={{ ...chip(""), fontSize: 12 }}>✏️ Editar</button>
                    <button onClick={() => handleDeletePerm(p)} disabled={deletingPermId === p.id} style={btnDanger}>
                      {deletingPermId === p.id ? "..." : "🗑"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Apresentação ── */}
      {presModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 500, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: 0 }}>{presEdit ? "Editar Apresentação" : "Nova Apresentação"}</h2>
              <button onClick={() => setPresModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>
            {inp("Título *", presTitle, setPresTitle, { placeholder: "Ex: Relatório de Vinhos 2025" })}
            {inp("Descrição", presDesc, setPresDesc, { placeholder: "Breve descrição", multiline: true })}
            {inp("URL do conteúdo *", presContent, setPresContent, { placeholder: "https://..." })}
            {inp("URL da capa (imagem)", presCover, setPresCover, { placeholder: "https://... (opcional)" })}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={presPublished} onChange={e => setPresPublished(e.target.checked)} style={{ accentColor: GOLD, width: 16, height: 16 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>Publicado (visível no app)</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPresModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSavePres} disabled={presSaving} style={{ ...btnPrimary, flex: 1, opacity: presSaving ? 0.6 : 1 }}>
                {presSaving ? "Salvando..." : presEdit ? "Atualizar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Item (KPI / Tendência / Região / Variedade) ── */}
      {itemModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: 0 }}>
                {itemModal.idx !== null ? "Editar" : "Adicionar"}{" "}
                {itemModal.kind === "kpi" ? "KPI" : itemModal.kind === "tendencia" ? "Tendência" : itemModal.kind === "regiao" ? "Região" : "Variedade"}
              </h2>
              <button onClick={() => setItemModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>

            {itemModal.kind === "kpi" && <>
              {inp("Label", mLabel, setMLabel, { placeholder: "Ex: Exportação" })}
              {inp("Valor", mValue, setMValue, { placeholder: "Ex: US$ 3.8M" })}
              {inp("Período", mPeriodF, setMPeriodF, { placeholder: "Ex: Mar/2026" })}
              {inp("Variação (%)", mChange, setMChange, { placeholder: "Ex: 9.2", type: "number" })}
            </>}

            {itemModal.kind === "tendencia" && <>
              {inp("Título", mTitle, setMTitle, { placeholder: "Ex: Alta do vinho natural" })}
              {inp("Descrição", mDesc, setMDesc, { placeholder: "Contexto...", multiline: true })}
              {inp("Variação (%)", mChange, setMChange, { placeholder: "Ex: 12.3", type: "number" })}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={mPos} onChange={e => setMPos(e.target.checked)} style={{ accentColor: GOLD }} />
                  <span style={{ fontSize: 14, color: NAVY }}>Tendência positiva (▲)</span>
                </label>
              </div>
            </>}

            {itemModal.kind === "regiao" && <>
              {inp("Posição (rank)", mRank, setMRank, { type: "number" })}
              {inp("Nome da região", mName, setMName, { placeholder: "Ex: São Paulo" })}
              {inp("Volume", mVolume, setMVolume, { placeholder: "Ex: 12.4M L" })}
              {inp("% do total", mPct, setMPct, { placeholder: "Ex: 28.5", type: "number" })}
            </>}

            {itemModal.kind === "variedade" && <>
              {inp("Nome da uva", mVarName, setMVarName, { placeholder: "Ex: Cabernet Sauvignon" })}
              {inp("Volume", mVarVol, setMVarVol, { placeholder: "Ex: 8.3M L" })}
              {inp("Variação (%)", mVarChg, setMVarChg, { placeholder: "Ex: 8.1", type: "number" })}
            </>}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={() => setItemModal(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSaveItem} style={{ ...btnPrimary, flex: 1 }}>
                {itemModal.idx !== null ? "Atualizar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Categoria (Permissão) ── */}
      {permModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: 0 }}>{permEdit ? "Editar Categoria" : "Nova Categoria"}</h2>
              <button onClick={() => setPermModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>
            {inp("Nome da categoria *", permTitle, setPermTitle, { placeholder: "Ex: Mercado Europeu" })}
            {inp("Ícone (Feather)", permIcon, setPermIcon, { placeholder: "Ex: bar-chart-2" })}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", marginBottom: 5, textTransform: "uppercase" }}>Tipo de seção</label>
              <select value={permSectionType} onChange={e => setPermSectionType(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #e8eaed", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                {SECTION_TYPES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            {!permEdit && (
              <p style={{ fontSize: 12, color: "#8a93a2", marginBottom: 16 }}>O ID será gerado automaticamente a partir do nome: <strong>{toSlug(permTitle) || "..."}</strong></p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPermModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSavePerm} disabled={permSaving} style={{ ...btnPrimary, flex: 1, opacity: permSaving ? 0.6 : 1 }}>
                {permSaving ? "Salvando..." : permEdit ? "Atualizar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
