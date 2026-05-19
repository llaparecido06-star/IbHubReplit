import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { useUnread } from "@/context/UnreadContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { AppConversation } from "@/services/api";

type RealtimeMessagePayload = {
  new: {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string | null;
    message_type: string | null;
    created_at: string;
    read_at: string | null;
  };
};

const FOLLOWUP_KEY = "ibhub_followup_reminders";

type MainTab = "mensagens" | "solicitacoes";

function timeAgo(dateStr?: string, justNow = "agora"): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return justNow;
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const colors  = useColors();
  const router  = useRouter();
  const { user, activeCompany } = useAuth();
  const insets  = useSafeAreaInsets();
  const { setUnreadCount } = useUnread();

  const [convos,       setConvos]       = useState<AppConversation[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [mainTab,      setMainTab]      = useState<MainTab>("mensagens");
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [userSearch,   setUserSearch]   = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string; avatar_url: string | null; headline: string | null }[]>([]);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [accepting,    setAccepting]    = useState<string | null>(null);
  const [followUpMap,  setFollowUpMap]  = useState<Record<string, string>>({});

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  useEffect(() => {
    if (activeCompany) setMainTab("mensagens");
  }, [activeCompany?.id]);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const data = await API.fetchConversations(user.id, activeCompany?.id ?? null);
    setConvos(data);
    setLoading(false);
  }, [user?.id, activeCompany?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const total = convos.reduce((acc, c) => acc + (c.unread_count ?? 0), 0);
    setUnreadCount(total);
  }, [convos, setUnreadCount]);

  useEffect(() => {
    if (!user?.id) return;

    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`messages-list-${user.id}_${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: RealtimeMessagePayload) => {
          const newMsg = payload.new;
          if (!newMsg?.conversation_id) return;

          let needsFullReload = false;

          setConvos((prev) => {
            const idx = prev.findIndex((c) => c.id === newMsg.conversation_id);
            if (idx === -1) {
              needsFullReload = true;
              return prev;
            }

            const updated = [...prev];
            const conv = { ...updated[idx] };

            const msgContent =
              newMsg.message_type === "image" ? "📷 Foto"
              : newMsg.message_type === "video" ? "🎬 Vídeo"
              : newMsg.message_type === "audio" ? "🎤 Áudio"
              : newMsg.message_type === "file"  ? "📎 Arquivo"
              : (newMsg.content ?? null);

            conv.last_message = msgContent;
            conv.last_message_at = newMsg.created_at;

            if (newMsg.sender_id !== user.id) {
              conv.unread_count = (conv.unread_count ?? 0) + 1;
            }

            updated.splice(idx, 1);
            updated.unshift(conv);
            return updated;
          });

          if (needsFullReload) load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  useEffect(() => {
    if (!user?.id) return;

    const uid2 = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`conv-participant-accepted-${user.id}_${uid2}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.accepted === true) {
            setConvos((prev) =>
              prev.map((c) =>
                c.id === updated.conversation_id ? { ...c, accepted: true } : c,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    load();
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FOLLOWUP_KEY);
        setFollowUpMap(raw ? JSON.parse(raw) : {});
      } catch {}
    })();
  }, [load]));

  useEffect(() => {
    if (!userSearch.trim() || !user?.id) { setSearchResults([]); return; }
    const t2 = setTimeout(async () => {
      const res = await API.searchChatContacts(userSearch, user.id);
      setSearchResults(res);
    }, 300);
    return () => clearTimeout(t2);
  }, [userSearch, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleStartChat = async (targetUserId: string) => {
    if (!user?.id || startingChat) return;
    setStartingChat(targetUserId);
    const convoId = await API.getOrCreateDirectConversation(user.id, targetUserId, false, activeCompany?.id ?? null);
    setStartingChat(null);
    setShowNewConvo(false);
    if (convoId) router.push(`/chat/${convoId}` as any);
  };

  const handleAccept = async (conv: AppConversation) => {
    if (!user?.id || accepting) return;
    setAccepting(conv.id);
    const ok = await API.acceptConversation(conv.id, user.id);
    if (ok) {
      setConvos((prev) =>
        prev.map((c) => c.id === conv.id ? { ...c, accepted: true } : c),
      );
      setMainTab("mensagens");
      router.push(`/chat/${conv.id}` as any);
    }
    setAccepting(null);
  };

  const handleDecline = async (conv: AppConversation) => {
    if (!user?.id) return;
    await API.declineConversation(conv.id, user.id);
    setConvos((prev) => prev.filter((c) => c.id !== conv.id));
  };

  const accepted  = convos.filter((c) => c.accepted !== false);
  const requests  = convos.filter((c) => c.accepted === false);

  const filtered = (mainTab === "mensagens" ? accepted : requests).filter((c) => {
    if (!search) return true;
    const name = c.name ?? c.participant?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const requestCount = requests.length;
  const justNowLabel = t("messages.just_now");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("messages.title")}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.newChatBtn, { backgroundColor: colors.gold }]}
            onPress={() => { setShowNewConvo((v) => !v); setUserSearch(""); setSearchResults([]); }}
            accessibilityRole="button"
            accessibilityLabel={t("messages.new_conversation")}
          >
            <Feather name="edit" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gruposBtn}
            onPress={() => router.push("/groups" as any)}
          >
            <Feather name="users" size={16} color={colors.navy} />
            <Text style={[styles.gruposBtnText, { color: colors.navy }]}>{t("messages.groups_btn")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Nova conversa */}
      {showNewConvo && (
        <View style={[styles.novaCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <Text style={[styles.novaTitle, { color: colors.navy }]}>{t("messages.new_conversation")}</Text>
          <Text style={[styles.novaHint, { color: colors.mutedForeground }]}>
            {t("messages.nova_hint")}
          </Text>
          <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder={t("messages.search_name")}
              placeholderTextColor={colors.mutedForeground}
              value={userSearch}
              onChangeText={setUserSearch}
              autoFocus
            />
            {userSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => setUserSearch("")}
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          {userSearch.length > 0 && (
            <View style={{ gap: 4, marginTop: 6 }}>
              {searchResults.length === 0 ? (
                <Text style={[styles.noResultsText, { color: colors.mutedForeground }]}>
                  {t("messages.no_contacts")}
                </Text>
              ) : (
                searchResults.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.userRow}
                    onPress={() => handleStartChat(u.id)}
                    disabled={startingChat === u.id}
                  >
                    <Avatar uri={u.avatar_url} name={u.full_name} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName, { color: colors.navy }]}>{u.full_name}</Text>
                      {!!u.headline && (
                        <Text style={[styles.userSub, { color: colors.mutedForeground }]} numberOfLines={1}>{u.headline}</Text>
                      )}
                    </View>
                    {startingChat === u.id
                      ? <ActivityIndicator size="small" color={colors.gold} />
                      : <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    }
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {(activeCompany ? ["mensagens"] as MainTab[] : ["mensagens", "solicitacoes"] as MainTab[]).map((tab) => {
          const label = tab === "mensagens" ? t("messages.tab_messages") : t("messages.tab_requests");
          const isActive = tab === mainTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
              onPress={() => setMainTab(tab)}
            >
              <Text style={[styles.tabText, { color: isActive ? colors.gold : colors.mutedForeground, fontWeight: isActive ? "700" : "400" }]}>
                {label}
              </Text>
              {tab === "solicitacoes" && requestCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.gold }]}>
                  <Text style={styles.badgeText}>{requestCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: "#fff" }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={mainTab === "mensagens" ? t("messages.search_convos") : t("messages.search_requests")}
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
          renderItem={({ item }) =>
            mainTab === "solicitacoes" ? (
              <RequestRow
                conversation={item}
                colors={colors}
                onAccept={() => handleAccept(item)}
                onDecline={() => handleDecline(item)}
                accepting={accepting === item.id}
                tAccept={t("messages.accept")}
                tDecline={t("messages.decline")}
                tUnknown={t("messages.unknown")}
                tSentMessage={t("messages.sent_message")}
              />
            ) : (
              <ConversationRow
                conversation={item}
                colors={colors}
                followUpDate={followUpMap[item.id]}
                justNow={justNowLabel}
                tStartChat={t("messages.start_chat")}
                tOverdue={t("messages.followup_overdue")}
                tToday={t("messages.followup_today")}
                tTomorrow={t("messages.followup_tomorrow")}
              />
            )
          }
          ListEmptyComponent={
            mainTab === "solicitacoes" ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.gold + "18" }]}>
                  <Feather name="user-check" size={32} color={colors.gold} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.navy }]}>{t("messages.no_requests_title")}</Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                  {t("messages.no_requests_sub")}
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.gold + "18" }]}>
                  <Feather name="message-circle" size={36} color={colors.gold} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.navy }]}>{t("messages.toast_title")}</Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                  {t("messages.toast_sub")}
                </Text>
                <TouchableOpacity
                  style={[styles.newConvoBtn, { backgroundColor: colors.gold }]}
                  onPress={() => setShowNewConvo(true)}
                >
                  <Feather name="edit" size={16} color="#fff" />
                  <Text style={styles.newConvoBtnText}>{t("messages.new_conversation")}</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

