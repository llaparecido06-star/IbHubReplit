import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
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
  Linking,
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
import { Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
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
  "Olá! Trabalho com distribuição de vinhos artesanais e acho que seu produto pode ter espaço no meu portifólio.",
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSep(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function ChatScreen() {
  const colors   = useColors();
  const router   = useRouter();
  const { id, companyId } = useLocalSearchParams<{ id: string; companyId?: string }>();
  const { user, activeCompany } = useAuth();
  const insets   = useSafeAreaInsets();

  const [messages,               setMessages]               = useState<AppMessage[]>([]);
  const [input,                  setInput]                  = useState("");
  const [showMenu,               setShowMenu]               = useState(false);
  const [showAttach,             setShowAttach]             = useState(false);
  const [showProspect,           setShowProspect]           = useState(false);
  const [showWines,              setShowWines]              = useState(false);
  const [showTemplates,          setShowTemplates]          = useState(false);
  const [showFollowUp,           setShowFollowUp]           = useState(false);
  const [showReactions,          setShowReactions]          = useState<string | null>(null);
  const [replyTo,                setReplyTo]                = useState<AppMessage | null>(null);
  const [sending,                setSending]                = useState(false);
  const [uploading,              setUploading]              = useState(false);
  const [uploadStatus,           setUploadStatus]           = useState<string | null>(null);
  const [loading,                setLoading]                = useState(true);
  const [isTyping,               setIsTyping]              = useState(false);
  const [isParticipantOnline,    setIsParticipantOnline]    = useState(false);
  const [wines,                  setWines]                  = useState<any[]>([]);
  const [followUpDays,           setFollowUpDays]           = useState("3");
  const [participant,            setParticipant]            = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);
  const [companyInfo,            setCompanyInfo]            = useState<{ id: string; name: string; avatar_url: string | null } | null>(null);
  const [isConversationAccepted, setIsConversationAccepted] = useState(true);
  const [selectedMedia,          setSelectedMedia]          = useState<{ url: string; type: "image" | "video" } | null>(null);

  // Audio recording
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording,     setIsRecording]      = useState(false);
  const isRecordingRef = useRef(false); // ref mirror to avoid race conditions
  const [recordingMs,     setRecordingMs]      = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const listRef            = useRef<FlatList>(null);
  const typingTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelRef         = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seenMsgIds         = useRef<Set<string>>(new Set());

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  // ── Load data ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!id || !user?.id) { setLoading(false); return; }
    const [msgs, part, accepted, cpRes] = await Promise.all([
      API.fetchMessages(id, user.id),
      API.fetchConversationParticipant(id, user.id),
      API.fetchConversationAccepted(id, user.id),
      companyId
        ? supabase.from("company_pages").select("id, name, avatar_url").eq("id", companyId).maybeSingle()
        : Promise.resolve(null),
    ]);
    setMessages(msgs);
    seenMsgIds.current = new Set(msgs.map(m => m.id));
    setParticipant(part);
    setIsConversationAccepted(accepted);
    if (cpRes && (cpRes as any).data) {
      const cp = (cpRes as any).data;
      setCompanyInfo({ id: cp.id, name: cp.name, avatar_url: cp.avatar_url ?? null });
    }
    setLoading(false);
    API.markConversationRead(id, user.id);
  }, [id, user?.id, companyId]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime: messages (INSERT + UPDATE) + participants ───────────────────────

  useEffect(() => {
    if (!id || !user?.id) return;
    if (channelRef.current) return; // prevent double-subscribe in Strict Mode

    const ch = supabase
      .channel(`chat:${id}:${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async (payload) => {
          const raw = payload.new as AppMessage;
          if (seenMsgIds.current.has(raw.id)) return;
          seenMsgIds.current.add(raw.id);
          // Enrich: fetch from_company_page if needed
          let enriched = raw;
          if ((raw as any).from_company_page_id && !raw.from_company_page) {
            const { data: cp } = await supabase
              .from("company_pages").select("id, name, avatar_url")
              .eq("id", (raw as any).from_company_page_id).maybeSingle();
            if (cp) enriched = { ...raw, from_company_page: cp as any };
          }
          setMessages(prev => [...prev, enriched]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
          if (raw.sender_id !== user.id) {
            API.markConversationRead(id, user.id);
          }
        },
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          setMessages(prev => prev.map(m =>
            m.id === updated.id ? { ...m, read_at: updated.read_at, content: updated.content } : m
          ));
        },
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.user_id === user.id && updated.accepted === true) {
            setIsConversationAccepted(true);
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

  // ── Presence: online/typing ──────────────────────────────────────────────────

  useEffect(() => {
    if (!id || !user?.id || Platform.OS === "web") return;
    const presenceChannel = supabase.channel(`presence:${id}`, {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const others = Object.keys(state).filter(k => k !== user.id);
        const anyTyping = others.some(k => (state[k] as any[]).some((s: any) => s.typing));
        setIsTyping(anyTyping);
        setIsParticipantOnline(others.length > 0);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key !== user.id) setIsParticipantOnline(true);
      })
      .on("presence", { event: "leave" }, () => {
        const state = presenceChannel.presenceState();
        const others = Object.keys(state).filter(k => k !== user.id);
        setIsParticipantOnline(others.length > 0);
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
    try { await presenceChannelRef.current.track({ typing: isCurrentlyTyping }); } catch {}
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

  // ── Push token ───────────────────────────────────────────────────────────────

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
        if (tokenData.data) await API.savePushToken(user.id, tokenData.data);
      } catch {}
    })();
  }, [user?.id]);

  // ── Send text ────────────────────────────────────────────────────────────────

  const sendMessage = async (
    overrideText?: string,
    opts?: { reply_to_id?: string; message_type?: string; metadata?: Record<string, any> },
  ) => {
    const text = (overrideText ?? input).trim();
    if (!text || !user?.id || !id || sending) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // All roles (including visualizador) can chat as company
    const effectiveCompany = activeCompany ?? null;

    const currentReplyTo = replyTo;
    setInput("");
    setReplyTo(null);
    broadcastTyping(false);
    setSending(true);

    const tempId = `tmp_${Date.now()}`;
    seenMsgIds.current.add(tempId);
    const tempMsg: AppMessage = {
      id: tempId,
      conversation_id: id,
      sender_id: user.id,
      from_company_page_id: effectiveCompany?.id ?? null,
      from_company_page: effectiveCompany
        ? { id: effectiveCompany.id, name: effectiveCompany.name, avatar_url: effectiveCompany.avatar_url ?? null }
        : null,
      content: text,
      created_at: new Date().toISOString(),
      message_type: (opts?.message_type as any) ?? "text",
      reply_to_id: opts?.reply_to_id ?? currentReplyTo?.id ?? null,
      reply_to: currentReplyTo ? { content: currentReplyTo.content, sender_id: currentReplyTo.sender_id } : null,
      metadata: opts?.metadata ?? null,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    const saved = await API.sendMessage(id, user.id, text, {
      reply_to_id: opts?.reply_to_id ?? currentReplyTo?.id,
      message_type: opts?.message_type,
      metadata: opts?.metadata,
      companyPageId: effectiveCompany?.id,
    });

    if (saved) {
      seenMsgIds.current.add(saved.id);
      // Carry reply_to from tempMsg since API doesn't populate it
      const enrichedSaved = {
        ...saved,
        reply_to: tempMsg.reply_to,
        from_company_page: tempMsg.from_company_page,
      };
      setMessages(prev => prev.map(m => m.id === tempId ? enrichedSaved : m));
    } else {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }

    setSending(false);

    const senderName = activeCompany?.name ?? (user as any)?.full_name ?? "Alguém";
    const pushBody =
      opts?.message_type === "post_share" ? "📎 Compartilhou uma publicação" :
      opts?.message_type === "wine_card"  ? "🍷 Enviou uma ficha de vinho" : text;
    API.dispatchPushToConversation(id, user.id, senderName, pushBody).catch(() => {});
  };

  // ── Reactions ────────────────────────────────────────────────────────────────

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    setShowReactions(null);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const existing = (m.reactions ?? []).find(r => r.emoji === emoji);
      if (existing) {
        if (existing.mine) {
          return { ...m, reactions: (m.reactions ?? []).map(r => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r).filter(r => r.count > 0) };
        } else {
          return { ...m, reactions: (m.reactions ?? []).map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r) };
        }
      }
      return { ...m, reactions: [...(m.reactions ?? []), { emoji, count: 1, mine: true }] };
    }));
    await API.toggleMessageReaction(messageId, user.id, emoji);
  };

  // ── Pick & send media ────────────────────────────────────────────────────────

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
      );
      return result.uri;
    } catch {
      return uri;
    }
  };

  const pickAndSendMedia = async (type: "image" | "video" | "camera") => {
    setShowAttach(false);
    if (!user?.id || !id) return;

    let result: ImagePicker.ImagePickerResult;

    if (type === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permissão necessária", "Permita o acesso à câmera nas configurações.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.7 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permissão necessária", "Permita o acesso à galeria nas configurações.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === "video" ? ["videos"] : ["images", "videos"],
        quality: 0.7,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
    const msgType  = mimeType.startsWith("video") ? "video" : "image";

    const tempId = `tmp_${Date.now()}`;
    seenMsgIds.current.add(tempId);
    const tempMsg: AppMessage = {
      id: tempId,
      conversation_id: id,
      sender_id: user.id,
      content: "",
      created_at: new Date().toISOString(),
      message_type: msgType,
      media_url: asset.uri,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    setUploading(true);
    try {
      if (msgType === "image") {
        setUploadStatus("Comprimindo imagem...");
        const uploadUri = await compressImage(asset.uri);
        setUploadStatus("Enviando imagem...");
        const url = await API.uploadChatMedia(id, uploadUri, mimeType);
        if (!url) {
          Alert.alert("Erro", "Não foi possível enviar a imagem. Tente novamente.");
          setMessages(prev => prev.filter(m => m.id !== tempId));
          return;
        }
        const saved = await API.sendMediaMessage(id, user.id, url, msgType);
        if (saved) {
          seenMsgIds.current.add(saved.id);
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== tempId && m.id !== saved.id);
            return [...filtered, saved];
          });
        }
      } else {
        setUploadStatus("Enviando vídeo...");
        const url = await API.uploadChatMedia(id, asset.uri, mimeType);
        if (!url) {
          Alert.alert("Erro", "Não foi possível enviar o vídeo. Tente novamente.");
          setMessages(prev => prev.filter(m => m.id !== tempId));
          return;
        }
        const saved = await API.sendMediaMessage(id, user.id, url, msgType);
        if (saved) {
          seenMsgIds.current.add(saved.id);
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== tempId && m.id !== saved.id);
            return [...filtered, saved];
          });
        }
      }
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }
  };

  // ── Pick & send file ─────────────────────────────────────────────────────────

  const pickAndSendFile = async () => {
    setShowAttach(false);
    if (!user?.id || !id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      setUploadStatus(`Enviando ${asset.name ?? "arquivo"}...`);
      const fileObj = (asset as any).file as File | undefined;
      const url = await API.uploadChatMedia(id, asset.uri, asset.mimeType ?? "application/octet-stream", fileObj);
      setUploading(false);
      setUploadStatus(null);
      if (!url) { Alert.alert("Erro", "Não foi possível enviar o arquivo."); return; }
      const saved = await API.sendMediaMessage(id, user.id, url, "file", asset.name ?? "arquivo");
      if (saved) {
        seenMsgIds.current.add(saved.id);
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== saved.id);
          return [...filtered, saved];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      }
    } catch (e: any) {
      setUploading(false);
      if (!e?.message?.includes("cancel")) Alert.alert("Erro", "Não foi possível abrir o arquivo.");
    }
  };

  // ── Audio recording ──────────────────────────────────────────────────────────

  const startRecording = async () => {
    if (Platform.OS === "web") { Alert.alert("Áudio", "Gravação de áudio não disponível na versão web."); return; }
    if (isRecordingRef.current) {
      // Already recording — stop and send
      void stopRecording();
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert("Permissão necessária", "Permita o acesso ao microfone nas configurações do dispositivo."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.record();
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingMs(0);
      recordingTimer.current = setInterval(() => setRecordingMs(prev => prev + 1000), 1000);
      if (__DEV__) console.log("[Audio] Recording started.");
    } catch (e: any) {
      console.error("[Audio] startRecording error:", e?.message);
      Alert.alert("Erro", "Não foi possível iniciar a gravação.");
    }
  };

  const stopRecording = async () => {
    // Use ref instead of state to avoid React batching race condition
    if (!isRecordingRef.current || !user?.id || !id) {
      if (__DEV__) console.log("[Audio] stopRecording skipped — not recording or missing context.");
      return;
    }
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setRecordingMs(0);
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});

      // Poll for URI — Android's native layer may need time to finalize the file
      let uri: string | null = null;
      for (let i = 0; i < 10 && !uri; i++) {
        await new Promise(resolve => setTimeout(resolve, 150));
        uri = audioRecorder.uri;
      }
      if (__DEV__) console.log("[Audio] Recording stopped. URI:", uri ?? "null");

      if (!uri) {
        Alert.alert("Áudio vazio", "Nenhum áudio foi gravado. Tente segurar o botão por mais tempo.");
        return;
      }

      setUploading(true);
      setUploadStatus("Enviando áudio...");

      // Determine mime/extension — expo-audio records as m4a on both platforms
      const mimeType = Platform.OS === "android" ? "audio/mp4" : "audio/m4a";
      const url = await API.uploadChatMedia(id, uri, mimeType);

      setUploading(false);
      setUploadStatus(null);

      if (!url) {
        console.error("[Audio] uploadChatMedia returned null");
        Alert.alert("Erro", "Não foi possível enviar o áudio. Verifique sua conexão.");
        return;
      }

      if (__DEV__) console.log("[Audio] Upload OK, sending message...");

      // Direct Supabase insert so we can surface the exact error if it fails
      const audioPayload: any = {
        conversation_id: id,
        sender_id: user.id,
        content: "",
        message_type: "audio",
        media_url: url,
      };
      if (activeCompany?.id) audioPayload.from_company_page_id = activeCompany.id;

      const { data: saved, error: msgError } = await supabase
        .from("messages")
        .insert(audioPayload)
        .select()
        .single();

      if (msgError) {
        const detail = `[${(msgError as any).code ?? "?"}] ${msgError.message}${(msgError as any).details ? " — " + (msgError as any).details : ""}${(msgError as any).hint ? "\nDica: " + (msgError as any).hint : ""}`;
        console.error("[Audio] Supabase insert error:", JSON.stringify(msgError));
        Alert.alert("Erro ao salvar áudio", detail);
      } else if (saved) {
        seenMsgIds.current.add(saved.id);
        setMessages(prev => {
          const filtered = prev.filter((m: any) => m.id !== saved.id);
          return [...filtered, saved as any];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        if (__DEV__) console.log("[Audio] Audio message sent successfully.");
      }
    } catch (e: any) {
      console.error("[Audio] stopRecording error:", e?.message);
      setUploading(false);
      setUploadStatus(null);
      Alert.alert("Erro", "Não foi possível processar o áudio.");
    }
  };

  const cancelRecording = async () => {
    if (!isRecordingRef.current) return;
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setRecordingMs(0);
    try { await audioRecorder.stop(); } catch {}
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (__DEV__) console.log("[Audio] Recording cancelled.");
  };

  // ── Wine card ────────────────────────────────────────────────────────────────

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
      metadata: { wine_id: wine.id, name: wine.name, vintage: wine.vintage, region: wine.region, notes: wine.notes, image_url: wine.image_url },
    });
  };

  // ── Follow-up reminder ───────────────────────────────────────────────────────

  const scheduleFollowUp = async () => {
    setShowFollowUp(false);
    const days = parseInt(followUpDays, 10);
    if (!days || isNaN(days) || days < 1) return;
    const trigger = new Date();
    trigger.setDate(trigger.getDate() + days);
    trigger.setHours(9, 0, 0, 0);
    try {
      const raw = await AsyncStorage.getItem("ibhub_followup_reminders");
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[id] = trigger.toISOString();
      await AsyncStorage.setItem("ibhub_followup_reminders", JSON.stringify(map));
    } catch {}
    if (Platform.OS !== "web") {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Lembrete de Follow-up",
              body: `Hora de retomar a conversa com ${companyInfo?.name ?? participant?.full_name ?? "seu contato"}!`,
              data: { conversationId: id },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
          });
        }
      } catch {}
    }
    Alert.alert(
      "Lembrete agendado ✓",
      `Você será lembrado em ${days} dia${days > 1 ? "s" : ""} de retomar esta conversa.`,
    );
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderReadReceipt = (item: AppMessage) => {
    if (item.sender_id !== user?.id || item.id.startsWith("tmp_")) return null;
    return (
      <View style={st.receiptRow}>
        <Text style={[st.receiptText, { color: item.read_at ? colors.gold : colors.mutedForeground }]}>
          {item.read_at ? "✓✓" : "✓"}
        </Text>
      </View>
    );
  };

  const renderReactions = (item: AppMessage, isMe: boolean) => {
    if (!item.reactions || item.reactions.length === 0) return null;
    return (
      <View style={[st.reactionsRow, isMe ? { justifyContent: "flex-end" } : {}]}>
        {item.reactions.map(r => (
          <TouchableOpacity
            key={r.emoji}
            style={[st.reactionBadge, r.mine && { borderColor: colors.gold, borderWidth: 1.5 }]}
            onPress={() => handleReaction(item.id, r.emoji)}
          >
            <Text style={st.reactionEmoji}>{r.emoji}</Text>
            {r.count > 1 && <Text style={st.reactionCount}>{r.count}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderQuotedMessage = (item: AppMessage, isMe: boolean) => {
    if (!item.reply_to) return null;
    const isReplyFromMe = item.reply_to.sender_id === user?.id;
    return (
      <View style={[st.quotedMsg, { borderLeftColor: isMe ? "rgba(255,255,255,0.5)" : colors.gold }]}>
        <Text style={[st.quotedSender, { color: isMe ? "#ffffff99" : colors.gold }]}>
          {isReplyFromMe ? "Você" : (companyInfo?.name ?? participant?.full_name ?? "Usuário")}
        </Text>
        <Text style={[st.quotedContent, { color: isMe ? "#ffffffcc" : "#6b7280" }]} numberOfLines={2}>
          {item.reply_to.content}
        </Text>
      </View>
    );
  };

  // ── Render message ───────────────────────────────────────────────────────────

  const renderMessage = ({ item, index }: { item: AppMessage; index: number }) => {
    const isMe   = item.sender_id === user?.id;
    const isTemp = item.id.startsWith("tmp_");
    const type   = item.message_type ?? "text";
    const myCompany = item.from_company_page;

    // Date separator
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDateSep = !prevMsg || !isSameDay(prevMsg.created_at, item.created_at);

    // Group avatar: hide avatar if same sender as previous
    const sameSenderAsPrev = prevMsg && prevMsg.sender_id === item.sender_id &&
      isSameDay(prevMsg.created_at, item.created_at) &&
      new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;
    const showAvatar = !isMe && !sameSenderAsPrev;

    return (
      <View>
        {showDateSep && (
          <View style={st.dateSep}>
            <View style={[st.dateSepLine, { backgroundColor: colors.border }]} />
            <Text style={[st.dateSepText, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
              {formatDateSep(item.created_at)}
            </Text>
            <View style={[st.dateSepLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <View style={[st.msgGroup, isMe ? st.msgGroupMe : st.msgGroupOther, sameSenderAsPrev ? { marginTop: 2 } : { marginTop: 8 }]}>
          {isMe && myCompany && !sameSenderAsPrev && (
            <Text style={[st.senderLabel, { color: colors.gold, alignSelf: "flex-end" }]}>{myCompany.name}</Text>
          )}
          <View style={[st.msgRow, isMe ? st.msgRowMe : st.msgRowOther]}>
            {/* Other sender avatar */}
            {!isMe && (
              <View style={{ width: 32, alignSelf: "flex-end" }}>
                {showAvatar ? (
                  <TouchableOpacity onPress={() => {
                    if (item.from_company_page) router.push(`/empresa/${item.from_company_page.id}` as any);
                    else if (participant) router.push(`/profile/${participant.id}` as any);
                  }}>
                    <Avatar
                      uri={item.from_company_page ? item.from_company_page.avatar_url : participant?.avatar_url}
                      name={item.from_company_page ? item.from_company_page.name : (participant?.full_name ?? "?")}
                      size={30}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* My avatar (company only) */}
            {isMe && myCompany && !sameSenderAsPrev && (
              <Avatar uri={myCompany.avatar_url} name={myCompany.name} size={26} style={{ alignSelf: "flex-end", marginRight: 2 }} />
            )}

            {/* Reply button (left of other's bubble) */}
            {!isMe && (
              <TouchableOpacity style={st.replyBtn} onPress={() => setReplyTo(item)}>
                <Feather name="corner-up-left" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            {/* Bubble */}
            <Pressable
              style={[
                st.bubble,
                (type === "image" || type === "video") ? st.bubbleMedia
                  : isMe
                  ? { backgroundColor: colors.navy }
                  : { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1 },
                isTemp && { opacity: 0.65 },
              ]}
              onPress={() => {
                if ((type === "image" || type === "video") && item.media_url) {
                  setSelectedMedia({ url: item.media_url, type });
                }
              }}
              onLongPress={() => {
                if (!isTemp) {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowReactions(item.id);
                }
              }}
              delayLongPress={350}
            >
              {renderQuotedMessage(item, isMe)}

              {type === "post_share" ? (
                renderPostShareBubble(item, isMe)
              ) : type === "wine_card" ? (
                renderWineCardBubble(item, isMe)
              ) : type === "file" ? (
                renderFileBubble(item, isMe)
              ) : (type === "image" || type === "video") && item.media_url ? (
                <View>
                  <Image source={{ uri: item.media_url }} style={st.mediaImage} resizeMode="cover" />
                  {type === "video" && (
                    <View style={st.videoOverlay}>
                      <View style={st.playBtn}>
                        <Feather name="play" size={22} color="#fff" />
                      </View>
                    </View>
                  )}
                  <Text style={[st.bubbleTime, { color: "#ffffffaa", position: "absolute", bottom: 6, right: 10 }]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              ) : type === "audio" ? (
                renderAudioBubble(item, isMe)
              ) : item.content.startsWith("[attachment]:") ? (
                (() => {
                  const rest = item.content.slice("[attachment]:".length).trim();
                  const [url, ...labelParts] = rest.split("|");
                  const label = labelParts.join("|").trim() || "";
                  const imgExts = ["jpg","jpeg","png","gif","webp","svg","avif"];
                  const ext = (url?.split("?")[0].split(".").pop() ?? "").toLowerCase();
                  const isImg = imgExts.includes(ext);
                  return (
                    <View>
                      {isImg ? (
                        <Image
                          source={{ uri: url }}
                          style={[st.mediaImage, { borderRadius: 10 }]}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 4 }}>
                          <Feather name="paperclip" size={16} color={isMe ? "#fff" : colors.mutedForeground} />
                          <Text style={[st.bubbleText, { color: isMe ? "#fff" : colors.foreground, flex: 1 }]} numberOfLines={1}>
                            {label || "Anexo"}
                          </Text>
                        </View>
                      )}
                      {label && isImg && (
                        <Text style={[st.bubbleText, { color: isMe ? "#ffffffcc" : colors.mutedForeground, fontSize: 11, marginTop: 4 }]}>{label}</Text>
                      )}
                      <Text style={[st.bubbleTime, { color: isMe ? "#ffffff66" : colors.mutedForeground }]}>
                        {formatTime(item.created_at)}
                      </Text>
                    </View>
                  );
                })()
              ) : (
                <>
                  <Text style={[st.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>{item.content}</Text>
                  <Text style={[st.bubbleTime, { color: isMe ? "#ffffff66" : colors.mutedForeground }]}>
                    {formatTime(item.created_at)}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Reply button (right of my bubble) */}
            {isMe && !isTemp && (
              <TouchableOpacity style={st.replyBtn} onPress={() => setReplyTo(item)}>
                <Feather name="corner-up-right" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Pending upload indicator under my temp message */}
          {isTemp && isMe && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 2, marginRight: 6 }}>
              <ActivityIndicator size={10} color={colors.gold} />
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{uploadStatus ?? "Enviando..."}</Text>
            </View>
          )}

          {renderReactions(item, isMe)}
          {renderReadReceipt(item)}
        </View>
      </View>
    );
  };

  const renderPostShareBubble = (item: AppMessage, isMe: boolean) => {
    const meta = item.metadata;
    if (!meta) return null;
    return (
      <View style={[st.postShareCard, { backgroundColor: isMe ? "rgba(255,255,255,0.1)" : colors.background, borderColor: isMe ? "rgba(255,255,255,0.2)" : colors.border }]}>
        {meta.image_url && <Image source={{ uri: meta.image_url }} style={st.postShareImage} resizeMode="cover" />}
        <View style={{ padding: 10 }}>
          <Text style={[{ fontSize: 11, marginBottom: 3 }, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>📝 {meta.author_name ?? "Publicação"}</Text>
          <Text style={[{ fontSize: 13, lineHeight: 18 }, { color: isMe ? "#fff" : colors.foreground }]} numberOfLines={3}>{meta.content ?? item.content}</Text>
        </View>
        <Text style={[st.bubbleTime, { color: isMe ? "#ffffff66" : colors.mutedForeground, paddingHorizontal: 10, paddingBottom: 8 }]}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  const renderWineCardBubble = (item: AppMessage, isMe: boolean) => {
    const meta = item.metadata;
    if (!meta) return null;
    return (
      <View style={{ gap: 4, padding: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons name="glass-wine" size={16} color={colors.gold} />
          <Text style={[{ fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }, { color: isMe ? colors.gold : colors.gold }]}>FICHA DE VINHO</Text>
        </View>
        {meta.image_url && <Image source={{ uri: meta.image_url }} style={[st.mediaImage, { borderRadius: 8, height: 100 }]} resizeMode="cover" />}
        <Text style={[{ fontSize: 14, fontWeight: "700" }, { color: isMe ? "#fff" : colors.navy }]}>{meta.name}</Text>
        {(meta.vintage || meta.region) && (
          <Text style={[{ fontSize: 12 }, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
            {[meta.vintage, meta.region].filter(Boolean).join(" · ")}
          </Text>
        )}
        {meta.notes && <Text style={[{ fontSize: 12, lineHeight: 17 }, { color: isMe ? "#ffffffcc" : colors.foreground }]} numberOfLines={2}>{meta.notes}</Text>}
        <Text style={[st.bubbleTime, { color: isMe ? "#ffffff66" : colors.mutedForeground }]}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  const fileNameFromUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    try {
      const path = new URL(url).pathname;
      return decodeURIComponent(path.split("/").pop() ?? "") || "";
    } catch { return ""; }
  };

  const renderFileBubble = (item: AppMessage, isMe: boolean) => (
    <TouchableOpacity
      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 4 }}
      onPress={() => item.media_url && Linking.openURL(item.media_url).catch(() => Alert.alert("Erro", "Não foi possível abrir o arquivo."))}
    >
      <View style={[{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" }, { backgroundColor: isMe ? "rgba(255,255,255,0.15)" : colors.background }]}>
        <Feather name="file-text" size={18} color={isMe ? "#fff" : colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 13, fontWeight: "600" }, { color: isMe ? "#fff" : colors.navy }]} numberOfLines={1}>
          {item.content || fileNameFromUrl(item.media_url) || "Arquivo"}
        </Text>
        <Text style={[{ fontSize: 11 }, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>{formatTime(item.created_at)}</Text>
      </View>
      <Feather name="download" size={16} color={isMe ? "#ffffff88" : colors.mutedForeground} />
    </TouchableOpacity>
  );

  const renderAudioBubble = (item: AppMessage, isMe: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingHorizontal: 4, minWidth: 140 }}>
      <TouchableOpacity
        style={[{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : colors.navy + "15" }]}
        onPress={() => {}}
      >
        <Feather name="play" size={16} color={isMe ? "#fff" : colors.navy} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={[st.audioBar, { backgroundColor: isMe ? "rgba(255,255,255,0.3)" : colors.border }]}>
          <View style={[st.audioFill, { backgroundColor: isMe ? "#fff" : colors.navy, width: "40%" }]} />
        </View>
      </View>
      <Text style={[{ fontSize: 11 }, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>{formatTime(item.created_at)}</Text>
    </View>
  );

  // ── Derived ──────────────────────────────────────────────────────────────────

  const participantName   = companyInfo?.name ?? participant?.full_name ?? "Chat";
  const isCompanyChat     = !!companyInfo;
  // Never fall back to the human participant's photo when it's a company chat
  const participantAvatar = isCompanyChat ? (companyInfo?.avatar_url ?? null) : (participant?.avatar_url ?? null);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[st.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 12, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          style={st.headerCenter}
          onPress={() => {
            if (isCompanyChat && companyInfo) router.push(`/empresa/${companyInfo.id}` as any);
            else if (participant) router.push(`/profile/${participant.id}` as any);
          }}
          activeOpacity={0.7}
        >
          <View style={st.avatarWrap}>
            <Avatar uri={participantAvatar} name={participantName} size={40} />
            {!isCompanyChat && isParticipantOnline && (
              <View style={[st.onlineDot, { backgroundColor: "#22c55e" }]} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.headerName, { color: colors.navy }]} numberOfLines={1}>{participantName}</Text>
            <Text style={[st.headerStatus, {
              color: isTyping ? colors.gold : isParticipantOnline ? "#22c55e" : colors.mutedForeground,
            }]}>
              {isCompanyChat ? "Empresa"
                : isTyping ? "digitando..."
                : isParticipantOnline ? "online"
                : (participant ? "offline" : "Carregando...")}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={st.menuBtn} onPress={() => setShowMenu(true)}>
          <Feather name="more-vertical" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={st.loadingWrap}><ActivityIndicator size="large" color={colors.gold} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[st.messagesList, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={st.empty}>
              <View style={[st.emptyIcon, { backgroundColor: colors.navy + "12" }]}>
                <Feather name="message-circle" size={36} color={colors.navy} />
              </View>
              <Text style={[st.emptyTitle, { color: colors.navy }]}>Nenhuma mensagem ainda</Text>
              <Text style={[st.emptyHint, { color: colors.mutedForeground }]}>Seja o primeiro a dizer olá!</Text>
            </View>
          }
        />
      )}

      {/* Upload progress */}
      {uploading && (
        <View style={[st.uploadBanner, { backgroundColor: colors.navy }]}>
          <View style={st.uploadBannerInner}>
            <ActivityIndicator size="small" color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={[st.uploadText, { color: "#fff", fontWeight: "600" }]}>
                {uploadStatus ?? "Enviando..."}
              </Text>
              <View style={st.uploadProgressTrack}>
                <View style={[st.uploadProgressFill, { backgroundColor: colors.gold }]} />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Typing indicator */}
      {isTyping && (
        <View style={[st.typingBanner, { borderTopColor: colors.border }]}>
          <View style={st.typingDots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[st.typingDot, { backgroundColor: colors.mutedForeground }]} />
            ))}
          </View>
          <Text style={[st.typingText, { color: colors.mutedForeground }]}>{participantName} está digitando</Text>
        </View>
      )}

      {/* Recording overlay */}
      {isRecording && (
        <View style={[st.recordingBanner, { backgroundColor: "#fee2e2", borderTopColor: "#fca5a5" }]}>
          <TouchableOpacity onPress={cancelRecording} style={st.recordingCancel}>
            <Feather name="x" size={18} color="#dc2626" />
          </TouchableOpacity>
          <View style={[st.recordingDot, { backgroundColor: "#dc2626" }]} />
          <Text style={[st.recordingText, { color: "#dc2626", flex: 1 }]}>
            Gravando... {formatDuration(recordingMs)}
          </Text>
          <TouchableOpacity
            onPress={stopRecording}
            style={[st.recordingSend, { backgroundColor: "#dc2626" }]}
          >
            <Feather name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Reply preview */}
      {replyTo && (
        <View style={[st.replyPreview, { backgroundColor: "#fff", borderTopColor: colors.gold }]}>
          <View style={[st.replyBar, { backgroundColor: colors.gold }]} />
          <View style={{ flex: 1 }}>
            <Text style={[st.replyLabel, { color: colors.gold }]}>
              Respondendo a {replyTo.sender_id === user?.id ? "você mesmo" : participantName}
            </Text>
            <Text style={[st.replyText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {replyTo.content || (replyTo.message_type === "image" ? "📷 Foto" : replyTo.message_type === "audio" ? "🎤 Áudio" : "Mensagem")}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      {isConversationAccepted ? (
        <View style={[st.inputBar, { backgroundColor: "#fff", borderTopColor: colors.border, paddingBottom: bottomPad + 10 }]}>
          <TouchableOpacity style={st.inputAction} onPress={() => setShowAttach(true)}>
            <Feather name="paperclip" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={st.inputAction} onPress={() => setShowProspect(true)}>
            <View style={[st.plusBtn, { backgroundColor: colors.gold }]}>
              <Feather name="plus" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={[st.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TextInput
              style={[st.input, { color: colors.foreground }]}
              placeholder="Mensagem..."
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={handleInputChange}
              multiline
              returnKeyType="default"
            />
          </View>
          {input.trim() ? (
            <TouchableOpacity
              style={[st.sendBtn, { backgroundColor: colors.gold }]}
              onPress={() => sendMessage()}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="send" size={17} color="#fff" />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[st.micBtnWrap, isRecording && { backgroundColor: "#fee2e2" }]}
              onPress={startRecording}
            >
              <Feather name="mic" size={22} color={isRecording ? "#dc2626" : colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[st.lockedBar, { backgroundColor: "#fff", borderTopColor: colors.border, paddingBottom: bottomPad + 10 }]}>
          <Feather name="lock" size={15} color={colors.mutedForeground} />
          <Text style={[st.lockedText, { color: colors.mutedForeground }]}>Aguardando aceitação para liberar o chat</Text>
        </View>
      )}

      {/* ── Reaction Picker ──────────────────────────────────────────────────── */}
      <Modal visible={!!showReactions} transparent animationType="fade" onRequestClose={() => setShowReactions(null)}>
        <Pressable style={st.reactionOverlay} onPress={() => setShowReactions(null)}>
          <View style={[st.reactionPicker, { backgroundColor: "#fff" }]}>
            {REACTION_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={st.reactionPickerBtn}
                onPress={() => showReactions && handleReaction(showReactions, emoji)}
              >
                <Text style={st.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Attach bottom sheet ──────────────────────────────────────────────── */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowAttach(false)}>
          <View style={[st.sheet, { backgroundColor: "#fff" }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.navy }]}>Enviar</Text>
            <View style={st.attachGrid}>
              {[
                { icon: "camera" as const,    label: "Câmera",    color: "#8b5cf6", action: () => pickAndSendMedia("camera") },
                { icon: "image" as const,      label: "Galeria",   color: "#3b82f6", action: () => pickAndSendMedia("image") },
                { icon: "film" as const,       label: "Vídeo",     color: "#ef4444", action: () => pickAndSendMedia("video") },
                { icon: "file-text" as const,  label: "Arquivo",   color: "#f59e0b", action: pickAndSendFile },
              ].map(({ icon, label, color, action }) => (
                <TouchableOpacity key={label} style={st.attachOption} onPress={action}>
                  <View style={[st.attachCircle, { backgroundColor: color }]}>
                    <Feather name={icon} size={22} color="#fff" />
                  </View>
                  <Text style={[st.attachLabel, { color: colors.foreground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Prospecting tools ────────────────────────────────────────────────── */}
      <Modal visible={showProspect} transparent animationType="slide" onRequestClose={() => setShowProspect(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowProspect(false)}>
          <View style={[st.sheet, { backgroundColor: "#fff" }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.navy }]}>Ferramentas de Prospecção</Text>
            <View style={{ gap: 10 }}>
              {[
                {
                  icon: <MaterialCommunityIcons name="glass-wine" size={22} color={colors.gold} />,
                  title: "Enviar Ficha de Vinho",
                  sub: "Compartilhe um vinho do seu catálogo",
                  bg: colors.gold + "18",
                  action: loadWines,
                },
                {
                  icon: <Feather name="message-square" size={20} color={colors.navy} />,
                  title: "Template de Introdução",
                  sub: "Mensagens prontas para prospecção",
                  bg: colors.navy + "12",
                  action: () => { setShowProspect(false); setShowTemplates(true); },
                },
                {
                  icon: <Feather name="clock" size={20} color="#10b981" />,
                  title: "Lembrete de Follow-up",
                  sub: "Agende um lembrete para retomar",
                  bg: "#d1fae510",
                  action: () => { setShowProspect(false); setShowFollowUp(true); },
                },
              ].map(item => (
                <TouchableOpacity
                  key={item.title}
                  style={[st.prospectItem, { backgroundColor: item.bg }]}
                  onPress={item.action}
                >
                  <View style={st.prospectIconWrap}>{item.icon}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.prospectTitle, { color: colors.navy }]}>{item.title}</Text>
                    <Text style={[st.prospectSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Wine selector ────────────────────────────────────────────────────── */}
      <Modal visible={showWines} transparent animationType="slide" onRequestClose={() => setShowWines(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowWines(false)}>
          <View style={[st.sheet, { backgroundColor: "#fff", maxHeight: "80%" }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.navy }]}>Selecionar Vinho</Text>
            {wines.length === 0 ? (
              <View style={[st.empty, { paddingTop: 32 }]}>
                <MaterialCommunityIcons name="glass-wine" size={36} color={colors.gold} />
                <Text style={[{ fontSize: 14, color: colors.mutedForeground }]}>Nenhum vinho cadastrado</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {wines.map(wine => (
                  <TouchableOpacity
                    key={wine.id}
                    style={[st.wineRow, { borderBottomColor: colors.border }]}
                    onPress={() => sendWineCard(wine)}
                  >
                    {wine.image_url ? (
                      <Image source={{ uri: wine.image_url }} style={st.wineImg} />
                    ) : (
                      <View style={[st.wineImg, { backgroundColor: colors.gold + "20", alignItems: "center", justifyContent: "center" }]}>
                        <MaterialCommunityIcons name="glass-wine" size={20} color={colors.gold} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 14, fontWeight: "700" }, { color: colors.navy }]}>{wine.name}</Text>
                      {(wine.vintage || wine.region) && (
                        <Text style={[{ fontSize: 12, marginTop: 2 }, { color: colors.mutedForeground }]}>
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

      {/* ── Templates ────────────────────────────────────────────────────────── */}
      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowTemplates(false)}>
          <View style={[st.sheet, { backgroundColor: "#fff", maxHeight: "85%" }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.navy }]}>Templates de Introdução</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {INTRO_TEMPLATES.map((tmpl, i) => (
                <View key={i} style={[st.templateCard, { borderColor: colors.border }]}>
                  <Text style={[st.templateText, { color: colors.foreground }]}>{tmpl}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[st.templateBtn, { backgroundColor: colors.gold }]}
                      onPress={() => { setShowTemplates(false); sendMessage(tmpl); }}
                    >
                      <Feather name="send" size={13} color="#fff" />
                      <Text style={[st.templateBtnText, { color: "#fff" }]}>Enviar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.templateBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                      onPress={() => { setShowTemplates(false); setInput(tmpl); }}
                    >
                      <Feather name="edit-2" size={13} color={colors.navy} />
                      <Text style={[st.templateBtnText, { color: colors.navy }]}>Editar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ── Follow-up ────────────────────────────────────────────────────────── */}
      <Modal visible={showFollowUp} transparent animationType="slide" onRequestClose={() => setShowFollowUp(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowFollowUp(false)}>
          <View style={[st.sheet, { backgroundColor: "#fff" }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.navy }]}>Agendar Follow-up</Text>
            <Text style={[{ fontSize: 14, color: colors.mutedForeground, marginBottom: 16 }]}>
              Em quantos dias você quer ser lembrado?
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              {["1", "3", "7", "14", "30"].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[
                    st.dayBtn,
                    { borderColor: followUpDays === d ? colors.gold : colors.border },
                    followUpDays === d && { backgroundColor: colors.gold + "12" },
                  ]}
                  onPress={() => setFollowUpDays(d)}
                >
                  <Text style={[{ fontSize: 18, fontWeight: "800" }, { color: followUpDays === d ? colors.gold : colors.navy }]}>{d}</Text>
                  <Text style={[{ fontSize: 10, marginTop: 2 }, { color: colors.mutedForeground }]}>{d === "1" ? "dia" : "dias"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[st.followUpBtn, { backgroundColor: colors.gold }]}
              onPress={scheduleFollowUp}
            >
              <Feather name="bell" size={16} color="#fff" />
              <Text style={st.followUpBtnText}>Agendar Lembrete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── ⋮ Menu ───────────────────────────────────────────────────────────── */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={st.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[st.menuCard, { backgroundColor: "#fff" }]}>
            {(participant?.id || companyInfo?.id) && (
              <TouchableOpacity
                style={st.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  if (isCompanyChat && companyInfo) router.push(`/empresa/${companyInfo.id}` as any);
                  else if (participant) router.push(`/profile/${participant.id}` as any);
                }}
              >
                <Feather name={isCompanyChat ? "briefcase" : "user"} size={17} color={colors.navy} />
                <Text style={[st.menuItemText, { color: colors.navy }]}>{isCompanyChat ? "Ver empresa" : "Ver perfil"}</Text>
              </TouchableOpacity>
            )}
            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={st.menuItem} onPress={() => { setShowMenu(false); setShowFollowUp(true); }}>
              <Feather name="clock" size={17} color="#10b981" />
              <Text style={[st.menuItemText, { color: colors.navy }]}>Follow-up</Text>
            </TouchableOpacity>
            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={st.menuItem}
              onPress={() => {
                setShowMenu(false);
                Alert.alert(
                  "Apagar conversa",
                  "Todas as mensagens serão excluídas permanentemente. Tem certeza?",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Apagar",
                      style: "destructive",
                      onPress: async () => {
                        const ok = await API.deleteDirectConversation(id);
                        if (ok) router.back();
                        else Alert.alert("Erro", "Não foi possível apagar a conversa.");
                      },
                    },
                  ],
                );
              }}
            >
              <Feather name="trash-2" size={17} color="#dc2626" />
              <Text style={[st.menuItemText, { color: "#dc2626" }]}>Apagar conversa</Text>
            </TouchableOpacity>
            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={st.menuItem} onPress={() => setShowMenu(false)}>
              <Feather name="flag" size={17} color="#dc2626" />
              <Text style={[st.menuItemText, { color: "#dc2626" }]}>Denunciar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Fullscreen image viewer ───────────────────────────────────────────── */}
      {selectedMedia?.type === "image" && (
        <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => setSelectedMedia(null)}>
          <Pressable
            style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}
            onPress={() => setSelectedMedia(null)}
          >
            <TouchableOpacity
              style={{ position: "absolute", top: topPad + 16, right: 16, zIndex: 10, padding: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20 }}
              onPress={() => setSelectedMedia(null)}
            >
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: selectedMedia.url }}
              style={{ width: "100%", height: "85%" }}
              resizeMode="contain"
            />
          </Pressable>
        </Modal>
      )}

      {/* ── Fullscreen video player ───────────────────────────────────────────── */}
      {selectedMedia?.type === "video" && (
        <VideoPlayerModal url={selectedMedia.url} onClose={() => setSelectedMedia(null)} />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Video player modal (needs its own hook context) ─────────────────────────

function VideoPlayerModal({ url, onClose }: { url: string; onClose: () => void }) {
  const { top } = useSafeAreaInsets();
  const player  = useVideoPlayer(url, (p) => { p.play(); });
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <TouchableOpacity
          style={{ position: "absolute", top: top + 16, right: 16, zIndex: 10, padding: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20 }}
          onPress={onClose}
        >
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" />
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container:    { flex: 1 },

  // Header
  header:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:      { padding: 6 },
  menuBtn:      { padding: 6 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatarWrap:   { position: "relative" },
  onlineDot:    { position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "#fff" },
  headerName:   { fontSize: 15, fontWeight: "700" },
  headerStatus: { fontSize: 11, marginTop: 1 },

  // Messages
  loadingWrap:  { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList: { paddingHorizontal: 12, paddingTop: 12, flexGrow: 1 },
  empty:        { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyIcon:    { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle:   { fontSize: 16, fontWeight: "700" },
  emptyHint:    { fontSize: 13, textAlign: "center" },

  // Date separator
  dateSep:      { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  dateSepLine:  { flex: 1, height: 1 },
  dateSepText:  { fontSize: 11, fontWeight: "600", paddingHorizontal: 6 },

  // Message group
  msgGroup:     { marginBottom: 2 },
  msgGroupMe:   { alignItems: "flex-end" },
  msgGroupOther:{ alignItems: "flex-start" },
  senderLabel:  { fontSize: 10, fontWeight: "700", marginBottom: 2, marginRight: 4, letterSpacing: 0.3 },
  msgRow:       { flexDirection: "row", gap: 4, alignItems: "flex-end", maxWidth: "100%" },
  msgRowMe:     { justifyContent: "flex-end" },
  msgRowOther:  { justifyContent: "flex-start" },
  replyBtn:     { padding: 6, opacity: 0.5 },

  // Bubble
  bubble:       { maxWidth: "72%", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, gap: 3 },
  bubbleMedia:  { maxWidth: "72%", borderRadius: 16, overflow: "hidden", padding: 0 },
  bubbleText:   { fontSize: 14, lineHeight: 20 },
  bubbleTime:   { fontSize: 10, alignSelf: "flex-end" },

  // Media
  mediaImage:   { width: 220, height: 170 },
  videoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)" },
  playBtn:      { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center" },

  // Audio
  audioBar:     { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  audioFill:    { height: 3, borderRadius: 2 },

  // Quote reply in bubble
  quotedMsg:    { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6, opacity: 0.9 },
  quotedSender: { fontSize: 11, fontWeight: "700", marginBottom: 1 },
  quotedContent:{ fontSize: 12 },

  // Reactions
  reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2, paddingHorizontal: 4 },
  reactionBadge:{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, backgroundColor: "#f3f4f6", borderWidth: 0 },
  reactionEmoji:{ fontSize: 14 },
  reactionCount:{ fontSize: 11, fontWeight: "700", color: "#374151" },

  // Read receipt
  receiptRow:   { alignSelf: "flex-end", marginTop: 1, marginRight: 4 },
  receiptText:  { fontSize: 11, fontWeight: "700" },

  // Post share
  postShareCard:{ borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  postShareImage:{ width: "100%", height: 120 },

  // Banners
  uploadBanner:         { paddingHorizontal: 16, paddingVertical: 10 },
  uploadBannerInner:    { flexDirection: "row", alignItems: "center", gap: 12 },
  uploadText:           { color: "#fff", fontSize: 13, marginBottom: 4 },
  uploadProgressTrack:  { height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  uploadProgressFill:   { height: 3, borderRadius: 2, width: "60%" },
  typingBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, backgroundColor: "#fff" },
  typingDots:   { flexDirection: "row", gap: 3 },
  typingDot:    { width: 5, height: 5, borderRadius: 3 },
  typingText:   { fontSize: 12, fontStyle: "italic" },
  recordingBanner: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  recordingDot: { width: 8, height: 8, borderRadius: 4 },
  recordingText:{ fontSize: 14, fontWeight: "600" },
  recordingCancel: { padding: 4 },
  recordingSend: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  // Reply preview bar
  replyPreview: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 2 },
  replyBar:     { width: 3, alignSelf: "stretch", borderRadius: 2 },
  replyLabel:   { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  replyText:    { fontSize: 12 },

  // Input bar
  inputBar:     { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 1 },
  inputAction:  { padding: 6, alignSelf: "flex-end", marginBottom: 2 },
  plusBtn:      { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  inputWrap:    { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 110 },
  input:        { fontSize: 14, lineHeight: 20 },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  micBtnWrap:   { width: 40, height: 40, alignItems: "center", justifyContent: "center", alignSelf: "flex-end", borderRadius: 20 },
  lockedBar:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1 },
  lockedText:   { fontSize: 13 },

  // Reaction picker
  reactionOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  reactionPicker:   { flexDirection: "row", gap: 6, padding: 12, borderRadius: 40, elevation: 12, shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 14 },
  reactionPickerBtn:{ padding: 6 },
  reactionPickerEmoji: { fontSize: 30 },

  // Sheets (bottom modals)
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 16 },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetTitle:   { fontSize: 16, fontWeight: "700" },

  // Attach grid
  attachGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  attachOption: { alignItems: "center", gap: 8, width: 70 },
  attachCircle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  attachLabel:  { fontSize: 12, textAlign: "center", fontWeight: "500" },

  // Prospect
  prospectItem:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14 },
  prospectIconWrap:{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  prospectTitle:   { fontSize: 14, fontWeight: "700" },
  prospectSub:     { fontSize: 12, marginTop: 2 },

  // Wine list
  wineRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  wineImg:  { width: 48, height: 48, borderRadius: 10 },

  // Templates
  templateCard:    { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  templateText:    { fontSize: 14, lineHeight: 20 },
  templateBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  templateBtnText: { fontSize: 13, fontWeight: "600" },

  // Follow-up
  dayBtn:       { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  followUpBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  followUpBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Menu
  menuOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 60, paddingRight: 12 },
  menuCard:     { width: 200, borderRadius: 14, overflow: "hidden", elevation: 10, shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
  menuItem:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText: { fontSize: 14, fontWeight: "500" },
  menuDivider:  { height: 1, marginHorizontal: 0 },
});
