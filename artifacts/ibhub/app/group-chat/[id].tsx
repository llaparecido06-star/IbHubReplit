import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
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

interface GroupMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

const GROUP_MAP: Record<string, { name: string; members: number }> = {
  g1: { name: "Enoturismo", members: 2 },
  g2: { name: "Teste 2",    members: 1 },
};

const INITIAL: GroupMessage[] = [];

export default function GroupChatScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();

  const [messages, setMessages] = useState<GroupMessage[]>(INITIAL);
  const [input, setInput]       = useState("");
  const listRef = useRef<FlatList>(null);

  const group = GROUP_MAP[id] ?? { name: "Grupo", members: 0 };
  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  const sendMessage = () => {
    if (!input.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg: GroupMessage = {
      id: Date.now().toString(),
      sender_id: "me",
      sender_name: user?.name ?? "Você",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [msg, ...prev]);
    setInput("");
  };

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const isMe = item.sender_id === "me";
    const time = new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <View style={styles.senderWrap}>
            <Avatar name={item.sender_name} size={28} />
          </View>
        )}
        <View>
          {!isMe && (
            <Text style={[styles.senderName, { color: colors.gold }]}>{item.sender_name}</Text>
          )}
          <View style={[
            styles.bubble,
            { backgroundColor: isMe ? colors.navy : "#fff" },
            !isMe && { borderColor: colors.border, borderWidth: 1 },
          ]}>
            <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>
              {item.content}
            </Text>
            <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
              {time}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <View>
            <Text style={[styles.groupName, { color: colors.navy }]}>{group.name}</Text>
            <View style={styles.membersRow}>
              <Feather name="users" size={12} color={colors.mutedForeground} />
              <Text style={[styles.membersText, { color: colors.mutedForeground }]}>
                {group.members} {group.members === 1 ? "membro" : "membros"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/group-settings/${id}` as any)}>
          <Feather name="settings" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={[styles.messagesList, messages.length === 0 && styles.emptyList]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="message-circle" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma mensagem ainda. Seja o primeiro a falar!
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View style={[
        styles.inputBar,
        { backgroundColor: "#fff", borderTopColor: colors.border, paddingBottom: bottomPad + 12 },
      ]}>
        <TouchableOpacity style={styles.attachBtn}>
          <Feather name="paperclip" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { backgroundColor: colors.background }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Mensagem para o grupo..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
        </View>
        {input.trim() ? (
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.gold }]} onPress={sendMessage}>
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.micBtn}>
            <Feather name="mic" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  groupName:   { fontSize: 16, fontWeight: "700" },
  membersRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  membersText: { fontSize: 12 },
  messagesList:{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  emptyList:   { flex: 1, justifyContent: "center" },
  emptyWrap:   { alignItems: "center", gap: 12, paddingVertical: 60 },
  emptyText:   { fontSize: 14, textAlign: "center", maxWidth: 240 },
  senderWrap:  { marginTop: 18 },
  msgRow:      { flexDirection: "row", marginBottom: 10, gap: 8 },
  msgRowMe:    { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start", alignItems: "flex-end" },
  senderName:  { fontSize: 12, fontWeight: "600", marginBottom: 2, marginLeft: 2 },
  bubble: { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleText:  { fontSize: 14, lineHeight: 20 },
  bubbleTime:  { fontSize: 10, alignSelf: "flex-end" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1,
  },
  attachBtn: { padding: 6 },
  inputWrap: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  input:     { fontSize: 14, maxHeight: 100 },
  sendBtn:   { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  micBtn:    { padding: 6 },
});
