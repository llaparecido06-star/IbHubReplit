import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";

function StarRow({ avg, count }: { avg: number; count: number }) {
  const colors = useColors();
  const full  = Math.floor(avg);
  const half  = avg - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {Array.from({ length: full }).map((_, i) => (
        <Feather key={`f${i}`} name="star" size={14} color={colors.gold} />
      ))}
      {half === 1 && <Feather name="star" size={14} color={colors.gold + "99"} />}
      {Array.from({ length: empty }).map((_, i) => (
        <Feather key={`e${i}`} name="star" size={14} color={colors.border} />
      ))}
      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.gold }}>
        {avg.toFixed(1)}
      </Text>
      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
        ({count} {count === 1 ? "avaliação" : "avaliações"})
      </Text>
    </View>
  );
}

export default function WineRankingScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{ ean?: string }>();

  // Se veio de um post de degustação, pré-filtra pelo EAN do vinho
  const initialEan = params.ean ?? "";

  type SortKey = "score" | "alpha" | "count";

  const [ratings, setRatings]         = useState<API.WineCommunityRating[]>([]);
  const [loading, setLoading]         = useState(true);
  const [eanFilter, setEanFilter]     = useState(initialEan);
  const [searching, setSearching]     = useState(false);
  const [sortBy, setSortBy]           = useState<SortKey>("score");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async (ean?: string) => {
    if (ean !== undefined) {
      setSearching(true);
    } else {
      setLoading(true);
    }
    const data = await API.fetchWineCommunityRatings(ean || undefined);
    setRatings(data);
    setLoading(false);
    setSearching(false);
  }, []);

  useEffect(() => {
    // Carrega com o EAN inicial (vindo de um post) ou sem filtro
    load(initialEan || undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    load(eanFilter.trim() || undefined);
  };

  const handleClear = () => {
    setEanFilter("");
    load(undefined);
  };

  const sortedRatings = [...ratings].sort((a, b) => {
    if (sortBy === "alpha") return (a.name ?? "").localeCompare(b.name ?? "");
    if (sortBy === "count") return Number(b.total_ratings ?? 0) - Number(a.total_ratings ?? 0);
    return Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0); // "score"
  });

  const SORT_OPTIONS: { key: typeof sortBy; label: string }[] = [
    { key: "score", label: "Maior Pontuação" },
    { key: "count", label: "Mais Avaliados" },
    { key: "alpha", label: "Alfabética" },
  ];

  const renderItem = ({ item, index }: { item: API.WineCommunityRating; index: number }) => (
    <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={styles.rankBadge}>
        <Text style={[styles.rankNum, { color: index < 3 ? colors.gold : colors.mutedForeground }]}>
          #{index + 1}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.wineName, { color: colors.navy }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.wineSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {[item.producer, item.vintage].filter(Boolean).join(" · ") || "Produtor desconhecido"}
        </Text>
        <StarRow avg={Number(item.avg_rating)} count={Number(item.total_ratings)} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          <Feather name="tag" size={11} color={colors.mutedForeground} />
          <Text style={[styles.eanText, { color: colors.mutedForeground }]}>EAN {item.ean}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.navy }]}>Ranking de Vinhos</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {initialEan ? `EAN ${initialEan}` : "Notas da comunidade ibhub"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* EAN filter */}
      <View style={[styles.filterWrap, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { borderColor: colors.border }]}>
          <Feather name="tag" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Filtrar por EAN (ex: 7896123456789)"
            placeholderTextColor={colors.mutedForeground}
            value={eanFilter}
            onChangeText={setEanFilter}
            keyboardType="numeric"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {eanFilter.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={{ padding: 4 }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.gold }, searching && { opacity: 0.6 }]}
          onPress={handleSearch}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="search" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Sort filters */}
      {!loading && ratings.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setSortBy(opt.key)}
              style={{
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                backgroundColor: sortBy === opt.key ? colors.gold : "#f5f5f0",
                borderWidth: 1, borderColor: sortBy === opt.key ? colors.gold : colors.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: sortBy === opt.key ? "#fff" : colors.mutedForeground }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : ratings.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bar-chart-2" size={44} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
            {eanFilter.trim()
              ? "Nenhuma avaliação pública encontrada para este EAN."
              : "Ainda não há avaliações comunitárias.\nAdicione vinhos com EAN e avalie!"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedRatings}
          keyExtractor={(item) => item.ean}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
              {sortedRatings.length} {sortedRatings.length === 1 ? "rótulo" : "rótulos"} com avaliação pública
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow:      { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle:  { fontSize: 20, fontWeight: "800" },
  headerSub:    { fontSize: 12, marginTop: 1 },
  filterWrap:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  searchBar:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, backgroundColor: "#f8f8f8" },
  searchInput:  { flex: 1, fontSize: 14 },
  searchBtn:    { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle:   { fontSize: 14, textAlign: "center", lineHeight: 20 },
  listHeader:   { fontSize: 12, marginBottom: 6 },
  card:         { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: 12, borderWidth: 1, padding: 14 },
  rankBadge:    { width: 32, alignItems: "center" },
  rankNum:      { fontSize: 16, fontWeight: "800" },
  wineName:     { fontSize: 15, fontWeight: "700" },
  wineSub:      { fontSize: 12 },
  eanText:      { fontSize: 11 },
});
