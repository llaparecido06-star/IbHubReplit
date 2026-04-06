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
  {
    id: "c1",
    participant_name: "Isabela Mondavi",
    last_message: "Você vai ao evento de quinta-feira?",
    last_message_at: new Date(Date.now() - 300000).toISOString(),
    unread_count: 3,
  },
  {
    id: "c2",
    participant_name: "Rafael Borges",
    last_message: "Tenho amostras do novo Malbec argentino",
    last_message_at: new Date(Date.now() - 3600000).toISOString(),
    unread_count: 0,
  },
  {
    id: "c3",
    participant_name: "Grupo Sommeliers Brasil",
    last_message: "Maria: Alguém recomenda fornecedores de Champagne?",
    last_message_at: new Date(Date.now() - 7200000).toISOString(),
    unread_count: 12,
    is_group: true,
  },
  {
    id: "c4",
    participant_name: "Carolina Stein",
    last_message: "Obrigada pela indicação!",
    last_message_at: new Date(Date.now() - 86400000).toISOString(),
    unread_count: 0,
  },
  {
    id: "c5",
    participant_name: "Marco Tulio Alves",
    last_message: "Podemos marcar uma reunião essa semana?",
    last_message_at: new Date(Date.now() - 172800000).toISOString(),
    unread_count: 1,
  },
  {
    id: "c6",
    participant_name: "Fernanda Castro",
    last_message: "Vi seu post sobre o Alentejo, incrível!",
    last_message_at: new Date(Date.now() - 259200000).toISOString(),
    unread_count: 0,
  },
];

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todas" | "grupos">("todas");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 + 34 : 84 + insets.bottom;

  const filtered = MOCK_CONVERSATIONS.filter((c) => {
    if (tab === "grupos" && !c.is_group) return false;
    if (search) return c.participant_name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Mensagens</Text>
        <TouchableOpacity onPress={() => router.push("/new-message" as any)}>
          <Feather name="edit" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Buscar conversas..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["todas", "grupos"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && [styles.activeTab, { borderBottomColor: colors.gold }]]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.gold : colors.mutedForeground }]}>
              {t === "todas" ? "Todas" : "Grupos"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma conversa encontrada
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
  headerTitle: { fontSize: 24, fontWeight: "800" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {},
  tabText: { fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
