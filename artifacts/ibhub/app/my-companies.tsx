import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { fetchUserCompanyPages, type CompanyPage } from "@/services/api";

const ROLE_LABELS: Record<string, string> = {
  owner:        "Proprietário",
  editor:       "Editor",
  moderador:    "Moderador",
  visualizador: "Visualizador",
};

const ROLE_COLORS: Record<string, string> = {
  owner:        "#c9a84c",
  editor:       "#3b82f6",
  moderador:    "#22c55e",
  visualizador: "#94a3b8",
};

function CompanyAvatar({ page, size = 52 }: { page: CompanyPage; size?: number }) {
  const [err, setErr] = useState(false);
  const initial = (page.name?.[0] ?? "E").toUpperCase();

  if (page.avatar_url && !err) {
    return (
      <Image
        source={{ uri: page.avatar_url }}
        style={{ width: size, height: size, borderRadius: 10 }}
        contentFit="cover"
        cachePolicy="memory-disk"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: 10,
      backgroundColor: "#c9a84c22",
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: "900", color: "#c9a84c" }}>
        {initial}
      </Text>
    </View>
  );
}

export default function MyCompaniesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [pages, setPages] = useState<CompanyPage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const result = await fetchUserCompanyPages(user.id);
    setPages(result);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.gold} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Minhas Empresas
          </Text>
          {pages.length > 0 && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {pages.length} página{pages.length !== 1 ? "s" : ""} empresarial{pages.length !== 1 ? "is" : ""}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.gold }]}
          onPress={() => router.push("/create-company" as any)}
        >
          <Feather name="plus" size={16} color={colors.navy} />
          <Text style={[styles.newBtnText, { color: colors.navy }]}>Nova</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : pages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🏢</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nenhuma página ainda
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Crie a presença digital da sua empresa na maior rede do vinho.
          </Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/create-company" as any)}
          >
            <Feather name="plus" size={16} color={colors.navy} />
            <Text style={[styles.createBtnText, { color: colors.navy }]}>
              Criar minha primeira página
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {pages.map((page) => {
            const role = page.userRole ?? "owner";
            const roleColor = ROLE_COLORS[role] ?? "#94a3b8";
            const roleLabel = ROLE_LABELS[role] ?? role;

            return (
              <View
                key={page.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {/* Top row: avatar + info */}
                <View style={styles.cardTop}>
                  <CompanyAvatar page={page} size={52} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
                      {page.name}
                    </Text>
                    <Text style={[styles.cardIndustry, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {page.industry ?? "Setor não informado"}
                    </Text>
                    <View style={[styles.roleBadge, { backgroundColor: roleColor + "20", borderColor: roleColor + "50" }]}>
                      <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
                      <Text style={[styles.roleLabel, { color: roleColor }]}>
                        {roleLabel.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => router.push(`/empresa/${page.id}` as any)}
                  >
                    <Feather name="eye" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Ver Perfil</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.gold + "60", backgroundColor: colors.gold + "12" }]}
                    onPress={() => router.push(`/manage-business-page?id=${page.id}` as any)}
                  >
                    <Feather name="settings" size={13} color={colors.gold} />
                    <Text style={[styles.actionBtnText, { color: colors.gold }]}>Gerenciar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Bottom spacer */}
          <View style={{ height: insets.bottom + 16 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSub:   { fontSize: 12, marginTop: 1 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newBtnText: { fontSize: 13, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  emptyEmoji: { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyDesc:  { fontSize: 14, textAlign: "center", lineHeight: 20 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 8,
  },
  createBtnText: { fontSize: 14, fontWeight: "700" },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  cardName:     { fontSize: 15, fontWeight: "800" },
  cardIndustry: { fontSize: 12, marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleDot:  { width: 6, height: 6, borderRadius: 3 },
  roleLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
});
