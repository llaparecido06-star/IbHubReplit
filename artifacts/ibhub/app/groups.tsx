import { useRouter } from "expo-router";
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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/hooks/useColors";

interface Group {
  id: string;
  name: string;
  description: string;
  type: "aberto" | "fechado" | "restrito";
  members: number;
  is_member: boolean;
  category: string;
}

const MOCK_GROUPS: Group[] = [
  { id: "g1", name: "Sommeliers Brasil", description: "Comunidade dos profissionais de serviço de vinho do Brasil", type: "aberto", members: 3240, is_member: true, category: "Profissional" },
  { id: "g2", name: "WSET Students Network", description: "Suporte e networking para estudantes WSET no Brasil", type: "fechado", members: 892, is_member: true, category: "Educação" },
  { id: "g3", name: "Investidores em Vinhos Finos", description: "Grupo exclusivo para quem investe em vinhos como ativo", type: "restrito", members: 156, is_member: false, category: "Investimento" },
  { id: "g4", name: "Enoturismo & Viagens de Vinho", description: "Compartilhe experiências e dicas de viagens enológicas", type: "aberto", members: 2100, is_member: false, category: "Turismo" },
  { id: "g5", name: "Natural Wine Club Brasil", description: "Vinhos biodinâmicos, orgânicos e naturais", type: "aberto", members: 780, is_member: false, category: "Estilo" },
  { id: "g6", name: "Produtores do Sul do Brasil", description: "Serra Gaúcha, Santa Catarina e Paraná: a nova fronteira", type: "fechado", members: 340, is_member: false, category: "Produção" },
];

export default function GroupsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState(MOCK_GROUPS);
  const [filter, setFilter] = useState("todos");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const FILTERS = ["todos", "meus", "aberto", "fechado"];

  const filtered = groups.filter((g) => {
    if (filter === "meus") return g.is_member;
    if (filter === "aberto") return g.type === "aberto";
    if (filter === "fechado") return g.type === "fechado";
    return true;
  });

  const toggleMembership = (id: string) => {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, is_member: !g.is_member, members: g.is_member ? g.members - 1 : g.members + 1 } : g));
  };

  const typeVariants: Record<string, any> = {
    aberto: "success",
    fechado: "default",
    restrito: "wine",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Grupos</Text>
        <TouchableOpacity>
          <Feather name="plus" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(f) => f}
        renderItem={({ item: f }) => (
          <Pressable
            style={[styles.filterBtn, { backgroundColor: filter === f ? colors.navy : colors.secondary, borderRadius: 20 }]}
            onPress={() => setFilter(f)}
          >
            <Text style={{ color: filter === f ? colors.gold : colors.foreground, fontSize: 13, fontWeight: "700" }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        )}
        style={{ maxHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        showsHorizontalScrollIndicator={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupIcon, { backgroundColor: colors.navyMid }]}>
                <Feather name="users" size={22} color={colors.gold} />
              </View>
              <View style={styles.groupInfo}>
                <Text style={[styles.groupName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.groupMeta}>
                  <Badge label={item.type} variant={typeVariants[item.type] ?? "default"} size="sm" />
                  <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>
                    {item.members.toLocaleString()} membros
                  </Text>
                </View>
              </View>
              <Badge label={item.category} variant="gold" size="sm" />
            </View>
            <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.description}
            </Text>
            <Button
              title={item.is_member ? "Participando" : item.type === "restrito" ? "Solicitar acesso" : "Participar"}
              onPress={() => toggleMembership(item.id)}
              variant={item.is_member ? "outline" : "gold"}
              size="sm"
              style={{ alignSelf: "flex-start", marginTop: 4 }}
            />
          </View>
        )}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum grupo encontrado
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  filterBtn: { paddingVertical: 7, paddingHorizontal: 16 },
  groupCard: { borderWidth: 1, padding: 16, gap: 10 },
  groupHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  groupIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  groupInfo: { flex: 1, gap: 4 },
  groupName: { fontSize: 15, fontWeight: "700" },
  groupMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberCount: { fontSize: 12 },
  description: { fontSize: 13, lineHeight: 19 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
