import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";

export interface Conversation {
  id: string;
  participant_name: string;
  participant_avatar?: string | null;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  is_group?: boolean;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface ConversationRowProps {
  conversation: Conversation;
}

export function ConversationRow({ conversation: conv }: ConversationRowProps) {
  const colors = useColors();
  const router = useRouter();
  const hasUnread = (conv.unread_count ?? 0) > 0;

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/chat/${conv.id}` as any)}
      activeOpacity={0.7}
    >
      <Avatar uri={conv.participant_avatar} name={conv.participant_name} size={50} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {conv.participant_name}
          </Text>
          <Text style={[styles.time, { color: hasUnread ? colors.gold : colors.mutedForeground }]}>
            {timeAgo(conv.last_message_at)}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[
              styles.lastMessage,
              { color: hasUnread ? colors.foreground : colors.mutedForeground },
              hasUnread && { fontWeight: "600" },
            ]}
            numberOfLines={1}
          >
            {conv.last_message ?? "Iniciar conversa"}
          </Text>
          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: colors.gold }]}>
              <Text style={[styles.badgeText, { color: colors.navy }]}>
                {conv.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  body: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  name: { fontSize: 15, fontWeight: "700", flex: 1 },
  time: { fontSize: 12 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastMessage: { fontSize: 13, flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
});
