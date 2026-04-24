import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { WineTastingCard, canParseWine } from "@/components/feed/PostRichContent";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth, supabase } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { AppComment } from "@/services/api";
import { friendlyErrorMessage } from "@/hooks/useAsyncAction";
import { Post, AdaptiveImage } from "@/components/feed/PostCard";
import { LikesModal } from "@/components/feed/LikesModal";
import { formatRelativeDate } from "@/utils/dateUtils";

const { width: SCREEN_W } = Dimensions.get("window");

// Flatten threaded comments for FlatList: [root, reply, reply, root, reply, ...]
type FlatItem = AppComment & { isReply: boolean; depth: number };
function PostDetailVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; });
  return (
    <VideoView player={player} nativeControls contentFit="contain" allowsFullscreen style={{ width: "100%", height: "100%" }} />
  );
}

function flattenComments(roots: AppComment[]): FlatItem[] {
  const result: FlatItem[] = [];
  for (const root of roots) {
    result.push({ ...root, isReply: false, depth: 0 });
    if (root.replies && root.replies.length > 0) {
      for (const reply of root.replies) {
        result.push({ ...reply, isReply: true, depth: 1 });
      }
    }
  }
  return result;
}

function countAll(roots: AppComment[]): number {
  return roots.reduce((s, c) => s + 1 + (c.replies?.length ?? 0), 0);
}

