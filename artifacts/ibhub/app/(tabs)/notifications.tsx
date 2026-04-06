import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";

interface NotificationItem {
  id: string;
  type: "like" | "comment" | "follow" | "connection" | "mention" | "event";
  actor_name: string;
  actor_avatar?: string;
  content: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", type: "like", actor_name: "Isabela Mondavi", content: "curtiu sua publicação sobre Alentejo", time: "5m", read: false },
  { id: "n2", type: "comment", actor_name: "Rafael Borges", content: "comentou: \"Ótima análise! Concordo sobre os taninos\"", time: "23m", read: false },
  { id: "n3", type: "connection", actor_name: "Carolina Stein", content: "aceitou sua solicitação de conexão", time: "1h", read: false },
  { id: "n4", type: "follow", actor_name: "Marco Tulio Alves", content: "começou a seguir você", time: "2h", read: true },
  { id: "n5", type: "mention", actor_name: "Fernanda Castro", content: "mencionou você em uma publicação", time: "5h", read: true },
  { id: "n6", type: "event", actor_name: "Clube do Vinho SP", content: "convidou você para: Degustação Exclusiva Bordeaux", time: "1d", read: true },
  { id: "n7", type: "like", actor_name: "Pedro Lima", content: "curtiu seu comentário sobre WSET", time: "2d", read: true },
  { id: "n8", type: "connection", actor_name: "Ana Ferreira", content: "enviou uma solicitação de conexão", time: "3d", read: true },
];

const NOTIFICATION_ICONS: Record<string, { name: any; color: string }> = {
  like: { name: "heart", color: "#c0392b" },
  comment: { name: "message-circle", color: "#2980b9" },
  follow: { name: "user-plus", color: "#27ae60" },
  connection: { name: "users", color: "#8e44ad" },
  mention: { name: "at-sign", color: "#e67e22" },
  event: { name: "calendar", color: "#c9a84c" },
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [tab, setTab] = useState<"tudo" | "conexoes" | "interacoes">("tudo");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 + 34 : 84 + insets.bottom;

  const markAllRead = () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
  };

  const filtered = notifications.filter((n) => {
    if (tab === "conexoes") return ["follow", "connection"].includes(n.type);
    if (tab === "interacoes") return ["like", "comment", "mention"].includes(n.type);
    return true;
  });

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notificações</Text>
          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.gold }]}>
              <Text style={{ color: colors.navy, fontSize: 11, fontWeight: "700" }}>{unread}</Text>
            </View>
          )}
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={[styles.markRead, { color: colors.gold }]}>Marcar todas</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {([
          { key: "tudo", label: "Tudo" },
          { key: "conexoes", label: "Conexões" },
          { key: "interacoes", label: "Interações" },
        ] as const).map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && [styles.activeTab, { borderBottomColor: colors.gold }]]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, { color: tab === t.key ? colors.gold : colors.mutedForeground }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const icon = NOTIFICATION_ICONS[item.type] ?? { name: "bell", color: colors.gold };
          return (
            <Pressable
              style={[
                styles.notifRow,
                { borderBottomColor: colors.border },
                !item.read && { backgroundColor: colors.gold + "08" },
              ]}
              onPress={() => setNotifications((ns) => ns.map((n) => n.id === item.id ? { ...n, read: true } : n))}
            >
              <View style={styles.avatarWrapper}>
                <Avatar name={item.actor_name} size={46} />
                <View style={[styles.typeIcon, { backgroundColor: icon.color }]}>
                  <Feather name={icon.name} size={11} color="#ffffff" />
                </View>
              </View>
              <View style={styles.notifBody}>
                <Text style={[styles.notifText, { color: colors.foreground }]} numberOfLines={2}>
                  <Text style={{ fontWeight: "700" }}>{item.actor_name}</Text>
                  {" "}{item.content}
                </Text>
                <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>
                  {item.time}
                </Text>
              </View>
              {!item.read && (
                <View style={[styles.unreadDot, { backgroundColor: colors.gold }]} />
              )}
            </Pressable>
          );
        }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="bell" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma notificação
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  markRead: { fontSize: 13, fontWeight: "600" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: {},
  tabText: { fontSize: 13, fontWeight: "700" },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  avatarWrapper: { position: "relative" },
  typeIcon: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBody: { flex: 1 },
  notifText: { fontSize: 14, lineHeight: 20 },
  notifTime: { fontSize: 12, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
