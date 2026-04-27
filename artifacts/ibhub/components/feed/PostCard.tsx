import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { formatRelativeDate } from "@/utils/dateUtils";
import { AntDesign, Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { WineTastingCard, canParseWine } from "@/components/feed/PostRichContent";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { createReport, hidePost, blockUser, fetchConversations, sendMessage, checkIsFollowing, toggleFollow } from "@/services/api";
import type { AppConversation } from "@/services/api";

export type ReactionType = "saude" | "bravo" | "destaque" | "incrivel";

export const REACTIONS: { type: ReactionType; emoji: string; iconName: string; iconColor: string; label: string }[] = [
  { type: "saude",    emoji: "🍷", iconName: "glass-wine", iconColor: "#7C3AED", label: "Saúde!" },
  { type: "bravo",    emoji: "👏", iconName: "hand-clap",  iconColor: "#F59E0B", label: "Bravo!" },
  { type: "destaque", emoji: "⭐", iconName: "star",        iconColor: "#EAB308", label: "Destaque!" },
  { type: "incrivel", emoji: "🔥", iconName: "fire",        iconColor: "#EF4444", label: "Incrível!" },
];

export interface Post {
  id: string;
  user_id: string;
  company_page_id?: string | null;
  content: string;
  image_url?: string | null;
  image_urls?: string[] | null;
  video_url?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  view_count?: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  reaction_type?: ReactionType | null;
  created_at: string;
  hashtags?: string[];
  location?: string | null;
  poll?: {
    options: { text: string; votes: number }[];
    total_votes: number;
    closed: boolean;
    expires_at?: string | null;
    user_votes?: Record<string, number>;
    user_voted_index?: number | null;
  };
  author?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url?: string | null;
    headline?: string | null;
    plan?: string;
    is_shadowbanned?: boolean;
  };
  company_page?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  } | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CONTENT_CUTOFF = 220;

const MAX_PORTRAIT_HEIGHT = 560;
const MAX_LANDSCAPE_HEIGHT = 320;

