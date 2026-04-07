import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";

interface Post {
  id: string;
  content: string;
  date: string;
  likes: number;
  comments: number;
}

type StatModal = "seguidores" | "seguindo" | null;

const SEGUIDORES = [
  { id: "f1", name: "Lucas Lima",      role: "",          initial: "L" },
  { id: "f2", name: "Felipe Galtaroca", role: "Produtor", initial: "F" },
  { id: "f3", name: "Julia Benetti",   role: "Outros",    initial: "J" },
];

const SEGUINDO = [
  { id: "g1", name: "Lucas Lima",    role: "",           initial: "L" },
  { id: "g2", name: "João Oliveira", role: "Importador", initial: "J" },
  { id: "g3", name: "Brenda Lima",   role: "Outros",     initial: "B" },
  { id: "g4", name: "Julia Benetti", role: "Outros",     initial: "J" },
];

const MOCK_POSTS: Post[] = [
  { id: "p1", content: "Nova certificação conquistada! Acabei de passar no exame WSET Diploma. Foram 2 anos intensos de estudo, mas valeu cada momento. Nunca parem de estudar! 🎓🍷", date: "02/03/2026", likes: 0, comments: 0 },
  { id: "p2", content: "Harmonização do dia: Pinot Noir da Borgonha com risoto de cogumelos trufados. A delicadeza do vinho complementa perfeitamente os sabores terrosos do prato. Chef kiss! 🧑‍🍳", date: "01/03/2026", likes: 0, comments: 0 },
];

