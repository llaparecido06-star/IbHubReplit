import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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
import { Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { Group, fetchGroups, joinGroup, requestGroupJoin, leaveGroup, notifyGroupJoinRequest } from "@/services/api";

type AccessType = "aberto" | "fechado" | "restrito";

const CATEGORIES = ["Todos", "Exportação", "Sommelier", "Produção", "Importação", "Enoturismo", "Marketing", "Outros"];
const ACCESS_ICON: Record<AccessType, any> = { aberto: "globe", fechado: "lock", restrito: "shield" };

export default function GroupsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, activeCompany } = useAuth();
  const userId = profile?.id ?? user?.id ?? "";
  const activeCompanyId = activeCompany?.id ?? null;

  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("Todos");
  const [myGroups, setMyGroups]     = useState<Group[]>([]);
  const [exploreGroups, setExplore] = useState<Group[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbError, setDbError]       = useState(false);
  const realtimeRef                 = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reloadTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (!isRefresh) setLoading(true);
    try {
      const { mine, explore } = await fetchGroups(userId, activeCompanyId);
      setMyGroups(mine);
      setExplore(explore);
      setDbError(false);
    } catch {
      setDbError(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId, activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId || realtimeRef.current) return;
    const debouncedLoad = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => load(true), 500);
    };

    const ch = supabase
      .channel(`groups-realtime:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, debouncedLoad)
      .subscribe();
    realtimeRef.current = ch;
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
        realtimeRef.current = null;
      }
    };
  }, [userId, load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const filter = (g: Group) => {
    if (category !== "Todos" && g.category !== category) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  const filteredMine    = myGroups.filter(filter);
  const filteredExplore = exploreGroups.filter(filter);

  const handleJoin = async (g: Group) => {
    const access = g.access as AccessType;

    if (access === "restrito") {
      Alert.alert(t("groups.restricted_title"), t("groups.restricted_msg"));
      return;
    }

    if (access === "fechado") {
      Alert.alert(
        t("groups.request_confirm_title"),
        t("groups.request_confirm_msg", { name: g.name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("groups.request_btn"), onPress: async () => {
              const ok = await requestGroupJoin(g.id, userId, activeCompanyId);
              if (ok) {
                void notifyGroupJoinRequest(g.id);
                Alert.alert(t("groups.request_sent_ok"), t("groups.request_sent_msg"));
                load();
              } else {
                Alert.alert(t("common.error"), t("groups.error_request"));
              }
            }
          },
        ]
      );
      return;
    }

    const ok = await joinGroup(g.id, userId, activeCompanyId);
    if (ok) {
      const title = activeCompanyId ? t("groups.joined_company_ok") : t("groups.joined_ok");
      Alert.alert("✅ " + title, t("groups.joined_msg", { name: g.name }));
      load();
    } else {
      Alert.alert(t("common.error"), t("groups.error_join"));
    }
  };

  const handleLeave = (g: Group) => {
    const who = activeCompanyId ? t("groups.leave_who_company") : t("groups.leave_who");
    Alert.alert(t("groups.leave_confirm_title"), t("groups.leave_confirm_msg", { who, name: g.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("groups.leave"), style: "destructive", onPress: async () => {
          const ok = await leaveGroup(g.id, userId, activeCompanyId);
          if (ok) load();
          else Alert.alert(t("common.error"), t("groups.error_leave"));
        }
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("groups.title")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.gold }]}
          onPress={() => router.push("/new-group" as any)}
        >
          <Feather name="plus" size={15} color="#fff" />
          <Text style={styles.newBtnText}>{t("groups.new_btn")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* DB Error */}
        {dbError && (
          <View style={[styles.errorBanner, { backgroundColor: "#fff7ed", borderColor: "#fdba74" }]}>
            <Text style={{ fontSize: 13, color: "#9a3412" }}>{t("groups.db_error")}</Text>
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: "#fff" }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder={t("groups.search_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, { backgroundColor: category === cat ? colors.gold : colors.background }]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.chipText, { color: category === cat ? "#fff" : colors.mutedForeground }]}>
                {cat === "Todos" ? t("groups.all") : cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("groups.loading")}</Text>
          </View>
        ) : (
          <>
            {/* MEUS GRUPOS */}
            {filteredMine.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("groups.my_groups").toUpperCase()}</Text>
                {filteredMine.map((g) => (
                  <GroupCard key={g.id} group={g} colors={colors} router={router} onLeave={() => handleLeave(g)} />
                ))}
              </View>
            )}

            {/* EXPLORAR */}
            {filteredExplore.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("groups.explore").toUpperCase()}</Text>
                {filteredExplore.map((g) => (
                  <ExploreGroupCard key={g.id} group={g} colors={colors} onJoin={() => handleJoin(g)} />
                ))}
              </View>
            )}

            {filteredMine.length === 0 && filteredExplore.length === 0 && (
              <View style={styles.empty}>
                <Feather name="users" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {search || category !== "Todos" ? t("groups.no_groups") : t("groups.no_groups_yet")}
                </Text>
                {!search && category === "Todos" && (
                  <TouchableOpacity
                    style={[styles.newBtn, { backgroundColor: colors.gold, marginTop: 16 }]}
                    onPress={() => router.push("/new-group" as any)}
                  >
                    <Feather name="plus" size={15} color="#fff" />
                    <Text style={styles.newBtnText}>{t("groups.create")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ExploreGroupCard({ group: g, colors, onJoin }: { group: Group; colors: any; onJoin: () => void }) {
  const { t } = useTranslation();
  const access = g.access as AccessType;
  return (
    <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 }}>
            {g.avatar_url ? (
              <Image source={{ uri: g.avatar_url }} style={styles.groupAvatar} />
            ) : (
              <Avatar name={g.name} size={38} />
            )}
            <Text style={[styles.cardName, { color: colors.navy }]}>{g.name}</Text>
          </View>
          <View style={styles.cardChips}>
            <View style={[styles.chip2, { backgroundColor: colors.background }]}>
              <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{g.category}</Text>
            </View>
            <View style={[styles.chip2, { backgroundColor: colors.background }]}>
              <Feather name={ACCESS_ICON[access]} size={11} color={colors.mutedForeground} />
              <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{t(`groups.access_${access}`)}</Text>
            </View>
          </View>
        </View>
        {g.is_pending ? (
          <View style={[styles.joinBtn, { backgroundColor: "#fef3c7", borderWidth: 1.5, borderColor: "#f59e0b", flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <Feather name="clock" size={12} color="#d97706" />
            <Text style={[styles.joinBtnText, { color: "#d97706", fontSize: 11 }]}>{t("groups.waiting_pending")}</Text>
          </View>
        ) : access === "restrito" ? (
          <View style={[styles.joinBtn, { backgroundColor: colors.background, flexDirection: "row", alignItems: "center", gap: 4 }]}>
            <Feather name="shield" size={12} color={colors.mutedForeground} />
            <Text style={[styles.joinBtnText, { color: colors.mutedForeground }]}>{t("groups.invite_only")}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: access === "fechado" ? "transparent" : colors.gold, borderWidth: access === "fechado" ? 1.5 : 0, borderColor: colors.gold }]}
            onPress={onJoin}
          >
            <Text style={[styles.joinBtnText, { color: access === "fechado" ? colors.gold : "#fff" }]}>
              {access === "fechado" ? t("groups.request_btn") : t("groups.join_btn")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {g.description && (
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{g.description}</Text>
      )}
      <View style={styles.cardMembers}>
        <Feather name="users" size={13} color={colors.mutedForeground} />
        <Text style={[styles.cardMembersText, { color: colors.mutedForeground }]}>
          {t("groups.members", { count: g.member_count ?? 0 })}
        </Text>
      </View>
    </View>
  );
}

function GroupCard({ group: g, colors, router, onLeave }: { group: Group; colors: any; router: any; onLeave: () => void }) {
  const { t } = useTranslation();
  const access = g.access as AccessType;
  return (
    <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 }}>
            {g.avatar_url ? (
              <Image source={{ uri: g.avatar_url }} style={styles.groupAvatar} />
            ) : (
              <Avatar name={g.name} size={38} />
            )}
            <Text style={[styles.cardName, { color: colors.navy }]}>{g.name}</Text>
          </View>
          <View style={styles.cardChips}>
            <View style={[styles.chip2, { backgroundColor: colors.background }]}>
              <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{g.category}</Text>
            </View>
            <View style={[styles.chip2, { backgroundColor: colors.background }]}>
              <Feather name={ACCESS_ICON[access]} size={11} color={colors.mutedForeground} />
              <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{t(`groups.access_${access}`)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.openChatBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push(`/group-chat/${g.id}`)}
          >
            <Text style={styles.openChatText}>{t("groups.chat")}</Text>
          </TouchableOpacity>
          {g.is_owner && (
            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: colors.border }]}
              onPress={() => router.push(`/group-settings/${g.id}`)}
            >
              <Text style={[styles.manageBtnText, { color: colors.navy }]}>{t("groups.manage")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.leaveRow} onPress={onLeave}>
            <Feather name="log-out" size={13} color={colors.mutedForeground} />
            <Text style={[styles.leaveText, { color: colors.mutedForeground }]}>{t("groups.leave")}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {g.description && (
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{g.description}</Text>
      )}
      <View style={styles.cardMembers}>
        <Feather name="users" size={13} color={colors.mutedForeground} />
        <Text style={[styles.cardMembersText, { color: colors.mutedForeground }]}>
          {t("groups.members", { count: g.member_count ?? 0 })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  errorBanner: { margin: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  searchWrap: { padding: 12 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: "600" },
  section: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  cardMeta: { flex: 1, gap: 6 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip2: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chip2Text: { fontSize: 12 },
  cardActions: { alignItems: "flex-end", gap: 6 },
  openChatBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  openChatText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  joinBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  joinBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  manageBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  manageBtnText: { fontSize: 13, fontWeight: "600" },
  leaveRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  leaveText: { fontSize: 13 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardMembers: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardMembersText: { fontSize: 12 },
  groupAvatar: { width: 38, height: 38, borderRadius: 19 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 24 },
  emptyText: { fontSize: 15, textAlign: "center" },
});
