import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { UserCard, UserSummary } from "@/components/network/UserCard";
import { Badge } from "@/components/ui/Badge";
import { useColors } from "@/hooks/useColors";

const MOCK_RECOMMENDATIONS: UserSummary[] = [
  {
    id: "u1",
    full_name: "Isabela Mondavi",
    username: "isamondavi",
    headline: "Enóloga | Vinhedo Santa Clara",
    plan: "executivo",
    mutual_connections: 5,
    areas_of_expertise: ["Enologia", "Tinto"],
  },
  {
    id: "u2",
    full_name: "Rafael Borges",
    username: "rafaborges",
    headline: "Importador de Vinhos Europeus",
    plan: "basico",
    mutual_connections: 2,
    areas_of_expertise: ["Importação", "França"],
  },
  {
    id: "u3",
    full_name: "Carolina Stein",
    username: "carolstein",
    headline: "Sommelier | Hotel Grand Plaza",
    plan: "executivo",
    mutual_connections: 8,
    areas_of_expertise: ["Sommelier", "WSET"],
  },
  {
    id: "u4",
    full_name: "Marco Tulio Alves",
    username: "marcoalves",
    headline: "Professor de Enogastronomia | SENAC",
    plan: "basico",
    mutual_connections: 3,
    areas_of_expertise: ["Educação", "Harmonização"],
  },
];

const MOCK_REQUESTS: UserSummary[] = [
  {
    id: "r1",
    full_name: "Fernanda Castro",
    username: "fcastro",
    headline: "Wine Blogger | Vinho & Cultura",
    mutual_connections: 4,
  },
  {
    id: "r2",
    full_name: "Henrique Dias",
    username: "hdias",
    headline: "Diretor Comercial | Adegas Premium",
    mutual_connections: 1,
  },
];

const SECTIONS = [
  { key: "pessoas", label: "Pessoas" },
  { key: "grupos", label: "Grupos" },
  { key: "eventos", label: "Eventos" },
  { key: "empresas", label: "Empresas" },
];

export default function NetworkScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState("pessoas");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 + 34 : 84 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Rede</Text>
        <TouchableOpacity onPress={() => router.push("/search" as any)}>
          <Feather name="search" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.sectionBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}
        contentContainerStyle={styles.sectionBarContent}
      >
        {SECTIONS.map((s) => (
          <Pressable
            key={s.key}
            style={[
              styles.sectionBtn,
              section === s.key && { backgroundColor: colors.navy },
            ]}
            onPress={() => setSection(s.key)}
          >
            <Text style={[
              styles.sectionBtnText,
              { color: section === s.key ? colors.gold : colors.foreground },
            ]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={MOCK_RECOMMENDATIONS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserCard user={item} onConnect={(id) => console.log("connect", id)} />
        )}
        ListHeaderComponent={() => (
          <>
            {MOCK_REQUESTS.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Pedidos de conexão
                  </Text>
                  <Badge label={String(MOCK_REQUESTS.length)} variant="gold" />
                </View>
                {MOCK_REQUESTS.map((user) => (
                  <View key={user.id} style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <UserCard user={user} compact />
                    <View style={styles.requestActions}>
                      <Pressable style={[styles.acceptBtn, { backgroundColor: colors.gold }]}>
                        <Text style={{ color: colors.navy, fontWeight: "700", fontSize: 13 }}>Aceitar</Text>
                      </Pressable>
                      <Pressable style={[styles.rejectBtn, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Ignorar</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Pessoas que você pode conhecer
              </Text>
            </View>
          </>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
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
  sectionBar: { borderBottomWidth: 1, maxHeight: 52 },
  sectionBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  sectionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  sectionBtnText: { fontSize: 13, fontWeight: "700" },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  section: { marginBottom: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  requestCard: { borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  requestActions: { flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingBottom: 12 },
  acceptBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8 },
  rejectBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8, borderWidth: 1.5 },
});
