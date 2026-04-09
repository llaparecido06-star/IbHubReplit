import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {
  fetchActiveStories,
  fetchAllStoriesAdmin,
  deleteStoryAdmin,
  fetchStoryViewsCount,
  fetchStoryLikesCount,
} from "@/services/api";
import type { AppStory } from "@/services/api";

const TABS = ["Ativos", "Todos"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function AdminMomentosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [search, setSearch]               = useState("");
  const [tab, setTab]                     = useState("Ativos");
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [stories, setStories]             = useState<AppStory[]>([]);
  const [activeStories, setActiveStories] = useState<AppStory[]>([]);
  const [totalViews, setTotalViews]       = useState(0);
  const [totalLikes, setTotalLikes]       = useState(0);
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async () => {
    const [allStories, active, views, likes] = await Promise.all([
      fetchAllStoriesAdmin(),
      fetchActiveStories(),
      fetchStoryViewsCount(),
      fetchStoryLikesCount(),
    ]);
    setStories(allStories);
    setActiveStories(active);
    setTotalViews(views);
    setTotalLikes(likes);
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

  const handleDelete = (story: AppStory) => {
    Alert.alert(
      "Excluir Story",
      `Deseja excluir o story de ${story.author?.full_name ?? "usuário"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setDeletingId(story.id);
            const ok = await deleteStoryAdmin(story.id);
            if (ok) {
              setStories((prev) => prev.filter((s) => s.id !== story.id));
              setActiveStories((prev) => prev.filter((s) => s.id !== story.id));
            } else {
              Alert.alert("Erro", "Não foi possível excluir o story. Tente novamente.");
            }
            setDeletingId(null);
          },
        },
      ],
    );
  };

  const nowStr = new Date().toISOString();
  const displayList = tab === "Ativos" ? activeStories : stories;
  const filtered = displayList.filter((s) => {
    if (!search.trim()) return true;
    return (s.author?.full_name ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const KPIS = [
    { icon: "film"  as const, iconColor: "#c9a84c", iconBg: "#fef9ee", label: "Stories\nativos",       value: activeStories.length },
    { icon: "eye"   as const, iconColor: "#3b82f6", iconBg: "#dbeafe", label: "Visualizações\ntotais", value: totalViews },
    { icon: "heart" as const, iconColor: "#ef4444", iconBg: "#fee2e2", label: "Reações\ntotais",       value: totalLikes },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Momentos</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />
        }
      >
        {/* Hero */}
        <View style={{ gap: 4 }}>
          <View style={styles.heroRow}>
            <Feather name="film" size={20} color={colors.gold} />
            <Text style={[styles.heroTitle, { color: colors.navy }]}>Gestão de Momentos{"\n"}(Stories)</Text>
          </View>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Visualize, modere e analise os stories publicados
          </Text>
        </View>

        {/* KPI 3-col */}
        <View style={styles.kpiRow}>
          {KPIS.map((k) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.iconBg }]}>
                <Feather name={k.icon} size={18} color={k.iconColor} />
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
              placeholder="Buscar por autor..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={[styles.tabs, { backgroundColor: colors.border + "55" }]}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tab,
                  t === tab && { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
                ]}
                onPress={() => setTab(t)}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: t === tab ? colors.navy : colors.mutedForeground, fontWeight: t === tab ? "700" : "400" },
                  ]}
                >
                  {t}
                </Text>
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
              <Feather name="film" size={36} color="#9ca3af" />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum momento encontrado</Text>
          </View>
        ) : (
          <View style={[styles.table, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableHeadText, { color: colors.mutedForeground }]}>STORY</Text>
              <Text style={[styles.tableHeadText, { color: colors.mutedForeground }]}>AÇÃO</Text>
            </View>
            {filtered.map((story, i) => {
              const isActive = story.expires_at > nowStr;
              return (
                <View
                  key={story.id}
                  style={[
                    styles.tableRow,
                    i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  {story.image_url ? (
                    <Image source={{ uri: story.image_url }} style={styles.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.gold + "18" }]}>
                      <Feather name="film" size={16} color={colors.gold} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.storyAuthor, { color: colors.navy }]} numberOfLines={1}>
                      {story.author?.full_name ?? "Usuário desconhecido"}
                    </Text>
                    <View style={styles.storyMeta}>
                      <Text style={[styles.storyTime, { color: colors.mutedForeground }]}>
                        {timeAgo(story.created_at)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: isActive ? "#d1fae5" : "#f3f4f6" }]}>
                        <Text style={[styles.statusText, { color: isActive ? "#059669" : "#6b7280" }]}>
                          {isActive ? "Ativo" : "Expirado"}
                        </Text>
                      </View>
                    </View>
                    {story.text ? (
                      <Text style={[styles.storyText, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {story.text}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: "#fed7aa" }]}
                      onPress={() =>
                        Alert.alert(
                          "Moderar Story",
                          `Revisar o conteúdo de ${story.author?.full_name ?? "este usuário"} no módulo de Moderação?`,
                          [
                            { text: "Cancelar", style: "cancel" },
                            {
                              text: "Ir para Moderação",
                              onPress: () => router.push("/admin/moderacao"),
                            },
                          ],
                        )
                      }
                    >
                      <Feather name="flag" size={15} color="#f97316" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: "#fecaca" }]}
                      onPress={() => handleDelete(story)}
                      disabled={deletingId === story.id}
                    >
                      {deletingId === story.id ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Feather name="trash-2" size={15} color="#ef4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/momentos" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1 },
  header:               { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:          { fontSize: 18, fontWeight: "700" },
  heroRow:              { flexDirection: "row", alignItems: "center", gap: 8 },
  heroTitle:            { fontSize: 22, fontWeight: "800" },
  heroSub:              { fontSize: 13 },
  kpiRow:               { flexDirection: "row", gap: 8 },
  kpiCard:              { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4, alignItems: "center" },
  kpiIcon:              { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  kpiValue:             { fontSize: 22, fontWeight: "800" },
  kpiLabel:             { fontSize: 10, textAlign: "center", lineHeight: 14 },
  searchRow:            { flexDirection: "row", gap: 8, alignItems: "center" },
  searchBox:            { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput:          { flex: 1, fontSize: 14 },
  tabs:                 { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  tab:                  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  tabText:              { fontSize: 13 },
  empty:                { alignItems: "center", paddingVertical: 60, gap: 14 },
  emptyIcon:            { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyText:            { fontSize: 14 },
  table:                { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableHead:            { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tableHeadText:        { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  tableRow:             { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  thumbnail:            { width: 44, height: 44, borderRadius: 10 },
  thumbnailPlaceholder: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  storyAuthor:          { fontSize: 14, fontWeight: "600" },
  storyMeta:            { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  storyTime:            { fontSize: 12 },
  statusBadge:          { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText:           { fontSize: 11, fontWeight: "600" },
  storyText:            { fontSize: 12, marginTop: 2 },
  actionBtns:           { flexDirection: "row", gap: 6 },
  actionBtn:            { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
