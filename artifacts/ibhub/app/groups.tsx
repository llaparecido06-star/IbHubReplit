import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { Group, fetchGroups, joinGroup, leaveGroup } from "@/services/api";

type AccessType = "aberto" | "fechado" | "restrito";

const CATEGORIES = ["Todos", "Exportação", "Sommelier", "Produção", "Importação", "Enoturismo", "Marketing", "Outros"];
const ACCESS_ICON: Record<AccessType, any> = { aberto: "globe", fechado: "lock", restrito: "shield" };
const ACCESS_LABEL: Record<AccessType, string> = { aberto: "Aberto", fechado: "Fechado", restrito: "Restrito" };

export default function GroupsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const userId = profile?.id ?? user?.id ?? "";

  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("Todos");
  const [myGroups, setMyGroups]     = useState<Group[]>([]);
  const [exploreGroups, setExplore] = useState<Group[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbError, setDbError]       = useState(false);
  const realtimeRef                 = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (!isRefresh) setLoading(true);
    try {
      const { mine, explore } = await fetchGroups(userId);
      setMyGroups(mine);
      setExplore(explore);
      setDbError(false);
    } catch {
      setDbError(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh list on group membership changes
  useEffect(() => {
    if (!userId || realtimeRef.current) return;
    const ch = supabase
      .channel(`groups-realtime:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        load(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => {
        load(true);
      })
      .subscribe();
    realtimeRef.current = ch;
    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
        realtimeRef.current = null;
      }
    };
  }, [userId, load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const filter = (g: Group) => {
    if (category !== "Todos" && g.category !== category) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  const filteredMine    = myGroups.filter(filter);
  const filteredExplore = exploreGroups.filter(filter);

  const handleJoin = async (g: Group) => {
    const ok = await joinGroup(g.id, userId);
    if (ok) {
      Alert.alert("✅ Você entrou!", `Bem-vindo ao grupo "${g.name}".`);
      load();
    } else {
      Alert.alert("Erro", "Não foi possível entrar no grupo.");
    }
  };

  const handleLeave = (g: Group) => {
    Alert.alert("Sair do grupo", `Tem certeza que deseja sair de "${g.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair", style: "destructive", onPress: async () => {
          const ok = await leaveGroup(g.id, userId);
          if (ok) load();
          else Alert.alert("Erro", "Não foi possível sair do grupo.");
        }
      },
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

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* DB Error */}
        {dbError && (
          <View style={[styles.errorBanner, { backgroundColor: "#fff7ed", borderColor: "#fdba74" }]}>
            <Text style={{ fontSize: 13, color: "#9a3412" }}>⚠️ Tabela de grupos não encontrada. Execute a migração no Supabase.</Text>
          </View>
        )}

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

        {loading ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Carregando grupos… 🍷</Text>
          </View>
        ) : (
          <>
            {/* MEUS GRUPOS */}
            {filteredMine.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MEUS GRUPOS</Text>
                {filteredMine.map((g) => (
                  <GroupCard key={g.id} group={g} colors={colors} router={router} onLeave={() => handleLeave(g)} />
                ))}
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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 }}>
                          {g.avatar_url ? (
                            <Image source={{ uri: g.avatar_url }} style={styles.groupAvatar} />
                          ) : (
                            <Avatar name={g.name} size={38} />
                          )}
                          <Text style={[styles.cardName, { color: colors.navy }]}>{g.name}</Text>
                        </View>
                        <View style={styles.cardChips}>
                          <View style={[styles.chip2, { backgroundColor: colors.background }]}>
                            <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{g.category}</Text>
                          </View>
                          <View style={[styles.chip2, { backgroundColor: colors.background }]}>
                            <Feather name={ACCESS_ICON[g.access as AccessType]} size={11} color={colors.mutedForeground} />
                            <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{ACCESS_LABEL[g.access as AccessType]}</Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.joinBtn, { backgroundColor: colors.gold }]}
                        onPress={() => handleJoin(g)}
                      >
                        <Text style={styles.joinBtnText}>Participar</Text>
                      </TouchableOpacity>
                    </View>
                    {g.description && (
                      <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{g.description}</Text>
                    )}
                    <View style={styles.cardMembers}>
                      <Feather name="users" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.cardMembersText, { color: colors.mutedForeground }]}>
                        {(g.member_count ?? 0).toLocaleString("pt-BR")} {g.member_count !== 1 ? "membros" : "membro"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {filteredMine.length === 0 && filteredExplore.length === 0 && (
              <View style={styles.empty}>
                <Feather name="users" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {search || category !== "Todos" ? "Nenhum grupo encontrado" : "Ainda não há grupos"}
                </Text>
                {!search && category === "Todos" && (
                  <TouchableOpacity
                    style={[styles.newBtn, { backgroundColor: colors.gold, marginTop: 16 }]}
                    onPress={() => router.push("/new-group" as any)}
                  >
                    <Feather name="plus" size={15} color="#fff" />
                    <Text style={styles.newBtnText}>Criar grupo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function GroupCard({ group: g, colors, router, onLeave }: { group: Group; colors: any; router: any; onLeave: () => void }) {
  const access = g.access as AccessType;
  return (
    <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 }}>
            {g.avatar_url ? (
              <Image source={{ uri: g.avatar_url }} style={styles.groupAvatar} />
            ) : (
              <Avatar name={g.name} size={38} />
            )}
            <Text style={[styles.cardName, { color: colors.navy }]}>{g.name}</Text>
          </View>
          <View style={styles.cardChips}>
            <View style={[styles.chip2, { backgroundColor: colors.background }]}>
              <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{g.category}</Text>
            </View>
            <View style={[styles.chip2, { backgroundColor: colors.background }]}>
              <Feather name={ACCESS_ICON[access]} size={11} color={colors.mutedForeground} />
              <Text style={[styles.chip2Text, { color: colors.mutedForeground }]}>{ACCESS_LABEL[access]}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.openChatBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push(`/group-chat/${g.id}`)}
          >
            <Text style={styles.openChatText}>Chat</Text>
          </TouchableOpacity>
          {g.is_owner && (
            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: colors.border }]}
              onPress={() => router.push(`/group-settings/${g.id}`)}
            >
              <Text style={[styles.manageBtnText, { color: colors.navy }]}>Gerenciar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.leaveRow} onPress={onLeave}>
            <Feather name="log-out" size={13} color={colors.mutedForeground} />
            <Text style={[styles.leaveText, { color: colors.mutedForeground }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>
      {g.description && (
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{g.description}</Text>
      )}
      <View style={styles.cardMembers}>
        <Feather name="users" size={13} color={colors.mutedForeground} />
        <Text style={[styles.cardMembersText, { color: colors.mutedForeground }]}>
          {(g.member_count ?? 0).toLocaleString("pt-BR")} {g.member_count !== 1 ? "membros" : "membro"}
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
  errorBanner: { margin: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
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
  groupAvatar: { width: 38, height: 38, borderRadius: 19 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 24 },
  emptyText: { fontSize: 15, textAlign: "center" },
});
