import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";

type AccessType = "aberto" | "fechado" | "restrito";

interface Group {
  id: string;
  name: string;
  category: string;
  access: AccessType;
  members: number;
  description: string;
  is_owner?: boolean;
  is_member: boolean;
}

const MY_GROUPS: Group[] = [
  { id: "g1", name: "Enoturismo", category: "Enoturismo", access: "aberto",  members: 2,   description: "Turismo e experiências no mundo do vinho", is_owner: false, is_member: true },
  { id: "g2", name: "Teste 2",    category: "Importação", access: "fechado", members: 1,   description: "fejifejn", is_owner: true, is_member: true },
];

const EXPLORE_GROUPS: Group[] = [
  { id: "g3", name: "Sommeliers Brasil",   category: "Sommelier",  access: "aberto", members: 1240, description: "Comunidade nacional de sommeliers certificados e em formação.", is_member: false },
  { id: "g4", name: "Exportadores do Sul", category: "Exportação", access: "aberto", members: 340,  description: "Profissionais de exportação de vinhos do Sul do Brasil.", is_member: false },
  { id: "g5", name: "Vinhos Naturais BR",  category: "Produção",   access: "aberto", members: 580,  description: "Produtores e entusiastas de vinhos naturais e biodinâmicos.", is_member: false },
];

const CATEGORIES = ["Todos", "Exportação", "Sommelier", "Produção", "Importação", "Enoturismo", "Marketing", "Outros"];

const ACCESS_ICON: Record<AccessType, any> = { aberto: "globe", fechado: "lock", restrito: "shield" };
const ACCESS_LABEL: Record<AccessType, string> = { aberto: "Aberto", fechado: "Fechado", restrito: "Restrito" };

export default function GroupsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("Todos");
  const [myGroups, setMyGroups] = useState(MY_GROUPS);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const filter = (g: Group) => {
    if (category !== "Todos" && g.category !== category) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  const filteredMine    = myGroups.filter(filter);
  const filteredExplore = EXPLORE_GROUPS.filter(filter);

  const handleLeave = (id: string) => {
    Alert.alert("Sair do grupo", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => setMyGroups((g) => g.filter((gr) => gr.id !== id)) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Grupos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.gold }]}
          onPress={() => router.push("/new-group" as any)}
        >
          <Feather name="plus" size={15} color="#fff" />
          <Text style={styles.newBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: "#fff" }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Buscar grupos..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, { backgroundColor: category === cat ? colors.gold : colors.background }]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.chipText, { color: category === cat ? "#fff" : colors.mutedForeground }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* MEUS GRUPOS */}
        {filteredMine.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MEUS GRUPOS</Text>
            {filteredMine.map((g) => <GroupCard key={g.id} group={g} colors={colors} router={router} onLeave={handleLeave} />)}
          </View>
        )}

        {/* EXPLORAR */}
        {filteredExplore.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EXPLORAR</Text>
            {filteredExplore.map((g) => (
              <View key={g.id} style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardName, { color: colors.navy }]}>{g.name}</Text>
                    <View style={[styles.chip2, { backgroundColor: colors.background }]}>
                      <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{g.category}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.joinBtn, { backgroundColor: colors.gold }]}
                    onPress={() => Alert.alert("Participando!", "Você entrou no grupo.")}
                  >
                    <Text style={styles.joinBtnText}>Participar</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{g.description}</Text>
                <View style={styles.cardMembers}>
                  <Feather name="users" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.cardMembersText, { color: colors.mutedForeground }]}>
                    {g.members.toLocaleString("pt-BR")} membros
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {filteredMine.length === 0 && filteredExplore.length === 0 && (
          <View style={styles.empty}>
            <Feather name="users" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum grupo encontrado</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function GroupCard({ group: g, colors, router, onLeave }: any) {
  return (
    <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardName, { color: colors.navy }]}>{g.name}</Text>
          <View style={styles.cardChips}>
            <View style={[styles.chip2, { backgroundColor: colors.background }]}>
              <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{g.category}</Text>
            </View>
            <View style={[styles.chip2, { backgroundColor: colors.background }]}>
              <Feather name={ACCESS_ICON[g.access as "aberto"]} size={11} color={colors.mutedForeground} />
              <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{ACCESS_LABEL[g.access as "aberto"]}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.openChatBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push(`/group-chat/${g.id}`)}
          >
            <Text style={styles.openChatText}>Abrir Chat</Text>
          </TouchableOpacity>
          {g.is_owner && (
            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: colors.border }]}
              onPress={() => router.push(`/group-settings/${g.id}`)}
            >
              <Text style={[styles.manageBtnText, { color: colors.navy }]}>Gerenciar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.leaveRow} onPress={() => onLeave(g.id)}>
            <Feather name="log-out" size={13} color={colors.mutedForeground} />
            <Text style={[styles.leaveText, { color: colors.mutedForeground }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{g.description}</Text>
      <View style={styles.cardMembers}>
        <Feather name="users" size={13} color={colors.mutedForeground} />
        <Text style={[styles.cardMembersText, { color: colors.mutedForeground }]}>
          {g.members} {g.members === 1 ? "membro" : "membros"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  searchWrap: { padding: 12 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: "600" },
  section: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  cardMeta: { flex: 1, gap: 6 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip2: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chip2Text: { fontSize: 12 },
  cardActions: { alignItems: "flex-end", gap: 6 },
  openChatBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  openChatText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  joinBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  joinBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  manageBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  manageBtnText: { fontSize: 13, fontWeight: "600" },
  leaveRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  leaveText: { fontSize: 13 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardMembers: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardMembersText: { fontSize: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