const GOLD = "#c9a84c";

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function VideoPlayer({ videoUrl, isVisible }: { videoUrl: string; isVisible: boolean }) {
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [playing, setPlaying]     = useState(false);
  const [muted, setMuted]         = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]   = useState(0);
  const [barWidth, setBarWidth]   = useState(0);
  const controlsAnim  = useRef(new Animated.Value(1)).current;
  const controlsShown = useRef(true);
  const hideTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoViewRef  = useRef<VideoView>(null);

  const player = useVideoPlayer({ uri: videoUrl }, (p) => {
    p.loop  = true;
    p.muted = true;
  });

  // Auto-play / pause when scroll visibility changes
  useEffect(() => {
    if (isVisible) { player.play(); } else { player.pause(); }
  }, [isVisible, player]);

  // Sync playing state
  useEffect(() => {
    const sub = player.addListener("playingChange", (e) => setPlaying(e.isPlaying));
    return () => sub.remove();
  }, [player]);

  // Sync muted state
  useEffect(() => {
    const sub = player.addListener("mutedChange", (e) => setMuted(e.muted));
    return () => sub.remove();
  }, [player]);

  // Aspect ratio from source
  useEffect(() => {
    const sub = player.addListener("sourceLoad", (e: any) => {
      if (e.duration) setDuration(e.duration);
      const track = (e.availableVideoTracks as any[])?.[0];
      if (track?.size?.width && track?.size?.height) {
        setAspectRatio(track.size.width / track.size.height);
      }
    });
    return () => sub.remove();
  }, [player]);

  // Poll currentTime for progress bar
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(player.currentTime);
      if (!duration && player.duration > 0) setDuration(player.duration);
    }, 250);
    return () => clearInterval(id);
  }, [player, duration]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(controlsAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      controlsShown.current = false;
    }, 3000);
  }, [controlsAnim]);

  const showAndSchedule = useCallback(() => {
    controlsShown.current = true;
    Animated.timing(controlsAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    scheduleHide();
  }, [controlsAnim, scheduleHide]);

  useEffect(() => {
    scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [scheduleHide]);

  const togglePlay = useCallback(() => {
    if (player.playing) { player.pause(); } else { player.play(); }
    showAndSchedule();
  }, [player, showAndSchedule]);

  const toggleMute = useCallback(() => {
    player.muted = !player.muted;
    showAndSchedule();
  }, [player, showAndSchedule]);

  const handleSeek = useCallback((event: { nativeEvent: { locationX: number } }) => {
    if (!barWidth || !duration) return;
    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / barWidth));
    player.seekBy(ratio * duration - player.currentTime);
    showAndSchedule();
  }, [barWidth, duration, player, showAndSchedule]);

  const handlePress = useCallback(() => {
    if (!controlsShown.current) { showAndSchedule(); } else { togglePlay(); }
  }, [showAndSchedule, togglePlay]);

  const isPortrait = aspectRatio < 1;
  const containerHeight = isPortrait
    ? Math.min(IMG_WIDTH / aspectRatio, MAX_PORTRAIT_HEIGHT)
    : Math.min(IMG_WIDTH / aspectRatio, MAX_LANDSCAPE_HEIGHT);
  const fillWidth = duration > 0 ? (currentTime / duration) * barWidth : 0;

  return (
    <View style={[videoStyles.container, { height: containerHeight }]}>
      <VideoView
        ref={videoViewRef}
        player={player}
        contentFit="contain"
        style={videoStyles.video}
        allowsFullscreen
      />

      {/* Touch overlay */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={handlePress}
      >
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: controlsAnim }]}>
          {/* Center play button (only when paused) */}
          {!playing && (
            <View style={videoStyles.centerOverlay}>
              <View style={videoStyles.playBtn}>
                <Feather name="play" size={26} color="#fff" />
              </View>
            </View>
          )}

          {/* Bottom gradient + controls */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={videoStyles.controlsBar}
            pointerEvents="box-none"
          >
            {/* Seek bar */}
            <TouchableOpacity
              activeOpacity={1}
              style={videoStyles.progressHit}
              onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              onPress={handleSeek}
            >
              <View style={videoStyles.progressTrack}>
                <View style={[videoStyles.progressFill, { width: fillWidth }]} />
              </View>
            </TouchableOpacity>

            {/* Buttons row */}
            <View style={videoStyles.buttonsRow}>
              <TouchableOpacity onPress={togglePlay} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
                <Feather name={playing ? "pause" : "play"} size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleMute} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
                <Feather name={muted ? "volume-x" : "volume-2"} size={16} color="#fff" />
              </TouchableOpacity>
              <Text style={videoStyles.timeText}>{fmtTime(currentTime)} / {fmtTime(duration)}</Text>
              <TouchableOpacity
                onPress={() => { videoViewRef.current?.enterFullscreen(); showAndSchedule(); }}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              >
                <Feather name="maximize" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const videoStyles = StyleSheet.create({
  container: {
    marginTop: 10,
    width: IMG_WIDTH,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  centerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },
  controlsBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  progressHit: {
    paddingVertical: 8,
    marginBottom: 2,
  },
  progressTrack: {
    height: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: GOLD,
    borderRadius: 3,
  },
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeText: {
    color: "#fff",
    fontSize: 11,
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
});

interface PostCardProps {
  onHide?: (postId: string) => void;
  onBlock?: (userId: string) => void;
  post: Post;
  currentUserId?: string | null;
  isVisible?: boolean;
  onLike?: (postId: string) => void;
  onReact?: (postId: string, reaction: ReactionType) => void;
  onBookmark?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onVote?: (postId: string, optionIndex: number) => void;
  onViewLikes?: (postId: string) => void;
  isLiking?: boolean;
}

function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function pollIsExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function pollExpiryLabel(expiresAt?: string | null): string {
  if (!expiresAt) return "";
  const d = new Date(expiresAt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return "Encerrada";
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 24) return `Encerra em ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Encerra em ${diffD} dia${diffD !== 1 ? "s" : ""}`;
}

function detectPostType(content: string): "wine" | "poll" | "text" {
  if (/^⭐/.test(content) && /Pontuação/.test(content)) return "wine";
  return "text";
}

/** Extrai o EAN do conteúdo de um post de degustação, se presente. */
function extractEanFromContent(content: string): string | null {
  const match = content.match(/🏷️ EAN: (\d+)/);
  return match ? match[1] : null;
}

function PlanBadge({ plan, colors }: { plan?: string; colors: any }) {
  if (!plan || plan === "basico") return null;
  const map: Record<string, { label: string; color: string }> = {
    business:  { label: "Pro",        color: colors.gold },
    exclusive: { label: "Exclusivo",  color: "#8e44ad" },
    premium:   { label: "Premium",    color: colors.navyMid ?? "#1e3a5f" },
  };
  const badge = map[plan];
  if (!badge) return null;
  return (
    <View style={[styles.planBadge, { backgroundColor: badge.color + "18", borderColor: badge.color + "55" }]}>
      <Text style={[styles.planBadgeText, { color: badge.color }]}>{badge.label}</Text>
    </View>
  );
}

const IMG_WIDTH = SCREEN_WIDTH - 28;
const IMG_MAX_HEIGHT = Math.round(IMG_WIDTH * 1.78); // allow up to ~9:16 portrait
const IMG_DEFAULT_HEIGHT = Math.round(IMG_WIDTH * 0.5625); // 16:9 landscape default

/** Renders a single image at its natural aspect ratio (no cropping). */
export function AdaptiveImage({
  uri,
  width = IMG_WIDTH,
  priority = "normal",
  style,
}: {
  uri: string;
  width?: number;
  priority?: "high" | "normal" | "low";
  style?: object;
}) {
  const maxH = Math.round(width * 1.78);
  const [height, setHeight] = useState(Math.round(width * 0.5625));
  return (
    <Image
      source={{ uri }}
      style={[{ width, height, borderRadius: 12, backgroundColor: "#0d1b2a08" }, style]}
      contentFit="contain"
      onLoad={(e) => {
        const { width: w, height: h } = e.source;
        if (w > 0 && h > 0) {
          setHeight(Math.round(Math.min(width * (h / w), maxH)));
        }
      }}
      placeholder={{ color: "#e8edf2" }}
      transition={{ duration: 250 }}
      priority={priority}
    />
  );
}

function ImageCarousel({ imageUrls }: { imageUrls: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselHeight, setCarouselHeight] = useState(IMG_DEFAULT_HEIGHT);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / IMG_WIDTH);
    setCurrentIndex(idx);
  };

  if (imageUrls.length === 1) {
    return (
      <AdaptiveImage
        uri={imageUrls[0]}
        priority="high"
        style={{ marginTop: 10 }}
      />
    );
  }

  return (
    <View style={styles.carouselWrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={[styles.carouselScroll, { height: carouselHeight }]}
      >
        {imageUrls.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{ width: IMG_WIDTH, height: carouselHeight, borderRadius: 12, backgroundColor: "#0d1b2a08" }}
            contentFit="contain"
            onLoad={(e) => {
              if (i === 0) {
                const { width: w, height: h } = e.source;
                if (w > 0 && h > 0) {
                  setCarouselHeight(Math.round(Math.min(IMG_WIDTH * (h / w), IMG_MAX_HEIGHT)));
                }
              }
            }}
            placeholder={{ color: "#e8edf2" }}
            transition={{ duration: 250 }}
            priority={i === 0 ? "high" : "normal"}
          />
        ))}
      </ScrollView>
      <View style={styles.dotsRow}>
        {imageUrls.map((_, i) => (
          <View key={i} style={[styles.dot, i === currentIndex ? styles.dotActive : styles.dotInactive]} />
        ))}
      </View>
    </View>
  );
}

