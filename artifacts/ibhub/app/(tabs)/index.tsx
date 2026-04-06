import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Post, PostCard } from "@/components/feed/PostCard";
import { StoryBar } from "@/components/feed/StoryBar";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";

const STORAGE_KEY = "ibhub_feed_posts";

function generateMockPost(id: number): Post {
  const authors = [
    { id: "u1", full_name: "Maria Silva", username: "mariasilva", headline: "Sommelier WSET Level 3 | Consulta", plan: "executivo" },
    { id: "u2", full_name: "João Costa", username: "joaocosta", headline: "Enólogo | Quinta da Serra", plan: "basico" },
    { id: "u3", full_name: "Ana Ferreira", username: "anaferreira", headline: "Wine Educator | CMS Certified", plan: "executivo" },
    { id: "u4", full_name: "Pedro Lima", username: "pedrolima", headline: "Importador | Vinhos Finos Ltda", plan: "gratuito" },
  ];
  const contents = [
    "Acabei de chegar de uma visita incrível ao Alentejo! Os tintos desta safra prometem muito. Quem mais tem acompanhado a evolução dos vinhos da região? 🍷",
    "Resultado da minha degustação de hoje: um Barolo 2019 absolutamente impecável. Notas de cereja preta, especiarias e taninos sedosos. Avaliação: 96 pontos.",
    "Dica do dia: para harmonizar com queijo de cabra, escolha um Sauvignon Blanc fresco e herbáceo. Simples assim!",
    "Nosso evento de degustação do mês será nesta sexta-feira no Centro Cultural do Vinho. Vagas limitadas — confirme sua presença!",
    "Estou finalizando minha tese sobre terroir no Douro Superior. Alguém tem pesquisas complementares sobre solos xistosos?",
  ];
  const hashtags = [
    ["vinho", "sommelier", "alentejo"],
    ["barolo", "italianwine", "degustação"],
    ["harmonização", "queijo", "sauvignon"],
    ["eventos", "networking", "vinho"],
    ["douro", "terroir", "pesquisa"],
  ];
  const author = authors[id % authors.length];
  const content = contents[id % contents.length];
  const tags = hashtags[id % hashtags.length];
  const date = new Date(Date.now() - id * 3600000 * 2);

  return {
    id: `post_${id}`,
    user_id: author.id,
    content,
    likes_count: Math.floor(Math.random() * 80),
    comments_count: Math.floor(Math.random() * 20),
    shares_count: Math.floor(Math.random() * 10),
    is_liked: Math.random() > 0.7,
    is_bookmarked: Math.random() > 0.85,
    created_at: date.toISOString(),
    hashtags: tags,
    author,
  };
}

export default function FeedScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"para_voce" | "seguindo">("para_voce");

  const loadPosts = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        setPosts(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch {}

    const mockPosts = Array.from({ length: 10 }, (_, i) => generateMockPost(i));
    setPosts(mockPosts);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockPosts));
    setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await AsyncStorage.removeItem(STORAGE_KEY);
    const mockPosts = Array.from({ length: 10 }, (_, i) => generateMockPost(i));
    setPosts(mockPosts);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const renderHeader = () => (
    <>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoMark, { backgroundColor: colors.navy }]}>
            <Text style={{ color: colors.gold, fontSize: 14, fontWeight: "900" }}>IB</Text>
          </View>
          <Text style={[styles.headerBrand, { color: colors.navy }]}>ibhub</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/search" as any)}>
            <Feather name="search" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/create-post" as any)}>
            <Feather name="edit-3" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {(["para_voce", "seguindo"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && [styles.activeTab, { borderBottomColor: colors.gold }]]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.gold : colors.mutedForeground }]}>
              {tab === "para_voce" ? "Para você" : "Seguindo"}
            </Text>
          </Pressable>
        ))}
      </View>

      <StoryBar />

      <TouchableOpacity
        style={[styles.createPostBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/create-post" as any)}
      >
        <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={38} />
        <Text style={[styles.createPostPlaceholder, { color: colors.mutedForeground }]}>
          Compartilhe algo sobre vinho...
        </Text>
        <Feather name="image" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
    </>
  );

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const bottomPad = Platform.OS === "web" ? 84 + 34 : 84 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={(id) => console.log("like", id)}
            onBookmark={(id) => console.log("bookmark", id)}
            onComment={(id) => router.push(`/post/${id}` as any)}
          />
        )}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrand: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: { padding: 6 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {},
  tabText: { fontSize: 14, fontWeight: "700" },
  createPostBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  createPostPlaceholder: { flex: 1, fontSize: 14 },
});
