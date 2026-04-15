import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { AppOpportunity, fetchOpportunitiesPage } from "@/services/api";

type SubTab = "vagas" | "marketplace";

const VAGA_CATS   = ["Todos", "Sommelier", "Enólogo", "Gerência", "Marketing", "Vendas", "Exportação", "Produção", "Outros"];
const MARKET_CATS = ["Todos", "Vinho", "Insumo", "Equipamento", "Serviço", "Outros"];
const PAGE_SIZE   = 15;

const typeColor: Record<string, "default" | "gold" | "wine" | "success"> = {
  vaga: "gold", marketplace: "success",
};
const contractColor: Record<string, string> = {
  CLT: "#2ecc71", PJ: "#3498db", Freelancer: "#9b59b6", Estágio: "#e67e22",
};

export default function OpportunitiesScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [subTab, setSubTab]       = useState<SubTab>("vagas");
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [refreshing, setRefreshing] = useState(false);

  const searchRef = useRef<TextInput>(null);
  const listRef   = useRef<FlatList<AppOpportunity>>(null);

  const fetcher = useCallback(
    (offset: number, limit: number) =>
      user?.id
        ? fetchOpportunitiesPage(subTab === "vagas" ? "vaga" : "marketplace", search, user.id, offset, limit, catFilter)
        : Promise.resolve([]),
    [subTab, search, user?.id, catFilter],
  );

  const { items, loading, loadingMore, hasMore, loadMore, refresh } =
    usePaginatedQuery<AppOpportunity>(fetcher, PAGE_SIZE);

  useEffect(() => {
    setCatFilter("Todos");
  }, [subTab]);

  useEffect(() => {
    refresh().then(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [subTab, catFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      refresh().then(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const cats = subTab === "vagas" ? VAGA_CATS : MARKET_CATS;

  const renderItem = ({ item }: { item: AppOpportunity }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
      activeOpacity={0.85}
      onPress={() => router.push(`/opportunity/${item.id}` as any)}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTitles}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.type === "vaga" && item.company ? (
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.company}</Text>
          ) : item.creator?.full_name ? (
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>por {item.creator.full_name}</Text>
          ) : null}
        </View>
        <Badge label={item.category ?? item.type} variant={typeColor[item.type] ?? "default"} />
      </View>

      <View style={styles.metaRow}>
        {item.location ? (
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.location}</Text>
          </View>
        ) : null}
        {item.type === "vaga" && item.salary ? (
          <View style={styles.metaItem}>
            <Feather name="dollar-sign" size={12} color={colors.gold} />
            <Text style={[styles.metaText, { color: colors.gold, fontWeight: "700" }]}>{item.salary}</Text>
          </View>
        ) : null}
        {item.type === "marketplace" && item.price ? (
          <View style={styles.metaItem}>
            <Feather name="tag" size={12} color={colors.gold} />
            <Text style={[styles.metaText, { color: colors.gold, fontWeight: "700" }]}>{item.price}</Text>
          </View>
        ) : null}
        {item.contract_type ? (
          <View style={[styles.contractBadge, { backgroundColor: (contractColor[item.contract_type] ?? colors.navy) + "22" }]}>
            <Text style={[styles.contractText, { color: contractColor[item.contract_type] ?? colors.navy }]}>
              {item.contract_type}
            </Text>
          </View>
        ) : null}
      </View>

      {item.description ? (
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {new Date(item.created_at).toLocaleDateString("pt-BR")}
        </Text>
        <View style={[
          styles.actionBadge,
          { backgroundColor: item.is_applied ? colors.secondary : colors.gold + "22" },
        ]}>
          <Text style={[
            styles.actionText,
            { color: item.is_applied ? colors.mutedForeground : colors.gold },
          ]}>
            {item.type === "vaga"
              ? (item.is_applied ? "Candidatura enviada" : "Ver vaga →")
              : "Ver anúncio →"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Oportunidades</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.gold }]}
          onPress={() => router.push("/new-opportunity" as any)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.addText}>Publicar</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-tabs */}
      <View style={[styles.subTabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {(["vagas", "marketplace"] as SubTab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.subTab, subTab === t && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
            onPress={() => setSubTab(t)}
          >
            <Text style={[styles.subTabText, { color: subTab === t ? colors.gold : colors.mutedForeground, fontWeight: subTab === t ? "700" : "400" }]}>
              {t === "vagas" ? "Vagas" : "Marketplace"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          ref={searchRef}
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={subTab === "vagas" ? "Buscar vagas, empresa..." : "Buscar anúncios, categoria..."}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Category chips */}
      <FlatList
        horizontal
        data={cats}
        keyExtractor={(c) => c}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: c }) => (
          <Pressable
            style={[styles.chip, { backgroundColor: catFilter === c ? colors.navy : colors.secondary }]}
            onPress={() => setCatFilter(c)}
          >
            <Text style={{ color: catFilter === c ? colors.gold : colors.foreground, fontSize: 12, fontWeight: catFilter === c ? "700" : "400" }}>
              {c}
            </Text>
          </Pressable>
        )}
        style={{ maxHeight: 46, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, rowGap: 8 }}
        showsHorizontalScrollIndicator={false}
      />

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
          contentContainerStyle={{ padding: 14, rowGap: 12, paddingBottom: bottomPad + 40 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={colors.gold} size="small" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={subTab === "vagas" ? "briefcase" : "shopping-bag"} size={42} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "Nenhum resultado encontrado" : subTab === "vagas" ? "Nenhuma vaga publicada ainda" : "Nenhum anúncio publicado ainda"}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {search ? "Tente outros termos de busca" : "Seja o primeiro a publicar!"}
              </Text>
              {!search && (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.gold }]}
                  onPress={() => router.push("/new-opportunity" as any)}
                >
                  <Text style={styles.emptyBtnText}>+ Publicar agora</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  addBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addText:     { color: "#fff", fontSize: 13, fontWeight: "700" },
  subTabs:     { flexDirection: "row", borderBottomWidth: 1 },
  subTab:      { flex: 1, alignItems: "center", paddingVertical: 12 },
  subTabText:  { fontSize: 14 },
  searchWrap:  { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chip:        { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 20 },
  card:        { borderWidth: 1, padding: 16, gap: 10 },
  cardTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardTitles:  { flex: 1 },
  cardTitle:   { fontSize: 15, fontWeight: "800", lineHeight: 21 },
  cardSub:     { fontSize: 12, marginTop: 2 },
  metaRow:     { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  metaItem:    { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText:    { fontSize: 12 },
  contractBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  contractText:  { fontSize: 11, fontWeight: "700" },
  desc:        { fontSize: 13, lineHeight: 19 },
  cardFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date:        { fontSize: 11 },
  actionBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  actionText:  { fontSize: 12, fontWeight: "700" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  empty:       { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10 },
  emptyTitle:  { fontSize: 16, fontWeight: "700" },
  emptySub:    { fontSize: 13 },
  emptyBtn:    { marginTop: 8, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 20 },
  emptyBtnText:{ color: "#fff", fontWeight: "700", fontSize: 14 },
});
