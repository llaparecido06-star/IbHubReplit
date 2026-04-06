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
  { icon: "shopping-bag" as const, iconColor: "#c9a84c", iconBg: "#fef9ee", label: "Total\nAnúncios",   value: 6 },
  { icon: "briefcase"    as const, iconColor: "#3b82f6", iconBg: "#dbeafe", label: "Vagas",              value: 2 },
  { icon: "tag"          as const, iconColor: "#9333ea", iconBg: "#f3e8ff", label: "Compra/Venda",       value: 2 },
  { icon: "trending-up"  as const, iconColor: "#059669", iconBg: "#d1fae5", label: "Candidaturas",       value: 0 },
];

const FILTERS = ["Todos os tipos", "Vagas", "Compra/Venda", "Serviços"];

interface ListingItem {
  title: string;
  location: string;
  price?: string;
}
const LISTINGS: ListingItem[] = [
  { title: "Sommelier Sênior",                          location: "São Paulo, SP" },
  { title: "Representante Comercial de Vinhos",         location: "Rio de Janeiro, RJ" },
  { title: "Adega Climatizada Brastemp 33 Garrafas",    location: "Curitiba, PR", price: "R$ 1.200,00" },
];

export default function AdminMarketplaceScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Marketplace</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
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

        {/* Table */}
        <View style={[styles.table, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
            <Text style={[styles.tableHeadText, { color: colors.mutedForeground }]}>OPORTUNIDADE</Text>
          </View>
          {LISTINGS.map((item, i) => (
            <View
              key={i}
              style={[styles.tableRow, i < LISTINGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.navy }]}>{item.title}</Text>
                <View style={styles.itemLocRow}>
                  <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.itemLoc, { color: colors.mutedForeground }]}>{item.location}</Text>
                  {item.price && (
                    <Text style={[styles.itemPrice, { color: colors.gold }]}>· {item.price}</Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/marketplace" />
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
  searchRow:     { flexDirection: "row", gap: 8 },
  searchBox:     { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput:   { flex: 1, fontSize: 14 },
  filterBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  filterText:    { fontSize: 13 },
  dropdown:      { position: "absolute", top: 48, right: 0, width: 160, borderRadius: 10, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  dropItem:      { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  dropText:      { fontSize: 13 },
  table:         { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableHead:     { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tableHeadText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  tableRow:      { padding: 14 },
  itemTitle:     { fontSize: 14, fontWeight: "600" },
  itemLocRow:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, flexWrap: "wrap" },
  itemLoc:       { fontSize: 12 },
  itemPrice:     { fontSize: 12, fontWeight: "600" },
});
