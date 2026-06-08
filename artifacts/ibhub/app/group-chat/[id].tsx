import * as Haptics from "expo-haptics";
import * as ExpoLinking from "expo-linking";
import { useTranslation } from "react-i18next";
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
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { VideoView, useVideoPlayer } from "expo-video";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import * as API from "@/services/api";
import type { AppMessage, AppConversation } from "@/services/api";
import {
  MAX_CHAT_FILE_SIZE,
  formatFileSize,
  resolveChatMime,
} from "@/constants/chatUploads";

const REACTION_EMOJIS = ["🍷", "❤️", "👍", "😂", "🔥", "😮"];

function formatDateSep(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

const MAX_FILE_SIZE_LABEL = formatFileSize(MAX_CHAT_FILE_SIZE);

function openAppSettings() {
  Linking.openSettings().catch(() => {});
}

function permissionAlert(message: string, t: (k: string) => string) {
  Alert.alert(
    t("group_chat_screen.permission_title"),
    message,
    [
      { text: t("group_chat_screen.permission_cancel"), style: "cancel" },
      { text: t("group_chat_screen.permission_open_settings"), onPress: openAppSettings },
    ],
  );
}

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
  const { t }   = useTranslation();
  const colors  = useColors();
  const router  = useRouter();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { user, activeCompany, session } = useAuth();
  const insets  = useSafeAreaInsets();

  // All roles (including visualizador) can chat as company
  const effectiveCompanyId = activeCompany?.id ?? null;

  const [groupInfo, setGroupInfo]       = useState<GroupInfo>({ name: "Grupo", member_count: 0, avatar_url: null, owner_id: "" });
  const [messages, setMessages]         = useState<AppMessage[]>([]);
  const [profiles, setProfiles]         = useState<Map<string, SenderProfile>>(new Map());
  const [companyProfiles, setCompanyProfiles] = useState<Map<string, { id: string; name: string; avatar_url: string | null }>>(new Map());
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(true);
  const [isPending, setIsPending]       = useState(false);
  const [sending, setSending]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [isTyping, setIsTyping]         = useState(false);
  const [typingName, setTypingName]     = useState("");
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [replyTo, setReplyTo]           = useState<AppMessage | null>(null);
  const [menuVisible, setMenuVisible]   = useState(false);
  const [showAttach, setShowAttach]     = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ type: "image" | "video"; url: string } | null>(null);
  // ── Action sheet (long-press menu) ──────────────────────────────────────────
  const [msgActionTarget,   setMsgActionTarget]   = useState<AppMessage | null>(null);
  const pendingForwardMsg                         = useRef<AppMessage | null>(null);
  // ── Forward picker ───────────────────────────────────────────────────────────
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardConvos,     setForwardConvos]     = useState<AppConversation[]>([]);
  const [forwardSearch,     setForwardSearch]     = useState("");
  const [forwarding,        setForwarding]        = useState<string | null>(null);
  // ── In-chat search ───────────────────────────────────────────────────────────
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [searchHitIdx, setSearchHitIdx] = useState(0);
  // ── Group members (for @mentions) ────────────────────────────────────────────
  const [groupMembers, setGroupMembers] = useState<SenderProfile[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

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

    // Check membership status first — pending members see an approval-wait screen
    const { data: memberRow } = await supabase
      .from("group_members")
      .select("role, company_page_id")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if ((memberRow as any)?.role === "pending") {
      const { data: gr } = await supabase.from("groups").select("name, avatar_url, owner_id").eq("id", id).maybeSingle();
      if (gr) setGroupInfo(prev => ({ ...prev, name: (gr as any).name ?? prev.name, avatar_url: (gr as any).avatar_url ?? null, owner_id: (gr as any).owner_id ?? "" }));
      setIsPending(true);
      setLoading(false);
      return;
    }

    // Self-heal: if the user has a valid membership but is missing from
    // conversation_participants (old data / invite bug), insert the missing row
    // before loading the conversation — otherwise RLS will block conversations
    // and messages queries and the chat will appear empty or broken.
    const isValidMember = memberRow && (memberRow as any).role !== "pending";
    if (isValidMember) {
      await supabase.from("conversation_participants").upsert(
        { conversation_id: id, user_id: user.id, company_page_id: (memberRow as any).company_page_id ?? null },
        { onConflict: "conversation_id,user_id,company_page_id", ignoreDuplicates: true },
      );
    }

    const [convRes, partRes, groupRes, msgs, clearedAt] = await Promise.all([
      supabase.from("conversations").select("id, name").eq("id", id).maybeSingle(),
      supabase.from("conversation_participants").select("user_id").eq("conversation_id", id),
      supabase.from("groups").select("name, avatar_url, owner_id").eq("id", id).maybeSingle(),
      API.fetchMessages(id, user.id),
      API.fetchGroupHistoryClearedAt(id, user.id),
    ]);

    const convName = (convRes.data as any)?.name ?? (groupRes.data as any)?.name ?? t("group_chat_screen.group_label");
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

    // Load group members for @mention autocomplete
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", id)
      .neq("role", "pending");
    if (members && members.length > 0) {
      const memberIds = (members as any[]).map(m => m.user_id);
      const { data: memberProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", memberIds);
      if (memberProfiles) {
        setGroupMembers((memberProfiles as SenderProfile[]).filter(p => p.id !== user.id));
      }
    }

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
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          setMessages(prev => prev.map(m =>
            m.id === updated.id
              ? { ...m, content: updated.content, deleted_at: updated.deleted_at ?? m.deleted_at }
              : m,
          ));
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
        const typingUsers = others
          .filter(([_, v]) => (v as any[])[0]?.typing)
          .map(([_, v]) => (v as any[])[0]?.name ?? t("group_chat_screen.someone"));
        if (typingUsers.length > 0) {
          setIsTyping(true);
          setTypingName(
            typingUsers.length === 1
              ? typingUsers[0]
              : typingUsers.length === 2
                ? `${typingUsers[0]} e ${typingUsers[1]}`
                : `${typingUsers[0]} e mais ${typingUsers.length - 1}`,
          );
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
    // @mention detection: trigger when last token starts with @
    const match = text.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  // ── Send text message ─────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!input.trim() || sending || !user?.id) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = input.trim();
    setInput("");
    setMentionQuery(null);
    setSending(true);
    broadcastTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    await API.sendMessage(id, user.id, text, { reply_to_id: replyTo?.id, companyPageId: effectiveCompanyId, accessToken: session?.access_token ?? undefined });
    setReplyTo(null);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Image / video picker ──────────────────────────────────────────────────

  const pickAndSendMedia = async (type: "camera" | "gallery") => {
    setShowAttach(false);
    if (!user?.id || !id) return;

    let result: ImagePicker.ImagePickerResult;

    if (type === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        permissionAlert(t("group_chat_screen.permission_camera_msg"), t);
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.7 });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        permissionAlert(t("group_chat_screen.permission_gallery_msg"), t);
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

    // Client-side guard: block files bigger than the server limit before
    // we waste bandwidth uploading them.
    const assetSize = (asset as any).fileSize as number | undefined;
    if (typeof assetSize === "number" && assetSize > MAX_CHAT_FILE_SIZE) {
      Alert.alert(
        t("group_chat_screen.file_too_large_title"),
        t("group_chat_screen.file_too_large_msg", { type: msgType === "video" ? t("group_chat_screen.video_label") : t("group_chat_screen.file_label"), size: formatFileSize(assetSize), limit: MAX_FILE_SIZE_LABEL }),
      );
      return;
    }

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
      let uploadUri = asset.uri;
      if (msgType === "image" && Platform.OS !== "web") {
        try {
          const compressed = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1080 } }],
            { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
          );
          uploadUri = compressed.uri;
        } catch {}
      }
      const url = await API.uploadChatMedia(id, uploadUri, mimeType, null, {
        accessToken: session?.access_token ?? undefined,
        userId: user?.id ?? undefined,
      });
      setUploading(false);
      if (!url) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        seenMsgIds.current.delete(tempId);
        Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_media_send"));
        return;
      }
      const saved = await API.sendMediaMessage(id, user.id, url, msgType, "", effectiveCompanyId, session?.access_token ?? undefined);
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
      Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_media_send"));
    }
  };

  // ── File attachment ───────────────────────────────────────────────────────

  const pickAndSendFile = async () => {
    setShowAttach(false);
    if (!user?.id || !id) return;

    let tempId: string | null = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (typeof asset.size === "number" && asset.size > MAX_CHAT_FILE_SIZE) {
        Alert.alert(
          t("group_chat_screen.file_too_large_title"),
          t("group_chat_screen.file_too_large_named", { name: asset.name ?? t("group_chat_screen.file_label"), size: formatFileSize(asset.size), limit: MAX_FILE_SIZE_LABEL }),
        );
        return;
      }

      // Resolve the mime type — picker may hand us nothing or octet-stream
      // (Drive-shared docs on Android, in particular), so fall back to the
      // file extension before refusing.
      const resolvedMime = resolveChatMime(asset.mimeType, asset.name);
      if (!resolvedMime) {
        Alert.alert(
          t("group_chat_screen.unsupported_file_title"),
          t("group_chat_screen.unsupported_file_msg"),
        );
        return;
      }

      // Optimistic temp message — same as image/video flow.
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
      const fileObj = (asset as any).file as File | undefined;
      const url = await API.uploadChatMedia(id, asset.uri, resolvedMime, fileObj, {
        accessToken: session?.access_token ?? undefined,
        userId: user?.id ?? undefined,
      });
      setUploading(false);
      if (!url) {
        if (tempId) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          seenMsgIds.current.delete(tempId);
        }
        Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_file_send"));
        return;
      }
      const saved = await API.sendMediaMessage(id, user.id, url, "file", asset.name ?? "arquivo", effectiveCompanyId, session?.access_token ?? undefined);
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
        Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_file_registered"));
      }
    } catch (e: any) {
      setUploading(false);
      if (tempId) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        seenMsgIds.current.delete(tempId);
      }
      if (!e?.message?.includes("cancel")) Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_file_open"));
    }
  };

  // ── 3-dot menu actions ────────────────────────────────────────────────────

  const handleShareGroup = async () => {
    setMenuVisible(false);
    try {
      const link = `https://www.ibhub.com.br/grupo/${id}`;
      await Share.share({ message: `${groupInfo.name} — ${link}`, url: link });
    } catch { /* user dismissed */ }
  };

  const handleLeaveGroup = () => {
    setMenuVisible(false);
    Alert.alert(
      t("group_chat_screen.leave_title"),
      t("group_chat_screen.leave_confirm", { name: groupInfo.name }),
      [
        { text: t("group_chat_screen.cancel"), style: "cancel" },
        {
          text: t("group_chat_screen.leave_btn"), style: "destructive", onPress: async () => {
            if (!user?.id) return;
            const ok = await API.leaveGroup(id, user.id, activeCompany?.id ?? null);
            if (ok) {
              router.replace("/groups" as any);
            } else {
              Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_leave"));
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
        t("group_chat_screen.delete_all_title"),
        t("group_chat_screen.delete_all_confirm"),
        [
          { text: t("group_chat_screen.cancel"), style: "cancel" },
          {
            text: t("group_chat_screen.delete_all_btn"), style: "destructive", onPress: async () => {
              const ok = await API.deleteGroupMessages(id);
              if (ok) {
                setMessages([]);
                seenMsgIds.current.clear();
              } else {
                Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_delete_msgs"));
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        t("group_chat_screen.clear_history_title"),
        t("group_chat_screen.clear_history_confirm"),
        [
          { text: t("group_chat_screen.cancel"), style: "cancel" },
          {
            text: t("group_chat_screen.clear_history_btn"), style: "destructive", onPress: async () => {
              if (!user?.id) return;
              const clearedAt = await API.clearGroupHistoryForUser(id, user.id);
              if (clearedAt !== null) {
                setMessages([]);
                seenMsgIds.current.clear();
              } else {
                Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_clear_history"));
              }
            },
          },
        ],
      );
    }
  };

  // ── Reactions ─────────────────────────────────────────────────────────────

  const handleReaction = (msgId: string, emoji: string) => {
    setReactionTarget(null);
    if (!user?.id) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const old = m.reactions ?? [];
      const myPrev = old.find(r => r.mine);
      let next: typeof old;
      if (myPrev?.emoji === emoji) {
        next = old
          .map(r => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)
          .filter(r => r.count > 0);
      } else {
        const withoutMine = myPrev
          ? old.map(r => r.emoji === myPrev.emoji ? { ...r, count: r.count - 1, mine: false } : r).filter(r => r.count > 0)
          : old;
        const existingNew = withoutMine.find(r => r.emoji === emoji);
        if (existingNew) {
          next = withoutMine.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r);
        } else {
          next = [...withoutMine, { emoji, count: 1, mine: true }];
        }
      }
      return { ...m, reactions: next };
    }));
    API.toggleMessageReaction(msgId, user.id, emoji);
  };

  // ── Search, delete, forward logic ────────────────────────────────────────────

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
      } else {
        Alert.alert("Erro", "Não foi possível apagar a mensagem. Tente novamente.");
      }
    } else {
      setMessages(prev => prev.filter(m => m.id !== target.id));
    }
  };

  const dismissForwardPicker = useCallback(() => {
    setShowForwardPicker(false);
    setForwardSearch("");
    setForwardConvos([]);
    pendingForwardMsg.current = null;
  }, []);

  const openForwardPicker = async () => {
    if (!user?.id || !msgActionTarget) return;
    pendingForwardMsg.current = msgActionTarget;
    setMsgActionTarget(null);           // closes action sheet immediately
    setShowForwardPicker(true);
    const convos = await API.fetchConversations(user.id, activeCompany?.id ?? null);
    setForwardConvos(convos.filter(c => c.id !== id));
  };

  const handleForwardMessage = async (targetConvId: string) => {
    const source = pendingForwardMsg.current;
    if (!source || !user?.id) return;
    setForwarding(targetConvId);
    await API.forwardMessage(source, targetConvId, user.id, {
      companyPageId: effectiveCompanyId,
      accessToken: session?.access_token ?? undefined,
    });
    setForwarding(null);
    setShowForwardPicker(false);
    setForwardSearch("");
    pendingForwardMsg.current = null;
  };

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    return groupMembers.filter(m =>
      !mentionQuery || m.full_name?.toLowerCase().startsWith(mentionQuery.toLowerCase()),
    );
  }, [groupMembers, mentionQuery]);

  const insertMention = (member: SenderProfile) => {
    const firstName = member.full_name?.split(" ")[0] ?? "user";
    const atIdx = input.lastIndexOf("@");
    if (atIdx === -1) return;
    setInput(input.slice(0, atIdx) + `@${firstName} `);
    setMentionQuery(null);
  };

  // ── Message renderers ─────────────────────────────────────────────────────

  const renderAudioBubble = (item: AppMessage, isMe: boolean) => (
    <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground, fontStyle: "italic", opacity: 0.7 }]}>
      🎤 {t("group_chat_screen.audio_unavailable")}
    </Text>
  );

  const renderFileBubble = (item: AppMessage, isMe: boolean) => (
    <TouchableOpacity
      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 4 }}
      onPress={() => item.media_url && Linking.openURL(item.media_url).catch(() => Alert.alert(t("group_chat_screen.error_title"), t("group_chat_screen.error_file_open")))}
    >
      <View style={[styles.fileIcon, { backgroundColor: isMe ? "rgba(255,255,255,0.15)" : colors.background }]}>
        <Feather name="file-text" size={18} color={isMe ? "#fff" : colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.navy, fontWeight: "600" }]} numberOfLines={1}>
          {item.content || t("group_chat_screen.file_label")}
        </Text>
        <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>
          {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <Feather name="download" size={16} color={isMe ? "#ffffff88" : colors.mutedForeground} />
    </TouchableOpacity>
  );

  const renderMessage = ({ item, index }: { item: AppMessage; index: number }) => {
    const isMe          = item.sender_id === user?.id;
    const time          = new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const sender        = profiles.get(item.sender_id);
    const fromCompanyId = (item as any).from_company_page_id ?? null;
    const companyProfile = fromCompanyId ? companyProfiles.get(fromCompanyId) : null;
    const displayName   = isMe ? myName : (companyProfile?.name ?? sender?.full_name ?? t("group_chat_screen.member_fallback"));
    const displayAvatar = companyProfile?.avatar_url ?? sender?.avatar_url ?? undefined;
    const isCompanyMsg  = !!fromCompanyId;
    const msgReactions  = item.reactions ?? [];
    const hasReactions  = msgReactions.length > 0;
    const msgType       = item.message_type ?? "text";
    const isTemp        = item.id.startsWith("tmp_");

    const prevMsg      = index > 0 ? messages[index - 1] : null;
    const showDateSep  = !prevMsg ||
      new Date(item.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
    const isContinuation = !showDateSep && !!prevMsg &&
      prevMsg.sender_id === item.sender_id &&
      (new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 5 * 60 * 1000;

    const isSearchHit = showSearch && !!searchQuery.trim() && searchHits[searchHitIdx]?.msg.id === item.id;

    // Deleted message — show placeholder
    if (item.deleted_at) {
      return (
        <>
          {showDateSep && (
            <View style={styles.dateSep}>
              <View style={[styles.dateSepLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dateSepText, { color: colors.mutedForeground }]}>
                {formatDateSep(item.created_at)}
              </Text>
              <View style={[styles.dateSepLine, { backgroundColor: colors.border }]} />
            </View>
          )}
          <View style={[styles.msgGroup, isMe ? styles.msgGroupMe : styles.msgGroupOther]}>
            <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
              {!isMe && <View style={{ width: 28 }} />}
              <View style={[styles.bubble, { backgroundColor: isMe ? "#1a2f48" : "#f3f4f6", flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <Feather name="slash" size={12} color={isMe ? "#ffffff55" : colors.mutedForeground} />
                <Text style={{ fontSize: 13, fontStyle: "italic", color: isMe ? "#ffffff88" : colors.mutedForeground }}>
                  Esta mensagem foi apagada
                </Text>
              </View>
            </View>
          </View>
        </>
      );
    }

    return (
      <>
        {showDateSep && (
          <View style={styles.dateSep}>
            <View style={[styles.dateSepLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateSepText, { color: colors.mutedForeground }]}>
              {formatDateSep(item.created_at)}
            </Text>
            <View style={[styles.dateSepLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <View style={[styles.msgGroup, isMe ? styles.msgGroupMe : styles.msgGroupOther, isContinuation && { marginBottom: 2 }, isSearchHit && { backgroundColor: colors.gold + "22", borderRadius: 12, paddingHorizontal: 4 }]}>
          <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
            {!isMe && (
              isContinuation
                ? <View style={{ width: 28 }} />
                : (
                  <TouchableOpacity
                    onPress={() => { isCompanyMsg && fromCompanyId ? router.push(`/empresa/${fromCompanyId}` as any) : router.push(`/profile/${item.sender_id}` as any); }}
                    activeOpacity={0.7}
                    style={styles.senderWrap}
                  >
                    <Avatar name={displayName} uri={displayAvatar} size={28} />
                  </TouchableOpacity>
                )
            )}
            <View style={{ maxWidth: "80%", opacity: isTemp ? 0.6 : 1 }}>
              {!isMe && !isContinuation && (
                <TouchableOpacity
                  onPress={() => { isCompanyMsg && fromCompanyId ? router.push(`/empresa/${fromCompanyId}` as any) : router.push(`/profile/${item.sender_id}` as any); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={[styles.senderName, { color: colors.gold }]}>{displayName}</Text>
                    {isCompanyMsg && (
                      <View style={{ backgroundColor: colors.gold + "22", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9, color: colors.gold, fontWeight: "700" }}>{t("group_chat_screen.company_badge")}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              {isMe && isCompanyMsg && !isContinuation && (
                <Text style={{ fontSize: 9, color: "#fff8", textAlign: "right", marginBottom: 2 }}>
                  {t("group_chat_screen.sent_as_company")}
                </Text>
              )}
              <Pressable
                style={[
                  styles.bubble,
                  { backgroundColor: isMe ? colors.navy : "#fff" },
                  !isMe && { borderColor: colors.border, borderWidth: 1 },
                  (msgType === "image" || msgType === "video") && item.media_url ? { padding: 0, overflow: "hidden" } : {},
                ]}
                onLongPress={() => {
                  if (!isTemp) {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setMsgActionTarget(item);
                  }
                }}
                onPress={() => {
                  if ((msgType === "image" || msgType === "video") && item.media_url && !isTemp) {
                    setSelectedMedia({ type: msgType as "image" | "video", url: item.media_url });
                  }
                }}
                delayLongPress={400}
              >
                {item.reply_to && (
                  <View style={[styles.quotedMsg, { borderLeftColor: colors.gold }, { margin: 10, marginBottom: 4 }]}>
                    <Text style={[styles.quotedSender, { color: colors.gold }]} numberOfLines={1}>
                      {item.reply_to.sender_id === user?.id ? t("group_chat_screen.you") : (profiles.get(item.reply_to.sender_id)?.full_name ?? t("group_chat_screen.member_fallback"))}
                    </Text>
                    <Text style={[styles.quotedText, { color: isMe ? "#ffffff88" : colors.mutedForeground }]} numberOfLines={1}>
                      {item.reply_to.content}
                    </Text>
                  </View>
                )}

                {msgType === "audio" ? (
                  <View style={{ padding: 10 }}>{renderAudioBubble(item, isMe)}</View>
                ) : msgType === "file" ? (
                  <View style={{ padding: 10 }}>{renderFileBubble(item, isMe)}</View>
                ) : (msgType === "image" || msgType === "video") && item.media_url ? (
                  <View>
                    <Image source={{ uri: item.media_url }} style={styles.mediaImage} resizeMode="cover" />
                    {msgType === "video" && (
                      <View style={styles.videoOverlay}>
                        <View style={styles.playBtn}>
                          <Feather name="play" size={18} color="#fff" />
                        </View>
                      </View>
                    )}
                    <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground, marginTop: 2, marginBottom: 6, marginHorizontal: 10, textAlign: "right" }]}>{time}</Text>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>{item.content}</Text>
                    <Text style={[styles.bubbleTime, { color: isMe ? "#ffffff88" : colors.mutedForeground }]}>{time}</Text>
                  </View>
                )}
              </Pressable>
            </View>
            <TouchableOpacity style={styles.replyBtn} onPress={() => setReplyTo(item)}>
              <Feather name={isMe ? "corner-up-right" : "corner-up-left"} size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {hasReactions && (
            <View style={[styles.reactionsRow, isMe ? { marginRight: 34 } : { marginLeft: 34 }]}>
              {msgReactions.map(r => (
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
          )}
        </View>
      </>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  // Pending-approval gate — show a friendly waiting screen instead of the chat
  if (!loading && isPending) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "space-between" }]}>
        {/* Minimal header so user can go back */}
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
            <Feather name="arrow-left" size={22} color={colors.navy} />
            {groupInfo.avatar_url
              ? <Image source={{ uri: groupInfo.avatar_url }} style={styles.headerAvatar} />
              : <Avatar name={groupInfo.name} size={36} />}
            <View>
              <Text style={[styles.senderName, { color: colors.navy }]} numberOfLines={1}>{groupInfo.name}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Waiting state */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center" }}>
            <Feather name="clock" size={32} color="#d97706" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.navy, textAlign: "center" }}>
            Aguardando aprovação
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 20 }}>
            Sua solicitação de entrada foi enviada ao administrador do grupo. Você receberá acesso ao chat assim que for aprovado.
          </Text>
        </View>
        <View style={{ height: bottomPad + 16 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => router.push(`/group-settings/${id}` as any)}
          activeOpacity={0.7}
        >
          {groupInfo.avatar_url ? (
            <Image source={{ uri: groupInfo.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <Avatar name={groupInfo.name} size={36} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.groupName, { color: colors.navy }]} numberOfLines={1}>{groupInfo.name}</Text>
            <View style={styles.membersRow}>
              {isTyping ? (
                <Text style={[styles.membersText, { color: colors.gold, fontStyle: "italic" }]}>
                  {t("group_chat_screen.typing_indicator", { name: typingName })}
                </Text>
              ) : (
                <>
                  <Feather name="users" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.membersText, { color: colors.mutedForeground }]}>
                    {t("group_chat_screen.member_count", { count: groupInfo.member_count })}
                  </Text>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(""); }} style={styles.headerRight}>
          <Feather name="search" size={19} color={showSearch ? colors.gold : colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerRight}>
          <Feather name="more-vertical" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            style={[styles.searchInput, { color: colors.foreground }]}
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
                {t("group_chat_screen.empty_state")}
              </Text>
            </View>
          }
        />
      )}

      {/* Uploading indicator */}
      {uploading && (
        <View style={[styles.uploadingBar, { backgroundColor: colors.gold + "18" }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={{ fontSize: 13, color: colors.gold, marginLeft: 8 }}>{t("group_chat_screen.uploading")}</Text>
        </View>
      )}

      {/* Reply preview */}
      {replyTo && (
        <View style={[styles.replyBar, { backgroundColor: colors.gold + "18", borderTopColor: colors.gold + "40" }]}>
          <View style={[styles.replyBarAccent, { backgroundColor: colors.gold }]} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>
              {replyTo.sender_id === user?.id ? t("group_chat_screen.you") : (profiles.get(replyTo.sender_id)?.full_name ?? t("group_chat_screen.member_fallback"))}
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
            <Text style={[styles.attachLabel, { color: colors.foreground }]}>{t("group_chat_screen.attach_camera")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={() => pickAndSendMedia("gallery")}>
            <View style={[styles.attachIcon, { backgroundColor: colors.navy + "12" }]}>
              <Feather name="image" size={20} color={colors.navy} />
            </View>
            <Text style={[styles.attachLabel, { color: colors.foreground }]}>{t("group_chat_screen.attach_gallery")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={pickAndSendFile}>
            <View style={[styles.attachIcon, { backgroundColor: colors.navy + "12" }]}>
              <Feather name="file" size={20} color={colors.navy} />
            </View>
            <Text style={[styles.attachLabel, { color: colors.foreground }]}>{t("group_chat_screen.attach_file")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      {/* @mention autocomplete */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <View style={[styles.mentionList, { backgroundColor: "#fff", borderTopColor: colors.border }]}>
          {filteredMembers.slice(0, 5).map(member => {
            const name = member.full_name ?? "";
            const qLen = mentionQuery?.length ?? 0;
            const matched = name.slice(0, qLen);
            const rest    = name.slice(qLen);
            return (
              <TouchableOpacity
                key={member.id}
                style={[styles.mentionItem, { borderBottomColor: colors.border }]}
                onPress={() => insertMention(member)}
              >
                <Avatar uri={member.avatar_url} name={name} size={28} />
                <Text style={[styles.mentionName, { color: colors.navy }]}>
                  {qLen > 0 && <Text style={{ fontWeight: "800" }}>{matched}</Text>}
                  {rest}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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
          placeholder={t("group_chat_screen.input_placeholder")}
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
        ) : null}
      </View>

      {/* 3-dot menu modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleShareGroup}>
              <Feather name="link-2" size={18} color={colors.navy} />
              <Text style={[styles.menuItemText, { color: colors.navy }]}>{t("group_chat_screen.menu_share_link")}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                // Delay navigation until the Modal closing animation finishes;
                // calling router.push while the Modal is still animating closed
                // can cause the navigation to be silently swallowed on web/iOS.
                setTimeout(() => router.push(`/group-settings/${id}` as any), 300);
              }}
            >
              <Feather name="settings" size={18} color={colors.navy} />
              <Text style={[styles.menuItemText, { color: colors.navy }]}>{t("group_chat_screen.menu_settings")}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteMessages}>
              <Feather name="trash-2" size={18} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>
                {isGroupOwner ? t("group_chat_screen.delete_all_btn") : t("group_chat_screen.clear_history_btn")}
              </Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLeaveGroup}>
              <Feather name="log-out" size={18} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>{t("group_chat_screen.leave_btn")}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Message Action Sheet (long-press) ─────────────────────────────── */}
      <Modal visible={!!msgActionTarget} transparent animationType="slide" onRequestClose={() => setMsgActionTarget(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setMsgActionTarget(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: "#fff", paddingBottom: bottomPad + 8 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            {/* Message preview */}
            {msgActionTarget?.content ? (
              <View style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, marginBottom: 3 }}>
                  {msgActionTarget.sender_id === user?.id ? "Você" : (profiles.get(msgActionTarget.sender_id)?.full_name ?? "...")}
                </Text>
                <Text style={{ fontSize: 13, color: colors.foreground }} numberOfLines={2}>{msgActionTarget.content}</Text>
              </View>
            ) : null}

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

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Reply */}
            <TouchableOpacity style={styles.actionRow} onPress={() => { setReplyTo(msgActionTarget!); setMsgActionTarget(null); }}>
              <Feather name="corner-up-left" size={17} color={colors.navy} />
              <Text style={[styles.actionRowText, { color: colors.navy }]}>Responder</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Forward */}
            <TouchableOpacity style={styles.actionRow} onPress={openForwardPicker}>
              <Feather name="share-2" size={17} color={colors.navy} />
              <Text style={[styles.actionRowText, { color: colors.navy }]}>Encaminhar</Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Delete */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                const target = msgActionTarget!;
                const isOwn = target.sender_id === user?.id;
                setMsgActionTarget(null);
                Alert.alert(
                  "Apagar mensagem",
                  isOwn ? "Como deseja apagar esta mensagem?" : "Apagar esta mensagem para você?",
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
              <Text style={[styles.actionRowText, { color: "#dc2626" }]}>Apagar mensagem</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Forward Picker ─────────────────────────────────────────────────── */}
      <Modal visible={showForwardPicker} transparent animationType="slide" onRequestClose={dismissForwardPicker}>
        <Pressable style={styles.sheetOverlay} onPress={dismissForwardPicker}>
          <Pressable style={[styles.sheet, { backgroundColor: "#fff", maxHeight: "78%", paddingBottom: bottomPad + 8 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.navy }]}>Encaminhar para</Text>
            <View style={[styles.forwardSearchWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.forwardSearchInput, { color: colors.foreground }]}
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
                    style={[styles.forwardRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleForwardMessage(conv.id)}
                    disabled={!!forwarding}
                  >
                    <Avatar uri={avatarUri ?? null} name={name} size={40} />
                    <Text style={[styles.forwardName, { color: colors.navy, flex: 1 }]} numberOfLines={1}>{name}</Text>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fullscreen image viewer */}
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

      {/* Fullscreen video player */}
      {selectedMedia?.type === "video" && (
        <GroupVideoPlayerModal url={selectedMedia.url} onClose={() => setSelectedMedia(null)} />
      )}
    </KeyboardAvoidingView>
  );
}

function GroupVideoPlayerModal({ url, onClose }: { url: string; onClose: () => void }) {
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

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  headerBack:      { padding: 4 },
  headerLeft:      { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerRight:     { padding: 4 },
  dateSep:         { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12, paddingHorizontal: 4 },
  dateSepLine:     { flex: 1, height: 1 },
  dateSepText:     { fontSize: 11, fontWeight: "600", paddingHorizontal: 4 },
  videoOverlay:    { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)" },
  playBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center" },
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
  reactionsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  reactionBadge:   { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, gap: 3 },
  reactionEmoji:   { fontSize: 16 },
  reactionCount:   { fontSize: 12, fontWeight: "700", color: "#555" },
  mediaImage:      { width: 200, height: 150, borderRadius: 10 },
  fileIcon:        { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  uploadingBar:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  replyBar:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  replyBarAccent:  { width: 3, height: "100%", borderRadius: 2 },
  attachMenu:      { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 20, borderTopWidth: 1 },
  attachOption:    { alignItems: "center", gap: 6 },
  attachIcon:      { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  attachLabel:     { fontSize: 11, fontWeight: "600" },
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

  // Search bar
  searchBar:          { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput:        { flex: 1, fontSize: 14 },

  // Action sheet
  sheetOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:              { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 0 },
  sheetHandle:        { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  sheetTitle:         { fontSize: 17, fontWeight: "700", marginBottom: 10 },
  actionRow:          { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  actionRowText:      { fontSize: 15, fontWeight: "600" },

  // Forward picker
  forwardSearchWrap:  { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4, marginBottom: 8 },
  forwardSearchInput: { flex: 1, fontSize: 14 },
  forwardRow:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },
  forwardName:        { fontSize: 15, fontWeight: "600" },

  // @mention autocomplete
  mentionList:        { maxHeight: 160, borderTopWidth: 1 },
  mentionItem:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  mentionName:        { fontSize: 14, fontWeight: "500" },
});
