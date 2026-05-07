import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";

const PAGE_SIZE = 15;

function StarRow({ avg, count }: { avg: number; count: number }) {
  const { t } = useTranslation();
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
        ({t("wine_ranking.ratings", { count })})
      </Text>
    </View>
  );
}

export default function WineRankingScreen() {
  const { t }   = useTranslation();
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{ ean?: string }>();

  const initialEan = params.ean ?? "";

  type SortKey = "score" | "alpha" | "count";

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "score", label: t("wine_ranking.sort_score") },
    { key: "count", label: t("wine_ranking.sort_count") },
    { key: "alpha", label: t("wine_ranking.sort_alpha") },
  ];

  const [allRatings, setAllRatings]   = useState<API.WineCommunityRating[]>([]);
  const [displayedItems, setDisplayedItems] = useState<API.WineCommunityRating[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [eanFilter, setEanFilter]     = useState(initialEan);
  const [searching, setSearching]     = useState(false);
  const [sortBy, setSortBy]           = useState<SortKey>("score");

  const [detailWine,    setDetailWine]    = useState<API.WineCommunityRating | null>(null);
  const [detailReviews, setDetailReviews] = useState<API.WineEanReview[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const pageRef = useRef(0);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const getSorted = useCallback(
    (list: API.WineCommunityRating[], sort: SortKey) =>
      [...list].sort((a, b) => {
        if (sort === "alpha") return (a.name ?? "").localeCompare(b.name ?? "");
        if (sort === "count") return Number(b.total_ratings ?? 0) - Number(a.total_ratings ?? 0);
        return Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0);
      }),
    [],
  );

  const load = useCallback(async (ean?: string) => {
    if (ean !== undefined) {
      setSearching(true);
    } else {
      setLoading(true);
    }
    const data = await API.fetchWineCommunityRatings(ean || undefined);
    const sorted = getSorted(data, sortBy);
    setAllRatings(sorted);
    pageRef.current = 1;
    setDisplayedItems(sorted.slice(0, PAGE_SIZE));
    setHasMore(sorted.length > PAGE_SIZE);
    setLoading(false);
    setSearching(false);
  }, [getSorted, sortBy]);

  useEffect(() => {
    load(initialEan || undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sorted = getSorted(allRatings, sortBy);
    setAllRatings(sorted);
    pageRef.current = 1;
    setDisplayedItems(sorted.slice(0, PAGE_SIZE));
    setHasMore(sorted.length > PAGE_SIZE);
  }, [sortBy]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const nextItems = allRatings.slice(0, nextPage * PAGE_SIZE);
    setDisplayedItems(nextItems);
    setHasMore(allRatings.length > nextPage * PAGE_SIZE);
    pageRef.current = nextPage;
    setLoadingMore(false);
  }, [loadingMore, hasMore, allRatings]);

  const handleSearch = () => {
    load(eanFilter.trim() || undefined);
  };

  const handleClear = () => {
    setEanFilter("");
    load(undefined);
  };

  const openDetail = async (wine: API.WineCommunityRating) => {
    setDetailWine(wine);
    setDetailReviews([]);
    setDetailLoading(true);
    const reviews = await API.fetchWineEanReviews(wine.ean);
    setDetailReviews(reviews);
    setDetailLoading(false);
  };

  const renderItem = ({ item, index }: { item: API.WineCommunityRating; index: number }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}
      onPress={() => openDetail(item)}
      activeOpacity={0.75}
    >
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
          {[item.producer, item.vintage].filter(Boolean).join(" · ") || t("wine_ranking.unknown_producer")}
        </Text>
        <StarRow avg={Number(item.avg_rating)} count={Number(item.total_ratings)} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          <Feather name="tag" size={11} color={colors.mutedForeground} />
          <Text style={[styles.eanText, { color: colors.mutedForeground }]}>EAN {item.ean}</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={colors.border} style={{ alignSelf: "center" }} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("wine_ranking.title")}</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {initialEan ? `EAN ${initialEan}` : t("wine_ranking.subtitle")}
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
            placeholder={t("wine_ranking.ean_placeholder")}
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
      {!loading && allRatings.length > 0 && (
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
      ) : allRatings.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bar-chart-2" size={44} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
            {eanFilter.trim() ? t("wine_ranking.ean_empty") : t("wine_ranking.no_ratings")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(item) => item.ean}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
              {t("wine_ranking.labels", { count: allRatings.length })} {t("wine_ranking.with_public_rating")}
            </Text>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={colors.gold} size="small" />
              </View>
            ) : null
          }
        />
      )}

      {/* ── Detail Modal ── */}
      <Modal
        visible={!!detailWine}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailWine(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDetailWine(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: "#fff" }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.navy }]} numberOfLines={2}>
                  {detailWine?.name}
                </Text>
                {(detailWine?.producer || detailWine?.vintage) && (
                  <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                    {[detailWine?.producer, detailWine?.vintage].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setDetailWine(null)} style={{ padding: 4, marginTop: -2 }}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {detailWine && (
              <View style={[styles.modalAggregate, { backgroundColor: colors.gold + "12", borderColor: colors.gold + "40" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MaterialCommunityIcons name="star" size={20} color={colors.gold} />
                  <Text style={{ fontSize: 22, fontWeight: "800", color: colors.navy }}>
                    {Number(detailWine.avg_rating).toFixed(1)}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.mutedForeground }}>/5</Text>
                </View>
                {detailWine.avg_score != null && (
                  <View style={[styles.scoreBadge, { backgroundColor: colors.gold }]}>
                    <MaterialCommunityIcons name="star" size={12} color="#fff" />
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>
                      {Math.round(Number(detailWine.avg_score))}/100
                    </Text>
                  </View>
                )}
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                  {t("wine_ranking.ratings", { count: Number(detailWine.total_ratings) })}
                </Text>
              </View>
            )}

            <Text style={[styles.reviewsLabel, { color: colors.mutedForeground }]}>
              {t("wine_ranking.individual_reviews")}
            </Text>

            {detailLoading ? (
              <ActivityIndicator color={colors.gold} style={{ marginVertical: 24 }} />
            ) : detailReviews.length === 0 ? (
              <Text style={[styles.emptyReviews, { color: colors.mutedForeground }]}>
                {t("wine_ranking.no_public_reviews")}
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  {detailReviews.map((rev, idx) => (
                    <View key={rev.id} style={[styles.reviewRow, { borderColor: colors.border }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <Text style={[styles.reviewRank, { color: idx < 3 ? colors.gold : colors.mutedForeground }]}>
                          #{idx + 1}
                        </Text>
                        <Avatar
                          name={rev.profile?.full_name ?? "?"}
                          uri={rev.profile?.avatar_url ?? undefined}
                          size={34}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reviewName, { color: colors.navy }]} numberOfLines={1}>
                            {rev.profile?.full_name ?? t("common.user")}
                          </Text>
                          {rev.tasted_at && (
                            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                              {new Date(rev.tasted_at).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                        {rev.score != null && (
                          <View style={[styles.scoreBadge, { backgroundColor: colors.gold }]}>
                            <MaterialCommunityIcons name="star" size={11} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{rev.score}/100</Text>
                          </View>
                        )}
                      </View>
                      {rev.rating != null && (
                        <View style={{ flexDirection: "row", gap: 3, marginBottom: 4 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Feather
                              key={i}
                              name="star"
                              size={13}
                              color={i < rev.rating! ? colors.gold : colors.border}
                            />
                          ))}
                        </View>
                      )}
                      {rev.notes?.trim() ? (
                        <Text style={[styles.reviewNotes, { color: colors.foreground }]}>
                          {rev.notes.trim()}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet:   { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 40, maxHeight: "85%" as any },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: "800", marginRight: 8 },
  modalSub:     { fontSize: 13, marginTop: 2 },
  modalAggregate: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14, marginVertical: 12, flexWrap: "wrap" as any },
  scoreBadge:   { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  reviewsLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.8, marginBottom: 10 },
  emptyReviews: { fontSize: 13, textAlign: "center", paddingVertical: 24 },
  reviewRow:    { borderWidth: 1, borderRadius: 12, padding: 12 },
  reviewRank:   { fontSize: 14, fontWeight: "800", minWidth: 28 },
  reviewName:   { fontSize: 14, fontWeight: "700" },
  reviewNotes:  { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
