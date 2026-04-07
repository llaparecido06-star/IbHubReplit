import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AntDesign, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { createReport } from "@/services/api";

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  created_at: string;
  hashtags?: string[];
  poll?: {
    options: { text: string; votes: number }[];
    total_votes: number;
    closed: boolean;
    user_voted_index?: number | null;
  };
  author?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url?: string | null;
    headline?: string | null;
    plan?: string;
  };
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CONTENT_CUTOFF = 220; // chars before "Ver mais"

interface PostCardProps {
  post: Post;
  currentUserId?: string | null;
  onLike?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onVote?: (postId: string, optionIndex: number) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function detectPostType(content: string): "wine" | "poll" | "text" {
  if (/^⭐/.test(content) && /Pontuação/.test(content)) return "wine";
  return "text";
}

// ─── Plan badge ────────────────────────────────────────────────────────────────
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

const REPORT_REASONS = ["Spam", "Conteúdo ofensivo", "Informação falsa", "Assédio", "Outro"];

export function PostCard({ post, currentUserId, onLike, onBookmark, onComment, onVote }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const [showOptions, setShowOptions]       = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReason, setSelectedReason]   = useState<string | null>(null);
  const [reportSending, setReportSending]     = useState(false);
  const [expanded, setExpanded]             = useState(false);

  // Animated scale for like button
  const likeScale = useRef(new Animated.Value(1)).current;

  const isLiked      = post.is_liked      ?? false;
  const isBookmarked = post.is_bookmarked ?? false;
  const postType     = detectPostType(post.content ?? "");
  const isLong       = (post.content?.length ?? 0) > CONTENT_CUTOFF;
  const displayContent = isLong && !expanded
    ? (post.content ?? "").slice(0, CONTENT_CUTOFF).trimEnd() + "…"
    : (post.content ?? "");

