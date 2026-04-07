import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { supabase } from "@/context/AuthContext";
import * as API from "@/services/api";
import type { AppMessage } from "@/services/api";

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();

  const [messages, setMessages]     = useState<AppMessage[]>([]);
  const [input, setInput]           = useState("");
  const [showMenu, setShowMenu]     = useState(false);
  const [sending, setSending]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [participant, setParticipant] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);

  const listRef = useRef<FlatList>(null);
  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  const load = useCallback(async () => {
    if (!id || !user?.id) { setLoading(false); return; }
    const [msgs, part] = await Promise.all([
      API.fetchMessages(id),
      API.fetchConversationParticipant(id, user.id),
    ]);
    setMessages(msgs);
    setParticipant(part);
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Real-time subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const newMsg = payload.new as AppMessage;
          // Only add if not already in list (avoid duplicates from optimistic UI)
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const sendMessage = async () => {
    if (!input.trim() || !user?.id || !id || sending) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic
    const tempMsg: AppMessage = {
      id: `tmp_${Date.now()}`,
      conversation_id: id,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    const saved = await API.sendMessage(id, user.id, text);
    if (saved) {
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? saved : m));
    }
    setSending(false);
  };

  const renderMessage = ({ item }: { item: AppMessage }) => {
    const isMe = item.sender_id === user?.id;
    const isTemp = item.id.startsWith("tmp_");
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <Avatar
            uri={participant?.avatar_url}
            name={participant?.full_name ?? "?"}
            size={28}
            style={{ marginTop: 2 }}
          />
        )}
        <View style={[
          styles.bubble,
          { backgroundColor: isMe ? colors.navy : "#fff" },
          !isMe && { borderColor: colors.border, borderWidth: 1 },
          isTemp && { opacity: 0.7 },
        ]}>
          <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const participantName = participant?.full_name ?? "Chat";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Avatar uri={participant?.avatar_url} name={participantName} size={36} />
          <View>
            <Text style={[styles.participantName, { color: colors.navy }]}>{participantName}</Text>
            <Text style={[styles.participantStatus, { color: colors.mutedForeground }]}>
              {participant ? "Contato" : "Carregando..."}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Feather name="more-vertical" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.messagesList, { paddingBottom: 12 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-circle" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Comece a conversa!
              </Text>
            </View>
          }
        />
      )}

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
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
        </View>
        {input.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.gold }]}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="send" size={18} color="#fff" />
            }
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
            {participant?.id && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setShowMenu(false); router.push(`/profile/${participant.id}` as any); }}
              >
                <Feather name="user" size={18} color={colors.navy} />
                <Text style={[styles.menuItemText, { color: colors.navy }]}>Ver perfil</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Feather name="trash-2" size={18} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Limpar conversa</Text>
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
  container:         { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerLeft:        { flexDirection: "row", alignItems: "center", gap: 10 },
  participantName:   { fontSize: 15, fontWeight: "700" },
  participantStatus: { fontSize: 12 },
  loadingWrap:       { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList:      { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  msgRow:            { flexDirection: "row", marginBottom: 10, gap: 8 },
  msgRowMe:          { justifyContent: "flex-end" },
  msgRowOther:       { justifyContent: "flex-start", alignItems: "flex-end" },
  bubble:            { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleText:        { fontSize: 14, lineHeight: 20 },
  bubbleTime:        { fontSize: 10, alignSelf: "flex-end" },
  empty:             { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText:         { fontSize: 15 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1,
  },
  attachBtn:   { padding: 6 },
  inputWrap:   { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  input:       { fontSize: 14, maxHeight: 100 },
  sendBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  micBtn:      { padding: 6 },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 60, paddingRight: 16 },
  menuCard:    { width: 200, borderRadius: 12, overflow: "hidden", elevation: 8, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
  menuItem:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText:{ fontSize: 14, fontWeight: "500" },
  menuDivider: { height: 1, marginHorizontal: 16 },
});
