import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";

const KPIS = [
  { emoji: "🎬", icon: "film"  as const, iconColor: "#c9a84c", iconBg: "#fef9ee", label: "Stories\nativos",        value: 0 },
  { emoji: "👁",  icon: "eye"   as const, iconColor: "#3b82f6", iconBg: "#dbeafe", label: "Visualizações\ntotais", value: 0 },
  { emoji: "🔥", icon: "zap"   as const, iconColor: "#ef4444", iconBg: "#fee2e2", label: "Reações\ntotais",        value: 0 },
];

const TABS = ["Ativos", "Todos"];

export default function AdminMomentosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [tab, setTab]               = useState("Ativos");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Momentos</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ gap: 4 }}>
          <View style={styles.heroRow}>
            <Feather name="film" size={20} color={colors.gold} />
            <Text style={[styles.heroTitle, { color: colors.navy }]}>Gestão de Momentos{"\n"}(Stories)</Text>
          </View>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Visualize, modere e analise os stories publicados
          </Text>
        </View>

        {/* KPI 3-col */}
        <View style={styles.kpiRow}>
          {KPIS.map((k) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.iconBg }]}>
                <Feather name={k.icon} size={18} color={k.iconColor} />
              </View>
              <Text style={[styles.kpiValue, { color: colors.navy }]}>{k.value}</Text>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Search + tabs */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Buscar por autor..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={[styles.tabs, { backgroundColor: colors.border + "55" }]}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, t === tab && { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, { color: t === tab ? colors.navy : colors.mutedForeground, fontWeight: t === tab ? "700" : "400" }]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Empty state */}
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: "#f3f4f6" }]}>
            <Feather name="film" size={36} color="#9ca3af" />
          </View>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum momento encontrado</Text>
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/momentos" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  heroRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  heroTitle:   { fontSize: 22, fontWeight: "800" },
  heroSub:     { fontSize: 13 },
  kpiRow:      { flexDirection: "row", gap: 8 },
  kpiCard:     { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4, alignItems: "center" },
  kpiIcon:     { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  kpiValue:    { fontSize: 22, fontWeight: "800" },
  kpiLabel:    { fontSize: 10, textAlign: "center", lineHeight: 14 },
  searchRow:   { flexDirection: "row", gap: 8, alignItems: "center" },
  searchBox:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  tabs:        { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  tab:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  tabText:     { fontSize: 13 },
  empty:       { alignItems: "center", paddingVertical: 60, gap: 14 },
  emptyIcon:   { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyText:   { fontSize: 14 },
});
