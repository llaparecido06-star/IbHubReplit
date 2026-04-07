import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  AppApplication,
  AppOpportunity,
  fetchApplicationsForMyOpportunities,
  fetchMyOpportunities,
  toggleOpportunity,
} from "@/services/api";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function EmpresaDashboard() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, signOut } = useAuth();

  const [vagas, setVagas] = useState<AppOpportunity[]>([]);
  const [anuncios, setAnuncios] = useState<AppOpportunity[]>([]);
  const [applications, setApplications] = useState<AppApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const [v, a, apps] = await Promise.all([
      fetchMyOpportunities(user.id, "vaga"),
      fetchMyOpportunities(user.id, "marketplace"),
      fetchApplicationsForMyOpportunities(user.id),
    ]);
    setVagas(v);
    setAnuncios(a);
    setApplications(apps);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleSignOut = () => {
    Alert.alert("Sair", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  };

  const openCV = (url: string | null) => {
    if (!url) { Alert.alert("CV", "Este candidato não anexou currículo."); return; }
    Linking.openURL(url).catch(() => Alert.alert("Erro", "Não foi possível abrir o CV."));
  };

  const handleToggle = async (id: string, currentlyActive: boolean, type: "vaga" | "marketplace") => {
    const newState = !currentlyActive;
    const label = type === "vaga" ? "vaga" : "anúncio";
    const ok = await toggleOpportunity(id, newState);
    if (ok) {
      if (type === "vaga") {
        setVagas((prev) => prev.map((v) => v.id === id ? { ...v, is_active: newState } : v));
      } else {
        setAnuncios((prev) => prev.map((a) => a.id === id ? { ...a, is_active: newState } : a));
      }
    } else {
      Alert.alert("Erro", `Não foi possível ${newState ? "ativar" : "desativar"} a ${label}.`);
    }
  };

  const name = profile?.full_name ?? profile?.username ?? "Empresa";
  const initial = name.charAt(0).toUpperCase();
  const activeVagas = vagas.filter((v) => v.is_active !== false).length;
  const activeAnuncios = anuncios.filter((a) => a.is_active !== false).length;

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

      {/* ── Header card ── */}
      <View style={[styles.headerCard, { backgroundColor: "#fff" }]}>
        <View style={styles.avatarRow}>
          <Avatar uri={profile?.avatar_url} name={name} size={84} />
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: colors.border }]}
            onPress={() => router.push("/edit-profile" as any)}
          >
            <Feather name="edit-2" size={14} color={colors.navy} />
            <Text style={[styles.editBtnText, { color: colors.navy }]}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.companyName, { color: colors.navy }]}>{name}</Text>
        {profile?.username ? (
          <Text style={[styles.companyUsername, { color: colors.mutedForeground }]}>@{profile.username}</Text>
        ) : null}
        {profile?.bio ? (
          <Text style={[styles.companyBio, { color: colors.foreground }]} numberOfLines={3}>{profile.bio}</Text>
        ) : null}

        <View style={styles.metaRow}>
          {profile?.areas_of_expertise?.[0] ? (
            <View style={[styles.chip, { backgroundColor: colors.background }]}>
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{profile.areas_of_expertise[0]}</Text>
            </View>
          ) : null}
          {profile?.website ? (
            <TouchableOpacity style={styles.metaLink} onPress={() => Linking.openURL(profile.website!)}>
              <Feather name="globe" size={13} color={colors.gold} />
              <Text style={[styles.metaLinkText, { color: colors.gold }]} numberOfLines={1}>{profile.website}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          {[
            { label: "Vagas ativas", value: activeVagas, icon: "briefcase" as const },
            { label: "Anúncios",     value: activeAnuncios, icon: "shopping-bag" as const },
            { label: "Candidaturas", value: applications.length, icon: "users" as const },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.navy }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Quick actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/new-opportunity" as any)}
          >
            <Feather name="plus" size={15} color="#fff" />
            <Text style={styles.btnPrimaryText}>Nova vaga</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border }]}
            onPress={() => router.push("/new-opportunity" as any)}
          >
            <Feather name="tag" size={15} color={colors.navy} />
            <Text style={[styles.btnSecondaryText, { color: colors.navy }]}>Anunciar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Candidaturas ── */}
      <View style={[styles.section, { backgroundColor: "#fff" }]}>
        <View style={styles.sectionHeader}>
          <Feather name="users" size={16} color={colors.navy} />
          <Text style={[styles.sectionTitle, { color: colors.navy }]}>
            Candidaturas recebidas
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.gold }]}>
            <Text style={styles.badgeText}>{applications.length}</Text>
          </View>
        </View>

        {loading ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Carregando...</Text>
        ) : applications.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Feather name="inbox" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma candidatura ainda.{"\n"}Publique uma vaga para começar.
            </Text>
          </View>
        ) : (
          applications.map((app) => {
            const aName = app.applicant?.full_name ?? app.applicant?.username ?? "Candidato";
            const aInitial = aName.charAt(0).toUpperCase();
            const aPos = [app.applicant?.position, app.applicant?.company].filter(Boolean).join(" · ");
            return (
              <View key={app.id} style={[styles.appCard, { borderColor: colors.border }]}>
                <View style={styles.appHeader}>
                  <Avatar uri={app.applicant?.avatar_url} name={aName} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.appName, { color: colors.navy }]}>{aName}</Text>
                    {aPos ? <Text style={[styles.appPos, { color: colors.mutedForeground }]}>{aPos}</Text> : null}
                    <Text style={[styles.appFor, { color: colors.gold }]} numberOfLines={1}>
                      {app.opportunity?.type === "vaga" ? "Vaga: " : "Anúncio: "}
                      {app.opportunity?.title ?? "—"}
                    </Text>
                  </View>
                  <Text style={[styles.appDate, { color: colors.mutedForeground }]}>{fmtDate(app.created_at)}</Text>
                </View>
                {app.message ? (
                  <Text style={[styles.appMessage, { color: colors.foreground }]} numberOfLines={2}>
                    "{app.message}"
                  </Text>
                ) : null}
                <View style={styles.appActions}>
                  <TouchableOpacity
                    style={[styles.appBtn, { borderColor: colors.border }]}
                    onPress={() => router.push(`/profile/${app.applicant_id}` as any)}
                  >
                    <Feather name="user" size={13} color={colors.navy} />
                    <Text style={[styles.appBtnText, { color: colors.navy }]}>Perfil</Text>
                  </TouchableOpacity>
                  {app.cv_url ? (
                    <TouchableOpacity
                      style={[styles.appBtn, { borderColor: colors.gold }]}
                      onPress={() => openCV(app.cv_url)}
                    >
                      <Feather name="file-text" size={13} color={colors.gold} />
                      <Text style={[styles.appBtnText, { color: colors.gold }]}>Ver CV</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.appBtnFill, { backgroundColor: colors.navy }]}
                    onPress={() => router.push(`/new-message?userId=${app.applicant_id}` as any)}
                  >
                    <Feather name="message-circle" size={13} color="#fff" />
                    <Text style={styles.appBtnFillText}>Mensagem</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Minhas Vagas ── */}
      <View style={[styles.section, { backgroundColor: "#fff" }]}>
        <View style={styles.sectionHeader}>
          <Feather name="briefcase" size={16} color={colors.navy} />
          <Text style={[styles.sectionTitle, { color: colors.navy }]}>Minhas vagas</Text>
          <View style={[styles.badge, { backgroundColor: colors.navy }]}>
            <Text style={styles.badgeText}>{vagas.length}</Text>
          </View>
          <TouchableOpacity
            style={[styles.seeAllBtn]}
            onPress={() => router.push("/new-opportunity" as any)}
          >
            <Feather name="plus" size={14} color={colors.gold} />
            <Text style={[styles.seeAllText, { color: colors.gold }]}>Nova</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Carregando...</Text>
        ) : vagas.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma vaga publicada.</Text>
          </View>
        ) : (
          vagas.map((vaga) => {
            const appCount = applications.filter((a) => a.opportunity_id === vaga.id).length;
            const isActive = vaga.is_active !== false;
            return (
              <TouchableOpacity
                key={vaga.id}
                style={[styles.oppCard, { borderColor: colors.border }]}
                onPress={() => router.push(`/opportunity/${vaga.id}` as any)}
                activeOpacity={0.75}
              >
                <View style={styles.oppCardRow}>
                  <Text style={[styles.oppTitle, { color: colors.navy, flex: 1 }]} numberOfLines={1}>{vaga.title}</Text>
                  <TouchableOpacity
                    style={[styles.statusChip, { backgroundColor: isActive ? "#dcfce7" : "#fee2e2" }]}
                    onPress={(e) => { e.stopPropagation(); handleToggle(vaga.id, isActive, "vaga"); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name={isActive ? "eye" : "eye-off"} size={11} color={isActive ? "#16a34a" : "#dc2626"} />
                    <Text style={[styles.statusText, { color: isActive ? "#16a34a" : "#dc2626" }]}>
                      {isActive ? "Ativa" : "Inativa"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.oppMeta}>
                  {vaga.location ? (
                    <View style={styles.metaItem}>
                      <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.metaItemText, { color: colors.mutedForeground }]}>{vaga.location}</Text>
                    </View>
                  ) : null}
                  {vaga.category ? (
                    <View style={[styles.chip, { backgroundColor: colors.background }]}>
                      <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{vaga.category}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.metaItem}>
                  <Feather name="users" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.metaItemText, { color: colors.mutedForeground }]}>
                    {appCount} {appCount === 1 ? "candidatura" : "candidaturas"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* ── Meus Anúncios ── */}
      <View style={[styles.section, { backgroundColor: "#fff" }]}>
        <View style={styles.sectionHeader}>
          <Feather name="shopping-bag" size={16} color={colors.navy} />
          <Text style={[styles.sectionTitle, { color: colors.navy }]}>Meus anúncios</Text>
          <View style={[styles.badge, { backgroundColor: colors.navy }]}>
            <Text style={styles.badgeText}>{anuncios.length}</Text>
          </View>
          <TouchableOpacity
            style={styles.seeAllBtn}
            onPress={() => router.push("/new-opportunity" as any)}
          >
            <Feather name="plus" size={14} color={colors.gold} />
            <Text style={[styles.seeAllText, { color: colors.gold }]}>Novo</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Carregando...</Text>
        ) : anuncios.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum anúncio publicado.</Text>
          </View>
        ) : (
          anuncios.map((anuncio) => {
            const isActive = anuncio.is_active !== false;
            return (
              <TouchableOpacity
                key={anuncio.id}
                style={[styles.oppCard, { borderColor: colors.border }]}
                onPress={() => router.push(`/opportunity/${anuncio.id}` as any)}
                activeOpacity={0.75}
              >
                <View style={styles.oppCardRow}>
                  <Text style={[styles.oppTitle, { color: colors.navy, flex: 1 }]} numberOfLines={1}>{anuncio.title}</Text>
                  <TouchableOpacity
                    style={[styles.statusChip, { backgroundColor: isActive ? "#dcfce7" : "#fee2e2" }]}
                    onPress={(e) => { e.stopPropagation(); handleToggle(anuncio.id, isActive, "marketplace"); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name={isActive ? "eye" : "eye-off"} size={11} color={isActive ? "#16a34a" : "#dc2626"} />
                    <Text style={[styles.statusText, { color: isActive ? "#16a34a" : "#dc2626" }]}>
                      {isActive ? "Ativo" : "Inativo"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.oppMeta}>
                  {anuncio.price ? (
                    <Text style={[styles.oppPrice, { color: colors.gold }]}>{anuncio.price}</Text>
                  ) : null}
                  {anuncio.category ? (
                    <View style={[styles.chip, { backgroundColor: colors.background }]}>
                      <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{anuncio.category}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* ── Links rápidos ── */}
      <View style={[styles.section, { backgroundColor: "#fff" }]}>
        <Text style={[styles.sectionTitle, { color: colors.navy, marginBottom: 4 }]}>Atalhos</Text>
        {[
          { label: "Dados de Mercado",  icon: "bar-chart-2" as const, route: "/(tabs)/network" },
          { label: "Eventos",           icon: "calendar"    as const, route: "/(tabs)/notifications" },
          { label: "Feed",              icon: "home"        as const, route: "/(tabs)/" },
          { label: "Certificações",     icon: "shield"      as const, route: "/certifications" },
        ].map((link) => (
          <TouchableOpacity
            key={link.label}
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={() => router.push(link.route as any)}
            activeOpacity={0.7}
          >
            <Feather name={link.icon} size={18} color={colors.navy} />
            <Text style={[styles.linkText, { color: colors.navy }]}>{link.label}</Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Sair ── */}
      <View style={[styles.section, { backgroundColor: "#fff" }]}>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Feather name="log-out" size={18} color="#dc2626" />
          <Text style={styles.signOutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cover: { height: 130, justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 12, alignItems: "flex-end" },
  settingsBtn: { padding: 4 },
  headerCard: { padding: 16, gap: 10, marginBottom: 10 },
  avatarRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -48, marginBottom: 4 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  editBtnText: { fontSize: 13, fontWeight: "600" },
  companyName: { fontSize: 24, fontWeight: "800" },
  companyUsername: { fontSize: 14, marginTop: -4 },
  companyBio: { fontSize: 14, lineHeight: 21 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 12 },
  metaLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaLinkText: { fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, marginVertical: 4 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, height: 28 },
  actionRow: { flexDirection: "row", gap: 10 },
  btnPrimary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 10 },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  btnSecondaryText: { fontWeight: "700", fontSize: 14 },
  section: { paddingHorizontal: 16, paddingVertical: 14, gap: 10, marginTop: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "800", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, minWidth: 24, alignItems: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { fontSize: 13, fontWeight: "600" },
  emptyBlock: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  appCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  appHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  appName: { fontSize: 15, fontWeight: "700" },
  appPos: { fontSize: 12, marginTop: 1 },
  appFor: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  appDate: { fontSize: 11 },
  appMessage: { fontSize: 13, lineHeight: 19, fontStyle: "italic" },
  appActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  appBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5 },
  appBtnText: { fontSize: 13, fontWeight: "600" },
  appBtnFill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  appBtnFillText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  oppCard: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  oppCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  oppTitle: { fontSize: 14, fontWeight: "700" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "700" },
  oppMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  oppPrice: { fontSize: 16, fontWeight: "800" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaItemText: { fontSize: 12 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  linkText: { flex: 1, fontSize: 15, fontWeight: "500" },
  signOutBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  signOutText: { color: "#dc2626", fontSize: 15, fontWeight: "600" },
});