const REPORT_REASONS = ["Spam", "Conteúdo ofensivo", "Informação falsa", "Assédio", "Outro"];

function ReactionIcon({ iconName, iconColor, size }: { iconName: string; iconColor: string; size: number }) {
  return <MaterialCommunityIcons name={iconName as any} size={size} color={iconColor} />;
}

function ReactionPicker({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (r: ReactionType) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.reactionOverlay} onPress={onClose}>
        <View style={styles.reactionPicker}>
          {REACTIONS.map((r) => (
            <TouchableOpacity
              key={r.type}
              style={styles.reactionBtn}
              onPress={() => { onSelect(r.type); onClose(); }}
              activeOpacity={0.7}
            >
              <ReactionIcon iconName={r.iconName} iconColor={r.iconColor} size={28} />
              <Text style={styles.reactionLabel}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

export function PostCard({ post, currentUserId, isVisible = false, onLike, onReact, onBookmark, onComment, onVote, onHide, onBlock, onViewLikes, isLiking = false }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [showOptions, setShowOptions]           = useState(false);
  const [showReportModal, setShowReportModal]   = useState(false);
  const [selectedReason, setSelectedReason]     = useState<string | null>(null);
  const [reportSending, setReportSending]       = useState(false);
  const [expanded, setExpanded]                 = useState(false);
  const [showReactions, setShowReactions]       = useState(false);
  const [showShareSheet, setShowShareSheet]     = useState(false);
  const [showShareChat, setShowShareChat]       = useState(false);
  const [conversations, setConversations]       = useState<AppConversation[]>([]);
  const [loadingConvos, setLoadingConvos]       = useState(false);
  const [sendingToConvo, setSendingToConvo]     = useState<string | null>(null);
  const [isFollowing, setIsFollowing]           = useState<boolean | null>(null);
  // Track the last reaction used so tap can toggle it back on after removal
  const lastUsedReaction = useRef<ReactionType>("saude");

  const isUserPost = !post.company_page_id && !!post.author?.id && post.author.id !== currentUserId;

  useEffect(() => {
    if (!isUserPost || !currentUserId || !post.author?.id) return;
    let cancelled = false;
    checkIsFollowing(post.author.id, currentUserId).then((following) => {
      if (!cancelled) setIsFollowing(following);
    });
    return () => { cancelled = true; };
  }, [post.author?.id, currentUserId, isUserPost]);

  const handleFollow = async () => {
    if (!currentUserId || !post.author?.id || isFollowing) return;
    setIsFollowing(true);
    try {
      await toggleFollow(post.author.id, currentUserId, false);
    } catch {
      setIsFollowing(false);
    }
  };

  const likeScale = useRef(new Animated.Value(1)).current;

  const isLiked      = post.is_liked      ?? false;
  const isBookmarked = post.is_bookmarked ?? false;
  const postType     = detectPostType(post.content ?? "");
  const wineEan      = postType === "wine" ? extractEanFromContent(post.content ?? "") : null;
  const isLong       = (post.content?.length ?? 0) > CONTENT_CUTOFF;
  const displayContent = isLong && !expanded
    ? (post.content ?? "").slice(0, CONTENT_CUTOFF).trimEnd() + "…"
    : (post.content ?? "");

  const currentReaction = post.reaction_type ?? null;
  const reactionInfo = currentReaction ? REACTIONS.find(r => r.type === currentReaction) : null;

  // Keep lastUsedReaction in sync when post has a reaction
  if (currentReaction) {
    lastUsedReaction.current = currentReaction;
  }

  const allImageUrls = (() => {
    const urls: string[] = [];
    const rawUrls = post.image_urls;
    if (Array.isArray(rawUrls) && rawUrls.length > 0) {
      urls.push(...rawUrls);
    } else if (typeof (rawUrls as unknown) === "string") {
      const rawStr = rawUrls as unknown as string;
      if (rawStr.trim().startsWith("[")) {
        try {
          const parsed: unknown = JSON.parse(rawStr);
          if (Array.isArray(parsed)) urls.push(...(parsed as string[]));
        } catch {}
      }
    }
    if (urls.length === 0 && post.image_url) {
      urls.push(post.image_url);
    }
    return urls;
  })();

  const animateLike = () => {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.35, useNativeDriver: true, speed: 40 }),
      Animated.spring(likeScale, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();
  };

  const handleLike = () => {
    animateLike();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onReact) {
      // Reaction-first flow: toggle the last used (or current) reaction
      onReact(post.id, lastUsedReaction.current);
    } else {
      // Legacy fallback for screens that don't support reactions yet
      onLike?.(post.id);
    }
  };

  const handleLongPress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowReactions(true);
  };

  const handleReactionSelect = (reaction: ReactionType) => {
    lastUsedReaction.current = reaction;
    animateLike();
    onReact?.(post.id, reaction);
  };

  const handleBookmark = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBookmark?.(post.id);
  };

  const WEB_BASE = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/web`
    : (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/api$/, "");

  const handleShare = async () => {
    const postUrl = `${WEB_BASE}/p/${post.id}`;
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(postUrl);
        Alert.alert("Link copiado!", "Link da publicação copiado para a área de transferência.");
      } catch {
        Alert.alert("Erro", "Não foi possível copiar o link. Copie manualmente: " + postUrl);
      }
      return;
    }
    try {
      await Share.share({
        message: `Veja esta publicação no ibhub:\n\n${post.content?.slice(0, 120) ?? ""}\n\n${postUrl}`,
        url: postUrl,
        title: "Compartilhar publicação",
      });
    } catch {}
  };

  const openShareToChat = useCallback(async () => {
    if (!user?.id) return;
    setShowShareChat(true);
    setLoadingConvos(true);
    const convos = await fetchConversations(user.id);
    setConversations(convos.filter(c => c.accepted !== false));
    setLoadingConvos(false);
  }, [user?.id]);

  const sendToConversation = async (convoId: string) => {
    if (!user?.id || sendingToConvo) return;
    setSendingToConvo(convoId);
    await sendMessage(convoId, user.id, post.content?.slice(0, 200) ?? "Publicação compartilhada", {
      message_type: "post_share",
      metadata: {
        post_id: post.id,
        content: post.content?.slice(0, 300) ?? "",
        image_url: post.image_url ?? null,
        author_name: post.author?.full_name ?? null,
      },
    });
    setSendingToConvo(null);
    setShowShareChat(false);
    Alert.alert("Compartilhado!", "Publicação enviada com sucesso.");
  };

  const handleSubmitReport = async () => {
    if (!selectedReason || !currentUserId) return;
    setReportSending(true);
    const ok = await createReport({
      post_id: post.id,
      reported_by: currentUserId,
      reason: selectedReason,
    });
    setReportSending(false);
    setShowReportModal(false);
    setSelectedReason(null);
    if (ok) {
      Alert.alert("Denúncia enviada", "Obrigado pelo seu feedback. Nossa equipe irá analisar.");
    } else {
      Alert.alert("Erro", "Não foi possível enviar a denúncia. Tente novamente.");
    }
  };

  const handleVote = (optionIndex: number) => {
    if (post.poll?.closed || post.poll?.user_voted_index != null) return;
    if (pollIsExpired(post.poll?.expires_at)) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVote?.(post.id, optionIndex);
  };

  const author = post.author;
  const companyPage = post.company_page ?? null;
  const displayAvatar = companyPage ? companyPage.avatar_url : author?.avatar_url;
  const displayName   = companyPage ? companyPage.name : (author?.full_name ?? "Usuário");
  const displayPressTarget = companyPage
    ? () => router.push(`/empresa/${companyPage.id}` as any)
    : () => {
        if (!author?.id) return;
        if (author.id === currentUserId) {
          router.push("/(tabs)/profile" as any);
        } else {
          router.push(`/profile/${author.id}` as any);
        }
      };

  const likeButtonColor = reactionInfo ? reactionInfo.iconColor : isLiked ? "#e74c3c" : colors.border;
  const likeButtonLabel = reactionInfo ? reactionInfo.label : isLiked ? "Curtido" : "Curtir";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

      {postType === "wine" && (
        <TouchableOpacity
          style={[styles.wineBadge, { backgroundColor: colors.gold + "18" }]}
          onPress={() => router.push({ pathname: "/wine-ranking" as any, params: wineEan ? { ean: wineEan } : {} })}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="glass-wine" size={13} color={colors.gold} />
          <Text style={[styles.wineBadgeText, { color: colors.gold }]}>Avaliação de Vinho</Text>
          {wineEan ? (
            <Text style={[styles.wineBadgeText, { color: colors.gold, opacity: 0.7 }]}>· Ver ranking ↗</Text>
          ) : (
            <Text style={[styles.wineBadgeText, { color: colors.gold, opacity: 0.7 }]}>· Ranking comunitário ↗</Text>
          )}
        </TouchableOpacity>
      )}

      <View style={styles.header}>
        <Pressable
          style={styles.authorRow}
          onPress={displayPressTarget}
        >
          <Avatar uri={displayAvatar} name={displayName} size={46} />
          <View style={styles.authorMeta}>
            <View style={styles.nameRow}>
              <Text style={[styles.authorName, { color: colors.foreground }]} numberOfLines={1}>
                {displayName}
              </Text>
              {companyPage ? (
                <View style={[styles.planBadge, { backgroundColor: colors.gold + "18", borderColor: colors.gold + "55" }]}>
                  <Text style={[styles.planBadgeText, { color: colors.gold }]}>Empresa</Text>
                </View>
              ) : (
                <PlanBadge plan={author?.plan} colors={colors} />
              )}
            </View>
            {!companyPage && author?.headline ? (
              <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={1}>
                {author.headline}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
                {formatRelativeDate(post.created_at)}
              </Text>
              {post.location ? (
                <>
                  <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>·</Text>
                  <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {post.location}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          {isUserPost && isFollowing === false && (
            <TouchableOpacity
              style={[styles.followBtn, { borderColor: colors.gold }]}
              onPress={handleFollow}
            >
              <Text style={[styles.followBtnText, { color: colors.gold }]}>+ Seguir</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.moreBtn} onPress={() => setShowOptions(true)}>
            <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <Pressable onPress={() => router.push(`/post/${post.id}` as any)} style={styles.contentWrap}>
        {post.content ? (
          postType === "wine" && canParseWine(post.content) ? (
            <WineTastingCard content={post.content} />
          ) : (
            <>
              <Text style={[styles.content, { color: colors.foreground }]}>
                {displayContent}
              </Text>
              {isLong && (
                <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                  <Text style={[styles.seeMore, { color: colors.gold }]}>
                    {expanded ? "Ver menos" : "Ver mais"}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )
        ) : null}

        {post.hashtags && post.hashtags.length > 0 && (
          <View style={styles.hashtags}>
            {post.hashtags.slice(0, 5).map((tag) => (
              <TouchableOpacity key={tag}>
                <Text style={[styles.hashtag, { color: "#3498db" }]}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {allImageUrls.length > 0 && (
          <ImageCarousel imageUrls={allImageUrls} />
        )}

        {post.video_url && (
          <VideoPlayer videoUrl={post.video_url} isVisible={isVisible} />
        )}
      </Pressable>

      {post.poll && (
        <View style={styles.pollWrap}>
          {post.poll.options.map((opt, i) => {
            const total    = post.poll!.total_votes;
            const pct      = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
            const hasVoted = post.poll!.user_voted_index != null;
            const isMyVote = post.poll!.user_voted_index === i;
            const isWinner = hasVoted && opt.votes === Math.max(...post.poll!.options.map(o => o.votes)) && opt.votes > 0;

            return (
              <TouchableOpacity
                key={i}
                activeOpacity={hasVoted || post.poll!.closed ? 1 : 0.75}
                onPress={() => handleVote(i)}
                style={[
                  styles.pollOption,
                  {
                    borderColor: isMyVote
                      ? colors.gold
                      : isWinner
                      ? colors.navy + "80"
                      : colors.border,
                    borderWidth: isMyVote || isWinner ? 1.5 : 1,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                {hasVoted && pct > 0 && (
                  <View
                    style={[
                      styles.pollFill,
                      {
                        width: `${pct}%` as any,
                        backgroundColor: isMyVote ? colors.gold + "30" : colors.secondary,
                      },
                    ]}
                  />
                )}
                <View style={styles.pollRow}>
                  <View style={styles.pollLeft}>
                    {isMyVote ? (
                      <AntDesign name={"checkcircle" as any} size={15} color={colors.gold} style={{ marginRight: 7 }} />
                    ) : hasVoted && isWinner ? (
                      <AntDesign name="trophy" size={15} color={colors.navy} style={{ marginRight: 7 }} />
                    ) : null}
                    <Text
                      style={[
                        styles.pollOptionText,
                        { color: colors.foreground, fontWeight: isMyVote ? "700" : "500" },
                      ]}
                    >
                      {opt.text}
                    </Text>
                  </View>
                  {hasVoted && (
                    <Text style={[styles.pollPct, { color: isMyVote ? colors.gold : colors.mutedForeground, fontWeight: isMyVote ? "700" : "400" }]}>
                      {pct}%
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.pollFooter}>
            <MaterialCommunityIcons name="poll" size={13} color={colors.mutedForeground} />
            <Text style={[styles.pollFooterText, { color: colors.mutedForeground }]}>
              {post.poll.total_votes} {post.poll.total_votes === 1 ? "voto" : "votos"}
              {post.poll.user_voted_index == null && !post.poll.closed && !pollIsExpired(post.poll.expires_at) ? "  ·  Toque para votar" : ""}
            </Text>
            {post.poll.expires_at && !post.poll.closed && (
              <Text style={[styles.pollFooterText, { color: colors.mutedForeground, marginLeft: 4 }]}>
                · {pollExpiryLabel(post.poll.expires_at)}
              </Text>
            )}
            <View style={{ flex: 1 }} />
            {(post.poll.closed || pollIsExpired(post.poll.expires_at)) && (
              <View style={[styles.closedBadge, { backgroundColor: colors.border + "80" }]}>
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={[styles.closedText, { color: colors.mutedForeground }]}>Encerrada</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {(post.likes_count > 0 || post.comments_count > 0 || post.shares_count > 0 || (post.view_count ?? 0) > 0) && (
        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          {post.likes_count > 0 && (
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => onViewLikes?.(post.id)}
              activeOpacity={onViewLikes ? 0.6 : 1}
              disabled={!onViewLikes}
            >
              <View style={[styles.statIcon, { backgroundColor: reactionInfo ? reactionInfo.iconColor : "#e74c3c" }]}>
                {reactionInfo
                  ? <ReactionIcon iconName={reactionInfo.iconName} iconColor="#fff" size={10} />
                  : <AntDesign name="heart" size={9} color="#fff" />
                }
              </View>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {fmtCount(post.likes_count)}
              </Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {(post.view_count ?? 0) > 0 && (
            <View style={styles.statItem}>
              <Feather name="eye" size={12} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {fmtCount(post.view_count!)} {post.view_count === 1 ? "visualização" : "visualizações"}
              </Text>
            </View>
          )}
          {post.comments_count > 0 && (
            <>
              {(post.view_count ?? 0) > 0 && <Text style={[styles.statDot, { color: colors.mutedForeground }]}>·</Text>}
              <TouchableOpacity onPress={() => onComment?.(post.id)}>
                <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                  {fmtCount(post.comments_count)} comentário{post.comments_count !== 1 ? "s" : ""}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {post.comments_count > 0 && post.shares_count > 0 && (
            <Text style={[styles.statDot, { color: colors.mutedForeground }]}>·</Text>
          )}
          {post.shares_count > 0 && (
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>
              {fmtCount(post.shares_count)} compartilhamento{post.shares_count !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      )}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>

        <TouchableOpacity
          style={styles.action}
          onPress={isLiking ? undefined : handleLike}
          onLongPress={isLiking ? undefined : handleLongPress}
          delayLongPress={450}
          activeOpacity={isLiking ? 1 : 0.7}
          disabled={isLiking}
        >
          {isLiking ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              {reactionInfo ? (
                <ReactionIcon iconName={reactionInfo.iconName} iconColor={reactionInfo.iconColor} size={22} />
              ) : (
                <AntDesign
                  name="heart"
                  size={22}
                  color={likeButtonColor}
                />
              )}
            </Animated.View>
          )}
          <Text style={[styles.actionLabel, { color: (isLiked || reactionInfo) ? "#e74c3c" : colors.mutedForeground, fontWeight: (isLiked || reactionInfo) ? "700" : "400", opacity: isLiking ? 0.5 : 1 }]}>
            {likeButtonLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onComment?.(post.id)} activeOpacity={0.7}>
          <MaterialCommunityIcons name="comment-outline" size={22} color={colors.mutedForeground} />
          <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>Comentar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => setShowShareSheet(true)} activeOpacity={0.7}>
          <MaterialCommunityIcons name="share-variant-outline" size={22} color={colors.mutedForeground} />
          <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>Compartilhar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.action, { marginLeft: "auto" }]} onPress={handleBookmark} activeOpacity={0.7}>
          <MaterialCommunityIcons
            name={isBookmarked ? "bookmark" : "bookmark-outline"}
            size={23}
            color={isBookmarked ? colors.gold : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      <ReactionPicker
        visible={showReactions}
        onSelect={handleReactionSelect}
        onClose={() => setShowReactions(false)}
      />

      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowOptions(false)}>
          <View style={[styles.menu, { backgroundColor: "#fff" }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowOptions(false); setSelectedReason(null); setShowReportModal(true); }}
            >
              <Feather name="flag" size={16} color="#374151" />
              <Text style={[styles.menuText, { color: "#374151" }]}>Denunciar publicação</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: "#f3f4f6" }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowOptions(false);
                if (currentUserId) hidePost(currentUserId, post.id);
                onHide?.(post.id);
                Alert.alert("Pronto", "Veremos menos publicações assim para você.");
              }}
            >
              <Feather name="eye-off" size={16} color="#374151" />
              <Text style={[styles.menuText, { color: "#374151" }]}>Não tenho interesse</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: "#f3f4f6" }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowOptions(false);
                Alert.alert(
                  "Bloquear usuário",
                  "Você não verá mais publicações desta pessoa e ela não poderá interagir com você.",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Bloquear",
                      style: "destructive",
                      onPress: () => {
                        if (currentUserId) blockUser(currentUserId, post.user_id);
                        onBlock?.(post.user_id);
                      },
                    },
                  ],
                );
              }}
            >
              <Feather name="slash" size={16} color="#dc2626" />
              <Text style={[styles.menuText, { color: "#dc2626" }]}>Bloquear usuário</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Share Options Sheet ── */}
      <Modal visible={showShareSheet} transparent animationType="slide" onRequestClose={() => setShowShareSheet(false)}>
        <Pressable style={shareStyles.overlay} onPress={() => setShowShareSheet(false)}>
          <Pressable style={[shareStyles.sheet, { backgroundColor: "#fff" }]}>
            <View style={[shareStyles.handle, { backgroundColor: "#e5e7eb" }]} />
            <Text style={[shareStyles.title, { color: "#0d1b2a" }]}>Compartilhar</Text>

            <TouchableOpacity
              style={shareOptionStyles.option}
              onPress={() => { setShowShareSheet(false); openShareToChat(); }}
            >
              <View style={[shareOptionStyles.iconWrap, { backgroundColor: "#e0f2fe" }]}>
                <Feather name="send" size={20} color="#0284c7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={shareOptionStyles.label}>Enviar no chat</Text>
                <Text style={shareOptionStyles.sub}>Envie para uma conversa existente</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={shareOptionStyles.option}
              onPress={async () => {
                setShowShareSheet(false);
                const postUrl = `${WEB_BASE}/p/${post.id}`;
                const text = `Veja esta publicação no ibhub:\n\n${post.content?.slice(0, 120) ?? ""}\n\n${postUrl}`;
                const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
                const canOpen = await Linking.canOpenURL(whatsappUrl);
                if (canOpen) {
                  Linking.openURL(whatsappUrl);
                } else {
                  Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
                }
              }}
            >
              <View style={[shareOptionStyles.iconWrap, { backgroundColor: "#dcfce7" }]}>
                <MaterialCommunityIcons name="whatsapp" size={20} color="#16a34a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={shareOptionStyles.label}>WhatsApp</Text>
                <Text style={shareOptionStyles.sub}>Compartilhe pelo WhatsApp</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={shareOptionStyles.option}
              onPress={async () => {
                setShowShareSheet(false);
                const postUrl = `${WEB_BASE}/p/${post.id}`;
                const canOpen = await Linking.canOpenURL("instagram://");
                if (canOpen) {
                  await Share.share({ message: postUrl, url: postUrl });
                } else {
                  Linking.openURL("https://www.instagram.com/");
                }
              }}
            >
              <View style={[shareOptionStyles.iconWrap, { backgroundColor: "#fce7f3" }]}>
                <Feather name="instagram" size={20} color="#db2777" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={shareOptionStyles.label}>Instagram</Text>
                <Text style={shareOptionStyles.sub}>Compartilhe pelo Instagram</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={shareOptionStyles.option}
              onPress={() => { setShowShareSheet(false); handleShare(); }}
            >
              <View style={[shareOptionStyles.iconWrap, { backgroundColor: "#f3f4f6" }]}>
                <Feather name="link" size={20} color="#374151" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={shareOptionStyles.label}>Copiar link</Text>
                <Text style={shareOptionStyles.sub}>Copie o link para compartilhar</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Share to Chat Modal ── */}
      <Modal visible={showShareChat} transparent animationType="slide" onRequestClose={() => setShowShareChat(false)}>
        <Pressable style={shareStyles.overlay} onPress={() => setShowShareChat(false)}>
          <Pressable style={[shareStyles.sheet, { backgroundColor: "#fff" }]}>
            <View style={[shareStyles.handle, { backgroundColor: "#e5e7eb" }]} />
            <Text style={[shareStyles.title, { color: "#0d1b2a" }]}>Compartilhar no Chat</Text>
            {loadingConvos ? (
              <View style={shareStyles.loadingWrap}>
                <ActivityIndicator size="large" color="#c9a84c" />
              </View>
            ) : conversations.length === 0 ? (
              <View style={shareStyles.emptyWrap}>
                <Feather name="message-circle" size={36} color="#9ca3af" />
                <Text style={shareStyles.emptyText}>Nenhuma conversa disponível</Text>
              </View>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 350 }}
                renderItem={({ item }) => {
                  const name = item.name ?? item.participant?.full_name ?? "Chat";
                  const isSending = sendingToConvo === item.id;
                  return (
                    <TouchableOpacity
                      style={shareStyles.convoRow}
                      onPress={() => sendToConversation(item.id)}
                      disabled={!!sendingToConvo}
                    >
                      <Avatar uri={item.participant?.avatar_url ?? null} name={name} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={shareStyles.convoName} numberOfLines={1}>{name}</Text>
                        {item.last_message && (
                          <Text style={shareStyles.convoMsg} numberOfLines={1}>{item.last_message}</Text>
                        )}
                      </View>
                      {isSending
                        ? <ActivityIndicator size="small" color="#c9a84c" />
                        : <Feather name="send" size={18} color="#c9a84c" />
                      }
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Report Modal ── */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowReportModal(false)}>
          <Pressable style={[styles.reportModal, { backgroundColor: "#fff" }]}>
            <View style={styles.reportHeader}>
              <Text style={[styles.reportTitle, { color: "#0d1b2a" }]}>Denunciar publicação</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Feather name="x" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.reportSubtitle, { color: "#6b7280" }]}>Selecione o motivo da denúncia:</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reportReasonItem,
                  { borderColor: selectedReason === reason ? "#c9a84c" : "#e5e7eb" },
                  selectedReason === reason && { backgroundColor: "#fdf6e3" },
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <View style={[styles.reportRadio, { borderColor: selectedReason === reason ? "#c9a84c" : "#d1d5db" }]}>
                  {selectedReason === reason && <View style={[styles.reportRadioInner, { backgroundColor: "#c9a84c" }]} />}
                </View>
                <Text style={[styles.reportReasonText, { color: "#111827" }]}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.reportSubmit,
                { backgroundColor: selectedReason ? "#c9a84c" : "#e5e7eb" },
              ]}
              onPress={handleSubmitReport}
              disabled={!selectedReason || reportSending}
            >
              <Text style={[styles.reportSubmitText, { color: selectedReason ? "#fff" : "#9ca3af" }]}>
                {reportSending ? "Enviando…" : "Enviar denúncia"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: 8,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 0,
    marginBottom: 0,
  },

  wineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5c97760",
  },
  wineBadgeIcon:  { fontSize: 13 },
  wineBadgeText:  { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  authorRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  authorMeta:   { flex: 1, gap: 1 },
  nameRow:      { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  authorName:   { fontSize: 15, fontWeight: "700" },
  headline:     { fontSize: 12.5, lineHeight: 17 },
  metaRow:      { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  timeAgo:      { fontSize: 11.5, marginTop: 1 },
  metaDot:      { fontSize: 11.5 },
  locationText: { fontSize: 11.5, flex: 1 },

  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  planBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  headerActions: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 },
  followBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5 },
  followBtnText: { fontSize: 12.5, fontWeight: "700" },
  moreBtn:       { padding: 4 },

  contentWrap: { paddingHorizontal: 14, paddingBottom: 10 },
  content:     { fontSize: 15, lineHeight: 23, letterSpacing: 0.1 },
  seeMore:     { fontSize: 14, fontWeight: "600", marginTop: 4 },
  hashtags:    { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  hashtag:     { fontSize: 14, fontWeight: "600" },
  carouselWrap: {
    marginTop: 10,
  },
  carouselScroll: {
    width: IMG_WIDTH,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    gap: 5,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    width: 18,
    backgroundColor: "#c9a84c",
  },
  dotInactive: {
    width: 7,
    backgroundColor: "#d1d5db",
  },

  pollWrap:       { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  pollOption:     { borderWidth: 1, borderRadius: 10, height: 48, overflow: "hidden", position: "relative", justifyContent: "center" },
  pollFill:       { position: "absolute", left: 0, top: 0, bottom: 0 },
  pollRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, flex: 1 },
  pollLeft:       { flexDirection: "row", alignItems: "center", flex: 1 },
  pollOptionText: { fontSize: 14.5 },
  pollPct:        { fontSize: 14, minWidth: 38, textAlign: "right" },
  pollFooter:     { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  pollFooterText: { fontSize: 12 },
  closedBadge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  closedText:     { fontSize: 11 },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  statItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  statIcon: { width: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  statText: { fontSize: 12.5 },
  statDot:  { fontSize: 12.5 },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionLabel: { fontSize: 13, fontWeight: "500" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)" },
  menu: {
    position: "absolute",
    top: 100,
    right: 16,
    width: 240,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 12,
  },
  menuItem:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 16 },
  menuText:    { fontSize: 14.5, fontWeight: "600" },
  menuDivider: { height: 1 },

  reportModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 16,
  },
  reportHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  reportTitle:       { fontSize: 17, fontWeight: "700" },
  reportSubtitle:    { fontSize: 13, marginBottom: 4 },
  reportReasonItem:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, borderWidth: 1.5 },
  reportRadio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  reportRadioInner:  { width: 10, height: 10, borderRadius: 5 },
  reportReasonText:  { fontSize: 14.5, fontWeight: "500" },
  reportSubmit:      { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 4 },
  reportSubmitText:  { fontSize: 15, fontWeight: "700" },

  reactionOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "flex-end",
    paddingBottom: 100,
    paddingHorizontal: 14,
  },
  reactionPicker: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 50,
    padding: 10,
    gap: 6,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10,
  },
  reactionBtn: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  reactionEmoji: { fontSize: 28 },
  reactionLabel: { fontSize: 10, fontWeight: "600", color: "#374151" },
});

const shareOptionStyles = StyleSheet.create({
  option:   { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  label:    { fontSize: 15, fontWeight: "700", color: "#0d1b2a" },
  sub:      { fontSize: 12, color: "#9ca3af", marginTop: 1 },
});

const shareStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  title:       { fontSize: 16, fontWeight: "700" },
  loadingWrap: { alignItems: "center", paddingVertical: 40 },
  emptyWrap:   { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyText:   { fontSize: 14, color: "#9ca3af" },
  convoRow:    { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  convoName:   { fontSize: 14, fontWeight: "700", color: "#0d1b2a" },
  convoMsg:    { fontSize: 12, color: "#9ca3af", marginTop: 2 },
});
