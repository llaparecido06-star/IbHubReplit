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
import { fetchBookmarkedPosts, toggleBookmark } from "@/services/api";
import { PostCard, Post } from "@/components/feed/PostCard";

export default function SalvosScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    setFetchError(false);
    try {
      const data = await fetchBookmarkedPosts(user.id);
      setPosts(data);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleBookmark = async (postId: string) => {
    if (!user?.id) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const snapshot = posts;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await toggleBookmark(postId, user.id, true);
    } catch {
      setPosts(snapshot);
      Alert.alert(t("common.error"), t("saved.error"));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("saved.title")}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : fetchError ? (
        <View style={styles.empty}>
          <Feather name="alert-circle" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.navy }]}>{t("saved.load_error")}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={[styles.emptySub, { color: colors.gold }]}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="bookmark" size={56} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.navy }]}>{t("saved.empty")}</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            {t("saved.empty_sub")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={user?.id}
              isVisible
              onBookmark={handleBookmark}
            />
          )}
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
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  empty:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle:  { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptySub:    { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
