import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useAudioRecorder, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";
import * as DocumentPicker from "expo-document-picker";
// Use the legacy module for `getInfoAsync` — the new (v19) main module
// only exposes the class-based File API and re-exports legacy helpers as
// stubs that throw at runtime.
import { getInfoAsync as fsGetInfoAsync } from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "@/utils/safeNotifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
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
import { AudioBubble } from "@/components/chat/AudioBubble";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import { useUnread } from "@/context/UnreadContext";
import * as API from "@/services/api";
import type { AppMessage, AppConversation } from "@/services/api";
import {
  MAX_CHAT_FILE_SIZE,
  MAX_AUDIO_DURATION_MS,
  formatFileSize,
  resolveChatMime,
} from "@/constants/chatUploads";

const REACTION_EMOJIS = ["🍷", "❤️", "👍", "😂", "🔥", "😮"];

const REPORT_CATEGORIES = [
  "Conteúdo inapropriado",
  "Spam ou publicidade",
  "Assédio ou bullying",
  "Informações falsas",
  "Perfil falso",
  "Outro",
];

const MAX_FILE_SIZE_LABEL = formatFileSize(MAX_CHAT_FILE_SIZE);

function openAppSettings() {
  Linking.openSettings().catch(() => {});
}

function permissionAlert(message: string, t: (k: string) => string) {
  Alert.alert(
    t("chat_screen.permission_title"),
    message,
    [
      { text: t("chat_screen.permission_cancel"), style: "cancel" },
      { text: t("chat_screen.permission_open_settings"), onPress: openAppSettings },
    ],
  );
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSep(dateStr: string, t: (k: string) => string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t("chat_screen.today");
  if (d.toDateString() === yesterday.toDateString()) return t("chat_screen.yesterday");
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
  const { t }    = useTranslation();
  const colors   = useColors();
  const router   = useRouter();
  const { id, companyId } = useLocalSearchParams<{ id: string; companyId?: string }>();
  const { user, activeCompany, session } = useAuth();
  const { refreshUnread } = useUnread();
  const insets   = useSafeAreaInsets();

  const INTRO_TEMPLATES = [
    t("chat_screen.intro_1"),
    t("chat_screen.intro_2"),
    t("chat_screen.intro_3"),
    t("chat_screen.intro_4"),
    t("chat_screen.intro_5"),
  ];

  const [messages,               setMessages]               = useState<AppMessage[]>([]);
  const [input,                  setInput]                  = useState("");
  const [showMenu,               setShowMenu]               = useState(false);
  const [showAttach,             setShowAttach]             = useState(false);
  const [showProspect,           setShowProspect]           = useState(false);
  const [showWines,              setShowWines]              = useState(false);
  const [showTemplates,          setShowTemplates]          = useState(false);
  const [showFollowUp,           setShowFollowUp]           = useState(false);
  const [existingFollowUp,       setExistingFollowUp]       = useState<Date | null>(null);
  const [showReactions,          setShowReactions]          = useState<string | null>(null);
  // ── Action sheet (long-press menu) ──────────────────────────────────────────
  const [msgActionTarget,   setMsgActionTarget]   = useState<AppMessage | null>(null);
  // ── Forward picker ───────────────────────────────────────────────────────────
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardConvos,     setForwardConvos]     = useState<AppConversation[]>([]);
  const [forwardSearch,     setForwardSearch]     = useState("");
  const [forwarding,        setForwarding]        = useState<string | null>(null);
  // ── In-chat search ───────────────────────────────────────────────────────────
  const [showSearch,  setShowSearch]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHitIdx, setSearchHitIdx] = useState(0);
  const [showReport,             setShowReport]             = useState(false);
  const [reportCategory,         setReportCategory]         = useState<string | null>(null);
  const [reportNote,             setReportNote]             = useState("");
  const [reportSending,          setReportSending]          = useState(false);
  const [reportDone,             setReportDone]             = useState(false);
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
  // Slide-up-to-cancel gesture state (WhatsApp-style hold-to-record).
  const slideToCancelRef = useRef(false);
  const [slideToCancel, setSlideToCancel] = useState(false);

  const listRef            = useRef<FlatList>(null);
  const typingTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelRef         = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seenMsgIds         = useRef<Set<string>>(new Set());

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadFollowUp = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("ibhub_followup_reminders");
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      const iso = map[id];
      setExistingFollowUp(iso ? new Date(iso) : null);
    } catch { setExistingFollowUp(null); }
  }, [id]);

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
    API.markConversationRead(id, user.id).then(() => refreshUnread(user.id));
    loadFollowUp();
  }, [id, user?.id, companyId, loadFollowUp, refreshUnread]);

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
            API.markConversationRead(id, user.id).then(() => refreshUnread(user.id));
          }
        },
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          setMessages(prev => prev.map(m =>
            m.id === updated.id
              ? { ...m, read_at: updated.read_at, content: updated.content, deleted_at: updated.deleted_at ?? m.deleted_at }
              : m
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

    const senderName = activeCompany?.name ?? (user as any)?.full_name ?? t("chat_screen.someone_fallback");
    const pushBody =
      opts?.message_type === "post_share" ? t("chat_screen.push_post_share") :
      opts?.message_type === "wine_card"  ? t("chat_screen.push_wine_card") : text;
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
        permissionAlert(t("chat_screen.permission_camera_msg"), t);
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.7 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        permissionAlert(t("chat_screen.permission_gallery_msg"), t);
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

    // Client-side guard: reject anything bigger than the server limit *before*
    // we kick off the upload. Saves bandwidth and gives a clearer error than
    // multer's MulterError: "File too large" at the end.
    const assetSize = (asset as any).fileSize as number | undefined;
    if (typeof assetSize === "number" && assetSize > MAX_CHAT_FILE_SIZE) {
      Alert.alert(
        t("chat_screen.file_too_large_title"),
        t("chat_screen.file_too_large_msg", { type: msgType === "video" ? t("chat_screen.video_label") : t("chat_screen.file_label"), size: formatFileSize(assetSize), limit: MAX_FILE_SIZE_LABEL }),
      );
      return;
    }

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
        setUploadStatus(t("chat_screen.compressing_image"));
        const uploadUri = await compressImage(asset.uri);
        setUploadStatus(t("chat_screen.uploading_image"));
        const url = await API.uploadChatMedia(id, uploadUri, mimeType, null, { accessToken: session?.access_token ?? undefined, userId: user?.id ?? undefined });
        if (!url) {
          Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_image_send"));
          setMessages(prev => prev.filter(m => m.id !== tempId));
          seenMsgIds.current.delete(tempId);
          return;
        }
        const saved = await API.sendMediaMessage(id, user.id, url, msgType, "", null, session?.access_token ?? undefined);
        if (saved) {
          seenMsgIds.current.add(saved.id);
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== tempId && m.id !== saved.id);
            return [...filtered, saved];
          });
        } else {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          seenMsgIds.current.delete(tempId);
          Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_image_send"));
        }
      } else {
        setUploadStatus(t("chat_screen.uploading_video"));
        const url = await API.uploadChatMedia(id, asset.uri, mimeType, null, { accessToken: session?.access_token ?? undefined, userId: user?.id ?? undefined });
        if (!url) {
          Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_video_send"));
          setMessages(prev => prev.filter(m => m.id !== tempId));
          seenMsgIds.current.delete(tempId);
          return;
        }
        const saved = await API.sendMediaMessage(id, user.id, url, msgType, "", null, session?.access_token ?? undefined);
        if (saved) {
          seenMsgIds.current.add(saved.id);
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== tempId && m.id !== saved.id);
            return [...filtered, saved];
          });
        } else {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          seenMsgIds.current.delete(tempId);
          Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_video_send"));
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

    let tempId: string | null = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // Validate size client-side. DocumentPicker exposes `size` (bytes).
      if (typeof asset.size === "number" && asset.size > MAX_CHAT_FILE_SIZE) {
        Alert.alert(
          t("chat_screen.file_too_large_title"),
          t("chat_screen.file_too_large_named", { name: asset.name ?? t("chat_screen.file_label"), size: formatFileSize(asset.size), limit: MAX_FILE_SIZE_LABEL }),
        );
        return;
      }

      // Resolve the mime type — picker may hand us nothing or octet-stream
      // (Drive-shared docs on Android, in particular), so fall back to the
      // file extension before refusing.
      const resolvedMime = resolveChatMime(asset.mimeType, asset.name);
      if (!resolvedMime) {
        Alert.alert(
          t("chat_screen.unsupported_file_title"),
          t("chat_screen.unsupported_file_msg"),
        );
        return;
      }

      // Optimistic bubble — same UX as image/video, so the user immediately
      // sees the file appear in the thread while it uploads.
      tempId = `tmp_${Date.now()}`;
      seenMsgIds.current.add(tempId);
      const tempMsg: AppMessage = {
        id: tempId,
        conversation_id: id,
        sender_id: user.id,
        content: asset.name ?? "arquivo",
        created_at: new Date().toISOString(),
        message_type: "file",
        media_url: asset.uri,
      };
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

      setUploading(true);
      setUploadStatus(t("chat_screen.uploading_file", { name: asset.name ?? t("chat_screen.file_label") }));
      const fileObj = (asset as any).file as File | undefined;
      const url = await API.uploadChatMedia(id, asset.uri, resolvedMime, fileObj, { accessToken: session?.access_token ?? undefined, userId: user?.id ?? undefined });
      setUploading(false);
      setUploadStatus(null);
      if (!url) {
        if (tempId) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          seenMsgIds.current.delete(tempId);
        }
        Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_file_send"));
        return;
      }
      const saved = await API.sendMediaMessage(id, user.id, url, "file", asset.name ?? "arquivo", null, session?.access_token ?? undefined);
      if (saved) {
        seenMsgIds.current.add(saved.id);
        setMessages(prev => {
          const cleaned = tempId
            ? prev.filter(m => m.id !== tempId && m.id !== saved.id)
            : prev.filter(m => m.id !== saved.id);
          return [...cleaned, saved];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      } else {
        if (tempId) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          seenMsgIds.current.delete(tempId);
        }
        Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_file_registered"));
      }
    } catch (e: any) {
      setUploading(false);
      setUploadStatus(null);
      if (tempId) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        seenMsgIds.current.delete(tempId);
      }
      if (!e?.message?.includes("cancel")) Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_file_open"));
    }
  };

  // ── Audio recording ──────────────────────────────────────────────────────────

  const startRecording = async () => {
    if (Platform.OS === "web") { Alert.alert(t("chat_screen.audio_label"), t("chat_screen.audio_web_unavailable")); return; }
    if (isRecordingRef.current) {
      // Already recording — stop and send
      void stopRecording();
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        permissionAlert(t("chat_screen.permission_mic_msg"), t);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.record();
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingMs(0);
      slideToCancelRef.current = false;
      setSlideToCancel(false);
      recordingTimer.current = setInterval(() => {
        setRecordingMs(prev => {
          const next = prev + 1000;
          // Hard cap on duration. Same approach WhatsApp uses: stop and send
          // automatically when the user is about to hit the limit, instead of
          // discarding the audio.
          if (next >= MAX_AUDIO_DURATION_MS && isRecordingRef.current) {
            setTimeout(() => {
              if (!isRecordingRef.current) return;
              Alert.alert(
                t("chat_screen.recording_limit_title"),
                t("chat_screen.recording_limit_msg", { mins: Math.round(MAX_AUDIO_DURATION_MS / 60000) }),
              );
              void stopRecording();
            }, 0);
          }
          return next;
        });
      }, 1000);
      if (__DEV__) console.log("[Audio] Recording started.");
    } catch (e: any) {
      console.error("[Audio] startRecording error:", e?.message);
      Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_recording_start"));
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
    slideToCancelRef.current = false;
    setSlideToCancel(false);
    try {
      await audioRecorder.stop();
      // Restore playback mode: allow silent mode so audio plays even when
      // the device ringer is off (same behaviour as WhatsApp/Telegram).
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

      // Poll for URI AND a non-empty file. Android's MediaRecorder layer can
      // resolve `stop()` and even expose `audioRecorder.uri` before the file
      // on disk is fully flushed — uploading at that moment streams 0 bytes
      // to the server and the resulting message is unplayable. We wait for
      // both the URI to appear AND the file to have non-zero size, with a
      // generous timeout (~6s) for slow devices.
      let uri: string | null = null;
      let fileSize = 0;
      for (let i = 0; i < 40; i++) {
        await new Promise(resolve => setTimeout(resolve, 150));
        uri = audioRecorder.uri;
        if (!uri) continue;
        try {
          const info: any = await fsGetInfoAsync(uri, { size: true } as any);
          if (info?.exists && typeof info.size === "number") {
            fileSize = info.size;
            if (fileSize > 0) break;
          }
        } catch {}
      }
      if (__DEV__) console.log("[Audio] Recording stopped. URI:", uri ?? "null", "size:", fileSize);

      if (!uri || fileSize === 0) {
        Alert.alert(
          t("chat_screen.audio_empty_title"),
          t("chat_screen.audio_empty_msg"),
        );
        return;
      }

      setUploading(true);
      setUploadStatus(t("chat_screen.uploading_audio"));

      // Determine mime/extension — expo-audio records as m4a on both platforms
      const mimeType = Platform.OS === "android" ? "audio/mp4" : "audio/m4a";
      if (__DEV__) console.log(`[Audio] Starting upload — platform: ${Platform.OS}, uri: ${uri}, size: ${fileSize} bytes, mime: ${mimeType}`);

      let url: string | null = null;
      try {
        url = await API.uploadChatMedia(id, uri, mimeType, null, { accessToken: session?.access_token ?? undefined, userId: user?.id ?? undefined });
      } catch (uploadErr: any) {
        console.error("[Audio] uploadChatMedia threw:", uploadErr?.message ?? uploadErr);
      }

      setUploading(false);
      setUploadStatus(null);

      if (!url) {
        console.error(`[Audio] uploadChatMedia returned null — platform: ${Platform.OS}, uri: ${uri}, size: ${fileSize} bytes`);
        Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_audio_send"));
        return;
      }
      if (__DEV__) console.log(`[Audio] Upload OK → ${url}`);

      // Use the shared API endpoint so the server can fan out push
      // notifications and apply the same moderation/auditing logic that
      // image, video and file messages already get.
      const saved = await API.sendMediaMessage(id, user.id, url, "audio", "", activeCompany?.id, session?.access_token ?? undefined);
      if (!saved) {
        console.error("[Audio] sendMediaMessage returned null");
        Alert.alert(t("chat_screen.error_audio_send_title"), t("chat_screen.error_audio_save"));
        return;
      }

      seenMsgIds.current.add(saved.id);
      setMessages(prev => {
        const filtered = prev.filter((m: any) => m.id !== saved.id);
        return [...filtered, saved as any];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      if (__DEV__) console.log("[Audio] Audio message sent successfully.");
    } catch (e: any) {
      console.error("[Audio] stopRecording error:", e?.message);
      setUploading(false);
      setUploadStatus(null);
      Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_audio_process"));
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
    slideToCancelRef.current = false;
    setSlideToCancel(false);
    try { await audioRecorder.stop(); } catch {}
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (__DEV__) console.log("[Audio] Recording cancelled.");
  };

  // ── Hold-to-record gesture (WhatsApp-style) ─────────────────────────────────
  // PanResponder is created once with stable refs to the latest handlers, so
  // we don't recreate it on every render and don't capture stale closures.
  const recordHandlersRef = useRef({
    start: () => {},
    stop: () => {},
    cancel: () => {},
  });
  recordHandlersRef.current.start = () => { void startRecording(); };
  recordHandlersRef.current.stop = () => { void stopRecording(); };
  recordHandlersRef.current.cancel = () => { void cancelRecording(); };

  const recordPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        recordHandlersRef.current.start();
      },
      onPanResponderMove: (_evt, gesture) => {
        // Slide up by ~60px to enter the "release-to-cancel" zone.
        const isCancel = gesture.dy < -60;
        if (isCancel !== slideToCancelRef.current) {
          slideToCancelRef.current = isCancel;
          setSlideToCancel(isCancel);
        }
      },
      onPanResponderRelease: () => {
        if (slideToCancelRef.current) {
          recordHandlersRef.current.cancel();
        } else {
          recordHandlersRef.current.stop();
        }
      },
      onPanResponderTerminate: () => {
        // Gesture was forcibly stolen (e.g. system modal). Treat as cancel
        // to avoid sending an audio the user didn't intend to send.
        recordHandlersRef.current.cancel();
      },
    }),
  ).current;

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
      setExistingFollowUp(trigger);
    } catch {}
    if (Platform.OS !== "web") {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: t("chat_screen.followup_notif_title"),
              body: t("chat_screen.followup_notif_body", { name: companyInfo?.name ?? participant?.full_name ?? t("chat_screen.your_contact") }),
              data: { conversationId: id },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
          });
        }
      } catch {}
    }
    Alert.alert(
      t("chat_screen.followup_scheduled_title"),
      t("chat_screen.followup_scheduled_msg", { days }),
    );
  };

  const cancelFollowUp = async () => {
    try {
      const raw = await AsyncStorage.getItem("ibhub_followup_reminders");
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      delete map[id];
      await AsyncStorage.setItem("ibhub_followup_reminders", JSON.stringify(map));
      setExistingFollowUp(null);
    } catch {}
    setShowFollowUp(false);
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
          {isReplyFromMe ? t("chat_screen.you") : (companyInfo?.name ?? participant?.full_name ?? t("chat_screen.user_fallback"))}
        </Text>
        <Text style={[st.quotedContent, { color: isMe ? "#ffffffcc" : "#6b7280" }]} numberOfLines={2}>
          {item.reply_to.content}
        </Text>
      </View>
    );
  };

  // ── Render message ───────────────────────────────────────────────────────────

  // ── Search hits (for in-chat search) ─────────────────────────────────────────
  const searchHits = useMemo(() => {
    if (!showSearch || !searchQuery.trim()) return [] as { msg: AppMessage; idx: number }[];
    const q = searchQuery.toLowerCase();
    return messages
      .map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => !msg.deleted_at && msg.content?.toLowerCase().includes(q));
  }, [messages, searchQuery, showSearch]);

  useEffect(() => { setSearchHitIdx(0); }, [searchQuery]);

  const navigateSearch = (dir: 1 | -1) => {
    if (!searchHits.length) return;
    const next = (searchHitIdx + dir + searchHits.length) % searchHits.length;
    setSearchHitIdx(next);
    try { listRef.current?.scrollToIndex({ index: searchHits[next].idx, animated: true, viewPosition: 0.5 }); } catch {}
  };

  const handleDeleteMessage = async (target: AppMessage, forEveryone: boolean) => {
    if (!user?.id) return;
    if (forEveryone) {
      const ok = await API.deleteMessage(target.id, user.id);
      if (ok) {
        setMessages(prev => prev.map(m => m.id === target.id ? { ...m, deleted_at: new Date().toISOString() } : m));
      }
    } else {
      setMessages(prev => prev.filter(m => m.id !== target.id));
    }
  };

  const openForwardPicker = async () => {
    if (!user?.id) return;
    setShowForwardPicker(true);
    const convos = await API.fetchConversations(user.id, activeCompany?.id ?? null);
    setForwardConvos(convos.filter(c => c.id !== id));
  };

  const handleForwardMessage = async (targetConvId: string) => {
    if (!msgActionTarget || !user?.id) return;
    setForwarding(targetConvId);
    await API.forwardMessage(msgActionTarget, targetConvId, user.id, {
      companyPageId: activeCompany?.id ?? null,
      accessToken: session?.access_token ?? undefined,
    });
    setForwarding(null);
    setShowForwardPicker(false);
    setMsgActionTarget(null);
  };

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

    // Deleted message — render placeholder, skip full bubble
    if (item.deleted_at) {
      return (
        <View>
          {showDateSep && (
            <View style={st.dateSep}>
              <View style={[st.dateSepLine, { backgroundColor: colors.border }]} />
              <Text style={[st.dateSepText, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
                {formatDateSep(item.created_at, t)}
              </Text>
              <View style={[st.dateSepLine, { backgroundColor: colors.border }]} />
            </View>
          )}
          <View style={[st.msgGroup, isMe ? st.msgGroupMe : st.msgGroupOther, { marginTop: 4 }]}>
            <View style={[st.msgRow, isMe ? st.msgRowMe : st.msgRowOther]}>
              {!isMe && <View style={{ width: 32 }} />}
              <View style={[st.bubble, { backgroundColor: isMe ? colors.navy + "88" : "#f3f4f6", borderColor: colors.border, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <Feather name="slash" size={12} color={isMe ? "#ffffff66" : colors.mutedForeground} />
                <Text style={{ fontSize: 13, fontStyle: "italic", color: isMe ? "#ffffff88" : colors.mutedForeground }}>
                  Esta mensagem foi apagada
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View>
        {showDateSep && (
          <View style={st.dateSep}>
            <View style={[st.dateSepLine, { backgroundColor: colors.border }]} />
            <Text style={[st.dateSepText, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
              {formatDateSep(item.created_at, t)}
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
                  setMsgActionTarget(item);
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
                            {label || t("chat_screen.attachment_label")}
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
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{uploadStatus ?? t("chat_screen.uploading")}</Text>
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
          <Text style={[{ fontSize: 11, marginBottom: 3 }, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>📝 {meta.author_name ?? t("chat_screen.post_label")}</Text>
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
          <Text style={[{ fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }, { color: isMe ? colors.gold : colors.gold }]}>{t("chat_screen.wine_card_label")}</Text>
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
      onPress={() => item.media_url && Linking.openURL(item.media_url).catch(() => Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_file_open")))}
    >
      <View style={[{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" }, { backgroundColor: isMe ? "rgba(255,255,255,0.15)" : colors.background }]}>
        <Feather name="file-text" size={18} color={isMe ? "#fff" : colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 13, fontWeight: "600" }, { color: isMe ? "#fff" : colors.navy }]} numberOfLines={1}>
          {item.content || fileNameFromUrl(item.media_url) || t("chat_screen.file_label")}
        </Text>
        <Text style={[{ fontSize: 11 }, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>{formatTime(item.created_at)}</Text>
      </View>
      <Feather name="download" size={16} color={isMe ? "#ffffff88" : colors.mutedForeground} />
    </TouchableOpacity>
  );

  const renderAudioBubble = (item: AppMessage, isMe: boolean) => {
    if (!item.media_url) {
      return (
        <Text style={[st.bubbleText, { color: isMe ? "#fff" : colors.foreground, fontStyle: "italic", opacity: 0.7 }]}>
          🎤 {t("chat_screen.audio_unavailable")}
        </Text>
      );
    }
    return (
      <AudioBubble
        uri={item.media_url}
        isMe={isMe}
        timeLabel={formatTime(item.created_at)}
      />
    );
  };

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
              {isCompanyChat ? t("chat_screen.company_label")
                : isTyping ? t("chat_screen.typing")
                : isParticipantOnline ? t("chat_screen.online")
                : (participant ? t("chat_screen.offline") : t("chat_screen.loading"))}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={st.menuBtn} onPress={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(""); }}>
          <Feather name="search" size={20} color={showSearch ? colors.gold : colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={st.menuBtn} onPress={() => setShowMenu(true)}>
          <Feather name="more-vertical" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={[st.searchBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            style={[st.searchInput, { color: colors.foreground }]}
            placeholder="Buscar mensagens..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={q => setSearchQuery(q)}
          />
          {searchHits.length > 0 && (
            <>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, minWidth: 36, textAlign: "center" }}>
                {searchHitIdx + 1}/{searchHits.length}
              </Text>
              <TouchableOpacity onPress={() => navigateSearch(-1)} style={{ padding: 4 }}>
                <Feather name="chevron-up" size={18} color={colors.navy} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigateSearch(1)} style={{ padding: 4 }}>
                <Feather name="chevron-down" size={18} color={colors.navy} />
              </TouchableOpacity>
            </>
          )}
          {searchQuery.length > 0 && searchHits.length === 0 && (
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Sem resultado</Text>
          )}
          <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(""); }} style={{ padding: 4 }}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

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
              <Text style={[st.emptyTitle, { color: colors.navy }]}>{t("chat_screen.empty_title")}</Text>
              <Text style={[st.emptyHint, { color: colors.mutedForeground }]}>{t("chat_screen.empty_hint")}</Text>
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
                {uploadStatus ?? t("chat_screen.uploading")}
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
          <Text style={[st.typingText, { color: colors.mutedForeground }]}>{t("chat_screen.typing_indicator", { name: participantName })}</Text>
        </View>
      )}

      {/* Recording overlay */}
      {isRecording && (
        <View style={[st.recordingBanner, { backgroundColor: "#fee2e2", borderTopColor: "#fca5a5" }]}>
          <TouchableOpacity onPress={cancelRecording} style={st.recordingCancel}>
            <Feather name="x" size={18} color="#dc2626" />
          </TouchableOpacity>
          <View style={[st.recordingDot, { backgroundColor: "#dc2626" }]} />
          <View style={{ flex: 1 }}>
            <Text style={[st.recordingText, { color: "#dc2626" }]}>
              {t("chat_screen.recording")} {formatDuration(recordingMs)}
            </Text>
            <Text style={{ color: slideToCancel ? "#dc2626" : "#9b1c1c", fontSize: 11, marginTop: 2, fontWeight: slideToCancel ? "700" : "400" }}>
              {slideToCancel ? t("chat_screen.release_to_cancel") : t("chat_screen.slide_to_cancel")}
            </Text>
          </View>
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
              {t("chat_screen.replying_to", { name: replyTo.sender_id === user?.id ? t("chat_screen.yourself") : participantName })}
            </Text>
            <Text style={[st.replyText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {replyTo.content || (replyTo.message_type === "image" ? t("chat_screen.photo_label") : replyTo.message_type === "audio" ? t("chat_screen.audio_label_short") : t("chat_screen.message_label"))}
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
              placeholder={t("chat_screen.input_placeholder")}
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
            <View
              style={[
                st.micBtnWrap,
                isRecording && { backgroundColor: slideToCancel ? "#fecaca" : "#fee2e2" },
              ]}
              {...recordPanResponder.panHandlers}
            >
              <Feather name="mic" size={22} color={isRecording ? "#dc2626" : colors.mutedForeground} />
            </View>
          )}
        </View>
      ) : (
        <View style={[st.lockedBar, { backgroundColor: "#fff", borderTopColor: colors.border, paddingBottom: bottomPad + 10 }]}>
          <Feather name="lock" size={15} color={colors.mutedForeground} />
          <Text style={[st.lockedText, { color: colors.mutedForeground }]}>{t("chat_screen.locked_chat")}</Text>
        </View>
      )}

      {/* ── Message Action Sheet (long-press) ───────────────────────────────── */}
      <Modal visible={!!msgActionTarget} transparent animationType="slide" onRequestClose={() => setMsgActionTarget(null)}>
        <Pressable style={st.sheetOverlay} onPress={() => setMsgActionTarget(null)}>
          <View style={[st.sheet, { backgroundColor: "#fff", paddingBottom: bottomPad + 8 }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />

            {/* Reaction row */}
            <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 14, paddingHorizontal: 4 }}>
              {REACTION_EMOJIS.map(emoji => {
                const active = msgActionTarget?.reactions?.find(r => r.emoji === emoji && r.mine);
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[{ padding: 8, borderRadius: 20 }, active && { backgroundColor: colors.gold + "22" }]}
                    onPress={() => {
                      const target = msgActionTarget!;
                      setMsgActionTarget(null);
                      handleReaction(target.id, emoji);
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />

            {/* Reply */}
            <TouchableOpacity style={st.actionRow} onPress={() => { setReplyTo(msgActionTarget!); setMsgActionTarget(null); }}>
              <Feather name="corner-up-left" size={17} color={colors.navy} />
              <Text style={[st.actionRowText, { color: colors.navy }]}>Responder</Text>
            </TouchableOpacity>

            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />

            {/* Forward */}
            <TouchableOpacity style={st.actionRow} onPress={() => { openForwardPicker(); setMsgActionTarget(prev => prev); }}>
              <Feather name="share-2" size={17} color={colors.navy} />
              <Text style={[st.actionRowText, { color: colors.navy }]}>Encaminhar</Text>
            </TouchableOpacity>

            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />

            {/* Delete */}
            <TouchableOpacity
              style={st.actionRow}
              onPress={() => {
                const target = msgActionTarget!;
                const isOwn = target.sender_id === user?.id;
                setMsgActionTarget(null);
                Alert.alert(
                  "Apagar mensagem",
                  isOwn
                    ? "Como deseja apagar esta mensagem?"
                    : "Apagar esta mensagem para você?",
                  isOwn ? [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Apagar para mim", onPress: () => handleDeleteMessage(target, false) },
                    { text: "Apagar para todos", style: "destructive", onPress: () => handleDeleteMessage(target, true) },
                  ] : [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Apagar para mim", style: "destructive", onPress: () => handleDeleteMessage(target, false) },
                  ],
                );
              }}
            >
              <Feather name="trash-2" size={17} color="#dc2626" />
              <Text style={[st.actionRowText, { color: "#dc2626" }]}>Apagar mensagem</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Forward Picker ───────────────────────────────────────────────────── */}
      <Modal visible={showForwardPicker} transparent animationType="slide" onRequestClose={() => { setShowForwardPicker(false); setForwardSearch(""); }}>
        <Pressable style={st.sheetOverlay} onPress={() => { setShowForwardPicker(false); setForwardSearch(""); }}>
          <View style={[st.sheet, { backgroundColor: "#fff", maxHeight: "78%", paddingBottom: bottomPad + 8 }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.navy }]}>Encaminhar para</Text>
            <View style={[st.forwardSearchWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[st.forwardSearchInput, { color: colors.foreground }]}
                placeholder="Buscar conversa..."
                placeholderTextColor={colors.mutedForeground}
                value={forwardSearch}
                onChangeText={setForwardSearch}
              />
            </View>
            <FlatList
              data={forwardConvos.filter(c => {
                const name = c.is_group ? c.name : (c.participant?.full_name ?? c.participant_company?.name ?? "");
                return !forwardSearch || name?.toLowerCase().includes(forwardSearch.toLowerCase());
              })}
              keyExtractor={c => c.id}
              renderItem={({ item: conv }) => {
                const name = conv.is_group
                  ? (conv.name ?? "Grupo")
                  : (conv.participant?.full_name ?? conv.participant_company?.name ?? "Chat");
                const avatarUri = conv.is_group
                  ? (conv as any).group_avatar_url
                  : (conv.participant?.avatar_url ?? conv.participant_company?.avatar_url);
                return (
                  <TouchableOpacity
                    style={[st.forwardRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleForwardMessage(conv.id)}
                    disabled={!!forwarding}
                  >
                    <Avatar uri={avatarUri ?? null} name={name} size={40} />
                    <Text style={[st.forwardName, { color: colors.navy, flex: 1 }]} numberOfLines={1}>{name}</Text>
                    {forwarding === conv.id
                      ? <ActivityIndicator size="small" color={colors.gold} />
                      : <Feather name="send" size={17} color={colors.gold} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24, fontSize: 14 }}>
                  {forwardConvos.length === 0 ? "Carregando..." : "Nenhuma conversa encontrada"}
                </Text>
              }
            />
          </View>
        </Pressable>
      </Modal>

      {/* ── Attach bottom sheet ──────────────────────────────────────────────── */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowAttach(false)}>
          <View style={[st.sheet, { backgroundColor: "#fff" }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[st.sheetTitle, { color: colors.navy }]}>{t("chat_screen.send_title")}</Text>
            <View style={st.attachGrid}>
              {[
                { icon: "camera" as const,    label: t("chat_screen.attach_camera"),    color: "#8b5cf6", action: () => pickAndSendMedia("camera") },
                { icon: "image" as const,      label: t("chat_screen.attach_gallery"),   color: "#3b82f6", action: () => pickAndSendMedia("image") },
                { icon: "film" as const,       label: t("chat_screen.attach_video"),     color: "#ef4444", action: () => pickAndSendMedia("video") },
                { icon: "file-text" as const,  label: t("chat_screen.attach_file"),      color: "#f59e0b", action: pickAndSendFile },
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
            <Text style={[st.sheetTitle, { color: colors.navy }]}>{t("chat_screen.prospect_title")}</Text>
            <View style={{ gap: 10 }}>
              {[
                {
                  icon: <MaterialCommunityIcons name="glass-wine" size={22} color={colors.gold} />,
                  title: t("chat_screen.prospect_wine_title"),
                  sub: t("chat_screen.prospect_wine_sub"),
                  bg: colors.gold + "18",
                  action: loadWines,
                },
                {
                  icon: <Feather name="message-square" size={20} color={colors.navy} />,
                  title: t("chat_screen.prospect_template_title"),
                  sub: t("chat_screen.prospect_template_sub"),
                  bg: colors.navy + "12",
                  action: () => { setShowProspect(false); setShowTemplates(true); },
                },
                {
                  icon: <Feather name="clock" size={20} color="#10b981" />,
                  title: t("chat_screen.prospect_followup_title"),
                  sub: t("chat_screen.prospect_followup_sub"),
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
            <Text style={[st.sheetTitle, { color: colors.navy }]}>{t("chat_screen.select_wine_title")}</Text>
            {wines.length === 0 ? (
              <View style={[st.empty, { paddingTop: 32 }]}>
                <MaterialCommunityIcons name="glass-wine" size={36} color={colors.gold} />
                <Text style={[{ fontSize: 14, color: colors.mutedForeground }]}>{t("chat_screen.no_wines")}</Text>
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
            <Text style={[st.sheetTitle, { color: colors.navy }]}>{t("chat_screen.intro_templates_title")}</Text>
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
                      <Text style={[st.templateBtnText, { color: "#fff" }]}>{t("chat_screen.send_btn")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.templateBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                      onPress={() => { setShowTemplates(false); setInput(tmpl); }}
                    >
                      <Feather name="edit-2" size={13} color={colors.navy} />
                      <Text style={[st.templateBtnText, { color: colors.navy }]}>{t("chat_screen.edit_btn")}</Text>
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
            <Text style={[st.sheetTitle, { color: colors.navy }]}>{t("chat_screen.schedule_followup_title")}</Text>
            {existingFollowUp && (
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.gold + "18", borderRadius: 10, padding: 10, marginBottom: 12, gap: 8 }}>
                <Feather name="clock" size={14} color={existingFollowUp <= new Date() ? "#ef4444" : colors.gold} />
                <Text style={{ fontSize: 13, color: colors.navy, flex: 1 }}>
                  {existingFollowUp <= new Date()
                    ? t("chat_screen.followup_expired", { date: existingFollowUp.toLocaleDateString("pt-BR") })
                    : t("chat_screen.followup_set", { date: existingFollowUp.toLocaleDateString("pt-BR") })}
                </Text>
                <TouchableOpacity onPress={cancelFollowUp}>
                  <Feather name="x" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
            <Text style={[{ fontSize: 14, color: colors.mutedForeground, marginBottom: 16 }]}>
              {existingFollowUp ? t("chat_screen.followup_reschedule_hint") : t("chat_screen.followup_hint")}
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
                  <Text style={[{ fontSize: 10, marginTop: 2 }, { color: colors.mutedForeground }]}>{d === "1" ? t("chat_screen.day_singular") : t("chat_screen.day_plural")}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[st.followUpBtn, { backgroundColor: colors.gold }]}
              onPress={scheduleFollowUp}
            >
              <Feather name="bell" size={16} color="#fff" />
              <Text style={st.followUpBtnText}>{existingFollowUp ? t("chat_screen.reschedule_btn") : t("chat_screen.schedule_btn")}</Text>
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
                <Text style={[st.menuItemText, { color: colors.navy }]}>{isCompanyChat ? t("chat_screen.view_company") : t("chat_screen.view_profile")}</Text>
              </TouchableOpacity>
            )}
            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={st.menuItem} onPress={() => { setShowMenu(false); setShowFollowUp(true); }}>
              <Feather name="clock" size={17} color="#10b981" />
              <Text style={[st.menuItemText, { color: colors.navy }]}>{t("chat_screen.followup_menu")}</Text>
            </TouchableOpacity>
            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={st.menuItem}
              onPress={() => {
                setShowMenu(false);
                Alert.alert(
                  t("chat_screen.delete_conv_title"),
                  t("chat_screen.delete_conv_confirm"),
                  [
                    { text: t("chat_screen.cancel"), style: "cancel" },
                    {
                      text: t("chat_screen.delete_btn"),
                      style: "destructive",
                      onPress: async () => {
                        const ok = await API.deleteDirectConversation(id);
                        if (ok) router.back();
                        else Alert.alert(t("chat_screen.error_title"), t("chat_screen.error_delete_conv"));
                      },
                    },
                  ],
                );
              }}
            >
              <Feather name="trash-2" size={17} color="#dc2626" />
              <Text style={[st.menuItemText, { color: "#dc2626" }]}>{t("chat_screen.delete_conv_title")}</Text>
            </TouchableOpacity>
            <View style={[st.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={st.menuItem}
              onPress={() => {
                setShowMenu(false);
                setReportDone(false);
                setReportCategory(null);
                setReportNote("");
                setShowReport(true);
              }}
            >
              <Feather name="flag" size={17} color="#dc2626" />
              <Text style={[st.menuItemText, { color: "#dc2626" }]}>{t("chat_screen.report")}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Report modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowReport(false)}>
          <View style={[st.sheet, { backgroundColor: "#fff", maxHeight: "90%" }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            {reportDone ? (
              <View style={{ alignItems: "center", paddingVertical: 20, gap: 14 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#d1fae5", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="check" size={30} color="#10b981" />
                </View>
                <Text style={[st.sheetTitle, { color: colors.navy, textAlign: "center" }]}>Denúncia enviada</Text>
                <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 21 }}>
                  Sua denúncia foi recebida e será analisada pela nossa equipe. Obrigado por contribuir com a segurança da comunidade.
                </Text>
                <TouchableOpacity
                  style={{ paddingVertical: 13, paddingHorizontal: 36, borderRadius: 12, backgroundColor: colors.navy, marginTop: 4 }}
                  onPress={() => setShowReport(false)}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Fechar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[st.sheetTitle, { color: colors.navy }]}>Denunciar conversa</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: -8 }}>Selecione o motivo da denúncia:</Text>
                <View style={{ gap: 8 }}>
                  {REPORT_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 12, borderWidth: 1.5 },
                        { borderColor: reportCategory === cat ? colors.navy : colors.border },
                        reportCategory === cat && { backgroundColor: colors.navy + "08" },
                      ]}
                      onPress={() => setReportCategory(cat)}
                    >
                      <View style={[{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" }, { borderColor: reportCategory === cat ? colors.navy : colors.border }]}>
                        {reportCategory === cat && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.navy }} />}
                      </View>
                      <Text style={{ fontSize: 14, color: colors.navy, fontWeight: reportCategory === cat ? "600" : "400" }}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[{ borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 72, textAlignVertical: "top" }, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  placeholder="Descrição adicional (opcional)"
                  placeholderTextColor={colors.mutedForeground}
                  value={reportNote}
                  onChangeText={setReportNote}
                  multiline
                />
                <TouchableOpacity
                  style={[{ paddingVertical: 14, borderRadius: 14, alignItems: "center" }, { backgroundColor: reportCategory ? "#dc2626" : colors.border }]}
                  onPress={async () => {
                    if (!reportCategory || !user?.id) return;
                    setReportSending(true);
                    try {
                      await supabase.from("reports").insert({
                        reporter_id: user.id,
                        reported_user_id: participant?.id ?? null,
                        conversation_id: id,
                        category: reportCategory,
                        note: reportNote.trim() || null,
                      });
                    } catch {}
                    setReportSending(false);
                    setReportDone(true);
                  }}
                  disabled={!reportCategory || reportSending}
                >
                  {reportSending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Enviar denúncia</Text>}
                </TouchableOpacity>
              </>
            )}
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

  // Search bar
  searchBar:          { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput:        { flex: 1, fontSize: 14 },

  // Action sheet rows
  actionRow:          { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  actionRowText:      { fontSize: 15, fontWeight: "600" },

  // Forward picker
  forwardSearchWrap:  { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4, marginBottom: 8 },
  forwardSearchInput: { flex: 1, fontSize: 14 },
  forwardRow:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },
  forwardName:        { fontSize: 15, fontWeight: "600" },
});
