import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import { Post, PostCard } from "@/components/feed/PostCard";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";

const STORAGE_KEY = "ibhub_feed_posts_v3";
const MAX_CHARS = 350;
const POLL_DURATIONS = ["24 horas", "3 dias", "7 dias", "2 semanas"];

const SENSORY_TAGS = [
  "Frutado","Amadeirado","Floral","Mineral","Taninos Fortes",
  "Taninos Suaves","Acidez Alta","Acidez Baixa","Encorpado","Leve",
  "Doce","Seco","Especiado","Herbáceo","Tostado","Amanteigado",
];

const SUGGESTIONS = [
  { id: "u1", initial: "L", name: "Lucas Lima",       role: "Produtor",    status: "Pendente"   },
  { id: "u2", initial: "J", name: "João Oliveira",    role: "Importador",  status: "Pendente"   },
  { id: "u3", initial: "F", name: "Felipe Galtaroca", role: "Ceo",         status: "Pendente"   },
  { id: "u4", initial: "B", name: "Brenda Lima",      role: "Sommelier",   status: "Conectar"   },
];

const COMPANY_PAGES = [
  { id: "c1", initial: "I", name: "Ideal.BI", role: "Consultoria" },
];

function generateMockPost(id: number): Post {
  const authors = [
    { id: "u2", full_name: "Julia Benetti",    username: "juliabenetti",   headline: "Head de marketing na Ideal.BI", plan: "business",  avatar_url: "https://randomuser.me/api/portraits/women/45.jpg" },
    { id: "u3", full_name: "Felipe Galtaroca", username: "felipegaltar",   headline: "Ceo na Ideal.Bi",               plan: "exclusive", avatar_url: "https://randomuser.me/api/portraits/men/32.jpg" },
    { id: "u4", full_name: "Ideal.BI",         username: "idealbi",        headline: "Consultoria",                   plan: "premium",   avatar_url: null },
    { id: "u5", full_name: "Maria Silva",      username: "mariasilva",     headline: "Sommelier WSET Level 3",        plan: "business",  avatar_url: null },
    { id: "u6", full_name: "João Costa",       username: "joaocosta",      headline: "Enólogo | Quinta da Serra",     plan: "basico",    avatar_url: null },
  ];
  const daysAgo = [19, 20, 27, 14, 7];
  const author = authors[id % authors.length];
  const date = new Date(Date.now() - daysAgo[id % daysAgo.length] * 86400000);

  if (id === 1) {
    return {
      id: `post_${id}`, user_id: author.id,
      content: "Qual tipo de vinho você prefere para o verão?",
      likes_count: 0, comments_count: 0, shares_count: 0,
      is_liked: false, is_bookmarked: false,
      created_at: date.toISOString(), author,
      poll: {
        options: [
          { text: "🥂 Espumante fresco", votes: 47 },
          { text: "🍷 Rosé gelado",      votes: 31 },
          { text: "🌿 Vinho verde",      votes: 18 },
          { text: "🍊 Vinho laranja",    votes: 11 },
        ],
        total_votes: 107, closed: false,
      },
    };
  }
  const contents = [
    "Visita à Vinícola Miolo hoje — safra 2024 promete surpreender! Taninos elegantes e boa acidez nos tintos. Muito otimista com o que está vindo por aí. 🍷",
    "Degustação sensacional na Serra Gaúcha! Os espumantes Brut Nature da região estão em outro nível. Vale muito conhecer pessoalmente.",
    "Acabei de chegar de uma visita incrível ao Alentejo! Os tintos desta safra prometem muito. 🍷",
    "Resultado da minha degustação: Barolo 2019 absolutamente impecável. 96 pontos.",
    "Dica do dia: para harmonizar com queijo de cabra, escolha um Sauvignon Blanc fresco e mineral. A acidez do vinho equilibra a gordura do queijo perfeitamente.",
  ];
  return {
    id: `post_${id}`, user_id: author.id, content: contents[id % contents.length],
    likes_count: id === 0 ? 1 : 0, comments_count: 0, shares_count: 0,
    is_liked: id === 0, is_bookmarked: false,
    created_at: date.toISOString(), author,
  };
}

