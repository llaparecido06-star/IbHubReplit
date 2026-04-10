import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth, supabase } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { AppNotification } from "@/services/api";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  like:          { icon: "heart",          color: "#e74c3c", label: "curtiu sua publicação" },
  comment:       { icon: "message-circle", color: "#3498db", label: "comentou na sua publicação" },
  comment_reply: { icon: "corner-down-right", color: "#8b5cf6", label: "respondeu seu comentário" },
  follow:        { icon: "user-plus",      color: "#2ecc71", label: "começou a seguir você" },
  connection:    { icon: "users",          color: "#c9a84c", label: "enviou pedido de conexão" },
  mention:       { icon: "at-sign",        color: "#9b59b6", label: "mencionou você" },
};

function NotifRow({
  notif,
  colors,
  onPress,
}: {
  notif: AppNotification;
  colors: any;
  onPress: () => void;
}) {
  const meta = TYPE_META[notif.type] ?? { icon: "bell", color: colors.gold, label: "nova notificação" };

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
          uri={notif.actor?.avatar_url}
          name={notif.actor?.full_name ?? "Usuário"}
          size={46}
        />
        <View style={[styles.typeIcon, { backgroundColor: meta.color }]}>
          <Feather name={meta.icon} size={10} color="#fff" />
        </View>
      </View>

      <View style={styles.rowBody}>
        <Text style={[styles.rowText, { color: colors.foreground }]} numberOfLines={2}>
          <Text style={{ fontWeight: "700" }}>
            {notif.actor?.full_name ?? "Alguém"}
          </Text>{" "}
          {notif.message ?? meta.label}
        </Text>
        <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>
          {timeAgo(notif.created_at)}
        </Text>
      </View>

      {!notif.read && (
        <View style={[styles.unreadDot, { backgroundColor: colors.gold }]} />
      )}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const data = await API.fetchNotifications(user.id);
    setNotifs(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Reload on focus so badge count is fresh
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: new notification arrives → prepend it
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifs_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          // Reload to get actor profile
          const fresh = await API.fetchNotifications(user.id);
          setNotifs(fresh);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleNotifPress = async (notif: AppNotification) => {
    if (!notif.read) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      await API.markNotificationRead(notif.id);
    }
    if (notif.post_id) {
      router.push(`/post/${notif.post_id}` as any);
    } else if (notif.actor?.id) {
      router.push(`/profile/${notif.actor.id}` as any);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await API.markAllNotificationsRead(user.id);
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Notificações</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllWrap}>
            <Text style={[styles.markAllBtn, { color: colors.gold }]}>Marcar todas</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      {/* Unread summary bar */}
      {unreadCount > 0 && (
        <View style={[styles.unreadBar, { backgroundColor: colors.gold + "12", borderBottomColor: colors.gold + "30" }]}>
          <View style={[styles.unreadBadge, { backgroundColor: colors.gold }]}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
          <Text style={[styles.unreadBarText, { color: colors.gold }]}>
            {unreadCount === 1 ? "nova notificação" : "novas notificações"}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotifRow notif={item} colors={colors} onPress={() => handleNotifPress(item)} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
          contentContainerStyle={notifs.length === 0 ? styles.emptyContainer : { paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.gold + "18" }]}>
                <Feather name="bell" size={36} color={colors.gold} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.navy }]}>Tudo tranquilo por aqui</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Suas notificações de curtidas, comentários e conexões aparecerão aqui
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 10 },
  backBtn:         { padding: 4 },
  headerTitle:     { flex: 1, fontSize: 20, fontWeight: "800" },
  markAllWrap:     { width: 90, alignItems: "flex-end" },
  markAllBtn:      { fontSize: 13, fontWeight: "700" },
  unreadBar:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  unreadBadge:     { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  unreadBarText:   { fontSize: 13, fontWeight: "600" },
  center:          { flex: 1, alignItems: "center", justifyContent: "center" },
  row:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  avatarWrap:      { position: "relative" },
  typeIcon:        { position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" },
  rowBody:         { flex: 1, gap: 3 },
  rowText:         { fontSize: 14, lineHeight: 20 },
  rowTime:         { fontSize: 12 },
  unreadDot:       { width: 9, height: 9, borderRadius: 5 },
  emptyContainer:  { flex: 1 },
  empty:           { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40, gap: 14 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle:      { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptySub:        { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
