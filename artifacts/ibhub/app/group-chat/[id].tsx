import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";

interface GroupMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  reply_to?: { id: string; sender_name: string; content: string } | null;
}

const GROUP_MAP: Record<string, { name: string; members: number }> = {
  g1: { name: "Enoturismo", members: 2 },
  g2: { name: "Teste 2",    members: 1 },
};

const REACTION_EMOJIS = ["🍷", "❤️", "👍", "😂", "🔥", "😮"];

export default function GroupChatScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput]       = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingName, setTypingName] = useState("");
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const group = GROUP_MAP[id] ?? { name: "Grupo", members: 0 };
  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  const myName = (user as any)?.full_name ?? (user as any)?.name ?? "Você";

  // Presence channel for typing
  useEffect(() => {
    if (!id || !user?.id) return;
    const presenceChannel = supabase.channel(`group-presence:${id}`, { config: { presence: { key: user.id } } });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const others = Object.entries(state).filter(([k]) => k !== user.id);
        const typingUser = others.find(([_, v]) => (v as any[])[0]?.typing);
        if (typingUser) {
          setIsTyping(true);
          setTypingName((typingUser[1] as any[])[0]?.name ?? "Alguém");
        } else {
          setIsTyping(false);
          setTypingName("");
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ typing: false, name: myName });
        }
      });

    return () => {
      presenceChannelRef.current = null;
      supabase.removeChannel(presenceChannel);
    };
  }, [id, user?.id, myName]);

  const broadcastTyping = useCallback(async (typing: boolean) => {
    if (!presenceChannelRef.current) return;
    await presenceChannelRef.current.track({ typing, name: myName });
  }, [myName]);

  const handleInputChange = (text: string) => {
    setInput(text);
    if (text.length > 0) {
      broadcastTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => broadcastTyping(false), 2000);
    } else {
      broadcastTyping(false);
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg: GroupMessage = {
      id: Date.now().toString(),
      sender_id: user?.id ?? "me",
      sender_name: myName,
      content: input.trim(),
      created_at: new Date().toISOString(),
      reply_to: replyTo ? { id: replyTo.id, sender_name: replyTo.sender_name, content: replyTo.content } : null,
    };
    setMessages((prev) => [...prev, msg]);
    setInput("");
    setReplyTo(null);
    broadcastTyping(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleReaction = (msgId: string, emoji: string) => {
    setReactionTarget(null);
    setReactions(prev => {
      const msgReactions = { ...(prev[msgId] ?? {}) };
      msgReactions[emoji] = (msgReactions[emoji] ?? 0) + 1;
      return { ...prev, [msgId]: msgReactions };
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const isMe = item.sender_id === user?.id;
    const time = new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const msgReactions = reactions[item.id] ?? {};
    const hasReactions = Object.keys(msgReactions).length > 0;

    return (
      <View style={[styles.msgGroup, isMe ? styles.msgGroupMe : styles.msgGroupOther]}>
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
            <Pressable
              style={[
                styles.bubble,
                { backgroundColor: isMe ? colors.navy : "#fff" },
                !isMe && { borderColor: colors.border, borderWidth: 1 },
              ]}
              onLongPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setReactionTarget(item.id);
              }}
              delayLongPress={400}
            >
              {item.reply_to && (
                <View style={[styles.quotedMsg, { borderLeftColor: colors.gold }]}>
                  <Text style={[styles.quotedSender, { color: colors.gold }]}>
                    {item.reply_to.sender_name}
                  </Text>
                  <Text style={[styles.quotedText, { color: isMe ? "#ffffff88" : colors.mutedForeground }]} numberOfLines={1}>
                    {item.reply_to.content}
                  </Text>
                </View>
              )}
              <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>
                {item.content}
              </Text>
              <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
                {time}
              </Text>
            </Pressable>
          </View>
          <TouchableOpacity
            style={styles.replyBtn}
            onPress={() => setReplyTo(isMe ? item : item)}
          >
            <Feather name={isMe ? "corner-up-right" : "corner-up-left"} size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        {hasReactions && (
          <View style={styles.reactionsRow}>
            {Object.entries(msgReactions).map(([emoji, count]) => (
              <View key={emoji} style={styles.reactionBadge}>
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
              </View>
            ))}
          </View>
        )}
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
              {isTyping ? (
                <Text style={[styles.membersText, { color: colors.gold, fontStyle: "italic" }]}>
                  {typingName} está digitando...
                </Text>
              ) : (
                <>
                  <Feather name="users" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.membersText, { color: colors.mutedForeground }]}>
                    {group.members} {group.members === 1 ? "membro" : "membros"}
                  </Text>
                </>
              )}
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

      {/* Reply preview */}
      {replyTo && (
        <View style={[styles.replyPreview, { backgroundColor: "#fff", borderTopColor: colors.gold }]}>
          <View style={[styles.replyPreviewBar, { backgroundColor: colors.gold }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.replyPreviewLabel, { color: colors.gold }]}>
              Respondendo a {replyTo.sender_id === user?.id ? "você mesmo" : replyTo.sender_name}
            </Text>
            <Text style={[styles.replyPreviewText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
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
            placeholder="Mensagem para o grupo..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={handleInputChange}
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

      {/* Reaction picker */}
      <Modal visible={!!reactionTarget} transparent animationType="fade" onRequestClose={() => setReactionTarget(null)}>
        <Pressable style={styles.reactionOverlay} onPress={() => setReactionTarget(null)}>
          <View style={[styles.reactionPicker, { backgroundColor: "#fff" }]}>
            {REACTION_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionPickerBtn}
                onPress={() => reactionTarget && handleReaction(reactionTarget, emoji)}
              >
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  msgGroup:    { marginBottom: 6 },
  msgGroupMe:  { alignItems: "flex-end" },
  msgGroupOther: { alignItems: "flex-start" },
  msgRow:      { flexDirection: "row", gap: 6, alignItems: "flex-end" },
  msgRowMe:    { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },
  replyBtn:    { padding: 4, opacity: 0.5 },
  senderName:  { fontSize: 12, fontWeight: "600", marginBottom: 2, marginLeft: 2 },
  bubble: { maxWidth: "72%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleText:  { fontSize: 14, lineHeight: 20 },
  bubbleTime:  { fontSize: 10, alignSelf: "flex-end" },
  quotedMsg:    { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6, gap: 2 },
  quotedSender: { fontSize: 11, fontWeight: "700" },
  quotedText:   { fontSize: 12 },

  // Reactions
  reactionsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2, paddingHorizontal: 4 },
  reactionBadge:   { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, backgroundColor: "#f3f4f6" },
  reactionEmoji:   { fontSize: 14 },
  reactionCount:   { fontSize: 11, fontWeight: "600", color: "#374151" },

  reactionOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", alignItems: "center" },
  reactionPicker:      { flexDirection: "row", gap: 8, padding: 14, borderRadius: 40, elevation: 10, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
  reactionPickerBtn:   { padding: 6 },
  reactionPickerEmoji: { fontSize: 28 },

  // Reply preview
  replyPreview:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 2 },
  replyPreviewBar:  { width: 3, alignSelf: "stretch", borderRadius: 2 },
  replyPreviewLabel:{ fontSize: 12, fontWeight: "700", marginBottom: 2 },
  replyPreviewText: { fontSize: 12, color: "#9ca3af" },

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
