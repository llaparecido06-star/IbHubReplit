import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { UserCard, UserSummary } from "@/components/network/UserCard";
import { Badge } from "@/components/ui/Badge";
import { useColors } from "@/hooks/useColors";

const TRENDING_HASHTAGS = [
  { tag: "vinho", count: "2.4k" },
  { tag: "sommelier", count: "1.8k" },
  { tag: "harvest2025", count: "956" },
  { tag: "enoturismo", count: "732" },
  { tag: "barolo", count: "621" },
  { tag: "douro", count: "589" },
  { tag: "champagne", count: "445" },
  { tag: "wset", count: "382" },
];

const MOCK_USERS: UserSummary[] = [
  { id: "u1", full_name: "Isabela Mondavi", headline: "Enóloga | Vinhedo Santa Clara", plan: "executivo" },
  { id: "u2", full_name: "Rafael Borges", headline: "Importador de Vinhos Europeus", plan: "basico" },
  { id: "u3", full_name: "Carolina Stein", headline: "Sommelier | Hotel Grand Plaza", plan: "executivo" },
];

type SearchTab = "tudo" | "pessoas" | "hashtags" | "grupos";

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("tudo");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filteredUsers = MOCK_USERS.filter((u) =>
    u.full_name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar pessoas, hashtags, grupos..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.foreground, fontSize: 15 }}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["tudo", "pessoas", "hashtags", "grupos"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && [styles.activeTab, { borderBottomColor: colors.gold }]]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.gold : colors.mutedForeground }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {!query ? (
        <View style={styles.trending}>
          <Text style={[styles.trendingTitle, { color: colors.foreground }]}>Em alta</Text>
          {TRENDING_HASHTAGS.map((item) => (
            <TouchableOpacity
              key={item.tag}
              style={[styles.trendRow, { borderBottomColor: colors.border }]}
            >
              <View style={[styles.trendIcon, { backgroundColor: colors.gold + "20" }]}>
                <Text style={{ color: colors.gold, fontSize: 16, fontWeight: "800" }}>#</Text>
              </View>
              <View style={styles.trendInfo}>
                <Text style={[styles.trendTag, { color: colors.foreground }]}>#{item.tag}</Text>
                <Text style={[styles.trendCount, { color: colors.mutedForeground }]}>
                  {item.count} publicações
                </Text>
              </View>
              <Feather name="trending-up" size={16} color={colors.gold} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <UserCard user={item} compact />}
          contentContainerStyle={{ paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="search" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nenhum resultado para "{query}"
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: {},
  tabText: { fontSize: 13, fontWeight: "700" },
  trending: { padding: 16, gap: 4 },
  trendingTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  trendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 14, borderBottomWidth: 1 },
  trendIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  trendInfo: { flex: 1 },
  trendTag: { fontSize: 15, fontWeight: "700" },
  trendCount: { fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
