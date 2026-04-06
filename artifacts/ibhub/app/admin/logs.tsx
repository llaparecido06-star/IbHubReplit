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
  { icon: "user-plus"  as const, iconColor: "#059669", iconBg: "#d1fae5", label: "Cadastro",  value: 1 },
  { icon: "heart"      as const, iconColor: "#e11d48", iconBg: "#ffe4e6", label: "Curtida",   value: 1 },
  { icon: "users"      as const, iconColor: "#7c3aed", iconBg: "#ede9fe", label: "Conexão",   value: 1 },
  { icon: "user-check" as const, iconColor: "#059669", iconBg: "#d1fae5", label: "Seguiu",    value: 1 },
];

const FILTERS = ["Todas atividades", "Cadastro", "Curtida", "Conexão", "Seguiu"];

interface LogEntry {
  initial: string;
  text: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  time: string;
}

const LOGS: LogEntry[] = [
  { initial: "T", text: "Teste IbHub se cadastrou na plataforma",  icon: "user-plus",  iconColor: "#059669", time: "3h"  },
  { initial: "M", text: "Maria Santos curtiu um post",             icon: "heart",       iconColor: "#e11d48", time: "6d"  },
  { initial: "M", text: "Maria Santos enviou pedido de conexão",   icon: "user-plus",  iconColor: "#059669", time: "6d"  },
  { initial: "M", text: "Maria Santos seguiu alguém",              icon: "user",        iconColor: "#6b7280", time: "6d"  },
];

export default function AdminLogsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState(FILTERS[0]);
  const [filterOpen, setFilterOpen] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Logs de Atividade</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.heroTitle, { color: colors.navy }]}>Logs de Atividade</Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              Atividades dos últimos 7 dias{"\n"}em tempo real
            </Text>
          </View>
          <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Feather name="refresh-cw" size={14} color={colors.navy} />
            <Text style={[styles.refreshText, { color: colors.navy }]}>Atualizar</Text>
          </TouchableOpacity>
        </View>

        {/* KPI 2x2 */}
        <View style={styles.kpiGrid}>
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

        {/* Search + filter */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Buscar por"
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View>
            <TouchableOpacity
              style={[styles.filterBtn, { backgroundColor: "#fff", borderColor: colors.border }]}
              onPress={() => setFilterOpen(!filterOpen)}
            >
              <Text style={[styles.filterText, { color: colors.foreground }]}>{filter}</Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            {filterOpen && (
              <View style={[styles.dropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.dropItem, { borderBottomColor: colors.border }, f === filter && { backgroundColor: colors.gold + "12" }]}
                    onPress={() => { setFilter(f); setFilterOpen(false); }}
                  >
                    <Text style={[styles.dropText, { color: f === filter ? colors.gold : colors.foreground }]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Log list */}
        <View style={[styles.logList, { backgroundColor: "#fff", borderColor: colors.border }]}>
          {LOGS.map((log, i) => (
            <View
              key={i}
              style={[styles.logRow, i < LOGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={[styles.logAvatar, { backgroundColor: colors.navy }]}>
                <Text style={[styles.logAvatarText, { color: colors.gold }]}>{log.initial}</Text>
              </View>
              <Text style={[styles.logText, { color: colors.foreground }]} numberOfLines={2}>{log.text}</Text>
              <View style={styles.logMeta}>
                <Feather name={log.icon} size={13} color={log.iconColor} />
                <Text style={[styles.logTime, { color: colors.mutedForeground }]}>{log.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/logs" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 18, fontWeight: "700" },
  heroRow:      { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroTitle:    { fontSize: 22, fontWeight: "800" },
  heroSub:      { fontSize: 13, lineHeight: 18 },
  refreshBtn:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  refreshText:  { fontSize: 13, fontWeight: "600" },
  kpiGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard:      { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  kpiIcon:      { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  kpiValue:     { fontSize: 26, fontWeight: "800" },
  kpiLabel:     { fontSize: 12 },
  searchRow:    { flexDirection: "row", gap: 8 },
  searchBox:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput:  { flex: 1, fontSize: 14 },
  filterBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  filterText:   { fontSize: 13 },
  dropdown:     { position: "absolute", top: 48, right: 0, width: 160, borderRadius: 10, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  dropItem:     { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  dropText:     { fontSize: 13 },
  logList:      { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  logRow:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  logAvatar:    { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  logAvatarText:{ fontSize: 13, fontWeight: "700" },
  logText:      { flex: 1, fontSize: 13, lineHeight: 18 },
  logMeta:      { alignItems: "center", gap: 4 },
  logTime:      { fontSize: 11 },
});
