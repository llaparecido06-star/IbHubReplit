import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Svg,
  Text as SvgText,
  Line,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";

// ─── Types ──────────────────────────────────────────────────────────────────

type Period = "mes" | "trimestre" | "ano";
type MercadoTab = "visao" | "apresentacoes";

interface KPI {
  label: string;
  value: string;
  period: string;
  change: number;
  icon: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const KPI_DATA: Record<Period, KPI[]> = {
  mes: [
    { label: "Exportações BR",        value: "US$ 3.8M",   period: "Mar/2026",   change: 9.2,  icon: "globe" },
    { label: "Importações de Vinho",  value: "R$ 185M",    period: "Mar/2026",   change: 6.1,  icon: "trending-up" },
    { label: "Produção Nacional",     value: "29M litros",  period: "Mar/2026",  change: 3.5,  icon: "bar-chart-2" },
  ],
  trimestre: [
    { label: "Exportações BR",        value: "US$ 11.2M",  period: "Q1 2026",   change: 10.8, icon: "globe" },
    { label: "Importações de Vinho",  value: "R$ 540M",    period: "Q1 2026",   change: 7.4,  icon: "trending-up" },
    { label: "Produção Nacional",     value: "88M litros", period: "Q1 2026",   change: 4.1,  icon: "bar-chart-2" },
  ],
  ano: [
    { label: "Exportações BR",        value: "US$ 42M",    period: "2025",      change: 12.5, icon: "globe" },
    { label: "Importações de Vinho",  value: "R$ 2.1B",    period: "2025",      change: 8.3,  icon: "trending-up" },
    { label: "Produção Nacional",     value: "350M litros", period: "2025",     change: 4.7,  icon: "bar-chart-2" },
  ],
};

const CHART_AREA = {
  exports:  [32, 35, 38, 44],   // normalized 0–100
  imports:  [72, 79, 86, 91],
  labels:   ["Q1", "Q2", "Q3", "Q4"],
  yLabels:  ["0", "150", "300", "450", "600"],
};

const BAR_DATA = [75, 80, 85, 87];

const TENDENCIAS = [
  { title: "Espumantes brasileiros em alta",    desc: "Crescimento de 22% nas vendas de espumantes nacionais, com destaque para a Serra Gaúcha.", change: 22, pos: true },
  { title: "Vinhos naturais ganham espaço",     desc: "Segmento de vinhos naturais e orgânicos cresce 15% ao ano, impulsionado por consumidores jovens.", change: 15, pos: true },
  { title: "Importação de tintos chilenos recua", desc: "Queda de 3.2% nas importações de tintos do Chile em relação ao mesmo período do ano passado.", change: -3.2, pos: false },
];

const REGIOES = [
  { rank: 1, name: "Serra Gaúcha",          volume: "180M litros", pct: 51 },
  { rank: 2, name: "Campanha Gaúcha",       volume: "45M litros",  pct: 13 },
  { rank: 3, name: "Vale do São Francisco", volume: "38M litros",  pct: 11 },
  { rank: 4, name: "Planalto Catarinense",  volume: "22M litros",  pct: 6  },
];

const VARIEDADES = [
  { name: "Merlot",              volume: "42M litros", change: 5.1  },
  { name: "Cabernet Sauvignon",  volume: "38M litros", change: 3.8  },
  { name: "Chardonnay",          volume: "28M litros", change: 9.2  },
  { name: "Pinot Noir",          volume: "18M litros", change: 2.1  },
];

// ─── Area Chart Component ─────────────────────────────────────────────────────

function AreaChart() {
  const W = 310, H = 140;
  const padL = 36, padR = 12, padT = 12, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const toX = (i: number) => padL + (i / (CHART_AREA.labels.length - 1)) * chartW;
  const toY = (v: number) => padT + (1 - v / 100) * chartH;

  const exportsPath = CHART_AREA.exports
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(v)}`).join(" ");
  const importsPath = CHART_AREA.imports
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(v)}`).join(" ");

  const importsArea = `${importsPath} L${toX(CHART_AREA.imports.length - 1)},${padT + chartH} L${padL},${padT + chartH} Z`;

  return (
    <Svg width={W} height={H} style={{ overflow: "visible" }}>
      <Defs>
        <LinearGradient id="importGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor="#ef4444" stopOpacity="0.3" />
          <Stop offset="1"   stopColor="#ef4444" stopOpacity="0.03" />
        </LinearGradient>
      </Defs>

      {/* Y gridlines */}
      {CHART_AREA.yLabels.map((lbl, i) => {
        const y = padT + (i / (CHART_AREA.yLabels.length - 1)) * chartH;
        return (
          <React.Fragment key={lbl}>
            <Line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <SvgText x={padL - 4} y={y + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{lbl}</SvgText>
          </React.Fragment>
        );
      })}

      {/* Imports area fill */}
      <Path d={importsArea} fill="url(#importGrad)" />

      {/* Imports line */}
      <Path d={importsPath} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Exports line (gold, flat near bottom) */}
      <Path d={exportsPath} fill="none" stroke="#c9a84c" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* X axis labels */}
      {CHART_AREA.labels.map((lbl, i) => (
        <SvgText key={lbl} x={toX(i)} y={H - 4} fontSize={10} fill="#9ca3af" textAnchor="middle">{lbl}</SvgText>
      ))}
    </Svg>
  );
}

