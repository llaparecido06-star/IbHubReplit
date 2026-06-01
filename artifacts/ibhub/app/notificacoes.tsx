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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth, supabase } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { AppNotification } from "@/services/api";
import { formatRelativeDate } from "@/utils/dateUtils";

type UserCompany = { id: string; name: string; avatar_url: string | null };

function buildNotifMessage(
  notif: AppNotification,
  fallbackLabel: string,
  t: (key: string, opts?: any) => string,
): string {
  const wine = notif.wine_name?.trim();
  if (wine) {
    const isCompany = !!notif.target_company_id;
    if (notif.type === "like")
      return isCompany
        ? t("notifications_screen.wine_like_company", { wine })
        : t("notifications_screen.wine_like", { wine });
    if (notif.type === "comment")
      return isCompany
        ? t("notifications_screen.wine_comment_company", { wine })
        : t("notifications_screen.wine_comment", { wine });
  }
  return notif.message ?? fallbackLabel;
}

function NotifRow({
  notif,
  colors,
  onPress,
  onAccept,
  onReject,
}: {
  notif: AppNotification;
  colors: any;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const { t } = useTranslation();

  const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
    like:           { icon: "heart",            color: "#e74c3c", label: t("notifications_screen.type_like") },
    comment:        { icon: "message-circle",   color: "#3498db", label: t("notifications_screen.type_comment") },
    comment_reply:  { icon: "corner-down-right", color: "#8b5cf6", label: t("notifications_screen.type_comment_reply") },
    comment_like:   { icon: "heart",            color: "#e74c3c", label: t("notifications_screen.type_comment_like") },
    follow:         { icon: "user-plus",        color: "#2ecc71", label: t("notifications_screen.type_follow") },
    company_follow: { icon: "user-plus",        color: "#2ecc71", label: t("notifications_screen.type_company_follow") },
    connection:     { icon: "users",            color: "#c9a84c", label: t("notifications_screen.type_connection") },
    mention:        { icon: "at-sign",          color: "#9b59b6", label: t("notifications_screen.type_mention") },
    group_request:  { icon: "user-check",       color: "#7c3aed", label: t("notifications_screen.type_group_request") },
    poll_vote:      { icon: "bar-chart-2",      color: "#0ea5e9", label: t("notifications_screen.type_poll_vote") },
    story_tag:      { icon: "film",             color: "#c9a84c", label: t("notifications_screen.type_story_tag") },
  };

  const meta = TYPE_META[notif.type] ?? { icon: "bell", color: colors.gold, label: t("notifications_screen.type_default") };
  const isConnectionPending  = notif.type === "connection" && notif.connection_status === "pending"  && notif.connection_id;
  const isConnectionAccepted = notif.type === "connection" && notif.connection_status === "accepted";
  const isConnectionRejected = notif.type === "connection" && notif.connection_status === "rejected";

  return (
    <Pressable
      style={[
        styles.row,
        !notif.read && { backgroundColor: colors.gold + "10" },
        { borderBottomColor: colors.border },
      ]}
      onPress={onPress}
    >
      <View style={styles.avatarWrap}>
        <Avatar
          uri={notif.actor_company?.avatar_url ?? notif.actor?.avatar_url}
          name={notif.actor_company?.name ?? notif.actor?.full_name ?? t("notifications_screen.user_label")}
          size={46}
        />
        <View style={[styles.typeIcon, { backgroundColor: meta.color }]}>
          <Feather name={meta.icon} size={10} color="#fff" />
        </View>
      </View>

      <View style={styles.rowBody}>
        <Text style={[styles.rowText, { color: colors.foreground }]} numberOfLines={2}>
          <Text style={{ fontWeight: "700" }}>
            {notif.actor_company?.name ?? notif.actor?.full_name ?? t("notifications_screen.someone")}
          </Text>{" "}
          {buildNotifMessage(notif, meta.label, t)}
        </Text>
        <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>
          {formatRelativeDate(notif.created_at)}
        </Text>

        {isConnectionPending && onAccept && onReject && (
          <View style={styles.connectionActions}>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: colors.gold }]}
              onPress={(e) => { e.stopPropagation?.(); onAccept(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptText}>{t("notifications_screen.accept")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, { borderColor: colors.border }]}
              onPress={(e) => { e.stopPropagation?.(); onReject(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.rejectText, { color: colors.mutedForeground }]}>{t("notifications_screen.reject")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isConnectionAccepted && (
          <View style={styles.connectionFeedback}>
            <Feather name="check-circle" size={13} color="#16a34a" />
            <Text style={[styles.feedbackText, { color: "#16a34a" }]}>{t("notifications_screen.connection_accepted")}</Text>
          </View>
        )}

        {isConnectionRejected && (
          <View style={styles.connectionFeedback}>
            <Feather name="x-circle" size={13} color={colors.mutedForeground} />
            <Text style={[styles.feedbackText, { color: colors.mutedForeground }]}>{t("notifications_screen.connection_rejected")}</Text>
          </View>
        )}
      </View>

      {!notif.read && (
        <View style={[styles.unreadDot, { backgroundColor: colors.gold }]} />
      )}
    </Pressable>
  );
}

function EmptyState({ colors, isCompany }: { colors: any; isCompany?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.gold + "18" }]}>
        <Feather name="bell" size={36} color={colors.gold} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.navy }]}>{t("notifications_screen.empty_title")}</Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        {isCompany
          ? t("notifications_screen.empty_sub_company")
          : t("notifications_screen.empty_sub_personal")}
      </Text>
    </View>
  );
}

