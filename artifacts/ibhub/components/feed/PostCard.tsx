import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { FeedVideo } from "@/components/feed/FeedVideo";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { formatRelativeDate } from "@/utils/dateUtils";
import { AntDesign, Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { WineTastingCard, canParseWine } from "@/components/feed/PostRichContent";
import { PollBlock } from "@/components/feed/PollBlock";
import { useColors } from "@/hooks/useColors";
import { createReport, hidePost, blockUser, checkIsFollowing, toggleFollow } from "@/services/api";
import { PostActionsBar, ReactionIcon, REACTIONS, type ReactionType as SharedReactionType } from "@/components/feed/PostActionsBar";

export { REACTIONS, ReactionPicker, buildPostShareUrl } from "@/components/feed/PostActionsBar";
export type { ReactionType } from "@/components/feed/PostActionsBar";
type ReactionType = SharedReactionType;

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
    allow_multiple?: boolean;
    user_votes?: Record<string, number | number[]>;
    user_voted_index?: number | null;
    user_voted_indices?: number[];
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

const IMG_WIDTH = SCREEN_WIDTH - 28;
const IMG_MAX_HEIGHT = Math.round(IMG_WIDTH * 1.78);
const IMG_DEFAULT_HEIGHT = Math.round(IMG_WIDTH * 0.5625);

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
  onUserPlayVideo?: (postId: string) => void;
  onSwipeNextVideo?: (postId: string) => void;
  onSwipeBackVideo?: (postId: string) => void;
  canSwipeNextVideo?: boolean;
  canSwipeBackVideo?: boolean;
  /** Bumped by the parent feed on each swipe-driven navigation so the
   *  newly-active video can force-play even if it had been user-paused. */
  playToken?: number;
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
  if (/^🍷 Degustação:/m.test(content)) return "wine";
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
      cachePolicy="memory-disk"
      recyclingKey={uri}
      onLoad={(e) => {
        const { width: w, height: h } = e.source;
        if (w > 0 && h > 0) {
          setHeight(Math.round(Math.min(width * (h / w), maxH)));
        }
      }}
      transition={{ duration: 150 }}
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
            key={uri}
            source={{ uri }}
            style={{ width: IMG_WIDTH, height: carouselHeight, borderRadius: 12, backgroundColor: "#0d1b2a08" }}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={uri}
            onLoad={(e) => {
              if (i === 0) {
                const { width: w, height: h } = e.source;
                if (w > 0 && h > 0) {
                  setCarouselHeight(Math.round(Math.min(IMG_WIDTH * (h / w), IMG_MAX_HEIGHT)));
                }
              }
            }}
            transition={{ duration: 150 }}
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


export function PostCard({ post, currentUserId, isVisible = false, onLike, onReact, onBookmark, onComment, onVote, onHide, onBlock, onViewLikes, isLiking = false, onUserPlayVideo, onSwipeNextVideo, onSwipeBackVideo, canSwipeNextVideo = false, canSwipeBackVideo = false, playToken = 0 }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const [showOptions, setShowOptions]           = useState(false);
  const [showReportModal, setShowReportModal]   = useState(false);
  const [selectedReason, setSelectedReason]     = useState<string | null>(null);
  const [reportSending, setReportSending]       = useState(false);
  const [expanded, setExpanded]                 = useState(false);
  const [isFollowing, setIsFollowing]           = useState<boolean | null>(null);

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

  const isBookmarked = post.is_bookmarked ?? false;
  const postType     = detectPostType(post.content ?? "");
  const wineEan      = postType === "wine" ? extractEanFromContent(post.content ?? "") : null;
  const isLong       = (post.content?.length ?? 0) > CONTENT_CUTOFF;
  const displayContent = isLong && !expanded
    ? (post.content ?? "").slice(0, CONTENT_CUTOFF).trimEnd() + "…"
    : (post.content ?? "");

  const currentReaction = post.reaction_type ?? null;
  const reactionInfo = currentReaction ? REACTIONS.find(r => r.type === currentReaction) : null;

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

  const handleVote = (postId: string, optionIndex: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVote?.(postId, optionIndex);
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
          <View style={{ marginTop: 10, marginHorizontal: -14 }}>
            <FeedVideo
              uri={post.video_url}
              isVisible={isVisible}
              width={SCREEN_WIDTH}
              onUserPlay={() => onUserPlayVideo?.(post.id)}
              onSwipeNext={canSwipeNextVideo ? () => onSwipeNextVideo?.(post.id) : undefined}
              onSwipeBack={canSwipeBackVideo ? () => onSwipeBackVideo?.(post.id) : undefined}
              playToken={playToken}
            />
          </View>
        )}
      </Pressable>

      {post.poll && (
        <View style={styles.pollWrap}>
          <PollBlock post={post} onVote={handleVote} />
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

      <PostActionsBar
        post={post}
        onReact={onReact}
        onLike={onLike}
        onComment={onComment}
        onBookmark={onBookmark}
        isLiking={isLiking}
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

});