// ─── Bar Chart Component ──────────────────────────────────────────────────────

function BarChart() {
  const W = 310, H = 110;
  const padL = 36, padR = 12, padT = 8, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = (chartW / BAR_DATA.length) * 0.55;
  const gap  = chartW / BAR_DATA.length;
  const maxV = 100;

  const yLabels = ["0", "25", "50", "75", "100"];

  return (
    <Svg width={W} height={H}>
      {/* Y gridlines */}
      {yLabels.map((lbl, i) => {
        const y = padT + (1 - Number(lbl) / maxV) * chartH;
        return (
          <React.Fragment key={lbl}>
            <Line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <SvgText x={padL - 4} y={y + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{lbl}</SvgText>
          </React.Fragment>
        );
      })}

      {/* Bars */}
      {BAR_DATA.map((v, i) => {
        const barH = (v / maxV) * chartH;
        const x    = padL + i * gap + (gap - barW) / 2;
        const y    = padT + chartH - barH;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={4} fill="#c9a84c" />
            <SvgText x={x + barW / 2} y={H - 6} fontSize={10} fill="#9ca3af" textAnchor="middle">
              {`Q${i + 1}`}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MercadoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [period, setPeriod]     = useState<Period>("ano");
  const [mainTab, setMainTab]   = useState<MercadoTab>("visao");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const kpis = KPI_DATA[period];

  const periods: { key: Period; label: string }[] = [
    { key: "mes",       label: "Último Mês"     },
    { key: "trimestre", label: "Trimestre (YTD)" },
    { key: "ano",       label: "Último Ano"     },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle,    { color: colors.navy }]}>Mercado</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Inteligência de mercado do vinho</Text>
        </View>
      </View>

      {/* Main Tabs: Visão Geral | Apresentações */}
      <View style={[styles.mainTabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "visao",         label: "Visão Geral",    icon: "bar-chart-2" },
          { key: "apresentacoes", label: "Apresentações",  icon: "monitor"     },
        ] as { key: MercadoTab; label: string; icon: any }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.mainTabBtn,
              mainTab === t.key && [styles.mainTabBtnActive, { backgroundColor: "#fff", borderColor: colors.border }],
            ]}
            onPress={() => setMainTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={mainTab === t.key ? colors.navy : colors.mutedForeground} />
            <Text style={[styles.mainTabText, { color: mainTab === t.key ? colors.navy : colors.mutedForeground, fontWeight: mainTab === t.key ? "700" : "500" }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mainTab === "apresentacoes" ? (
        <ApresentacoesView colors={colors} bottomPad={bottomPad} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
          {/* Period filter */}
          <View style={[styles.periodRow, { backgroundColor: "#fff" }]}>
            {periods.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.periodBtn,
                  period === p.key && [styles.periodBtnActive, { backgroundColor: colors.gold }],
                ]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.periodBtnText, { color: period === p.key ? "#fff" : colors.mutedForeground }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* KPI Cards */}
          <View style={styles.kpiList}>
            {kpis.map((kpi) => (
              <KPICard key={kpi.label} kpi={kpi} colors={colors} />
            ))}
          </View>

          {/* Area chart */}
          <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.navy }]}>Evolução de Exportações {"&"} Importações</Text>
            </View>
            <AreaChart />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.gold }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Exportações</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Importações</Text>
              </View>
              <TouchableOpacity style={styles.fonteBtn}>
                <Feather name="info" size={11} color={colors.mutedForeground} />
                <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>Fonte</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bar chart */}
          <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.navy }]}>Produção Nacional por Período</Text>
            </View>
            <BarChart />
            <TouchableOpacity style={[styles.fonteBtn, { alignSelf: "flex-end" }]}>
              <Feather name="info" size={11} color={colors.mutedForeground} />
              <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>Fonte</Text>
            </TouchableOpacity>
          </View>

          {/* Tendências */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.navy }]}>Tendências</Text>
            {TENDENCIAS.map((t) => (
              <View key={t.title} style={[styles.tendCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <View style={styles.tendHeader}>
                  <Text style={[styles.tendTitle, { color: colors.navy }]}>{t.title}</Text>
                  <Text style={[styles.tendChange, { color: t.pos ? "#16a34a" : "#dc2626" }]}>
                    {t.pos ? "+" : ""}{t.change}%
                  </Text>
                </View>
                <Text style={[styles.tendDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
                <TouchableOpacity style={styles.fonteBtn}>
                  <Feather name="info" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>Fonte</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Regiões Produtoras */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={{ fontSize: 18, marginRight: 6 }}>🍇</Text>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>Regiões Produtoras</Text>
            </View>
            <View style={[styles.tableCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              {REGIOES.map((r, idx) => (
                <View
                  key={r.name}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: colors.border },
                    idx === REGIOES.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={[styles.tableRank, { color: colors.mutedForeground }]}>{r.rank}</Text>
                  <View style={styles.tableMain}>
                    <Text style={[styles.tableName, { color: colors.navy }]}>{r.name}</Text>
                    <Text style={[styles.tableVolume, { color: colors.mutedForeground }]}>{r.volume}</Text>
                  </View>
                  <Text style={[styles.tablePct, { color: colors.navy }]}>{r.pct}%</Text>
                </View>
              ))}
              <TouchableOpacity style={[styles.fonteBtn, { alignSelf: "flex-end", padding: 10 }]}>
                <Feather name="info" size={11} color={colors.mutedForeground} />
                <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>Fonte</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Variedades em Destaque */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={{ fontSize: 18, marginRight: 6 }}>🍷</Text>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>Variedades em Destaque</Text>
            </View>
            <View style={[styles.tableCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              {VARIEDADES.map((v, idx) => (
                <View
                  key={v.name}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: colors.border },
                    idx === VARIEDADES.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.tableMain}>
                    <Text style={[styles.tableName, { color: colors.navy }]}>{v.name}</Text>
                    <Text style={[styles.tableVolume, { color: colors.mutedForeground }]}>{v.volume}</Text>
                  </View>
                  <Text style={[styles.tablePct, { color: "#16a34a" }]}>+{v.change}%</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ kpi, colors }: { kpi: KPI; colors: any }) {
  const isPos = kpi.change >= 0;
  return (
    <View style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={styles.kpiLeft}>
        <View style={[styles.kpiIconBox, { backgroundColor: colors.gold + "18" }]}>
          <Feather name={kpi.icon as any} size={20} color={colors.gold} />
        </View>
        <View>
          <Text style={[styles.kpiLabel,  { color: colors.mutedForeground }]}>{kpi.label}</Text>
          <Text style={[styles.kpiPeriod, { color: colors.mutedForeground }]}>{kpi.period}</Text>
          <Text style={[styles.kpiValue,  { color: colors.navy }]}>{kpi.value}</Text>
        </View>
      </View>
      <View style={styles.kpiRight}>
        <Text style={[styles.kpiChange, { color: isPos ? "#16a34a" : "#dc2626" }]}>
          {isPos ? "↑" : "↓"} +{kpi.change}%
        </Text>
        <TouchableOpacity>
          <Feather name="info" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Apresentações Tab ────────────────────────────────────────────────────────

function ApresentacoesView({ colors, bottomPad }: { colors: any; bottomPad: number }) {
  // Mock presentations (empty for now — admin uploads via admin panel)
  const presentations: any[] = [];

  if (presentations.length === 0) {
    return (
      <View style={styles.apresentacoesEmpty}>
        <View style={[styles.apresentacoesIcon, { backgroundColor: colors.background }]}>
          <Feather name="monitor" size={36} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.apresentacoesTitle, { color: colors.navy }]}>
          Nenhuma apresentação disponível
        </Text>
        <Text style={[styles.apresentacoesSub, { color: colors.mutedForeground }]}>
          As apresentações de mercado serão publicadas em breve.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 12 }}>
      {presentations.map((p) => (
        <View key={p.id} style={[styles.presentCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.presentTitle, { color: colors.navy }]}>{p.title}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle:    { fontSize: 26, fontWeight: "800" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },

  mainTabRow: {
    flexDirection: "row",
    padding: 8,
    gap: 6,
    borderBottomWidth: 1,
  },
  mainTabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "transparent",
  },
  mainTabBtnActive: {},
  mainTabText: { fontSize: 13 },

  periodRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  periodBtn: {
    flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 20,
  },
  periodBtnActive: {},
  periodBtnText: { fontSize: 12, fontWeight: "600" },

  kpiList: { gap: 10, paddingHorizontal: 16, paddingTop: 4 },
  kpiCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderRadius: 12, borderWidth: 1,
  },
  kpiLeft:    { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  kpiIconBox: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiLabel:   { fontSize: 12 },
  kpiPeriod:  { fontSize: 11 },
  kpiValue:   { fontSize: 22, fontWeight: "800", marginTop: 2 },
  kpiRight:   { alignItems: "flex-end", gap: 6 },
  kpiChange:  { fontSize: 14, fontWeight: "700" },

  chartCard: {
    margin: 16,
    marginTop: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  chartHeader: {},
  chartTitle:  { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  legend:  { flexDirection: "row", alignItems: "center", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
  fonteBtn:   { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" },
  fonteText:  { fontSize: 11 },

  section:         { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center" },
  sectionTitle:    { fontSize: 18, fontWeight: "800" },

  tendCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  tendHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tendTitle:  { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8, lineHeight: 20 },
  tendChange: { fontSize: 14, fontWeight: "800" },
  tendDesc:   { fontSize: 13, lineHeight: 19 },

  tableCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableRow:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1 },
  tableRank: { width: 22, fontSize: 14, fontWeight: "600" },
  tableMain: { flex: 1, gap: 2 },
  tableName: { fontSize: 15, fontWeight: "600" },
  tableVolume: { fontSize: 12 },
  tablePct:  { fontSize: 15, fontWeight: "700" },

  apresentacoesEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  apresentacoesIcon: {
    width: 80, height: 80, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  apresentacoesTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  apresentacoesSub:   { fontSize: 14, textAlign: "center", lineHeight: 20 },

  presentCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  presentTitle: { fontSize: 16, fontWeight: "700" },
});
