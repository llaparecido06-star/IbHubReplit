import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
}

const PARTICIPANT_MAP: Record<string, { name: string; status: string }> = {
  c1: { name: "Brenda Lima",     status: "Offline" },
  c2: { name: "Felipe Galtaroca", status: "Online" },
  c3: { name: "João Oliveira",   status: "Offline" },
  c4: { name: "Lucas Lima",      status: "Offline" },
};

const INITIAL_MESSAGES: Message[] = [
  { id: "m1", sender_id: "other", content: "Olá! Vi seu perfil e adorei sua experiência em enologia.", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "m2", sender_id: "me",    content: "Muito obrigado! Você também tem um perfil incrível.",      created_at: new Date(Date.now() - 3500000).toISOString() },
  { id: "m3", sender_id: "me",    content: "Ola",                                                      created_at: new Date(Date.now() - 600000).toISOString() },
];

export default function ChatScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput]       = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const listRef = useRef<FlatList>(null);

  const participant = PARTICIPANT_MAP[id] ?? { name: "Usuário", status: "Offline" };

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  const sendMessage = () => {
    if (!input.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg: Message = {
      id: Date.now().toString(),
      sender_id: "me",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [msg, ...prev]);
    setInput("");
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === "me";
    const time = new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && <Avatar name={participant.name} size={28} style={{ marginTop: 2 }} />}
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
          <Avatar name={participant.name} size={36} />
          <View>
            <Text style={[styles.participantName, { color: colors.navy }]}>{participant.name}</Text>
            <Text style={[styles.participantStatus, { color: colors.mutedForeground }]}>
              {participant.status}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Feather name="more-vertical" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={[styles.messagesList, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
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
            placeholder="Digite sua mensagem..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
        </View>
        {input.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.gold }]}
            onPress={sendMessage}
          >
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.micBtn}>
            <Feather name="mic" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* ⋮ Menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuCard, { backgroundColor: "#fff" }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); router.push(`/profile/${id}` as any); }}
            >
              <Feather name="user" size={18} color={colors.navy} />
              <Text style={[styles.menuItemText, { color: colors.navy }]}>Ver perfil</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Feather name="trash-2" size={18} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Limpar conversa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Feather name="slash" size={18} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Excluir conversa</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Feather name="flag" size={18} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Denunciar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerLeft:       { flexDirection: "row", alignItems: "center", gap: 10 },
  participantName:  { fontSize: 15, fontWeight: "700" },
  participantStatus:{ fontSize: 12 },
  messagesList:     { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  msgRow:           { flexDirection: "row", marginBottom: 10, gap: 8 },
  msgRowMe:         { justifyContent: "flex-end" },
  msgRowOther:      { justifyContent: "flex-start", alignItems: "flex-end" },
  bubble:           { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleText:       { fontSize: 14, lineHeight: 20 },
  bubbleTime:       { fontSize: 10, alignSelf: "flex-end" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1,
  },
  attachBtn:  { padding: 6 },
  inputWrap:  { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  input:      { fontSize: 14, maxHeight: 100 },
  sendBtn:    { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  micBtn:     { padding: 6 },
  menuOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 60, paddingRight: 16 },
  menuCard:   { width: 200, borderRadius: 12, overflow: "hidden", elevation: 8, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
  menuItem:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText: { fontSize: 14, fontWeight: "500" },
  menuDivider:{ height: 1, marginHorizontal: 16 },
});
