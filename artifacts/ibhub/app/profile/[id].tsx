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
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PostCard, Post } from "@/components/feed/PostCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";

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

  const [userProfile, setUserProfile] = useState<typeof FALLBACK_USER>(FALLBACK_USER);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [wineEntries, setWineEntries] = useState<API.WineEntry[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"none" | "pending" | "connected">("none");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "adega">("posts");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const isOwn = currentUser?.id === id;
    const [realProfile, followStatus, connStatus, posts, wines] = await Promise.all([
      API.fetchPublicProfile(id),
      currentUser?.id ? API.checkIsFollowing(id, currentUser.id) : Promise.resolve(false),
      currentUser?.id ? API.checkConnectionStatus(id, currentUser.id) : Promise.resolve("none" as const),
      currentUser?.id ? API.fetchProfilePosts(id, currentUser.id) : Promise.resolve([]),
      isOwn ? API.fetchWineCellar(id) : API.fetchPublicWineCellar(id),
    ]);

    if (realProfile) setUserProfile({ ...FALLBACK_USER, ...realProfile });
    setIsFollowing(followStatus);
    setConnectionStatus(connStatus);
    setUserPosts(posts);
    setWineEntries(wines);
    setLoading(false);
  }, [id, currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Follow ──────────────────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!currentUser?.id || !id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setUserProfile(p => ({ ...p, followers_count: p.followers_count + (next ? 1 : -1) }));
    await API.toggleFollow(id, currentUser.id, isFollowing);
  };

  // ── Connect — also auto-follows ────────────────────────────────────────────
  const handleConnect = async () => {
    if (!currentUser?.id || !id || connectionStatus !== "none") return;
    setConnectionStatus("pending");
    // Auto-follow when requesting connection
    if (!isFollowing) {
      setIsFollowing(true);
      setUserProfile(p => ({ ...p, followers_count: p.followers_count + 1 }));
      await API.toggleFollow(id, currentUser.id, false);
    }
    await API.sendConnectionRequest(id, currentUser.id);
  };

  // ── Message ─────────────────────────────────────────────────────────────────
  // Person:  connected → direct chat | following-only → pending request
  // Company: always available
  const canMessage =
    isCompany
      ? true
      : connectionStatus === "connected" || isFollowing;

  const messagePending =
    !isCompany && connectionStatus !== "connected" && isFollowing;

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

  const isCompany = (userProfile as any).profile_type === "empresa";
  const isOwnProfile = currentUser?.id === id;
  const tab2Label = isCompany ? "Portfólio" : "Adega";

  // Connection button label + disabled state
  const connectLabel =
    connectionStatus === "connected" ? "Conectado"
    : connectionStatus === "pending" ? "Pendente"
    : "Conectar";
  const connectDisabled = connectionStatus !== "none";

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Floating back button — always on top ── */}
      <TouchableOpacity
        style={[styles.backBtn, { top: topPad + 8, backgroundColor: colors.navy + "cc" }]}
        onPress={() => router.back()}
      >
        <Feather name="arrow-left" size={20} color={colors.gold} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover banner */}
        <View style={[styles.cover, { backgroundColor: colors.navy }]} />

        {/* ── Profile header ── */}
        <View style={[styles.profileSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

          {/* Avatar + plan badge */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatarBorder, { borderColor: colors.card }]}>
              <Avatar uri={userProfile.avatar_url} name={userProfile.full_name} size={84} />
            </View>
            {userProfile.plan && !["gratuito", "basico"].includes(userProfile.plan) && (
              <View style={[styles.planBadge, { backgroundColor: colors.gold }]}>
                <Text style={{ color: colors.navy, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>
                  {userProfile.plan.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Nome */}
          <Text style={[styles.name, { color: colors.foreground }]}>{userProfile.full_name}</Text>

          {/* @username */}
          {!!userProfile.username && (
            <Text style={[styles.username, { color: colors.mutedForeground }]}>@{userProfile.username}</Text>
          )}

          {/* Sobre / bio — imediatamente abaixo do username */}
          {!!userProfile.bio && (
            <Text style={[styles.bio, { color: colors.foreground }]}>{userProfile.bio}</Text>
          )}

          {/* Cargo · Empresa */}
          {!!userProfile.headline && (
            <Text style={[styles.headline, { color: colors.mutedForeground }]}>{userProfile.headline}</Text>
          )}

          {/* Localização */}
          {!!(userProfile as any).location && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{(userProfile as any).location}</Text>
            </View>
          )}

          {/* Stats */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{userProfile.connections_count}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Conexões</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{userProfile.followers_count}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Seguidores</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{userProfile.following_count}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Seguindo</Text>
            </View>
          </View>

          {/* ── Action buttons ── */}
          {!isOwnProfile && (
            <View style={styles.actionRow}>
              {isCompany ? (
                /* ── Empresa: só Seguir + Chat sempre disponível ── */
                <>
                  <Button
                    title={isFollowing ? "Seguindo" : "Seguir"}
                    onPress={handleFollow}
                    variant={isFollowing ? "outline" : "primary"}
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <TouchableOpacity
                    style={[styles.messageBtn, { borderColor: colors.border }]}
                    onPress={handleMessage}
                  >
                    <Feather name="message-circle" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                </>
              ) : (
                /* ── Pessoa: Conectar + Seguir + Chat condicional ── */
                <>
                  {/* Conectar — visível enquanto não conectado */}
                  {connectionStatus !== "connected" && (
                    <Button
                      title={connectLabel}
                      onPress={handleConnect}
                      variant={connectDisabled ? "outline" : "gold"}
                      size="sm"
                      style={{ flex: 1 }}
                      disabled={connectDisabled}
                    />
                  )}

                  {/* Seguir — independente de conexão */}
                  <Button
                    title={isFollowing ? "Seguindo" : "Seguir"}
                    onPress={handleFollow}
                    variant={isFollowing ? "outline" : "primary"}
                    size="sm"
                    style={{ flex: 1 }}
                  />

                  {/* Chat — só aparece se seguindo ou conectado */}
                  {canMessage && (
                    <TouchableOpacity
                      style={[
                        styles.messageBtn,
                        { borderColor: messagePending ? colors.gold : colors.border },
                      ]}
                      onPress={handleMessage}
                    >
                      <Feather
                        name="message-circle"
                        size={20}
                        color={messagePending ? colors.gold : colors.foreground}
                      />
                      {/* Ícone de "pendente" quando seguindo mas não conectado */}
                      {messagePending && (
                        <View style={[styles.pendingDot, { backgroundColor: colors.gold }]} />
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {/* Áreas de atuação */}
          {(userProfile.areas_of_expertise ?? []).length > 0 && (
            <View style={styles.tags}>
              {(userProfile.areas_of_expertise ?? []).map((area) => (
                <Badge key={area} label={area} variant="gold" />
              ))}
            </View>
          )}
        </View>

        {/* ── Tabs — apenas 2 ── */}
        <View style={[styles.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          {(["posts", "adega"] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && [styles.activeTab, { borderBottomColor: colors.gold }]]}
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

        {/* ── Adega / Portfólio ── */}
        {tab === "adega" && !isCompany && (
          <View style={{ paddingBottom: 40 }}>
            {/* Own profile: management CTA */}
            {isOwnProfile && (
              <TouchableOpacity
                style={[styles.cellarsBtn, { backgroundColor: colors.gold }]}
                onPress={() => router.push("/wine-cellar" as any)}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.cellarsBtnText}>Gerenciar minha adega</Text>
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
              <View style={{ padding: 16, gap: 10 }}>
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
                      <View style={[styles.statusBadge, { backgroundColor: colors.gold + "18" }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.gold }]}>
                          {w.status === "adega" ? "Na Adega"
                            : w.status === "consumido" ? "Consumido"
                            : w.status === "presenteado" ? "Presenteado"
                            : "Wishlist"}
                        </Text>
                      </View>
                    </View>
                    {w.region && (
                      <Text style={[styles.wineSub, { color: colors.mutedForeground }]}>{w.region}{w.country ? `, ${w.country}` : ""}</Text>
                    )}
                    {w.rating > 0 && (
                      <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                        {[1,2,3,4,5].map((s) => (
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  backBtn:      {
    position: "absolute", left: 16, zIndex: 100,
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  cover:        { height: 110 },
  profileSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 8, borderBottomWidth: 1 },
  avatarRow:    { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -44 },
  avatarBorder: { borderRadius: 46, borderWidth: 3, overflow: "hidden", width: 90, height: 90 },
  planBadge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginBottom: 4 },
  name:         { fontSize: 22, fontWeight: "800", marginTop: 8 },
  username:     { fontSize: 14, fontWeight: "500", marginTop: -2 },
  bio:          { fontSize: 14, lineHeight: 21, marginTop: 4 },
  headline:     { fontSize: 13 },
  locationRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 13 },
  statsRow:     { flexDirection: "row", alignItems: "center", marginTop: 6, paddingTop: 12, borderTopWidth: 1 },
  stat:         { flex: 1, alignItems: "center", gap: 2 },
  statNum:      { fontSize: 20, fontWeight: "800" },
  statLabel:    { fontSize: 11, fontWeight: "500" },
  statDivider:  { width: 1, height: 32 },
  actionRow:    { flexDirection: "row", gap: 10, alignItems: "center" },
  messageBtn:   { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pendingDot:   { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  tags:         { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tabRow:       { flexDirection: "row", borderBottomWidth: 1 },
  tab:          { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab:    {},
  tabText:      { fontSize: 14, fontWeight: "700" },
  empty:        { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText:    { fontSize: 15 },
  cellarsBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 16, paddingVertical: 13, borderRadius: 12 },
  cellarsBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  wineCard:     { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  wineName:     { fontSize: 15, fontWeight: "700" },
  wineSub:      { fontSize: 12, marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
});
