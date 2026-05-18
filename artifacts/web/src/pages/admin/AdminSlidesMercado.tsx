import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

const MAIN_TABS = ["Apresentações", "Dados de Mercado", "Categorias", "Empresas BI"] as const;
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

interface MarketKPI { label: string; value: string; period: string; change: number; icon?: string; description?: string; source?: string; }
interface MarketTendencia { title: string; desc: string; change: number; pos: boolean; }
interface MarketRegiao { rank: number; name: string; volume: string; pct: number; }
interface MarketVariedade { name: string; volume: string; change: number; }
interface MarketChartArea { exports: number[]; imports: number[]; labels: string[]; yLabels: string[]; title?: string; subtitle?: string; }
interface MarketChartBar { values: number[]; labels: string[]; title?: string; subtitle?: string; }
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

const PERIOD_LABELS: Record<string, string> = { mes: "Mês", trimestre: "Trim.", ano: "Ano" };
const ALL_PERIODS = ["mes", "trimestre", "ano"];
const DEFAULT_PERM_IDS = new Set(["kpis", "graficos", "tendencias", "regioes", "variedades"]);

interface MarketPermission {
  id: string;
  title: string;
  icon: string;
  sort_order: number;
  section_type: string;
  periods?: string[];
  font_size?: number;
}

// ── Ideal.BI Admin types ───────────────────────────────────────────────────────

type BiKind = "Importadores" | "Exportadores" | "Produtores";

interface BiImp { id: string; name: string; pais: string; segmentos: string; estado: string; exportador: string | null; created_at: string; }
interface BiExp { id: string; name: string; origem_exportador: string; distribuidor: string | null; fob_usd: string | null; cx9l: string | null; usd_por_cx9l: string | null; created_at: string; }
interface BiProd { id: string; name: string; name_fantasia: string | null; regiao: string; estado: string | null; tipos: string; fundado: number | null; created_at: string; }
type BiRow = BiImp | BiExp | BiProd;

