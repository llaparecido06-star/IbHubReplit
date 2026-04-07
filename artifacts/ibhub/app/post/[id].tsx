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
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
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
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [comment, setComment] = useState("");
  const [loadingPost, setLoadingPost] = useState(true);
  const [sendingComment, setSendingComment] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const load = useCallback(async () => {
    if (!id) return;
    setLoadingPost(true);
    const [realPost, realComments] = await Promise.all([
      API.fetchPostById(id, user?.id),
      API.fetchComments(id),
    ]);
    if (realPost) setPost(realPost);
    setComments(realComments);
    setLoadingPost(false);
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  const sendComment = async () => {
    if (!comment.trim() || !user?.id || !id) return;
    setSendingComment(true);
    const text = comment.trim();
    setComment("");

    // Optimistic
    const tempComment: AppComment = {
      id: `tmp_${Date.now()}`,
      post_id: id,
      user_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      author: {
        id: user.id,
        full_name: "Você",
        avatar_url: null,
        headline: null,
      },
    };
    setComments(prev => [...prev, tempComment]);
    setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);

    const saved = await API.addComment(id, user.id, text);
    if (saved) {
      setComments(prev => prev.map(c => c.id === tempComment.id ? saved : c));
    }
    setSendingComment(false);
  };

  const handleLike = () => {
    if (!post || !user?.id) return;
    setPost(p => p ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    API.toggleLike(post.id, user.id, post.is_liked ?? false);
  };

  const handleBookmark = () => {
    if (!post || !user?.id) return;
    setPost(p => p ? { ...p, is_bookmarked: !p.is_bookmarked } : p);
    API.toggleBookmark(post.id, user.id, post.is_bookmarked ?? false);
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
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.comment, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.push(`/profile/${item.author?.id}` as any)}>
              <Avatar uri={item.author?.avatar_url} name={item.author?.full_name ?? "?"} size={36} />
            </TouchableOpacity>
            <View style={styles.commentBody}>
              <View style={[styles.commentBubble, { backgroundColor: colors.secondary, borderRadius: 14 }]}>
                <Text style={[styles.commentAuthor, { color: colors.foreground }]}>
                  {item.author?.full_name ?? "Usuário"}
                </Text>
                <Text style={[styles.commentContent, { color: colors.foreground }]}>{item.content}</Text>
              </View>
              <View style={styles.commentActions}>
                <Text style={[styles.commentTime, { color: colors.mutedForeground }]}>{timeAgo(item.created_at)}</Text>
                <TouchableOpacity style={styles.commentAction}>
                  <Text style={[styles.commentReply, { color: colors.gold }]}>Responder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListHeaderComponent={() => (
          <View style={[styles.postPreview, { borderBottomColor: colors.border }]}>
            {post && (
              <>
                {/* Author */}
                <TouchableOpacity
                  style={styles.authorRow}
                  onPress={() => router.push(`/profile/${post.author?.id}` as any)}
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
                  <TouchableOpacity style={styles.postAction} onPress={handleLike}>
                    <Feather
                      name="heart"
                      size={18}
                      color={post.is_liked ? "#e74c3c" : colors.mutedForeground}
                    />
                    <Text style={[styles.postActionCount, { color: post.is_liked ? "#e74c3c" : colors.mutedForeground }]}>
                      {post.likes_count}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postAction}>
                    <Feather name="message-circle" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.postActionCount, { color: colors.mutedForeground }]}>{post.comments_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postAction} onPress={handleBookmark}>
                    <Feather
                      name="bookmark"
                      size={18}
                      color={post.is_bookmarked ? colors.gold : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={[styles.commentsHeader, { color: colors.foreground }]}>
              {comments.length} {comments.length === 1 ? "comentário" : "comentários"}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
        <Avatar name="Você" size={34} />
        <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderRadius: 24 }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Adicionar comentário..."
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
  postActions:        { flexDirection: "row", gap: 20 },
  postAction:         { flexDirection: "row", alignItems: "center", gap: 5 },
  postActionCount:    { fontSize: 13, fontWeight: "600" },
  commentsHeader:     { fontSize: 15, fontWeight: "700", paddingTop: 4 },
  comment:            { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10, alignItems: "flex-start" },
  commentBody:        { flex: 1, gap: 4 },
  commentBubble:      { padding: 12, gap: 2 },
  commentAuthor:      { fontSize: 13, fontWeight: "700" },
  commentContent:     { fontSize: 14, lineHeight: 19 },
  commentActions:     { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 4 },
  commentTime:        { fontSize: 12 },
  commentAction:      { flexDirection: "row", alignItems: "center", gap: 4 },
  commentReply:       { fontSize: 12, fontWeight: "700" },
  inputBar:           { flexDirection: "row", alignItems: "flex-end", padding: 10, gap: 8, borderTopWidth: 1 },
  inputWrap:          { flex: 1, paddingHorizontal: 14, paddingVertical: 8 },
  input:              { fontSize: 14, maxHeight: 100 },
  sendBtn:            { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
