import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
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
import {
  fetchAdminStats,
  fetchUserGrowth,
  fetchPostsByType,
  AdminStats,
  UserGrowthPoint,
  PostsByTypePoint,
} from "@/services/adminApi";

const GOLD = "#c9a84c";

const ICON_COLORS: string[] = ["#6d28d9", "#ea580c", "#9333ea", "#059669"];

function LineChart({ width, data }: { width: number; data: UserGrowthPoint[] }) {
  const PL = 42; const PR = 10; const PT = 10; const PB = 30;
  const CW = width - PL - PR;
  const CH = 80;
  const H  = CH + PT + PB;

  if (data.length === 0) {
    return (
      <View style={{ width, height: H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 12, color: "#9ca3af" }}>Sem dados no período</Text>
      </View>
    );
  }

  const dates  = data.map(d => d.date.slice(5));
  const values = data.map(d => d.count);
  const yMax   = Math.max(...values, 1);

  const step = yMax <= 4 ? 1 : Math.ceil(yMax / 4);
  const yGrid = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const xAt = (i: number) =>
    data.length === 1 ? PL + CW / 2 : PL + (i / (data.length - 1)) * CW;
  const yAt = (v: number) => PT + (1 - v / yMax) * CH;

  const pts = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");

  const maxLabels = Math.floor(CW / 36);
  const step2 = Math.max(1, Math.ceil(dates.length / maxLabels));

  return (
    <Svg width={width} height={H}>
      {yGrid.map((v) => (
        <Line key={v} x1={PL} y1={yAt(v)} x2={width - PR} y2={yAt(v)} stroke="#e8eaed" strokeWidth={1} strokeDasharray="3,3" />
      ))}
      {yGrid.map((v) => (
        <SvgText key={v} x={PL - 4} y={yAt(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</SvgText>
      ))}
      {dates.map((d, i) =>
        i % step2 === 0 ? (
          <SvgText key={d + i} x={xAt(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="#9ca3af">{d}</SvgText>
        ) : null
      )}
      {data.length > 1 && (
        <Polyline points={pts} fill="none" stroke={GOLD} strokeWidth={2} />
      )}
      {values.map((v, i) => (
        <Circle key={i} cx={xAt(i)} cy={yAt(v)} r={3} fill={GOLD} />
      ))}
    </Svg>
  );
}

function BarChart({ width, data }: { width: number; data: PostsByTypePoint[] }) {
  const PL = 30; const PR = 10; const PT = 10; const PB = 38;
  const CW = width - PL - PR;
  const CH = 110;
  const H  = CH + PT + PB;

  if (data.length === 0 || data.every(d => d.v === 0)) {
    return (
      <View style={{ width, height: H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 12, color: "#9ca3af" }}>Sem publicações ainda</Text>
      </View>
    );
  }

  const yMax  = Math.max(...data.map(d => d.v), 1);
  const step  = yMax <= 4 ? 1 : Math.ceil(yMax / 4);
  const yGrid = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const barW = Math.min(55, CW / (data.length + 1));
  const gap  = (CW - data.length * barW) / (data.length + 1);

  const xAt  = (i: number) => PL + gap + i * (barW + gap);
  const yTop = (v: number) => PT + (1 - v / yMax) * CH;
  const yH   = (v: number) => (v / yMax) * CH;

  return (
    <Svg width={width} height={H}>
      {yGrid.map((v) => (
        <Line key={v} x1={PL} y1={yTop(v)} x2={width - PR} y2={yTop(v)} stroke="#e8eaed" strokeWidth={1} strokeDasharray="3,3" />
      ))}
      {yGrid.map((v) => (
        <SvgText key={v} x={PL - 4} y={yTop(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</SvgText>
      ))}
      {data.map((b, i) => (
        <Rect key={b.label} x={xAt(i)} y={yTop(b.v)} width={barW} height={Math.max(yH(b.v), 2)} fill={GOLD} rx={3} />
      ))}
      {data.map((b, i) => (
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

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [stats, setStats]             = useState<AdminStats | null>(null);
  const [growth, setGrowth]           = useState<UserGrowthPoint[]>([]);
  const [postTypes, setPostTypes]     = useState<PostsByTypePoint[]>([]);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;
  const chartW    = Math.min(width - 64, 320);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(false);
    try {
      const [s, g, p] = await Promise.all([
        fetchAdminStats(),
        fetchUserGrowth(),
        fetchPostsByType(),
      ]);
      setStats(s);
      setGrowth(g);
      setPostTypes(p);
    } catch (e) {
      console.error("AdminDashboard loadData:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const kpiItems = stats
    ? [
        {
          icon: "users" as const,
          iconBg: "#ede9fe",
          label: "Usuários",
          value: stats.totalUsers,
          sub: "total cadastrado",
        },
        {
          icon: "file-text" as const,
          iconBg: "#fff7ed",
          label: "Publicações",
          value: stats.totalPosts,
          sub: "total de posts",
        },
        {
          icon: "eye" as const,
          iconBg: "#f3e8ff",
          label: "Stories Ativos",
          value: stats.activeStories,
          sub: "últimas 24h",
        },
        {
          icon: "credit-card" as const,
          iconBg: "#d1fae5",
          label: "Assinantes Ativos",
          value: stats.activeSubscribers,
          sub: "plano não-básico",
        },
      ]
    : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Dashboard</Text>
        <TouchableOpacity onPress={loadData}>
          <Feather name="refresh-cw" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Dashboard</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Visão geral do ibhub em tempo real</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={GOLD} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Carregando dados...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingBox}>
            <Feather name="alert-circle" size={28} color="#ef4444" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Erro ao carregar dados. Tente novamente.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              {kpiItems.map((k, idx) => (
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

            <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={styles.chartHead}>
                <Feather name="activity" size={14} color={GOLD} />
                <Text style={[styles.chartTitle, { color: colors.navy }]}>Crescimento de Usuários (30d)</Text>
              </View>
              <LineChart width={chartW} data={growth} />
            </View>

            <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={styles.chartHead}>
                <Feather name="bar-chart-2" size={14} color={GOLD} />
                <Text style={[styles.chartTitle, { color: colors.navy }]}>Posts por Tipo</Text>
              </View>
              <BarChart width={chartW} data={postTypes} />
            </View>
          </>
        )}
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
  loadingBox:  { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 13 },
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
