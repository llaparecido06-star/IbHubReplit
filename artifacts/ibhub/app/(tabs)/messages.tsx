import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { AppConversation } from "@/services/api";

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

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [convos, setConvos]             = useState<AppConversation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState("");
  const [userSearch, setUserSearch]     = useState("");
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string; avatar_url: string | null; headline: string | null }[]>([]);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const data = await API.fetchConversations(user.id);
    setConvos(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userSearch.trim() || !user?.id) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      const results = await API.searchProfiles(userSearch, user.id);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(timeout);
  }, [userSearch, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleStartChat = async (targetUserId: string) => {
    if (!user?.id || startingChat) return;
    setStartingChat(targetUserId);
    const conversationId = await API.getOrCreateDirectConversation(user.id, targetUserId);
    setStartingChat(null);
    setShowNewConvo(false);
    if (conversationId) router.push(`/chat/${conversationId}` as any);
  };

  const filtered = convos.filter((c) => {
    if (!search) return true;
    const name = c.name ?? c.participant?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

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
              {searchResults.length === 0 && (
                <Text style={[styles.userHeadline, { color: colors.mutedForeground, paddingVertical: 8, textAlign: "center" }]}>
                  Nenhum usuário encontrado
                </Text>
              )}
              {searchResults.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userRow}
                  onPress={() => handleStartChat(u.id)}
                  disabled={startingChat === u.id}
                >
                  <Avatar uri={u.avatar_url} name={u.full_name} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: colors.navy }]}>{u.full_name}</Text>
                    {!!u.headline && (
                      <Text style={[styles.userHeadline, { color: colors.mutedForeground }]} numberOfLines={1}>{u.headline}</Text>
                    )}
                  </View>
                  {startingChat === u.id && <ActivityIndicator size="small" color={colors.gold} />}
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
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationRow conversation={item} colors={colors} />}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
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
      )}
    </View>
  );
}

function ConversationRow({ conversation: conv, colors }: { conversation: AppConversation; colors: any }) {
  const router = useRouter();
  const hasUnread = (conv.unread_count ?? 0) > 0;
  const name = conv.name ?? conv.participant?.full_name ?? "Chat";
  const avatarUri = conv.participant?.avatar_url ?? null;

  return (
    <TouchableOpacity
      style={[styles.convoRow, { borderBottomColor: colors.border, backgroundColor: "#fff" }]}
      onPress={() => router.push(`/chat/${conv.id}` as any)}
      activeOpacity={0.7}
    >
      <Avatar uri={avatarUri} name={name} size={52} />
      <View style={styles.convoBody}>
        <View style={styles.convoTop}>
          <Text style={[styles.convoName, { color: colors.navy }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.convoTime, { color: colors.mutedForeground }]}>{timeAgo(conv.last_message_at ?? undefined)}</Text>
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
