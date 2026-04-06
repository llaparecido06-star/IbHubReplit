import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Line, Polyline, Circle, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

const CHART_W = 300;
const CHART_H = 100;
const DATES   = ["24/3", "27/3", "30/3", "2/4", "5/4"];
const CURTIDAS_DATA  = [0, 0, 0, 0, 0];
const COMENTARIOS_DATA = [0, 0, 0, 0, 0];
const Y_MAX = 4;

const TOP_POSTS = [
  { rank: 1, title: "Goes sensacional",                        likes: 0, comments: 0 },
  { rank: 2, title: "Nova certificação conquistada! Acab...",  likes: 0, comments: 0 },
  { rank: 3, title: "Harmonização do dia: Pinot Noir da ...",  likes: 0, comments: 0 },
];

function EngagementChart() {
  const colors = useColors();
  const padL = 28; const padB = 28; const padR = 8; const padT = 8;
  const W = CHART_W - padL - padR;
  const H = CHART_H - padB - padT;

  const xPos = (i: number) => padL + (i / (DATES.length - 1)) * W;
  const yPos = (v: number) => padT + H - (v / Y_MAX) * H;

  const curtPts  = CURTIDAS_DATA.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");
  const commPts  = COMENTARIOS_DATA.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {/* Grid lines */}
      {[0, 1, 2, 3, 4].map((v) => (
        <Line
          key={v}
          x1={padL} y1={yPos(v)} x2={CHART_W - padR} y2={yPos(v)}
          stroke="#e8eaed" strokeWidth={1}
        />
      ))}
      {/* Y axis labels */}
      {[0, 1, 2, 3, 4].map((v) => (
        <SvgText key={v} x={padL - 4} y={yPos(v) + 4} textAnchor="end" fontSize={9} fill={colors.mutedForeground}>
          {v}
        </SvgText>
      ))}
      {/* X axis labels */}
      {DATES.map((d, i) => (
        <SvgText key={d} x={xPos(i)} y={CHART_H - 4} textAnchor="middle" fontSize={9} fill={colors.mutedForeground}>
          {d}
        </SvgText>
      ))}
      {/* Lines */}
      <Polyline points={curtPts} fill="none" stroke="#ef4444" strokeWidth={2} />
      <Polyline points={commPts} fill="none" stroke={colors.gold} strokeWidth={2} />
      {/* Dots */}
      {CURTIDAS_DATA.map((v, i) => (
        <Circle key={i} cx={xPos(i)} cy={yPos(v)} r={3} fill="#ef4444" />
      ))}
      {COMENTARIOS_DATA.map((v, i) => (
        <Circle key={i} cx={xPos(i)} cy={yPos(v)} r={3} fill={colors.gold} />
      ))}
    </Svg>
  );
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const kpis = [
    { icon: "eye",            label: "ALCANCE ESTIMADO", value: 9,  iconColor: colors.mutedForeground },
    { icon: "trending-up",    label: "IMPRESSÕES",        value: 14, iconColor: colors.gold },
    { icon: "heart",          label: "CURTIDAS TOTAIS",   value: 0,  iconColor: "#ef4444" },
    { icon: "message-circle", label: "COMENTÁRIOS",       value: 0,  iconColor: colors.mutedForeground },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Analytics</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
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
              0.0 <Text style={[styles.engSub, { color: colors.mutedForeground }]}>interações/post</Text>
            </Text>
          </View>
          <View style={[styles.engIcon, { backgroundColor: colors.gold + "18" }]}>
            <Feather name="bar-chart-2" size={22} color={colors.gold} />
          </View>
        </View>

        {/* Engagement chart */}
        <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.navy }]}>Engajamento (14 dias)</Text>
          <View style={{ alignItems: "flex-start", marginTop: 8 }}>
            <EngagementChart />
          </View>
          {/* Legend */}
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
        </View>

        {/* Top posts */}
        <View style={[styles.topCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.navy }]}>Posts com Mais Engajamento</Text>
          {TOP_POSTS.map((post) => (
            <View key={post.rank} style={[styles.topRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.topRank, { color: colors.mutedForeground }]}>{post.rank}</Text>
              <Text style={[styles.topTitle, { color: colors.foreground }]} numberOfLines={1}>{post.title}</Text>
              <View style={styles.topStats}>
                <Feather name="heart" size={13} color={colors.mutedForeground} />
                <Text style={[styles.topStatNum, { color: colors.mutedForeground }]}>{post.likes}</Text>
                <Feather name="message-circle" size={13} color={colors.mutedForeground} />
                <Text style={[styles.topStatNum, { color: colors.mutedForeground }]}>{post.comments}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
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
});
