import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  status: "sending" | "sent" | "read";
}

const INITIAL_MESSAGES: Message[] = [
  { id: "m1", sender_id: "other", content: "Olá! Vi seu perfil e adorei sua experiência em enologia.", created_at: new Date(Date.now() - 3600000).toISOString(), status: "read" },
  { id: "m2", sender_id: "me", content: "Muito obrigado! Você também tem um perfil incrível.", created_at: new Date(Date.now() - 3500000).toISOString(), status: "read" },
  { id: "m3", sender_id: "other", content: "Você vai ao evento de degustação na próxima sexta?", created_at: new Date(Date.now() - 600000).toISOString(), status: "read" },
];

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const participantName = "Isabela Mondavi";

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const msg: Message = {
      id: Date.now().toString(),
      sender_id: user?.id ?? "me",
      content: input.trim(),
      created_at: new Date().toISOString(),
      status: "sending",
    };
    setMessages((prev) => [msg, ...prev]);
    setInput("");
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === (user?.id ?? "me");
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <Avatar name={participantName} size={28} style={{ marginTop: 2 }} />
        )}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? colors.navy : colors.card,
              borderRadius: colors.radius + 4,
              maxWidth: "75%",
              borderColor: isMe ? "transparent" : colors.border,
              borderWidth: isMe ? 0 : 1,
            },
          ]}
        >
          <Text style={[styles.bubbleText, { color: isMe ? "#ffffff" : colors.foreground }]}>
            {item.content}
          </Text>
          <Text style={[styles.msgTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
            {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {isMe && item.status === "read" && " ✓✓"}
          </Text>
        </View>
      </View>
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Pressable style={styles.headerUser} onPress={() => router.push(`/profile/other` as any)}>
          <Avatar name={participantName} size={38} />
          <View>
            <Text style={[styles.headerName, { color: colors.foreground }]}>{participantName}</Text>
            <Text style={[styles.headerStatus, { color: colors.gold }]}>Online</Text>
          </View>
        </Pressable>
        <TouchableOpacity>
          <Feather name="more-vertical" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.attachBtn}>
          <Feather name="paperclip" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderRadius: 24 }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Mensagem..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.gold : colors.secondary }]}
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Feather name="send" size={18} color={input.trim() ? colors.navy : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerUser: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerName: { fontSize: 16, fontWeight: "700" },
  headerStatus: { fontSize: 12, fontWeight: "600" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowMe: { justifyContent: "flex-end" },
  bubble: { padding: 12, gap: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  msgTime: { fontSize: 10, alignSelf: "flex-end" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  attachBtn: { padding: 4, marginBottom: 8 },
  inputWrap: { flex: 1, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100 },
  input: { fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
