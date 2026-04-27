import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PostCard, Post, ReactionType } from "@/components/feed/PostCard";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import { recordProfileView, fetchMutualConnections } from "@/services/api";
import { UserListModal, UserListType } from "@/components/profile/UserListModal";

const COVER_HEIGHT = 130;
const AVATAR_SIZE  = 86;
const AVATAR_BORDER = 4;

const FALLBACK_USER = {
  id: "", full_name: "Usuário", username: "usuario",
  headline: "", bio: "", location: "",
  avatar_url: null as string | null,
  plan: "gratuito", profile_type: "pessoa",
  followers_count: 0, following_count: 0, connections_count: 0,
  areas_of_expertise: [] as string[], certifications: [] as string[],
};

export default function PublicProfileScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const { user: currentUser, activeCompany } = useAuth();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();

  const [userProfile, setUserProfile] = useState<typeof FALLBACK_USER>(FALLBACK_USER);
  const [userPosts, setUserPosts]     = useState<Post[]>([]);
  const [wineEntries, setWineEntries] = useState<API.WineEntry[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"none"|"pending"|"connected">("none");
  const [loading, setLoading]         = useState(true);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [tab, setTab]                 = useState<"posts"|"adega">("posts");
  const [mutuals, setMutuals]         = useState<{ id: string; full_name: string; avatar_url: string | null }[]>([]);
  const [resolvedId, setResolvedId]   = useState<string>(id ?? "");
  const [userListModal, setUserListModal] = useState<UserListType | null>(null);
  const [selectedWine, setSelectedWine]   = useState<API.WineEntry | null>(null);
  const [showReportModal,  setShowReportModal]  = useState(false);
  const [reportReason,     setReportReason]     = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);

  const topPad   = insets.top;
  const bottomPad = insets.bottom;
  const navyBg   = (colors as any).navyLight ?? colors.navy;

  /* ── Data ── */
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const real = await API.fetchPublicProfile(id);
    const rid: string = (real as any)?.id ?? (API.isValidUUID(id) ? id : "");
    const isOwn = !!rid && currentUser?.id === rid;

    const [following, connStatus, posts, wines, mutual, liveStats] = rid
      ? await Promise.all([
          currentUser?.id ? API.checkIsFollowing(rid, currentUser.id)       : Promise.resolve(false),
          currentUser?.id ? API.checkConnectionStatus(rid, currentUser.id)  : Promise.resolve("none" as const),
          currentUser?.id ? API.fetchProfilePosts(rid, currentUser.id)       : Promise.resolve([]),
          isOwn ? API.fetchWineCellar(rid) : API.fetchPublicWineCellar(rid),
          currentUser?.id && !isOwn ? fetchMutualConnections(currentUser.id, rid) : Promise.resolve([]),
          API.fetchProfileStats(rid),
        ])
      : [false, "none" as const, [], [], [], { connections: 0, followers: 0, following: 0 }];

    if (real) setUserProfile({
      ...FALLBACK_USER,
      ...real,
      connections_count: (liveStats as any).connections,
      followers_count:   (liveStats as any).followers,
      following_count:   (liveStats as any).following,
    });
    setResolvedId(rid);
    setIsFollowing(following);
    setConnectionStatus(connStatus);
    setUserPosts(posts);
    setWineEntries(wines);
    setMutuals(mutual);
    setLoading(false);
    if (currentUser?.id && !isOwn) recordProfileView(currentUser.id, rid);
  }, [id, currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!currentUser?.id || !resolvedId || resolvedId === currentUser.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const channelName = `connection-status-${currentUser.id}-${resolvedId}_${uid}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `requester_id=eq.${currentUser.id}` },
        async () => { const status = await API.checkConnectionStatus(resolvedId, currentUser.id!); setConnectionStatus(status); })
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `receiver_id=eq.${currentUser.id}` },
        async () => { const status = await API.checkConnectionStatus(resolvedId, currentUser.id!); setConnectionStatus(status); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, resolvedId]);

  const isCompany    = (userProfile as any).profile_type === "empresa";
  const isOwnProfile = currentUser?.id === resolvedId;
  const tab2Label    = isCompany ? "Portifólio" : "Adega";

  const REPORT_REASONS = ["Spam", "Conteúdo ofensivo", "Informação falsa", "Assédio", "Perfil falso", "Outro"];

  const handleShowUserMenu = () => {
    if (!currentUser?.id || isOwnProfile) return;
    Alert.alert(
      userProfile.full_name,
      "O que deseja fazer?",
      [
        { text: "Denunciar usuário", onPress: () => { setReportReason(""); setShowReportModal(true); } },
        {
          text: "Bloquear usuário", style: "destructive",
          onPress: () => Alert.alert(
            "Bloquear usuário",
            `Tem certeza que deseja bloquear ${userProfile.full_name}?`,
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Bloquear", style: "destructive", onPress: async () => {
                if (!currentUser?.id || !resolvedId) return;
                const ok = await API.blockUser(currentUser.id, resolvedId);
                if (!ok) { Alert.alert("Erro", "Não foi possível bloquear. Tente novamente."); return; }
                Alert.alert("Usuário bloqueado", `${userProfile.full_name} foi bloqueado(a).`);
                router.back();
              }},
            ]
          ),
        },
        { text: "Cancelar", style: "cancel" },
      ]
    );
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !currentUser?.id || !resolvedId) return;
    setReportSubmitting(true);
    const ok = await API.createReport({ reported_user_id: resolvedId, reported_by: currentUser.id, reason: reportReason });
    setReportSubmitting(false);
    setShowReportModal(false);
    setReportReason("");
    if (ok) Alert.alert("Denúncia enviada", "Obrigado! Nossa equipe irá revisar.");
    else Alert.alert("Erro", "Não foi possível enviar a denúncia.");
  };

  /* ── Actions ── */
  const handleFollow = async () => {
    if (!currentUser?.id || !id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setUserProfile(p => ({ ...p, followers_count: p.followers_count + (next ? 1 : -1) }));
    await API.toggleFollow(id, currentUser.id, isFollowing);
  };

  const handleConnect = async () => {
    if (!currentUser?.id || !id || connectionStatus !== "none") return;
    setConnectionStatus("pending");
    if (!isFollowing) {
      setIsFollowing(true);
      setUserProfile(p => ({ ...p, followers_count: p.followers_count + 1 }));
      await API.toggleFollow(id, currentUser.id, false);
    }
    await API.sendConnectionRequest(id, currentUser.id);
  };

  const canMessage      = isCompany ? true : connectionStatus === "connected" || isFollowing;
  const messagePending  = !isCompany && connectionStatus !== "connected" && isFollowing;

  const handleMessage = async () => {
    if (!currentUser?.id || !id || !canMessage || messagingLoading) return;
    setMessagingLoading(true);
    const cid = await API.getOrCreateDirectConversation(currentUser.id, id, false, null);
    setMessagingLoading(false);
    if (cid) router.push(`/chat/${cid}` as any);
  };

  const handleLike = async (postId: string) => {
    if (likingPostId) return;
    const post = userPosts.find(p => p.id === postId);
    if (!post || !currentUser?.id) return;
    const wasLiked = post.is_liked ?? false;
    const prevCount = post.likes_count;
    setLikingPostId(postId);
    setUserPosts(prev => prev.map(p => p.id === postId
      ? { ...p, is_liked: !wasLiked, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 }
      : p));
    try {
      const ok = await API.toggleLike(postId, currentUser.id, wasLiked);
      if (!ok) setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: wasLiked, likes_count: prevCount } : p));
    } catch {
      setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: wasLiked, likes_count: prevCount } : p));
    } finally {
      setLikingPostId(null);
    }
  };

  const handleReact = async (postId: string, reaction: ReactionType) => {
    if (!currentUser?.id) return;
    const post = userPosts.find(p => p.id === postId);
    if (!post) return;
    const sameReaction = post.reaction_type === reaction;
    const wasLiked = post.is_liked ?? false;
    setUserPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      reaction_type: sameReaction ? null : reaction,
      is_liked: !sameReaction,
      likes_count: sameReaction ? Math.max(0, p.likes_count - 1) : (wasLiked ? p.likes_count : p.likes_count + 1),
    } : p));
    try {
      await API.toggleReaction(postId, currentUser.id, reaction, post.reaction_type ?? null);
    } catch {}
  };

  const handleBookmark = (postId: string) => {
    const post = userPosts.find(p => p.id === postId);
    if (!post || !currentUser?.id) return;
    setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, is_bookmarked: !p.is_bookmarked } : p));
    API.toggleBookmark(postId, currentUser.id, post.is_bookmarked ?? false);
  };

  const connectLabel    = connectionStatus === "connected" ? "Conectado" : connectionStatus === "pending" ? "Pendente" : "Conectar";
  const connectDisabled = connectionStatus !== "none";

  /* ────────────────────────────────────────────────────────────
     PROFILE HEADER — used as FlatList ListHeaderComponent
  ──────────────────────────────────────────────────────────── */
  const ProfileHeader = useCallback(() => (
    <View>
      {/* Cover banner */}
      <View style={[styles.cover, { backgroundColor: navyBg, height: COVER_HEIGHT }]}>
        <View style={[styles.circle1, { backgroundColor: "rgba(201,168,76,0.13)" }]} />
        <View style={[styles.circle2, { backgroundColor: "rgba(201,168,76,0.07)" }]} />
        <View style={[styles.goldLine, { backgroundColor: colors.gold }]} />
      </View>

      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

        <View style={styles.avatarRow}>
          <View style={[styles.avatarRing, { borderColor: colors.card, backgroundColor: colors.card }]}>
            <Avatar uri={userProfile.avatar_url} name={userProfile.full_name} size={AVATAR_SIZE} />
          </View>
          {userProfile.plan && !["gratuito", "basico"].includes(userProfile.plan) && (
            <View style={[styles.planPill, { backgroundColor: colors.gold }]}>
              <Feather name="award" size={11} color={colors.navy} />
              <Text style={[styles.planText, { color: colors.navy }]}>{userProfile.plan.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.name, { color: colors.foreground }]}>{userProfile.full_name}</Text>
        {!!userProfile.username && <Text style={[styles.username, { color: colors.mutedForeground }]}>@{userProfile.username}</Text>}
        {!!userProfile.headline && <Text style={[styles.headline, { color: colors.mutedForeground }]}>{userProfile.headline}</Text>}
        {!!(userProfile as any).location && (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{(userProfile as any).location}</Text>
          </View>
        )}
        {!!userProfile.bio && <Text style={[styles.bio, { color: colors.foreground }]}>{userProfile.bio}</Text>}

        {/* Stats */}
        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          {[
            { n: userProfile.connections_count, l: "Conexões",   type: "connections" as UserListType },
            { n: userProfile.followers_count,   l: "Seguidores", type: "followers" as UserListType },
            { n: userProfile.following_count,   l: "Seguindo",   type: "following" as UserListType },
          ].map((s, i, arr) => (
            <React.Fragment key={s.l}>
              <TouchableOpacity style={styles.stat} onPress={() => setUserListModal(s.type)} activeOpacity={0.7}>
                <Text style={[styles.statNum, { color: colors.foreground }]}>{fmtN(s.n)}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.l}</Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={[styles.statDiv, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Action buttons */}
        {!isOwnProfile && (
          <View style={styles.actionRow}>
            {isCompany ? (
              <>
                <TouchableOpacity
                  style={[styles.pill, { backgroundColor: isFollowing ? "transparent" : navyBg, borderColor: navyBg, flex: 1 }]}
                  onPress={handleFollow} activeOpacity={0.82}
                >
                  <Feather name={isFollowing ? "check" : "plus"} size={15} color={isFollowing ? navyBg : "#fff"} />
                  <Text style={[styles.pillText, { color: isFollowing ? navyBg : "#fff" }]}>{isFollowing ? "Seguindo" : "Seguir"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconPill, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={handleMessage} activeOpacity={0.82}>
                  <Feather name="message-circle" size={19} color={colors.foreground} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                {connectionStatus !== "connected" && (
                  <TouchableOpacity
                    style={[styles.pill, { backgroundColor: connectDisabled ? "transparent" : colors.gold, borderColor: connectDisabled ? colors.border : colors.gold, flex: 1, opacity: connectDisabled ? 0.75 : 1 }]}
                    onPress={handleConnect} disabled={connectDisabled} activeOpacity={0.82}
                  >
                    <Feather name={connectionStatus === "pending" ? "clock" : "user-plus"} size={15} color={connectDisabled ? colors.mutedForeground : colors.navy} />
                    <Text style={[styles.pillText, { color: connectDisabled ? colors.mutedForeground : colors.navy }]}>{connectLabel}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.pill, { backgroundColor: isFollowing ? "transparent" : navyBg, borderColor: isFollowing ? colors.border : navyBg, flex: 1 }]}
                  onPress={handleFollow} activeOpacity={0.82}
                >
                  <Feather name={isFollowing ? "check" : "plus"} size={15} color={isFollowing ? navyBg : "#fff"} />
                  <Text style={[styles.pillText, { color: isFollowing ? navyBg : "#fff" }]}>{isFollowing ? "Seguindo" : "Seguir"}</Text>
                </TouchableOpacity>
                {canMessage && (
                  <TouchableOpacity
                    style={[styles.iconPill, { borderColor: messagePending ? colors.gold : colors.border, backgroundColor: colors.background }]}
                    onPress={handleMessage} activeOpacity={0.82}
                  >
                    <Feather name="message-circle" size={19} color={messagePending ? colors.gold : colors.foreground} />
                    {messagePending && <View style={[styles.dot, { backgroundColor: colors.gold }]} />}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* Tags */}
        {(userProfile.areas_of_expertise ?? []).length > 0 && (
          <View style={styles.tags}>
            {(userProfile.areas_of_expertise ?? []).map(a => <Badge key={a} label={a} variant="gold" />)}
          </View>
        )}
        {Array.isArray(userProfile.certifications) && userProfile.certifications.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#7a8494", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Certificações</Text>
            <View style={styles.tags}>
              {userProfile.certifications.map((cert: string) => <Badge key={cert} label={cert} variant="navy" />)}
            </View>
          </View>
        )}
      </View>

      {/* Mutual connections */}
      {mutuals.length > 0 && (
        <View style={[styles.mutualRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.mutualAvatars}>
            {mutuals.slice(0, 3).map((mc, i) => (
              <View key={mc.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar uri={mc.avatar_url} name={mc.full_name} size={24} />
              </View>
            ))}
          </View>
          <Text style={[styles.mutualText, { color: colors.mutedForeground }]}>
            {mutuals.length === 1 ? `${mutuals[0].full_name} é conexão em comum` : `${mutuals[0].full_name} e mais ${mutuals.length - 1} em comum`}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {(["posts", "adega"] as const).map(t => (
          <Pressable key={t} style={[styles.tab, tab === t && { borderBottomColor: colors.gold }]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, { color: tab === t ? colors.gold : colors.mutedForeground }]}>
              {t === "posts" ? "Posts" : tab2Label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Adega / Portfolio — rendered inline in header when on adega tab */}
      {tab === "adega" && !isCompany && (
        <View style={{ paddingBottom: 24 }}>
          {isOwnProfile && (
            <TouchableOpacity
              style={[styles.cellarBtn, { backgroundColor: colors.gold }]}
              onPress={() => router.push("/wine-cellar" as any)}
            >
              <Feather name="plus" size={15} color={colors.navy} />
              <Text style={[styles.cellarBtnText, { color: colors.navy }]}>Gerenciar minha adega</Text>
            </TouchableOpacity>
          )}
          {wineEntries.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="package" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isOwnProfile ? "Sua adega está vazia" : "Nenhum vinho público"}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 12, rowGap: 10 }}>
              {wineEntries.map(w => (
                <TouchableOpacity key={w.id} activeOpacity={0.8} onPress={() => setSelectedWine(w)}
                  style={[styles.wineCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.wineName, { color: colors.foreground }]}>{w.name}</Text>
                      {w.producer && <Text style={[styles.wineSub, { color: colors.mutedForeground }]}>{w.producer}{w.vintage ? ` · ${w.vintage}` : ""}</Text>}
                    </View>
                    <View style={[styles.wineStatus, { backgroundColor: colors.gold + "18" }]}>
                      <Text style={[styles.wineStatusTxt, { color: colors.gold }]}>
                        {w.status === "adega" ? "Na Adega" : w.status === "consumido" ? "Consumido" : w.status === "presenteado" ? "Presenteado" : "Wishlist"}
                      </Text>
                    </View>
                  </View>
                  {w.region && <Text style={[styles.wineSub, { color: colors.mutedForeground }]}>{w.region}{w.country ? `, ${w.country}` : ""}</Text>}
                  {w.rating > 0 && (
                    <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                      {[1,2,3,4,5].map(s => <Feather key={s} name="star" size={12} color={s <= w.rating ? colors.gold : colors.border} />)}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {tab === "adega" && isCompany && (
        <View style={styles.empty}>
          <Feather name="briefcase" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Portifólio ainda vazio</Text>
        </View>
      )}

      {/* Empty state for posts tab */}
      {tab === "posts" && !loading && userPosts.length === 0 && (
        <View style={styles.empty}>
          <Feather name="grid" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma publicação ainda</Text>
        </View>
      )}
    </View>
  ), [userProfile, isFollowing, connectionStatus, tab, mutuals, wineEntries, isOwnProfile, isCompany, loading, colors, navyBg]);

  /* ── Loading ── */
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.fixedBar, { paddingTop: topPad, backgroundColor: navyBg }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Fixed nav bar */}
      <View style={[styles.fixedBar, { paddingTop: topPad, backgroundColor: navyBg }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerName, { color: "#fff" }]} numberOfLines={1}>{userProfile.full_name}</Text>
        {!isOwnProfile ? (
          <TouchableOpacity style={styles.backBtn} onPress={handleShowUserMenu} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <Feather name="more-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* ── Main feed via FlatList ── */}
      <FlatList
        data={tab === "posts" ? userPosts : []}
        keyExtractor={item => item.id}
        ListHeaderComponent={<ProfileHeader />}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={currentUser?.id ?? null}
            isLiking={likingPostId === item.id}
            onLike={handleLike}
            onReact={handleReact}
            onBookmark={handleBookmark}
            onComment={pid => router.push(`/post/${pid}` as any)}
          />
        )}
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      />

      {/* Modals */}
      <UserListModal
        visible={userListModal !== null}
        type={userListModal}
        userId={resolvedId || null}
        onClose={() => setUserListModal(null)}
      />

      {/* Report User Modal */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }} onPress={() => setShowReportModal(false)}>
          <Pressable style={{ backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 40 }} onPress={() => {}}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: colors.navy, marginBottom: 4 }}>Denunciar usuário</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 18 }}>Selecione o motivo da denúncia.</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: reportReason === reason ? colors.gold + "18" : colors.background, borderWidth: 1.5, borderColor: reportReason === reason ? colors.gold : colors.border }}
                onPress={() => setReportReason(reason)}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: reportReason === reason ? colors.gold : colors.foreground }}>{reason}</Text>
                {reportReason === reason && <Feather name="check" size={18} color={colors.gold} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={{ marginTop: 8, backgroundColor: reportReason ? colors.navy : colors.border, borderRadius: 12, paddingVertical: 15, alignItems: "center", opacity: reportSubmitting ? 0.6 : 1 }}
              onPress={handleSubmitReport}
              disabled={!reportReason || reportSubmitting}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{reportSubmitting ? "Enviando..." : "Enviar Denúncia"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Wine Detail Modal */}
      <Modal visible={selectedWine !== null} transparent animationType="slide" onRequestClose={() => setSelectedWine(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={[styles.wineModal, { backgroundColor: colors.background }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialCommunityIcons name="glass-wine" size={18} color={colors.gold} />
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Detalhes do Vinho</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedWine(null)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {selectedWine && (
              <View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>{selectedWine.name}</Text>
                <View style={[styles.wineStatus, { backgroundColor: colors.gold + "20", alignSelf: "flex-start", marginBottom: 12 }]}>
                  <Text style={[styles.wineStatusTxt, { color: colors.gold }]}>
                    {selectedWine.status === "adega" ? "Na Adega" : selectedWine.status === "consumido" ? "Consumido" : selectedWine.status === "presenteado" ? "Presenteado" : "Wishlist"}
                  </Text>
                </View>
                {selectedWine.producer && <Text style={{ fontSize: 15, color: colors.mutedForeground, marginBottom: 4 }}>{selectedWine.producer}{selectedWine.vintage ? ` · ${selectedWine.vintage}` : ""}</Text>}
                {selectedWine.region && <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 8 }}>{selectedWine.region}{selectedWine.country ? `, ${selectedWine.country}` : ""}</Text>}
                {selectedWine.rating > 0 && (
                  <View style={{ flexDirection: "row", gap: 4, marginBottom: 12 }}>
                    {[1,2,3,4,5].map(s => <Feather key={s} name="star" size={18} color={s <= selectedWine.rating ? colors.gold : colors.border} />)}
                  </View>
                )}
                {selectedWine.notes && <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 21 }}>{selectedWine.notes}</Text>}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function fmtN(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  container:    { flex: 1 },

  fixedBar:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 10, zIndex: 10 },
  backBtn:      { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  headerName:   { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", paddingHorizontal: 8 },

  cover:        { overflow: "hidden" },
  circle1:      { position: "absolute", width: 280, height: 280, borderRadius: 140, top: -100, right: -60 },
  circle2:      { position: "absolute", width: 180, height: 180, borderRadius: 90, bottom: -50, left: -30 },
  goldLine:     { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, opacity: 0.6 },

  profileCard:  { paddingHorizontal: 16, paddingBottom: 18, rowGap: 8, borderBottomWidth: 1 },
  avatarRow:    { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -(AVATAR_SIZE / 2 + AVATAR_BORDER + 2) },
  avatarRing:   { borderRadius: AVATAR_SIZE / 2 + AVATAR_BORDER + 4, borderWidth: AVATAR_BORDER, width: AVATAR_SIZE + AVATAR_BORDER * 2 + 4, height: AVATAR_SIZE + AVATAR_BORDER * 2 + 4, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  planPill:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 6 },
  planText:     { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  name:         { fontSize: 22, fontWeight: "800", marginTop: 8 },
  username:     { fontSize: 13, fontWeight: "500", marginTop: -4 },
  headline:     { fontSize: 13 },
  metaRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText:     { fontSize: 12 },
  bio:          { fontSize: 14, lineHeight: 21 },

  statsRow:     { flexDirection: "row", alignItems: "center", paddingTop: 14, borderTopWidth: 1, marginTop: 4 },
  stat:         { flex: 1, alignItems: "center", rowGap: 2 },
  statNum:      { fontSize: 20, fontWeight: "800" },
  statLabel:    { fontSize: 11, fontWeight: "500" },
  statDiv:      { width: 1, height: 32 },

  actionRow:    { flexDirection: "row", gap: 8, alignItems: "center" },
  pill:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1.5 },
  pillText:     { fontSize: 14, fontWeight: "700" },
  iconPill:     { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  dot:          { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },

  tags:         { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  mutualRow:    { flexDirection: "row", alignItems: "center", gap: 10, margin: 14, borderWidth: 1, borderRadius: 12, padding: 12 },
  mutualAvatars:{ flexDirection: "row" },
  mutualText:   { flex: 1, fontSize: 12, fontWeight: "500" },

  tabRow:       { flexDirection: "row", borderBottomWidth: 1 },
  tab:          { flex: 1, alignItems: "center", paddingVertical: 13, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabText:      { fontSize: 14, fontWeight: "700" },

  empty:        { alignItems: "center", justifyContent: "center", paddingVertical: 60, rowGap: 12 },
  emptyText:    { fontSize: 15 },

  cellarBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, margin: 16, paddingVertical: 13, borderRadius: 14 },
  cellarBtnText:{ fontSize: 14, fontWeight: "700" },

  wineCard:     { borderRadius: 12, borderWidth: 1, padding: 14, rowGap: 6 },
  wineName:     { fontSize: 15, fontWeight: "700" },
  wineSub:      { fontSize: 12, marginTop: 1 },
  wineStatus:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  wineStatusTxt:{ fontSize: 11, fontWeight: "600" },
  wineModal:    { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 40 },
});
