import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
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

export function PostCard({ post, onLike, onBookmark, onComment }: PostCardProps) {
  const colors = useColors();
  const router = useRouter();
  const [liked, setLiked] = useState(post.is_liked ?? false);
  const [likeCount, setLikeCount] = useState(post.likes_count ?? 0);
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked ?? false);

  const handleLike = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLiked((v) => !v);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    onLike?.(post.id);
  };

  const handleBookmark = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setBookmarked((v) => !v);
    onBookmark?.(post.id);
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
      <View style={styles.header}>
        <Pressable
          style={styles.authorRow}
          onPress={() => author && router.push(`/profile/${author.id}` as any)}
        >
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
            {author?.headline && (
              <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={1}>
                {author.headline}
              </Text>
            )}
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {timeAgo(post.created_at)}
            </Text>
          </View>
        </Pressable>
        <TouchableOpacity style={styles.moreBtn}>
          <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Pressable onPress={() => router.push(`/post/${post.id}` as any)}>
        <Text style={[styles.content, { color: colors.foreground }]}>
          {post.content}
        </Text>

        {post.hashtags && post.hashtags.length > 0 && (
          <View style={styles.hashtags}>
            {post.hashtags.slice(0, 4).map((tag) => (
              <Text key={tag} style={[styles.hashtag, { color: colors.gold }]}>
                #{tag}
              </Text>
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

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike}>
          <Feather
            name={liked ? "heart" : "heart"}
            size={20}
            color={liked ? colors.wine : colors.mutedForeground}
          />
          <Text style={[styles.actionCount, { color: liked ? colors.wine : colors.mutedForeground }]}>
            {likeCount > 0 ? likeCount : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onComment?.(post.id)}>
          <Feather name="message-circle" size={20} color={colors.mutedForeground} />
          {post.comments_count > 0 && (
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
              {post.comments_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action}>
          <Feather name="share-2" size={20} color={colors.mutedForeground} />
          {post.shares_count > 0 && (
            <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
              {post.shares_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.action, { marginLeft: "auto" }]} onPress={handleBookmark}>
          <Feather
            name={bookmarked ? "bookmark" : "bookmark"}
            size={20}
            color={bookmarked ? colors.gold : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 10,
  },
  authorInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorName: { fontSize: 15, fontWeight: "700" },
  planDot: { width: 7, height: 7, borderRadius: 4 },
  headline: { fontSize: 12, marginTop: 1 },
  time: { fontSize: 11, marginTop: 2 },
  moreBtn: { padding: 4 },
  content: { fontSize: 15, lineHeight: 22 },
  hashtags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  hashtag: { fontSize: 14, fontWeight: "600" },
  image: {
    width: "100%",
    height: SCREEN_WIDTH * 0.55,
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 20,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionCount: { fontSize: 13, fontWeight: "600" },
});
