import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { fetchUserListForModal, UserListItem } from "@/services/api";

export type UserListType = "followers" | "following" | "connections";

interface UserListModalProps {
  visible: boolean;
  type: UserListType | null;
  userId: string | null;
  onClose: () => void;
}

const TITLES: Record<UserListType, string> = {
  followers: "Seguidores",
  following: "Seguindo",
  connections: "Conexões",
};

const EMPTY_MESSAGES: Record<UserListType, string> = {
  followers: "Nenhum seguidor ainda.",
  following: "Não está seguindo ninguém ainda.",
  connections: "Nenhuma conexão ainda.",
};

export function UserListModal({ visible, type, userId, onClose }: UserListModalProps) {
  const colors = useColors();
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !type || !userId) {
      setUsers([]);
      return;
    }
    setLoading(true);
    fetchUserListForModal(userId, type).then(list => {
      setUsers(list);
      setLoading(false);
    }).catch(() => {
      setUsers([]);
      setLoading(false);
    });
  }, [visible, type, userId]);

  const resolvedTitle = type ? TITLES[type] : "";
  const emptyMessage = type ? EMPTY_MESSAGES[type] : "";

  const handleUserPress = (id: string) => {
    onClose();
    router.push(`/profile/${id}` as any);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: "#fff" }]} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.navy }]}>{resolvedTitle}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={colors.navy} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.gold} />
            </View>
          ) : users.length === 0 ? (
            <View style={styles.centered}>
              <Feather name="users" size={36} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{emptyMessage}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
              {users.map(u => {
                const displayName = u.full_name ?? u.username ?? "Usuário";
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.userRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleUserPress(u.id)}
                    activeOpacity={0.75}
                  >
                    <Avatar uri={u.avatar_url} name={displayName} size={44} />
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.navy }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      {u.username ? (
                        <Text style={[styles.userHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
                          @{u.username}
                        </Text>
                      ) : null}
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
  },
  userHandle: {
    fontSize: 13,
  },
});
