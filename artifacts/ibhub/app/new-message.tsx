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
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";

const MOCK_CONNECTIONS = [
  { id: "u1", full_name: "Isabela Mondavi", headline: "Enóloga" },
  { id: "u2", full_name: "Rafael Borges", headline: "Importador" },
  { id: "u3", full_name: "Carolina Stein", headline: "Sommelier" },
  { id: "u4", full_name: "Marco Tulio Alves", headline: "Professor" },
];

export default function NewMessageScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = MOCK_CONNECTIONS.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Nova mensagem</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={[styles.searchBox, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Buscar conexões..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.userRow, { borderBottomColor: colors.border }]}
            onPress={() => router.replace(`/chat/${item.id}` as any)}
          >
            <Avatar name={item.full_name} size={46} />
            <View>
              <Text style={[styles.userName, { color: colors.foreground }]}>{item.full_name}</Text>
              <Text style={[styles.userHeadline, { color: colors.mutedForeground }]}>{item.headline}</Text>
            </View>
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  userName: { fontSize: 15, fontWeight: "700" },
  userHeadline: { fontSize: 12, marginTop: 2 },
});
