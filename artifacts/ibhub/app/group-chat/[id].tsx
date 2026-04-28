import * as Haptics from "expo-haptics";
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
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
  avatar_url: string | null;
  owner_id: string;
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
  const { user, activeCompany } = useAuth();
  const insets  = useSafeAreaInsets();

  // Visualizador can only read — do not send messages as company
  const effectiveCompanyId = activeCompany && API.canPublishAsCompany(activeCompany.role) ? activeCompany.id : null;

  const [groupInfo, setGroupInfo]       = useState<GroupInfo>({ name: "Grupo", member_count: 0, avatar_url: null, owner_id: "" });
  const [messages, setMessages]         = useState<AppMessage[]>([]);
  const [profiles, setProfiles]         = useState<Map<string, SenderProfile>>(new Map());
  const [companyProfiles, setCompanyProfiles] = useState<Map<string, { id: string; name: string; avatar_url: string | null }>>(new Map());
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [isTyping, setIsTyping]         = useState(false);
  const [typingName, setTypingName]     = useState("");
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [replyTo, setReplyTo]           = useState<AppMessage | null>(null);
  const [menuVisible, setMenuVisible]   = useState(false);
  const [showAttach, setShowAttach]     = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording]   = useState(false);
  const [recordingMs, setRecordingMs]   = useState(0);
  const recordingTimer                  = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const senderIds  = Array.from(new Set(msgs.map(m => m.sender_id)));
    const companyIds = Array.from(new Set(
      msgs.map(m => (m as any).from_company_page_id).filter(Boolean) as string[]
    ));

    const [profilesRes, companiesRes] = await Promise.all([
      senderIds.length > 0
        ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", senderIds)
        : Promise.resolve({ data: [] as any[] }),
      companyIds.length > 0
        ? supabase.from("company_pages").select("id, name, avatar_url").in("id", companyIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    if (profilesRes.data) {
      const map = new Map<string, SenderProfile>();
      for (const p of profilesRes.data as SenderProfile[]) map.set(p.id, p);
      setProfiles(map);
    }
    if (companiesRes.data) {
      const map = new Map<string, { id: string; name: string; avatar_url: string | null }>();
      for (const c of companiesRes.data as any[]) map.set(c.id, { id: c.id, name: c.name, avatar_url: c.avatar_url ?? null });
      setCompanyProfiles(map);
    }
  }, []);

  const load = useCallback(async () => {
    if (!id || !user?.id) { setLoading(false); return; }

    const [convRes, partRes, groupRes, msgs, clearedAt] = await Promise.all([
      supabase.from("conversations").select("id, name").eq("id", id).maybeSingle(),
      supabase.from("conversation_participants").select("user_id").eq("conversation_id", id),
      supabase.from("groups").select("name, avatar_url, owner_id").eq("id", id).maybeSingle(),
      API.fetchMessages(id, user.id),
      API.fetchGroupHistoryClearedAt(id, user.id),
    ]);

    const convName = (convRes.data as any)?.name ?? (groupRes.data as any)?.name ?? "Grupo";
    const memberCount = (partRes.data ?? []).length;
    setGroupInfo({
      name: convName,
      member_count: memberCount,
      avatar_url: (groupRes.data as any)?.avatar_url ?? null,
      owner_id: (groupRes.data as any)?.owner_id ?? "",
    });

    // Filter out messages cleared by this user (server-side, persists across devices)
    const filtered = clearedAt
      ? msgs.filter(m => m.created_at > clearedAt)
      : msgs;

    setMessages(filtered);
    seenMsgIds.current = new Set(filtered.map(m => m.id));
    await loadProfiles(filtered);

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
          setMessages(prev => {
            // Replace any temp message from the same sender with matching type
            const hasDupe = prev.some(m => m.id === raw.id);
            if (hasDupe) return prev;
            return [...prev, raw];
          });
          setProfiles(prev => {
            if (!prev.has(raw.sender_id)) {
              supabase.from("profiles").select("id, full_name, avatar_url").eq("id", raw.sender_id).maybeSingle().then(({ data }) => {
                if (data) setProfiles(p => new Map(p).set(data.id, data as SenderProfile));
              });
            }
            return prev;
          });
          // Load company profile for new message if it was sent as a company
          const newCompanyId = (raw as any).from_company_page_id ?? null;
          if (newCompanyId) {
            setCompanyProfiles(prev => {
              if (!prev.has(newCompanyId)) {
                supabase.from("company_pages").select("id, name, avatar_url").eq("id", newCompanyId).maybeSingle().then(({ data }) => {
                  if (data) setCompanyProfiles(p => new Map(p).set((data as any).id, { id: (data as any).id, name: (data as any).name, avatar_url: (data as any).avatar_url ?? null }));
                });
              }
              return prev;
            });
          }
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
          if (raw.sender_id !== user.id) {
            API.markConversationRead(id, user.id);
          }
        },
      )
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (!deletedId) return;
          seenMsgIds.current.delete(deletedId);
          setMessages(prev => prev.filter(m => m.id !== deletedId));
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

  // ── Send text message ─────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!input.trim() || sending || !user?.id) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = input.trim();
    setInput("");
    setSending(true);
    broadcastTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    await API.sendMessage(id, user.id, text, { reply_to_id: replyTo?.id, companyPageId: effectiveCompanyId });
    setReplyTo(null);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Audio recording ───────────────────────────────────────────────────────

  const startRecording = async () => {
    // On web, fall back to picking an audio file
    if (Platform.OS === "web") {
      if (!user?.id || !id) return;
      try {
        const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        setUploading(true);
        const url = await API.uploadChatMedia(id, asset.uri, asset.mimeType ?? "audio/mpeg");
        setUploading(false);
        if (!url) { Alert.alert("Erro", "Não foi possível enviar o áudio."); return; }
        const saved = await API.sendMediaMessage(id, user.id, url, "audio", "", effectiveCompanyId);
        if (saved) {
          seenMsgIds.current.add(saved.id);
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== saved.id);
            return [...filtered, saved];
          });
        }
      } catch {
        setUploading(false);
        Alert.alert("Erro", "Não foi possível enviar o arquivo de áudio.");
      }
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert("Permissão necessária", "Permita o acesso ao microfone."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.record();
      setIsRecording(true);
      setRecordingMs(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      recordingTimer.current = setInterval(() => setRecordingMs(prev => prev + 1000), 1000);
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a gravação.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !user?.id || !id) return;
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = audioRecorder.uri;
      if (!uri) return;
      setUploading(true);
      const url = await API.uploadChatMedia(id, uri, "audio/m4a");
      setUploading(false);
      if (!url) { Alert.alert("Erro", "Não foi possível enviar o áudio."); return; }
      const saved = await API.sendMediaMessage(id, user.id, url, "audio", "", effectiveCompanyId);
      if (saved) {
        seenMsgIds.current.add(saved.id);
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== saved.id);
          return [...filtered, saved];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      }
    } catch {
      setUploading(false);
      Alert.alert("Erro", "Não foi possível processar o áudio.");
    }
  };

  const cancelRecording = async () => {
    if (!isRecording) return;
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    setIsRecording(false);
    try { await audioRecorder.stop(); } catch {}
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    setRecordingMs(0);
  };

  const formatRecordingTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  // ── Image / video picker ──────────────────────────────────────────────────

  const pickAndSendMedia = async (type: "camera" | "gallery") => {
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
        mediaTypes: ["images", "videos"],
        quality: 0.7,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
    const msgType  = mimeType.startsWith("video") ? "video" : "image";

    // Optimistic temp message
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
      const url = await API.uploadChatMedia(id, asset.uri, mimeType);
      setUploading(false);
      if (!url) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        seenMsgIds.current.delete(tempId);
        Alert.alert("Erro", "Não foi possível enviar a mídia.");
        return;
      }
      const saved = await API.sendMediaMessage(id, user.id, url, msgType, "", effectiveCompanyId);
      if (saved) {
        seenMsgIds.current.add(saved.id);
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId && m.id !== saved.id);
          return [...filtered, saved];
        });
        seenMsgIds.current.delete(tempId);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        seenMsgIds.current.delete(tempId);
      }
    } catch {
      setUploading(false);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      seenMsgIds.current.delete(tempId);
      Alert.alert("Erro", "Não foi possível enviar a mídia.");
    }
  };

  // ── File attachment ───────────────────────────────────────────────────────

  const pickAndSendFile = async () => {
    setShowAttach(false);
    if (!user?.id || !id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const fileObj = (asset as any).file as File | undefined;
      const url = await API.uploadChatMedia(id, asset.uri, asset.mimeType ?? "application/octet-stream", fileObj);
      setUploading(false);
      if (!url) { Alert.alert("Erro", "Não foi possível enviar o arquivo."); return; }
      const saved = await API.sendMediaMessage(id, user.id, url, "file", asset.name ?? "arquivo", effectiveCompanyId);
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

  // ── 3-dot menu actions ────────────────────────────────────────────────────

  const handleLeaveGroup = () => {
    setMenuVisible(false);
    Alert.alert(
      "Sair do grupo",
      `Tem certeza que deseja sair de "${groupInfo.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair", style: "destructive", onPress: async () => {
            if (!user?.id) return;
            const ok = await API.leaveGroup(id, user.id, activeCompany?.id ?? null);
            if (ok) {
              router.replace("/groups" as any);
            } else {
              Alert.alert("Erro", "Não foi possível sair do grupo.");
            }
          },
        },
      ],
    );
  };

  const isGroupOwner = !!user?.id && user.id === groupInfo.owner_id;

  const handleDeleteMessages = () => {
    setMenuVisible(false);
    if (isGroupOwner) {
      Alert.alert(
        "Apagar todas as mensagens",
        "Apagar permanentemente todas as mensagens do grupo para todos os membros? Esta ação não pode ser desfeita.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Apagar tudo", style: "destructive", onPress: async () => {
              const ok = await API.deleteGroupMessages(id);
              if (ok) {
                setMessages([]);
                seenMsgIds.current.clear();
              } else {
                Alert.alert("Erro", "Não foi possível apagar as mensagens.");
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        "Limpar meu histórico",
        "Ocultar o histórico desta conversa para você em todos os seus dispositivos? As mensagens continuarão visíveis para os outros membros.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Limpar", style: "destructive", onPress: async () => {
              if (!user?.id) return;
              const clearedAt = await API.clearGroupHistoryForUser(id, user.id);
              if (clearedAt !== null) {
                setMessages([]);
                seenMsgIds.current.clear();
              } else {
                Alert.alert("Erro", "Não foi possível limpar o histórico.");
              }
            },
          },
        ],
      );
    }
  };

  // ── Reactions ─────────────────────────────────────────────────────────────

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

  // ── Message renderers ─────────────────────────────────────────────────────

  const renderAudioBubble = (item: AppMessage, isMe: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingHorizontal: 4, minWidth: 140 }}>
      <View style={[styles.audioPlayBtn, { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : colors.navy + "15" }]}>
        <Feather name="play" size={16} color={isMe ? "#fff" : colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={[styles.audioBar, { backgroundColor: isMe ? "rgba(255,255,255,0.3)" : colors.border }]}>
          <View style={[styles.audioFill, { backgroundColor: isMe ? "#fff" : colors.navy }]} />
        </View>
      </View>
      <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
        {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </View>
  );

  const renderFileBubble = (item: AppMessage, isMe: boolean) => (
    <TouchableOpacity
      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 4 }}
      onPress={() => item.media_url && Linking.openURL(item.media_url).catch(() => Alert.alert("Erro", "Não foi possível abrir o arquivo."))}
    >
      <View style={[styles.fileIcon, { backgroundColor: isMe ? "rgba(255,255,255,0.15)" : colors.background }]}>
        <Feather name="file-text" size={18} color={isMe ? "#fff" : colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.navy, fontWeight: "600" }]} numberOfLines={1}>
          {item.content || "Arquivo"}
        </Text>
        <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
          {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <Feather name="download" size={16} color={isMe ? "#ffffff88" : colors.mutedForeground} />
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: AppMessage }) => {
    const isMe         = item.sender_id === user?.id;
    const time         = new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const sender       = profiles.get(item.sender_id);
    const fromCompanyId = (item as any).from_company_page_id ?? null;
    const companyProfile = fromCompanyId ? companyProfiles.get(fromCompanyId) : null;
    const displayName  = isMe ? myName : (companyProfile?.name ?? sender?.full_name ?? "Membro");
    const displayAvatar = companyProfile?.avatar_url ?? sender?.avatar_url ?? undefined;
    const isCompanyMsg = !!fromCompanyId;
    const msgReactions = reactionsMap[item.id] ?? {};
    const hasReactions = Object.keys(msgReactions).length > 0;
    const msgType    = item.message_type ?? "text";
    const isTemp     = item.id.startsWith("tmp_");

    return (
      <View style={[styles.msgGroup, isMe ? styles.msgGroupMe : styles.msgGroupOther]}>
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {!isMe && (
            <TouchableOpacity
              onPress={() => { isCompanyMsg && fromCompanyId ? router.push(`/empresa/${fromCompanyId}` as any) : router.push(`/profile/${item.sender_id}` as any); }}
              activeOpacity={0.7}
              style={styles.senderWrap}
            >
              <Avatar name={displayName} uri={displayAvatar} size={28} />
            </TouchableOpacity>
          )}
          <View style={{ maxWidth: "80%", opacity: isTemp ? 0.6 : 1 }}>
            {!isMe && (
              <TouchableOpacity
                onPress={() => { isCompanyMsg && fromCompanyId ? router.push(`/empresa/${fromCompanyId}` as any) : router.push(`/profile/${item.sender_id}` as any); }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[styles.senderName, { color: colors.gold }]}>{displayName}</Text>
                  {isCompanyMsg && (
                    <View style={{ backgroundColor: colors.gold + "22", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, color: colors.gold, fontWeight: "700" }}>EMPRESA</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
            {isMe && isCompanyMsg && (
              <Text style={{ fontSize: 9, color: "#fff8", textAlign: "right", marginBottom: 2 }}>
                enviado como empresa
              </Text>
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

              {msgType === "audio" ? (
                renderAudioBubble(item, isMe)
              ) : msgType === "file" ? (
                renderFileBubble(item, isMe)
              ) : (msgType === "image" || msgType === "video") && item.media_url ? (
                <View>
                  <Image source={{ uri: item.media_url }} style={styles.mediaImage} resizeMode="cover" />
                  <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground, marginTop: 4 }]}>{time}</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>{time}</Text>
                </>
              )}
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
          {groupInfo.avatar_url ? (
            <Image source={{ uri: groupInfo.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <Avatar name={groupInfo.name} size={36} />
          )}
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
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerRight}>
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

      {/* Uploading indicator */}
      {uploading && (
        <View style={[styles.uploadingBar, { backgroundColor: colors.gold + "18" }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={{ fontSize: 13, color: colors.gold, marginLeft: 8 }}>Enviando…</Text>
        </View>
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

      {/* Attach mini-menu */}
      {showAttach && (
        <View style={[styles.attachMenu, { backgroundColor: "#fff", borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.attachOption} onPress={() => pickAndSendMedia("camera")}>
            <View style={[styles.attachIcon, { backgroundColor: colors.navy + "12" }]}>
              <Feather name="camera" size={20} color={colors.navy} />
            </View>
            <Text style={[styles.attachLabel, { color: colors.foreground }]}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={() => pickAndSendMedia("gallery")}>
            <View style={[styles.attachIcon, { backgroundColor: colors.navy + "12" }]}>
              <Feather name="image" size={20} color={colors.navy} />
            </View>
            <Text style={[styles.attachLabel, { color: colors.foreground }]}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={pickAndSendFile}>
            <View style={[styles.attachIcon, { backgroundColor: colors.navy + "12" }]}>
              <Feather name="file" size={20} color={colors.navy} />
            </View>
            <Text style={[styles.attachLabel, { color: colors.foreground }]}>Arquivo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recording bar */}
      {isRecording && (
        <View style={[styles.recordingBar, { backgroundColor: "#fff", borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={cancelRecording} style={styles.recordCancelBtn}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.recordDot} />
              <Text style={{ fontSize: 15, color: colors.navy, fontWeight: "600" }}>
                {formatRecordingTime(recordingMs)}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Gravando áudio…</Text>
          </View>
          <TouchableOpacity onPress={stopRecording} style={[styles.recordStopBtn, { backgroundColor: colors.navy }]}>
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      {!isRecording && (
        <View style={[styles.inputRow, { paddingBottom: bottomPad + 8, backgroundColor: "#fff", borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setShowAttach(v => !v)}
            style={[styles.iconBtn, showAttach && { opacity: 1 }]}
          >
            <Feather name={showAttach ? "x" : "paperclip"} size={20} color={showAttach ? colors.gold : colors.mutedForeground} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            value={input}
            onChangeText={handleInputChange}
            placeholder="Mensagem…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            onSubmitEditing={handleSend}
            returnKeyType="send"
            onFocus={() => setShowAttach(false)}
          />
          {input.trim() ? (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.navy }]}
              onPress={handleSend}
              disabled={sending}
            >
              <Feather name="send" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.navy }]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Feather name="mic" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3-dot menu modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                router.push(`/group-settings/${id}` as any);
              }}
            >
              <Feather name="settings" size={18} color={colors.navy} />
              <Text style={[styles.menuItemText, { color: colors.navy }]}>Configurações</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteMessages}>
              <Feather name="trash-2" size={18} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>
                {isGroupOwner ? "Apagar todas as mensagens" : "Limpar meu histórico"}
              </Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLeaveGroup}>
              <Feather name="log-out" size={18} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Sair do grupo</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft:      { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerRight:     { padding: 4 },
  headerAvatar:    { width: 36, height: 36, borderRadius: 18 },
  groupName:       { fontSize: 15, fontWeight: "700" },
  membersRow:      { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  membersText:     { fontSize: 12 },
  msgGroup:        { marginBottom: 12 },
  msgGroupMe:      { alignItems: "flex-end" },
  msgGroupOther:   { alignItems: "flex-start" },
  msgRow:          { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  msgRowMe:        { justifyContent: "flex-end" },
  msgRowOther:     { justifyContent: "flex-start" },
  senderWrap:      { marginBottom: 2 },
  senderName:      { fontSize: 11, fontWeight: "700", marginBottom: 3, marginLeft: 4 },
  bubble:          { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "100%" },
  bubbleText:      { fontSize: 15, lineHeight: 20 },
  bubbleTime:      { fontSize: 10, marginTop: 4, textAlign: "right" },
  quotedMsg:       { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 8, opacity: 0.9 },
  quotedSender:    { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  quotedText:      { fontSize: 12 },
  replyBtn:        { padding: 6, opacity: 0.6 },
  reactionsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4, marginHorizontal: 36 },
  reactionBadge:   { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, gap: 3 },
  reactionEmoji:   { fontSize: 16 },
  reactionCount:   { fontSize: 12, fontWeight: "700", color: "#555" },
  mediaImage:      { width: 200, height: 150, borderRadius: 10 },
  audioPlayBtn:    { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  audioBar:        { height: 4, borderRadius: 2, overflow: "hidden" },
  audioFill:       { width: "40%", height: "100%" },
  fileIcon:        { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  uploadingBar:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  replyBar:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  replyBarAccent:  { width: 3, height: "100%", borderRadius: 2 },
  attachMenu:      { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 20, borderTopWidth: 1 },
  attachOption:    { alignItems: "center", gap: 6 },
  attachIcon:      { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  attachLabel:     { fontSize: 11, fontWeight: "600" },
  recordingBar:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 14, borderTopWidth: 1, gap: 10 },
  recordCancelBtn: { padding: 8 },
  recordDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#dc2626" },
  recordStopBtn:   { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  inputRow:        { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 1 },
  iconBtn:         { padding: 8, opacity: 0.7 },
  input:           { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 120 },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  menuOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "flex-end", justifyContent: "flex-start" },
  menuCard:        { marginTop: 64, marginRight: 12, borderRadius: 14, borderWidth: 1, overflow: "hidden", minWidth: 220, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  menuItem:        { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  menuItemText:    { fontSize: 15, fontWeight: "600" },
  menuDivider:     { height: 1 },
  reactionOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  reactionPicker:  { flexDirection: "row", borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  reactionOption:  { padding: 6 },
});
