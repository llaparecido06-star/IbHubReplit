import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const STORAGE_KEY = "ibhub_feed_posts_v2";

function generateMockPost(id: number): Post {
  const authors = [
    { id: "u1", full_name: "Maria Silva",  username: "mariasilva",  headline: "Sommelier WSET Level 3", plan: "business" },
    { id: "u2", full_name: "João Costa",   username: "joaocosta",   headline: "Enólogo | Quinta da Serra", plan: "premium" },
    { id: "u3", full_name: "Ana Ferreira", username: "anaferreira", headline: "Wine Educator | CMS Certified", plan: "exclusive" },
    { id: "u4", full_name: "Pedro Lima",   username: "pedrolima",   headline: "Importador | Vinhos Finos", plan: "basico" },
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
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) { setPosts(JSON.parse(cached)); setLoading(false); return; }
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

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const firstName = profile?.full_name?.split(" ")[0] ?? "você";

  const renderHeader = () => (
    <>
      {/* ── Top Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setShowAccountMenu(true)} activeOpacity={0.8}>
          <Text style={styles.brandText}>
            <Text style={{ color: colors.navy }}>ib</Text>
            <Text style={{ color: colors.gold }}>hub</Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/search" as any)}>
            <Feather name="search" size={22} color={colors.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="grid" size={22} color={colors.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="bell" size={22} color={colors.navy} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.plusBtn}
            onPress={() => setShowCreateMenu(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAccountMenu(true)}>
            <View style={styles.avatarChevron}>
              <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={34} />
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Greeting ── */}
      <View style={[styles.greeting, { backgroundColor: "#fff" }]}>
        <Text style={[styles.greetingTitle, { color: colors.navy }]}>Olá, {firstName}</Text>
        <Text style={[styles.greetingSub, { color: colors.mutedForeground }]}>Veja as últimas atualizações</Text>
      </View>

      {/* ── Feed Tabs ── */}
      <View style={[styles.feedTabs, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {(["para_voce", "seguindo"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.feedTab, activeTab === tab && [styles.feedTabActive, { borderBottomColor: colors.gold }]]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.feedTabText, { color: activeTab === tab ? colors.gold : colors.mutedForeground }]}>
              {tab === "para_voce" ? "Para você" : "Seguindo"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Compose bar ── */}
      <TouchableOpacity
        style={[styles.composeBar, { backgroundColor: "#fff", borderColor: colors.border }]}
        onPress={() => router.push("/create-post" as any)}
      >
        <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={36} />
        <Text style={[styles.composePlaceholder, { color: colors.mutedForeground }]}>
          Compartilhe algo sobre vinho...
        </Text>
        <Feather name="image" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
    </>
  );

  if (loading) {
    return (
      <View style={[styles.loadingView, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />
        }
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      />

      {/* Create Menu Modal */}
      <Modal visible={showCreateMenu} transparent animationType="fade" onRequestClose={() => setShowCreateMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateMenu(false)}>
          <View style={[styles.createMenu, { backgroundColor: "#fff", shadowColor: colors.navy }]}>
            <TouchableOpacity
              style={styles.createMenuItem}
              onPress={() => { setShowCreateMenu(false); router.push("/create-post" as any); }}
            >
              <View style={[styles.createMenuIcon, { backgroundColor: colors.background }]}>
                <Feather name="file-text" size={20} color={colors.navy} />
              </View>
              <View>
                <Text style={[styles.createMenuTitle, { color: colors.navy }]}>Publicação</Text>
                <Text style={[styles.createMenuSub, { color: colors.mutedForeground }]}>Texto, foto ou vídeo</Text>
              </View>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.createMenuItem} onPress={() => setShowCreateMenu(false)}>
              <View style={[styles.createMenuIcon, { backgroundColor: colors.background }]}>
                <Feather name="tag" size={20} color={colors.gold} />
              </View>
              <View>
                <Text style={[styles.createMenuTitle, { color: colors.navy }]}>Avaliar Rótulo</Text>
                <Text style={[styles.createMenuSub, { color: colors.mutedForeground }]}>Ficha técnica de vinho</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Account Menu Modal */}
      <Modal visible={showAccountMenu} transparent animationType="fade" onRequestClose={() => setShowAccountMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAccountMenu(false)}>
          <View style={[styles.accountMenu, { backgroundColor: "#fff", shadowColor: colors.navy }]}>
            <View style={styles.accountMenuItem}>
              <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={40} />
              <View>
                <Text style={[styles.accountName, { color: colors.navy }]}>
                  {profile?.full_name ?? "Meu Perfil"}
                </Text>
                <Text style={[styles.accountSub, { color: colors.mutedForeground }]}>Conta pessoal</Text>
              </View>
              <View style={[styles.onlineDot, { backgroundColor: "#22c55e" }]} />
            </View>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.accountMenuItem}
              onPress={() => { setShowAccountMenu(false); }}
            >
              <Feather name="briefcase" size={20} color={colors.gold} />
              <Text style={[styles.accountMenuLabel, { color: colors.gold }]}>Gerenciar Páginas</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingView: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  brandText: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { padding: 6 },
  plusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#c9a84c",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  avatarChevron: { flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 4 },
  greeting: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  greetingTitle: { fontSize: 22, fontWeight: "800" },
  greetingSub: { fontSize: 14, marginTop: 2 },
  feedTabs: { flexDirection: "row", borderBottomWidth: 1 },
  feedTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  feedTabActive: {},
  feedTabText: { fontSize: 14, fontWeight: "700" },
  composeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  composePlaceholder: { flex: 1, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 100, paddingRight: 16 },
  createMenu: {
    width: 240,
    borderRadius: 14,
    overflow: "hidden",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  createMenuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  createMenuIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  createMenuTitle: { fontSize: 15, fontWeight: "700" },
  createMenuSub: { fontSize: 12, marginTop: 2 },
  menuDivider: { height: 1, marginHorizontal: 16 },
  accountMenu: {
    width: 260,
    borderRadius: 14,
    overflow: "hidden",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  accountMenuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  accountName: { fontSize: 15, fontWeight: "700" },
  accountSub: { fontSize: 12 },
  accountMenuLabel: { fontSize: 15, fontWeight: "600" },
  onlineDot: { width: 10, height: 10, borderRadius: 5, marginLeft: "auto" },
});