const SUGGESTIONS = [
  { id: "s1", name: "Lucas Lima",    role: "",           status: "pending" },
  { id: "s2", name: "João Oliveira", role: "Importador", status: "pending" },
  { id: "s3", name: "Felipe G",      role: "Produção",   status: "pending" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"feed" | "salvos" | "adega">("feed");
  const [showComments, setShowComments] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [statModal, setStatModal] = useState<StatModal>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const name     = profile?.full_name ?? "Maria Santos";
  const username = profile?.username  ?? "mariasantos";
  const initial  = name.charAt(0).toUpperCase();

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
    const pages = await API.fetchUserCompanyPages(profile.id);
    if (pages.length === 0) {
      router.push("/manage-business-page" as any);
    } else if (pages.length === 1) {
      router.push(`/manage-business-page?id=${pages[0].id}` as any);
    } else {
      Alert.alert(
        "Suas páginas",
        "Selecione qual página gerenciar:",
        [
          ...pages.map(p => ({
            text: p.name,
            onPress: () => router.push(`/manage-business-page?id=${p.id}` as any),
          })),
          { text: "Cancelar", style: "cancel" as const },
        ],
      );
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Cover ── */}
      <View style={[styles.cover, { backgroundColor: colors.navyLight, paddingTop: topPad }]}>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push("/settings" as any)}
        >
          <Feather name="settings" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Profile card ── */}
      <View style={[styles.profileCard, { backgroundColor: "#fff" }]}>
        {/* Avatar row */}
        <View style={styles.avatarRow}>
          <View style={[styles.avatarBorder, { borderColor: "#fff" }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.navy }]}>
              <Text style={[styles.avatarInitial, { color: colors.gold }]}>{initial}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.name, { color: colors.navy }]}>{name}</Text>
        <Text style={[styles.username, { color: colors.mutedForeground }]}>@{username}</Text>

        {/* Stats */}
        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          {[
            { label: "Publicações", value: posts.length,                      onPress: undefined },
            { label: "Seguidores",  value: profile?.followers_count  ?? 3,    onPress: () => setStatModal("seguidores") },
            { label: "Seguindo",    value: profile?.following_count  ?? 4,    onPress: () => setStatModal("seguindo") },
            { label: "Conexões",    value: profile?.connections_count ?? 0,   onPress: () => router.push("/conexoes" as any) },
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
        <Text style={[styles.bio, { color: colors.foreground }]}>
          {profile?.bio ?? "Sommelier certificada WSET L3. Apaixonada por vinhos do novo mundo."}
        </Text>

        {/* Work / certs */}
        <View style={styles.metaRow}>
          <Feather name="briefcase" size={14} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {profile?.company ?? "Wine Academy"} · {profile?.position ?? "Sommelier Chefe"}
          </Text>
          <TouchableOpacity
            style={styles.certsBtn}
            onPress={() => router.push("/certifications" as any)}
          >
            <Feather name="shield" size={13} color={colors.gold} />
            <Text style={[styles.certsBtnText, { color: colors.gold }]}>Certificações</Text>
          </TouchableOpacity>
        </View>

        {/* Tags */}
        <View style={styles.tags}>
          {(profile?.areas_of_expertise ?? ["Sommelier", "Consultoria"]).map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.tagText, { color: colors.navy }]}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.gold }]}
            onPress={handleBusinessPage}
          >
            <Feather name="briefcase" size={15} color="#fff" />
            <Text style={styles.btnPrimaryText}>Página Empresarial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border }]}
          >
            <Feather name="users" size={15} color={colors.navy} />
            <Text style={[styles.btnSecondaryText, { color: colors.navy }]}>Conexões</Text>
          </TouchableOpacity>
        </View>

        {/* Company switch row */}
        <View style={[styles.companyRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.companyLogoMini, { backgroundColor: colors.navy }]}>
            <Text style={[styles.companyLogoText, { color: colors.gold }]}>I</Text>
          </View>
          <View style={styles.companyInfo}>
            <Text style={[styles.companyName, { color: colors.navy }]}>Ideal.BI</Text>
            <Text style={[styles.companyCategory, { color: colors.mutedForeground }]}>Consultoria</Text>
          </View>
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => router.push("/empresa/ideal-bi" as any)}
          >
            <Feather name="repeat" size={14} color={colors.gold} />
            <Text style={[styles.switchText, { color: colors.gold }]}>Alternar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Suggestions ── */}
      <View style={[styles.section, { backgroundColor: "#fff" }]}>
        <Text style={[styles.sectionTitle, { color: colors.navy }]}>Sugestões para você</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 16 }}
        >
          {SUGGESTIONS.map((s) => (
            <View key={s.id} style={[styles.suggCard, { borderColor: colors.border }]}>
              <View style={[styles.suggAvatar, { backgroundColor: colors.navy }]}>
                <Text style={[styles.suggInitial, { color: colors.gold }]}>
                  {s.name.charAt(0)}
                </Text>
              </View>
              <Text style={[styles.suggName, { color: colors.navy }]} numberOfLines={1}>{s.name}</Text>
              {s.role ? (
                <Text style={[styles.suggRole, { color: colors.mutedForeground }]}>{s.role}</Text>
              ) : null}
              <View style={styles.suggPending}>
                <Feather name="clock" size={11} color={colors.mutedForeground} />
                <Text style={[styles.suggPendingText, { color: colors.mutedForeground }]}>Pendente</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── Profile tabs ── */}
      <View style={[styles.tabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "feed",   label: "FEED",   icon: null },
          { key: "salvos", label: "SALVOS", icon: "bookmark" },
          { key: "adega",  label: "Adega",  icon: "wind" },
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

      {/* ── FEED ── */}
      {activeTab === "feed" && (
        <View style={{ gap: 0 }}>
          {posts.length === 0 ? (
            <View style={styles.emptyTab}>
              <Feather name="file-text" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>Nenhuma publicação ainda</Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={[styles.postCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
                <View style={styles.postHeader}>
                  <View style={[styles.postAvatar, { backgroundColor: colors.navy }]}>
                    <Text style={[styles.postAvatarText, { color: colors.gold }]}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.postName, { color: colors.navy }]}>{name}</Text>
                    <Text style={[styles.postDate, { color: colors.mutedForeground }]}>{post.date}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowPostMenu(post.id)}>
                    <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
                <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={styles.postActionBtn}>
                    <Feather name="heart" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.likes}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postActionBtn} onPress={() => setShowComments(post.id)}>
                    <Feather name="message-circle" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.comments}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postActionBtn}>
                    <Feather name="bookmark" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.postActionBtn, { marginLeft: "auto" as any }]}>
                    <Feather name="share-2" size={18} color={colors.mutedForeground} />
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
      <Modal
        visible={showComments !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComments(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowComments(null)}>
          <View style={[styles.commentsSheet, { backgroundColor: "#fff" }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.commentsTitle, { color: colors.navy }]}>Comentários</Text>
              <TouchableOpacity onPress={() => setShowComments(null)}>
                <Feather name="x" size={20} color={colors.navy} />
              </TouchableOpacity>
            </View>
            <View style={styles.commentsBody}>
              <Text style={[styles.commentsEmpty, { color: colors.mutedForeground }]}>
                Seja o primeiro a comentar!
              </Text>
            </View>
            <View style={[styles.commentInput, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.commentTextInput, { color: colors.foreground }]}
                placeholder="Adicionar comentário..."
                placeholderTextColor={colors.mutedForeground}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity>
                <Feather name="send" size={20} color={commentText ? colors.gold : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Post menu modal ── */}
      <Modal
        visible={showPostMenu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPostMenu(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowPostMenu(null)}>
          <View style={[styles.menuCard, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowPostMenu(null); router.push("/create-post" as any); }}>
              <Feather name="edit-2" size={17} color={colors.navy} />
              <Text style={[styles.menuItemText, { color: colors.navy }]}>Editar</Text>
            </TouchableOpacity>
            <View style={[styles.menuDiv, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowPostMenu(null)}>
              <Feather name="flag" size={17} color={colors.mutedForeground} />
              <Text style={[styles.menuItemText, { color: colors.mutedForeground }]}>Denunciar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleDeletePost(showPostMenu!)}>
              <Feather name="trash-2" size={17} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Seguidores / Seguindo modal ── */}
      <Modal
        visible={statModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setStatModal(null)}
      >
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
            {(statModal === "seguidores" ? SEGUIDORES : SEGUINDO).map((person) => (
              <View key={person.id} style={[styles.statPersonRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.statPersonAvatar, { backgroundColor: colors.navy }]}>
                  <Text style={[styles.statPersonInitial, { color: colors.gold }]}>{person.initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statPersonName, { color: colors.navy }]}>{person.name}</Text>
                  {person.role ? (
                    <Text style={[styles.statPersonRole, { color: colors.mutedForeground }]}>{person.role}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cover: { height: 130, justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 12, alignItems: "flex-end" },
  settingsBtn: { padding: 4 },
  profileCard: { padding: 16, gap: 10 },
  avatarRow: { marginTop: -48, marginBottom: 4 },
  avatarBorder: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, overflow: "hidden" },
  avatarCircle: { width: 82, height: 82, borderRadius: 41, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 32, fontWeight: "800" },
  name: { fontSize: 24, fontWeight: "800" },
  username: { fontSize: 14, marginTop: -4 },
  statsRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, marginVertical: 4 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 28 },
  bio: { fontSize: 14, lineHeight: 21 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaText: { fontSize: 13, flex: 1 },
  certsBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  certsBtnText: { fontSize: 13, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tagText: { fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 10 },
  btnPrimary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 10 },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  btnSecondaryText: { fontWeight: "700", fontSize: 14 },
  companyRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  companyLogoMini: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  companyLogoText: { fontSize: 16, fontWeight: "800" },
  companyInfo: { flex: 1 },
  companyName: { fontSize: 14, fontWeight: "700" },
  companyCategory: { fontSize: 12 },
  switchBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  switchText: { fontSize: 13, fontWeight: "600" },
  section: { paddingHorizontal: 16, paddingVertical: 14, gap: 12, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  suggCard: { width: 120, alignItems: "center", gap: 6, padding: 12, borderRadius: 12, borderWidth: 1 },
  suggAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  suggInitial: { fontSize: 20, fontWeight: "800" },
  suggName: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  suggRole: { fontSize: 11, textAlign: "center" },
  suggPending: { flexDirection: "row", alignItems: "center", gap: 3 },
  suggPendingText: { fontSize: 11 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginTop: 10, backgroundColor: "#fff" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: {},
  tabText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  emptyTab: { backgroundColor: "#fff", alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
  emptyTabTitle: { fontSize: 15, fontWeight: "600", textAlign: "center", lineHeight: 22 },
  emptyTabText: { fontSize: 14, textAlign: "center" },
  emptyTabBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, marginTop: 4 },
  emptyTabBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  postCard: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, gap: 10 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  postAvatarText: { fontSize: 16, fontWeight: "800" },
  postName: { fontSize: 14, fontWeight: "700" },
  postDate: { fontSize: 12, marginTop: 1 },
  postContent: { fontSize: 14, lineHeight: 21 },
  postActions: { flexDirection: "row", alignItems: "center", gap: 20, paddingTop: 10, borderTopWidth: 1 },
  postActionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  postActionText: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  commentsSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: 300 },
  commentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e8eaed" },
  commentsTitle: { fontSize: 16, fontWeight: "700" },
  commentsBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  commentsEmpty: { fontSize: 14 },
  commentInput: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  commentTextInput: { flex: 1, fontSize: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", alignItems: "center" },
  menuCard: { width: 200, borderRadius: 14, overflow: "hidden", elevation: 8, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText: { fontSize: 14, fontWeight: "500" },
  menuDiv: { height: 1, marginHorizontal: 0 },
  statSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  statSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 18 },
  statSheetTitle: { fontSize: 17, fontWeight: "700" },
  statPersonRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  statPersonAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  statPersonInitial: { fontSize: 18, fontWeight: "800" },
  statPersonName: { fontSize: 15, fontWeight: "600" },
  statPersonRole: { fontSize: 13, marginTop: 1 },
});
