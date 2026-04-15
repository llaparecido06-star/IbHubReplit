import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import Svg, { Line, Polyline, Circle, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallScreen } from "@/components/ui/PaywallScreen";
import { fetchUserAnalytics, UserAnalytics, DailyEngagement } from "@/services/api";

const CHART_W = 300;
const CHART_H = 100;

interface ChartProps {
  data: DailyEngagement[];
}

function EngagementChart({ data }: ChartProps) {
  const colors = useColors();
  const padL = 28; const padB = 28; const padR = 8; const padT = 8;
  const W = CHART_W - padL - padR;
  const H = CHART_H - padB - padT;

  const n = data.length;
  if (n < 2) return null;

  const maxVal = Math.max(...data.map((d) => Math.max(d.likes, d.comments)), 1);
  const step = Math.ceil(maxVal / 4);
  const yMax = step * 4;

  const xPos = (i: number) => padL + (i / (n - 1)) * W;
  const yPos = (v: number) => padT + H - (v / yMax) * H;

  const curtPts = data.map((d, i) => `${xPos(i)},${yPos(d.likes)}`).join(" ");
  const commPts = data.map((d, i) => `${xPos(i)},${yPos(d.comments)}`).join(" ");

  const labelIndices = [0, Math.floor((n - 1) / 3), Math.floor(2 * (n - 1) / 3), n - 1];

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {[0, 1, 2, 3, 4].map((v) => (
        <Line
          key={v}
          x1={padL} y1={yPos(v * step)} x2={CHART_W - padR} y2={yPos(v * step)}
          stroke="#e8eaed" strokeWidth={1}
        />
      ))}
      {[0, 1, 2, 3, 4].map((v) => (
        <SvgText key={v} x={padL - 4} y={yPos(v * step) + 4} textAnchor="end" fontSize={9} fill={colors.mutedForeground}>
          {v * step}
        </SvgText>
      ))}
      {labelIndices.map((i) => (
        <SvgText key={i} x={xPos(i)} y={CHART_H - 4} textAnchor="middle" fontSize={9} fill={colors.mutedForeground}>
          {data[i]?.date ?? ""}
        </SvgText>
      ))}
      <Polyline points={curtPts} fill="none" stroke="#ef4444" strokeWidth={2} />
      <Polyline points={commPts} fill="none" stroke={colors.gold} strokeWidth={2} />
      {data.map((d, i) => (
        <Circle key={`l${i}`} cx={xPos(i)} cy={yPos(d.likes)} r={3} fill="#ef4444" />
      ))}
      {data.map((d, i) => (
        <Circle key={`c${i}`} cx={xPos(i)} cy={yPos(d.comments)} r={3} fill={colors.gold} />
      ))}
    </Svg>
  );
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hasFeature, isLoading: permLoading } = usePermissions();

  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    const data = await fetchUserAnalytics(user.id);
    setAnalytics(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const a = analytics;
  const hasData = a && (a.totalPosts > 0 || a.totalLikes > 0 || a.totalComments > 0);
  const engagementRate = a && a.totalPosts > 0
    ? ((a.totalLikes + a.totalComments) / a.totalPosts).toFixed(1)
    : "0.0";

  const kpis = [
    { icon: "users",          label: "SEGUIDORES",        value: a?.followersCount ?? 0,  iconColor: colors.mutedForeground },
    { icon: "trending-up",    label: "PUBLICAÇÕES",        value: a?.totalPosts ?? 0,      iconColor: colors.gold },
    { icon: "heart",          label: "CURTIDAS TOTAIS",    value: a?.totalLikes ?? 0,      iconColor: "#ef4444" },
    { icon: "message-circle", label: "COMENTÁRIOS",        value: a?.totalComments ?? 0,   iconColor: colors.mutedForeground },
  ];

  if (!permLoading && !hasFeature("Relatórios Detalhados")) {
    return (
      <PaywallScreen
        featureName="Relatórios Detalhados"
        description="Acesse estatísticas completas do seu perfil e acompanhe o seu crescimento na rede."
        requiredPlan="Profissional"
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Analytics</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
          {/* KPI 2x2 grid */}
          <View style={styles.kpiGrid}>
            {kpis.map((k) => (
              <View key={k.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <View style={styles.kpiTop}>
                  <Feather name={k.icon as any} size={14} color={k.iconColor} />
                  <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{k.label}</Text>
                </View>
                <Text style={[styles.kpiValue, { color: colors.navy }]}>{k.value}</Text>
              </View>
            ))}
          </View>

          {/* Engagement rate */}
          <View style={[styles.engCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.engLabel, { color: colors.foreground }]}>Taxa de Engajamento</Text>
              <Text style={[styles.engValue, { color: colors.navy }]}>
                {engagementRate} <Text style={[styles.engSub, { color: colors.mutedForeground }]}>interações/post</Text>
              </Text>
            </View>
            <View style={[styles.engIcon, { backgroundColor: colors.gold + "18" }]}>
              <Feather name="bar-chart-2" size={22} color={colors.gold} />
            </View>
          </View>

          {/* Engagement chart */}
          <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.navy }]}>Engajamento (14 dias)</Text>
            {!hasData || !a?.dailyEngagement.length ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum dado ainda</Text>
            ) : (
              <>
                <View style={{ alignItems: "flex-start", marginTop: 8 }}>
                  <EngagementChart data={a.dailyEngagement} />
                </View>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                    <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Curtidas</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.gold }]} />
                    <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Comentários</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Top posts */}
          <View style={[styles.topCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.navy }]}>Posts com Mais Engajamento</Text>
            {!a?.topPosts.length ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum dado ainda</Text>
            ) : (
              a.topPosts.map((post, idx) => (
                <View key={post.id} style={[styles.topRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.topRank, { color: colors.mutedForeground }]}>{idx + 1}</Text>
                  <Text style={[styles.topTitle, { color: colors.foreground }]} numberOfLines={1}>{post.content}</Text>
                  <View style={styles.topStats}>
                    <Feather name="heart" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.topStatNum, { color: colors.mutedForeground }]}>{post.likes}</Text>
                    <Feather name="message-circle" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.topStatNum, { color: colors.mutedForeground }]}>{post.comments}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  kpiGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard:     { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  kpiTop:      { flexDirection: "row", alignItems: "center", gap: 6 },
  kpiLabel:    { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, flexShrink: 1 },
  kpiValue:    { fontSize: 30, fontWeight: "800" },
  engCard:     { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  engLabel:    { fontSize: 13, marginBottom: 4 },
  engValue:    { fontSize: 24, fontWeight: "800" },
  engSub:      { fontSize: 14, fontWeight: "400" },
  engIcon:     { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chartCard:   { borderRadius: 12, borderWidth: 1, padding: 16, gap: 4 },
  chartTitle:  { fontSize: 15, fontWeight: "700" },
  legend:      { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 12 },
  topCard:     { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  topRow:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  topRank:     { fontSize: 13, fontWeight: "700", width: 16 },
  topTitle:    { flex: 1, fontSize: 13 },
  topStats:    { flexDirection: "row", alignItems: "center", gap: 4 },
  topStatNum:  { fontSize: 12 },
  emptyText:   { fontSize: 13, textAlign: "center", paddingVertical: 16 },
});
