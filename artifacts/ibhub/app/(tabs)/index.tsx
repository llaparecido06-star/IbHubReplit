import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ViewToken,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Post, PostCard, ReactionType } from "@/components/feed/PostCard";
import { LikesModal } from "@/components/feed/LikesModal";
import { StoryBar } from "@/components/feed/StoryBar";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { useColors } from "@/hooks/useColors";
import { friendlyErrorMessage } from "@/hooks/useAsyncAction";
import * as API from "@/services/api";
import type { SuggestedProfile } from "@/services/api";
import { supabase } from "@/context/AuthContext";

const STORAGE_KEY = "ibhub_feed_posts_v3";
const MAX_CHARS = 350;
const POLL_DURATIONS = ["24 horas", "3 dias", "7 dias", "2 semanas"];

const SENSORY_TAGS = [
  "Frutado","Amadeirado","Floral","Mineral","Taninos Fortes",
  "Taninos Suaves","Acidez Alta","Acidez Baixa","Encorpado","Leve",
  "Doce","Seco","Especiado","Herbáceo","Tostado","Amanteigado",
];




/* ── Stars component ── */
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      {[1,2,3,4,5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)}>
          <MaterialCommunityIcons
            name={star <= value ? "star" : "star-outline"}
            size={30}
            color={star <= value ? colors.gold : colors.border}
          />
        </TouchableOpacity>
      ))}
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#0d1b2a", marginLeft: 6 }}>{value}/5</Text>
    </View>
  );
}

