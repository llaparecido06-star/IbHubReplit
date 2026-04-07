import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  const colors   = useColors();
  const router   = useRouter();
  const { id }   = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const [messages,    setMessages]    = useState<AppMessage[]>([]);
  const [input,       setInput]       = useState("");
  const [showMenu,    setShowMenu]    = useState(false);
  const [showAttach,  setShowAttach]  = useState(false);
  const [sending,     setSending]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [participant, setParticipant] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);

  const listRef   = useRef<FlatList>(null);
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
          setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Send text ────────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || !user?.id || !id || sending) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const text = input.trim();
    setInput("");
    setSending(true);

    const tempMsg: AppMessage = {
      id: `tmp_${Date.now()}`,
      conversation_id: id,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      message_type: "text",
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    const saved = await API.sendMessage(id, user.id, text);
    if (saved) setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? saved : m));
    setSending(false);
  };

  // ── Pick & send media ────────────────────────────────────────────────────────

  const pickAndSendMedia = async (type: "image" | "video" | "camera") => {
    setShowAttach(false);
    if (!user?.id || !id) return;

    let result: ImagePicker.ImagePickerResult;

    if (type === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permissão necessária", "Permita o acesso à câmera nas configurações do dispositivo.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.8 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permissão necessária", "Permita o acesso à galeria nas configurações do dispositivo.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === "video" ? ["videos"] : ["images", "videos"],
        quality: 0.8,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
    const msgType  = mimeType.startsWith("video") ? "video" : "image";

    // Optimistic preview
    const tempMsg: AppMessage = {
      id: `tmp_${Date.now()}`,
      conversation_id: id,
      sender_id: user.id,
      content: "",
      created_at: new Date().toISOString(),
      message_type: msgType,
      media_url: asset.uri,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    setUploading(true);
    const url = await API.uploadChatMedia(id, asset.uri, mimeType);
    setUploading(false);

    if (!url) {
      Alert.alert("Erro", "Não foi possível enviar a mídia. Tente novamente.");
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      return;
    }

    const saved = await API.sendMediaMessage(id, user.id, url, msgType);
    if (saved) setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? saved : m));
  };

  const handleAudio = () => {
    setShowAttach(false);
    Alert.alert(
      "Mensagem de voz",
      "Grave e segure o botão 🎤 ao lado do campo de texto para enviar um áudio.",
      [{ text: "OK" }],
    );
  };

  // ── Render message ───────────────────────────────────────────────────────────

  const renderMessage = ({ item }: { item: AppMessage }) => {
    const isMe   = item.sender_id === user?.id;
    const isTemp = item.id.startsWith("tmp_");
    const type   = item.message_type ?? "text";

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <TouchableOpacity onPress={() => participant && router.push(`/profile/${participant.id}` as any)}>
            <Avatar uri={participant?.avatar_url} name={participant?.full_name ?? "?"} size={28} style={{ marginTop: 2 }} />
          </TouchableOpacity>
        )}
        <View style={[
          styles.bubble,
          type === "image" || type === "video" ? styles.bubbleMedia : { backgroundColor: isMe ? colors.navy : "#fff" },
          !isMe && type !== "image" && type !== "video" && { borderColor: colors.border, borderWidth: 1 },
          isTemp && { opacity: 0.7 },
        ]}>
          {(type === "image" || type === "video") && item.media_url ? (
            <View>
              <Image
                source={{ uri: item.media_url }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
              {type === "video" && (
                <View style={styles.videoOverlay}>
                  <Feather name="play-circle" size={32} color="#fff" />
                </View>
              )}
              {!!item.content && (
                <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground, paddingHorizontal: 10, paddingBottom: 6 }]}>
                  {item.content}
                </Text>
              )}
              <Text style={[styles.bubbleTime, { color: "#ffffffaa", paddingHorizontal: 10, paddingBottom: 6 }]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          ) : type === "audio" ? (
            <View style={styles.audioRow}>
              <Feather name="mic" size={16} color={isMe ? "#fff" : colors.navy} />
              <View style={[styles.audioBar, { backgroundColor: isMe ? "#ffffff44" : colors.border }]}>
                <View style={[styles.audioFill, { backgroundColor: isMe ? "#fff" : colors.navy, width: "60%" }]} />
              </View>
              <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>{item.content}</Text>
              <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
                {formatTime(item.created_at)}
              </Text>
            </>
          )}
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
        <TouchableOpacity style={styles.headerLeft} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => participant && router.push(`/profile/${participant.id}` as any)}
          activeOpacity={0.7}
        >
          <Avatar uri={participant?.avatar_url} name={participantName} size={36} />
          <View>
            <Text style={[styles.participantName, { color: colors.navy }]}>{participantName}</Text>
            <Text style={[styles.participantStatus, { color: colors.mutedForeground }]}>
              {participant ? "Ver perfil" : "Carregando..."}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Feather name="more-vertical" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.gold} /></View>
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
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Comece a conversa!</Text>
            </View>
          }
        />
      )}

      {/* Uploading indicator */}
      {uploading && (
        <View style={[styles.uploadingBanner, { backgroundColor: colors.gold }]}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.uploadingText}>Enviando mídia...</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: "#fff", borderTopColor: colors.border, paddingBottom: bottomPad + 12 }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttach(true)}>
          <Feather name="paperclip" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { backgroundColor: colors.background }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Mensagem..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
        </View>
        {input.trim() ? (
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.gold }]} onPress={sendMessage} disabled={sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.micBtn} onPress={handleAudio}>
            <Feather name="mic" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Attach bottom sheet */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setShowAttach(false)}>
          <View style={[styles.attachSheet, { backgroundColor: "#fff" }]}>
            <View style={[styles.attachHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.attachTitle, { color: colors.navy }]}>Enviar arquivo</Text>
            <View style={styles.attachGrid}>
              {[
                { icon: "camera" as const,       label: "Câmera",      action: () => pickAndSendMedia("camera") },
                { icon: "image" as const,         label: "Galeria",     action: () => pickAndSendMedia("image") },
                { icon: "film" as const,          label: "Vídeo",       action: () => pickAndSendMedia("video") },
                { icon: "mic" as const,           label: "Áudio",       action: handleAudio },
              ].map(({ icon, label, action }) => (
                <TouchableOpacity key={label} style={[styles.attachOption, { backgroundColor: colors.background }]} onPress={action}>
                  <View style={[styles.attachIconCircle, { backgroundColor: colors.navy }]}>
                    <Feather name={icon} size={22} color="#fff" />
                  </View>
                  <Text style={[styles.attachLabel, { color: colors.foreground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

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
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft:      { padding: 4 },
  headerCenter:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 8 },
  participantName: { fontSize: 15, fontWeight: "700" },
  participantStatus:{ fontSize: 11, color: "#9ca3af" },
  loadingWrap:     { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList:    { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  msgRow:          { flexDirection: "row", marginBottom: 10, gap: 8 },
  msgRowMe:        { justifyContent: "flex-end" },
  msgRowOther:     { justifyContent: "flex-start", alignItems: "flex-end" },
  bubble:          { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleMedia:     { maxWidth: "75%", borderRadius: 16, overflow: "hidden", padding: 0 },
  bubbleText:      { fontSize: 14, lineHeight: 20 },
  bubbleTime:      { fontSize: 10, alignSelf: "flex-end" },
  mediaImage:      { width: 220, height: 170 },
  videoOverlay:    { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  audioRow:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  audioBar:        { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  audioFill:       { height: 4, borderRadius: 2 },
  empty:           { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText:       { fontSize: 15 },
  uploadingBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8 },
  uploadingText:   { color: "#fff", fontSize: 13, fontWeight: "600" },
  inputBar:        { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  attachBtn:       { padding: 6 },
  inputWrap:       { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  input:           { fontSize: 14, maxHeight: 100 },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  micBtn:          { padding: 6 },
  attachOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  attachSheet:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 16 },
  attachHandle:    { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  attachTitle:     { fontSize: 16, fontWeight: "700" },
  attachGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  attachOption:    { alignItems: "center", gap: 8, width: 70 },
  attachIconCircle:{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  attachLabel:     { fontSize: 12, textAlign: "center" },
  menuOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 60, paddingRight: 16 },
  menuCard:        { width: 200, borderRadius: 12, overflow: "hidden", elevation: 8, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
  menuItem:        { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText:    { fontSize: 14, fontWeight: "500" },
  menuDivider:     { height: 1, marginHorizontal: 16 },
});
