import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";

const MOCK_USER = {
  id: "u1",
  full_name: "Isabela Mondavi",
  username: "isamondavi",
  headline: "Enóloga | Vinhedo Santa Clara | WSET Level 4",
  bio: "Apaixonada por vinhos do Novo Mundo e pelos clássicos europeus. 15 anos de experiência em enologia e produção. Consultora para restaurantes e adegas privadas.",
  location: "Serra Gaúcha, RS",
  plan: "business",
  followers_count: 1240,
  following_count: 386,
  connections_count: 892,
  areas_of_expertise: ["Enologia", "Produção", "WSET", "Consultoria"],
  certifications: ["WSET Level 4 Diploma", "CMS Certified Sommelier"],
};

export default function PublicProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [connected, setConnected] = useState(false);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<"posts" | "sobre" | "vinho">("sobre");

  const user = MOCK_USER;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.cover, { backgroundColor: colors.navy, paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <View style={[styles.profileSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarBorder, { borderColor: colors.card }]}>
            <Avatar name={user.full_name} size={80} />
          </View>
          {user.plan !== "basico" && (
            <View style={[styles.planBadge, { backgroundColor: colors.gold }]}>
              <Text style={{ color: colors.navy, fontSize: 11, fontWeight: "700" }}>
                {user.plan.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.name, { color: colors.foreground }]}>{user.full_name}</Text>
        <Text style={[styles.headline, { color: colors.mutedForeground }]}>{user.headline}</Text>
        <View style={styles.location}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{user.location}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>{user.connections_count}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Conexões</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>{user.followers_count}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Seguidores</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>{user.following_count}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Seguindo</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Button
            title={connected ? "Conectado" : "Conectar"}
            onPress={() => setConnected((v) => !v)}
            variant={connected ? "outline" : "gold"}
            size="sm"
            style={{ flex: 1 }}
          />
          <Button
            title={following ? "Seguindo" : "Seguir"}
            onPress={() => setFollowing((v) => !v)}
            variant={following ? "outline" : "primary"}
            size="sm"
            style={{ flex: 1 }}
          />
          <TouchableOpacity
            style={[styles.messageBtn, { borderColor: colors.border }]}
            onPress={() => router.push(`/chat/new-${id}` as any)}
          >
            <Feather name="message-circle" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.tags}>
          {user.areas_of_expertise.map((area) => (
            <Badge key={area} label={area} variant="gold" />
          ))}
        </View>
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {(["sobre", "posts", "vinho"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && [styles.activeTab, { borderBottomColor: colors.gold }]]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.gold : colors.mutedForeground }]}>
              {t === "posts" ? "Posts" : t === "vinho" ? "Vinho" : "Sobre"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "sobre" && (
        <View style={styles.aboutSection}>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Bio</Text>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{user.bio}</Text>
          </View>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Certificações</Text>
            {user.certifications.map((cert) => (
              <View key={cert} style={styles.certItem}>
                <Feather name="award" size={14} color={colors.gold} />
                <Text style={[styles.certText, { color: colors.foreground }]}>{cert}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {tab === "posts" && (
        <View style={styles.empty}>
          <Feather name="grid" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Publicações em breve
          </Text>
        </View>
      )}

      {tab === "vinho" && (
        <View style={styles.empty}>
          <Feather name="package" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Adega privada
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cover: { height: 100, justifyContent: "flex-start", paddingHorizontal: 16 },
  backBtn: { alignSelf: "flex-start", padding: 4 },
  profileSection: { padding: 16, gap: 10, borderBottomWidth: 1 },
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
  actionRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  messageBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  tags: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: {},
  tabText: { fontSize: 14, fontWeight: "700" },
  aboutSection: { padding: 16, gap: 12 },
  infoCard: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 10 },
  infoTitle: { fontSize: 15, fontWeight: "800" },
  infoText: { fontSize: 14, lineHeight: 21 },
  certItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  certText: { fontSize: 14 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
