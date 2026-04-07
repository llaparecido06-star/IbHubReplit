import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import {
  fetchMarketOverview,
  updateMarketOverview,
  type MarketKPI,
  type MarketTendencia,
  type MarketRegiao,
  type MarketVariedade,
  type MarketChartArea,
  type MarketChartBar,
} from "@/services/api";

type Period = "mes" | "trimestre" | "ano";
const MAIN_TABS  = ["Slides", "Dados de Mercado"] as const;
const PERIODS: { key: Period; label: string }[] = [
  { key: "mes",       label: "Mês" },
  { key: "trimestre", label: "Trimestre" },
  { key: "ano",       label: "Ano" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function numArr(s: string): number[] {
  return s.split(",").map((x) => parseFloat(x.trim())).filter((n) => !isNaN(n));
}
function strArr(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
function joinNum(arr: number[]): string { return arr.join(", "); }
function joinStr(arr: string[]): string { return arr.join(", "); }

// ─── Edit Modal types ────────────────────────────────────────────────────────

type ModalType = "tendencia" | "regiao" | "variedade";
interface EditModal {
  type: ModalType;
  index: number | null;
  tendencia?: MarketTendencia;
  regiao?: MarketRegiao;
  variedade?: MarketVariedade;
}

// ─── KPI Section ─────────────────────────────────────────────────────────────

const KPI_LABELS = ["Exportação", "Importação", "Produção"];

interface KpiSectionProps {
  kpis: MarketKPI[];
  onChange: (kpis: MarketKPI[]) => void;
  colors: ReturnType<typeof useColors>;
}
function KpiSection({ kpis, onChange, colors }: KpiSectionProps) {
  return (
    <View style={sec.wrapper}>
      <Text style={[sec.title, { color: colors.navy }]}>KPIs</Text>
      {kpis.map((kpi, i) => (
        <View key={i} style={[sec.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[sec.cardLabel, { color: colors.mutedForeground }]}>{kpi.label || KPI_LABELS[i]}</Text>
          <View style={sec.row}>
            <View style={sec.fieldHalf}>
              <Text style={[sec.fieldLabel, { color: colors.foreground }]}>Valor</Text>
              <TextInput
                style={[sec.input, { borderColor: colors.border }]}
                value={kpi.value}
                onChangeText={(v) => {
                  const updated = [...kpis];
                  updated[i] = { ...kpi, value: v };
                  onChange(updated);
                }}
                placeholder="US$ 3.8M"
              />
            </View>
            <View style={sec.fieldHalf}>
              <Text style={[sec.fieldLabel, { color: colors.foreground }]}>Período</Text>
              <TextInput
                style={[sec.input, { borderColor: colors.border }]}
                value={kpi.period}
                onChangeText={(v) => {
                  const updated = [...kpis];
                  updated[i] = { ...kpi, period: v };
                  onChange(updated);
                }}
                placeholder="Mar/2026"
              />
            </View>
          </View>
          <View style={sec.row}>
            <View style={sec.fieldHalf}>
              <Text style={[sec.fieldLabel, { color: colors.foreground }]}>Variação (%)</Text>
              <TextInput
                style={[sec.input, { borderColor: colors.border }]}
                value={String(kpi.change)}
                onChangeText={(v) => {
                  const updated = [...kpis];
                  updated[i] = { ...kpi, change: parseFloat(v) || 0 };
                  onChange(updated);
                }}
                keyboardType="decimal-pad"
                placeholder="9.2"
              />
            </View>
            <View style={sec.fieldHalf}>
              <Text style={[sec.fieldLabel, { color: colors.foreground }]}>Label</Text>
              <TextInput
                style={[sec.input, { borderColor: colors.border }]}
                value={kpi.label}
                onChangeText={(v) => {
                  const updated = [...kpis];
                  updated[i] = { ...kpi, label: v };
                  onChange(updated);
                }}
                placeholder="Exportação"
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Charts Section ───────────────────────────────────────────────────────────

interface ChartsSectionProps {
  area: { exports: string; imports: string; labels: string };
  bar: { values: string; labels: string };
  onArea: (f: keyof ChartsSectionProps["area"], v: string) => void;
  onBar: (f: keyof ChartsSectionProps["bar"], v: string) => void;
  colors: ReturnType<typeof useColors>;
}
function ChartsSection({ area, bar, onArea, onBar, colors }: ChartsSectionProps) {
  return (
    <View style={sec.wrapper}>
      <Text style={[sec.title, { color: colors.navy }]}>Gráficos</Text>

      <View style={[sec.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
        <Text style={[sec.cardLabel, { color: colors.mutedForeground }]}>Área — Exportações/Importações</Text>
        <Text style={[sec.hint, { color: colors.mutedForeground }]}>Valores separados por vírgula, na mesma ordem dos labels.</Text>
        {(["exports", "imports", "labels"] as const).map((field) => (
          <View key={field} style={{ marginTop: 8 }}>
            <Text style={[sec.fieldLabel, { color: colors.foreground }]}>
              {field === "exports" ? "Exportações" : field === "imports" ? "Importações" : "Labels"}
            </Text>
            <TextInput
              style={[sec.input, { borderColor: colors.border }]}
              value={area[field as keyof typeof area]}
              onChangeText={(v) => onArea(field as keyof typeof area, v)}
              placeholder={field === "labels" ? "Jan, Fev, Mar..." : "3.2, 3.5, 3.8..."}
              multiline={false}
            />
          </View>
        ))}
      </View>

      <View style={[sec.card, { backgroundColor: "#fff", borderColor: colors.border, marginTop: 10 }]}>
        <Text style={[sec.cardLabel, { color: colors.mutedForeground }]}>Barras — Produção Nacional</Text>
        <Text style={[sec.hint, { color: colors.mutedForeground }]}>Valores separados por vírgula.</Text>
        {(["values", "labels"] as const).map((field) => (
          <View key={field} style={{ marginTop: 8 }}>
            <Text style={[sec.fieldLabel, { color: colors.foreground }]}>
              {field === "values" ? "Valores" : "Labels"}
            </Text>
            <TextInput
              style={[sec.input, { borderColor: colors.border }]}
              value={bar[field]}
              onChangeText={(v) => onBar(field, v)}
              placeholder={field === "labels" ? "Q1, Q2, Q3, Q4" : "320, 290, 345, 310"}
              multiline={false}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Generic list section ─────────────────────────────────────────────────────

interface ListSectionProps<T> {
  title: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onAdd: () => void;
  colors: ReturnType<typeof useColors>;
}
function ListSection<T>({ title, items, renderItem, onAdd, colors }: ListSectionProps<T>) {
  return (
    <View style={sec.wrapper}>
      <View style={sec.listHeader}>
        <Text style={[sec.title, { color: colors.navy }]}>{title}</Text>
        <TouchableOpacity style={[sec.addBtn, { backgroundColor: colors.navy }]} onPress={onAdd}>
          <Feather name="plus" size={13} color="#fff" />
          <Text style={sec.addBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
      {items.length === 0 && (
        <View style={[sec.empty, { borderColor: colors.border }]}>
          <Text style={[sec.emptyText, { color: colors.mutedForeground }]}>Nenhum item. Toque em Adicionar.</Text>
        </View>
      )}
      {items.map((item, i) => renderItem(item, i))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminSlidesMercadoScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 0 : insets.top;
  const botPad  = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mainTab,    setMainTab]    = useState<typeof MAIN_TABS[number]>("Dados de Mercado");
  const [period,     setPeriod]     = useState<Period>("ano");
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  // Editable state
  const [kpis,       setKpis]       = useState<MarketKPI[]>([]);
  const [areaExp,    setAreaExp]     = useState("");
  const [areaImp,    setAreaImp]     = useState("");
  const [areaLbl,    setAreaLbl]     = useState("");
  const [barVal,     setBarVal]      = useState("");
  const [barLbl,     setBarLbl]      = useState("");
  const [tendencias, setTendencias]  = useState<MarketTendencia[]>([]);
  const [regioes,    setRegioes]     = useState<MarketRegiao[]>([]);
  const [variedades, setVariedades]  = useState<MarketVariedade[]>([]);

  // Modal state
  const [editModal,  setEditModal]   = useState<EditModal | null>(null);
  // Tendência modal fields
  const [mTitle,     setMTitle]      = useState("");
  const [mDesc,      setMDesc]       = useState("");
  const [mChange,    setMChange]     = useState("");
  const [mPos,       setMPos]        = useState(true);
  // Região modal fields
  const [mRank,      setMRank]       = useState("");
  const [mName,      setMName]       = useState("");
  const [mVolume,    setMVolume]     = useState("");
  const [mPct,       setMPct]        = useState("");
  // Variedade modal fields
  const [mVarName,   setMVarName]    = useState("");
  const [mVarVol,    setMVarVol]     = useState("");
  const [mVarChg,    setMVarChg]     = useState("");

  // ── Load data ───────────────────────────────────────────────────────────────

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const data = await fetchMarketOverview(p);
    if (data) {
      setKpis(data.kpis ?? []);
      setAreaExp(joinNum(data.chart_area?.exports ?? []));
      setAreaImp(joinNum(data.chart_area?.imports ?? []));
      setAreaLbl(joinStr(data.chart_area?.labels  ?? []));
      setBarVal( joinNum(data.chart_bar?.values   ?? []));
      setBarLbl( joinStr(data.chart_bar?.labels   ?? []));
      setTendencias(data.tendencias ?? []);
      setRegioes(data.regioes       ?? []);
      setVariedades(data.variedades ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (mainTab === "Dados de Mercado") load(period); }, [period, mainTab, load]);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    const chart_area: MarketChartArea = {
      exports: numArr(areaExp),
      imports: numArr(areaImp),
      labels:  strArr(areaLbl),
      yLabels: [],
    };
    const chart_bar: MarketChartBar = {
      values: numArr(barVal),
      labels: strArr(barLbl),
    };
    const ok = await updateMarketOverview(period, {
      kpis, chart_area, chart_bar, tendencias, regioes, variedades,
    });
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      Alert.alert("Erro", "Não foi possível salvar. Verifique sua conexão.");
    }
  };

  // ── Open edit modals ─────────────────────────────────────────────────────────

  const openTendenciaModal = (index: number | null) => {
    if (index !== null) {
      const t = tendencias[index];
      setMTitle(t.title); setMDesc(t.desc); setMChange(String(t.change)); setMPos(t.pos);
    } else {
      setMTitle(""); setMDesc(""); setMChange(""); setMPos(true);
    }
    setEditModal({ type: "tendencia", index });
  };

  const openRegiaoModal = (index: number | null) => {
    if (index !== null) {
      const r = regioes[index];
      setMRank(String(r.rank)); setMName(r.name); setMVolume(r.volume); setMPct(String(r.pct));
    } else {
      setMRank(String(regioes.length + 1)); setMName(""); setMVolume(""); setMPct("");
    }
    setEditModal({ type: "regiao", index });
  };

  const openVariedadeModal = (index: number | null) => {
    if (index !== null) {
      const v = variedades[index];
      setMVarName(v.name); setMVarVol(v.volume); setMVarChg(String(v.change));
    } else {
      setMVarName(""); setMVarVol(""); setMVarChg("");
    }
    setEditModal({ type: "variedade", index });
  };

  // ── Save modal item ─────────────────────────────────────────────────────────

  const saveModalItem = () => {
    if (!editModal) return;
    if (editModal.type === "tendencia") {
      const item: MarketTendencia = { title: mTitle, desc: mDesc, change: parseFloat(mChange) || 0, pos: mPos };
      if (editModal.index !== null) {
        const updated = [...tendencias]; updated[editModal.index] = item; setTendencias(updated);
      } else { setTendencias([...tendencias, item]); }
    } else if (editModal.type === "regiao") {
      const item: MarketRegiao = { rank: parseInt(mRank) || regioes.length + 1, name: mName, volume: mVolume, pct: parseFloat(mPct) || 0 };
      if (editModal.index !== null) {
        const updated = [...regioes]; updated[editModal.index] = item; setRegioes(updated);
      } else { setRegioes([...regioes, item]); }
    } else if (editModal.type === "variedade") {
      const item: MarketVariedade = { name: mVarName, volume: mVarVol, change: parseFloat(mVarChg) || 0 };
      if (editModal.index !== null) {
        const updated = [...variedades]; updated[editModal.index] = item; setVariedades(updated);
      } else { setVariedades([...variedades, item]); }
    }
    setEditModal(null);
  };

  // ── Delete item ──────────────────────────────────────────────────────────────

  const deleteItem = (type: ModalType, index: number) => {
    Alert.alert("Remover", "Deseja remover este item?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: () => {
          if (type === "tendencia") setTendencias(tendencias.filter((_, i) => i !== index));
          else if (type === "regiao")   setRegioes(regioes.filter((_, i) => i !== index));
          else if (type === "variedade") setVariedades(variedades.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.navy }]}>Slides Mercado</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: botPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ gap: 4 }}>
          <Text style={[s.heroTitle, { color: colors.navy }]}>Mercado</Text>
          <Text style={[s.heroSub,  { color: colors.mutedForeground }]}>
            Gerencie apresentações e dados de inteligência de mercado
          </Text>
        </View>

        {/* Main tabs */}
        <View style={[s.mainTabs, { backgroundColor: "#f3f4f6" }]}>
          {MAIN_TABS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.mainTab, t === mainTab && { backgroundColor: "#fff" }]}
              onPress={() => setMainTab(t)}
            >
              <Feather
                name={t === "Slides" ? "monitor" : "bar-chart-2"}
                size={13}
                color={t === mainTab ? colors.navy : colors.mutedForeground}
              />
              <Text style={[s.mainTabText, { color: t === mainTab ? colors.navy : colors.mutedForeground, fontWeight: t === mainTab ? "700" : "400" }]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Slides tab (placeholder) ─────────────────────────────────────── */}
        {mainTab === "Slides" && (
          <>
            <View style={[s.slidesRow]}>
              <Text style={[s.slidesCount, { color: colors.mutedForeground }]}>0 slides</Text>
            </View>
            <View style={s.emptyBlock}>
              <Feather name="monitor" size={40} color="#d1d5db" />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Nenhum slide encontrado</Text>
            </View>
          </>
        )}

        {/* ── Dados de Mercado tab ─────────────────────────────────────────── */}
        {mainTab === "Dados de Mercado" && (
          <>
            {/* Period selector */}
            <View style={s.periodRow}>
              {PERIODS.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[s.periodBtn, { borderColor: key === period ? colors.gold : colors.border, backgroundColor: key === period ? colors.gold + "15" : "#fff" }]}
                  onPress={() => setPeriod(key)}
                >
                  <Text style={[s.periodBtnText, { color: key === period ? colors.gold : colors.foreground, fontWeight: key === period ? "700" : "400" }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
            ) : (
              <>
                {/* KPIs */}
                <KpiSection kpis={kpis} onChange={setKpis} colors={colors} />

                {/* Charts */}
                <ChartsSection
                  area={{ exports: areaExp, imports: areaImp, labels: areaLbl }}
                  bar={{ values: barVal, labels: barLbl }}
                  onArea={(f, v) => { if (f === "exports") setAreaExp(v); else if (f === "imports") setAreaImp(v); else setAreaLbl(v); }}
                  onBar={(f, v) => { if (f === "values") setBarVal(v); else setBarLbl(v); }}
                  colors={colors}
                />

                {/* Tendências */}
                <ListSection
                  title="Tendências"
                  items={tendencias}
                  colors={colors}
                  onAdd={() => openTendenciaModal(null)}
                  renderItem={(item, i) => (
                    <View key={i} style={[sec.row, sec.listItem, { backgroundColor: "#fff", borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[sec.itemTitle, { color: colors.navy }]}>{item.title}</Text>
                        <Text style={[sec.itemSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.desc}</Text>
                        <Text style={[sec.itemBadge, { color: item.pos ? "#059669" : "#dc2626" }]}>
                          {item.pos ? "+" : ""}{item.change}%
                        </Text>
                      </View>
                      <View style={sec.itemActions}>
                        <TouchableOpacity style={[sec.actionBtn, { backgroundColor: "#f3f4f6" }]} onPress={() => openTendenciaModal(i)}>
                          <Feather name="edit-2" size={13} color={colors.navy} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[sec.actionBtn, { backgroundColor: "#fef2f2" }]} onPress={() => deleteItem("tendencia", i)}>
                          <Feather name="trash-2" size={13} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />

                {/* Regiões */}
                <ListSection
                  title="Regiões Produtoras"
                  items={regioes}
                  colors={colors}
                  onAdd={() => openRegiaoModal(null)}
                  renderItem={(item, i) => (
                    <View key={i} style={[sec.row, sec.listItem, { backgroundColor: "#fff", borderColor: colors.border }]}>
                      <View style={[sec.rank, { backgroundColor: colors.gold + "20" }]}>
                        <Text style={[sec.rankText, { color: colors.gold }]}>#{item.rank}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[sec.itemTitle, { color: colors.navy }]}>{item.name}</Text>
                        <Text style={[sec.itemSub, { color: colors.mutedForeground }]}>{item.volume} · {item.pct}%</Text>
                      </View>
                      <View style={sec.itemActions}>
                        <TouchableOpacity style={[sec.actionBtn, { backgroundColor: "#f3f4f6" }]} onPress={() => openRegiaoModal(i)}>
                          <Feather name="edit-2" size={13} color={colors.navy} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[sec.actionBtn, { backgroundColor: "#fef2f2" }]} onPress={() => deleteItem("regiao", i)}>
                          <Feather name="trash-2" size={13} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />

                {/* Variedades */}
                <ListSection
                  title="Variedades"
                  items={variedades}
                  colors={colors}
                  onAdd={() => openVariedadeModal(null)}
                  renderItem={(item, i) => (
                    <View key={i} style={[sec.row, sec.listItem, { backgroundColor: "#fff", borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[sec.itemTitle, { color: colors.navy }]}>{item.name}</Text>
                        <Text style={[sec.itemSub, { color: colors.mutedForeground }]}>Volume: {item.volume}</Text>
                        <Text style={[sec.itemBadge, { color: item.change >= 0 ? "#059669" : "#dc2626" }]}>
                          {item.change >= 0 ? "+" : ""}{item.change}%
                        </Text>
                      </View>
                      <View style={sec.itemActions}>
                        <TouchableOpacity style={[sec.actionBtn, { backgroundColor: "#f3f4f6" }]} onPress={() => openVariedadeModal(i)}>
                          <Feather name="edit-2" size={13} color={colors.navy} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[sec.actionBtn, { backgroundColor: "#fef2f2" }]} onPress={() => deleteItem("variedade", i)}>
                          <Feather name="trash-2" size={13} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />

                {/* Save button */}
                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: saved ? "#059669" : colors.navy, opacity: saving ? 0.7 : 1 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name={saved ? "check" : "save"} size={16} color="#fff" />
                      <Text style={s.saveBtnText}>{saved ? "Salvo!" : "Salvar período"}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={!!editModal} transparent animationType="fade">
        <View style={m.overlay}>
          <View style={[m.modal, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={m.close} onPress={() => setEditModal(null)}>
              <Feather name="x" size={18} color="#6b7280" />
            </TouchableOpacity>
            <Text style={[m.title, { color: colors.navy }]}>
              {editModal?.index !== null ? "Editar" : "Adicionar"}{" "}
              {editModal?.type === "tendencia" ? "Tendência" : editModal?.type === "regiao" ? "Região" : "Variedade"}
            </Text>

            {editModal?.type === "tendencia" && (
              <>
                <View style={m.field}>
                  <Text style={[m.label, { color: colors.foreground }]}>Título *</Text>
                  <TextInput style={[m.input, { borderColor: colors.border }]} value={mTitle} onChangeText={setMTitle} placeholder="Ex: Crescimento do mercado orgânico" />
                </View>
                <View style={m.field}>
                  <Text style={[m.label, { color: colors.foreground }]}>Descrição</Text>
                  <TextInput style={[m.input, m.textarea, { borderColor: colors.border }]} value={mDesc} onChangeText={setMDesc} multiline textAlignVertical="top" placeholder="Breve descrição da tendência..." />
                </View>
                <View style={m.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[m.label, { color: colors.foreground }]}>Variação (%)</Text>
                    <TextInput style={[m.input, { borderColor: colors.border }]} value={mChange} onChangeText={setMChange} keyboardType="decimal-pad" placeholder="12.5" />
                  </View>
                  <View style={m.switchField}>
                    <Text style={[m.label, { color: colors.foreground }]}>Positivo</Text>
                    <Switch value={mPos} onValueChange={setMPos} trackColor={{ false: colors.border, true: "#059669" }} thumbColor="#fff" />
                  </View>
                </View>
              </>
            )}

            {editModal?.type === "regiao" && (
              <>
                <View style={m.row}>
                  <View style={{ flex: 0.4 }}>
                    <Text style={[m.label, { color: colors.foreground }]}>Rank</Text>
                    <TextInput style={[m.input, { borderColor: colors.border }]} value={mRank} onChangeText={setMRank} keyboardType="number-pad" placeholder="1" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[m.label, { color: colors.foreground }]}>Nome *</Text>
                    <TextInput style={[m.input, { borderColor: colors.border }]} value={mName} onChangeText={setMName} placeholder="Serra Gaúcha" />
                  </View>
                </View>
                <View style={m.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[m.label, { color: colors.foreground }]}>Volume</Text>
                    <TextInput style={[m.input, { borderColor: colors.border }]} value={mVolume} onChangeText={setMVolume} placeholder="4.2M L" />
                  </View>
                  <View style={{ flex: 0.6, marginLeft: 8 }}>
                    <Text style={[m.label, { color: colors.foreground }]}>% do total</Text>
                    <TextInput style={[m.input, { borderColor: colors.border }]} value={mPct} onChangeText={setMPct} keyboardType="decimal-pad" placeholder="32" />
                  </View>
                </View>
              </>
            )}

            {editModal?.type === "variedade" && (
              <>
                <View style={m.field}>
                  <Text style={[m.label, { color: colors.foreground }]}>Nome *</Text>
                  <TextInput style={[m.input, { borderColor: colors.border }]} value={mVarName} onChangeText={setMVarName} placeholder="Cabernet Sauvignon" />
                </View>
                <View style={m.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[m.label, { color: colors.foreground }]}>Volume</Text>
                    <TextInput style={[m.input, { borderColor: colors.border }]} value={mVarVol} onChangeText={setMVarVol} placeholder="1.8M L" />
                  </View>
                  <View style={{ flex: 0.6, marginLeft: 8 }}>
                    <Text style={[m.label, { color: colors.foreground }]}>Variação %</Text>
                    <TextInput style={[m.input, { borderColor: colors.border }]} value={mVarChg} onChangeText={setMVarChg} keyboardType="decimal-pad" placeholder="8.4" />
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity style={[m.saveBtn, { backgroundColor: colors.navy }]} onPress={saveModalItem}>
              <Text style={m.saveBtnText}>Salvar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.cancelBtn} onPress={() => setEditModal(null)}>
              <Text style={[m.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/slides-mercado" />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 18, fontWeight: "700" },
  heroTitle:    { fontSize: 22, fontWeight: "800" },
  heroSub:      { fontSize: 13, lineHeight: 18 },
  mainTabs:     { flexDirection: "row", borderRadius: 10, padding: 4, gap: 4 },
  mainTab:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8 },
  mainTabText:  { fontSize: 13 },
  slidesRow:    { flexDirection: "row", alignItems: "center" },
  slidesCount:  { fontSize: 13 },
  emptyBlock:   { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText:    { fontSize: 14 },
  periodRow:    { flexDirection: "row", gap: 8 },
  periodBtn:    { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  periodBtnText:{ fontSize: 14 },
  saveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  saveBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
});

const sec = StyleSheet.create({
  wrapper:     { gap: 8 },
  title:       { fontSize: 16, fontWeight: "700" },
  card:        { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  cardLabel:   { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  hint:        { fontSize: 11, lineHeight: 16 },
  row:         { flexDirection: "row", gap: 10 },
  fieldHalf:   { flex: 1, gap: 4 },
  fieldLabel:  { fontSize: 12, fontWeight: "600" },
  input:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13 },
  listHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText:  { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty:       { borderWidth: 1, borderRadius: 10, padding: 20, alignItems: "center", borderStyle: "dashed" },
  emptyText:   { fontSize: 13 },
  listItem:    { borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  itemTitle:   { fontSize: 14, fontWeight: "600" },
  itemSub:     { fontSize: 12, marginTop: 2 },
  itemBadge:   { fontSize: 12, fontWeight: "700", marginTop: 2 },
  itemActions: { flexDirection: "row", gap: 6, marginLeft: 8 },
  actionBtn:   { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rank:        { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 10 },
  rankText:    { fontSize: 12, fontWeight: "700" },
});

const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal:      { width: "100%", maxWidth: 400, borderRadius: 16, padding: 20, gap: 12 },
  close:      { position: "absolute", top: 14, right: 14 },
  title:      { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  field:      { gap: 5 },
  label:      { fontSize: 12, fontWeight: "600" },
  input:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13 },
  textarea:   { height: 72, textAlignVertical: "top" },
  row:        { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  switchField:{ gap: 5, alignItems: "center" },
  saveBtn:    { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  saveBtnText:{ color: "#fff", fontSize: 15, fontWeight: "700" },
  cancelBtn:  { paddingVertical: 10, alignItems: "center" },
  cancelText: { fontSize: 14 },
});