// ── Conversation Row ───────────────────────────────────────────────────────────

function ConversationRow({
  conversation: conv,
  colors,
  followUpDate,
  justNow,
  tStartChat,
  tOverdue,
  tToday,
  tTomorrow,
}: {
  conversation: AppConversation;
  colors: any;
  followUpDate?: string;
  justNow: string;
  tStartChat: string;
  tOverdue: string;
  tToday: string;
  tTomorrow: string;
}) {
  const router   = useRouter();
  const hasUnread = (conv.unread_count ?? 0) > 0;
  const name      = conv.is_group
    ? (conv.name ?? "Grupo")
    : (conv.name ?? conv.participant_company?.name ?? conv.participant?.full_name ?? "Chat");
  const companyId = conv.participant_company?.id ?? null;
  const avatarUri = conv.is_group
    ? (conv.group_avatar_url ?? null)
    : (companyId ? (conv.participant_company?.avatar_url ?? null) : (conv.participant?.avatar_url ?? null));

  const followUpDue = followUpDate
    ? (() => {
        const d = new Date(followUpDate);
        const now = new Date();
        if (d <= now) return tOverdue;
        const diffMs = d.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return tToday;
        if (diffDays === 1) return tTomorrow;
        return `${diffDays}d`;
      })()
    : null;

  return (
    <TouchableOpacity
      style={[styles.convoRow, { borderBottomColor: colors.border, backgroundColor: "#fff" }]}
      onPress={() => {
        if (conv.is_group) {
          router.push(`/group-chat/${conv.id}` as any);
        } else {
          router.push((companyId ? `/chat/${conv.id}?companyId=${companyId}` : `/chat/${conv.id}`) as any);
        }
      }}
      activeOpacity={0.7}
    >
      <Avatar uri={avatarUri} name={name} size={52} />
      <View style={styles.convoBody}>
        <View style={styles.convoTop}>
          <Text style={[styles.convoName, { color: colors.navy }]} numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {followUpDue && (
              <View style={[styles.followUpBadge, { backgroundColor: followUpDue === tOverdue ? "#ef4444" : colors.gold }]}>
                <Feather name="clock" size={9} color="#fff" />
                <Text style={styles.followUpText}>{followUpDue}</Text>
              </View>
            )}
            <Text style={[styles.convoTime, { color: colors.mutedForeground }]}>{timeAgo(conv.last_message_at ?? undefined, justNow)}</Text>
          </View>
        </View>
        <View style={styles.convoBottom}>
          <Text
            style={[styles.convoMsg, { color: hasUnread ? colors.foreground : colors.mutedForeground }, hasUnread && { fontWeight: "600" }]}
            numberOfLines={1}
          >
            {conv.last_message ?? tStartChat}
          </Text>
          {hasUnread && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.gold }]}>
              <Text style={[styles.unreadText]}>{conv.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Request Row ────────────────────────────────────────────────────────────────

function RequestRow({
  conversation: conv,
  colors,
  onAccept,
  onDecline,
  accepting,
  tAccept,
  tDecline,
  tUnknown,
  tSentMessage,
}: {
  conversation: AppConversation;
  colors: any;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
  tAccept: string;
  tDecline: string;
  tUnknown: string;
  tSentMessage: string;
}) {
  const name    = conv.participant?.full_name ?? tUnknown;
  const preview = conv.last_message ?? tSentMessage;

  return (
    <View style={[styles.requestRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
      <Avatar uri={conv.participant?.avatar_url ?? null} name={name} size={48} />
      <View style={styles.requestBody}>
        <Text style={[styles.requestName, { color: colors.navy }]}>{name}</Text>
        <Text style={[styles.requestPreview, { color: colors.mutedForeground }]} numberOfLines={1}>{preview}</Text>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: colors.navy }]}
            onPress={onAccept}
            disabled={accepting}
          >
            {accepting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.acceptBtnText}>{tAccept}</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.declineBtn, { borderColor: colors.border }]}
            onPress={onDecline}
            disabled={accepting}
          >
            <Text style={[styles.declineBtnText, { color: colors.foreground }]}>{tDecline}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 26, fontWeight: "800" },
  headerActions:{ flexDirection: "row", alignItems: "center", gap: 10 },
  newChatBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  gruposBtn:    { flexDirection: "row", alignItems: "center", gap: 5 },
  gruposBtnText:{ fontSize: 15, fontWeight: "600" },

  novaCard:   { padding: 16, borderBottomWidth: 1, gap: 8 },
  novaTitle:  { fontSize: 16, fontWeight: "700" },
  novaHint:   { fontSize: 12, lineHeight: 16 },
  noResultsText: { fontSize: 13, textAlign: "center", paddingVertical: 8 },
  userRow:    { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  userName:   { fontSize: 14, fontWeight: "600" },
  userSub:    { fontSize: 12, marginTop: 1 },

  tabRow:     { flexDirection: "row", borderBottomWidth: 1, backgroundColor: "#fff" },
  tab:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  tabText:    { fontSize: 14 },
  badge:      { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText:  { fontSize: 11, fontWeight: "700", color: "#fff" },

  searchWrap: { padding: 10 },
  searchBar:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  searchInput:{ flex: 1, fontSize: 14 },

  loadingWrap:{ flex: 1, alignItems: "center", justifyContent: "center" },

  convoRow:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  convoBody:  { flex: 1 },
  convoTop:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  convoName:  { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  convoTime:  { fontSize: 12 },
  convoBottom:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  convoMsg:   { fontSize: 13, flex: 1, marginRight: 8 },
  unreadBadge:{ minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  followUpBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  followUpText:  { fontSize: 10, fontWeight: "700", color: "#fff" },

  requestRow:     { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  requestBody:    { flex: 1, gap: 4 },
  requestName:    { fontSize: 15, fontWeight: "700" },
  requestPreview: { fontSize: 13 },
  requestActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  acceptBtn:      { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  acceptBtnText:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  declineBtn:     { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  declineBtnText: { fontWeight: "600", fontSize: 13 },

  empty:        { alignItems: "center", paddingTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyIcon:    { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle:   { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptySub:     { fontSize: 14, textAlign: "center", lineHeight: 20 },
  newConvoBtn:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  newConvoBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
