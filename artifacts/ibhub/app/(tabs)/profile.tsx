import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  CompanyPage,
  FollowProfile,
  fetchConnectionSuggestions,
  fetchFollowers,
  fetchFollowing,
  fetchUserCompanyPages,
  fetchUserPosts,
  toggleFollow,
  checkIsFollowing,
} from "@/services/api";
import { Post } from "@/components/feed/PostCard";
import EmpresaDashboard from "@/components/EmpresaDashboard";

type StatModal = "seguidores" | "seguindo" | null;

export default function ProfileScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { profile, user, signOut } = useAuth();

  const [activeTab,    setActiveTab]    = useState<"feed" | "salvos" | "adega">("feed");
  const [showComments, setShowComments] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
  const [commentText,  setCommentText]  = useState("");
  const [statModal,    setStatModal]    = useState<StatModal>(null);

  const [posts,        setPosts]        = useState<Post[]>([]);
  const [followers,    setFollowers]    = useState<FollowProfile[]>([]);
  const [following,    setFollowing]    = useState<FollowProfile[]>([]);
  const [suggestions,  setSuggestions]  = useState<FollowProfile[]>([]);
  const [companyPages, setCompanyPages] = useState<CompanyPage[]>([]);
  const [loadingData,  setLoadingData]  = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  if (profile?.profile_type === "empresa") {
    return <EmpresaDashboard />;
  }

  const name     = profile?.full_name ?? profile?.username ?? "Usuário";
  const username = profile?.username  ?? "";
  const initial  = name.charAt(0).toUpperCase();

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const [p, fr, fg, sg, cp] = await Promise.all([
      fetchUserPosts(user.id, user.id),
      fetchFollowers(user.id),
      fetchFollowing(user.id),
      fetchConnectionSuggestions(user.id, 5),
      fetchUserCompanyPages(user.id),
    ]);
    setPosts(p);
    setFollowers(fr);
    setFollowing(fg);
    setSuggestions(sg);
    setCompanyPages(cp);
    setLoadingData(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleDeletePost = (id: string) => {
    setShowPostMenu(null);
    Alert.alert("Excluir publicação", "Deseja excluir esta publicação?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => setPosts((p) => p.filter((x) => x.id !== id)) },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert("Sair", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  };

  const handleBusinessPage = async () => {
    if (!profile?.id) return;
    if (companyPages.length === 0) {
      router.push("/manage-business-page" as any);
    } else if (companyPages.length === 1) {
      router.push(`/manage-business-page?id=${companyPages[0].id}` as any);
    } else {
      Alert.alert(
        "Suas páginas",
        "Selecione qual página gerenciar:",
        [
          ...companyPages.map((p) => ({
            text: p.name,
            onPress: () => router.push(`/manage-business-page?id=${p.id}` as any),
          })),
          { text: "Cancelar", style: "cancel" as const },
        ],
      );
    }
  };

  const handleFollowSuggestion = async (targetId: string) => {
    if (!user?.id) return;
    const alreadyFollowing = await checkIsFollowing(targetId, user.id);
    await toggleFollow(targetId, user.id, alreadyFollowing);
    setSuggestions((prev) => prev.filter((s) => s.id !== targetId));
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* ── Cover ── */}
      <View style={[styles.cover, { backgroundColor: colors.navyLight, paddingTop: topPad }]}>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push("/settings" as any)}>
          <Feather name="settings" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Profile card ── */}
      <View style={[styles.profileCard, { backgroundColor: "#fff" }]}>
        {/* Avatar row */}
        <View style={styles.avatarRow}>
          <Avatar uri={profile?.avatar_url} name={name} size={84} />
        </View>

        <Text style={[styles.name, { color: colors.navy }]}>{name}</Text>
        {username ? <Text style={[styles.username, { color: colors.mutedForeground }]}>@{username}</Text> : null}

        {/* Stats */}
        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          {[
            { label: "Publicações", value: posts.length,                           onPress: undefined },
            { label: "Seguidores",  value: profile?.followers_count  ?? followers.length,  onPress: () => setStatModal("seguidores") },
            { label: "Seguindo",    value: profile?.following_count  ?? following.length,  onPress: () => setStatModal("seguindo") },
            { label: "Conexões",    value: profile?.connections_count ?? 0,          onPress: () => router.push("/conexoes" as any) },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <TouchableOpacity style={styles.stat} onPress={s.onPress} disabled={!s.onPress}>
                <Text style={[styles.statNum, { color: colors.navy }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio}</Text>
        ) : null}

        {/* Work / certs */}
        {(profile?.company || profile?.position) ? (
          <View style={styles.metaRow}>
            <Feather name="briefcase" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {[profile.company, profile.position].filter(Boolean).join(" · ")}
            </Text>
            <TouchableOpacity style={styles.certsBtn} onPress={() => router.push("/certifications" as any)}>
              <Feather name="shield" size={13} color={colors.gold} />
              <Text style={[styles.certsBtnText, { color: colors.gold }]}>Certificações</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.certsBtn} onPress={() => router.push("/certifications" as any)}>
            <Feather name="shield" size={13} color={colors.gold} />
            <Text style={[styles.certsBtnText, { color: colors.gold }]}>Certificações</Text>
          </TouchableOpacity>
        )}

        {/* Tags */}
        {(profile?.areas_of_expertise ?? []).length > 0 ? (
          <View style={styles.tags}>
            {(profile!.areas_of_expertise!).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.tagText, { color: colors.navy }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: colors.gold }]} onPress={handleBusinessPage}>
            <Feather name="briefcase" size={15} color="#fff" />
            <Text style={styles.btnPrimaryText}>Página Empresarial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border }]}
            onPress={() => router.push("/conexoes" as any)}
          >
            <Feather name="users" size={15} color={colors.navy} />
            <Text style={[styles.btnSecondaryText, { color: colors.navy }]}>Conexões</Text>
          </TouchableOpacity>
        </View>

        {/* Company pages (real data) */}
        {companyPages.length > 0 ? (
          <View style={[styles.companyRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.companyLogoMini, { backgroundColor: colors.navy }]}>
              <Text style={[styles.companyLogoText, { color: colors.gold }]}>
                {companyPages[0].name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.companyInfo}>
              <Text style={[styles.companyName, { color: colors.navy }]}>{companyPages[0].name}</Text>
              {companyPages[0].industry ? (
                <Text style={[styles.companyCategory, { color: colors.mutedForeground }]}>{companyPages[0].industry}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => router.push(`/manage-business-page?id=${companyPages[0].id}` as any)}
            >
              <Feather name="repeat" size={14} color={colors.gold} />
              <Text style={[styles.switchText, { color: colors.gold }]}>Gerenciar</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* ── Sugestões (real data) ── */}
      {suggestions.length > 0 ? (
        <View style={[styles.section, { backgroundColor: "#fff" }]}>
          <Text style={[styles.sectionTitle, { color: colors.navy }]}>Sugestões para você</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 16 }}
          >
            {suggestions.map((s) => (
              <View key={s.id} style={[styles.suggCard, { borderColor: colors.border }]}>
                <Avatar uri={s.avatar_url} name={s.full_name ?? s.username ?? "?"} size={52} />
                <Text style={[styles.suggName, { color: colors.navy }]} numberOfLines={1}>
                  {s.full_name ?? s.username ?? "Usuário"}
                </Text>
                {s.position || s.company ? (
                  <Text style={[styles.suggRole, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {s.position ?? s.company}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.suggFollowBtn, { backgroundColor: colors.gold }]}
                  onPress={() => handleFollowSuggestion(s.id)}
                >
                  <Text style={styles.suggFollowText}>Seguir</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Profile tabs ── */}
      <View style={[styles.tabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "feed",   label: "FEED",   icon: null },
          { key: "salvos", label: "SALVOS", icon: "bookmark" },
          { key: "adega",  label: "ADEGA",  icon: "wind" },
        ] as const).map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, activeTab === t.key && [styles.tabActive, { borderBottomColor: colors.gold }]]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, { color: activeTab === t.key ? colors.gold : colors.mutedForeground }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── FEED (real data) ── */}
      {activeTab === "feed" && (
        <View style={{ gap: 0 }}>
          {loadingData ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
          ) : posts.length === 0 ? (
            <View style={styles.emptyTab}>
              <Feather name="file-text" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>Nenhuma publicação ainda</Text>
              <TouchableOpacity
                style={[styles.emptyTabBtn, { backgroundColor: colors.gold }]}
                onPress={() => router.push("/create-post" as any)}
              >
                <Text style={styles.emptyTabBtnText}>Criar publicação</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={[styles.postCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
                <View style={styles.postHeader}>
                  <Avatar uri={profile?.avatar_url} name={name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.postName, { color: colors.navy }]}>{name}</Text>
                    <Text style={[styles.postDate, { color: colors.mutedForeground }]}>
                      {new Date(post.created_at).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowPostMenu(post.id)}>
                    <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
                <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                  <View style={styles.postActionBtn}>
                    <Feather name="heart" size={18} color={post.is_liked ? "#e11d48" : colors.mutedForeground} />
                    <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.likes_count}</Text>
                  </View>
                  <TouchableOpacity style={styles.postActionBtn} onPress={() => setShowComments(post.id)}>
                    <Feather name="message-circle" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.comments_count}</Text>
                  </TouchableOpacity>
                  <View style={styles.postActionBtn}>
                    <Feather name="bookmark" size={18} color={post.is_bookmarked ? colors.gold : colors.mutedForeground} />
                  </View>
                  <TouchableOpacity
                    style={[styles.postActionBtn, { marginLeft: "auto" as any }]}
                    onPress={() => router.push(`/post/${post.id}` as any)}
                  >
                    <Feather name="external-link" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── SALVOS ── */}
      {activeTab === "salvos" && (
        <View style={[styles.emptyTab, { backgroundColor: "#fff" }]}>
          <Feather name="bookmark" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTabTitle, { color: colors.navy }]}>Suas coleções privadas</Text>
          <TouchableOpacity style={[styles.emptyTabBtn, { backgroundColor: colors.gold }]}>
            <Text style={styles.emptyTabBtnText}>Ver Coleções</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ADEGA ── */}
      {activeTab === "adega" && (
        <View style={[styles.emptyTab, { backgroundColor: "#fff" }]}>
          <Feather name="wind" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTabTitle, { color: colors.navy }]}>Gerencie seus vinhos, notas e compartilhe sua coleção</Text>
          <TouchableOpacity
            style={[styles.emptyTabBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/wine-cellar" as any)}
          >
            <Feather name="wind" size={16} color="#fff" />
            <Text style={styles.emptyTabBtnText}>Abrir Adega</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Comments modal ── */}
      <Modal visible={showComments !== null} transparent animationType="slide" onRequestClose={() => setShowComments(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowComments(null)}>
          <View style={[styles.commentsSheet, { backgroundColor: "#fff" }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.commentsTitle, { color: colors.navy }]}>Comentários</Text>
              <TouchableOpacity onPress={() => setShowComments(null)}>
                <Feather name="x" size={20} color={colors.navy} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.commentsBody]}
              activeOpacity={0.8}
              onPress={() => { setShowComments(null); router.push(`/post/${showComments}` as any); }}
            >
              <Text style={[styles.commentsEmpty, { color: colors.mutedForeground }]}>
                Ver comentários completos →
              </Text>
            </TouchableOpacity>
            <View style={[styles.commentInput, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.commentTextInput, { color: colors.foreground }]}
                placeholder="Adicionar comentário..."
                placeholderTextColor={colors.mutedForeground}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity
                onPress={() => { if (showComments) router.push(`/post/${showComments}` as any); }}
              >
                <Feather name="send" size={20} color={commentText ? colors.gold : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Post menu modal ── */}
      <Modal visible={showPostMenu !== null} transparent animationType="fade" onRequestClose={() => setShowPostMenu(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowPostMenu(null)}>
          <View style={[styles.menuCard, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowPostMenu(null); router.push(`/edit-post/${showPostMenu}` as any); }}>
              <Feather name="edit-2" size={17} color={colors.navy} />
              <Text style={[styles.menuItemText, { color: colors.navy }]}>Editar</Text>
            </TouchableOpacity>
            <View style={[styles.menuDiv, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => handleDeletePost(showPostMenu!)}>
              <Feather name="trash-2" size={17} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Seguidores / Seguindo modal (real data) ── */}
      <Modal visible={statModal !== null} transparent animationType="slide" onRequestClose={() => setStatModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setStatModal(null)}>
          <View style={[styles.statSheet, { backgroundColor: "#fff" }]}>
            <View style={styles.statSheetHeader}>
              <Text style={[styles.statSheetTitle, { color: colors.navy }]}>
                {statModal === "seguidores" ? "Seguidores" : "Seguindo"}
              </Text>
              <TouchableOpacity onPress={() => setStatModal(null)}>
                <Feather name="x" size={20} color={colors.navy} />
              </TouchableOpacity>
            </View>
            {(statModal === "seguidores" ? followers : following).length === 0 ? (
              <Text style={[styles.commentsEmpty, { color: colors.mutedForeground, padding: 20 }]}>
                {statModal === "seguidores" ? "Nenhum seguidor ainda." : "Não está seguindo ninguém ainda."}
              </Text>
            ) : (
              (statModal === "seguidores" ? followers : following).map((person) => (
                <TouchableOpacity
                  key={person.id}
                  style={[styles.statPersonRow, { borderBottomColor: colors.border }]}
                  onPress={() => { setStatModal(null); router.push(`/profile/${person.id}` as any); }}
                >
                  <Avatar uri={person.avatar_url} name={person.full_name ?? person.username ?? "?"} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statPersonName, { color: colors.navy }]}>
                      {person.full_name ?? person.username ?? "Usuário"}
                    </Text>
                    {person.position || person.company ? (
                      <Text style={[styles.statPersonRole, { color: colors.mutedForeground }]}>
                        {[person.position, person.company].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  cover:              { height: 130, justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 12, alignItems: "flex-end" },
  settingsBtn:        { padding: 4 },
  profileCard:        { padding: 16, gap: 10 },
  avatarRow:          { marginTop: -48, marginBottom: 4 },
  name:               { fontSize: 24, fontWeight: "800" },
  username:           { fontSize: 14, marginTop: -4 },
  statsRow:           { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, marginVertical: 4 },
  stat:               { flex: 1, alignItems: "center", gap: 2 },
  statNum:            { fontSize: 18, fontWeight: "800" },
  statLabel:          { fontSize: 11 },
  statDivider:        { width: 1, height: 28 },
  bio:                { fontSize: 14, lineHeight: 21 },
  metaRow:            { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaText:           { fontSize: 13, flex: 1 },
  certsBtn:           { flexDirection: "row", alignItems: "center", gap: 4 },
  certsBtnText:       { fontSize: 13, fontWeight: "600" },
  tags:               { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag:                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tagText:            { fontSize: 13 },
  actionRow:          { flexDirection: "row", gap: 10 },
  btnPrimary:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 10 },
  btnPrimaryText:     { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnSecondary:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  btnSecondaryText:   { fontWeight: "700", fontSize: 14 },
  companyRow:         { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  companyLogoMini:    { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  companyLogoText:    { fontSize: 16, fontWeight: "800" },
  companyInfo:        { flex: 1 },
  companyName:        { fontSize: 14, fontWeight: "700" },
  companyCategory:    { fontSize: 12 },
  switchBtn:          { flexDirection: "row", alignItems: "center", gap: 5 },
  switchText:         { fontSize: 13, fontWeight: "600" },
  section:            { paddingHorizontal: 16, paddingVertical: 14, gap: 12, marginTop: 10 },
  sectionTitle:       { fontSize: 16, fontWeight: "800" },
  suggCard:           { width: 130, alignItems: "center", gap: 6, padding: 12, borderRadius: 12, borderWidth: 1 },
  suggName:           { fontSize: 13, fontWeight: "700", textAlign: "center" },
  suggRole:           { fontSize: 11, textAlign: "center" },
  suggFollowBtn:      { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  suggFollowText:     { color: "#fff", fontSize: 12, fontWeight: "700" },
  tabRow:             { flexDirection: "row", borderBottomWidth: 1, marginTop: 10, backgroundColor: "#fff" },
  tab:                { flex: 1, alignItems: "center", paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive:          {},
  tabText:            { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  emptyTab:           { backgroundColor: "#fff", alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
  emptyTabText:       { fontSize: 14, color: "#888" },
  emptyTabTitle:      { fontSize: 15, fontWeight: "600", textAlign: "center", lineHeight: 22 },
  emptyTabBtn:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyTabBtnText:    { color: "#fff", fontSize: 14, fontWeight: "700" },
  postCard:           { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  postHeader:         { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  postName:           { fontSize: 14, fontWeight: "700" },
  postDate:           { fontSize: 12 },
  postContent:        { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  postActions:        { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 1 },
  postActionBtn:      { flexDirection: "row", alignItems: "center", gap: 5, marginRight: 20 },
  postActionText:     { fontSize: 13 },
  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  commentsSheet:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  commentsHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  commentsTitle:      { fontSize: 17, fontWeight: "700" },
  commentsBody:       { paddingVertical: 24, alignItems: "center" },
  commentsEmpty:      { fontSize: 14 },
  commentInput:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  commentTextInput:   { flex: 1, fontSize: 14 },
  menuOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end", paddingBottom: 40, paddingHorizontal: 16 },
  menuCard:           { borderRadius: 14, overflow: "hidden" },
  menuItem:           { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  menuItemText:       { fontSize: 15, fontWeight: "500" },
  menuDiv:            { height: 1 },
  statSheet:          { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  statSheetHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  statSheetTitle:     { fontSize: 17, fontWeight: "700" },
  statPersonRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  statPersonName:     { fontSize: 14, fontWeight: "600" },
  statPersonRole:     { fontSize: 12, marginTop: 2 },
});