async function biApiFetch(path: string, method: string, body?: object): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) { const txt = await res.text(); throw new Error(txt); }
  if (res.status === 204) return null;
  return res.json() as Promise<unknown>;
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
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    await fetch(`${API_BASE}/admin/presentations/${p.id}/published`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ published: !p.published }),
    });
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

  // Custom sections (non-default permissions)
  const [rawOverview, setRawOverview] = useState<Record<string, unknown> | null>(null);
  const [customData, setCustomData] = useState<Record<string, unknown[]>>({});

  // Section title inline editing
  const [editingSecId, setEditingSecId] = useState<string | null>(null);
  const [editingSecTitle, setEditingSecTitle] = useState("");
  const [editingSecFontSize, setEditingSecFontSize] = useState(14);
  const [savingSecTitle, setSavingSecTitle] = useState(false);

  // Chart titles and subtitles (editable)
  const [areaTitle, setAreaTitle] = useState("Evolução de Exportações & Importações");
  const [barTitle, setBarTitle] = useState("Produção Nacional por Período");
  const [areaSubtitle, setAreaSubtitle] = useState("ÁREA — Exportações / Importações (separados por vírgula)");
  const [barSubtitle, setBarSubtitle] = useState("BARRAS — Produção Nacional");

  // Custom item modal (non-default sections)
  const [customModal, setCustomModal] = useState<{ permId: string; stype: string; idx: number | null } | null>(null);

  const loadOverview = useCallback(async (p: Period) => {
    setLoadingData(true);
    const { data } = await supabase.from("market_overview").select("*").eq("period", p).maybeSingle();
    if (data) {
      const d = data as MarketOverview;
      setOverview(d);
      setRawOverview(d as Record<string, unknown>);
      setKpis(d.kpis ?? []);
      setAreaExp(joinNum(d.chart_area?.exports ?? []));
      setAreaImp(joinNum(d.chart_area?.imports ?? []));
      setAreaLbl(joinStr(d.chart_area?.labels ?? []));
      setAreaTitle(d.chart_area?.title ?? "Evolução de Exportações & Importações");
      setAreaSubtitle(d.chart_area?.subtitle ?? "ÁREA — Exportações / Importações (separados por vírgula)");
      setBarVal(joinNum(d.chart_bar?.values ?? []));
      setBarLbl(joinStr(d.chart_bar?.labels ?? []));
      setBarTitle(d.chart_bar?.title ?? "Produção Nacional por Período");
      setBarSubtitle(d.chart_bar?.subtitle ?? "BARRAS — Produção Nacional");
      setTendencias(d.tendencias ?? []);
      setRegioes(d.regioes ?? []);
      setVariedades(d.variedades ?? []);
    } else {
      setOverview(null);
      setRawOverview(null);
      setKpis([]); setAreaExp(""); setAreaImp(""); setAreaLbl(""); setBarVal(""); setBarLbl("");
      setAreaTitle("Evolução de Exportações & Importações");
      setBarTitle("Produção Nacional por Período");
      setAreaSubtitle("ÁREA — Exportações / Importações (separados por vírgula)");
      setBarSubtitle("BARRAS — Produção Nacional");
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
      chart_area: { exports: numArr(areaExp), imports: numArr(areaImp), labels: strArr(areaLbl), yLabels: [], title: areaTitle, subtitle: areaSubtitle },
      chart_bar: { values: numArr(barVal), labels: strArr(barLbl), title: barTitle, subtitle: barSubtitle },
      tendencias,
      regioes,
      variedades,
      ...customData,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("market_overview").upsert(payload, { onConflict: "period" });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else alert("Erro ao salvar: " + error.message);
  };

  // ── Section title editing ─────────────────────────────────────────────────
  const startEditSecTitle = (perm: MarketPermission) => {
    setEditingSecId(perm.id);
    setEditingSecTitle(perm.title);
    setEditingSecFontSize(perm.font_size ?? 14);
  };

  const saveSecTitle = async () => {
    if (!editingSecId || !editingSecTitle.trim()) return;
    setSavingSecTitle(true);
    await supabase.from("market_permissions").update({ title: editingSecTitle.trim(), font_size: editingSecFontSize }).eq("id", editingSecId);
    setSavingSecTitle(false);
    setEditingSecId(null);
    void loadPermissions();
  };

  const deleteSection = async (perm: MarketPermission) => {
    if (!confirm(`Excluir seção "${perm.title}"?\n\nOs dados desta seção serão removidos no próximo Salvar.`)) return;
    await supabase.from("market_permissions").delete().eq("id", perm.id);
    void loadPermissions();
  };

  // ── Custom section item modal ──────────────────────────────────────────────
  const openCustomModal = (perm: MarketPermission, idx: number | null) => {
    const stype = perm.section_type ?? "lista";
    const items = (customData[perm.id] ?? []) as Record<string, unknown>[];
    const item = idx !== null ? items[idx] : null;
    if (stype === "lista") {
      setMTitle((item?.title as string) ?? ""); setMDesc((item?.desc as string) ?? "");
      setMChange(item?.change !== undefined ? String(item.change) : ""); setMPos((item?.pos as boolean) ?? true);
    } else if (stype === "ranking") {
      setMRank(item?.rank !== undefined ? String(item.rank) : String(items.length + 1));
      setMName((item?.name as string) ?? ""); setMVolume((item?.volume as string) ?? ""); setMPct(item?.pct !== undefined ? String(item.pct) : "");
    } else if (stype === "simples") {
      setMVarName((item?.name as string) ?? ""); setMVarVol((item?.volume as string) ?? ""); setMVarChg(item?.change !== undefined ? String(item.change) : "");
    } else if (stype === "kpi") {
      setMLabel((item?.label as string) ?? ""); setMValue((item?.value as string) ?? "");
      setMPeriodF((item?.period as string) ?? ""); setMChange(item?.change !== undefined ? String(item.change) : "");
    } else if (stype === "grafico") {
      const a = (item?.area as Record<string, unknown>) ?? {};
      const b = (item?.bar as Record<string, unknown>) ?? {};
      setAreaExp(joinNum((a?.exports as number[]) ?? [])); setAreaImp(joinNum((a?.imports as number[]) ?? []));
      setAreaLbl(joinStr((a?.labels as string[]) ?? [])); setBarVal(joinNum((b?.values as number[]) ?? []));
      setBarLbl(joinStr((b?.labels as string[]) ?? []));
    }
    setCustomModal({ permId: perm.id, stype, idx });
  };

  const saveCustomModalItem = () => {
    if (!customModal) return;
    const { permId, stype, idx } = customModal;
    let newItem: Record<string, unknown>;
    if (stype === "lista")   newItem = { title: mTitle, desc: mDesc, change: parseFloat(mChange) || 0, pos: mPos };
    else if (stype === "ranking") {
      const curr = customData[permId] ?? [];
      newItem = { rank: parseInt(mRank) || curr.length + 1, name: mName, volume: mVolume, pct: parseFloat(mPct) || 0 };
    } else if (stype === "simples") newItem = { name: mVarName, volume: mVarVol, change: parseFloat(mVarChg) || 0 };
    else if (stype === "kpi")    newItem = { label: mLabel, value: mValue, period: mPeriodF, change: parseFloat(mChange) || 0 };
    else if (stype === "grafico") newItem = {
      area: { exports: numArr(areaExp), imports: numArr(areaImp), labels: strArr(areaLbl), yLabels: [] },
      bar:  { values: numArr(barVal), labels: strArr(barLbl) },
    };
    else newItem = {};
    setCustomData(prev => {
      const curr = [...(prev[permId] ?? [])];
      if (idx !== null) curr[idx] = newItem; else curr.push(newItem);
      return { ...prev, [permId]: curr };
    });
    setCustomModal(null);
  };

  const deleteCustomItem = (permId: string, idx: number) => {
    if (!confirm("Remover este item?")) return;
    setCustomData(prev => ({ ...prev, [permId]: (prev[permId] ?? []).filter((_, i) => i !== idx) }));
  };

  // item modals
  type ModalKind = "tendencia" | "regiao" | "variedade" | "kpi";
  const [itemModal, setItemModal] = useState<{ kind: ModalKind; idx: number | null } | null>(null);
  const [mLabel, setMLabel] = useState("");
  const [mValue, setMValue] = useState("");
  const [mPeriodF, setMPeriodF] = useState("");
  const [mSource, setMSource] = useState("");
  const [mDescription, setMDescription] = useState("");
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
      setMSource(k?.source ?? ""); setMDescription(k?.description ?? "");
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
      const item: MarketKPI = { label: mLabel.trim(), value: mValue.trim(), period: mPeriodF.trim(), change: parseFloat(mChange) || 0, icon: "activity", source: mSource.trim() || undefined, description: mDescription.trim() || undefined };
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
  const [permPeriods, setPermPeriods] = useState<string[]>(["mes", "trimestre", "ano"]);
  const [permFontSize, setPermFontSize] = useState("14");
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

  useEffect(() => { if (tab === "Categorias" || tab === "Dados de Mercado") void loadPermissions(); }, [tab, loadPermissions]);

  // Populate customData from rawOverview whenever either changes
  useEffect(() => {
    const newCustom: Record<string, unknown[]> = {};
    for (const perm of permissions) {
      if (!DEFAULT_PERM_IDS.has(perm.id)) {
        const val = rawOverview?.[perm.id];
        newCustom[perm.id] = Array.isArray(val) ? val : [];
      }
    }
    setCustomData(newCustom);
  }, [rawOverview, permissions]);

  const openNewPerm = () => {
    setPermEdit(null);
    setPermTitle(""); setPermIcon("bar-chart-2"); setPermSectionType("lista");
    setPermPeriods(["mes", "trimestre", "ano"]); setPermFontSize("14");
    setPermModal(true);
  };
  const openEditPerm = (p: MarketPermission) => {
    setPermEdit(p);
    setPermTitle(p.title); setPermIcon(p.icon); setPermSectionType(p.section_type);
    setPermPeriods(p.periods && p.periods.length > 0 ? p.periods : ["mes", "trimestre", "ano"]);
    setPermFontSize(String(p.font_size ?? 14));
    setPermModal(true);
  };

  const handleSavePerm = async () => {
    if (!permTitle.trim()) { alert("Nome obrigatório"); return; }
    setPermSaving(true);
    const fs = parseInt(permFontSize) || 14;
    if (permEdit) {
      await supabase.from("market_permissions").update({
        title: permTitle.trim(), icon: permIcon, section_type: permSectionType,
        periods: permPeriods, font_size: fs,
      }).eq("id", permEdit.id);
    } else {
      const slug = toSlug(permTitle.trim()) || `mp_${Date.now()}`;
      const maxOrder = permissions.reduce((m, p) => Math.max(m, p.sort_order ?? 0), -1);
      await supabase.from("market_permissions").insert({
        id: slug, title: permTitle.trim(), icon: permIcon, section_type: permSectionType,
        sort_order: maxOrder + 1, periods: permPeriods, font_size: fs,
      });
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

  // ── Empresas BI ───────────────────────────────────────────────────────────

  const [biTab, setBiTab] = useState<BiKind>("Importadores");
  const [biImps, setBiImps] = useState<BiImp[]>([]);
  const [biExps, setBiExps] = useState<BiExp[]>([]);
  const [biProds, setBiProds] = useState<BiProd[]>([]);
  const [loadingBi, setLoadingBi] = useState(false);
  const [biModal, setBiModal] = useState<{ kind: BiKind; row: BiRow | null } | null>(null);
  const [biSaving, setBiSaving] = useState(false);
  const [biDeletingId, setBiDeletingId] = useState<string | null>(null);
  const [biLoadError, setBiLoadError] = useState<string | null>(null);
  // form fields
  const [biName, setBiName] = useState("");
  const [biPais, setBiPais] = useState("");
  const [biSegmentos, setBiSegmentos] = useState("");
  const [biEstado, setBiEstado] = useState("");
  const [biPaisDestino, setBiPaisDestino] = useState("");
  const [biDistribuidor, setBiDistribuidor] = useState("");
  const [biExportadorImp, setBiExportadorImp] = useState("");
  const [biProdutos, setBiProdutos] = useState("");
  const [biCaixas, setBiCaixas] = useState("");
  const [biValor, setBiValor] = useState("");
  const [biPreco, setBiPreco] = useState("");
  const [biRegiao, setBiRegiao] = useState("");
  const [biEstadoProd, setBiEstadoProd] = useState("");
  const [biNomeFantasia, setBiNomeFantasia] = useState("");
  const [biTipos, setBiTipos] = useState("");
  const [biFundado, setBiFundado] = useState("");

  const loadBi = useCallback(async () => {
    setLoadingBi(true);
    setBiLoadError(null);
    try {
      const [ir, er, pr] = await Promise.all([
        biApiFetch("/market/bi/importadores?limit=200", "GET") as Promise<{ items: BiImp[] }>,
        biApiFetch("/market/bi/exportadores?limit=200", "GET") as Promise<{ items: BiExp[] }>,
        biApiFetch("/market/bi/produtores?limit=200", "GET") as Promise<{ items: BiProd[] }>,
      ]);
      setBiImps(ir.items);
      setBiExps(er.items);
      setBiProds(pr.items);
    } catch (e) {
      setBiLoadError(e instanceof Error ? e.message : "Erro ao carregar empresas. Verifique a conexão com a API.");
    }
    setLoadingBi(false);
  }, []);

  useEffect(() => { if (tab === "Empresas BI") void loadBi(); }, [tab, loadBi]);

  const openBiModal = (kind: BiKind, row: BiRow | null) => {
    setBiModal({ kind, row });
    setBiName(row?.name ?? "");
    if (kind === "Importadores") {
      const r = row as BiImp | null;
      setBiPais(r?.pais ?? ""); setBiSegmentos(r?.segmentos ?? ""); setBiEstado(r?.estado ?? ""); setBiExportadorImp(r?.exportador ?? "");
    } else if (kind === "Exportadores") {
      const r = row as BiExp | null;
      setBiPaisDestino(r?.origem_exportador ?? "");
      setBiDistribuidor(r?.distribuidor ?? "");
      setBiCaixas(r?.cx9l ?? "");
      setBiValor(r?.fob_usd ?? "");
      setBiPreco(r?.usd_por_cx9l ?? "");
    } else {
      const r = row as BiProd | null;
      setBiNomeFantasia(r?.name_fantasia ?? "");
      setBiRegiao(r?.regiao ?? "");
      setBiEstadoProd(r?.estado ?? "");
      setBiTipos(r?.tipos ?? "");
      setBiFundado(r?.fundado?.toString() ?? "");
    }
  };

  const handleSaveBi = async () => {
    if (!biModal) return;
    const { kind, row } = biModal;
    const id = (row as BiRow | null)?.id;
    setBiSaving(true);
    try {
      if (kind === "Importadores") {
        const body = { name: biName.trim(), pais: biPais.trim(), segmentos: biSegmentos.trim(), estado: biEstado.trim(), exportador: biExportadorImp.trim() || null };
        if (!body.name || !body.pais || !body.segmentos) { alert("Nome, país e segmentos são obrigatórios"); setBiSaving(false); return; }
        if (id) await biApiFetch(`/market/bi/importadores/${id}`, "PATCH", body);
        else await biApiFetch("/market/bi/importadores", "POST", body);
      } else if (kind === "Exportadores") {
        const body = {
          name: biName.trim(),
          origem_exportador: biPaisDestino.trim(),
          distribuidor: biDistribuidor.trim() || null,
          fob_usd: parseFloat(biValor) || null,
          cx9l: parseFloat(biCaixas) || null,
          usd_por_cx9l: parseFloat(biPreco) || null,
        };
        if (!body.name || !body.origem_exportador) { alert("Nome e país de origem são obrigatórios"); setBiSaving(false); return; }
        if (id) await biApiFetch(`/market/bi/exportadores/${id}`, "PATCH", body);
        else await biApiFetch("/market/bi/exportadores", "POST", body);
      } else {
        const body = {
          name: biName.trim(),
          name_fantasia: biNomeFantasia.trim() || null,
          regiao: biRegiao.trim(),
          estado: biEstadoProd.trim() || null,
          tipos: biTipos.trim(),
          fundado: biFundado ? parseInt(biFundado) : null,
        };
        if (!body.name || !body.regiao || !body.tipos) { alert("Razão Social, região e tipos são obrigatórios"); setBiSaving(false); return; }
        if (id) await biApiFetch(`/market/bi/produtores/${id}`, "PATCH", body);
        else await biApiFetch("/market/bi/produtores", "POST", body);
      }
      setBiModal(null);
      void loadBi();
    } catch (e) {
      alert("Erro ao salvar: " + (e instanceof Error ? e.message : String(e)));
    }
    setBiSaving(false);
  };

  const handleDeleteBi = async (kind: BiKind, row: BiRow) => {
    const lbl = kind === "Importadores" ? "importador" : kind === "Exportadores" ? "exportador" : "produtor";
    if (!confirm(`Excluir ${lbl} "${row.name}"?`)) return;
    setBiDeletingId(row.id);
    try {
      const seg = kind === "Importadores" ? "importadores" : kind === "Exportadores" ? "exportadores" : "produtores";
      await biApiFetch(`/market/bi/${seg}/${row.id}`, "DELETE");
      void loadBi();
    } catch (e) {
      alert("Erro ao excluir: " + (e instanceof Error ? e.message : String(e)));
    }
    setBiDeletingId(null);
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
            {/* Top bar: period selector + save */}
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
              <button onClick={() => { openNewPerm(); }} style={{ ...btnSecondary, fontSize: 13 }}>+ Nova Seção</button>
              <button onClick={handleSaveOverview} disabled={saving || loadingData} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>

            {loadingData || loadingPerms ? (
              <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando dados do período...</div>
            ) : (
              <div>
                {!overview && (
                  <div style={{ padding: "16px 20px", backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}40`, borderRadius: 10, marginBottom: 20, fontSize: 13, color: "#92713a" }}>
                    ℹ️ Nenhum dado para este período ainda. Preencha abaixo e clique em "Salvar alterações" para criar.
                  </div>
                )}

                {/* Render sections based on market_permissions order */}
                {(permissions.length > 0 ? permissions : [
                  { id: "kpis", title: "KPIs", icon: "activity", sort_order: 0, section_type: "kpi" },
                  { id: "graficos", title: "Gráficos", icon: "bar-chart-2", sort_order: 1, section_type: "grafico" },
                  { id: "tendencias", title: "Tendências", icon: "trending-up", sort_order: 2, section_type: "lista" },
                  { id: "regioes", title: "Regiões", icon: "map-pin", sort_order: 3, section_type: "ranking" },
                  { id: "variedades", title: "Variedades", icon: "layers", sort_order: 4, section_type: "simples" },
                ] as MarketPermission[]).map(perm => {
                  const isDefault = DEFAULT_PERM_IDS.has(perm.id);

                  // Section header (editable title + delete)
                  const secHeader = (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        {editingSecId === perm.id ? (
                          <>
                            <input
                              value={editingSecTitle}
                              onChange={e => setEditingSecTitle(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") void saveSecTitle(); if (e.key === "Escape") setEditingSecId(null); }}
                              autoFocus
                              style={{ flex: 1, padding: "5px 10px", border: `1px solid ${GOLD}`, borderRadius: 6, fontSize: 14, fontWeight: 700, color: NAVY, outline: "none" }}
                            />
                            <select
                              value={editingSecFontSize}
                              onChange={e => setEditingSecFontSize(Number(e.target.value))}
                              title="Tamanho da fonte"
                              style={{ padding: "5px 8px", border: `1px solid ${GOLD}40`, borderRadius: 6, fontSize: 12, color: NAVY, cursor: "pointer", background: "#fff" }}
                            >
                              {[11, 12, 13, 14, 15, 16, 17, 18].map(s => <option key={s} value={s}>{s}px</option>)}
                            </select>
                            <button onClick={() => void saveSecTitle()} disabled={savingSecTitle} style={{ padding: "5px 12px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                              {savingSecTitle ? "..." : "✓"}
                            </button>
                            <button onClick={() => setEditingSecId(null)} style={{ padding: "5px 10px", backgroundColor: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>✕</button>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: perm.font_size ?? 14, fontWeight: 800, color: NAVY }}>{perm.title}</div>
                            <button onClick={() => startEditSecTitle(perm)} title="Editar título" style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "#aaa", fontSize: 13, lineHeight: 1 }}>✏️</button>
                            <button onClick={() => void deleteSection(perm)} title="Excluir seção" style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "#dc2626", fontSize: 13, lineHeight: 1 }}>🗑</button>
                          </>
                        )}
                      </div>
                    </div>
                  );

                  // Default section content
                  if (isDefault) {
                    if (perm.id === "kpis") return (
                      <div key={perm.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20, marginBottom: 16 }}>
                        {secHeader}
                        {kpis.map((k, i) => renderItemRow("kpi", `${k.label}: ${k.value}`, `Período: ${k.period} · Variação: ${k.change}%`, i))}
                        {kpis.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Sem KPIs.</p>}
                        <div style={{ marginTop: 8 }}><button onClick={() => openItemModal("kpi", null)} style={chip("")}>+ Adicionar KPI</button></div>
                      </div>
                    );
                    if (perm.id === "graficos") return (
                      <div key={perm.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20, marginBottom: 16 }}>
                        {secHeader}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#8a93a2", margin: "0 0 6px", textTransform: "uppercase" }}>Gráfico de Área</p>
                            <input
                              value={areaTitle}
                              onChange={e => setAreaTitle(e.target.value)}
                              style={{ width: "100%", padding: "6px 10px", border: "1px solid #c9a84c", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#0d1b2a", marginBottom: 6, background: "#fffdf5", boxSizing: "border-box", outline: "none" }}
                              placeholder="Título do gráfico de área..."
                            />
                            <input
                              value={areaSubtitle}
                              onChange={e => setAreaSubtitle(e.target.value)}
                              style={{ width: "100%", padding: "4px 8px", border: "1px solid #e8eaed", borderRadius: 6, fontSize: 12, color: "#8a93a2", marginBottom: 10, background: "#f9f9fb", boxSizing: "border-box", outline: "none" }}
                              placeholder="Subtítulo da área..."
                            />
                            {inp("Exportações", areaExp, setAreaExp, { placeholder: "3.2, 3.5, 3.8..." })}
                            {inp("Importações", areaImp, setAreaImp, { placeholder: "2.1, 2.4, 2.6..." })}
                            {inp("Labels (meses)", areaLbl, setAreaLbl, { placeholder: "Jan, Fev, Mar..." })}
                          </div>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#8a93a2", margin: "0 0 6px", textTransform: "uppercase" }}>Gráfico de Barras</p>
                            <input
                              value={barTitle}
                              onChange={e => setBarTitle(e.target.value)}
                              style={{ width: "100%", padding: "6px 10px", border: "1px solid #c9a84c", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#0d1b2a", marginBottom: 6, background: "#fffdf5", boxSizing: "border-box", outline: "none" }}
                              placeholder="Título do gráfico de barras..."
                            />
                            <input
                              value={barSubtitle}
                              onChange={e => setBarSubtitle(e.target.value)}
                              style={{ width: "100%", padding: "4px 8px", border: "1px solid #e8eaed", borderRadius: 6, fontSize: 12, color: "#8a93a2", marginBottom: 10, background: "#f9f9fb", boxSizing: "border-box", outline: "none" }}
                              placeholder="Subtítulo das barras..."
                            />
                            {inp("Valores", barVal, setBarVal, { placeholder: "320, 290, 345, 310" })}
                            {inp("Labels", barLbl, setBarLbl, { placeholder: "Q1, Q2, Q3, Q4" })}
                          </div>
                        </div>
                      </div>
                    );
                    if (perm.id === "tendencias") return (
                      <div key={perm.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20, marginBottom: 16 }}>
                        {secHeader}
                        {tendencias.map((t, i) => renderItemRow("tendencia", t.title, `${t.pos ? "▲" : "▼"} ${t.change}% · ${t.desc}`, i))}
                        {tendencias.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Sem tendências.</p>}
                        <div style={{ marginTop: 8 }}><button onClick={() => openItemModal("tendencia", null)} style={chip("")}>+ Adicionar</button></div>
                      </div>
                    );
                    if (perm.id === "regioes") return (
                      <div key={perm.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20, marginBottom: 16 }}>
                        {secHeader}
                        {regioes.map((r, i) => renderItemRow("regiao", `${r.rank}. ${r.name}`, `Volume: ${r.volume} · ${r.pct}%`, i))}
                        {regioes.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Sem regiões.</p>}
                        <div style={{ marginTop: 8 }}><button onClick={() => openItemModal("regiao", null)} style={chip("")}>+ Adicionar</button></div>
                      </div>
                    );
                    if (perm.id === "variedades") return (
                      <div key={perm.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20, marginBottom: 16 }}>
                        {secHeader}
                        {variedades.map((v, i) => renderItemRow("variedade", v.name, `Volume: ${v.volume} · ${v.change > 0 ? "+" : ""}${v.change}%`, i))}
                        {variedades.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Sem variedades.</p>}
                        <div style={{ marginTop: 8 }}><button onClick={() => openItemModal("variedade", null)} style={chip("")}>+ Adicionar</button></div>
                      </div>
                    );
                    return null;
                  }

                  // Custom section content
                  const items = (customData[perm.id] ?? []) as Record<string, unknown>[];
                  const stype = perm.section_type ?? "lista";
                  return (
                    <div key={perm.id} style={{ backgroundColor: "#fff", border: `1px solid ${GOLD}30`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                      {secHeader}
                      {items.length === 0 && <p style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Nenhum item ainda.</p>}
                      {items.map((item, i) => {
                        let label = "", sub = "";
                        if (stype === "lista")   { label = (item.title as string) ?? ""; sub = `${(item.pos as boolean) ? "▲" : "▼"} ${item.change}% · ${item.desc ?? ""}`; }
                        else if (stype === "ranking") { label = `${item.rank}. ${item.name}`; sub = `Volume: ${item.volume} · ${item.pct}%`; }
                        else if (stype === "simples") { label = (item.name as string) ?? ""; sub = `Volume: ${item.volume} · ${(item.change as number) > 0 ? "+" : ""}${item.change}%`; }
                        else if (stype === "kpi")   { label = `${item.label}: ${item.value}`; sub = `${item.period} · ${item.change}%`; }
                        else if (stype === "grafico") { label = "Gráfico configurado"; sub = "Dados de área e barras"; }
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", backgroundColor: "#fafbfc", border: "1px solid #e8eaed", borderRadius: 9, marginBottom: 6 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                              {sub && <div style={{ fontSize: 11, color: "#8a93a2" }}>{sub}</div>}
                            </div>
                            <button onClick={() => openCustomModal(perm, i)} style={{ ...chip(""), fontSize: 11 }}>Editar</button>
                            <button onClick={() => deleteCustomItem(perm.id, i)} style={btnDanger}>🗑</button>
                          </div>
                        );
                      })}
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => openCustomModal(perm, null)} style={chip("")}>+ Adicionar item</button>
                      </div>
                    </div>
                  );
                })}
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
                {permissions.map(p => {
                  const periods = p.periods && p.periods.length > 0 ? p.periods : ALL_PERIODS;
                  return (
                    <div key={p.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: GOLD, flexShrink: 0 }}>
                        📊
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: "#8a93a2", marginBottom: 4 }}>ID: {p.id} · Tipo: {p.section_type} · Ícone: {p.icon}</div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                          {periods.map(pd => (
                            <span key={pd} style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, backgroundColor: `${GOLD}15`, color: GOLD }}>{PERIOD_LABELS[pd] ?? pd}</span>
                          ))}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, backgroundColor: "#f0f4ff", color: "#4f46e5" }}>
                            {p.font_size ?? 14}px
                          </span>
                        </div>
                      </div>
                      <button onClick={() => openEditPerm(p)} style={{ ...chip(""), fontSize: 12 }}>✏️ Editar</button>
                      <button onClick={() => handleDeletePerm(p)} disabled={deletingPermId === p.id} style={btnDanger}>
                        {deletingPermId === p.id ? "..." : "🗑"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Empresas BI ── */}
      {tab === "Empresas BI" && (
        <div>
          {/* Sub-tabs + botão novo */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
            {(["Importadores", "Exportadores", "Produtores"] as BiKind[]).map(k => (
              <button key={k} onClick={() => setBiTab(k)} style={{ padding: "7px 18px", border: `1px solid ${biTab === k ? GOLD : "#e8eaed"}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: biTab === k ? 700 : 400, backgroundColor: biTab === k ? `${GOLD}12` : "#fff", color: biTab === k ? GOLD : "#555" }}>
                {k}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => openBiModal(biTab, null)} style={btnPrimary}>
              + Novo {biTab === "Importadores" ? "Importador" : biTab === "Exportadores" ? "Exportador" : "Produtor"}
            </button>
          </div>

          {loadingBi ? (
            <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando...</div>
          ) : biLoadError ? (
            <div style={{ padding: "16px 20px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, color: "#dc2626", fontSize: 13 }}>
              ⚠️ {biLoadError}
              <button onClick={() => void loadBi()} style={{ marginLeft: 16, padding: "4px 12px", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Tentar novamente</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Importadores */}
              {biTab === "Importadores" && (biImps.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>Nenhum importador. Clique em "+ Novo Importador" para adicionar.</div>
              ) : biImps.map(r => (
                <div key={r.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🌍</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#8a93a2" }}>
                      {r.pais}{r.estado ? ` · ${r.estado}` : ""} · {r.segmentos}
                      {r.exportador ? ` · exp: ${r.exportador}` : ""}
                    </div>
                  </div>
                  <button onClick={() => openBiModal("Importadores", r)} style={{ padding: "6px 12px", backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏️ Editar</button>
                  <button onClick={() => handleDeleteBi("Importadores", r)} disabled={biDeletingId === r.id} style={btnDanger}>{biDeletingId === r.id ? "..." : "🗑"}</button>
                </div>
              )))}

              {/* Exportadores */}
              {biTab === "Exportadores" && (biExps.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>Nenhum exportador. Clique em "+ Novo Exportador" para adicionar.</div>
              ) : biExps.map(r => (
                <div key={r.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📦</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#8a93a2" }}>
                      {r.origem_exportador ? `🌍 ${r.origem_exportador}` : "—"}
                      {r.distribuidor ? ` · dist: ${r.distribuidor}` : ""}
                      {r.fob_usd ? ` · FOB US$ ${parseFloat(r.fob_usd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
                      {r.cx9l ? ` · ${parseFloat(r.cx9l).toLocaleString("pt-BR")} CX9L` : ""}
                    </div>
                  </div>
                  <button onClick={() => openBiModal("Exportadores", r)} style={{ padding: "6px 12px", backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏️ Editar</button>
                  <button onClick={() => handleDeleteBi("Exportadores", r)} disabled={biDeletingId === r.id} style={btnDanger}>{biDeletingId === r.id ? "..." : "🗑"}</button>
                </div>
              )))}

              {/* Produtores */}
              {biTab === "Produtores" && (biProds.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>Nenhum produtor. Clique em "+ Novo Produtor" para adicionar.</div>
              ) : biProds.map(r => (
                <div key={r.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🍷</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{r.name}</div>
                    {r.name_fantasia && <div style={{ fontSize: 12, color: GOLD, fontStyle: "italic" }}>{r.name_fantasia}</div>}
                    <div style={{ fontSize: 12, color: "#8a93a2" }}>
                      📍 {r.regiao}{r.estado ? ` — ${r.estado}` : ""}{r.fundado ? ` · Fund. ${r.fundado}` : ""} · {r.tipos}
                    </div>
                  </div>
                  <button onClick={() => openBiModal("Produtores", r)} style={{ padding: "6px 12px", backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏️ Editar</button>
                  <button onClick={() => handleDeleteBi("Produtores", r)} disabled={biDeletingId === r.id} style={btnDanger}>{biDeletingId === r.id ? "..." : "🗑"}</button>
                </div>
              )))}
            </div>
          )}
        </div>
      )}

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

      {/* ── Modal: Item de Seção Customizada ── */}
      {customModal && (() => {
        const { stype } = customModal;
        const isEdit = customModal.idx !== null;
        const typeLabel = stype === "lista" ? "Tendência" : stype === "ranking" ? "Região" : stype === "simples" ? "Variedade" : stype === "kpi" ? "KPI" : "Gráfico";
        return (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: 0 }}>{isEdit ? "Editar" : "Adicionar"} {typeLabel}</h2>
                <button onClick={() => setCustomModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
              </div>

              {stype === "kpi" && <>
                {inp("Label", mLabel, setMLabel, { placeholder: "Ex: Exportação" })}
                {inp("Valor", mValue, setMValue, { placeholder: "Ex: US$ 3.8M" })}
                {inp("Período", mPeriodF, setMPeriodF, { placeholder: "Ex: Mar/2026" })}
                {inp("Variação (%)", mChange, setMChange, { placeholder: "Ex: 9.2", type: "number" })}
              </>}

              {stype === "lista" && <>
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

              {stype === "ranking" && <>
                {inp("Posição (rank)", mRank, setMRank, { type: "number" })}
                {inp("Nome", mName, setMName, { placeholder: "Ex: São Paulo" })}
                {inp("Volume", mVolume, setMVolume, { placeholder: "Ex: 12.4M L" })}
                {inp("% do total", mPct, setMPct, { placeholder: "Ex: 28.5", type: "number" })}
              </>}

              {stype === "simples" && <>
                {inp("Nome", mVarName, setMVarName, { placeholder: "Ex: Cabernet Sauvignon" })}
                {inp("Volume", mVarVol, setMVarVol, { placeholder: "Ex: 8.3M L" })}
                {inp("Variação (%)", mVarChg, setMVarChg, { placeholder: "Ex: 8.1", type: "number" })}
              </>}

              {stype === "grafico" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#8a93a2", marginBottom: 8 }}>ÁREA</p>
                    {inp("Exportações", areaExp, setAreaExp, { placeholder: "3.2, 3.5, 3.8..." })}
                    {inp("Importações", areaImp, setAreaImp, { placeholder: "2.1, 2.4, 2.6..." })}
                    {inp("Labels", areaLbl, setAreaLbl, { placeholder: "Jan, Fev, Mar..." })}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#8a93a2", marginBottom: 8 }}>BARRAS</p>
                    {inp("Valores", barVal, setBarVal, { placeholder: "320, 290, 345, 310" })}
                    {inp("Labels", barLbl, setBarLbl, { placeholder: "Q1, Q2, Q3, Q4" })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => setCustomModal(null)} style={btnSecondary}>Cancelar</button>
                <button onClick={saveCustomModalItem} style={{ ...btnPrimary, flex: 1 }}>
                  {isEdit ? "Atualizar" : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
              {inp("Fonte", mSource, setMSource, { placeholder: "Ex: IBRAVIN" })}
              {inp("Descrição", mDescription, setMDescription, { placeholder: "Ex: Total exportado pelo Brasil em vinhos...", multiline: true })}
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
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
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

            {/* Períodos visíveis */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", marginBottom: 8, textTransform: "uppercase" }}>Períodos disponíveis</label>
              <div style={{ display: "flex", gap: 8 }}>
                {ALL_PERIODS.map(pd => {
                  const active = permPeriods.includes(pd);
                  return (
                    <div key={pd} onClick={() => setPermPeriods(prev => active ? prev.filter(x => x !== pd) : [...prev, pd])} style={{
                      padding: "6px 16px", border: `1px solid ${active ? GOLD : "#e8eaed"}`,
                      borderRadius: 20, cursor: "pointer",
                      backgroundColor: active ? `${GOLD}12` : "transparent",
                      fontSize: 13, fontWeight: active ? 700 : 400,
                      color: active ? GOLD : "#666",
                      userSelect: "none" as const,
                    }}>
                      {PERIOD_LABELS[pd]}
                    </div>
                  );
                })}
              </div>
              {permPeriods.length === 0 && (
                <p style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>Selecione ao menos um período.</p>
              )}
            </div>

            {/* Tamanho da fonte */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", marginBottom: 8, textTransform: "uppercase" }}>Tamanho da fonte</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {["11", "12", "13", "14", "15", "16"].map(sz => {
                  const active = permFontSize === sz;
                  return (
                    <div key={sz} onClick={() => setPermFontSize(sz)} style={{
                      padding: "5px 14px", border: `1px solid ${active ? "#4f46e5" : "#e8eaed"}`,
                      borderRadius: 20, cursor: "pointer",
                      backgroundColor: active ? "#4f46e512" : "transparent",
                      fontSize: 12, fontWeight: active ? 700 : 400,
                      color: active ? "#4f46e5" : "#666",
                      userSelect: "none" as const,
                    }}>
                      {sz}px
                    </div>
                  );
                })}
              </div>
            </div>

            {!permEdit && (
              <p style={{ fontSize: 12, color: "#8a93a2", marginBottom: 16 }}>O ID será gerado automaticamente a partir do nome: <strong>{toSlug(permTitle) || "..."}</strong></p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPermModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSavePerm} disabled={permSaving || permPeriods.length === 0} style={{ ...btnPrimary, flex: 1, opacity: (permSaving || permPeriods.length === 0) ? 0.6 : 1 }}>
                {permSaving ? "Salvando..." : permEdit ? "Atualizar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal: Empresa BI ── */}
      {biModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: 0 }}>
                {biModal.row ? "Editar" : "Novo"}{" "}
                {biModal.kind === "Importadores" ? "Importador" : biModal.kind === "Exportadores" ? "Exportador" : "Produtor"}
              </h2>
              <button onClick={() => setBiModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>

            {inp(biModal.kind === "Produtores" ? "Razão Social *" : "Nome *", biName, setBiName, { placeholder: biModal.kind === "Produtores" ? "Razão Social completa" : "Nome da empresa" })}

            {biModal.kind === "Importadores" && <>
              {inp("País de origem *", biPais, setBiPais, { placeholder: "Ex: Argentina" })}
              {inp("Segmentos *", biSegmentos, setBiSegmentos, { placeholder: "Ex: Vinhos Tranquilos, Espumantes" })}
              {inp("Exportador", biExportadorImp, setBiExportadorImp, { placeholder: "Ex: BODEGAS CARO (opcional)" })}
              {inp("Estado (UF)", biEstado, setBiEstado, { placeholder: "Ex: SP (opcional)" })}
            </>}

            {biModal.kind === "Exportadores" && <>
              {inp("País de origem *", biPaisDestino, setBiPaisDestino, { placeholder: "Ex: AFRICA DO SUL" })}
              {inp("Distribuidor", biDistribuidor, setBiDistribuidor, { placeholder: "Ex: Grand Cru (opcional)" })}
              {inp("FOB US$", biValor, setBiValor, { placeholder: "Ex: 22914.71", type: "number" })}
              {inp("Vol. CX9L", biCaixas, setBiCaixas, { placeholder: "Ex: 530.00", type: "number" })}
              {inp("US$ / CX9L", biPreco, setBiPreco, { placeholder: "Ex: 43.24", type: "number" })}
            </>}

            {biModal.kind === "Produtores" && <>
              {inp("Nome Fantasia", biNomeFantasia, setBiNomeFantasia, { placeholder: "Ex: Vinícola Miolo (opcional)" })}
              {inp("Região *", biRegiao, setBiRegiao, { placeholder: "Ex: Serra Gaúcha" })}
              {inp("Estado (UF) *", biEstadoProd, setBiEstadoProd, { placeholder: "Ex: RS" })}
              {inp("Tipos de vinho *", biTipos, setBiTipos, { placeholder: "Ex: Espumantes, Merlot, Chardonnay" })}
              {inp("Ano de fundação", biFundado, setBiFundado, { placeholder: "Ex: 1989 (opcional)", type: "number" })}
            </>}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={() => setBiModal(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSaveBi} disabled={biSaving} style={{ ...btnPrimary, flex: 1, opacity: biSaving ? 0.6 : 1 }}>
                {biSaving ? "Salvando..." : biModal.row ? "Atualizar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
