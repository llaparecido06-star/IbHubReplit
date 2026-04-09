import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PostCard, Post } from "@/components/feed/PostCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import { recordProfileView, fetchMutualConnections } from "@/services/api";

const COVER_HEIGHT = 160;
const AVATAR_SIZE = 88;

const FALLBACK_USER = {
  id: "", full_name: "Usuário", username: "usuario",
  headline: "", bio: "", location: "",
  avatar_url: null as string | null,
  plan: "gratuito", profile_type: "pessoa",
  followers_count: 0, following_count: 0, connections_count: 0,
  areas_of_expertise: [] as string[], certifications: [] as string[],
};

export default function PublicProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [userProfile, setUserProfile] = useState<typeof FALLBACK_USER>(FALLBACK_USER);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [wineEntries, setWineEntries] = useState<API.WineEntry[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"none" | "pending" | "connected">("none");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "adega">("posts");
  const [mutualConnections, setMutualConnections] = useState<{ id: string; full_name: string; avatar_url: string | null }[]>([]);
  const [resolvedProfileId, setResolvedProfileId] = useState<string>(id ?? "");

  const topPad = Platform.OS === "ios" ? insets.top : Platform.OS === "web" ? 16 : insets.top;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const realProfile = await API.fetchPublicProfile(id);
    const resolvedId: string = (realProfile as any)?.id ?? id;
    const isOwn = currentUser?.id === resolvedId;

    const [followStatus, connStatus, posts, wines, mutual] = await Promise.all([
      currentUser?.id ? API.checkIsFollowing(resolvedId, currentUser.id) : Promise.resolve(false),
      currentUser?.id ? API.checkConnectionStatus(resolvedId, currentUser.id) : Promise.resolve("none" as const),
      currentUser?.id ? API.fetchProfilePosts(resolvedId, currentUser.id) : Promise.resolve([]),
      isOwn ? API.fetchWineCellar(resolvedId) : API.fetchPublicWineCellar(resolvedId),
      currentUser?.id && !isOwn ? fetchMutualConnections(currentUser.id, resolvedId) : Promise.resolve([]),
    ]);

    if (realProfile) setUserProfile({ ...FALLBACK_USER, ...realProfile });
    setResolvedProfileId(resolvedId);
    setIsFollowing(followStatus);
    setConnectionStatus(connStatus);
    setUserPosts(posts);
    setWineEntries(wines);
    setMutualConnections(mutual);
    setLoading(false);

    if (currentUser?.id && !isOwn) recordProfileView(currentUser.id, resolvedId);
  }, [id, currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  const isCompany    = (userProfile as any).profile_type === "empresa";
  const isOwnProfile = currentUser?.id === resolvedProfileId;
  const tab2Label    = isCompany ? "Portfólio" : "Adega";

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

  const canMessage = isCompany ? true : connectionStatus === "connected" || isFollowing;
  const messagePending = !isCompany && connectionStatus !== "connected" && isFollowing;

  const handleMessage = async () => {
    if (!currentUser?.id || !id || !canMessage) return;
    const conversationId = await API.getOrCreateDirectConversation(currentUser.id, id);
    if (conversationId) router.push(`/chat/${conversationId}` as any);
  };

  const handleLike = (postId: string) => {
    const post = userPosts.find(p => p.id === postId);
    if (!post || !currentUser?.id) return;
    setUserPosts(prev => prev.map(p => p.id === postId
      ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
      : p));
    API.toggleLike(postId, currentUser.id, post.is_liked ?? false);
  };

  const handleBookmark = (postId: string) => {
    const post = userPosts.find(p => p.id === postId);
    if (!post || !currentUser?.id) return;
    setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, is_bookmarked: !p.is_bookmarked } : p));
    API.toggleBookmark(postId, currentUser.id, post.is_bookmarked ?? false);
  };

  const connectLabel =
    connectionStatus === "connected" ? "Conectado"
    : connectionStatus === "pending" ? "Pendente"
    : "Conectar";
  const connectDisabled = connectionStatus !== "none";

  // Animated header background opacity on scroll
  const headerBg = scrollY.interpolate({
    inputRange: [COVER_HEIGHT - 80, COVER_HEIGHT - 20],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const navyColor = (colors as any).navyLight ?? colors.navy;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Fixed floating nav bar (back + name after scroll) ── */}
      <Animated.View
        style={[
          styles.floatingNav,
          {
            paddingTop: topPad,
            backgroundColor: scrollY.interpolate({
              inputRange: [COVER_HEIGHT - 80, COVER_HEIGHT - 20],
              outputRange: ["rgba(0,0,0,0)", navyColor],
              extrapolate: "clamp",
            }),
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Back button - always accessible */}
        <TouchableOpacity
          style={[styles.navBackBtn, { backgroundColor: "rgba(0,0,0,0.32)" }]}
          onPress={() => router.back()}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Name fades in on scroll */}
        <Animated.Text
          style={[styles.navTitle, { color: "#fff", opacity: headerBg }]}
          numberOfLines={1}
        >
          {userProfile.full_name}
        </Animated.Text>

        <View style={{ width: 44 }} />
      </Animated.View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* ── Cover ── */}
        <View style={[styles.cover, { backgroundColor: navyColor, height: COVER_HEIGHT + topPad }]}>
          {/* Decorative wine circle */}
          <View style={[styles.coverCircle1, { backgroundColor: "rgba(201,168,76,0.12)" }]} />
          <View style={[styles.coverCircle2, { backgroundColor: "rgba(201,168,76,0.08)" }]} />
          {/* Gold accent line */}
          <View style={[styles.coverAccent, { backgroundColor: colors.gold }]} />
        </View>

        {/* ── Profile card ── */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

          {/* Avatar row — overlaps cover */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatarRing, { borderColor: colors.card, backgroundColor: colors.card }]}>
              <Avatar uri={userProfile.avatar_url} name={userProfile.full_name} size={AVATAR_SIZE} />
            </View>

            {/* Plan badge top right */}
            {userProfile.plan && !["gratuito", "basico"].includes(userProfile.plan) && (
              <View style={[styles.planPill, { backgroundColor: colors.gold }]}>
                <Feather name="award" size={11} color={colors.navy} />
                <Text style={[styles.planPillText, { color: colors.navy }]}>
                  {userProfile.plan.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Name + username */}
          <Text style={[styles.name, { color: colors.foreground }]}>{userProfile.full_name}</Text>
          {!!userProfile.username && (
            <Text style={[styles.username, { color: colors.mutedForeground }]}>@{userProfile.username}</Text>
          )}

          {/* Headline */}
          {!!userProfile.headline && (
            <Text style={[styles.headline, { color: colors.mutedForeground }]}>{userProfile.headline}</Text>
          )}

          {/* Location */}
          {!!(userProfile as any).location && (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{(userProfile as any).location}</Text>
            </View>
          )}

          {/* Bio */}
          {!!userProfile.bio && (
            <Text style={[styles.bio, { color: colors.foreground }]}>{userProfile.bio}</Text>
          )}

          {/* ── Stats ── */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {fmtCount(userProfile.connections_count)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Conexões</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {fmtCount(userProfile.followers_count)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Seguidores</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {fmtCount(userProfile.following_count)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Seguindo</Text>
            </View>
          </View>

          {/* ── Action buttons ── */}
          {!isOwnProfile && (
            <View style={styles.actionRow}>
              {isCompany ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: isFollowing ? colors.background : colors.navy, borderColor: colors.navy, flex: 1 },
                    ]}
                    onPress={handleFollow}
                    activeOpacity={0.82}
                  >
                    <Feather name={isFollowing ? "check" : "plus"} size={15} color={isFollowing ? colors.navy : "#fff"} />
                    <Text style={[styles.actionBtnText, { color: isFollowing ? colors.navy : "#fff" }]}>
                      {isFollowing ? "Seguindo" : "Seguir"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={handleMessage}
                    activeOpacity={0.82}
                  >
                    <Feather name="message-circle" size={19} color={colors.foreground} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {connectionStatus !== "connected" && (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: connectDisabled ? colors.background : colors.gold,
                          borderColor: connectDisabled ? colors.border : colors.gold,
                          flex: 1,
                          opacity: connectDisabled ? 0.7 : 1,
                        },
                      ]}
                      onPress={handleConnect}
                      disabled={connectDisabled}
                      activeOpacity={0.82}
                    >
                      <Feather
                        name={connectionStatus === "pending" ? "clock" : "user-plus"}
                        size={15}
                        color={connectDisabled ? colors.mutedForeground : colors.navy}
                      />
                      <Text style={[styles.actionBtnText, { color: connectDisabled ? colors.mutedForeground : colors.navy }]}>
                        {connectLabel}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: isFollowing ? colors.background : colors.navy,
                        borderColor: isFollowing ? colors.border : colors.navy,
                        flex: 1,
                      },
                    ]}
                    onPress={handleFollow}
                    activeOpacity={0.82}
                  >
                    <Feather name={isFollowing ? "check" : "plus"} size={15} color={isFollowing ? colors.navy : "#fff"} />
                    <Text style={[styles.actionBtnText, { color: isFollowing ? colors.navy : "#fff" }]}>
                      {isFollowing ? "Seguindo" : "Seguir"}
                    </Text>
                  </TouchableOpacity>

                  {canMessage && (
                    <TouchableOpacity
                      style={[
                        styles.iconBtn,
                        {
                          backgroundColor: colors.background,
                          borderColor: messagePending ? colors.gold : colors.border,
                        },
                      ]}
                      onPress={handleMessage}
                      activeOpacity={0.82}
                    >
                      <Feather name="message-circle" size={19} color={messagePending ? colors.gold : colors.foreground} />
                      {messagePending && (
                        <View style={[styles.pendingDot, { backgroundColor: colors.gold }]} />
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {/* Áreas de expertise */}
          {(userProfile.areas_of_expertise ?? []).length > 0 && (
            <View style={styles.tags}>
              {(userProfile.areas_of_expertise ?? []).map((area) => (
                <Badge key={area} label={area} variant="gold" />
              ))}
            </View>
          )}
        </View>

        {/* ── Mutual connections ── */}
        {mutualConnections.length > 0 && (
          <View style={[styles.mutualRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={styles.mutualAvatars}>
              {mutualConnections.slice(0, 3).map((mc, i) => (
                <View key={mc.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar uri={mc.avatar_url} name={mc.full_name} size={24} />
                </View>
              ))}
            </View>
            <Text style={[styles.mutualText, { color: colors.mutedForeground }]}>
              {mutualConnections.length === 1
                ? `${mutualConnections[0].full_name} é conexão em comum`
                : `${mutualConnections[0].full_name} e mais ${mutualConnections.length - 1} em comum`}
            </Text>
          </View>
        )}

        {/* ── Tabs ── */}
        <View style={[styles.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          {(["posts", "adega"] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && { borderBottomColor: colors.gold }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, { color: tab === t ? colors.gold : colors.mutedForeground }]}>
                {t === "posts" ? "Posts" : tab2Label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Posts ── */}
        {tab === "posts" && (
          userPosts.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="grid" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma publicação ainda</Text>
            </View>
          ) : (
            userPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onComment={(pid) => router.push(`/post/${pid}` as any)}
              />
            ))
          )
        )}

        {/* ── Adega ── */}
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
              <View style={{ padding: 16, rowGap: 10 }}>
                {wineEntries.map((w) => (
                  <View key={w.id} style={[styles.wineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.wineName, { color: colors.foreground }]}>{w.name}</Text>
                        {w.producer && (
                          <Text style={[styles.wineSub, { color: colors.mutedForeground }]}>
                            {w.producer}{w.vintage ? ` · ${w.vintage}` : ""}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.wineStatusBadge, { backgroundColor: colors.gold + "18" }]}>
                        <Text style={[styles.wineStatusText, { color: colors.gold }]}>
                          {w.status === "adega" ? "Na Adega"
                            : w.status === "consumido" ? "Consumido"
                            : w.status === "presenteado" ? "Presenteado"
                            : "Wishlist"}
                        </Text>
                      </View>
                    </View>
                    {w.region && (
                      <Text style={[styles.wineSub, { color: colors.mutedForeground }]}>
                        {w.region}{w.country ? `, ${w.country}` : ""}
                      </Text>
                    )}
                    {w.rating > 0 && (
                      <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Feather key={s} name="star" size={12} color={s <= w.rating ? colors.gold : colors.border} />
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === "adega" && isCompany && (
          <View style={styles.empty}>
            <Feather name="briefcase" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Portfólio ainda vazio</Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const AVATAR_BORDER = 4;

const styles = StyleSheet.create({
  container:      { flex: 1 },

  /* Floating nav */
  floatingNav:    {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 10,
  },
  navBackBtn:     {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  navTitle:       { fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },

  /* Cover */
  cover:          { overflow: "hidden", justifyContent: "flex-end" },
  coverCircle1:   { position: "absolute", width: 320, height: 320, borderRadius: 160, top: -120, right: -80 },
  coverCircle2:   { position: "absolute", width: 200, height: 200, borderRadius: 100, bottom: -60, left: -40 },
  coverAccent:    { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, opacity: 0.7 },

  /* Profile card */
  profileCard:    { paddingHorizontal: 16, paddingBottom: 20, rowGap: 8, borderBottomWidth: 1 },
  avatarRow:      {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    marginTop: -(AVATAR_SIZE / 2 + AVATAR_BORDER),
    paddingTop: 0,
  },
  avatarRing:     {
    borderRadius: (AVATAR_SIZE / 2) + AVATAR_BORDER + 2,
    borderWidth: AVATAR_BORDER,
    width: AVATAR_SIZE + AVATAR_BORDER * 2,
    height: AVATAR_SIZE + AVATAR_BORDER * 2,
    overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  planPill:       {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 6,
  },
  planPillText:   { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  name:           { fontSize: 22, fontWeight: "800", marginTop: 10 },
  username:       { fontSize: 13, fontWeight: "500", marginTop: -4 },
  headline:       { fontSize: 13 },
  metaRow:        { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText:       { fontSize: 12 },
  bio:            { fontSize: 14, lineHeight: 22 },

  /* Stats */
  statsRow:       {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, marginTop: 4, paddingTop: 14, paddingBottom: 4,
  },
  stat:           { flex: 1, alignItems: "center", rowGap: 2 },
  statNum:        { fontSize: 20, fontWeight: "800" },
  statLabel:      { fontSize: 11, fontWeight: "500" },
  statDiv:        { width: 1, height: 34 },

  /* Action buttons */
  actionRow:      { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 },
  actionBtn:      {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1.5,
  },
  actionBtnText:  { fontSize: 14, fontWeight: "700" },
  iconBtn:        {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  pendingDot:     { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },

  tags:           { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  /* Mutual */
  mutualRow:      {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginVertical: 10,
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  mutualAvatars:  { flexDirection: "row" },
  mutualText:     { flex: 1, fontSize: 12, fontWeight: "500" },

  /* Tabs */
  tabRow:         { flexDirection: "row", borderBottomWidth: 1 },
  tab:            {
    flex: 1, alignItems: "center", paddingVertical: 13,
    borderBottomWidth: 2.5, borderBottomColor: "transparent",
  },
  tabText:        { fontSize: 14, fontWeight: "700" },

  /* Empty */
  empty:          { alignItems: "center", justifyContent: "center", paddingVertical: 60, rowGap: 12 },
  emptyText:      { fontSize: 15 },

  /* Cellar */
  cellarBtn:      {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, margin: 16, paddingVertical: 13, borderRadius: 14,
  },
  cellarBtnText:  { fontSize: 14, fontWeight: "700" },

  /* Wine card */
  wineCard:       { borderRadius: 12, borderWidth: 1, padding: 14, rowGap: 6 },
  wineName:       { fontSize: 15, fontWeight: "700" },
  wineSub:        { fontSize: 12, marginTop: 1 },
  wineStatusBadge:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  wineStatusText: { fontSize: 11, fontWeight: "600" },
});
