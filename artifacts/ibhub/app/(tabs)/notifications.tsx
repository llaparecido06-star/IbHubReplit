import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type OporTab = "market" | "vagas" | "eventos";

const MOCK_MARKET = [
  { id: "m1", title: "Lote Exclusivo — Petrus 2015", seller: "Vinicard Leilões", price: "R$ 4.200", tag: "Bordeaux" },
  { id: "m2", title: "Caixa 6 garrafas — Sassicaia 2018", seller: "Importadora Alma", price: "R$ 3.800", tag: "Itália" },
  { id: "m3", title: "Penfolds Grange 2019", seller: "Wine & Co", price: "R$ 2.950", tag: "Austrália" },
];

const MOCK_VAGAS = [
  { id: "v1", title: "Sommelier Sênior", company: "Restaurant Fasano", location: "São Paulo, SP", type: "CLT" },
  { id: "v2", title: "Wine Educator", company: "SENAC", location: "Remoto", type: "PJ" },
  { id: "v3", title: "Buyer — Vinhos", company: "Pão de Açúcar", location: "São Paulo, SP", type: "CLT" },
];

const MOCK_EVENTOS = [
  { id: "e1", title: "Degustação Exclusiva Bordeaux", organizer: "Clube do Vinho SP", date: "Sex, 18 Abr", location: "São Paulo" },
  { id: "e2", title: "World Wine Day Brasil", organizer: "IBRAVIN", date: "Dom, 25 Mai", location: "Bento Gonçalves" },
  { id: "e3", title: "Curso WSET Level 2 Intensivo", organizer: "Wine & Spirit Education", date: "Seg, 5 Mai", location: "Online" },
];

export default function OportunidadesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<OporTab>("market");
  const [search, setSearch] = useState("");

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const tabOptions: { key: OporTab; label: string; icon: any }[] = [
    { key: "market",  label: "Market",   icon: "shopping-bag" },
    { key: "vagas",   label: "Vagas",    icon: "briefcase" },
    { key: "eventos", label: "Eventos",  icon: "calendar" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Oportunidades</Text>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: "#fff" }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {tabOptions.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && [styles.tabBtnActive, { backgroundColor: colors.gold }]]}
            onPress={() => setTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={tab === t.key ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.tabBtnText, { color: tab === t.key ? "#fff" : colors.mutedForeground }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Criar button */}
      <View style={[styles.criarWrap, { backgroundColor: "#fff" }]}>
        <TouchableOpacity style={[styles.criarBtn, { backgroundColor: colors.gold }]}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.criarBtnText}>Criar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad, gap: 10, padding: 16 }} showsVerticalScrollIndicator={false}>
        {tab === "market" && MOCK_MARKET.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={[styles.cardTag, { backgroundColor: colors.gold + "18" }]}>
              <Text style={[styles.cardTagText, { color: colors.gold }]}>{item.tag}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: colors.navy }]}>{item.title}</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.seller}</Text>
            <Text style={[styles.cardPrice, { color: colors.gold }]}>{item.price}</Text>
          </TouchableOpacity>
        ))}

        {tab === "vagas" && MOCK_VAGAS.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.navy }]}>{item.title}</Text>
              <View style={[styles.typePill, { backgroundColor: colors.background }]}>
                <Text style={[styles.typePillText, { color: colors.navy }]}>{item.type}</Text>
              </View>
            </View>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.company}</Text>
            <View style={styles.cardLocation}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.cardLocationText, { color: colors.mutedForeground }]}>{item.location}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {tab === "eventos" && MOCK_EVENTOS.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={[styles.dateChip, { backgroundColor: colors.gold }]}>
              <Text style={styles.dateChipText}>{item.date}</Text>
            </View>
            <Text style={[styles.cardTitle, { color: colors.navy }]}>{item.title}</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.organizer}</Text>
            <View style={styles.cardLocation}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.cardLocationText, { color: colors.mutedForeground }]}>{item.location}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {((tab === "market" && MOCK_MARKET.length === 0) ||
          (tab === "vagas" && MOCK_VAGAS.length === 0) ||
          (tab === "eventos" && MOCK_EVENTOS.length === 0)) && (
          <View style={styles.empty}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma oportunidade encontrada.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: "800" },
  searchWrap: { padding: 12 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  tabRow: {
    flexDirection: "row", gap: 8, padding: 12,
    borderBottomWidth: 1,
  },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  tabBtnActive: {},
  tabBtnText: { fontSize: 14, fontWeight: "600" },
  criarWrap: { padding: 12 },
  criarBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 10,
  },
  criarBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  card: {
    borderRadius: 12, borderWidth: 1, padding: 16, gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTag: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cardTagText: { fontSize: 12, fontWeight: "700" },
  cardTitle: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  cardSub: { fontSize: 14 },
  cardPrice: { fontSize: 18, fontWeight: "800" },
  cardLocation: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardLocationText: { fontSize: 13 },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typePillText: { fontSize: 12, fontWeight: "600" },
  dateChip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dateChipText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
