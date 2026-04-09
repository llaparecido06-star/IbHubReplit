import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth, supabase } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { AppComment } from "@/services/api";
import { Post } from "@/components/feed/PostCard";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function PostDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, profile, activeCompany } = useAuth();
  const { id, commentId: highlightCommentId } = useLocalSearchParams<{ id: string; commentId?: string }>();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [sendingComment, setSendingComment] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 0 : insets.top;

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

  // ── Realtime: novos comentários de outros usuários aparecem instantaneamente
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`post_comments_${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${id}` },
        async (payload) => {
          const row = payload.new as any;
          // comentário do próprio usuário já foi adicionado otimisticamente
          if (row.user_id === user?.id) return;
          const fresh = await API.fetchCommentById(row.id, user?.id);
          if (!fresh) return;
          setComments(prev => {
            if (prev.some(c => c.id === fresh.id)) return prev;
            return [...prev, fresh];
          });
          setPost(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user?.id]);

  // Scroll to highlighted comment after comments load
  useEffect(() => {
    if (highlightCommentId && comments.length > 0) {
      const idx = comments.findIndex(c => c.id === highlightCommentId);
      if (idx >= 0) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: idx + 1, animated: true }); // +1 for header
        }, 400);
      }
    }
  }, [highlightCommentId, comments]);

  const handleReply = (authorId: string, authorName: string, commentId: string) => {
    setReplyTo({ id: commentId, name: authorName });
    setComment(`@${authorName} `);
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
    setReplyTo(null);

    // Optimistic
    const tempComment: AppComment = {
      id: `tmp_${Date.now()}`,
      post_id: id,
      user_id: user.id,
      company_page_id: activeCompany?.id ?? null,
      content: text,
      created_at: new Date().toISOString(),
      likes_count: 0,
      is_liked: false,
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
    setComments(prev => [...prev, tempComment]);
    setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    const saved = await API.addComment(id, user.id, text, activeCompany?.id);
    if (saved) {
      setComments(prev => prev.map(c => c.id === tempComment.id ? { ...saved, likes_count: 0, is_liked: false } : c));
    }
    setSendingComment(false);
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user?.id) return;
    // Optimistic toggle
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      const wasLiked = c.is_liked ?? false;
      return { ...c, is_liked: !wasLiked, likes_count: (c.likes_count ?? 0) + (wasLiked ? -1 : 1) };
    }));
    // Fire and forget (table may not exist yet — fails silently)
    API.toggleCommentLike(commentId, user.id).catch(() => {});
  };

  const handleLikePost = () => {
    if (!post || !user?.id) return;
    setPost(p => p ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    API.toggleLike(post.id, user.id, post.is_liked ?? false, activeCompany?.id);
  };

  const handleBookmarkPost = () => {
    if (!post || !user?.id) return;
    setPost(p => p ? { ...p, is_bookmarked: !p.is_bookmarked } : p);
    API.toggleBookmark(post.id, user.id, post.is_bookmarked ?? false);
  };

  const renderComment = ({ item, index }: { item: AppComment; index: number }) => {
    const isHighlighted = item.id === highlightCommentId;
    const isTemp = item.id.startsWith("tmp_");

    return (
      <View
        style={[
          styles.comment,
          { borderBottomColor: colors.border },
          isHighlighted && { backgroundColor: colors.gold + "14" },
          isTemp && { opacity: 0.7 },
        ]}
      >
        <TouchableOpacity onPress={() => {
          if (item.company_page) router.push(`/empresa/${item.company_page.id}` as any);
          else if (item.author?.id) router.push(`/profile/${item.author.id}` as any);
        }}>
          <Avatar
            uri={item.company_page ? item.company_page.avatar_url : item.author?.avatar_url}
            name={item.company_page ? item.company_page.name : (item.author?.full_name ?? "?")}
            size={36}
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
            <Text style={[styles.commentTime, { color: colors.mutedForeground }]}>{timeAgo(item.created_at)}</Text>
            <TouchableOpacity
              style={styles.commentAction}
              onPress={() => handleLikeComment(item.id)}
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
            {!item.company_page && item.author && (
              <TouchableOpacity
                style={styles.commentAction}
                onPress={() => handleReply(item.author!.id, item.author!.full_name, item.id)}
              >
                <Text style={[styles.commentReply, { color: colors.gold }]}>Responder</Text>
              </TouchableOpacity>
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
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        onScrollToIndexFailed={() => {}} // ignore if index not yet mounted
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
                <Text style={[styles.postContentPreview, { color: colors.foreground }]}>{post.content}</Text>

                {/* Actions */}
                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.postAction} onPress={handleLikePost}>
                    <Feather name="heart" size={18} color={post.is_liked ? "#e74c3c" : colors.mutedForeground} />
                    <Text style={[styles.postActionCount, { color: post.is_liked ? "#e74c3c" : colors.mutedForeground }]}>
                      {post.likes_count > 0 ? post.likes_count : "Curtir"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postAction} onPress={() => inputRef.current?.focus()}>
                    <Feather name="message-circle" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.postActionCount, { color: colors.mutedForeground }]}>
                      {comments.length > 0 ? comments.length : "Comentar"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postAction} onPress={handleBookmarkPost}>
                    <Feather name="bookmark" size={18} color={post.is_bookmarked ? colors.gold : colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={[styles.commentsHeader, { color: colors.foreground }]}>
              {comments.length} {comments.length === 1 ? "comentário" : "comentários"}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {/* Reply indicator */}
      {replyTo && (
        <View style={[styles.replyBar, { backgroundColor: colors.gold + "18", borderTopColor: colors.gold + "40" }]}>
          <Text style={[styles.replyText, { color: colors.gold }]}>
            Respondendo a <Text style={{ fontWeight: "800" }}>@{replyTo.name}</Text>
          </Text>
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
            placeholder={replyTo ? `Responder a @${replyTo.name}...` : "Adicionar comentário..."}
            placeholderTextColor={colors.mutedForeground}
            value={comment}
            onChangeText={setComment}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendComment}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: comment.trim() ? colors.gold : colors.border },
          ]}
          onPress={sendComment}
          disabled={!comment.trim() || sendingComment}
        >
          {sendingComment
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="send" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </View>
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
  postActions:        { flexDirection: "row", gap: 20, paddingTop: 4 },
  postAction:         { flexDirection: "row", alignItems: "center", gap: 5 },
  postActionCount:    { fontSize: 13, fontWeight: "600" },
  commentsHeader:     { fontSize: 15, fontWeight: "700", paddingTop: 4 },
  comment:            { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10, alignItems: "flex-start" },
  commentBody:        { flex: 1, gap: 4 },
  commentBubble:      { padding: 12, gap: 2, borderRadius: 14 },
  commentAuthor:      { fontSize: 13, fontWeight: "700" },
  commentContent:     { fontSize: 14, lineHeight: 19 },
  commentActions:     { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 4 },
  commentTime:        { fontSize: 12 },
  commentAction:      { flexDirection: "row", alignItems: "center", gap: 4 },
  commentLikes:       { fontSize: 12 },
  commentReply:       { fontSize: 12, fontWeight: "700" },
  replyBar:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
  replyText:          { fontSize: 13 },
  inputBar:           { flexDirection: "row", alignItems: "flex-end", padding: 10, gap: 8, borderTopWidth: 1 },
  inputWrap:          { flex: 1, paddingHorizontal: 14, paddingVertical: 8 },
  input:              { fontSize: 14, maxHeight: 100 },
  sendBtn:            { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
