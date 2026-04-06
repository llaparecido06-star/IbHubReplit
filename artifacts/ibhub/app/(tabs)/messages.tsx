import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: "c1", participant_name: "Brenda Lima",    last_message: "Ola",  last_message_at: new Date(Date.now() - 86400000 * 6).toISOString(),  unread_count: 0 },
  { id: "c2", participant_name: "Felipe Galtaroca", last_message: "Olá!", last_message_at: new Date(Date.now() - 86400000 * 29).toISOString(), unread_count: 0 },
  { id: "c3", participant_name: "João Oliveira",  last_message: "Teste", last_message_at: new Date(Date.now() - 86400000 * 31).toISOString(), unread_count: 0 },
  { id: "c4", participant_name: "Lucas Lima",     last_message: "Perfeito! Me adiciona no grupo quando criar. P...", last_message_at: new Date(Date.now() - 86400000 * 35).toISOString(), unread_count: 0 },
];

const MOCK_USERS = [
  { id: "u1", name: "Isabela Mondavi",  headline: "Enóloga | Santa Clara" },
  { id: "u2", name: "Rafael Borges",    headline: "Importador de Vinhos" },
  { id: "u3", name: "Carolina Stein",   headline: "Sommelier | Grand Plaza" },
  { id: "u4", name: "Marco Tulio",      headline: "Professor SENAC" },
];

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch]           = useState("");
  const [userSearch, setUserSearch]   = useState("");
  const [showNewConvo, setShowNewConvo] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const filtered = MOCK_CONVERSATIONS.filter((c) =>
    search ? c.participant_name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const filteredUsers = MOCK_USERS.filter((u) =>
    userSearch ? u.name.toLowerCase().includes(userSearch.toLowerCase()) : true
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Mensagens</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.newChatCircle, { backgroundColor: colors.gold }]}
            onPress={() => { setShowNewConvo((v) => !v); setUserSearch(""); }}
          >
            <Feather name="message-square" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gruposBtn}
            onPress={() => router.push("/groups" as any)}
          >
            <Feather name="users" size={16} color={colors.navy} />
            <Text style={[styles.gruposBtnText, { color: colors.navy }]}>Grupos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Nova conversa expandable */}
      {showNewConvo && (
        <View style={[styles.novaConversaCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <Text style={[styles.novaConversaTitle, { color: colors.navy }]}>Nova conversa</Text>
          <View style={[styles.userSearchBar, { backgroundColor: colors.background }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[styles.userSearchInput, { color: colors.foreground }]}
              placeholder="Buscar usuário por nome..."
              placeholderTextColor={colors.mutedForeground}
              value={userSearch}
              onChangeText={setUserSearch}
              autoFocus
            />
          </View>
          {userSearch.length > 0 && (
            <View style={{ marginTop: 8, gap: 6 }}>
              {filteredUsers.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userRow}
                  onPress={() => { setShowNewConvo(false); router.push(`/chat/${u.id}` as any); }}
                >
                  <Avatar name={u.name} size={38} />
                  <View>
                    <Text style={[styles.userName, { color: colors.navy }]}>{u.name}</Text>
                    <Text style={[styles.userHeadline, { color: colors.mutedForeground }]}>{u.headline}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: "#fff" }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar conversas..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Conversation list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationRow conversation={item} colors={colors} />}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.gold + "18" }]}>
              <Feather name="message-circle" size={36} color={colors.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.navy }]}>O brinde começa com um "Olá"</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Inicie uma conversa com alguém da comunidade
            </Text>
            <TouchableOpacity
              style={[styles.newConvoBtn, { backgroundColor: colors.gold }]}
              onPress={() => setShowNewConvo(true)}
            >
              <Feather name="message-square" size={18} color="#fff" />
              <Text style={styles.newConvoBtnText}>Iniciar Nova Conexão</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

function ConversationRow({ conversation: conv, colors }: { conversation: Conversation; colors: any }) {
  const router = useRouter();
  const hasUnread = (conv.unread_count ?? 0) > 0;
  return (
    <TouchableOpacity
      style={[styles.convoRow, { borderBottomColor: colors.border, backgroundColor: "#fff" }]}
      onPress={() => router.push(`/chat/${conv.id}` as any)}
      activeOpacity={0.7}
    >
      <Avatar name={conv.participant_name} size={52} />
      <View style={styles.convoBody}>
        <View style={styles.convoTop}>
          <Text style={[styles.convoName, { color: colors.navy }]} numberOfLines={1}>{conv.participant_name}</Text>
          <Text style={[styles.convoTime, { color: colors.mutedForeground }]}>{timeAgo(conv.last_message_at)}</Text>
        </View>
        <View style={styles.convoBottom}>
          <Text
            style={[
              styles.convoMsg,
              { color: hasUnread ? colors.foreground : colors.mutedForeground },
              hasUnread && { fontWeight: "600" },
            ]}
            numberOfLines={1}
          >
            {conv.last_message ?? "Iniciar conversa"}
          </Text>
          {hasUnread && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.gold }]}>
              <Text style={[styles.unreadText, { color: colors.navy }]}>{conv.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle:   { fontSize: 26, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  newChatCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  gruposBtn:     { flexDirection: "row", alignItems: "center", gap: 5 },
  gruposBtnText: { fontSize: 15, fontWeight: "600" },

  novaConversaCard: { padding: 16, borderBottomWidth: 1, gap: 10 },
  novaConversaTitle: { fontSize: 16, fontWeight: "700" },
  userSearchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  userSearchInput: { flex: 1, fontSize: 14 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  userName: { fontSize: 14, fontWeight: "600" },
  userHeadline: { fontSize: 12 },

  searchWrap: { padding: 12 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },

  convoRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  convoBody:  { flex: 1 },
  convoTop:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  convoName:  { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  convoTime:  { fontSize: 12 },
  convoBottom:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convoMsg:   { fontSize: 13, flex: 1, marginRight: 8 },
  unreadBadge:{ minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadText: { fontSize: 11, fontWeight: "700" },

  empty:      { alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40, gap: 14 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 19, fontWeight: "800", textAlign: "center" },
  emptySub:   { fontSize: 14, textAlign: "center", lineHeight: 20 },
  newConvoBtn:{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, marginTop: 6 },
  newConvoBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
