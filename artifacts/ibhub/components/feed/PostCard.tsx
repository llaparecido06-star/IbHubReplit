import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";

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

interface PostCardProps {
  post: Post;
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

export function PostCard({ post, onLike, onBookmark, onComment, onVote }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const [showOptions, setShowOptions] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Use props directly — parent is the single source of truth
  const isLiked = post.is_liked ?? false;
  const isBookmarked = post.is_bookmarked ?? false;

  const handleLike = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike?.(post.id);
  };

  const handleBookmark = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBookmark?.(post.id);
  };

  const handleVote = (optionIndex: number) => {
    if (post.poll?.closed || post.poll?.user_voted_index != null) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVote?.(post.id, optionIndex);
  };

  const author = post.author;
  const planColors: Record<string, string> = {
    business:  colors.gold,
    exclusive: "#8e44ad",
    premium:   colors.navyMid,
    basico:    colors.mutedForeground,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.authorRow} onPress={() => author?.id && router.push(`/profile/${author.id}` as any)}>
          <Avatar uri={author?.avatar_url} name={author?.full_name} size={44} />
          <View style={styles.authorInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.authorName, { color: colors.foreground }]}>
                {author?.full_name ?? "Usuário"}
              </Text>
              {author?.plan && author.plan !== "basico" && (
                <View style={[styles.planDot, { backgroundColor: planColors[author.plan] ?? colors.gold }]} />
              )}
            </View>
            <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={1}>
              {author?.headline ? `${author.headline} · ` : ""}{timeAgo(post.created_at)}
            </Text>
          </View>
        </Pressable>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowOptions(true)}>
          <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Pressable onPress={() => router.push(`/post/${post.id}` as any)}>
        {post.content ? (
          <Text style={[styles.content, { color: colors.foreground }]}>{post.content}</Text>
        ) : null}

        {post.hashtags && post.hashtags.length > 0 && (
          <View style={styles.hashtags}>
            {post.hashtags.slice(0, 4).map((tag) => (
              <Text key={tag} style={[styles.hashtag, { color: colors.gold }]}>#{tag}</Text>
            ))}
          </View>
        )}

        {post.image_url && (
          <Image
            source={{ uri: post.image_url }}
            style={[styles.image, { borderRadius: colors.radius - 4 }]}
            contentFit="cover"
          />
        )}
      </Pressable>

      {/* Poll */}
      {post.poll && (
        <View style={styles.pollWrap}>
          {post.poll.options.map((opt, i) => {
            const total = post.poll!.total_votes;
            const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
            const hasVoted = post.poll!.user_voted_index != null;
            const isWinner = hasVoted && opt.votes === Math.max(...post.poll!.options.map(o => o.votes));
            const isMyVote = post.poll!.user_voted_index === i;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={hasVoted || post.poll!.closed ? 1 : 0.7}
                onPress={() => handleVote(i)}
                style={[
                  styles.pollOption,
                  {
                    borderColor: isMyVote ? colors.gold : isWinner && hasVoted ? colors.navy : colors.border,
                    borderWidth: isMyVote || (isWinner && hasVoted) ? 1.5 : 1,
                  },
                ]}
              >
                {hasVoted && (
                  <View
                    style={[
                      styles.pollFill,
                      { backgroundColor: isMyVote ? colors.gold + "28" : colors.secondary, width: `${pct}%` as any },
                    ]}
                  />
                )}
                <Text style={[styles.pollOptionText, { color: colors.foreground, fontWeight: isMyVote ? "700" : "400" }]}>
                  {isMyVote && "✓ "}{opt.text}
                </Text>
                {hasVoted && (
                  <Text style={[styles.pollPct, { color: isMyVote ? colors.gold : colors.mutedForeground, fontWeight: isMyVote ? "700" : "400" }]}>
                    {pct}%
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={styles.pollMeta}>
            <View style={styles.pollMetaLeft}>
              <Feather name="bar-chart-2" size={12} color={colors.mutedForeground} />
              <Text style={[styles.pollMetaText, { color: colors.mutedForeground }]}>
                {post.poll.total_votes} {post.poll.total_votes === 1 ? "voto" : "votos"}
                {!post.poll.user_voted_index != null ? "" : " · Toque para votar"}
              </Text>
            </View>
            {post.poll.closed && (
              <View style={[styles.closedBadge, { backgroundColor: colors.background }]}>
                <Feather name="clock" size={10} color={colors.mutedForeground} />
                <Text style={[styles.closedText, { color: colors.mutedForeground }]}>Encerrada</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions: heart · comment · bookmark · share(right) */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike}>
          <Feather
            name={isLiked ? "heart" : "heart"}
            size={20}
            color={isLiked ? colors.wine : colors.mutedForeground}
          />
          <Text style={[styles.actionCount, { color: isLiked ? colors.wine : colors.mutedForeground }]}>
            {(post.likes_count ?? 0) > 0 ? post.likes_count : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onComment?.(post.id)}>
          <Feather name="message-circle" size={20} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
            {(post.comments_count ?? 0) > 0 ? post.comments_count : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handleBookmark}>
          <Feather
            name="bookmark"
            size={20}
            color={isBookmarked ? colors.gold : colors.mutedForeground}
          />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.action, { marginLeft: "auto" }]} onPress={() => setShowShare(true)}>
          <Feather name="share-2" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── Post Options Menu ── */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <Pressable style={styles.dropOverlay} onPress={() => setShowOptions(false)}>
          <View style={[styles.dropMenu, { backgroundColor: "#fff", shadowColor: "#000" }]}>
            <TouchableOpacity
              style={styles.dropItem}
              onPress={() => { setShowOptions(false); Alert.alert("Denúncia enviada", "Obrigado pelo seu feedback."); }}
            >
              <Feather name="flag" size={16} color={colors.foreground} />
              <Text style={[styles.dropItemText, { color: colors.foreground }]}>Denunciar</Text>
            </TouchableOpacity>
            <View style={[styles.dropDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.dropItem}
              onPress={() => { setShowOptions(false); Alert.alert("Usuário bloqueado", "Você não verá mais publicações desta pessoa."); }}
            >
              <Feather name="slash" size={16} color="#dc2626" />
              <Text style={[styles.dropItemText, { color: "#dc2626" }]}>Bloquear Usuário</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Share Menu ── */}
      <Modal visible={showShare} transparent animationType="fade" onRequestClose={() => setShowShare(false)}>
        <Pressable style={styles.dropOverlay} onPress={() => setShowShare(false)}>
          <View style={[styles.dropMenu, { backgroundColor: "#fff", shadowColor: "#000" }]}>
            <TouchableOpacity style={styles.dropItem} onPress={() => setShowShare(false)}>
              <Feather name="external-link" size={16} color={colors.foreground} />
              <Text style={[styles.dropItemText, { color: colors.foreground }]}>Compartilhar externamente</Text>
            </TouchableOpacity>
            <View style={[styles.dropDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.dropItem}
              onPress={() => { setShowShare(false); Alert.alert("Copiado!", "Link copiado para a área de transferência."); }}
            >
              <Feather name="link" size={16} color={colors.foreground} />
              <Text style={[styles.dropItemText, { color: colors.foreground }]}>Copiar link</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { borderBottomWidth: 1, paddingVertical: 16, paddingHorizontal: 16 },
  header:         { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  authorRow:      { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 10 },
  authorInfo:     { flex: 1 },
  nameRow:        { flexDirection: "row", alignItems: "center", gap: 6 },
  authorName:     { fontSize: 15, fontWeight: "700" },
  planDot:        { width: 7, height: 7, borderRadius: 4 },
  headline:       { fontSize: 12, marginTop: 1 },
  moreBtn:        { padding: 4 },
  content:        { fontSize: 15, lineHeight: 22 },
  hashtags:       { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  hashtag:        { fontSize: 14, fontWeight: "600" },
  image:          { width: "100%", height: SCREEN_WIDTH * 0.55, marginTop: 12 },
  // Poll
  pollWrap:       { marginTop: 10, gap: 7 },
  pollOption:     { borderWidth: 1, borderRadius: 10, height: 46, overflow: "hidden", justifyContent: "center", position: "relative" },
  pollFill:       { position: "absolute", left: 0, top: 0, bottom: 0 },
  pollOptionText: { paddingHorizontal: 14, fontSize: 14, zIndex: 1 },
  pollPct:        { position: "absolute", right: 12, fontSize: 14 },
  pollMeta:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  pollMetaLeft:   { flexDirection: "row", alignItems: "center", gap: 5 },
  pollMetaText:   { fontSize: 12 },
  closedBadge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  closedText:     { fontSize: 12 },
  // Actions
  actions:        { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 20 },
  action:         { flexDirection: "row", alignItems: "center", gap: 5 },
  actionCount:    { fontSize: 13, fontWeight: "600" },
  // Dropdown menus
  dropOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.15)" },
  dropMenu:       { position: "absolute", top: 120, right: 16, width: 220, borderRadius: 12, overflow: "hidden", shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 10 },
  dropItem:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  dropItemText:   { fontSize: 14, fontWeight: "600" },
  dropDivider:    { height: 1 },
});
