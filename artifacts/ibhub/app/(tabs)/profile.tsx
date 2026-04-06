import { Image } from "expo-image";
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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"feed" | "salvos" | "adega">("feed");
  const [showQR, setShowQR] = useState(false);

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      signOut();
    } else {
      Alert.alert("Sair", "Deseja realmente sair da sua conta?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: signOut },
      ]);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover */}
      <View style={[styles.coverWrap, { paddingTop: topPad }]}>
        <View style={[styles.cover, { backgroundColor: colors.navyLight }]}>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push("/settings" as any)}
          >
            <Feather name="settings" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: "#fff" }]}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarBorder, { borderColor: "#fff" }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.navy }]}>
              <Text style={styles.avatarInitial}>
                {(profile?.full_name ?? "U").charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.qrBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowQR(true)}
          >
            <Feather name="grid" size={18} color={colors.navy} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.name, { color: colors.navy }]}>
          {profile?.full_name ?? "Seu Nome"}
        </Text>
        <Text style={[styles.username, { color: colors.mutedForeground }]}>
          @{profile?.username ?? "username"}
        </Text>
        {profile?.headline && (
          <Text style={[styles.headline, { color: colors.mutedForeground }]}>{profile.headline}</Text>
        )}

        {/* Stats */}
        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          {[
            { label: "Publicações", value: 0 },
            { label: "Seguidores",  value: profile?.followers_count ?? 0 },
            { label: "Seguindo",    value: profile?.following_count ?? 0 },
            { label: "Conexões",    value: profile?.connections_count ?? 0 },
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

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtnPrimary, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/edit-profile" as any)}
          >
            <Feather name="briefcase" size={16} color="#fff" />
            <Text style={styles.actionBtnPrimaryText}>Página Empresarial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtnSecondary, { borderColor: colors.border }]}
          >
            <Feather name="users" size={16} color={colors.navy} />
            <Text style={[styles.actionBtnSecondaryText, { color: colors.navy }]}>Conexões</Text>
          </TouchableOpacity>
        </View>

        {/* Tags */}
        {profile?.areas_of_expertise && profile.areas_of_expertise.length > 0 && (
          <View style={styles.tags}>
            {profile.areas_of_expertise.map((area) => (
              <View key={area} style={[styles.tag, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.tagText, { color: colors.navy }]}>{area}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications badge */}
        <TouchableOpacity
          style={styles.certRow}
          onPress={() => router.push("/certifications" as any)}
        >
          <Feather name="shield" size={14} color={colors.gold} />
          <Text style={[styles.certText, { color: colors.gold }]}>Certificações</Text>
        </TouchableOpacity>
      </View>

      {/* Suggestions */}
      <View style={[styles.section, { backgroundColor: "#fff" }]}>
        <Text style={[styles.sectionTitle, { color: colors.navy }]}>Sugestões para você</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
          {["Isabela Mondavi", "Rafael Borges", "Ana Ferreira"].map((name) => (
            <View key={name} style={[styles.suggCard, { borderColor: colors.border }]}>
              <View style={[styles.suggAvatar, { backgroundColor: colors.navy }]}>
                <Text style={styles.suggInitial}>{name.charAt(0)}</Text>
              </View>
              <Text style={[styles.suggName, { color: colors.navy }]}>{name}</Text>
              <View style={styles.suggPending}>
                <Feather name="clock" size={11} color={colors.mutedForeground} />
                <Text style={[styles.suggPendingText, { color: colors.mutedForeground }]}>Pendente</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Profile Tabs */}
      <View style={[styles.tabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {(["feed", "salvos", "adega"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && [styles.activeTab, { borderBottomColor: colors.gold }]]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, { color: activeTab === t ? colors.gold : colors.mutedForeground }]}>
              {t === "feed" ? "FEED" : t === "salvos" ? "SALVOS" : "ADEGA"}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "feed" && (
        <View style={[styles.emptyTab, { backgroundColor: "#fff" }]}>
          <Feather name="file-text" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
            Nenhuma publicação ainda
          </Text>
        </View>
      )}
      {activeTab === "salvos" && (
        <View style={[styles.emptyTab, { backgroundColor: "#fff" }]}>
          <Feather name="bookmark" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
            Nenhuma publicação salva
          </Text>
        </View>
      )}
      {activeTab === "adega" && (
        <View style={[styles.emptyTab, { backgroundColor: "#fff" }]}>
          <Feather name="wind" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
            Sua adega está vazia
          </Text>
          <TouchableOpacity
            style={[styles.addWineBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/wine-cellar" as any)}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Adicionar vinho</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* QR Modal */}
      <Modal visible={showQR} transparent animationType="slide" onRequestClose={() => setShowQR(false)}>
        <View style={styles.qrOverlay}>
          <View style={[styles.qrCard, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setShowQR(false)}>
              <Feather name="x" size={22} color={colors.navy} />
            </TouchableOpacity>
            <View style={[styles.qrAvatar, { backgroundColor: colors.navy }]}>
              <Text style={styles.qrAvatarInitial}>
                {(profile?.full_name ?? "U").charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.qrName, { color: colors.navy }]}>{profile?.full_name ?? "Seu Nome"}</Text>
            <Text style={[styles.qrRole, { color: colors.mutedForeground }]}>
              {profile?.headline ?? "Profissional do Vinho"}
            </Text>
            <View style={[styles.qrBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={{ width: 180, height: 180, alignItems: "center", justifyContent: "center" }}>
                <Feather name="grid" size={100} color={colors.navy} />
              </View>
            </View>
            <Text style={[styles.qrHint, { color: colors.mutedForeground }]}>
              Escaneie para ver meu perfil no Ibhub
            </Text>
            <View style={styles.qrActions}>
              <TouchableOpacity style={[styles.qrActionBtn, { borderColor: colors.border }]}>
                <Feather name="copy" size={16} color={colors.navy} />
                <Text style={[styles.qrActionText, { color: colors.navy }]}>Copiar Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.qrActionBtn, { backgroundColor: colors.gold, borderColor: colors.gold }]}>
                <Feather name="share-2" size={16} color="#fff" />
                <Text style={[styles.qrActionText, { color: "#fff" }]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  coverWrap: { backgroundColor: "#fff" },
  cover: {
    height: 130,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  settingsBtn: { alignSelf: "flex-end" },
  profileCard: { padding: 16, gap: 8 },
  avatarRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: -44,
  },
  avatarBorder: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, overflow: "hidden" },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { color: "#c9a84c", fontSize: 32, fontWeight: "800" },
  qrBtn: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  username: { fontSize: 14 },
  headline: { fontSize: 14, lineHeight: 20 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginVertical: 8,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "500" },
  statDivider: { width: 1, height: 30 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtnPrimary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 10,
  },
  actionBtnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  actionBtnSecondary: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
  },
  actionBtnSecondaryText: { fontWeight: "700", fontSize: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tagText: { fontSize: 13, fontWeight: "500" },
  certRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  certText: { fontSize: 13, fontWeight: "600" },
  section: { marginTop: 10, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  suggCard: {
    width: 130, alignItems: "center", gap: 6,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  suggAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  suggInitial: { color: "#c9a84c", fontSize: 20, fontWeight: "800" },
  suggName: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  suggPending: { flexDirection: "row", alignItems: "center", gap: 4 },
  suggPendingText: { fontSize: 12 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginTop: 10, backgroundColor: "#fff" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: {},
  tabText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  emptyTab: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyTabText: { fontSize: 14 },
  addWineBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  qrOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  qrCard: {
    width: 320, borderRadius: 20, padding: 24,
    alignItems: "center", gap: 12,
  },
  qrCloseBtn: { alignSelf: "flex-end" },
  qrAvatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  qrAvatarInitial: { color: "#c9a84c", fontSize: 28, fontWeight: "800" },
  qrName: { fontSize: 20, fontWeight: "800" },
  qrRole: { fontSize: 14 },
  qrBox: { borderRadius: 16, padding: 16, borderWidth: 1, marginVertical: 4 },
  qrHint: { fontSize: 13 },
  qrActions: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  qrActionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
  },
  qrActionText: { fontWeight: "700", fontSize: 14 },
});
