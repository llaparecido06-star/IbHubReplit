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
  { icon: "calendar"   as const, iconColor: "#c9a84c", iconBg: "#fef9ee", label: "Total de\nEventos",    value: 2 },
  { icon: "clock"      as const, iconColor: "#3b82f6", iconBg: "#dbeafe", label: "Próximos",             value: 0 },
  { icon: "users"      as const, iconColor: "#059669", iconBg: "#d1fae5", label: "Confirmações",         value: 0 },
  { icon: "trash-2"    as const, iconColor: "#ef4444", iconBg: "#fee2e2", label: "Cancelados",           value: 0 },
];

const TABS = ["Todos", "Próximos", "Passados"];

interface EventItem {
  title: string;
  location: string;
}
const EVENTS: EventItem[] = [
  { title: "Masterclass Online: Vinhos de Borgonha",                  location: "Online" },
  { title: "Degustação de Vinhos do Vale do São Francisco",           location: "Enoteca Brasileira, Rua Augusta 1200, São Paulo" },
];

export default function AdminEventosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [tab, setTab]               = useState("Todos");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Eventos</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ gap: 4 }}>
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Gestão de Eventos</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Visualize, modere e gerencie todos os eventos da plataforma
          </Text>
        </View>

        {/* KPI 2x2 */}
        <View style={styles.kpiGrid}>
          {KPIS.map((k) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.iconBg }]}>
                <Feather name={k.icon} size={20} color={k.iconColor} />
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
              placeholder="Buscar ev..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={styles.tabsRow}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, t === tab && { backgroundColor: colors.navy }]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, { color: t === tab ? "#fff" : colors.foreground }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Table */}
        <View style={[styles.table, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
            <Text style={[styles.tableHeadText, { color: colors.mutedForeground }]}>EVENTO</Text>
          </View>
          {EVENTS.map((ev, i) => (
            <View
              key={i}
              style={[styles.tableRow, i < EVENTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={[styles.evIcon, { backgroundColor: colors.gold + "18" }]}>
                <Feather name="calendar" size={16} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.evTitle, { color: colors.navy }]} numberOfLines={1}>{ev.title}</Text>
                <View style={styles.evLocRow}>
                  <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.evLoc, { color: colors.mutedForeground }]} numberOfLines={1}>{ev.location}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/eventos" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:   { fontSize: 18, fontWeight: "700" },
  heroTitle:     { fontSize: 22, fontWeight: "800" },
  heroSub:       { fontSize: 13, lineHeight: 18 },
  kpiGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard:       { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  kpiIcon:       { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  kpiValue:      { fontSize: 26, fontWeight: "800" },
  kpiLabel:      { fontSize: 11, lineHeight: 15 },
  searchRow:     { gap: 8 },
  searchBox:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput:   { flex: 1, fontSize: 14 },
  tabsRow:       { flexDirection: "row", gap: 6 },
  tabBtn:        { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: "#f3f4f6" },
  tabText:       { fontSize: 13, fontWeight: "600" },
  table:         { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableHead:     { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tableHeadText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  tableRow:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  evIcon:        { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  evTitle:       { fontSize: 14, fontWeight: "600" },
  evLocRow:      { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  evLoc:         { fontSize: 12, flex: 1 },
});