type Tab = "personal" | string;

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const colors  = useColors();
  const router  = useRouter();
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();

  const [tab, setTab]                 = useState<Tab>("personal");
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);

  const [personalNotifs, setPersonalNotifs] = useState<AppNotification[]>([]);
  const [companyNotifs,  setCompanyNotifs]  = useState<Record<string, AppNotification[]>>({});

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const activeNotifs: AppNotification[] =
    tab === "personal"
      ? personalNotifs
      : (companyNotifs[tab] ?? []);

  const unreadCount = activeNotifs.filter(n => !n.read).length;

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }

    const [personal, companies] = await Promise.all([
      API.fetchNotifications(user.id),
      supabase
        .from("company_pages")
        .select("id, name, avatar_url")
        .eq("owner_id", user.id),
    ]);

    setPersonalNotifs(personal);

    const companyList: UserCompany[] = (companies.data ?? []).map((c: any) => ({
      id:         c.id,
      name:       c.name,
      avatar_url: c.avatar_url ?? null,
    }));
    setUserCompanies(companyList);

    if (companyList.length > 0) {
      const results = await Promise.all(
        companyList.map(c => API.fetchCompanyNotifications(c.id))
      );
      const map: Record<string, AppNotification[]> = {};
      companyList.forEach((c, i) => { map[c.id] = results[i]; });
      setCompanyNotifs(map);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!user?.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`notifs_personal_${user.id}_${uid}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, async () => {
        const fresh = await API.fetchNotifications(user.id);
        setPersonalNotifs(fresh);
        if (userCompanies.length > 0) {
          const results = await Promise.all(
            userCompanies.map(c => API.fetchCompanyNotifications(c.id))
          );
          const map: Record<string, AppNotification[]> = {};
          userCompanies.forEach((c, i) => { map[c.id] = results[i]; });
          setCompanyNotifs(map);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, userCompanies]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    if (tab === "personal") {
      setPersonalNotifs(prev => prev.map(n => ({ ...n, read: true })));
      await API.markAllNotificationsRead(user.id);
    } else {
      setCompanyNotifs(prev => ({
        ...prev,
        [tab]: (prev[tab] ?? []).map(n => ({ ...n, read: true })),
      }));
      await API.markAllCompanyNotificationsRead(tab);
    }
  };

  const handleNotifPress = async (notif: AppNotification) => {
    if (!notif.read) {
      if (tab === "personal") {
        setPersonalNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      } else {
        setCompanyNotifs(prev => ({
          ...prev,
          [tab]: (prev[tab] ?? []).map(n => n.id === notif.id ? { ...n, read: true } : n),
        }));
      }
      await API.markNotificationRead(notif.id);
    }

    if (notif.type === "group_request" && notif.metadata?.group_id) {
      router.push(`/group-settings/${notif.metadata.group_id}` as any);
    } else if (notif.type === "story_tag" && notif.metadata?.story_id) {
      router.push(`/story/${notif.metadata.story_id}` as any);
    } else if (notif.type === "company_follow" && (notif as any).target_company_id) {
      router.push(`/empresa/${(notif as any).target_company_id}` as any);
    } else if (notif.post_id) {
      const params = notif.comment_id ? `?commentId=${notif.comment_id}` : "";
      router.push(`/post/${notif.post_id}${params}` as any);
    } else if (notif.actor?.id) {
      router.push(`/profile/${notif.actor.id}` as any);
    }
  };

  const handleAcceptConnection = async (notif: AppNotification) => {
    if (!notif.connection_id) return;
    const prevRead = notif.read;
    setPersonalNotifs(prev => prev.map(n =>
      n.id === notif.id ? { ...n, connection_status: "accepted", read: true } : n
    ));
    const ok = await API.respondToConnection(notif.connection_id, "accepted");
    if (!ok) {
      setPersonalNotifs(prev => prev.map(n =>
        n.id === notif.id ? { ...n, connection_status: "pending", read: prevRead } : n
      ));
    } else {
      await API.markNotificationRead(notif.id);
    }
  };

  const handleRejectConnection = async (notif: AppNotification) => {
    if (!notif.connection_id) return;
    const prevRead = notif.read;
    setPersonalNotifs(prev => prev.map(n =>
      n.id === notif.id ? { ...n, connection_status: "rejected", read: true } : n
    ));
    const ok = await API.respondToConnection(notif.connection_id, "rejected");
    if (!ok) {
      setPersonalNotifs(prev => prev.map(n =>
        n.id === notif.id ? { ...n, connection_status: "pending", read: prevRead } : n
      ));
    } else {
      await API.markNotificationRead(notif.id);
    }
  };

  const personalUnread = personalNotifs.filter(n => !n.read).length;
  const companyUnreadFor = (id: string) => (companyNotifs[id] ?? []).filter(n => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("notifications_screen.title")}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllWrap}>
            <Text style={[styles.markAllBtn, { color: colors.gold }]}>{t("notifications_screen.mark_all_read")}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      {/* Tabs */}
      {userCompanies.length > 0 && (
        <View style={[styles.tabs, { borderBottomColor: colors.border, backgroundColor: "#fff" }]}>
          <TabButton
            label={t("notifications_screen.tab_personal")}
            active={tab === "personal"}
            badge={personalUnread}
            colors={colors}
            onPress={() => setTab("personal")}
          />
          {userCompanies.map(c => (
            <TabButton
              key={c.id}
              label={c.name}
              active={tab === c.id}
              badge={companyUnreadFor(c.id)}
              colors={colors}
              onPress={() => setTab(c.id)}
            />
          ))}
        </View>
      )}

      {/* Unread summary bar */}
      {unreadCount > 0 && (
        <View style={[styles.unreadBar, { backgroundColor: colors.gold + "12", borderBottomColor: colors.gold + "30" }]}>
          <View style={[styles.unreadBadge, { backgroundColor: colors.gold }]}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
          <Text style={[styles.unreadBarText, { color: colors.gold }]}>
            {unreadCount === 1 ? t("notifications_screen.unread_one") : t("notifications_screen.unread_many")}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={activeNotifs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotifRow
              notif={item}
              colors={colors}
              onPress={() => handleNotifPress(item)}
              onAccept={item.type === "connection" && item.connection_status === "pending" ? () => handleAcceptConnection(item) : undefined}
              onReject={item.type === "connection" && item.connection_status === "pending" ? () => handleRejectConnection(item) : undefined}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
          contentContainerStyle={activeNotifs.length === 0 ? styles.emptyContainer : { paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState colors={colors} isCompany={tab !== "personal"} />}
        />
      )}
    </View>
  );
}

function TabButton({
  label,
  active,
  badge,
  colors,
  onPress,
}: {
  label: string;
  active: boolean;
  badge: number;
  colors: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.tabLabelWrap}>
        <Text
          style={[
            styles.tabLabel,
            { color: active ? colors.gold : colors.mutedForeground },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {badge > 0 && (
          <View style={[styles.tabBadge, { backgroundColor: colors.gold }]}>
            <Text style={styles.tabBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {active && <View style={[styles.tabUnderline, { backgroundColor: colors.gold }]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 10 },
  backBtn:            { padding: 4 },
  headerTitle:        { flex: 1, fontSize: 20, fontWeight: "800" },
  markAllWrap:        { alignItems: "flex-end", flexShrink: 0 },
  markAllBtn:         { fontSize: 12, fontWeight: "700" },

  tabs:               { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn:             { flex: 1, alignItems: "center", paddingVertical: 10, paddingHorizontal: 6, maxWidth: 160 },
  tabLabelWrap:       { flexDirection: "row", alignItems: "center", gap: 5 },
  tabLabel:           { fontSize: 13, fontWeight: "700" },
  tabBadge:           { minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText:       { color: "#fff", fontSize: 10, fontWeight: "800" },
  tabUnderline:       { position: "absolute", bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1 },

  unreadBar:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  unreadBadge:        { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  unreadBadgeText:    { color: "#fff", fontSize: 11, fontWeight: "800" },
  unreadBarText:      { fontSize: 13, fontWeight: "600" },

  center:             { flex: 1, alignItems: "center", justifyContent: "center" },
  row:                { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  avatarWrap:         { position: "relative" },
  typeIcon:           { position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" },
  rowBody:            { flex: 1, gap: 3 },
  rowText:            { fontSize: 14, lineHeight: 20 },
  rowTime:            { fontSize: 12 },
  unreadDot:          { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  emptyContainer:     { flex: 1 },
  empty:              { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40, gap: 14 },
  emptyIconCircle:    { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle:         { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptySub:           { fontSize: 14, textAlign: "center", lineHeight: 20 },
  connectionActions:  { flexDirection: "row", gap: 8, marginTop: 8 },
  acceptBtn:          { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  acceptText:         { color: "#fff", fontSize: 13, fontWeight: "700" },
  rejectBtn:          { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  rejectText:         { fontSize: 13 },
  connectionFeedback: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  feedbackText:       { fontSize: 13, fontWeight: "600" },
});
