import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";

interface Comment {
  id: string;
  author: string;
  content: string;
  likes: number;
  time: string;
}

const MOCK_COMMENTS: Comment[] = [
  { id: "c1", author: "Rafael Borges", content: "Excelente análise! Concordo totalmente com os taninos.", likes: 12, time: "1h" },
  { id: "c2", author: "Carolina Stein", content: "Estive lá no mês passado e posso confirmar — safra excepcional.", likes: 8, time: "2h" },
  { id: "c3", author: "Marco Tulio", content: "Quais Quintas você visitou? Gostaria de replicar a experiência!", likes: 4, time: "3h" },
];

export default function PostDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(MOCK_COMMENTS);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const sendComment = () => {
    if (!comment.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      author: "Você",
      content: comment.trim(),
      likes: 0,
      time: "agora",
    };
    setComments([...comments, newComment]);
    setComment("");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
            <Avatar name={item.author} size={36} />
            <View style={styles.commentBody}>
              <View style={[styles.commentBubble, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
                <Text style={[styles.commentAuthor, { color: colors.foreground }]}>{item.author}</Text>
                <Text style={[styles.commentContent, { color: colors.foreground }]}>{item.content}</Text>
              </View>
              <View style={styles.commentActions}>
                <Text style={[styles.commentTime, { color: colors.mutedForeground }]}>{item.time}</Text>
                <TouchableOpacity style={styles.commentAction}>
                  <Feather name="heart" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.commentLikes, { color: colors.mutedForeground }]}>{item.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.commentAction}>
                  <Text style={[styles.commentReply, { color: colors.gold }]}>Responder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListHeaderComponent={() => (
          <View style={[styles.postPreview, { borderBottomColor: colors.border }]}>
            <Text style={[styles.postContentPreview, { color: colors.foreground }]}>
              Acabei de chegar de uma visita incrível ao Alentejo! Os tintos desta safra prometem muito.
            </Text>
            <Text style={[styles.commentsHeader, { color: colors.foreground }]}>
              {comments.length} comentários
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
        <Avatar name="Você" size={34} />
        <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderRadius: 24 }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Adicionar comentário..."
            placeholderTextColor={colors.mutedForeground}
            value={comment}
            onChangeText={setComment}
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: comment.trim() ? colors.gold : colors.secondary }]}
          onPress={sendComment}
        >
          <Feather name="send" size={16} color={comment.trim() ? colors.navy : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  postPreview: { padding: 16, borderBottomWidth: 1 },
  postContentPreview: { fontSize: 16, lineHeight: 24, marginBottom: 16 },
  commentsHeader: { fontSize: 16, fontWeight: "800" },
  comment: { flexDirection: "row", gap: 10, padding: 14, paddingLeft: 16, borderBottomWidth: 1 },
  commentBody: { flex: 1, gap: 6 },
  commentBubble: { padding: 12, gap: 4 },
  commentAuthor: { fontSize: 13, fontWeight: "700" },
  commentContent: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 4 },
  commentAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentTime: { fontSize: 12 },
  commentLikes: { fontSize: 12 },
  commentReply: { fontSize: 12, fontWeight: "700" },
  inputBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  inputWrap: { flex: 1, paddingHorizontal: 14, paddingVertical: 10 },
  input: { fontSize: 15 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