export default function PostDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, profile, activeCompany } = useAuth();
  const { id, commentId: highlightCommentId } = useLocalSearchParams<{ id: string; commentId?: string }>();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]); // threaded roots
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; commentId: string } | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [sendingComment, setSendingComment] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  // Flat array for FlatList rendering
  const flatItems = useMemo(() => flattenComments(comments), [comments]);
  const totalComments = useMemo(() => countAll(comments), [comments]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadingPost(true);
    const [realPost, realComments] = await Promise.all([
      API.fetchPostById(id, user?.id),
      API.fetchComments(id, user?.id),
    ]);
    if (realPost) setPost(realPost);
    setComments(realComments);
    setLoadingPost(false);
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: new comments from other users appear instantly
  useEffect(() => {
    if (!id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`post_comments_${id}_${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${id}` },
        async (payload) => {
          const row = payload.new as any;
          if (row.user_id === user?.id) return; // already added optimistically
          const fresh = await API.fetchCommentById(row.id, user?.id);
          if (!fresh) return;
          setComments(prev => {
            if (row.parent_comment_id) {
              // It's a reply — attach to parent
              return prev.map(c =>
                c.id === row.parent_comment_id
                  ? { ...c, replies: [...(c.replies ?? []), { ...fresh, replies: [] }] }
                  : c
              );
            }
            if (prev.some(c => c.id === fresh.id)) return prev;
            return [...prev, { ...fresh, replies: [] }];
          });
          setPost(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user?.id]);

  // Scroll to highlighted comment
  useEffect(() => {
    if (highlightCommentId && flatItems.length > 0) {
      const idx = flatItems.findIndex(c => c.id === highlightCommentId);
      if (idx >= 0) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
        }, 400);
      }
    }
  }, [highlightCommentId, flatItems]);

  const handleReply = (authorId: string, authorName: string, commentId: string) => {
    setReplyTo({ id: authorId, name: authorName, commentId });
    setComment("");
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
    setComment("");
  };

  const sendComment = async () => {
    if (!comment.trim() || !user?.id || !id) return;
    setSendingComment(true);
    const text = comment.trim();
    setComment("");
    const currentReplyTo = replyTo;
    setReplyTo(null);

    const tempId = `tmp_${Date.now()}`;
    const tempComment: AppComment = {
      id: tempId,
      post_id: id,
      parent_comment_id: currentReplyTo?.commentId ?? null,
      user_id: user.id,
      company_page_id: activeCompany?.id ?? null,
      content: text,
      created_at: new Date().toISOString(),
      likes_count: 0,
      is_liked: false,
      replies: [],
      author: {
        id: user.id,
        full_name: profile?.full_name ?? "Você",
        avatar_url: profile?.avatar_url ?? null,
        headline: null,
      },
      company_page: activeCompany
        ? { id: activeCompany.id, name: activeCompany.name, avatar_url: activeCompany.avatar_url ?? null }
        : null,
    };

    // Optimistic update
    if (currentReplyTo?.commentId) {
      setComments(prev => prev.map(c =>
        c.id === currentReplyTo.commentId
          ? { ...c, replies: [...(c.replies ?? []), tempComment] }
          : c
      ));
    } else {
      setComments(prev => [...prev, tempComment]);
    }
    setPost(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const saved = await API.addComment(id, user.id, text, activeCompany?.id ?? null, currentReplyTo?.commentId ?? null);

      if (saved) {
        const savedWithReplies = { ...saved, replies: [] };
        if (currentReplyTo?.commentId) {
          setComments(prev => prev.map(c =>
            c.id === currentReplyTo.commentId
              ? { ...c, replies: (c.replies ?? []).map(r => r.id === tempId ? savedWithReplies : r) }
              : c
          ));
        } else {
          setComments(prev => prev.map(c => c.id === tempId ? savedWithReplies : c));
        }
      } else {
        // API returned null — remove optimistic comment
        if (currentReplyTo?.commentId) {
          setComments(prev => prev.map(c =>
            c.id === currentReplyTo.commentId
              ? { ...c, replies: (c.replies ?? []).filter(r => r.id !== tempId) }
              : c
          ));
        } else {
          setComments(prev => prev.filter(c => c.id !== tempId));
        }
        setPost(prev => prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) } : prev);
        Alert.alert("Erro", "Não foi possível enviar o comentário. Tente novamente.");
      }
    } catch (e: unknown) {
      // Remove optimistic comment on network failure
      if (currentReplyTo?.commentId) {
        setComments(prev => prev.map(c =>
          c.id === currentReplyTo.commentId
            ? { ...c, replies: (c.replies ?? []).filter(r => r.id !== tempId) }
            : c
        ));
      } else {
        setComments(prev => prev.filter(c => c.id !== tempId));
      }
      setPost(prev => prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) } : prev);
      Alert.alert("Erro", friendlyErrorMessage(e));
    } finally {
      setSendingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string, isReply: boolean, parentId?: string, isCurrentlyLiked?: boolean) => {
    if (!user?.id) return;
    const wasLiked = isCurrentlyLiked ?? false;

    const applyToggle = (list: AppComment[]): AppComment[] =>
      list.map(c => {
        if (c.id !== commentId) return c;
        return { ...c, is_liked: !wasLiked, likes_count: (c.likes_count ?? 0) + (wasLiked ? -1 : 1) };
      });
    const revert = (list: AppComment[]): AppComment[] =>
      list.map(c => c.id !== commentId ? c : { ...c, is_liked: wasLiked, likes_count: (c.likes_count ?? 0) + (wasLiked ? 1 : -1) });

    const applyToComments = (fn: (l: AppComment[]) => AppComment[]) => {
      if (isReply && parentId) {
        setComments(prev => prev.map(c => c.id === parentId ? { ...c, replies: fn(c.replies ?? []) } : c));
      } else {
        setComments(prev => fn(prev));
      }
    };

    // Optimistic update
    applyToComments(applyToggle);

    try {
      const ok = await API.toggleCommentLike(commentId, user.id, wasLiked);
      if (!ok) {
        applyToComments(revert);
        Alert.alert("Erro", "Não foi possível curtir o comentário. Tente novamente.");
      }
    } catch (e: unknown) {
      applyToComments(revert);
      Alert.alert("Erro de Conexão", friendlyErrorMessage(e));
    }
  };

  const handleLikePost = async () => {
    if (!post || !user?.id) return;
    const wasLiked = post.is_liked ?? false;
    const prevCount = post.likes_count;
    setPost(p => p ? { ...p, is_liked: !wasLiked, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    try {
      const ok = await API.toggleLike(post.id, user.id, wasLiked, activeCompany?.id);
      if (!ok) {
        setPost(p => p ? { ...p, is_liked: wasLiked, likes_count: prevCount } : p);
        Alert.alert("Erro", "Não foi possível curtir. Tente novamente.");
      }
    } catch (e: unknown) {
      setPost(p => p ? { ...p, is_liked: wasLiked, likes_count: prevCount } : p);
      Alert.alert("Erro de Conexão", friendlyErrorMessage(e));
    }
  };

  const handleBookmarkPost = () => {
    if (!post || !user?.id) return;
    setPost(p => p ? { ...p, is_bookmarked: !p.is_bookmarked } : p);
    API.toggleBookmark(post.id, user.id, post.is_bookmarked ?? false);
  };

  const renderItem = ({ item, index }: { item: FlatItem; index: number }) => {
    const isHighlighted = item.id === highlightCommentId;
    const isTemp = item.id.startsWith("tmp_");

    return (
      <View
        style={[
          styles.comment,
          { borderBottomColor: colors.border },
          item.isReply && { paddingLeft: 52, backgroundColor: colors.secondary + "60" },
          isHighlighted && { backgroundColor: colors.gold + "14" },
          isTemp && { opacity: 0.7 },
        ]}
      >
        {/* Reply indicator line */}
        {item.isReply && (
          <View style={[styles.replyLine, { borderColor: colors.border }]} />
        )}

        <TouchableOpacity onPress={() => {
          if (item.company_page) router.push(`/empresa/${item.company_page.id}` as any);
          else if (item.author?.id) router.push(`/profile/${item.author.id}` as any);
        }}>
          <Avatar
            uri={item.company_page ? item.company_page.avatar_url : item.author?.avatar_url}
            name={item.company_page ? item.company_page.name : (item.author?.full_name ?? "?")}
            size={item.isReply ? 30 : 36}
          />
        </TouchableOpacity>

        <View style={styles.commentBody}>
          <View style={[styles.commentBubble, { backgroundColor: colors.secondary }]}>
            <TouchableOpacity onPress={() => {
              if (item.company_page) router.push(`/empresa/${item.company_page.id}` as any);
              else if (item.author?.id) router.push(`/profile/${item.author.id}` as any);
            }}>
              <Text style={[styles.commentAuthor, { color: colors.foreground }]}>
                {item.company_page ? item.company_page.name : (item.author?.full_name ?? "Usuário")}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.commentContent, { color: colors.foreground }]}>{item.content}</Text>
          </View>

          <View style={styles.commentActions}>
            <Text style={[styles.commentTime, { color: colors.mutedForeground }]}>{formatRelativeDate(item.created_at)}</Text>

            {/* Like comment */}
            <TouchableOpacity
              style={styles.commentAction}
              onPress={() => handleLikeComment(item.id, item.isReply, item.parent_comment_id ?? undefined, item.is_liked)}
            >
              <Feather
                name="heart"
                size={13}
                color={(item.is_liked) ? "#e74c3c" : colors.mutedForeground}
              />
              {(item.likes_count ?? 0) > 0 && (
                <Text style={[styles.commentLikes, { color: item.is_liked ? "#e74c3c" : colors.mutedForeground }]}>
                  {item.likes_count}
                </Text>
              )}
            </TouchableOpacity>

            {/* Reply button — only on top-level comments */}
            {!item.isReply && (
              <TouchableOpacity
                style={styles.commentAction}
                onPress={() => handleReply(
                  item.author?.id ?? item.company_page?.id ?? "",
                  item.company_page?.name ?? item.author?.full_name ?? "Usuário",
                  item.id,
                )}
              >
                <Feather name="corner-down-right" size={13} color={colors.gold} />
                <Text style={[styles.commentReply, { color: colors.gold }]}>Responder</Text>
              </TouchableOpacity>
            )}

            {/* Reply count badge */}
            {!item.isReply && (item.replies?.length ?? 0) > 0 && (
              <Text style={[styles.replyCount, { color: colors.mutedForeground }]}>
                {item.replies!.length} {item.replies!.length === 1 ? "resposta" : "respostas"}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loadingPost) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Publicação</Text>
        <TouchableOpacity>
          <Feather name="share-2" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={flatItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={() => (
          <View style={[styles.postPreview, { borderBottomColor: colors.border }]}>
            {post && (
              <>
                {/* Author */}
                <TouchableOpacity
                  style={styles.authorRow}
                  onPress={() => post.author?.id && router.push(`/profile/${post.author.id}` as any)}
                >
                  <Avatar uri={post.author?.avatar_url} name={post.author?.full_name ?? "?"} size={42} />
                  <View>
                    <Text style={[styles.authorName, { color: colors.foreground }]}>{post.author?.full_name}</Text>
                    {!!post.author?.headline && (
                      <Text style={[styles.authorHeadline, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {post.author.headline}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Content */}
                {post.content && canParseWine(post.content) ? (
                  <WineTastingCard content={post.content} />
                ) : (
                  <Text style={[styles.postContentPreview, { color: colors.foreground }]}>{post.content}</Text>
                )}

                {/* Images */}
                {(() => {
                  const rawUrls = post.image_urls;
                  const imageUrls: string[] = Array.isArray(rawUrls) && rawUrls.length > 0
                    ? rawUrls
                    : post.image_url ? [post.image_url] : [];
                  if (imageUrls.length === 0) return null;
                  if (imageUrls.length === 1) {
                    return (
                      <AdaptiveImage
                        uri={imageUrls[0]}
                        width={SCREEN_W}
                        priority="high"
                        style={{ borderRadius: 12, marginTop: 8 }}
                      />
                    );
                  }
                  return (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
                      {imageUrls.map((uri, i) => (
                        <AdaptiveImage key={i} uri={uri} width={SCREEN_W - 80} style={{ borderRadius: 12 }} />
                      ))}
                    </ScrollView>
                  );
                })()}

                {/* Video */}
                {post.video_url && (
                  <View style={{ marginTop: 8, width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
                    <PostDetailVideo uri={post.video_url} />
                  </View>
                )}

                {/* Actions */}
                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.postAction} onPress={handleLikePost}>
                    <Feather name="heart" size={18} color={post.is_liked ? "#e74c3c" : colors.mutedForeground} />
                    <Text style={[styles.postActionCount, { color: post.is_liked ? "#e74c3c" : colors.mutedForeground }]}>
                      {post.likes_count > 0 ? post.likes_count : "Curtir"}
                    </Text>
                  </TouchableOpacity>
                  {/* Tapping like count shows who liked */}
                  {post.likes_count > 0 && (
                    <TouchableOpacity
                      style={[styles.postAction, styles.likesCountBtn, { backgroundColor: colors.secondary }]}
                      onPress={() => setShowLikesModal(true)}
                    >
                      <Feather name="users" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.likesCountText, { color: colors.mutedForeground }]}>
                        Ver curtidas
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.postAction} onPress={() => inputRef.current?.focus()}>
                    <Feather name="message-circle" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.postActionCount, { color: colors.mutedForeground }]}>
                      {totalComments > 0 ? totalComments : "Comentar"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postAction} onPress={handleBookmarkPost}>
                    <Feather name="bookmark" size={18} color={post.is_bookmarked ? colors.gold : colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={[styles.commentsHeader, { color: colors.foreground }]}>
              {totalComments} {totalComments === 1 ? "comentário" : "comentários"}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {/* Reply indicator bar */}
      {replyTo && (
        <View style={[styles.replyBar, { backgroundColor: colors.gold + "18", borderTopColor: colors.gold + "40" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="corner-down-right" size={14} color={colors.gold} />
            <Text style={[styles.replyText, { color: colors.gold }]}>
              Respondendo a <Text style={{ fontWeight: "800" }}>{replyTo.name}</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={cancelReply}>
            <Feather name="x" size={16} color={colors.gold} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
        <Avatar
          uri={activeCompany ? activeCompany.avatar_url : profile?.avatar_url}
          name={activeCompany ? activeCompany.name : (profile?.full_name ?? "Você")}
          size={34}
        />
        <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderRadius: 24 }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder={replyTo ? `Responder a ${replyTo.name}...` : "Adicionar comentário..."}
            placeholderTextColor={colors.mutedForeground}
            value={comment}
            onChangeText={setComment}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendComment}
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: comment.trim() ? colors.gold : colors.border }]}
          onPress={sendComment}
          disabled={!comment.trim() || sendingComment}
        >
          {sendingComment
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="send" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      {/* Likes modal */}
      <LikesModal
        postId={post?.id ?? null}
        likesCount={post?.likes_count ?? 0}
        visible={showLikesModal}
        onClose={() => setShowLikesModal(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle:        { fontSize: 17, fontWeight: "700" },
  postPreview:        { padding: 16, borderBottomWidth: 1, gap: 12 },
  authorRow:          { flexDirection: "row", alignItems: "center", gap: 10 },
  authorName:         { fontSize: 15, fontWeight: "700" },
  authorHeadline:     { fontSize: 12, maxWidth: 220 },
  postContentPreview: { fontSize: 15, lineHeight: 22 },
  postActions:        { flexDirection: "row", gap: 12, paddingTop: 4, flexWrap: "wrap", alignItems: "center" },
  postAction:         { flexDirection: "row", alignItems: "center", gap: 5 },
  postActionCount:    { fontSize: 13, fontWeight: "600" },
  likesCountBtn:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  likesCountText:     { fontSize: 12, fontWeight: "600" },
  commentsHeader:     { fontSize: 15, fontWeight: "700", paddingTop: 4 },
  comment:            { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 10, alignItems: "flex-start" },
  replyLine:          { position: "absolute", left: 38, top: 0, bottom: 0, width: 1, borderLeftWidth: 1 },
  commentBody:        { flex: 1, gap: 4 },
  commentBubble:      { padding: 10, gap: 2, borderRadius: 14 },
  commentAuthor:      { fontSize: 13, fontWeight: "700" },
  commentContent:     { fontSize: 14, lineHeight: 19 },
  commentActions:     { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 4, flexWrap: "wrap" },
  commentTime:        { fontSize: 12 },
  commentAction:      { flexDirection: "row", alignItems: "center", gap: 4 },
  commentLikes:       { fontSize: 12 },
  commentReply:       { fontSize: 12, fontWeight: "700" },
  replyCount:         { fontSize: 11 },
  replyBar:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
  replyText:          { fontSize: 13 },
  inputBar:           { flexDirection: "row", alignItems: "flex-end", padding: 10, gap: 8, borderTopWidth: 1 },
  inputWrap:          { flex: 1, paddingHorizontal: 14, paddingVertical: 8 },
  input:              { fontSize: 14, maxHeight: 100 },
  sendBtn:            { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
