import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
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
  const { user: currentUser } = useAuth();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();

  const [userProfile, setUserProfile] = useState<typeof FALLBACK_USER>(FALLBACK_USER);
  const [userPosts, setUserPosts]     = useState<Post[]>([]);
  const [wineEntries, setWineEntries] = useState<API.WineEntry[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"none"|"pending"|"connected">("none");
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"posts"|"adega">("posts");
  const [mutuals, setMutuals]         = useState<{ id: string; full_name: string; avatar_url: string | null }[]>([]);
  const [resolvedId, setResolvedId]   = useState<string>(id ?? "");

  const topPad   = insets.top;
  const navyBg   = (colors as any).navyLight ?? colors.navy;

  /* ── Data ── */
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const real = await API.fetchPublicProfile(id);
    // real.id is always a UUID; if profile not found, fall back to id only if it's a UUID
    const rid: string = (real as any)?.id ?? (API.isValidUUID(id) ? id : "");
    const isOwn = !!rid && currentUser?.id === rid;

    // Only run UUID-dependent queries when we have a valid UUID
    const [following, connStatus, posts, wines, mutual] = rid
      ? await Promise.all([
          currentUser?.id ? API.checkIsFollowing(rid, currentUser.id)       : Promise.resolve(false),
          currentUser?.id ? API.checkConnectionStatus(rid, currentUser.id)  : Promise.resolve("none" as const),
          currentUser?.id ? API.fetchProfilePosts(rid, currentUser.id)       : Promise.resolve([]),
          isOwn ? API.fetchWineCellar(rid) : API.fetchPublicWineCellar(rid),
          currentUser?.id && !isOwn ? fetchMutualConnections(currentUser.id, rid) : Promise.resolve([]),
        ])
      : [false, "none" as const, [], [], []];

    if (real) setUserProfile({ ...FALLBACK_USER, ...real });
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

  const isCompany    = (userProfile as any).profile_type === "empresa";
  const isOwnProfile = currentUser?.id === resolvedId;
  const tab2Label    = isCompany ? "Portfólio" : "Adega";

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
    if (!currentUser?.id || !id || !canMessage) return;
    const cid = await API.getOrCreateDirectConversation(currentUser.id, id);
    if (cid) router.push(`/chat/${cid}` as any);
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

  const connectLabel   = connectionStatus === "connected" ? "Conectado" : connectionStatus === "pending" ? "Pendente" : "Conectar";
  const connectDisabled = connectionStatus !== "none";

  /* ── Loading ── */
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Fixed back button even on loading */}
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

      {/* ══════════════════════════════════════════════════════════
          FIXED HEADER — outside ScrollView, always on screen
          ══════════════════════════════════════════════════════════ */}
      <View style={[styles.fixedBar, { paddingTop: topPad, backgroundColor: navyBg }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={[styles.headerName, { color: "#fff" }]} numberOfLines={1}>
          {userProfile.full_name}
        </Text>

        <View style={{ width: 44 }} />
      </View>

      {/* ══════════════════════════════════════════════════════════
          SCROLLABLE CONTENT
          ══════════════════════════════════════════════════════════ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Cover banner (decorative, below fixed header) ── */}
        <View style={[styles.cover, { backgroundColor: navyBg, height: COVER_HEIGHT }]}>
          <View style={[styles.circle1, { backgroundColor: "rgba(201,168,76,0.13)" }]} />
          <View style={[styles.circle2, { backgroundColor: "rgba(201,168,76,0.07)" }]} />
          <View style={[styles.goldLine, { backgroundColor: colors.gold }]} />
        </View>

        {/* ── Profile card ── */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

          {/* Avatar row — overlaps cover */}
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

          {/* Name */}
          <Text style={[styles.name, { color: colors.foreground }]}>{userProfile.full_name}</Text>

          {/* Username */}
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

          {/* Stats */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            {[
              { n: userProfile.connections_count, l: "Conexões" },
              { n: userProfile.followers_count,   l: "Seguidores" },
              { n: userProfile.following_count,   l: "Seguindo" },
            ].map((s, i, arr) => (
              <React.Fragment key={s.l}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.foreground }]}>{fmtN(s.n)}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.l}</Text>
                </View>
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
              {mutuals.length === 1
                ? `${mutuals[0].full_name} é conexão em comum`
                : `${mutuals[0].full_name} e mais ${mutuals.length - 1} em comum`}
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

        {/* Posts */}
        {tab === "posts" && (
          userPosts.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="grid" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma publicação ainda</Text>
            </View>
          ) : (
            userPosts.map(post => (
              <PostCard
                key={post.id} post={post}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onComment={pid => router.push(`/post/${pid}` as any)}
              />
            ))
          )
        )}

        {/* Adega */}
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
                {wineEntries.map(w => (
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
                      <View style={[styles.wineStatus, { backgroundColor: colors.gold + "18" }]}>
                        <Text style={[styles.wineStatusTxt, { color: colors.gold }]}>
                          {w.status === "adega" ? "Na Adega" : w.status === "consumido" ? "Consumido" : w.status === "presenteado" ? "Presenteado" : "Wishlist"}
                        </Text>
                      </View>
                    </View>
                    {w.region && (
                      <Text style={[styles.wineSub, { color: colors.mutedForeground }]}>{w.region}{w.country ? `, ${w.country}` : ""}</Text>
                    )}
                    {w.rating > 0 && (
                      <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                        {[1,2,3,4,5].map(s => <Feather key={s} name="star" size={12} color={s <= w.rating ? colors.gold : colors.border} />)}
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
      </ScrollView>
    </View>
  );
}

function fmtN(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  container:    { flex: 1 },

  /* Fixed nav bar (outside ScrollView) */
  fixedBar:     {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingBottom: 10,
    zIndex: 10,
  },
  backBtn:      {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  headerName:   { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", paddingHorizontal: 8 },

  /* Cover */
  cover:        { overflow: "hidden" },
  circle1:      { position: "absolute", width: 280, height: 280, borderRadius: 140, top: -100, right: -60 },
  circle2:      { position: "absolute", width: 180, height: 180, borderRadius: 90, bottom: -50, left: -30 },
  goldLine:     { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, opacity: 0.6 },

  /* Profile card */
  profileCard:  { paddingHorizontal: 16, paddingBottom: 18, rowGap: 8, borderBottomWidth: 1 },
  avatarRow:    {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    marginTop: -(AVATAR_SIZE / 2 + AVATAR_BORDER + 2),
  },
  avatarRing:   {
    borderRadius: AVATAR_SIZE / 2 + AVATAR_BORDER + 4,
    borderWidth: AVATAR_BORDER,
    width: AVATAR_SIZE + AVATAR_BORDER * 2 + 4,
    height: AVATAR_SIZE + AVATAR_BORDER * 2 + 4,
    overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  planPill:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 6 },
  planText:     { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  name:         { fontSize: 22, fontWeight: "800", marginTop: 8 },
  username:     { fontSize: 13, fontWeight: "500", marginTop: -4, color: "#666" },
  headline:     { fontSize: 13 },
  metaRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText:     { fontSize: 12 },
  bio:          { fontSize: 14, lineHeight: 21 },

  /* Stats */
  statsRow:     { flexDirection: "row", alignItems: "center", paddingTop: 14, borderTopWidth: 1, marginTop: 4 },
  stat:         { flex: 1, alignItems: "center", rowGap: 2 },
  statNum:      { fontSize: 20, fontWeight: "800" },
  statLabel:    { fontSize: 11, fontWeight: "500" },
  statDiv:      { width: 1, height: 32 },

  /* Action buttons */
  actionRow:    { flexDirection: "row", gap: 8, alignItems: "center" },
  pill:         {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1.5,
  },
  pillText:     { fontSize: 14, fontWeight: "700" },
  iconPill:     { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  dot:          { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },

  tags:         { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  /* Mutual */
  mutualRow:    { flexDirection: "row", alignItems: "center", gap: 10, margin: 14, borderWidth: 1, borderRadius: 12, padding: 12 },
  mutualAvatars:{ flexDirection: "row" },
  mutualText:   { flex: 1, fontSize: 12, fontWeight: "500" },

  /* Tabs */
  tabRow:       { flexDirection: "row", borderBottomWidth: 1 },
  tab:          { flex: 1, alignItems: "center", paddingVertical: 13, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabText:      { fontSize: 14, fontWeight: "700" },

  /* Empty */
  empty:        { alignItems: "center", justifyContent: "center", paddingVertical: 60, rowGap: 12 },
  emptyText:    { fontSize: 15 },

  /* Cellar */
  cellarBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, margin: 16, paddingVertical: 13, borderRadius: 14 },
  cellarBtnText:{ fontSize: 14, fontWeight: "700" },

  /* Wine */
  wineCard:     { borderRadius: 12, borderWidth: 1, padding: 14, rowGap: 6 },
  wineName:     { fontSize: 15, fontWeight: "700" },
  wineSub:      { fontSize: 12, marginTop: 1 },
  wineStatus:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  wineStatusTxt:{ fontSize: 11, fontWeight: "600" },
});