export default function FeedScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, profile, activeCompany, setActiveCompany } = useAuth();
  const { isEnabled: isFlagEnabled } = useFeatureFlags();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const feedOffsetRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const isPostingRef = useRef(false);
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const [isPublishing, setIsPublishing] = useState(false);
  const FEED_PAGE_SIZE = 15;

  // New posts banner
  const [newPosts, setNewPosts]                     = useState<Post[]>([]);
  const newPostsBannerAnim                          = useRef(new Animated.Value(0)).current;
  const flatListRef                                 = useRef<FlatList>(null);
  // View tracking
  const viewTimers                                  = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [visiblePostIds, setVisiblePostIds]         = useState<Set<string>>(new Set());

  // Connection suggestions
  const [suggestions, setSuggestions] = useState<SuggestedProfile[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Notification badge
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Likes modal
  const [likesModalPost, setLikesModalPost] = useState<{ id: string; count: number } | null>(null);

  // Modals
  const [showCreateMenu, setShowCreateMenu]         = useState(false);
  const [showCreatePost, setShowCreatePost]         = useState(false);
  const [showWineReview, setShowWineReview]         = useState(false);
  const [showAccountMenu, setShowAccountMenu]       = useState(false);

  // Company mode — activeCompany lives in AuthContext so all tabs can access it
  const [companyPages, setCompanyPages]             = useState<API.CompanyPage[]>([]);

  // Create post state
  const [postMode, setPostMode]                     = useState<"text" | "poll">("text");
  const [postContent, setPostContent]               = useState("");
  const [postImageUris, setPostImageUris]           = useState<string[]>([]);
  const [postVideoUri, setPostVideoUri]             = useState<string | null>(null);
  const [postLocation, setPostLocation]             = useState("");
  const [showLocationInput, setShowLocationInput]   = useState(false);
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
  const [wineImageUri, setWineImageUri]             = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;
  const firstName = profile?.full_name?.split(" ")[0] ?? "você";

  // ── Feed algorithm: posts matching user's tags appear first ──
  const sortByRelevance = useCallback((list: Post[]) => {
    const userTags = (profile?.areas_of_expertise ?? []).map((t: string) => t.toLowerCase());
    if (userTags.length === 0) return list;
    return [...list].sort((a, b) => {
      const scoreA = (a.hashtags ?? []).filter(h => userTags.includes(h.toLowerCase())).length;
      const scoreB = (b.hashtags ?? []).filter(h => userTags.includes(h.toLowerCase())).length;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [profile?.areas_of_expertise]);

  const loadPosts = useCallback(async () => {
    feedOffsetRef.current = 0;
    isLoadingMoreRef.current = false;
    // Try real Supabase data first
    if (user?.id) {
      try {
        const realPosts = await API.fetchFeedPosts(user.id, activeCompany?.id, 0, FEED_PAGE_SIZE);
        if (realPosts.length > 0) {
          const sorted = sortByRelevance(realPosts);
          setPosts(sorted);
          feedOffsetRef.current = sorted.length;
          setHasMoreFeed(realPosts.length >= FEED_PAGE_SIZE);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
          setLoading(false);
          return;
        }
      } catch {}
    }
    // Fallback: cached (only real posts, strip any legacy mock posts)
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed: Post[] = JSON.parse(cached);
        const realCached = parsed.filter(p => !p.id.startsWith('post_'));
        if (realCached.length !== parsed.length) {
          if (realCached.length > 0) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(realCached));
          } else {
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
        if (realCached.length > 0) {
          setPosts(sortByRelevance(realCached));
          feedOffsetRef.current = realCached.length;
          setHasMoreFeed(true);
          setLoading(false);
          return;
        }
      }
    } catch {}
    setPosts([]);
    setHasMoreFeed(false);
    setLoading(false);
  }, [user?.id, activeCompany?.id, sortByRelevance]);

  const loadMorePosts = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreFeed || !user?.id) return;
    isLoadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const more = await API.fetchFeedPosts(user.id, activeCompany?.id, feedOffsetRef.current, FEED_PAGE_SIZE);
      if (more.length > 0) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const fresh = more.filter(p => !existingIds.has(p.id));
          return [...prev, ...fresh];
        });
        feedOffsetRef.current += more.length;
      }
      setHasMoreFeed(more.length >= FEED_PAGE_SIZE);
    } catch {}
    setLoadingMore(false);
    isLoadingMoreRef.current = false;
  }, [user?.id, activeCompany?.id, hasMoreFeed]);

  const loadSuggestions = useCallback(async () => {
    if (!user?.id) return;
    const areas = profile?.areas_of_expertise ?? [];
    const data = await API.fetchSuggestedConnections(user.id, areas, 10);
    setSuggestions(data);
  }, [user?.id, profile?.areas_of_expertise]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const loadCompanyPages = useCallback(async () => {
    if (!user?.id) return;
    const pages = await API.fetchUserCompanyPages(user.id);
    setCompanyPages(pages);
  }, [user?.id]);

  // Reload company pages every time the feed screen comes into focus
  // so newly created pages appear immediately after returning from manage-business-page
  useFocusEffect(useCallback(() => { loadCompanyPages(); }, [loadCompanyPages]));

  // Notification badge — fetch count on focus, realtime for instant updates
  useFocusEffect(useCallback(() => {
    if (!user?.id) return;
    API.getUnreadNotifCount(user.id).then(setUnreadNotifCount);
  }, [user?.id]));

  useEffect(() => {
    if (!user?.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`notif_badge_${user.id}_${uid}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        setUnreadNotifCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const handleConnect = useCallback(async (targetId: string) => {
    if (!user?.id || connectingId) return;
    const suggestion = suggestions.find(s => s.id === targetId);
    const alreadyFollowing = suggestion?.is_following ?? false;
    setConnectingId(targetId);
    // Optimistic update
    setSuggestions(prev => prev.map(s =>
      s.id === targetId ? { ...s, connection_status: "pending", is_following: true } : s
    ));
    await API.sendConnectionRequest(targetId, user.id);
    if (!alreadyFollowing) {
      await API.toggleFollow(targetId, user.id, false);
    }
    setConnectingId(null);
  }, [user?.id, connectingId, suggestions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    feedOffsetRef.current = 0;
    isLoadingMoreRef.current = false;
    if (user?.id) {
      try {
        const realPosts = await API.fetchFeedPosts(user.id, activeCompany?.id, 0, FEED_PAGE_SIZE);
        if (realPosts.length > 0) {
          const sorted = sortByRelevance(realPosts);
          setPosts(sorted);
          feedOffsetRef.current = sorted.length;
          setHasMoreFeed(realPosts.length >= FEED_PAGE_SIZE);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
          setRefreshing(false);
          return;
        }
      } catch {}
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPosts([]);
    setHasMoreFeed(false);
    setRefreshing(false);
  }, [user?.id, activeCompany?.id, sortByRelevance]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // ── Realtime: remove accepted connections from suggestions ──
  useEffect(() => {
    if (!user?.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`connections_suggestions_${user.id}_${uid}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "connections",
      }, (payload) => {
        const row = payload.new as any;
        if (row.status !== "accepted") return;
        const isInvolved =
          row.requester_id === user.id || row.receiver_id === user.id;
        if (!isInvolved) return;
        const otherId = row.requester_id === user.id ? row.receiver_id : row.requester_id;
        setSuggestions(prev => prev.filter(s => s.id !== otherId));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // ── Realtime subscriptions: posts, likes, comments ──
  useEffect(() => {
    if (!user?.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`feed-realtime_${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const raw = payload.new as any;
        if (raw.user_id === user.id) return; // our own post is already added optimistically
        const full = await API.fetchPostById(raw.id, user.id);
        if (!full) return;
        // Skip posts from shadowbanned users (server-side shadowban enforcement for realtime path)
        if (full.author?.is_shadowbanned) return;
        setPosts(prev => {
          if (prev.some(p => p.id === full.id)) return prev;
          setNewPosts(np => [...np, full]);
          Animated.spring(newPostsBannerAnim, { toValue: 1, useNativeDriver: true, speed: 14 }).start();
          return prev;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes" }, (payload) => {
        const postId   = (payload.new as any)?.post_id;
        const actorId  = (payload.new as any)?.user_id;
        if (!postId) return;
        // Skip own actions — already handled by optimistic update
        if (actorId === user.id) return;
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p
        ));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "likes" }, (payload) => {
        const postId  = (payload.old as any)?.post_id;
        const actorId = (payload.old as any)?.user_id;
        if (!postId) return;
        if (actorId === user.id) return;
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p
        ));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
        const postId  = (payload.new as any)?.post_id;
        const actorId = (payload.new as any)?.user_id;
        if (!postId) return;
        if (actorId === user.id) return;
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleShowNewPosts = () => {
    Animated.spring(newPostsBannerAnim, { toValue: 0, useNativeDriver: true, speed: 20 }).start();
    setPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const toInsert = newPosts.filter(p => !existingIds.has(p.id));
      return [...toInsert, ...prev];
    });
    setNewPosts([]);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // ── Viewable items tracking ──
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const nowVisible = new Set<string>();
    viewableItems.forEach(({ item, isViewable }) => {
      const post = item as Post;
      if (isViewable) {
        nowVisible.add(post.id);
        if (!viewTimers.current[post.id]) {
          viewTimers.current[post.id] = setTimeout(() => {
            setPosts(prev => prev.map(p =>
              p.id === post.id ? { ...p, view_count: (p.view_count ?? 0) + 1 } : p
            ));
            API.incrementViewCount(post.id);
            delete viewTimers.current[post.id];
          }, 1000);
        }
      } else {
        if (viewTimers.current[post.id]) {
          clearTimeout(viewTimers.current[post.id]);
          delete viewTimers.current[post.id];
        }
      }
    });
    setVisiblePostIds(nowVisible);
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const handlePickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de acesso à galeria para selecionar uma foto.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      aspect: [16, 9],
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPostImageUris(prev => {
        const combined = [...prev, ...result.assets.map(a => a.uri)];
        return combined.slice(0, 5);
      });
    }
  };

  const handlePickVideo = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de acesso à galeria para selecionar um vídeo.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const durationSec = (asset.duration ?? 0) / 1000;
      if (durationSec > 120) {
        Alert.alert("Vídeo muito longo", "O vídeo deve ter no máximo 2 minutos de duração.");
        return;
      }
      const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
        Alert.alert("Arquivo muito grande", "O vídeo deve ter no máximo 500 MB.");
        return;
      }
      if (asset.mimeType && !asset.mimeType.startsWith("video/")) {
        Alert.alert("Formato inválido", "Por favor selecione um arquivo de vídeo válido.");
        return;
      }
      setPostVideoUri(asset.uri);
      setPostImageUris([]);
    }
  };

  const handlePublishPost = async () => {
    if (isPostingRef.current) return;
    const content = postMode === "poll" ? pollQuestion : postContent;
    if ((!content.trim() && postImageUris.length === 0 && !postVideoUri) || !user?.id) {
      setShowCreatePost(false);
      setPostContent(""); setPollQuestion(""); setPollOptions(["",""]); setPostMode("text");
      setPostImageUris([]); setPostVideoUri(null); setPostLocation(""); setShowLocationInput(false);
      return;
    }
    isPostingRef.current = true;
    setIsPublishing(true);

    const pollData = (postMode === "poll" && pollOptions.filter(o => o.trim()).length >= 2)
      ? { options: pollOptions.filter(o => o.trim()).map(t => ({ text: t, votes: 0 })), total_votes: 0, closed: false }
      : undefined;

    const tempPost: Post = {
      id: `tmp_${Date.now()}`,
      user_id: user.id,
      company_page_id: activeCompany?.id ?? null,
      content: content.trim(),
      image_url: postImageUris[0] ?? null,
      image_urls: postImageUris.length > 0 ? postImageUris : null,
      video_url: postVideoUri ?? null,
      location: postLocation.trim() || null,
      likes_count: 0, comments_count: 0, shares_count: 0, view_count: 0,
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
      company_page: activeCompany
        ? { id: activeCompany.id, name: activeCompany.name, avatar_url: activeCompany.avatar_url ?? null }
        : null,
    };
    setPosts(prev => [tempPost, ...prev]);
    setShowCreatePost(false);

    try {
      // Upload images or video to Supabase Storage before saving
      let uploadedUrls: string[] = [];
      let uploadedVideoUrl: string | null = null;
      if (postVideoUri) {
        uploadedVideoUrl = await API.uploadPostVideo(postVideoUri, user.id);
      } else {
        for (const uri of postImageUris) {
          const url = await API.uploadPostImage(uri, user.id);
          if (url) uploadedUrls.push(url);
        }
      }

      const saved = await API.createPost({
        user_id: user.id,
        content: content.trim(),
        poll: pollData,
        image_url: uploadedUrls[0] ?? null,
        image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        video_url: uploadedVideoUrl ?? null,
        location: postLocation.trim() || null,
        company_page_id: activeCompany?.id ?? null,
      });
      if (saved) {
        setPosts(prev => prev.map(p => p.id === tempPost.id ? saved : p));
      } else {
        setPosts(prev => prev.filter(p => p.id !== tempPost.id));
        Alert.alert("Erro ao publicar", "Não foi possível criar o post. Verifique sua conexão e tente novamente.");
      }
    } catch {
      setPosts(prev => prev.filter(p => p.id !== tempPost.id));
      Alert.alert("Erro ao publicar", "Verifique sua conexão e tente novamente.");
    } finally {
      setPostContent(""); setPollQuestion(""); setPollOptions(["",""]); setPostMode("text");
      setPostImageUris([]); setPostVideoUri(null); setPostLocation(""); setShowLocationInput(false);
      isPostingRef.current = false;
      setIsPublishing(false);
    }
  };

  const handlePickWineImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de acesso à galeria para selecionar uma foto.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setWineImageUri(result.assets[0].uri);
    }
  };

  const handlePublishWine = async () => {
    setShowWineReview(false);
    if (!wineName.trim() || !user?.id) {
      setWineName(""); setWineSafra(""); setWineStars(4); setWineScore(85);
      setSelectedTags([]); setWineHarmonizacao(""); setWineObs(""); setWineImageUri(null);
      return;
    }

    const stars = "⭐".repeat(wineStars);
    const tags = selectedTags.length > 0 ? `\n🍷 Notas: ${selectedTags.join(", ")}` : "";
    const harmonizacao = wineHarmonizacao.trim() ? `\n🍽️ Harmonização: ${wineHarmonizacao.trim()}` : "";
    const obs = wineObs.trim() ? `\n📝 ${wineObs.trim()}` : "";
    const content = `${stars} ${wineName.trim()}${wineSafra ? ` (${wineSafra})` : ""}\n📊 Pontuação: ${wineScore}/100${tags}${harmonizacao}${obs}`;

    let uploadedImageUrl: string | null = null;
    if (wineImageUri) {
      uploadedImageUrl = await API.uploadPostImage(wineImageUri, user.id);
    }

    const tempPost: Post = {
      id: `tmp_${Date.now()}`,
      user_id: user.id,
      company_page_id: activeCompany?.id ?? null,
      content,
      image_url: wineImageUri ?? null,
      image_urls: wineImageUri ? [wineImageUri] : null,
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
      company_page: activeCompany
        ? { id: activeCompany.id, name: activeCompany.name, avatar_url: activeCompany.avatar_url ?? null }
        : null,
    };
    setPosts(prev => [tempPost, ...prev]);

    const saved = await API.createPost({
      user_id: user.id,
      content,
      image_url: uploadedImageUrl,
      image_urls: uploadedImageUrl ? [uploadedImageUrl] : null,
      company_page_id: activeCompany?.id ?? null,
    });
    if (saved) {
      setPosts(prev => prev.map(p => p.id === tempPost.id ? saved : p));
    } else {
      setPosts(prev => prev.filter(p => p.id !== tempPost.id));
      Alert.alert("Erro ao publicar", "Não foi possível criar o post. Verifique sua conexão e tente novamente.");
    }

    setWineName(""); setWineSafra(""); setWineStars(4); setWineScore(85);
    setSelectedTags([]); setWineHarmonizacao(""); setWineObs(""); setWineImageUri(null);
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
          <Image
            source={require("@/assets/images/logo_light.png")}
            style={{ width: 80, height: 34 }}
            contentFit="contain"
          />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/search" as any)}>
            <Feather name="search" size={22} color={colors.navy} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setUnreadNotifCount(0);
              router.push("/notificacoes" as any);
            }}
          >
            <View>
              <Feather name="bell" size={22} color={colors.navy} />
              {unreadNotifCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: "#e74c3c" }]}>
                  <Text style={styles.notifBadgeText}>
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.plusBtn} onPress={() => setShowCreateMenu(true)} activeOpacity={0.8}>
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAccountMenu(true)}>
            <View style={styles.avatarChevron}>
              {activeCompany ? (
                <View style={[styles.companyAvatar, { backgroundColor: colors.navy }]}>
                  <Text style={[styles.companyAvatarText, { color: colors.gold }]}>{activeCompany.name[0]?.toUpperCase() ?? "E"}</Text>
                </View>
              ) : (
                <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={34} />
              )}
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stories / Momentos — hidden when 'stories' feature flag is off */}
      {isFlagEnabled("stories") && <StoryBar />}

      {/* Greeting */}
      <View style={[styles.greeting, { backgroundColor: "#fff" }]}>
        <Text style={[styles.greetingTitle, { color: colors.navy }]}>Olá, {firstName}</Text>
        <Text style={[styles.greetingSub, { color: colors.mutedForeground }]}>Veja as últimas atualizações</Text>
      </View>

      {/* Sugestões */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestSection, { backgroundColor: "#fff" }]}>
          <View style={styles.suggestHeader}>
            <Text style={[styles.suggestTitle, { color: colors.navy }]}>Pessoas que você pode conhecer</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestScroll}>
            {suggestions.map((s) => {
              const isPending   = s.connection_status === "pending";
              const isConnected = s.connection_status === "connected";
              const isLoading   = connectingId === s.id;
              return (
                <View key={s.id} style={[styles.suggestCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {/* Avatar */}
                  <TouchableOpacity onPress={() => router.push(`/profile/${s.id}` as any)}>
                    <Avatar uri={s.avatar_url} name={s.full_name ?? "?"} size={52} />
                  </TouchableOpacity>

                  {/* Name — tappable */}
                  <TouchableOpacity onPress={() => router.push(`/profile/${s.id}` as any)}>
                    <Text style={[styles.suggestName, { color: colors.navy }]} numberOfLines={1}>
                      {s.full_name ?? s.username ?? "Usuário"}
                    </Text>
                  </TouchableOpacity>

                  {/* Cargo | Empresa */}
                  <Text
                    style={[styles.suggestRole, { color: colors.mutedForeground, opacity: s.headline ? 1 : 0.4 }]}
                    numberOfLines={2}
                  >
                    {s.headline || "—"}
                  </Text>

                  {/* Match badge */}
                  {s.match_score > 0 && (
                    <View style={[styles.matchBadge, { backgroundColor: colors.gold + "18" }]}>
                      <Feather name="zap" size={10} color={colors.gold} />
                      <Text style={[styles.matchBadgeText, { color: colors.gold }]}>{s.match_score} área{s.match_score > 1 ? "s" : ""} em comum</Text>
                    </View>
                  )}

                  {/* Connect button */}
                  {isConnected ? (
                    <View style={[styles.suggestBtnFilled, { backgroundColor: colors.navy + "14" }]}>
                      <Feather name="check" size={12} color={colors.navy} />
                      <Text style={[styles.suggestBtnFilledText, { color: colors.navy }]}>Conectado</Text>
                    </View>
                  ) : isPending ? (
                    <View style={[styles.suggestBtnFilled, { backgroundColor: colors.border }]}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.suggestBtnFilledText, { color: colors.mutedForeground }]}>Enviado</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.suggestBtnFilled, { backgroundColor: colors.navy }, isLoading && { opacity: 0.6 }]}
                      onPress={() => handleConnect(s.id)}
                      disabled={!!connectingId}
                    >
                      <Feather name="user-plus" size={12} color="#fff" />
                      <Text style={[styles.suggestBtnFilledText, { color: "#fff" }]}>
                        {isLoading ? "..." : "Conectar"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

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
        ref={flatListRef}
        style={{ flex: 1 }}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={user?.id}
            isVisible={visiblePostIds.has(item.id)}
            isLiking={likingPostIds.has(item.id)}
            onLike={async (id) => {
              if (likingPostIds.has(id)) return;
              const post = posts.find(p => p.id === id);
              if (!post || !user?.id) return;
              const wasLiked = post.is_liked ?? false;
              const prevCount = post.likes_count;
              setLikingPostIds(prev => new Set([...prev, id]));
              setPosts(prev => prev.map(p => p.id === id
                ? { ...p, is_liked: !wasLiked, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 }
                : p));
              try {
                const ok = await API.toggleLike(id, user.id, wasLiked, activeCompany?.id);
                if (!ok) {
                  setPosts(prev => prev.map(p => p.id === id
                    ? { ...p, is_liked: wasLiked, likes_count: prevCount }
                    : p));
                  Alert.alert("Erro", "Não foi possível curtir. Tente novamente.");
                }
              } catch (e: unknown) {
                setPosts(prev => prev.map(p => p.id === id
                  ? { ...p, is_liked: wasLiked, likes_count: prevCount }
                  : p));
                Alert.alert("Erro de Conexão", friendlyErrorMessage(e));
              } finally {
                setLikingPostIds(prev => { const s = new Set(prev); s.delete(id); return s; });
              }
            }}
            onReact={async (id, reaction) => {
              if (likingPostIds.has(id)) return;
              const post = posts.find(p => p.id === id);
              if (!post || !user?.id) return;
              const prevReaction = post.reaction_type ?? null;
              const prevIsLiked = post.is_liked ?? false;
              const prevCount = post.likes_count;
              const isSameReaction = prevReaction === reaction;
              const wasLiked = !!(prevIsLiked || prevReaction);
              setLikingPostIds(prev => new Set([...prev, id]));
              setPosts(prev => prev.map(p => {
                if (p.id !== id) return p;
                return {
                  ...p,
                  is_liked: !isSameReaction,
                  reaction_type: isSameReaction ? null : reaction,
                  likes_count: isSameReaction
                    ? Math.max(0, p.likes_count - 1)
                    : wasLiked ? p.likes_count : p.likes_count + 1,
                };
              }));
              try {
                const ok = await API.toggleReaction(id, user.id, reaction, prevReaction, activeCompany?.id);
                if (!ok) {
                  setPosts(prev => prev.map(p =>
                    p.id !== id ? p : { ...p, is_liked: prevIsLiked, reaction_type: prevReaction, likes_count: prevCount }
                  ));
                  Alert.alert("Erro", "Não foi possível reagir. Tente novamente.");
                }
              } catch (e: unknown) {
                setPosts(prev => prev.map(p =>
                  p.id !== id ? p : { ...p, is_liked: prevIsLiked, reaction_type: prevReaction, likes_count: prevCount }
                ));
                Alert.alert("Erro de Conexão", friendlyErrorMessage(e));
              } finally {
                setLikingPostIds(prev => { const s = new Set(prev); s.delete(id); return s; });
              }
            }}
            onBookmark={(id) => {
              const post = posts.find(p => p.id === id);
              if (!post || !user?.id) return;
              setPosts(prev => prev.map(p => p.id === id ? { ...p, is_bookmarked: !p.is_bookmarked } : p));
              API.toggleBookmark(id, user.id, post.is_bookmarked ?? false);
            }}
            onViewLikes={(id) => {
              const post = posts.find(p => p.id === id);
              if (post) setLikesModalPost({ id, count: post.likes_count });
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
            onHide={(postId) => {
              setPosts(prev => prev.filter(p => p.id !== postId));
            }}
            onBlock={(blockedUserId) => {
              setPosts(prev => prev.filter(p => p.user_id !== blockedUserId));
            }}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma publicação ainda. Seja o primeiro a compartilhar!
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator color={colors.gold} size="small" />
            </View>
          ) : null
        }
      />

      {/* ── New Posts Banner ── */}
      {newPosts.length > 0 && (
        <Animated.View
          style={[
            styles.newPostsBanner,
            {
              transform: [{ translateY: newPostsBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
              top: topPad + 70,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.newPostsBannerBtn, { backgroundColor: colors.navy }]}
            onPress={handleShowNewPosts}
            activeOpacity={0.85}
          >
            <Feather name="arrow-up" size={14} color="#fff" />
            <Text style={styles.newPostsBannerText}>
              {newPosts.length} novo{newPosts.length > 1 ? "s posts" : " post"} — toque para ver
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

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
                style={[styles.publishBtn, { backgroundColor: isPublishing ? colors.gold + "88" : (postMode === "text" ? (postContent.trim() ? colors.gold : colors.gold + "55") : (pollQuestion.trim() ? colors.gold : colors.gold + "55")), flexDirection: "row", alignItems: "center", gap: 6 }]}
                onPress={handlePublishPost}
                disabled={isPublishing}
              >
                {isPublishing && <ActivityIndicator size="small" color="#fff" />}
                <Text style={styles.publishBtnText}>{isPublishing ? "Publicando..." : "Publicar"}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Author */}
              <View style={styles.postAuthorRow}>
                <Avatar
                  uri={activeCompany ? (activeCompany.avatar_url ?? null) : (profile?.avatar_url ?? null)}
                  name={activeCompany ? activeCompany.name : (profile?.full_name ?? "Você")}
                  size={44}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.postAuthorName, { color: colors.navy }]}>
                    {activeCompany ? activeCompany.name : (profile?.full_name ?? "Você")}
                  </Text>
                  <Text style={[styles.postAuthorRole, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {activeCompany
                      ? (activeCompany.industry ?? "Empresa")
                      : ([profile?.position, profile?.company].filter(Boolean).join(" | ") || profile?.headline || "Membro ibhub")}
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
                      <Text style={[styles.pollLabel, { color: colors.gold }]}>OPÇÕES DA ENQUETE</Text>
                    </View>
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

            {/* Location input */}
            {showLocationInput && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={[styles.locationInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Feather name="map-pin" size={15} color={colors.gold} />
                  <TextInput
                    style={[styles.locationInput, { color: colors.foreground }]}
                    placeholder="Ex: Serra Gaúcha, Rio Grande do Sul"
                    placeholderTextColor={colors.mutedForeground}
                    value={postLocation}
                    onChangeText={setPostLocation}
                    returnKeyType="done"
                    maxLength={80}
                  />
                  {postLocation.length > 0 && (
                    <TouchableOpacity onPress={() => setPostLocation("")}>
                      <Feather name="x" size={15} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Image previews */}
            {postImageUris.length > 0 && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {postImageUris.map((uri, idx) => (
                    <View key={uri} style={{ position: "relative" }}>
                      <Image
                        source={{ uri }}
                        style={{ width: 100, height: 100, borderRadius: 10 }}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        style={{ position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, padding: 3 }}
                        onPress={() => setPostImageUris(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Feather name="x" size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {postImageUris.length < 5 && (
                    <TouchableOpacity
                      style={[styles.addMoreImgBtn, { borderColor: colors.border }]}
                      onPress={handlePickImage}
                    >
                      <Feather name="plus" size={24} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Video preview */}
            {postVideoUri && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ position: "relative" }}>
                  <Video
                    source={{ uri: postVideoUri }}
                    style={{ width: "100%", height: 200, borderRadius: 12 }}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls
                    isLooping={false}
                  />
                  <TouchableOpacity
                    style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 14, padding: 5 }}
                    onPress={() => setPostVideoUri(null)}
                  >
                    <Feather name="x" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Toolbar */}
            <View style={[styles.postToolbar, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={styles.toolbarBtn} onPress={handlePickImage} disabled={!!postVideoUri}>
                <Feather name="image" size={18} color={postImageUris.length > 0 ? colors.gold : postVideoUri ? colors.mutedForeground : colors.foreground} />
                <Text style={[styles.toolbarLabel, { color: postImageUris.length > 0 ? colors.gold : postVideoUri ? colors.mutedForeground : colors.foreground }]}>Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolbarBtn} onPress={handlePickVideo} disabled={postImageUris.length > 0}>
                <Feather name="video" size={18} color={postVideoUri ? colors.gold : postImageUris.length > 0 ? colors.mutedForeground : colors.foreground} />
                <Text style={[styles.toolbarLabel, { color: postVideoUri ? colors.gold : postImageUris.length > 0 ? colors.mutedForeground : colors.foreground }]}>Vídeo</Text>
              </TouchableOpacity>
              {isFlagEnabled("enquetes") && (
                <TouchableOpacity style={styles.toolbarBtn} onPress={() => setPostMode(postMode === "poll" ? "text" : "poll")}>
                  <Feather name="bar-chart-2" size={18} color={postMode === "poll" ? colors.gold : colors.foreground} />
                  <Text style={[styles.toolbarLabel, { color: postMode === "poll" ? colors.gold : colors.foreground }]}>Enquete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.toolbarBtn}
                onPress={() => setShowLocationInput(v => !v)}
              >
                <Feather name="map-pin" size={18} color={postLocation.trim() ? colors.gold : colors.foreground} />
                <Text style={[styles.toolbarLabel, { color: postLocation.trim() ? colors.gold : colors.foreground }]}>Local</Text>
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
              <TouchableOpacity style={[styles.publishBtn, { backgroundColor: wineName.trim() ? colors.gold : colors.gold + "55" }]} onPress={handlePublishWine}>
                <Text style={styles.publishBtnText}>Publicar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 16 }} keyboardShouldPersistTaps="handled">
              {/* Author */}
              <View style={styles.postAuthorRow}>
                <Avatar
                  uri={activeCompany ? (activeCompany.avatar_url ?? null) : (profile?.avatar_url ?? null)}
                  name={activeCompany ? activeCompany.name : (profile?.full_name ?? "Você")}
                  size={44}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.postAuthorName, { color: colors.navy }]}>
                    {activeCompany ? activeCompany.name : (profile?.full_name ?? "Você")}
                  </Text>
                  <Text style={[styles.postAuthorRole, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {activeCompany
                      ? (activeCompany.industry ?? "Empresa")
                      : ([profile?.position, profile?.company].filter(Boolean).join(" | ") || profile?.headline || "Membro ibhub")}
                  </Text>
                </View>
              </View>
              {/* Foto do rótulo */}
              {wineImageUri ? (
                <View style={styles.wineImagePreviewWrap}>
                  <Image source={{ uri: wineImageUri }} style={styles.wineImagePreview} contentFit="cover" />
                  <TouchableOpacity
                    style={styles.wineImageRemoveBtn}
                    onPress={() => setWineImageUri(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.wineImageChangeBtn} onPress={handlePickWineImage}>
                    <Feather name="camera" size={13} color="#fff" />
                    <Text style={styles.wineImageChangeBtnText}>Trocar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.wineImagePlaceholder, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={handlePickWineImage}
                  activeOpacity={0.7}
                >
                  <View style={[styles.wineImagePlaceholderIcon, { backgroundColor: colors.gold + "18" }]}>
                    <Feather name="camera" size={22} color={colors.gold} />
                  </View>
                  <Text style={[styles.wineImagePlaceholderText, { color: colors.navy }]}>Adicionar foto do rótulo</Text>
                  <Text style={[styles.wineImagePlaceholderSub, { color: colors.mutedForeground }]}>Opcional · Aparece no feed</Text>
                </TouchableOpacity>
              )}

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
            {companyPages.length === 0 ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Nenhuma página criada</Text>
              </View>
            ) : (
              companyPages.map((page) => (
                <TouchableOpacity
                  key={page.id}
                  style={[styles.accountRow, activeCompany?.id === page.id && { backgroundColor: colors.background }]}
                  onPress={() => { setActiveCompany({ id: page.id, name: page.name, avatar_url: page.avatar_url, industry: page.industry }); setShowAccountMenu(false); }}
                >
                  {page.avatar_url ? (
                    <Avatar uri={page.avatar_url} name={page.name} size={40} />
                  ) : (
                    <View style={[styles.companyAvatarLg, { backgroundColor: colors.navyMid }]}>
                      <Text style={[styles.companyAvatarTextLg, { color: colors.gold }]}>{page.name[0]?.toUpperCase() ?? "E"}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.accountName, { color: colors.navy }]}>{page.name}</Text>
                    <Text style={[styles.accountSub, { color: colors.mutedForeground }]}>{page.industry ?? "Página empresarial"}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.accountRow}
              onPress={() => {
                setShowAccountMenu(false);
                if (activeCompany) {
                  router.push(`/manage-business-page?id=${activeCompany.id}` as any);
                } else {
                  Alert.alert("Nenhuma página ativa", "Selecione ou crie uma página empresarial acima antes de gerenciar.");
                }
              }}
            >
              <Feather name="briefcase" size={20} color={colors.gold} />
              <Text style={[styles.managePages, { color: colors.gold }]}>Gerenciar Páginas</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Likes modal (quem curtiu) */}
      <LikesModal
        postId={likesModalPost?.id ?? null}
        likesCount={likesModalPost?.count ?? 0}
        visible={!!likesModalPost}
        onClose={() => setLikesModalPost(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  loadingView:        { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer:     { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 32 },
  emptyText:          { fontSize: 15, textAlign: "center", lineHeight: 22 },
  companyBanner:      { paddingVertical: 8, paddingHorizontal: 16, alignItems: "center", borderBottomWidth: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  brandText:          { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  headerActions:      { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn:            { padding: 6 },
  notifBadge:         { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  notifBadgeText:     { color: "#fff", fontSize: 9, fontWeight: "800" },
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
  suggestSection:      { paddingTop: 12, paddingBottom: 14 },
  suggestHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  suggestTitle:        { fontSize: 14, fontWeight: "800" },
  suggestScroll:       { paddingHorizontal: 16, gap: 10 },
  suggestCard:         { width: 128, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 6 },
  suggestName:         { fontSize: 12.5, fontWeight: "700", textAlign: "center" },
  suggestRole:         { fontSize: 10.5, textAlign: "center", lineHeight: 14 },
  matchBadge:          { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  matchBadgeText:      { fontSize: 9.5, fontWeight: "700" },
  suggestBtnFilled:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, marginTop: 2 },
  suggestBtnFilledText:{ fontSize: 11, fontWeight: "700" },
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
  // New posts banner
  newPostsBanner:     { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 100 },
  newPostsBannerBtn:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30, shadowColor: "#000", shadowOpacity: 0.18, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 8 },
  newPostsBannerText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  // Location input
  locationInputRow:   { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  locationInput:      { flex: 1, fontSize: 14 },
  // Add more image button
  addMoreImgBtn:      { width: 100, height: 100, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  // Wine review modal
  wineOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  wineModal:          { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", overflow: "hidden", flex: 1 },
  wineHeaderTitle:    { flexDirection: "row", alignItems: "center", gap: 6 },
  wineFieldLabel:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  wineNameRow:        { flexDirection: "row", gap: 8 },
  wineNameInput:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  wineImagePlaceholder:     { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, paddingVertical: 20, alignItems: "center", gap: 8 },
  wineImagePlaceholderIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  wineImagePlaceholderText: { fontSize: 14, fontWeight: "700" },
  wineImagePlaceholderSub:  { fontSize: 12 },
  wineImagePreviewWrap:     { borderRadius: 12, overflow: "hidden", position: "relative", height: 200 },
  wineImagePreview:         { width: "100%", height: "100%" },
  wineImageRemoveBtn:       { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  wineImageChangeBtn:       { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  wineImageChangeBtnText:   { color: "#fff", fontSize: 12, fontWeight: "600" },
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
