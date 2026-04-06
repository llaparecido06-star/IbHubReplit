import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const PLAN_LABELS: Record<string, { label: string; color: string; textColor: string }> = {
  executivo: { label: "Executivo", color: "#c9a84c", textColor: "#0d1b2a" },
  basico: { label: "Básico", color: "#243b55", textColor: "#ffffff" },
  gratuito: { label: "Gratuito", color: "#e8e0d0", textColor: "#7a6e5f" },
};

const MENU_ITEMS = [
  { icon: "wine" as const, label: "Adega Pessoal", route: "/wine-cellar" },
  { icon: "award" as const, label: "Minhas Certificações", route: "/certifications" },
  { icon: "bookmark" as const, label: "Publicações Salvas", route: "/saved-posts" },
  { icon: "calendar" as const, label: "Meus Eventos", route: "/my-events" },
  { icon: "briefcase" as const, label: "Oportunidades", route: "/opportunities" },
  { icon: "users" as const, label: "Grupos", route: "/groups" },
  { icon: "settings" as const, label: "Configurações", route: "/settings" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"posts" | "sobre">("posts");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 + 34 : 84 + insets.bottom;

  const planConfig = PLAN_LABELS[profile?.plan ?? "gratuito"] ?? PLAN_LABELS.gratuito;

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
      <View style={[styles.cover, { backgroundColor: colors.navy, paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push("/settings" as any)}>
          <Feather name="settings" size={22} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <View style={[styles.profileSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarBorder, { borderColor: colors.card }]}>
            <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={80} />
          </View>
          <View style={[styles.planBadge, { backgroundColor: planConfig.color }]}>
            <Text style={{ color: planConfig.textColor, fontSize: 11, fontWeight: "700" }}>
              {planConfig.label}
            </Text>
          </View>
        </View>

        <Text style={[styles.name, { color: colors.foreground }]}>
          {profile?.full_name ?? "Seu Nome"}
        </Text>
        {profile?.headline && (
          <Text style={[styles.headline, { color: colors.mutedForeground }]}>
            {profile.headline}
          </Text>
        )}
        {profile?.location && (
          <View style={styles.location}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
              {profile.location}
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>
              {profile?.connections_count ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Conexões</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>
              {profile?.followers_count ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Seguidores</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>
              {profile?.following_count ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Seguindo</Text>
          </View>
        </View>

        <Button
          title="Editar Perfil"
          onPress={() => router.push("/edit-profile" as any)}
          variant="outline"
          size="sm"
          style={{ marginTop: 4 }}
        />

        {profile?.areas_of_expertise && profile.areas_of_expertise.length > 0 && (
          <View style={styles.tags}>
            {profile.areas_of_expertise.map((area) => (
              <Badge key={area} label={area} variant="gold" />
            ))}
          </View>
        )}
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {(["posts", "sobre"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && [styles.activeTab, { borderBottomColor: colors.gold }]]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, { color: activeTab === t ? colors.gold : colors.mutedForeground }]}>
              {t === "posts" ? "Publicações" : "Sobre"}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "sobre" && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {profile?.bio ? (
            <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio}</Text>
          ) : (
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>
              Adicione uma bio ao seu perfil
            </Text>
          )}
        </View>
      )}

      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {MENU_ITEMS.map((item, idx) => (
          <TouchableOpacity
            key={item.route}
            style={[
              styles.menuItem,
              { borderBottomColor: colors.border },
              idx === MENU_ITEMS.length - 1 && { borderBottomWidth: 0 },
            ]}
            onPress={() => router.push(item.route as any)}
          >
            <Feather name={item.icon} size={20} color={colors.gold} />
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.signOutBtn, { backgroundColor: colors.destructive + "12" }]}
        onPress={handleSignOut}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={{ color: colors.destructive, fontWeight: "600", fontSize: 15 }}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cover: { height: 120, justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 8 },
  settingsBtn: { alignSelf: "flex-end" },
  profileSection: {
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
  },
  avatarRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -40 },
  avatarBorder: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, overflow: "hidden" },
  planBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  name: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  headline: { fontSize: 14 },
  location: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 13 },
  statsRow: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "500" },
  statDivider: { width: 1, height: 32 },
  tags: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: {},
  tabText: { fontSize: 14, fontWeight: "700" },
  section: { margin: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  bio: { fontSize: 15, lineHeight: 22 },
  menuSection: { margin: 16, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 16, marginBottom: 24, paddingVertical: 14, borderRadius: 12 },
});
