import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, {
  Line,
  Polyline,
  Circle,
  Text as SvgText,
  Rect,
} from "react-native-svg";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";

const GOLD = "#c9a84c";

interface KPIItem {
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  label: string;
  value: string | number;
  sub: string;
}

const KPIS: KPIItem[] = [
  { icon: "users",       iconBg: "#ede9fe", label: "Usuários",          value: 8,  sub: "+1 hoje" },
  { icon: "file-text",   iconBg: "#fff7ed", label: "Publicações",       value: 14, sub: "+0 hoje" },
  { icon: "eye",         iconBg: "#f3e8ff", label: "Stories Ativos",    value: 0,  sub: "últimas 24h" },
  { icon: "credit-card", iconBg: "#d1fae5", label: "Assinantes Ativos", value: 1,  sub: "MRR: R$ 0" },
];

const ICON_COLORS: string[] = ["#6d28d9", "#ea580c", "#9333ea", "#059669"];

function LineChart({ width }: { width: number }) {
  const PL = 42; const PR = 10; const PT = 10; const PB = 30;
  const CW = width - PL - PR;
  const CH = 80;
  const H  = CH + PT + PB;

  const dates  = ["03-08", "03-09", "03-17", "03-18", "04-06"];
  const values = [0, 0, 0, 0, 1];
  const yMax   = 1;
  const yGrid  = [0, 0.25, 0.5, 0.75, 1];

  const xAt = (i: number) => PL + (i / (dates.length - 1)) * CW;
  const yAt = (v: number) => PT + (1 - v / yMax) * CH;

  const pts = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");

  return (
    <Svg width={width} height={H}>
      {/* Grid lines */}
      {yGrid.map((v) => (
        <Line key={v} x1={PL} y1={yAt(v)} x2={width - PR} y2={yAt(v)} stroke="#e8eaed" strokeWidth={1} strokeDasharray="3,3" />
      ))}
      {/* Y labels */}
      {yGrid.map((v) => (
        <SvgText key={v} x={PL - 4} y={yAt(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</SvgText>
      ))}
      {/* X labels */}
      {dates.map((d, i) => (
        <SvgText key={d} x={xAt(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="#9ca3af">{d}</SvgText>
      ))}
      {/* Line */}
      <Polyline points={pts} fill="none" stroke={GOLD} strokeWidth={2} />
      {/* Dots */}
      {values.map((v, i) => (
        <Circle key={i} cx={xAt(i)} cy={yAt(v)} r={3} fill={GOLD} />
      ))}
    </Svg>
  );
}

function BarChart({ width }: { width: number }) {
  const PL = 30; const PR = 10; const PT = 10; const PB = 38;
  const CW = width - PL - PR;
  const CH = 110;
  const H  = CH + PT + PB;

  const bars = [
    { label: "Texto",   v: 11 },
    { label: "Enquete", v: 2  },
    { label: "Imagem",  v: 1  },
  ];
  const yMax  = 12;
  const yGrid = [0, 3, 6, 9, 12];

  const barW = 55;
  const gap  = (CW - bars.length * barW) / (bars.length + 1);

  const xAt   = (i: number) => PL + gap + i * (barW + gap);
  const yTop  = (v: number) => PT + (1 - v / yMax) * CH;
  const yH    = (v: number) => (v / yMax) * CH;

  return (
    <Svg width={width} height={H}>
      {/* Grid lines */}
      {yGrid.map((v) => (
        <Line key={v} x1={PL} y1={yTop(v)} x2={width - PR} y2={yTop(v)} stroke="#e8eaed" strokeWidth={1} strokeDasharray="3,3" />
      ))}
      {/* Y labels */}
      {yGrid.map((v) => (
        <SvgText key={v} x={PL - 4} y={yTop(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</SvgText>
      ))}
      {/* Bars */}
      {bars.map((b, i) => (
        <Rect key={b.label} x={xAt(i)} y={yTop(b.v)} width={barW} height={Math.max(yH(b.v), 2)} fill={GOLD} rx={3} />
      ))}
      {/* X labels */}
      {bars.map((b, i) => (
        <SvgText key={b.label} x={xAt(i) + barW / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">{b.label}</SvgText>
      ))}
    </Svg>
  );
}

export default function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;
  const chartW    = Math.min(width - 64, 320);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Dashboard</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ gap: 4 }}>
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Dashboard</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Visão geral do ibhub em tempo real</Text>
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          {KPIS.map((k, idx) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={styles.kpiTopRow}>
                <View style={[styles.kpiIconBox, { backgroundColor: k.iconBg }]}>
                  <Feather name={k.icon} size={20} color={ICON_COLORS[idx]} />
                </View>
                <Feather name="trending-up" size={14} color="#22c55e" />
              </View>
              <Text style={[styles.kpiValue, { color: colors.navy }]}>{k.value}</Text>
              <Text style={[styles.kpiLabel, { color: colors.foreground }]}>{k.label}</Text>
              <Text style={[styles.kpiSub, { color: colors.mutedForeground }]}>{k.sub}</Text>
            </View>
          ))}
        </View>

        {/* Line chart */}
        <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.chartHead}>
            <Feather name="activity" size={14} color={GOLD} />
            <Text style={[styles.chartTitle, { color: colors.navy }]}>Crescimento de Usuários (30d)</Text>
          </View>
          <LineChart width={chartW} />
        </View>

        {/* Bar chart */}
        <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.chartHead}>
            <Feather name="bar-chart-2" size={14} color={GOLD} />
            <Text style={[styles.chartTitle, { color: colors.navy }]}>Posts por Tipo</Text>
          </View>
          <BarChart width={chartW} />
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  heroTitle:   { fontSize: 22, fontWeight: "800" },
  heroSub:     { fontSize: 13 },
  kpiGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard:     { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  kpiTopRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  kpiIconBox:  { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  kpiValue:    { fontSize: 28, fontWeight: "800" },
  kpiLabel:    { fontSize: 13, fontWeight: "600" },
  kpiSub:      { fontSize: 11 },
  chartCard:   { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  chartHead:   { flexDirection: "row", alignItems: "center", gap: 8 },
  chartTitle:  { fontSize: 14, fontWeight: "700" },
});
