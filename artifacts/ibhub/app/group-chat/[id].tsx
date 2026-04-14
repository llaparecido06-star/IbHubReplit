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
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import * as API from "@/services/api";
import type { AppMessage } from "@/services/api";

const REACTION_EMOJIS = ["🍷", "❤️", "👍", "😂", "🔥", "😮"];

interface GroupInfo {
  name: string;
  member_count: number;
}

interface SenderProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export default function GroupChatScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();

  const [groupInfo, setGroupInfo]       = useState<GroupInfo>({ name: "Grupo", member_count: 0 });
  const [messages, setMessages]         = useState<AppMessage[]>([]);
  const [profiles, setProfiles]         = useState<Map<string, SenderProfile>>(new Map());
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(false);
  const [isTyping, setIsTyping]         = useState(false);
  const [typingName, setTypingName]     = useState("");
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [replyTo, setReplyTo]           = useState<AppMessage | null>(null);

  const listRef            = useRef<FlatList>(null);
  const typingTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelRef         = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seenMsgIds         = useRef<Set<string>>(new Set());

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  const myName = (user as any)?.full_name ?? (user as any)?.name ?? "Você";

  // ── Load group info + messages ────────────────────────────────────────────

  const loadProfiles = useCallback(async (msgs: AppMessage[]) => {
    const senderIds = Array.from(new Set(msgs.map(m => m.sender_id)));
    if (senderIds.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", senderIds);
    if (data) {
      const map = new Map<string, SenderProfile>();
      for (const p of data as SenderProfile[]) map.set(p.id, p);
      setProfiles(map);
    }
  }, []);

  const load = useCallback(async () => {
    if (!id || !user?.id) { setLoading(false); return; }

    // Load group conversation info
    const [convRes, partRes, msgs] = await Promise.all([
      supabase.from("conversations").select("id, name").eq("id", id).maybeSingle(),
      supabase.from("conversation_participants").select("user_id").eq("conversation_id", id),
      API.fetchMessages(id, user.id),
    ]);

    const convName = (convRes.data as any)?.name ?? "Grupo";
    const memberCount = (partRes.data ?? []).length;
    setGroupInfo({ name: convName, member_count: memberCount });

    setMessages(msgs);
    seenMsgIds.current = new Set(msgs.map(m => m.id));
    await loadProfiles(msgs);

    API.markConversationRead(id, user.id);
    setLoading(false);
  }, [id, user?.id, loadProfiles]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime: new messages ────────────────────────────────────────────────

  useEffect(() => {
    if (!id || !user?.id) return;
    if (channelRef.current) return;

    const ch = supabase
      .channel(`group-chat:${id}:${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async (payload) => {
          const raw = payload.new as AppMessage;
          if (seenMsgIds.current.has(raw.id)) return;
          seenMsgIds.current.add(raw.id);
          setMessages(prev => [...prev, raw]);
          // Fetch sender profile if not cached
          setProfiles(prev => {
            if (!prev.has(raw.sender_id)) {
              supabase.from("profiles").select("id, full_name, avatar_url").eq("id", raw.sender_id).maybeSingle().then(({ data }) => {
                if (data) setProfiles(p => new Map(p).set(data.id, data as SenderProfile));
              });
            }
            return prev;
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
          if (raw.sender_id !== user.id) {
            API.markConversationRead(id, user.id);
          }
        },
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [id, user?.id]);

  // ── Presence: typing indicator ────────────────────────────────────────────

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

  // ── Typing broadcast ──────────────────────────────────────────────────────

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

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!input.trim() || sending || !user?.id) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const text = input.trim();
    setInput("");
    setSending(true);
    broadcastTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);

    await API.sendMessage(id, user.id, text, {
      reply_to_id: replyTo?.id,
    });

    setReplyTo(null);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Reactions (local only — reactions table is for individual chats) ──────

  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, number>>>({});

  const handleReaction = (msgId: string, emoji: string) => {
    setReactionTarget(null);
    setReactionsMap(prev => {
      const cur = { ...(prev[msgId] ?? {}) };
      cur[emoji] = (cur[emoji] ?? 0) + 1;
      return { ...prev, [msgId]: cur };
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── Render message ────────────────────────────────────────────────────────

  const renderMessage = ({ item }: { item: AppMessage }) => {
    const isMe  = item.sender_id === user?.id;
    const time  = new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const sender = profiles.get(item.sender_id);
    const senderName = isMe ? myName : (sender?.full_name ?? "Membro");
    const msgReactions = reactionsMap[item.id] ?? {};
    const hasReactions = Object.keys(msgReactions).length > 0;

    return (
      <View style={[styles.msgGroup, isMe ? styles.msgGroupMe : styles.msgGroupOther]}>
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {!isMe && (
            <View style={styles.senderWrap}>
              <Avatar name={senderName} uri={sender?.avatar_url ?? undefined} size={28} />
            </View>
          )}
          <View style={{ maxWidth: "80%" }}>
            {!isMe && (
              <Text style={[styles.senderName, { color: colors.gold }]}>{senderName}</Text>
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
                  <Text style={[styles.quotedSender, { color: colors.gold }]} numberOfLines={1}>
                    {item.reply_to.sender_id === user?.id ? "Você" : (profiles.get(item.reply_to.sender_id)?.full_name ?? "Membro")}
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
          <TouchableOpacity style={styles.replyBtn} onPress={() => setReplyTo(item)}>
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

  // ── Main render ───────────────────────────────────────────────────────────

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
            <Text style={[styles.groupName, { color: colors.navy }]}>{groupInfo.name}</Text>
            <View style={styles.membersRow}>
              {isTyping ? (
                <Text style={[styles.membersText, { color: colors.gold, fontStyle: "italic" }]}>
                  {typingName} está digitando...
                </Text>
              ) : (
                <>
                  <Feather name="users" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.membersText, { color: colors.mutedForeground }]}>
                    {groupInfo.member_count} {groupInfo.member_count === 1 ? "membro" : "membros"}
                  </Text>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} style={styles.headerRight}>
          <Feather name="more-vertical" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                Nenhuma mensagem ainda. Diga olá! 👋
              </Text>
            </View>
          }
        />
      )}

      {/* Reply preview */}
      {replyTo && (
        <View style={[styles.replyBar, { backgroundColor: colors.gold + "18", borderTopColor: colors.gold + "40" }]}>
          <View style={[styles.replyBarAccent, { backgroundColor: colors.gold }]} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>
              {replyTo.sender_id === user?.id ? "Você" : (profiles.get(replyTo.sender_id)?.full_name ?? "Membro")}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: bottomPad + 8, backgroundColor: "#fff", borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
          value={input}
          onChangeText={handleInputChange}
          placeholder="Mensagem…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.navy : colors.border }]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Reaction picker modal */}
      <Modal
        visible={!!reactionTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionTarget(null)}
      >
        <Pressable style={styles.reactionOverlay} onPress={() => setReactionTarget(null)}>
          <View style={[styles.reactionPicker, { backgroundColor: "#fff", borderColor: colors.border }]}>
            {REACTION_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionOption}
                onPress={() => reactionTarget && handleReaction(reactionTarget, emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft:       { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  headerRight:      { padding: 4 },
  groupName:        { fontSize: 16, fontWeight: "700" },
  membersRow:       { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  membersText:      { fontSize: 12 },
  msgGroup:         { marginBottom: 12 },
  msgGroupMe:       { alignItems: "flex-end" },
  msgGroupOther:    { alignItems: "flex-start" },
  msgRow:           { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  msgRowMe:         { justifyContent: "flex-end" },
  msgRowOther:      { justifyContent: "flex-start" },
  senderWrap:       { marginBottom: 2 },
  senderName:       { fontSize: 11, fontWeight: "700", marginBottom: 3, marginLeft: 4 },
  bubble:           { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "100%" },
  bubbleText:       { fontSize: 15, lineHeight: 20 },
  bubbleTime:       { fontSize: 10, marginTop: 4, textAlign: "right" },
  quotedMsg:        { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 8, opacity: 0.9 },
  quotedSender:     { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  quotedText:       { fontSize: 12 },
  replyBtn:         { padding: 6, opacity: 0.6 },
  reactionsRow:     { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4, marginHorizontal: 36 },
  reactionBadge:    { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, gap: 3 },
  reactionEmoji:    { fontSize: 16 },
  reactionCount:    { fontSize: 12, fontWeight: "700", color: "#555" },
  replyBar:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  replyBarAccent:   { width: 3, height: "100%", borderRadius: 2 },
  inputRow:         { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  input:            { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 120 },
  sendBtn:          { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  reactionOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  reactionPicker:   { flexDirection: "row", borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  reactionOption:   { padding: 6 },
});
