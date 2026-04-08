import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { BlockedUser, fetchBlockedUsers, unblockUser } from "@/services/api";

export default function BlockedUsersScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [unblocking, setUnblocking] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(false);
    try {
      const data = await fetchBlockedUsers(profile.id);
      setBlocked(data);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const handleUnblock = (item: BlockedUser) => {
    Alert.alert(
      "Desbloquear usuário",
      `Deseja desbloquear ${item.full_name ?? item.username ?? "este usuário"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desbloquear",
          onPress: async () => {
            if (!profile?.id) return;
            setUnblocking((prev) => new Set(prev).add(item.blocked_id));
            const ok = await unblockUser(profile.id, item.blocked_id);
            if (ok) {
              setBlocked((prev) => prev.filter((b) => b.blocked_id !== item.blocked_id));
            } else {
              Alert.alert("Erro", "Não foi possível desbloquear. Tente novamente.");
            }
            setUnblocking((prev) => {
              const next = new Set(prev);
              next.delete(item.blocked_id);
              return next;
            });
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const initial = (item.full_name ?? item.username ?? "?").charAt(0).toUpperCase();
    const isUnblocking = unblocking.has(item.blocked_id);
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: colors.navy }]}>
            <Text style={[styles.avatarInitial, { color: colors.gold }]}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.navy }]} numberOfLines={1}>
            {item.full_name ?? item.username ?? "Usuário"}
          </Text>
          {item.username ? (
            <Text style={[styles.username, { color: colors.mutedForeground }]} numberOfLines={1}>
              @{item.username}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.unblockBtn, { borderColor: colors.navy }]}
          onPress={() => handleUnblock(item)}
          disabled={isUnblocking}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color={colors.navy} />
          ) : (
            <Text style={[styles.unblockText, { color: colors.navy }]}>Desbloquear</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Usuários Bloqueados</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.navy} />
        </View>
      ) : fetchError ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Erro ao carregar a lista</Text>
          <TouchableOpacity onPress={load} style={[styles.retryBtn, { borderColor: colors.navy }]}>
            <Text style={[styles.retryText, { color: colors.navy }]}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.center}>
          <Feather name="slash" size={56} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum usuário bloqueado</Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.blocked_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:    { fontSize: 20, fontWeight: "700" },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText:      { fontSize: 15 },
  retryBtn:       { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, marginTop: 4 },
  retryText:      { fontSize: 14, fontWeight: "600" },
  list:           { paddingHorizontal: 16, paddingVertical: 8 },
  row:            { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  avatar:         { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarInitial:  { fontSize: 18, fontWeight: "800" },
  name:           { fontSize: 15, fontWeight: "600" },
  username:       { fontSize: 13, marginTop: 2 },
  unblockBtn:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, minWidth: 100, alignItems: "center" },
  unblockText:    { fontSize: 13, fontWeight: "600" },
});
