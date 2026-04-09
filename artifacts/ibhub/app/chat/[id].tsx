import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "@/utils/safeNotifications";
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
  ScrollView,
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

const INTRO_TEMPLATES = [
  "Olá! Sou produtor de vinho e adoraria conectar com você. Tenho interesse em conhecer seu trabalho no mercado vinícola.",
  "Oi! Vi seu perfil e fiquei impressionado com sua trajetória. Gostaria de conversar sobre possíveis parcerias.",
  "Olá! Sou sommelier certificado e estou sempre em busca de novos produtores para recomendar. Podemos trocar experiências?",
  "Boa tarde! Participei de um evento que você organizou e adorei. Podemos conversar sobre colaborações futuras?",
  "Olá! Trabalho com distribuição de vinhos artesanais e acho que seu produto pode ter espaço no meu portfólio.",
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const colors   = useColors();
  const router   = useRouter();
  const { id }   = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const [messages,       setMessages]       = useState<AppMessage[]>([]);
  const [input,          setInput]          = useState("");
  const [showMenu,       setShowMenu]       = useState(false);
  const [showAttach,     setShowAttach]     = useState(false);
  const [showProspect,   setShowProspect]   = useState(false);
  const [showWines,      setShowWines]      = useState(false);
  const [showTemplates,  setShowTemplates]  = useState(false);
  const [showFollowUp,   setShowFollowUp]   = useState(false);
  const [showReactions,  setShowReactions]  = useState<string | null>(null);
  const [replyTo,        setReplyTo]        = useState<AppMessage | null>(null);
  const [sending,        setSending]        = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [isTyping,       setIsTyping]       = useState(false);
  const [wines,          setWines]          = useState<any[]>([]);
  const [followUpDays,   setFollowUpDays]   = useState("3");
  const [participant,    setParticipant]    = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);

  const listRef           = useRef<FlatList>(null);
  const typingTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  const load = useCallback(async () => {
    if (!id || !user?.id) { setLoading(false); return; }
    const [msgs, part] = await Promise.all([
      API.fetchMessages(id, user.id),
      API.fetchConversationParticipant(id, user.id),
    ]);
    setMessages(msgs);
    setParticipant(part);
    setLoading(false);
    API.markConversationRead(id, user.id);
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Real-time subscription for new messages
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
          if (newMsg.sender_id !== user?.id) {
            API.markConversationRead(id, user!.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const updated = payload.new as AppMessage;
          setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, read_at: updated.read_at } : m));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user?.id]);

  // Realtime presence for typing indicator
  useEffect(() => {
    if (!id || !user?.id) return;
    const presenceChannel = supabase.channel(`presence:${id}`, { config: { presence: { key: user.id } } });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const others = Object.keys(state).filter(k => k !== user.id);
        const anyTyping = others.some(k => (state[k] as any[]).some((s: any) => s.typing));
        setIsTyping(anyTyping);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ typing: false });
        }
      });

    return () => {
      presenceChannelRef.current = null;
      supabase.removeChannel(presenceChannel);
    };
  }, [id, user?.id]);

  const broadcastTyping = useCallback(async (isCurrentlyTyping: boolean) => {
    if (!presenceChannelRef.current) return;
    await presenceChannelRef.current.track({ typing: isCurrentlyTyping });
  }, []);

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

  // Push notification registration
  useEffect(() => {
    if (!user?.id || Platform.OS === "web") return;
    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;
        const tokenData = await Notifications.getExpoPushTokenAsync();
        if (tokenData.data) {
          await API.savePushToken(user.id, tokenData.data);
        }
      } catch {}
    })();
  }, [user?.id]);

  // ── Send text ────────────────────────────────────────────────────────────────

  const sendMessage = async (overrideText?: string, opts?: { reply_to_id?: string; message_type?: string; metadata?: Record<string, any> }) => {
    const text = (overrideText ?? input).trim();
    if (!text || !user?.id || !id || sending) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setInput("");
    setReplyTo(null);
    broadcastTyping(false);
    setSending(true);

    const tempMsg: AppMessage = {
      id: `tmp_${Date.now()}`,
      conversation_id: id,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      message_type: (opts?.message_type as any) ?? "text",
      reply_to_id: opts?.reply_to_id ?? replyTo?.id ?? null,
      reply_to: replyTo ? { content: replyTo.content, sender_id: replyTo.sender_id } : null,
      metadata: opts?.metadata ?? null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    const saved = await API.sendMessage(id, user.id, text, {
      reply_to_id: opts?.reply_to_id ?? replyTo?.id,
      message_type: opts?.message_type,
      metadata: opts?.metadata,
    });
    if (saved) setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? saved : m));
    setSending(false);
    // Fire-and-forget: dispatch push notification to recipients
    const senderName = (user as any)?.full_name ?? (user as any)?.name ?? "Alguém";
    const pushBody = opts?.message_type === "post_share" ? "📎 Compartilhou uma postagem" :
                     opts?.message_type === "wine_card"  ? "🍷 Enviou um vinho" : text;
    API.dispatchPushToConversation(id, user.id, senderName, pushBody).catch(() => {});
  };

  // ── Reactions ────────────────────────────────────────────────────────────────

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    setShowReactions(null);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await API.toggleMessageReaction(messageId, user.id, emoji);
    const updated = await API.fetchMessages(id, user.id);
    setMessages(updated);
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

  // ── Send Wine Card ────────────────────────────────────────────────────────────

  const loadWines = async () => {
    if (!user?.id) return;
    const data = await API.fetchUserWines(user.id);
    setWines(data);
    setShowWines(true);
    setShowProspect(false);
  };

  const sendWineCard = async (wine: any) => {
    setShowWines(false);
    await sendMessage(wine.name, {
      message_type: "wine_card",
      metadata: {
        wine_id: wine.id,
        name: wine.name,
        vintage: wine.vintage,
        region: wine.region,
        notes: wine.notes,
        image_url: wine.image_url,
      },
    });
  };

  // ── Schedule Follow-up Reminder ───────────────────────────────────────────────

  const scheduleFollowUp = async () => {
    setShowFollowUp(false);
    const days = parseInt(followUpDays, 10);
    if (!days || isNaN(days) || days < 1) return;
    const trigger = new Date();
    trigger.setDate(trigger.getDate() + days);
    trigger.setHours(9, 0, 0, 0);
    // Persist follow-up date in AsyncStorage for badge display in conversation list
    try {
      const raw = await AsyncStorage.getItem("ibhub_followup_reminders");
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[id] = trigger.toISOString();
      await AsyncStorage.setItem("ibhub_followup_reminders", JSON.stringify(map));
    } catch {}
    if (Platform.OS === "web") {
      Alert.alert("Lembrete agendado", `Você receberá um lembrete em ${days} dia(s) para retomar esta conversa.`);
      return;
    }
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Ative as notificações para agendar lembretes.");
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Lembrete de Follow-up",
          body: `Hora de retomar a conversa com ${participant?.full_name ?? "seu contato"}!`,
          data: { conversationId: id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
      Alert.alert("Lembrete agendado", `Você receberá um lembrete em ${days} dia(s).`);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível agendar o lembrete.");
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderReadReceipt = (item: AppMessage) => {
    const isMe = item.sender_id === user?.id;
    if (!isMe || item.id.startsWith("tmp_")) return null;
    if (item.read_at) {
      return (
        <View style={styles.receiptRow}>
          <Text style={[styles.receiptText, { color: colors.gold }]}>✓✓</Text>
        </View>
      );
    }
    return (
      <View style={styles.receiptRow}>
        <Text style={[styles.receiptText, { color: colors.mutedForeground }]}>✓</Text>
      </View>
    );
  };

  const renderReactions = (item: AppMessage) => {
    if (!item.reactions || item.reactions.length === 0) return null;
    return (
      <View style={styles.reactionsRow}>
        {item.reactions.map(r => (
          <TouchableOpacity
            key={r.emoji}
            style={[styles.reactionBadge, r.mine && { borderColor: colors.gold, borderWidth: 1 }]}
            onPress={() => handleReaction(item.id, r.emoji)}
          >
            <Text style={styles.reactionEmoji}>{r.emoji}</Text>
            {r.count > 1 && <Text style={styles.reactionCount}>{r.count}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderQuotedMessage = (item: AppMessage) => {
    if (!item.reply_to) return null;
    const isReplyFromMe = item.reply_to.sender_id === user?.id;
    return (
      <View style={[styles.quotedMsg, { borderLeftColor: colors.gold }]}>
        <Text style={[styles.quotedSender, { color: colors.gold }]}>
          {isReplyFromMe ? "Você" : (participant?.full_name ?? "Usuário")}
        </Text>
        <Text style={styles.quotedContent} numberOfLines={2}>{item.reply_to.content}</Text>
      </View>
    );
  };

  const renderPostShareBubble = (item: AppMessage, isMe: boolean) => {
    const meta = item.metadata;
    if (!meta) return null;
    return (
      <View style={[styles.postShareCard, { backgroundColor: isMe ? "rgba(255,255,255,0.15)" : colors.background, borderColor: isMe ? "rgba(255,255,255,0.3)" : colors.border }]}>
        {meta.image_url && (
          <Image source={{ uri: meta.image_url }} style={styles.postShareImage} resizeMode="cover" />
        )}
        <View style={styles.postShareBody}>
          <Text style={[styles.postShareAuthor, { color: isMe ? "#ffffff99" : colors.mutedForeground }]} numberOfLines={1}>
            📝 {meta.author_name ?? "Publicação"}
          </Text>
          <Text style={[styles.postShareContent, { color: isMe ? "#fff" : colors.foreground }]} numberOfLines={3}>
            {meta.content ?? item.content}
          </Text>
        </View>
      </View>
    );
  };

  const renderWineCardBubble = (item: AppMessage, isMe: boolean) => {
    const meta = item.metadata;
    if (!meta) return null;
    return (
      <View style={[styles.wineCard, { backgroundColor: isMe ? "rgba(255,255,255,0.12)" : "#fff9f0", borderColor: isMe ? "rgba(201,168,76,0.5)" : colors.gold }]}>
        <View style={styles.wineCardHeader}>
          <Text style={styles.wineCardIcon}>🍷</Text>
          <Text style={[styles.wineCardBadge, { color: colors.gold }]}>Ficha de Vinho</Text>
        </View>
        {meta.image_url && (
          <Image source={{ uri: meta.image_url }} style={styles.wineCardImage} resizeMode="cover" />
        )}
        <Text style={[styles.wineCardName, { color: isMe ? "#fff" : colors.navy }]}>{meta.name}</Text>
        {meta.vintage && (
          <Text style={[styles.wineCardDetail, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>Safra: {meta.vintage}</Text>
        )}
        {meta.region && (
          <Text style={[styles.wineCardDetail, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>Região: {meta.region}</Text>
        )}
        {meta.notes && (
          <Text style={[styles.wineCardNotes, { color: isMe ? "#ffffffcc" : colors.foreground }]} numberOfLines={3}>{meta.notes}</Text>
        )}
      </View>
    );
  };

  // ── Render message ───────────────────────────────────────────────────────────

  const renderMessage = ({ item }: { item: AppMessage }) => {
    const isMe   = item.sender_id === user?.id;
    const isTemp = item.id.startsWith("tmp_");
    const type   = item.message_type ?? "text";

    return (
      <View style={[styles.msgGroup, isMe ? styles.msgGroupMe : styles.msgGroupOther]}>
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {!isMe && (
            <TouchableOpacity onPress={() => participant && router.push(`/profile/${participant.id}` as any)}>
              <Avatar uri={participant?.avatar_url} name={participant?.full_name ?? "?"} size={28} style={{ marginTop: 2 }} />
            </TouchableOpacity>
          )}
          <Pressable
            style={[
              styles.bubble,
              type === "image" || type === "video" ? styles.bubbleMedia : { backgroundColor: isMe ? colors.navy : "#fff" },
              !isMe && type !== "image" && type !== "video" && { borderColor: colors.border, borderWidth: 1 },
              isTemp && { opacity: 0.7 },
            ]}
            onLongPress={() => {
              if (!isTemp) {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowReactions(item.id);
              }
            }}
            delayLongPress={400}
          >
            {renderQuotedMessage(item)}

            {type === "post_share" ? (
              <>
                {renderPostShareBubble(item, isMe)}
                <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground, paddingHorizontal: 4 }]}>
                  {formatTime(item.created_at)}
                </Text>
              </>
            ) : type === "wine_card" ? (
              <>
                {renderWineCardBubble(item, isMe)}
                <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground, paddingHorizontal: 4 }]}>
                  {formatTime(item.created_at)}
                </Text>
              </>
            ) : (type === "image" || type === "video") && item.media_url ? (
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
          </Pressable>

          {!isMe && (
            <TouchableOpacity
              style={styles.replyBtn}
              onPress={() => setReplyTo(item)}
            >
              <Feather name="corner-up-left" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {isMe && (
            <TouchableOpacity
              style={styles.replyBtn}
              onPress={() => setReplyTo(item)}
            >
              <Feather name="corner-up-right" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {renderReactions(item)}
        {renderReadReceipt(item)}
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
            <Text style={[styles.participantStatus, { color: isTyping ? colors.gold : colors.mutedForeground }]}>
              {isTyping ? "digitando..." : (participant ? "Ver perfil" : "Carregando...")}
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

      {/* Typing indicator */}
      {isTyping && (
        <View style={[styles.typingBanner, { backgroundColor: "#fff", borderTopColor: colors.border }]}>
          <Text style={[styles.typingText, { color: colors.mutedForeground }]}>
            {participantName} está digitando...
          </Text>
        </View>
      )}

      {/* Reply preview */}
      {replyTo && (
        <View style={[styles.replyPreview, { backgroundColor: "#fff", borderTopColor: colors.gold }]}>
          <View style={[styles.replyPreviewBar, { backgroundColor: colors.gold }]} />
          <View style={styles.replyPreviewContent}>
            <Text style={[styles.replyPreviewLabel, { color: colors.gold }]}>
              Respondendo a {replyTo.sender_id === user?.id ? "você mesmo" : participantName}
            </Text>
            <Text style={[styles.replyPreviewText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyPreviewClose}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: "#fff", borderTopColor: colors.border, paddingBottom: bottomPad + 12 }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttach(true)}>
          <Feather name="paperclip" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachBtn} onPress={() => setShowProspect(true)}>
          <Feather name="plus-circle" size={22} color={colors.gold} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { backgroundColor: colors.background }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Mensagem..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={handleInputChange}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
        </View>
        {input.trim() ? (
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.gold }]} onPress={() => sendMessage()} disabled={sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.micBtn} onPress={handleAudio}>
            <Feather name="mic" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Reaction picker modal */}
      <Modal visible={!!showReactions} transparent animationType="fade" onRequestClose={() => setShowReactions(null)}>
        <Pressable style={styles.reactionOverlay} onPress={() => setShowReactions(null)}>
          <View style={[styles.reactionPicker, { backgroundColor: "#fff" }]}>
            {REACTION_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionPickerBtn}
                onPress={() => showReactions && handleReaction(showReactions, emoji)}
              >
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

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

      {/* Prospecting menu */}
      <Modal visible={showProspect} transparent animationType="slide" onRequestClose={() => setShowProspect(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setShowProspect(false)}>
          <View style={[styles.attachSheet, { backgroundColor: "#fff" }]}>
            <View style={[styles.attachHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.attachTitle, { color: colors.navy }]}>Ferramentas de Prospecção</Text>
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={[styles.prospectItem, { backgroundColor: colors.background }]}
                onPress={loadWines}
              >
                <View style={[styles.prospectIcon, { backgroundColor: colors.gold + "20" }]}>
                  <Text style={{ fontSize: 22 }}>🍷</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prospectTitle, { color: colors.navy }]}>Enviar Ficha de Vinho</Text>
                  <Text style={[styles.prospectSub, { color: colors.mutedForeground }]}>Compartilhe um vinho do seu catálogo</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.prospectItem, { backgroundColor: colors.background }]}
                onPress={() => { setShowProspect(false); setShowTemplates(true); }}
              >
                <View style={[styles.prospectIcon, { backgroundColor: colors.navy + "15" }]}>
                  <Feather name="message-square" size={20} color={colors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prospectTitle, { color: colors.navy }]}>Template de Introdução</Text>
                  <Text style={[styles.prospectSub, { color: colors.mutedForeground }]}>Mensagens prontas para prospecção</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.prospectItem, { backgroundColor: colors.background }]}
                onPress={() => { setShowProspect(false); setShowFollowUp(true); }}
              >
                <View style={[styles.prospectIcon, { backgroundColor: "#10b981" + "20" }]}>
                  <Feather name="clock" size={20} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prospectTitle, { color: colors.navy }]}>Lembrete de Follow-up</Text>
                  <Text style={[styles.prospectSub, { color: colors.mutedForeground }]}>Agende um lembrete para retomar</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Wine selector */}
      <Modal visible={showWines} transparent animationType="slide" onRequestClose={() => setShowWines(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setShowWines(false)}>
          <View style={[styles.attachSheet, { backgroundColor: "#fff", maxHeight: "80%" }]}>
            <View style={[styles.attachHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.attachTitle, { color: colors.navy }]}>Selecionar Vinho</Text>
            {wines.length === 0 ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 32 }}>🍷</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Você ainda não tem vinhos cadastrados
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {wines.map(wine => (
                  <TouchableOpacity
                    key={wine.id}
                    style={[styles.wineRow, { borderBottomColor: colors.border }]}
                    onPress={() => sendWineCard(wine)}
                  >
                    {wine.image_url ? (
                      <Image source={{ uri: wine.image_url }} style={styles.wineRowImage} />
                    ) : (
                      <View style={[styles.wineRowImage, { backgroundColor: colors.gold + "20", alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ fontSize: 20 }}>🍷</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.wineRowName, { color: colors.navy }]}>{wine.name}</Text>
                      {(wine.vintage || wine.region) && (
                        <Text style={[styles.wineRowSub, { color: colors.mutedForeground }]}>
                          {[wine.vintage, wine.region].filter(Boolean).join(" · ")}
                        </Text>
                      )}
                    </View>
                    <Feather name="send" size={16} color={colors.gold} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Templates */}
      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setShowTemplates(false)}>
          <View style={[styles.attachSheet, { backgroundColor: "#fff", maxHeight: "80%" }]}>
            <View style={[styles.attachHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.attachTitle, { color: colors.navy }]}>Templates de Introdução</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {INTRO_TEMPLATES.map((tmpl, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.templateItem, { borderColor: colors.border }]}
                  onPress={() => { setShowTemplates(false); setInput(tmpl); }}
                >
                  <Text style={[styles.templateText, { color: colors.foreground }]}>{tmpl}</Text>
                  <View style={styles.templateActions}>
                    <TouchableOpacity
                      style={[styles.templateBtn, { backgroundColor: colors.gold }]}
                      onPress={() => { setShowTemplates(false); sendMessage(tmpl); }}
                    >
                      <Feather name="send" size={14} color="#fff" />
                      <Text style={styles.templateBtnText}>Enviar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.templateBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                      onPress={() => { setShowTemplates(false); setInput(tmpl); }}
                    >
                      <Feather name="edit-2" size={14} color={colors.navy} />
                      <Text style={[styles.templateBtnText, { color: colors.navy }]}>Editar</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Follow-up scheduler */}
      <Modal visible={showFollowUp} transparent animationType="slide" onRequestClose={() => setShowFollowUp(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setShowFollowUp(false)}>
          <View style={[styles.attachSheet, { backgroundColor: "#fff" }]}>
            <View style={[styles.attachHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.attachTitle, { color: colors.navy }]}>Agendar Follow-up</Text>
            <Text style={[{ color: colors.mutedForeground, fontSize: 14, marginBottom: 16 }]}>
              Em quantos dias você quer ser lembrado de retomar esta conversa?
            </Text>
            <View style={styles.followUpRow}>
              {["1", "3", "7", "14"].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.followUpDay,
                    { borderColor: followUpDays === d ? colors.gold : colors.border },
                    followUpDays === d && { backgroundColor: colors.gold + "15" },
                  ]}
                  onPress={() => setFollowUpDays(d)}
                >
                  <Text style={[styles.followUpDayNum, { color: followUpDays === d ? colors.gold : colors.navy }]}>{d}</Text>
                  <Text style={[styles.followUpDayLabel, { color: colors.mutedForeground }]}>
                    {d === "1" ? "dia" : "dias"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.followUpBtn, { backgroundColor: colors.gold }]}
              onPress={scheduleFollowUp}
            >
              <Feather name="bell" size={16} color="#fff" />
              <Text style={styles.followUpBtnText}>Agendar Lembrete</Text>
            </TouchableOpacity>
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
  container:         { flex: 1 },
  header:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft:        { padding: 4 },
  headerCenter:      { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 8 },
  participantName:   { fontSize: 15, fontWeight: "700" },
  participantStatus: { fontSize: 11, color: "#9ca3af" },
  loadingWrap:       { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList:      { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  msgGroup:          { marginBottom: 4 },
  msgGroupMe:        { alignItems: "flex-end" },
  msgGroupOther:     { alignItems: "flex-start" },
  msgRow:            { flexDirection: "row", marginBottom: 2, gap: 6, alignItems: "flex-end" },
  msgRowMe:          { justifyContent: "flex-end" },
  msgRowOther:       { justifyContent: "flex-start" },
  replyBtn:          { padding: 4, opacity: 0.5 },
  bubble:            { maxWidth: "72%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleMedia:       { maxWidth: "72%", borderRadius: 16, overflow: "hidden", padding: 0 },
  bubbleText:        { fontSize: 14, lineHeight: 20 },
  bubbleTime:        { fontSize: 10, alignSelf: "flex-end" },
  mediaImage:        { width: 220, height: 170 },
  videoOverlay:      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  audioRow:          { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  audioBar:          { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  audioFill:         { height: 4, borderRadius: 2 },
  empty:             { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText:         { fontSize: 15, textAlign: "center" },
  uploadingBanner:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8 },
  uploadingText:     { color: "#fff", fontSize: 13, fontWeight: "600" },
  typingBanner:      { paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: 1 },
  typingText:        { fontSize: 12, fontStyle: "italic" },

  // Read receipts
  receiptRow:  { alignSelf: "flex-end", marginBottom: 2, marginRight: 2 },
  receiptText: { fontSize: 11, fontWeight: "700" },

  // Reactions
  reactionsRow:      { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2, marginBottom: 2, paddingHorizontal: 4 },
  reactionBadge:     { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, backgroundColor: "#f3f4f6", borderWidth: 0 },
  reactionEmoji:     { fontSize: 14 },
  reactionCount:     { fontSize: 11, fontWeight: "600", color: "#374151" },

  // Reaction picker
  reactionOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", alignItems: "center" },
  reactionPicker:    { flexDirection: "row", gap: 8, padding: 14, borderRadius: 40, elevation: 10, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
  reactionPickerBtn: { padding: 6 },
  reactionPickerEmoji: { fontSize: 28 },

  // Quote reply
  quotedMsg:       { borderLeftWidth: 3, borderLeftColor: "#c9a84c", paddingLeft: 8, marginBottom: 6, opacity: 0.85 },
  quotedSender:    { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  quotedContent:   { fontSize: 12, color: "#6b7280" },

  // Reply preview in input bar
  replyPreview:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 2, backgroundColor: "#fff" },
  replyPreviewBar:    { width: 3, alignSelf: "stretch", borderRadius: 2 },
  replyPreviewContent: { flex: 1 },
  replyPreviewLabel:  { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  replyPreviewText:   { fontSize: 12 },
  replyPreviewClose:  { padding: 4 },

  // Post share card
  postShareCard:   { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 4 },
  postShareImage:  { width: "100%", height: 120 },
  postShareBody:   { padding: 8 },
  postShareAuthor: { fontSize: 11, marginBottom: 4 },
  postShareContent:{ fontSize: 13, lineHeight: 18 },

  // Wine card
  wineCard:       { borderWidth: 1, borderRadius: 10, overflow: "hidden", padding: 10, gap: 4, marginBottom: 4 },
  wineCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  wineCardIcon:   { fontSize: 18 },
  wineCardBadge:  { fontSize: 11, fontWeight: "700" },
  wineCardImage:  { width: "100%", height: 100, borderRadius: 6, marginBottom: 6 },
  wineCardName:   { fontSize: 15, fontWeight: "700" },
  wineCardDetail: { fontSize: 12 },
  wineCardNotes:  { fontSize: 12, lineHeight: 17, marginTop: 4 },

  // Input
  inputBar:   { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  attachBtn:  { padding: 6 },
  inputWrap:  { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  input:      { fontSize: 14, maxHeight: 100 },
  sendBtn:    { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  micBtn:     { padding: 6 },

  // Attach sheet
  attachOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  attachSheet:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 16 },
  attachHandle:    { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  attachTitle:     { fontSize: 16, fontWeight: "700" },
  attachGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  attachOption:    { alignItems: "center", gap: 8, width: 70 },
  attachIconCircle:{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  attachLabel:     { fontSize: 12, textAlign: "center" },

  // Prospect
  prospectItem:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14 },
  prospectIcon:  { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  prospectTitle: { fontSize: 14, fontWeight: "700" },
  prospectSub:   { fontSize: 12, marginTop: 2 },

  // Wine list
  wineRow:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  wineRowImage:  { width: 48, height: 48, borderRadius: 8 },
  wineRowName:   { fontSize: 14, fontWeight: "700" },
  wineRowSub:    { fontSize: 12, marginTop: 2 },

  // Templates
  templateItem:    { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  templateText:    { fontSize: 14, lineHeight: 20 },
  templateActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  templateBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  templateBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  // Follow-up
  followUpRow:     { flexDirection: "row", gap: 10, marginBottom: 20 },
  followUpDay:     { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  followUpDayNum:  { fontSize: 20, fontWeight: "800" },
  followUpDayLabel:{ fontSize: 11, marginTop: 2 },
  followUpBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  followUpBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Menu
  menuOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 60, paddingRight: 16 },
  menuCard:      { width: 200, borderRadius: 12, overflow: "hidden", elevation: 8, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
  menuItem:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText:  { fontSize: 14, fontWeight: "500" },
  menuDivider:   { height: 1, marginHorizontal: 16 },
});
