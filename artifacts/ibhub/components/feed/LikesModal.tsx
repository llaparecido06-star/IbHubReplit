import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { LikeUser } from "@/services/api";

interface Props {
  postId: string | null;
  likesCount: number;
  visible: boolean;
  onClose: () => void;
}

export function LikesModal({ postId, likesCount, visible, onClose }: Props) {
  const colors = useColors();
  const router = useRouter();
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !postId) return;
    setLoading(true);
    API.fetchPostLikes(postId).then(data => {
      setUsers(data);
      setLoading(false);
    });
  }, [visible, postId]);

  const handleUserPress = (user: LikeUser) => {
    onClose();
    if (user.company_page_id) {
      router.push(`/empresa/${user.company_page_id}` as any);
    } else {
      router.push(`/profile/${user.id}` as any);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <Feather name="heart" size={18} color="#e74c3c" />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {likesCount} {likesCount === 1 ? "curtida" : "curtidas"}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.center}>
            <Feather name="heart" size={32} color={colors.border} />
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              Nenhuma curtida ainda
            </Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item, idx) => `${item.id}_${item.company_page_id ?? "personal"}_${idx}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => handleUserPress(item)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrap}>
                  <Avatar uri={item.avatar_url} name={item.full_name} size={44} />
                  {item.company_page_id && (
                    <View style={[styles.companyBadge, { backgroundColor: colors.gold }]}>
                      <Feather name="briefcase" size={8} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={styles.info}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                      {item.full_name}
                    </Text>
                    {item.reaction_type ? (
                      <Text style={{ fontSize: 15 }}>
                        {item.reaction_type === "saude" ? "🍷" : item.reaction_type === "bravo" ? "👏" : item.reaction_type === "destaque" ? "⭐" : item.reaction_type === "incrivel" ? "🔥" : "❤️"}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 13 }}>❤️</Text>
                    )}
                  </View>
                  {item.headline ? (
                    <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.headline}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={16} color={colors.border} />
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:        { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75%", minHeight: 200 },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 6 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft:   { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:  { fontSize: 17, fontWeight: "700" },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 120, gap: 10 },
  empty:        { fontSize: 14 },
  row:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  avatarWrap:   { position: "relative" },
  companyBadge: { position: "absolute", bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" },
  info:         { flex: 1, gap: 2 },
  name:         { fontSize: 15, fontWeight: "700" },
  headline:     { fontSize: 12 },
});
