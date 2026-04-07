import { useRouter } from "expo-router";
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
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { AppEvent, AppOpportunity, fetchEvents, fetchOpportunities } from "@/services/api";

type OporTab = "market" | "vagas" | "eventos";

export default function OportunidadesScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { profile, user } = useAuth();

  const [tab, setTab]       = useState<OporTab>("market");
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState<AppOpportunity[]>([]);
  const [vagas, setVagas]   = useState<AppOpportunity[]>([]);
  const [eventos, setEventos] = useState<AppEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isEmpresa = profile?.profile_type === "empresa";

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const TABS: { key: OporTab; label: string; icon: any }[] = [
    { key: "market",  label: "Market",  icon: "shopping-bag" },
    { key: "vagas",   label: "Vagas",   icon: "briefcase" },
    { key: "eventos", label: "Eventos", icon: "calendar" },
  ];

  const loadData = useCallback(async () => {
    const [m, v, ev] = await Promise.all([
      fetchOpportunities("marketplace", "", user?.id ?? ""),
      fetchOpportunities("vaga",        "", user?.id ?? ""),
      fetchEvents(),
    ]);
    setMarket(m);
    setVagas(v);
    setEventos(ev);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleCreate = () => {
    if (tab === "eventos") {
      router.push("/new-event" as any);
      return;
    }
    if (!isEmpresa) {
      Alert.alert(
        "Apenas empresas podem publicar",
        "Somente contas do tipo Empresa podem anunciar vagas e produtos. Candidatar-se, enviar mensagens e participar de eventos é aberto a todos.",
        [{ text: "Entendi", style: "default" }],
      );
      return;
    }
    router.push("/new-opportunity" as any);
  };

  const filteredMarket  = market.filter((i)  => !search || i.title.toLowerCase().includes(search.toLowerCase()));
  const filteredVagas   = vagas.filter((i)   => !search || i.title.toLowerCase().includes(search.toLowerCase()));
  const filteredEventos = eventos.filter((i) => !search || i.title.toLowerCase().includes(search.toLowerCase()));

  const showCriarBtn = tab === "eventos" || isEmpresa;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Oportunidades</Text>
        {showCriarBtn ? (
          <TouchableOpacity style={[styles.criarBtn, { backgroundColor: colors.gold }]} onPress={handleCreate}>
            <Feather name="plus" size={15} color="#fff" />
            <Text style={styles.criarBtnText}>{tab === "eventos" ? "Evento" : "Publicar"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.criarBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleCreate}
          >
            <Feather name="lock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.criarBtnText, { color: colors.mutedForeground }]}>Empresas</Text>
          </TouchableOpacity>
        )}
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
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : null}

        {/* ── Market ── */}
        {tab === "market" && !loading && filteredMarket.map((item) => {
          const sellerName = item.company ?? item.creator?.full_name ?? null;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}
              onPress={() => router.push(`/opportunity/${item.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={styles.cardTopRow}>
                <Text style={[styles.cardTitle, { color: colors.navy, flex: 1 }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </View>
              {sellerName ? (
                <View style={styles.jobMeta}>
                  <Feather name="user" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{sellerName}</Text>
                </View>
              ) : null}
              <View style={styles.cardMeta}>
                {item.price ? (
                  <Text style={[styles.cardPrice, { color: colors.gold }]}>{item.price}</Text>
                ) : null}
                {item.category ? (
                  <View style={[styles.chip, { backgroundColor: colors.background }]}>
                    <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.category}</Text>
                  </View>
                ) : null}
              </View>
              {item.location ? (
                <View style={styles.jobMeta}>
                  <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.location}</Text>
                </View>
              ) : null}
              {item.expires_at ? (
                <View style={styles.expiryRow}>
                  <Feather name="clock" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>
                    Expira: {new Date(item.expires_at).toLocaleDateString("pt-BR")}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {/* ── Vagas ── */}
        {tab === "vagas" && !loading && filteredVagas.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { backgroundColor: "#fff", borderColor: item.is_applied ? colors.gold : colors.border }]}
            onPress={() => router.push(`/opportunity/${item.id}` as any)}
            activeOpacity={0.75}
          >
            <View style={styles.cardTopRow}>
              <Text style={[styles.cardTitle, { color: colors.navy, flex: 1 }]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.is_applied ? (
                <View style={[styles.appliedTag, { backgroundColor: colors.gold + "18" }]}>
                  <Feather name="check-circle" size={12} color={colors.gold} />
                  <Text style={[styles.appliedTagText, { color: colors.gold }]}>Candidatado</Text>
                </View>
              ) : (
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              )}
            </View>
            <View style={styles.jobMeta}>
              {item.company ? (
                <>
                  <Feather name="briefcase" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.company}</Text>
                </>
              ) : null}
              {item.location ? (
                <>
                  <Feather name="map-pin" size={13} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                  <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.location}</Text>
                </>
              ) : null}
            </View>
            {item.salary ? (
              <Text style={[styles.salaryText, { color: colors.gold }]}>{item.salary}</Text>
            ) : null}
            <View style={styles.cardMeta}>
              {item.contract_type ? (
                <View style={[styles.chip, { backgroundColor: colors.background }]}>
                  <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.contract_type}</Text>
                </View>
              ) : null}
              {item.category ? (
                <View style={[styles.chip, { backgroundColor: colors.background }]}>
                  <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.category}</Text>
                </View>
              ) : null}
            </View>
            {item.expires_at ? (
              <View style={styles.expiryRow}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>
                  Expira: {new Date(item.expires_at).toLocaleDateString("pt-BR")}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}

        {/* ── Eventos ── */}
        {tab === "eventos" && !loading && filteredEventos.map((item) => {
          const dateStr = new Date(item.start_date).toLocaleDateString("pt-BR", {
            day: "2-digit", month: "short", year: "numeric",
          });
          const timeStr = new Date(item.start_date).toLocaleTimeString("pt-BR", {
            hour: "2-digit", minute: "2-digit",
          });
          const locationStr = item.location_type === "online" ? "🌐 Online" : (item.location ?? "");
          return (
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
                  <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>{dateStr}</Text>
                </View>
                <View style={styles.eventoMetaItem}>
                  <Feather name="clock" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>{timeStr}</Text>
                </View>
                {item.capacity != null && (
                  <View style={styles.eventoMetaItem}>
                    <Feather name="users" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>{item.capacity} vagas</Text>
                  </View>
                )}
              </View>
              {locationStr ? (
                <View style={styles.eventoMetaItem}>
                  <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {locationStr}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.entryBadge, { backgroundColor: item.entry_type === "gratuito" ? "#dcfce7" : "#fef9c3" }]}>
                <Text style={[styles.entryBadgeText, { color: item.entry_type === "gratuito" ? "#16a34a" : "#a16207" }]}>
                  {item.entry_type === "gratuito" ? "Gratuito" : "Pago"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Empty states */}
        {!loading && tab === "market" && filteredMarket.length === 0 && (
          <View style={styles.empty}>
            <Feather name="shopping-bag" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum anúncio encontrado.</Text>
            {!isEmpresa ? (
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Apenas empresas podem publicar anúncios.
              </Text>
            ) : null}
          </View>
        )}
        {!loading && tab === "vagas" && filteredVagas.length === 0 && (
          <View style={styles.empty}>
            <Feather name="briefcase" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma vaga encontrada.</Text>
            {!isEmpresa ? (
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Apenas empresas podem publicar vagas.
              </Text>
            ) : null}
          </View>
        )}
        {!loading && tab === "eventos" && filteredEventos.length === 0 && (
          <View style={styles.empty}>
            <Feather name="calendar" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum evento encontrado.</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Crie o primeiro evento da comunidade!
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: "800" },
  criarBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  criarBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
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
  eventoMeta: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  eventoMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  eventoMetaText: { fontSize: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 15 },
  emptyHint: { fontSize: 13, textAlign: "center", maxWidth: 260 },
  entryBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  entryBadgeText: { fontSize: 11, fontWeight: "600" },
  appliedTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  appliedTagText: { fontSize: 11, fontWeight: "700" },
  salaryText: { fontSize: 13, fontWeight: "700" },
});