/* ── Simple SVG QR code ── */
function QRCodeSVG({ size = 160 }: { size?: number }) {
  const N = 21; const C = size / N;
  const fp = (ox: number, oy: number) => {
    const cells: { x: number; y: number }[] = [];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const isEdge = r === 0 || r === 6 || c === 0 || c === 6;
      const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (isEdge || isCenter) cells.push({ x: ox + c, y: oy + r });
    }
    return cells;
  };
  const dataModules = [
    {x:8,y:0},{x:10,y:0},{x:12,y:0},{x:8,y:1},{x:11,y:1},{x:13,y:1},
    {x:9,y:2},{x:12,y:2},{x:8,y:3},{x:10,y:3},{x:13,y:3},
    {x:7,y:7},{x:9,y:7},{x:11,y:7},{x:13,y:7},{x:15,y:7},{x:17,y:7},
    {x:7,y:8},{x:8,y:8},{x:10,y:8},{x:12,y:8},{x:14,y:8},{x:16,y:8},
    {x:7,y:9},{x:9,y:9},{x:11,y:9},{x:13,y:9},{x:15,y:9},{x:17,y:9},
    {x:7,y:10},{x:8,y:10},{x:10,y:10},{x:16,y:10},{x:18,y:10},
    {x:7,y:11},{x:9,y:11},{x:11,y:11},{x:13,y:11},{x:15,y:11},{x:17,y:11},
    {x:7,y:12},{x:8,y:12},{x:12,y:12},{x:14,y:12},{x:16,y:12},
    {x:8,y:13},{x:10,y:13},{x:12,y:13},{x:15,y:13},{x:17,y:13},
    {x:15,y:14},{x:17,y:14},{x:18,y:14},{x:19,y:14},{x:20,y:14},
    {x:15,y:15},{x:18,y:15},{x:20,y:15},
    {x:15,y:16},{x:16,y:16},{x:17,y:16},{x:19,y:16},
    {x:15,y:17},{x:17,y:17},{x:18,y:17},{x:20,y:17},
    {x:15,y:18},{x:16,y:18},{x:19,y:18},{x:20,y:18},
    {x:8,y:6},{x:8,y:14},{x:8,y:16},{x:8,y:18},{x:8,y:20},
    {x:9,y:15},{x:9,y:17},{x:9,y:19},{x:10,y:14},{x:10,y:16},{x:10,y:20},
    {x:11,y:15},{x:11,y:17},{x:11,y:19},{x:12,y:14},{x:12,y:16},{x:12,y:18},
    {x:13,y:15},{x:13,y:17},{x:13,y:19},{x:13,y:20},
  ];
  const allCells = [...fp(0,0), ...fp(14,0), ...fp(0,14), ...dataModules];
  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill="white" />
      {allCells.map((cell, i) => (
        <Rect key={i} x={cell.x * C} y={cell.y * C} width={C} height={C} fill="black" />
      ))}
    </Svg>
  );
}

/* ── Stars component ── */
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      {[1,2,3,4,5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)}>
          <Feather name="star" size={28} color={star <= value ? colors.gold : colors.border} fill={star <= value ? colors.gold : "none"} />
        </TouchableOpacity>
      ))}
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#0d1b2a", marginLeft: 6 }}>{value}/5</Text>
    </View>
  );
}

