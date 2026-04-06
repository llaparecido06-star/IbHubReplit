import { useRouter } from "expo-router";
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
import { useColors } from "@/hooks/useColors";

type OporTab = "market" | "vagas" | "eventos";

export interface MarketItem {
  id: string; title: string; seller: string; price: string;
  category: string; expiry?: string; expired?: boolean;
}
export interface Job {
  id: string; title: string; company: string; location: string;
  contract: string; category: string; expiresIn?: string; expired?: boolean;
}
export interface Evento {
  id: string; title: string; date: string; time: string;
  capacity: string; location: string;
}

const MOCK_MARKET: MarketItem[] = [
  { id: "m1", title: "Adega Climatizada Brastemp 33 Garrafas", seller: "Lucas Lima", price: "R$ 1.200,00", category: "Equipamentos", expiry: "08/05/2026" },
  { id: "m2", title: "Lote de Vinhos Bordeaux 2015",           seller: "Lucas Lima", price: "R$ 8.500,00", category: "Vinho",        expired: true },
];

const MOCK_VAGAS: Job[] = [
  { id: "v1", title: "Sommelier Sênior",               company: "Vino & Co.",         location: "São Paulo, SP",     contract: "CLT", category: "Restaurante", expiresIn: "2 dias" },
  { id: "v2", title: "Representante Comercial de Vinhos", company: "Importadora Grand Cru", location: "Rio de Janeiro, RJ", contract: "PJ",  category: "Vendas",      expired: true },
];

const MOCK_EVENTOS: Evento[] = [
  { id: "e1", title: "Degustação de Vinhos do Vale do São Francisco", date: "16 de mar.", time: "01:27", capacity: "0/30", location: "Enoteca Brasileira, Rua Augusta 1200, São Paulo - SP" },
  { id: "e2", title: "Masterclass Online: Vinhos de Borgonha",        date: "23 de mar.", time: "01:27", capacity: "0/50", location: "Online" },
];

export default function OportunidadesScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [tab, setTab]       = useState<OporTab>("market");
  const [search, setSearch] = useState("");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const TABS: { key: OporTab; label: string; icon: any }[] = [
    { key: "market",  label: "Market",  icon: "shopping-bag" },
    { key: "vagas",   label: "Vagas",   icon: "briefcase" },
    { key: "eventos", label: "Eventos", icon: "calendar" },
  ];

  const handleCreate = () => {
    if (tab === "eventos") router.push("/new-event" as any);
    else router.push("/new-opportunity" as any);
  };

  const filteredMarket = MOCK_MARKET.filter((i) =>
    search ? i.title.toLowerCase().includes(search.toLowerCase()) : true
  );
  const filteredVagas = MOCK_VAGAS.filter((i) =>
    search ? i.title.toLowerCase().includes(search.toLowerCase()) : true
  );
  const filteredEventos = MOCK_EVENTOS.filter((i) =>
    search ? i.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Oportunidades</Text>
        <TouchableOpacity style={[styles.criarBtn, { backgroundColor: colors.gold }]} onPress={handleCreate}>
          <Feather name="plus" size={15} color="#fff" />
          <Text style={styles.criarBtnText}>{tab === "eventos" ? "Evento" : "Criar"}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: "#fff" }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
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
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && { backgroundColor: colors.gold }]}
            onPress={() => setTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={tab === t.key ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.tabBtnText, { color: tab === t.key ? "#fff" : colors.mutedForeground }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Market ── */}
        {tab === "market" && filteredMarket.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}
            onPress={() => router.push(`/market-item/${item.id}` as any)}
            activeOpacity={0.75}
          >
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardTitle, { color: colors.navy, flex: 1 }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.seller}</Text>
            <View style={styles.cardMeta}>
              <Text style={[styles.cardPrice, { color: colors.gold }]}>{item.price}</Text>
              <View style={[styles.chip, { backgroundColor: colors.background }]}>
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.category}</Text>
              </View>
            </View>
            {item.expired ? (
              <View style={styles.expiredRow}>
                <Feather name="alert-circle" size={13} color="#dc2626" />
                <Text style={[styles.expiredText, { color: "#dc2626" }]}>Expirado</Text>
              </View>
            ) : item.expiry ? (
              <View style={styles.expiryRow}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>Expira em: {item.expiry}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}

        {/* ── Vagas ── */}
        {tab === "vagas" && filteredVagas.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}
            onPress={() => router.push(`/job/${item.id}` as any)}
            activeOpacity={0.75}
          >
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardTitle, { color: colors.navy, flex: 1 }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <View style={styles.jobMeta}>
              <Feather name="briefcase" size={13} color={colors.mutedForeground} />
              <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.company}</Text>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
              <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.location}</Text>
            </View>
            <View style={styles.cardMeta}>
              <View style={[styles.chip, { backgroundColor: colors.background }]}>
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.contract}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: colors.background }]}>
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.category}</Text>
              </View>
            </View>
            {item.expired ? (
              <View style={styles.expiredRow}>
                <Feather name="alert-circle" size={13} color="#dc2626" />
                <Text style={[styles.expiredText, { color: "#dc2626" }]}>Expirado</Text>
              </View>
            ) : item.expiresIn ? (
              <View style={styles.expiryRow}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>Expira em {item.expiresIn}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}

        {/* ── Eventos ── */}
        {tab === "eventos" && filteredEventos.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}
            onPress={() => router.push(`/event/${item.id}` as any)}
            activeOpacity={0.75}
          >
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardTitle, { color: colors.navy, flex: 1 }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <View style={styles.eventoMeta}>
              <View style={styles.eventoMetaItem}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>{item.date}</Text>
              </View>
              <View style={styles.eventoMetaItem}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>{item.time}</Text>
              </View>
              <View style={styles.eventoMetaItem}>
                <Feather name="users" size={13} color={colors.mutedForeground} />
                <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>{item.capacity}</Text>
              </View>
            </View>
            <View style={styles.eventoMetaItem}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {((tab === "market" && filteredMarket.length === 0) ||
          (tab === "vagas" && filteredVagas.length === 0) ||
          (tab === "eventos" && filteredEventos.length === 0)) && (
          <View style={styles.empty}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum resultado encontrado.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: "800" },
  criarBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  criarBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  searchWrap: { padding: 12 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  tabRow: { flexDirection: "row", gap: 8, padding: 12, borderBottomWidth: 1 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tabBtnText: { fontSize: 13, fontWeight: "600" },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  cardSeller: { fontSize: 13 },
  cardMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  cardPrice: { fontSize: 18, fontWeight: "800" },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 12 },
  jobMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  expiryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  expiryText: { fontSize: 12 },
  expiredRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  expiredText: { fontSize: 12, fontWeight: "600" },
  eventoMeta: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  eventoMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  eventoMetaText: { fontSize: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
