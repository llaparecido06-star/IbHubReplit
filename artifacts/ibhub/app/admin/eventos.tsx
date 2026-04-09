import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { fetchAllEventsAdmin, fetchConfirmedAttendanceCount } from "@/services/api";
import type { AppEvent } from "@/services/api";

const TABS = ["Todos", "Próximos", "Passados"];

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function AdminEventosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen]             = useState(false);
  const [search, setSearch]                     = useState("");
  const [tab, setTab]                           = useState("Todos");
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [allEvents, setAllEvents]               = useState<AppEvent[]>([]);
  const [totalAttendances, setTotalAttendances] = useState(0);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async () => {
    const [all, attendances] = await Promise.all([
      fetchAllEventsAdmin(),
      fetchConfirmedAttendanceCount(),
    ]);
    setAllEvents(all);
    setTotalAttendances(attendances);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const nowStr    = new Date().toISOString();
  const cancelled = allEvents.filter((e) => !e.is_active).length;
  const proximos  = allEvents.filter((e) => e.start_date >= nowStr);

  const filtered = allEvents
    .filter((ev) => {
      if (tab === "Próximos") return ev.start_date >= nowStr;
      if (tab === "Passados") return ev.start_date < nowStr;
      return true;
    })
    .filter((ev) => {
      if (!search.trim()) return true;
      return ev.title.toLowerCase().includes(search.toLowerCase());
    });

  const KPIS = [
    { icon: "calendar" as const, iconColor: "#c9a84c", iconBg: "#fef9ee", label: "Total de\nEventos", value: allEvents.length },
    { icon: "clock"    as const, iconColor: "#3b82f6", iconBg: "#dbeafe", label: "Próximos",           value: proximos.length },
    { icon: "users"    as const, iconColor: "#059669", iconBg: "#d1fae5", label: "Confirmações",       value: totalAttendances },
    { icon: "trash-2"  as const, iconColor: "#ef4444", iconBg: "#fee2e2", label: "Cancelados",         value: cancelled },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Eventos</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />
        }
      >
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
              <Text style={[styles.kpiValue, { color: colors.navy }]}>
                {loading ? "—" : k.value}
              </Text>
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
              placeholder="Buscar evento..."
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

        {/* Content */}
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="small" color={colors.gold} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: "#f3f4f6" }]}>
              <Feather name="calendar" size={36} color="#9ca3af" />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum evento encontrado</Text>
          </View>
        ) : (
          <View style={[styles.table, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableHeadText, { color: colors.mutedForeground }]}>EVENTO</Text>
            </View>
            {filtered.map((ev, i) => {
              const isPast = ev.start_date < nowStr;
              return (
                <View
                  key={ev.id}
                  style={[
                    styles.tableRow,
                    i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.evIcon, { backgroundColor: isPast ? "#f3f4f6" : colors.gold + "18" }]}>
                    <Feather name="calendar" size={16} color={isPast ? "#9ca3af" : colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.evTitle, { color: colors.navy }]} numberOfLines={1}>
                      {ev.title}
                    </Text>
                    <View style={styles.evRow}>
                      <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.evMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {ev.location ?? ev.location_type ?? "—"}
                      </Text>
                    </View>
                    <View style={styles.evRow}>
                      <Feather name="clock" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.evMeta, { color: colors.mutedForeground }]}>
                        {formatDate(ev.start_date)}
                        {ev.organizer?.full_name ? ` · ${ev.organizer.full_name}` : ""}
                      </Text>
                    </View>
                  </View>
                  {!ev.is_active && (
                    <View style={[styles.cancelledBadge, { backgroundColor: "#fee2e2" }]}>
                      <Text style={styles.cancelledText}>Cancelado</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/eventos" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:    { fontSize: 18, fontWeight: "700" },
  heroTitle:      { fontSize: 22, fontWeight: "800" },
  heroSub:        { fontSize: 13, lineHeight: 18 },
  kpiGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard:        { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  kpiIcon:        { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  kpiValue:       { fontSize: 26, fontWeight: "800" },
  kpiLabel:       { fontSize: 11, lineHeight: 15 },
  searchRow:      { gap: 8 },
  searchBox:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput:    { flex: 1, fontSize: 14 },
  tabsRow:        { flexDirection: "row", gap: 6 },
  tabBtn:         { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: "#f3f4f6" },
  tabText:        { fontSize: 13, fontWeight: "600" },
  empty:          { alignItems: "center", paddingVertical: 60, gap: 14 },
  emptyIcon:      { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyText:      { fontSize: 14 },
  table:          { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableHead:      { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tableHeadText:  { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  tableRow:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  evIcon:         { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  evTitle:        { fontSize: 14, fontWeight: "600" },
  evRow:          { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  evMeta:         { fontSize: 12, flex: 1 },
  cancelledBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cancelledText:  { fontSize: 11, fontWeight: "600", color: "#ef4444" },
});
