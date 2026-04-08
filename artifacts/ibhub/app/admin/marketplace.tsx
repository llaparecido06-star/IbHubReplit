import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Feather } from "@expo/vector-icons";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import {
  fetchOpportunities,
  toggleOpportunity,
  fetchInactiveOpportunities,
  fetchApplicationsCount,
} from "@/services/api";
import type { AppOpportunity } from "@/services/api";

const FILTERS = ["Todos os tipos", "Vagas", "Compra/Venda", "Serviços"];

function typeLabel(type: AppOpportunity["type"]): string {
  return type === "vaga" ? "Vaga" : "Compra/Venda";
}

export default function AdminMarketplaceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [search, setSearch]               = useState("");
  const [filter, setFilter]               = useState(FILTERS[0]);
  const [filterOpen, setFilterOpen]       = useState(false);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [opportunities, setOpportunities] = useState<AppOpportunity[]>([]);
  const [applicationsCount, setApplicationsCount] = useState(0);
  const [togglingId, setTogglingId]       = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async () => {
    const [vagas, marketplace, inactive, apps] = await Promise.all([
      fetchOpportunities("vaga", "", ""),
      fetchOpportunities("marketplace", "", ""),
      fetchInactiveOpportunities(),
      fetchApplicationsCount(),
    ]);
    const activeIds = new Set([...vagas, ...marketplace].map((o) => o.id));
    const uniqueInactive = inactive.filter((o) => !activeIds.has(o.id));
    const all = [...vagas, ...marketplace, ...uniqueInactive].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setOpportunities(all);
    setApplicationsCount(apps);
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

  const handleToggle = (op: AppOpportunity) => {
    const nextActive = !op.is_active;
    Alert.alert(
      nextActive ? "Ativar anúncio" : "Desativar anúncio",
      `Deseja ${nextActive ? "ativar" : "desativar"} o anúncio "${op.title}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: nextActive ? "Ativar" : "Desativar",
          onPress: async () => {
            setTogglingId(op.id);
            const ok = await toggleOpportunity(op.id, nextActive);
            if (ok) {
              setOpportunities((prev) =>
                prev.map((o) => (o.id === op.id ? { ...o, is_active: nextActive } : o)),
              );
            } else {
              Alert.alert("Erro", "Não foi possível alterar o status. Tente novamente.");
            }
            setTogglingId(null);
          },
        },
      ],
    );
  };

  const isServiceItem = (op: AppOpportunity) => {
    const cat = (op.category ?? "").toLowerCase();
    return cat.includes("servi");
  };

  const filtered = opportunities
    .filter((op) => {
      if (filter === "Vagas") return op.type === "vaga";
      if (filter === "Compra/Venda") return op.type === "marketplace";
      if (filter === "Serviços") return isServiceItem(op);
      return true;
    })
    .filter((op) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        op.title.toLowerCase().includes(q) ||
        (op.location ?? "").toLowerCase().includes(q) ||
        (op.company ?? "").toLowerCase().includes(q)
      );
    });

  const vagasCount       = opportunities.filter((o) => o.type === "vaga").length;
  const marketplaceCount = opportunities.filter((o) => o.type === "marketplace").length;

  const KPIS = [
    { icon: "shopping-bag" as const, iconColor: "#c9a84c", iconBg: "#fef9ee", label: "Total\nAnúncios", value: opportunities.length },
    { icon: "briefcase"    as const, iconColor: "#3b82f6", iconBg: "#dbeafe", label: "Vagas",            value: vagasCount },
    { icon: "tag"          as const, iconColor: "#9333ea", iconBg: "#f3e8ff", label: "Compra/Venda",     value: marketplaceCount },
    { icon: "trending-up"  as const, iconColor: "#059669", iconBg: "#d1fae5", label: "Candidaturas",     value: applicationsCount },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Marketplace</Text>
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
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Marketplace &{"\n"}Oportunidades</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Gerencie ofertas, vagas e anúncios da plataforma
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

        {/* Search + filter */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Buscar oportunidade..."
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
                    style={[
                      styles.dropItem,
                      { borderBottomColor: colors.border },
                      f === filter && { backgroundColor: colors.gold + "12" },
                    ]}
                    onPress={() => { setFilter(f); setFilterOpen(false); }}
                  >
                    <Text style={[styles.dropText, { color: f === filter ? colors.gold : colors.foreground }]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
              <Feather name="shopping-bag" size={36} color="#9ca3af" />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma oportunidade encontrada</Text>
          </View>
        ) : (
          <View style={[styles.table, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableHeadText, { color: colors.mutedForeground }]}>OPORTUNIDADE</Text>
            </View>
            {filtered.map((item, i) => {
              const isVaga    = item.type === "vaga";
              const iconName  = isVaga ? "briefcase" : "tag" as const;
              const iconColor = isVaga ? "#3b82f6" : "#9333ea";
              const iconBg    = isVaga ? "#dbeafe"  : "#f3e8ff";
              return (
                <View
                  key={item.id}
                  style={[
                    styles.tableRow,
                    i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.typeIcon, { backgroundColor: iconBg }]}>
                    <Feather name={iconName} size={16} color={iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemTitleRow}>
                      <Text style={[styles.itemTitle, { color: colors.navy }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={[styles.typeBadge, { backgroundColor: iconBg }]}>
                        <Text style={[styles.typeBadgeText, { color: iconColor }]}>
                          {typeLabel(item.type)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.itemLocRow}>
                      {item.location ? (
                        <>
                          <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                          <Text style={[styles.itemLoc, { color: colors.mutedForeground }]}>
                            {item.location}
                          </Text>
                        </>
                      ) : null}
                      {item.price ? (
                        <Text style={[styles.itemPrice, { color: colors.gold }]}>
                          {item.location ? "· " : ""}{item.price}
                        </Text>
                      ) : item.salary ? (
                        <Text style={[styles.itemPrice, { color: colors.gold }]}>
                          {item.location ? "· " : ""}{item.salary}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: item.is_active ? "#d1fae5" : "#fee2e2",
                        borderColor: item.is_active ? "#a7f3d0" : "#fecaca",
                      },
                    ]}
                    onPress={() => handleToggle(item)}
                    disabled={togglingId === item.id}
                  >
                    {togglingId === item.id ? (
                      <ActivityIndicator size="small" color={item.is_active ? "#059669" : "#ef4444"} />
                    ) : (
                      <Feather
                        name={item.is_active ? "eye" : "eye-off"}
                        size={15}
                        color={item.is_active ? "#059669" : "#ef4444"}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/marketplace" />
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
  searchRow:      { flexDirection: "row", gap: 8 },
  searchBox:      { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput:    { flex: 1, fontSize: 14 },
  filterBtn:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  filterText:     { fontSize: 13 },
  dropdown:       { position: "absolute", top: 48, right: 0, width: 160, borderRadius: 10, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  dropItem:       { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  dropText:       { fontSize: 13 },
  empty:          { alignItems: "center", paddingVertical: 60, gap: 14 },
  emptyIcon:      { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyText:      { fontSize: 14 },
  table:          { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableHead:      { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tableHeadText:  { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  tableRow:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  typeIcon:       { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemTitleRow:   { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  itemTitle:      { fontSize: 14, fontWeight: "600", flex: 1 },
  typeBadge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText:  { fontSize: 11, fontWeight: "600" },
  itemLocRow:     { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, flexWrap: "wrap" },
  itemLoc:        { fontSize: 12 },
  itemPrice:      { fontSize: 12, fontWeight: "600" },
  toggleBtn:      { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
