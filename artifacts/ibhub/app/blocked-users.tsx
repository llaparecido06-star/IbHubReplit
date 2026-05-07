import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { BlockedUser, fetchBlockedUsers, unblockUser } from "@/services/api";
import { Avatar } from "@/components/ui/Avatar";

export default function BlockedUsersScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
    const displayName = item.full_name ?? item.username ?? t("common.others");
    Alert.alert(
      t("blocked_users.unblock_title"),
      t("blocked_users.unblock_msg", { name: displayName }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("blocked_users.unblock_btn"),
          onPress: async () => {
            if (!profile?.id) return;

            const originalBlocked = [...blocked];
            setBlocked((prev) => prev.filter((b) => b.id !== item.id));
            setUnblocking((prev) => new Set(prev).add(item.id));

            try {
              const ok = await unblockUser(profile.id, item.id);
              if (!ok) throw new Error("Failed to unblock");
            } catch {
              setBlocked(originalBlocked);
              Alert.alert(t("common.error"), t("blocked_users.error"));
            } finally {
              setUnblocking((prev) => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
              });
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const isUnblocking = unblocking.has(item.id);
    return (
      <View style={[styles.userRow, { borderBottomColor: colors.border }]}>
        <Avatar uri={item.avatar_url} name={item.full_name ?? undefined} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.userName, { color: colors.navy }]} numberOfLines={1}>
            {item.full_name ?? item.username ?? t("common.others")}
          </Text>
          {item.username ? (
            <Text style={[styles.userHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
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
            <Text style={[styles.unblockText, { color: colors.navy }]}>{t("blocked_users.unblock")}</Text>
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
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("blocked_users.title")}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : fetchError ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("blocked_users.load_error")}</Text>
          <TouchableOpacity onPress={load} style={[styles.retryBtn, { borderColor: colors.navy }]}>
            <Text style={[styles.retryText, { color: colors.navy }]}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="slash" size={56} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("blocked_users.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  empty:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText:   { fontSize: 15 },
  retryBtn:    { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, marginTop: 4 },
  retryText:   { fontSize: 14, fontWeight: "600" },
  list:        { paddingVertical: 8 },
  userRow:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  userName:    { fontSize: 15, fontWeight: "600" },
  userHandle:  { fontSize: 13, marginTop: 2 },
  unblockBtn:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, minWidth: 100, alignItems: "center" },
  unblockText: { fontSize: 13, fontWeight: "600" },
});