  const handleLike = () => {
    // Bounce animation
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.35, useNativeDriver: true, speed: 40 }),
      Animated.spring(likeScale, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike?.(post.id);
  };

  const handleBookmark = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBookmark?.(post.id);
  };

  const handleShare = async () => {
    const postUrl = `https://ibhub.app/post/${post.id}`;
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
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVote?.(post.id, optionIndex);
  };

  const author = post.author;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

      {/* ── Wine badge ── */}
      {postType === "wine" && (
        <View style={[styles.wineBadge, { backgroundColor: colors.gold + "18" }]}>
          <Text style={styles.wineBadgeIcon}>🍷</Text>
          <Text style={[styles.wineBadgeText, { color: colors.gold }]}>Avaliação de Vinho</Text>
        </View>
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.authorRow}
          onPress={() => author?.id && router.push(`/profile/${author.id}` as any)}
        >
          <Avatar uri={author?.avatar_url} name={author?.full_name} size={46} />
          <View style={styles.authorMeta}>
            <View style={styles.nameRow}>
              <Text style={[styles.authorName, { color: colors.foreground }]} numberOfLines={1}>
                {author?.full_name ?? "Usuário"}
              </Text>
              <PlanBadge plan={author?.plan} colors={colors} />
            </View>
            {author?.headline ? (
              <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={1}>
                {author.headline}
              </Text>
            ) : null}
            <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
              {timeAgo(post.created_at)}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          {author?.id && author.id !== currentUserId && (
            <TouchableOpacity
              style={[styles.followBtn, { borderColor: colors.gold }]}
              onPress={() => router.push(`/profile/${author.id}` as any)}
            >
              <Text style={[styles.followBtnText, { color: colors.gold }]}>+ Seguir</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.moreBtn} onPress={() => setShowOptions(true)}>
            <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ── */}
      <Pressable onPress={() => router.push(`/post/${post.id}` as any)} style={styles.contentWrap}>
        {post.content ? (
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

        {post.image_url && (
          <Image
            source={{ uri: post.image_url }}
            style={styles.image}
            contentFit="cover"
          />
        )}
      </Pressable>

      {/* ── Poll ── */}
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
                {/* Fill bar */}
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
                      <AntDesign name="checkcircle" size={15} color={colors.gold} style={{ marginRight: 7 }} />
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
              {post.poll.user_voted_index == null && !post.poll.closed ? "  ·  Toque para votar" : ""}
            </Text>
            <View style={{ flex: 1 }} />
            {post.poll.closed && (
              <View style={[styles.closedBadge, { backgroundColor: colors.border + "80" }]}>
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={[styles.closedText, { color: colors.mutedForeground }]}>Encerrada</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Stats row (likes/comments/shares) ── */}
      {(post.likes_count > 0 || post.comments_count > 0 || post.shares_count > 0) && (
        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          {post.likes_count > 0 && (
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "#e74c3c" }]}>
                <AntDesign name="heart" size={9} color="#fff" />
              </View>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {fmtCount(post.likes_count)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {post.comments_count > 0 && (
            <TouchableOpacity onPress={() => onComment?.(post.id)}>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {fmtCount(post.comments_count)} comentário{post.comments_count !== 1 ? "s" : ""}
              </Text>
            </TouchableOpacity>
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

      {/* ── Actions bar ── */}
      <View style={[styles.actions, { borderTopColor: colors.border }]}>

        {/* Like */}
        <TouchableOpacity style={styles.action} onPress={handleLike} activeOpacity={0.7}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <AntDesign
              name={isLiked ? "heart" : "hearto"}
              size={22}
              color={isLiked ? "#e74c3c" : colors.mutedForeground}
            />
          </Animated.View>
          <Text style={[styles.actionLabel, { color: isLiked ? "#e74c3c" : colors.mutedForeground, fontWeight: isLiked ? "700" : "400" }]}>
            Curtir
          </Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={styles.action} onPress={() => onComment?.(post.id)} activeOpacity={0.7}>
          <MaterialCommunityIcons name="comment-outline" size={22} color={colors.mutedForeground} />
          <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>Comentar</Text>
        </TouchableOpacity>

        {/* Repost / Compartilhar */}
        <TouchableOpacity style={styles.action} onPress={handleShare} activeOpacity={0.7}>
          <MaterialCommunityIcons name="share-variant-outline" size={22} color={colors.mutedForeground} />
          <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>Compartilhar</Text>
        </TouchableOpacity>

        {/* Bookmark — pushed to right */}
        <TouchableOpacity style={[styles.action, { marginLeft: "auto" }]} onPress={handleBookmark} activeOpacity={0.7}>
          <MaterialCommunityIcons
            name={isBookmarked ? "bookmark" : "bookmark-outline"}
            size={23}
            color={isBookmarked ? colors.gold : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      {/* ── Options menu (report / block) ── */}
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
              onPress={() => { setShowOptions(false); Alert.alert("Não tenho interesse", "Veremos menos publicações assim para você."); }}
            >
              <Feather name="eye-off" size={16} color="#374151" />
              <Text style={[styles.menuText, { color: "#374151" }]}>Não tenho interesse</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: "#f3f4f6" }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowOptions(false); Alert.alert("Usuário bloqueado", "Você não verá mais publicações desta pessoa."); }}
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

  // Wine badge
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

  // Header
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
  timeAgo:      { fontSize: 11.5, marginTop: 1 },

  // Plan badge
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  planBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  // Header actions
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 },
  followBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5 },
  followBtnText: { fontSize: 12.5, fontWeight: "700" },
  moreBtn:       { padding: 4 },

  // Content
  contentWrap: { paddingHorizontal: 14, paddingBottom: 10 },
  content:     { fontSize: 15, lineHeight: 23, letterSpacing: 0.1 },
  seeMore:     { fontSize: 14, fontWeight: "600", marginTop: 4 },
  hashtags:    { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  hashtag:     { fontSize: 14, fontWeight: "600" },
  image: {
    width: "100%",
    height: SCREEN_WIDTH * 0.58,
    borderRadius: 12,
    marginTop: 10,
  },

  // Poll
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

  // Stats row
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

  // Actions bar
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

  // Dropdown
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

  // Report modal
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
