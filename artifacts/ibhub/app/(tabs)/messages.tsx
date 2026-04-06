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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Conversation, ConversationRow } from "@/components/messaging/ConversationRow";
import { useColors } from "@/hooks/useColors";

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: "c1", participant_name: "Isabela Mondavi",       last_message: "Você vai ao evento de quinta-feira?", last_message_at: new Date(Date.now() - 300000).toISOString(),    unread_count: 3 },
  { id: "c2", participant_name: "Rafael Borges",          last_message: "Tenho amostras do novo Malbec argentino", last_message_at: new Date(Date.now() - 3600000).toISOString(),   unread_count: 0 },
  { id: "c3", participant_name: "Grupo Sommeliers Brasil", last_message: "Maria: Alguém recomenda fornecedores?", last_message_at: new Date(Date.now() - 7200000).toISOString(),   unread_count: 12, is_group: true },
  { id: "c4", participant_name: "Carolina Stein",          last_message: "Obrigada pela indicação!",            last_message_at: new Date(Date.now() - 86400000).toISOString(),  unread_count: 0 },
  { id: "c5", participant_name: "Marco Tulio Alves",       last_message: "Podemos marcar uma reunião?",         last_message_at: new Date(Date.now() - 172800000).toISOString(), unread_count: 1 },
];

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todas" | "grupos">("todas");

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const filtered = MOCK_CONVERSATIONS.filter((c) => {
    if (tab === "grupos" && !c.is_group) return false;
    if (search) return c.participant_name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const isEmpty = filtered.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Mensagens</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.newChatBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/new-message" as any)}
          >
            <Feather name="message-square" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/groups" as any)}>
            <View style={styles.groupsBtn}>
              <Feather name="users" size={16} color={colors.navy} />
              <Text style={[styles.groupsBtnText, { color: colors.navy }]}>Grupos</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: "#fff" }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.background, borderRadius: 10 }]}>
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

      {isEmpty ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.gold + "18" }]}>
            <Feather name="message-circle" size={36} color={colors.gold} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.navy }]}>O brinde começa com um "Olá"</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Inicie uma conversa com alguém da comunidade
          </Text>
          <TouchableOpacity
            style={[styles.newConvoBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/new-message" as any)}
          >
            <Feather name="message-square" size={18} color="#fff" />
            <Text style={styles.newConvoBtnText}>Iniciar Nova Conexão</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationRow conversation={item} />}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  groupsBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  groupsBtnText: { fontSize: 15, fontWeight: "600" },
  searchWrap: { padding: 12, paddingTop: 10 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 19, fontWeight: "800", textAlign: "center" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  newConvoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 6,
  },
  newConvoBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