export default function FeedScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showCreateMenu, setShowCreateMenu]         = useState(false);
  const [showCreatePost, setShowCreatePost]         = useState(false);
  const [showWineReview, setShowWineReview]         = useState(false);
  const [showQR, setShowQR]                         = useState(false);
  const [showAccountMenu, setShowAccountMenu]       = useState(false);

  // Company mode
  const [activeCompany, setActiveCompany]           = useState<typeof COMPANY_PAGES[0] | null>(null);

  // Create post state
  const [postMode, setPostMode]                     = useState<"text" | "poll">("text");
  const [postContent, setPostContent]               = useState("");
  const [pollQuestion, setPollQuestion]             = useState("");
  const [pollOptions, setPollOptions]               = useState(["", ""]);
  const [pollDuration, setPollDuration]             = useState(POLL_DURATIONS[0]);
  const [durationOpen, setDurationOpen]             = useState(false);

  // Wine review state
  const [wineName, setWineName]                     = useState("");
  const [wineSafra, setWineSafra]                   = useState("");
  const [wineStars, setWineStars]                   = useState(4);
  const [wineScore, setWineScore]                   = useState(85);
  const [selectedTags, setSelectedTags]             = useState<string[]>([]);
  const [wineHarmonizacao, setWineHarmonizacao]     = useState("");
  const [wineObs, setWineObs]                       = useState("");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;
  const firstName = profile?.full_name?.split(" ")[0] ?? "você";

  const loadPosts = useCallback(async () => {
    // Try real Supabase data first
    if (user?.id) {
      try {
        const realPosts = await API.fetchFeedPosts(user.id);
        if (realPosts.length > 0) {
          setPosts(realPosts);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(realPosts));
          setLoading(false);
          return;
        }
      } catch {}
    }
    // Fallback: cached or mock
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) { setPosts(JSON.parse(cached)); setLoading(false); return; }
    } catch {}
    const mockPosts = Array.from({ length: 6 }, (_, i) => generateMockPost(i));
    setPosts(mockPosts);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockPosts));
    setLoading(false);
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (user?.id) {
      try {
        const realPosts = await API.fetchFeedPosts(user.id);
        if (realPosts.length > 0) {
          setPosts(realPosts);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(realPosts));
          setRefreshing(false);
          return;
        }
      } catch {}
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    const mockPosts = Array.from({ length: 6 }, (_, i) => generateMockPost(i));
    setPosts(mockPosts);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handlePublishPost = async () => {
    setShowCreatePost(false);
    const content = postMode === "poll" ? pollQuestion : postContent;
    if (!content.trim() || !user?.id) {
      setPostContent(""); setPollQuestion(""); setPollOptions(["",""]); setPostMode("text");
      return;
    }

    const pollData = (postMode === "poll" && pollOptions.filter(o => o.trim()).length >= 2)
      ? { options: pollOptions.filter(o => o.trim()).map(t => ({ text: t, votes: 0 })), total_votes: 0, closed: false }
      : undefined;

    // Optimistic: prepend a local post immediately
    const tempPost: Post = {
      id: `tmp_${Date.now()}`,
      user_id: user.id,
      content: content.trim(),
      likes_count: 0, comments_count: 0, shares_count: 0,
      is_liked: false, is_bookmarked: false,
      created_at: new Date().toISOString(),
      poll: pollData,
      author: {
        id: user.id,
        full_name: profile?.full_name ?? "Você",
        username: profile?.username ?? "",
        avatar_url: profile?.avatar_url ?? null,
        headline: (profile as any)?.headline ?? "",
        plan: profile?.plan ?? "basico",
      },
    };
    setPosts(prev => [tempPost, ...prev]);

    // Persist to Supabase
    const saved = await API.createPost({ user_id: user.id, content: content.trim(), poll: pollData });
    if (saved) {
      setPosts(prev => prev.map(p => p.id === tempPost.id ? saved : p));
    }

    setPostContent(""); setPollQuestion(""); setPollOptions(["",""]); setPostMode("text");
  };

  const handlePublishWine = async () => {
    setShowWineReview(false);
    if (!wineName.trim() || !user?.id) {
      setWineName(""); setWineSafra(""); setWineStars(4); setWineScore(85);
      setSelectedTags([]); setWineHarmonizacao(""); setWineObs("");
      return;
    }

    const stars = "⭐".repeat(wineStars);
    const tags = selectedTags.length > 0 ? `\n🍷 Notas: ${selectedTags.join(", ")}` : "";
    const harmonizacao = wineHarmonizacao.trim() ? `\n🍽️ Harmonização: ${wineHarmonizacao.trim()}` : "";
    const obs = wineObs.trim() ? `\n📝 ${wineObs.trim()}` : "";
    const content = `${stars} ${wineName.trim()}${wineSafra ? ` (${wineSafra})` : ""}\n📊 Pontuação: ${wineScore}/100${tags}${harmonizacao}${obs}`;

    const tempPost: Post = {
      id: `tmp_${Date.now()}`,
      user_id: user.id,
      content,
      likes_count: 0, comments_count: 0, shares_count: 0,
      is_liked: false, is_bookmarked: false,
      created_at: new Date().toISOString(),
      author: {
        id: user.id,
        full_name: profile?.full_name ?? "Você",
        username: profile?.username ?? "",
        avatar_url: profile?.avatar_url ?? null,
        headline: (profile as any)?.headline ?? "",
        plan: profile?.plan ?? "basico",
      },
    };
    setPosts(prev => [tempPost, ...prev]);

    const saved = await API.createPost({ user_id: user.id, content });
    if (saved) {
      setPosts(prev => prev.map(p => p.id === tempPost.id ? saved : p));
    }

    setWineName(""); setWineSafra(""); setWineStars(4); setWineScore(85);
    setSelectedTags([]); setWineHarmonizacao(""); setWineObs("");
  };

  const toggleTag = (tag: string) =>
    setSelectedTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]);

  const renderHeader = () => (
    <>
      {/* Company banner */}
      {activeCompany && (
        <View style={[styles.companyBanner, { backgroundColor: colors.gold + "18", borderBottomColor: colors.gold + "40" }]}>
          <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "700" }}>
            Interagindo como{" "}
            <Text style={{ fontWeight: "800" }}>{activeCompany.name}</Text>
          </Text>
        </View>
      )}

      {/* Top Header */}
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowQR(true)}>
            <Feather name="grid" size={22} color={colors.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/notificacoes" as any)}>
            <Feather name="bell" size={22} color={colors.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.plusBtn} onPress={() => setShowCreateMenu(true)} activeOpacity={0.8}>
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAccountMenu(true)}>
            <View style={styles.avatarChevron}>
              {activeCompany ? (
                <View style={[styles.companyAvatar, { backgroundColor: colors.navy }]}>
                  <Text style={[styles.companyAvatarText, { color: colors.gold }]}>{activeCompany.initial}</Text>
                </View>
              ) : (
                <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={34} />
              )}
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stories */}
      <View style={[styles.storiesWrap, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
          <TouchableOpacity style={styles.storyItem} onPress={() => setShowCreatePost(true)}>
            <View style={[styles.storyCircle, { borderColor: colors.border }]}>
              <Feather name="plus" size={22} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.storyLabel, { color: colors.mutedForeground }]}>Momentos</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Greeting */}
      <View style={[styles.greeting, { backgroundColor: "#fff" }]}>
        <Text style={[styles.greetingTitle, { color: colors.navy }]}>Olá, {firstName}</Text>
        <Text style={[styles.greetingSub, { color: colors.mutedForeground }]}>Veja as últimas atualizações</Text>
      </View>

      {/* Sugestões */}
      <View style={[styles.suggestSection, { backgroundColor: "#fff" }]}>
        <Text style={[styles.suggestTitle, { color: colors.navy }]}>Sugestões para você</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestScroll}>
          {SUGGESTIONS.map((s) => (
            <View key={s.id} style={[styles.suggestCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={[styles.suggestAvatar, { backgroundColor: colors.navy }]}>
                <Text style={[styles.suggestInitial, { color: colors.gold }]}>{s.initial}</Text>
              </View>
              <Text style={[styles.suggestName, { color: colors.navy }]} numberOfLines={1}>{s.name}</Text>
              {s.role !== s.name && <Text style={[styles.suggestRole, { color: colors.mutedForeground }]} numberOfLines={1}>{s.role}</Text>}
              <TouchableOpacity style={[styles.suggestBtn, { borderColor: colors.border }]}>
                <Feather name="clock" size={11} color={colors.mutedForeground} />
                <Text style={[styles.suggestBtnText, { color: colors.mutedForeground }]}>{s.status}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Scroll indicator bar */}
      <View style={[styles.scrollBar, { backgroundColor: colors.border }]}>
        <View style={[styles.scrollBarInner, { backgroundColor: colors.navy }]} />
      </View>
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
            onLike={(id) => {
              const post = posts.find(p => p.id === id);
              if (!post || !user?.id) return;
              setPosts(prev => prev.map(p => p.id === id
                ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
                : p));
              API.toggleLike(id, user.id, post.is_liked ?? false);
            }}
            onBookmark={(id) => {
              const post = posts.find(p => p.id === id);
              if (!post || !user?.id) return;
              setPosts(prev => prev.map(p => p.id === id ? { ...p, is_bookmarked: !p.is_bookmarked } : p));
              API.toggleBookmark(id, user.id, post.is_bookmarked ?? false);
            }}
            onComment={(id) => router.push(`/post/${id}` as any)}
            onVote={(id, optionIndex) => {
              if (!user?.id) return;
              setPosts(prev => prev.map(p => {
                if (p.id !== id || !p.poll || p.poll.closed || p.poll.user_voted_index != null) return p;
                const newOptions = p.poll.options.map((o, i) =>
                  i === optionIndex ? { ...o, votes: o.votes + 1 } : o
                );
                return {
                  ...p,
                  poll: { ...p.poll, options: newOptions, total_votes: p.poll.total_votes + 1, user_voted_index: optionIndex },
                };
              }));
              API.voteOnPoll(id, user.id, optionIndex);
            }}
          />
        )}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Create Menu ── */}
      <Modal visible={showCreateMenu} transparent animationType="fade" onRequestClose={() => setShowCreateMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowCreateMenu(false)}>
          <View style={[styles.createMenu, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.createMenuItem} onPress={() => { setShowCreateMenu(false); setPostMode("text"); setShowCreatePost(true); }}>
              <View style={[styles.createMenuIcon, { backgroundColor: colors.background }]}>
                <Feather name="file-text" size={20} color={colors.navy} />
              </View>
              <View>
                <Text style={[styles.createMenuTitle, { color: colors.navy }]}>Publicação</Text>
                <Text style={[styles.createMenuSub, { color: colors.mutedForeground }]}>Texto, foto ou vídeo</Text>
              </View>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.createMenuItem} onPress={() => { setShowCreateMenu(false); setShowWineReview(true); }}>
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

      {/* ── Create Post Modal ── */}
      <Modal visible={showCreatePost} transparent animationType="fade" onRequestClose={() => setShowCreatePost(false)}>
        <Pressable style={styles.postOverlay} onPress={Keyboard.dismiss}>
          <View style={[styles.postModal, { backgroundColor: "#fff" }]}>
            {/* Header */}
            <View style={[styles.postModalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowCreatePost(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              <Text style={[styles.postModalTitle, { color: colors.navy }]}>
                {postMode === "text" ? "Criar publicação" : "Criar enquete"}
              </Text>
              <TouchableOpacity
                style={[styles.publishBtn, { backgroundColor: postMode === "text" ? (postContent.trim() ? colors.gold : colors.gold + "55") : (pollQuestion.trim() ? colors.gold : colors.gold + "55") }]}
                onPress={handlePublishPost}
              >
                <Text style={styles.publishBtnText}>Publicar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Author */}
              <View style={styles.postAuthorRow}>
                <View style={[styles.postAvatar, { backgroundColor: colors.navy }]}>
                  <Text style={[styles.postAvatarText, { color: colors.gold }]}>
                    {(profile?.full_name ?? "U")[0]}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.postAuthorName, { color: colors.navy }]}>{profile?.full_name ?? "Você"}</Text>
                  <Text style={[styles.postAuthorRole, { color: colors.mutedForeground }]}>
                    {(profile as any)?.headline ?? "Sommelier"}
                  </Text>
                </View>
              </View>

              {postMode === "text" ? (
                <>
                  <TextInput
                    style={[styles.postInput, { color: colors.foreground }]}
                    placeholder="Comece uma publicação... Use # ou @ para marcar"
                    placeholderTextColor={colors.mutedForeground}
                    multiline maxLength={MAX_CHARS} value={postContent}
                    onChangeText={setPostContent} autoFocus
                  />
                  <Text style={[styles.charCounter, { color: colors.mutedForeground }]}>
                    {MAX_CHARS - postContent.length} caracteres restantes
                  </Text>
                </>
              ) : (
                <>
                  <TextInput
                    style={[styles.postInput, { color: colors.foreground }]}
                    placeholder="Faça uma pergunta..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline maxLength={MAX_CHARS} value={pollQuestion}
                    onChangeText={setPollQuestion}
                  />
                  <Text style={[styles.charCounter, { color: colors.mutedForeground }]}>
                    {MAX_CHARS - pollQuestion.length} caracteres restantes
                  </Text>
                  <View style={[styles.pollSection, { borderTopColor: colors.border }]}>
                    <View style={styles.pollLabelRow}>
                      <Feather name="bar-chart-2" size={14} color={colors.gold} />
                      <Text style={[styles.pollLabel, { color: colors.gold }]}>ENQUETE</Text>
                    </View>
                    <TextInput style={[styles.pollOptionInput, { borderColor: colors.border, color: colors.foreground }]} placeholder="Faça uma pergunta..." placeholderTextColor={colors.mutedForeground} value={pollQuestion} onChangeText={setPollQuestion} />
                    {pollOptions.map((opt, i) => (
                      <TextInput key={i} style={[styles.pollOptionInput, { borderColor: colors.border, color: colors.foreground }]} placeholder={`Opção ${i + 1}`} placeholderTextColor={colors.mutedForeground} value={opt} onChangeText={(v) => { const n = [...pollOptions]; n[i] = v; setPollOptions(n); }} />
                    ))}
                    {pollOptions.length < 4 && (
                      <TouchableOpacity style={styles.addOptionBtn} onPress={() => setPollOptions([...pollOptions, ""])}>
                        <Feather name="plus" size={14} color={colors.gold} />
                        <Text style={[styles.addOptionText, { color: colors.gold }]}>Adicionar opção</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.durationRow}>
                      <Text style={[styles.durationLabel, { color: colors.foreground }]}>Duração: </Text>
                      <TouchableOpacity style={[styles.durationSelect, { borderColor: colors.border }]} onPress={() => setDurationOpen(!durationOpen)}>
                        <Text style={[styles.durationText, { color: colors.foreground }]}>{pollDuration}</Text>
                        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                    {durationOpen && (
                      <View style={[styles.durationDropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                        {POLL_DURATIONS.map((d) => (
                          <TouchableOpacity key={d} style={[styles.durationItem, { borderBottomColor: colors.border }]} onPress={() => { setPollDuration(d); setDurationOpen(false); }}>
                            <Text style={[styles.durationItemText, { color: colors.foreground }]}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Toolbar */}
            <View style={[styles.postToolbar, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={styles.toolbarBtn}>
                <Feather name="image" size={18} color={colors.foreground} />
                <Text style={[styles.toolbarLabel, { color: colors.foreground }]}>Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarBtn}>
                <Feather name="video" size={18} color={colors.foreground} />
                <Text style={[styles.toolbarLabel, { color: colors.foreground }]}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarBtn} onPress={() => setPostMode(postMode === "poll" ? "text" : "poll")}>
                <Feather name="bar-chart-2" size={18} color={postMode === "poll" ? colors.gold : colors.foreground} />
                <Text style={[styles.toolbarLabel, { color: postMode === "poll" ? colors.gold : colors.foreground }]}>Enquete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Wine Review Modal ── */}
      <Modal visible={showWineReview} transparent animationType="slide" onRequestClose={() => setShowWineReview(false)}>
        <View style={styles.wineOverlay}>
          <View style={[styles.wineModal, { backgroundColor: "#fff" }]}>
            <View style={[styles.postModalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowWineReview(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              <View style={styles.wineHeaderTitle}>
                <Text style={{ fontSize: 14 }}>🍷</Text>
                <Text style={[styles.postModalTitle, { color: colors.navy }]}>Avaliar Rótulo</Text>
              </View>
              <TouchableOpacity style={[styles.publishBtn, { backgroundColor: colors.gold + "88" }]} onPress={handlePublishWine}>
                <Text style={styles.publishBtnText}>Publicar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
              {/* Author */}
              <View style={styles.postAuthorRow}>
                <View style={[styles.postAvatar, { backgroundColor: colors.navy }]}>
                  <Text style={[styles.postAvatarText, { color: colors.gold }]}>{(profile?.full_name ?? "U")[0]}</Text>
                </View>
                <View>
                  <Text style={[styles.postAuthorName, { color: colors.navy }]}>{profile?.full_name ?? "Você"}</Text>
                  <Text style={[styles.postAuthorRole, { color: colors.mutedForeground }]}>{(profile as any)?.headline ?? "Sommelier"}</Text>
                </View>
              </View>
              {/* Nome + Safra */}
              <View>
                <Text style={[styles.wineFieldLabel, { color: colors.mutedForeground }]}>NOME DO VINHO / SAFRA</Text>
                <View style={styles.wineNameRow}>
                  <TextInput style={[styles.wineNameInput, { flex: 2, borderColor: colors.border, color: colors.foreground }]} placeholder="Ex: Casillero del Diablo" placeholderTextColor={colors.mutedForeground} value={wineName} onChangeText={setWineName} />
                  <TextInput style={[styles.wineNameInput, { flex: 1, borderColor: colors.border, color: colors.foreground }]} placeholder="2020" placeholderTextColor={colors.mutedForeground} value={wineSafra} onChangeText={setWineSafra} keyboardType="number-pad" />
                </View>
              </View>
              {/* Stars */}
              <View>
                <Text style={[styles.wineFieldLabel, { color: colors.mutedForeground }]}>NOTA VISUAL</Text>
                <StarRating value={wineStars} onChange={setWineStars} />
              </View>
              {/* Score slider (+ / - buttons) */}
              <View>
                <Text style={[styles.wineFieldLabel, { color: colors.mutedForeground }]}>PONTUAÇÃO (0-100)</Text>
                <View style={styles.scoreRow}>
                  <View style={[styles.scoreTrack, { backgroundColor: colors.border }]}>
                    <View style={[styles.scoreFill, { backgroundColor: colors.navy, width: `${wineScore}%` as any }]} />
                    <View style={[styles.scoreKnob, { backgroundColor: colors.navy, left: `${wineScore}%` as any }]} />
                  </View>
                  <Text style={[styles.scoreValue, { color: colors.gold }]}>{wineScore}</Text>
                </View>
                <View style={styles.scoreBtns}>
                  <TouchableOpacity style={[styles.scoreBtn, { borderColor: colors.border }]} onPress={() => setWineScore((s) => Math.max(0, s - 5))}>
                    <Feather name="minus" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.scoreBtn, { borderColor: colors.border }]} onPress={() => setWineScore((s) => Math.min(100, s + 5))}>
                    <Feather name="plus" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Tags */}
              <View>
                <Text style={[styles.wineFieldLabel, { color: colors.mutedForeground }]}>TAGS SENSORIAIS</Text>
                <View style={styles.tagChips}>
                  {SENSORY_TAGS.map((tag) => (
                    <TouchableOpacity key={tag} style={[styles.tagChip, { borderColor: selectedTags.includes(tag) ? colors.gold : colors.border, backgroundColor: selectedTags.includes(tag) ? colors.gold + "14" : "#fff" }]} onPress={() => toggleTag(tag)}>
                      <Text style={[styles.tagChipText, { color: selectedTags.includes(tag) ? colors.gold : colors.foreground }]}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Harmonização */}
              <View>
                <Text style={[styles.wineFieldLabel, { color: colors.mutedForeground }]}>HARMONIZAÇÃO</Text>
                <TextInput style={[styles.wineInput, { borderColor: colors.border, color: colors.foreground }]} placeholder="Ex: Carnes vermelhas, queijos maturados..." placeholderTextColor={colors.mutedForeground} value={wineHarmonizacao} onChangeText={setWineHarmonizacao} />
              </View>
              {/* Observações */}
              <View>
                <Text style={[styles.wineFieldLabel, { color: colors.mutedForeground }]}>OBSERVAÇÕES</Text>
                <TextInput style={[styles.wineTextarea, { borderColor: colors.border, color: colors.foreground }]} placeholder={"Suas impressões sobre o vinho... Use @ para marcar"} placeholderTextColor={colors.mutedForeground} value={wineObs} onChangeText={(v) => v.length <= 300 && setWineObs(v)} multiline textAlignVertical="top" />
                <Text style={[styles.charCounter, { color: colors.mutedForeground }]}>{300 - wineObs.length} caracteres</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── QR Code Modal ── */}
      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <Pressable style={styles.qrOverlay} onPress={() => setShowQR(false)}>
          <Pressable style={[styles.qrModal, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.qrClose} onPress={() => setShowQR(false)}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            {/* Avatar */}
            <View style={[styles.qrAvatar, { backgroundColor: colors.navy, borderColor: colors.gold }]}>
              <Text style={[styles.qrAvatarText, { color: colors.gold }]}>
                {(profile?.full_name ?? "U")[0]}
              </Text>
            </View>
            <Text style={[styles.qrName, { color: colors.navy }]}>{profile?.full_name ?? "Meu Perfil"}</Text>
            <Text style={[styles.qrRole, { color: colors.mutedForeground }]}>{(profile as any)?.headline ?? "Sommelier Chefe"}</Text>
            <Text style={[styles.qrCompany, { color: colors.mutedForeground }]}>Wine Academy</Text>
            {/* QR Code */}
            <View style={styles.qrCode}>
              <QRCodeSVG size={160} />
            </View>
            <Text style={[styles.qrCaption, { color: colors.mutedForeground }]}>Escaneie para ver meu perfil no ibhub</Text>
            {/* Buttons */}
            <View style={styles.qrBtns}>
              <TouchableOpacity style={[styles.qrBtn, { borderColor: colors.border }]} onPress={() => { setShowQR(false); Alert.alert("Copiado!", "Link copiado."); }}>
                <Feather name="copy" size={15} color={colors.foreground} />
                <Text style={[styles.qrBtnText, { color: colors.foreground }]}>Copiar Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.qrBtn, { backgroundColor: colors.gold, borderColor: colors.gold }]}>
                <Feather name="share-2" size={15} color="#fff" />
                <Text style={[styles.qrBtnText, { color: "#fff" }]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Account Menu ── */}
      <Modal visible={showAccountMenu} transparent animationType="fade" onRequestClose={() => setShowAccountMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowAccountMenu(false)}>
          <View style={[styles.accountMenu, { backgroundColor: "#fff" }]}>
            {/* Personal account */}
            <TouchableOpacity
              style={[styles.accountRow, activeCompany === null && { backgroundColor: colors.background }]}
              onPress={() => { setActiveCompany(null); setShowAccountMenu(false); }}
            >
              <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountName, { color: colors.navy }]}>{profile?.full_name ?? "Meu Perfil"}</Text>
                <Text style={[styles.accountSub, { color: colors.mutedForeground }]}>Conta pessoal</Text>
              </View>
              <View style={[styles.onlineDot, { backgroundColor: "#22c55e" }]} />
            </TouchableOpacity>

            {/* Company pages */}
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.pagesHeader, { color: colors.mutedForeground }]}>PÁGINAS EMPRESARIAIS</Text>
            {COMPANY_PAGES.map((page) => (
              <TouchableOpacity
                key={page.id}
                style={[styles.accountRow, activeCompany?.id === page.id && { backgroundColor: colors.background }]}
                onPress={() => { setActiveCompany(page); setShowAccountMenu(false); }}
              >
                <View style={[styles.companyAvatarLg, { backgroundColor: colors.navyMid }]}>
                  <Text style={[styles.companyAvatarTextLg, { color: colors.gold }]}>{page.initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.accountName, { color: colors.navy }]}>{page.name}</Text>
                  <Text style={[styles.accountSub, { color: colors.mutedForeground }]}>{page.role}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.accountRow} onPress={() => setShowAccountMenu(false)}>
              <Feather name="briefcase" size={20} color={colors.gold} />
              <Text style={[styles.managePages, { color: colors.gold }]}>Gerenciar Páginas</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  loadingView:        { flex: 1, alignItems: "center", justifyContent: "center" },
  companyBanner:      { paddingVertical: 8, paddingHorizontal: 16, alignItems: "center", borderBottomWidth: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  brandText:          { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  headerActions:      { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn:            { padding: 6 },
  plusBtn:            { width: 34, height: 34, borderRadius: 17, backgroundColor: "#c9a84c", alignItems: "center", justifyContent: "center", marginHorizontal: 2 },
  avatarChevron:      { flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 4 },
  companyAvatar:      { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  companyAvatarText:  { fontSize: 14, fontWeight: "800" },
  storiesWrap:        { paddingVertical: 12, borderBottomWidth: 1 },
  storiesScroll:      { paddingHorizontal: 16, gap: 12 },
  storyItem:          { alignItems: "center", gap: 4 },
  storyCircle:        { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, alignItems: "center", justifyContent: "center", backgroundColor: "#f8f8f8" },
  storyLabel:         { fontSize: 11 },
  greeting:           { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  greetingTitle:      { fontSize: 22, fontWeight: "800" },
  greetingSub:        { fontSize: 14, marginTop: 2 },
  suggestSection:     { paddingTop: 10, paddingBottom: 12 },
  suggestTitle:       { paddingHorizontal: 16, fontSize: 15, fontWeight: "700", marginBottom: 10 },
  suggestScroll:      { paddingHorizontal: 16, gap: 10 },
  suggestCard:        { width: 110, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 5 },
  suggestAvatar:      { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  suggestInitial:     { fontSize: 20, fontWeight: "800" },
  suggestName:        { fontSize: 12, fontWeight: "700", textAlign: "center" },
  suggestRole:        { fontSize: 10, textAlign: "center" },
  suggestBtn:         { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 2 },
  suggestBtnText:     { fontSize: 10 },
  scrollBar:          { height: 3, marginHorizontal: 16, borderRadius: 2, marginBottom: 8 },
  scrollBarInner:     { height: 3, width: "40%", borderRadius: 2 },
  menuOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 100, paddingRight: 16 },
  createMenu:         { width: 240, borderRadius: 14, overflow: "hidden", shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 8 },
  createMenuItem:     { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  createMenuIcon:     { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  createMenuTitle:    { fontSize: 15, fontWeight: "700" },
  createMenuSub:      { fontSize: 12, marginTop: 2 },
  menuDivider:        { height: 1 },
  // Create post modal
  postOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 16 },
  postModal:          { width: "100%", maxWidth: 420, borderRadius: 16, maxHeight: "85%", overflow: "hidden" },
  postModalHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  postModalTitle:     { fontSize: 16, fontWeight: "700" },
  publishBtn:         { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  publishBtnText:     { color: "#fff", fontWeight: "700", fontSize: 14 },
  postAuthorRow:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 8 },
  postAvatar:         { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  postAvatarText:     { fontSize: 18, fontWeight: "800" },
  postAuthorName:     { fontSize: 15, fontWeight: "700" },
  postAuthorRole:     { fontSize: 12, marginTop: 1 },
  postInput:          { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 8, minHeight: 80 },
  charCounter:        { fontSize: 12, paddingHorizontal: 16, paddingBottom: 8 },
  postToolbar:        { flexDirection: "row", borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  toolbarBtn:         { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  toolbarLabel:       { fontSize: 13, fontWeight: "600" },
  pollSection:        { borderTopWidth: 1, padding: 16, gap: 10 },
  pollLabelRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  pollLabel:          { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  pollOptionInput:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  addOptionBtn:       { flexDirection: "row", alignItems: "center", gap: 6 },
  addOptionText:      { fontSize: 14, fontWeight: "600" },
  durationRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  durationLabel:      { fontSize: 14 },
  durationSelect:     { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  durationText:       { fontSize: 14 },
  durationDropdown:   { borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  durationItem:       { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  durationItemText:   { fontSize: 14 },
  // Wine review modal
  wineOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  wineModal:          { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", overflow: "hidden" },
  wineHeaderTitle:    { flexDirection: "row", alignItems: "center", gap: 6 },
  wineFieldLabel:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  wineNameRow:        { flexDirection: "row", gap: 8 },
  wineNameInput:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  scoreRow:           { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  scoreTrack:         { flex: 1, height: 6, borderRadius: 3, overflow: "hidden", position: "relative" },
  scoreFill:          { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 3 },
  scoreKnob:          { position: "absolute", width: 14, height: 14, borderRadius: 7, top: -4, marginLeft: -7 },
  scoreValue:         { fontSize: 18, fontWeight: "800", width: 36, textAlign: "right" },
  scoreBtns:          { flexDirection: "row", gap: 8 },
  scoreBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, width: 36, height: 36, borderRadius: 8 },
  tagChips:           { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip:            { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  tagChipText:        { fontSize: 13 },
  wineInput:          { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  wineTextarea:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, height: 80 },
  // QR modal
  qrOverlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 20 },
  qrModal:            { width: "100%", maxWidth: 340, borderRadius: 20, padding: 24, alignItems: "center", gap: 10 },
  qrClose:            { position: "absolute", top: 16, right: 16 },
  qrAvatar:           { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", borderWidth: 3, marginBottom: 4 },
  qrAvatarText:       { fontSize: 28, fontWeight: "900" },
  qrName:             { fontSize: 18, fontWeight: "800" },
  qrRole:             { fontSize: 13 },
  qrCompany:          { fontSize: 12 },
  qrCode:             { marginVertical: 10, borderRadius: 8, overflow: "hidden" },
  qrCaption:          { fontSize: 12, textAlign: "center" },
  qrBtns:             { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  qrBtn:              { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 10, borderWidth: 1 },
  qrBtnText:          { fontSize: 13, fontWeight: "700" },
  // Account menu
  accountMenu:        { width: 280, borderRadius: 14, overflow: "hidden", shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 8 },
  accountRow:         { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  accountName:        { fontSize: 15, fontWeight: "700" },
  accountSub:         { fontSize: 12 },
  pagesHeader:        { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  companyAvatarLg:    { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  companyAvatarTextLg:{ fontSize: 16, fontWeight: "800" },
  onlineDot:          { width: 10, height: 10, borderRadius: 5 },
  managePages:        { fontSize: 15, fontWeight: "600" },
});
