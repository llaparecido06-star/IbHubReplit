import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { AntDesign, Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { fetchConversations, sendMessage } from "@/services/api";
import type { AppConversation } from "@/services/api";

export type ReactionType = "saude" | "bravo" | "destaque" | "incrivel";

export const REACTIONS: { type: ReactionType; emoji: string; iconName: string; iconColor: string; label: string }[] = [
  { type: "saude",    emoji: "🍷", iconName: "glass-wine", iconColor: "#7C3AED", label: "Saúde!" },
  { type: "bravo",    emoji: "👏", iconName: "hand-clap",  iconColor: "#F59E0B", label: "Bravo!" },
  { type: "destaque", emoji: "⭐", iconName: "star",        iconColor: "#EAB308", label: "Destaque!" },
  { type: "incrivel", emoji: "🔥", iconName: "fire",        iconColor: "#EF4444", label: "Incrível!" },
];

export function buildPostShareUrl(postId: string): string {
  return `https://www.ibhub.com.br/post/${postId}`;
}

export function ReactionIcon({ iconName, iconColor, size }: { iconName: string; iconColor: string; size: number }) {
  return <MaterialCommunityIcons name={iconName} size={size} color={iconColor} />;
}

export function ReactionPicker({
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
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <View style={pickerStyles.picker}>
          {REACTIONS.map((r) => (
            <TouchableOpacity
              key={r.type}
              style={pickerStyles.btn}
              onPress={() => { onSelect(r.type); onClose(); }}
              activeOpacity={0.7}
            >
              <ReactionIcon iconName={r.iconName} iconColor={r.iconColor} size={28} />
              <Text style={pickerStyles.label}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

/** Minimal post shape this bar needs. */
export interface PostActionsBarPost {
  id: string;
  content?: string | null;
  image_url?: string | null;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  reaction_type?: ReactionType | null;
  author?: { full_name?: string | null } | null;
}

export interface PostActionsBarProps {
  post: PostActionsBarPost;
  /** Reaction-aware handler. Preferred over `onLike`. */
  onReact?: (postId: string, reaction: ReactionType) => void;
  /** Legacy "like-only" fallback used when `onReact` is not supplied. */
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  /** When true, the like button shows a spinner and is non-interactive. */
  isLiking?: boolean;
  /** Optional container style override (e.g. to drop the border-top on detail page). */
  containerStyle?: StyleProp<ViewStyle>;
}

/** Action bar rendered identically below the feed PostCard and the post-detail page.
 *  Owns the reaction picker, share sheet, share-to-chat modal, like animation,
 *  and haptics. */
export function PostActionsBar({
  post,
  onReact,
  onLike,
  onComment,
  onBookmark,
  isLiking = false,
  containerStyle,
}: PostActionsBarProps) {
  const colors = useColors();
  const { user } = useAuth();

  const [showReactions, setShowReactions]   = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showShareChat, setShowShareChat]   = useState(false);
  const [conversations, setConversations]   = useState<AppConversation[]>([]);
  const [loadingConvos, setLoadingConvos]   = useState(false);
  const [sendingToConvo, setSendingToConvo] = useState<string | null>(null);

  // Track the last reaction used so a tap can re-apply it after removal.
  const lastUsedReaction = useRef<ReactionType>("saude");
  const likeScale = useRef(new Animated.Value(1)).current;

  const isLiked      = post.is_liked      ?? false;
  const isBookmarked = post.is_bookmarked ?? false;
  const currentReaction = post.reaction_type ?? null;
  const reactionInfo = currentReaction ? REACTIONS.find(r => r.type === currentReaction) : null;
  if (currentReaction) lastUsedReaction.current = currentReaction;

  const animateLike = () => {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.35, useNativeDriver: true, speed: 40 }),
      Animated.spring(likeScale, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();
  };

  const handleLike = () => {
    if (isLiking) return;
    animateLike();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onReact) {
      onReact(post.id, lastUsedReaction.current);
    } else {
      onLike?.(post.id);
    }
  };

  const handleLongPress = () => {
    if (isLiking) return;
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

  const handleShare = async () => {
    const postUrl = buildPostShareUrl(post.id);
    const shareText = `Veja esta publicação no ibhub:\n\n${post.content?.slice(0, 120) ?? ""}\n\n${postUrl}`;
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title: "Compartilhar publicação", text: shareText, url: postUrl });
          return;
        } catch {}
      }
      try {
        await nav?.clipboard.writeText(postUrl);
        Alert.alert("Link copiado!", "Link da publicação copiado para a área de transferência.");
      } catch {
        Alert.alert("Erro", "Não foi possível copiar o link. Copie manualmente: " + postUrl);
      }
      return;
    }
    try {
      await Share.share({ message: shareText, url: postUrl, title: "Compartilhar publicação" });
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

  const likeButtonColor = reactionInfo ? reactionInfo.iconColor : isLiked ? "#e74c3c" : colors.border;
  const likeButtonLabel = reactionInfo ? reactionInfo.label : isLiked ? "Curtido" : "Curtir";

  return (
    <>
      <View style={[styles.actions, { borderTopColor: colors.border }, containerStyle]}>
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
                <AntDesign name="heart" size={22} color={likeButtonColor} />
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
                const postUrl = buildPostShareUrl(post.id);
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
                const postUrl = buildPostShareUrl(post.id);
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
    </>
  );
}

const styles = StyleSheet.create({
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
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "flex-end",
    paddingBottom: 100,
    paddingHorizontal: 14,
  },
  picker: {
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
  btn: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  label: { fontSize: 10, fontWeight: "600", color: "#374151" },
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
