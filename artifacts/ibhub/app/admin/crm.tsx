import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import { fetchAdminUsers, generateResetLink, type AdminUser } from "@/services/admin-api";

const AVATAR_COLORS = ["#0d1b2a", "#1e3a5f", "#7c3aed", "#e11d48", "#059669", "#374151", "#1e3a5f"];

function getInitial(name: string | null, email: string | null): string {
  const str = name ?? email ?? "?";
  return str.charAt(0).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

export default function AdminCRMScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [search, setSearch]             = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [users, setUsers]               = useState<AdminUser[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar usuários";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (u.full_name ?? "").toLowerCase().includes(s) ||
      (u.username ?? "").toLowerCase().includes(s) ||
      (u.email ?? "").toLowerCase().includes(s)
    );
  });

  const handleBan = (user: AdminUser) => {
    const isBanned = user.is_banned;
    const actionLabel = isBanned ? "Desbanir Usuário" : "Banir Usuário";
    Alert.alert(
      actionLabel,
      `${actionLabel}: ${user.full_name ?? user.username}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            const { error: err } = await supabase
              .from("profiles")
              .update({ is_banned: !isBanned })
              .eq("id", user.id);
            setActionLoading(false);
            if (err) {
              Alert.alert("Erro", err.message);
            } else {
              Alert.alert("Sucesso", `Usuário ${isBanned ? "desbanido" : "banido"} com sucesso.`);
              setSelectedUser(null);
              void fetchUsers();
            }
          },
        },
      ]
    );
  };

  const handleShadowban = (user: AdminUser) => {
    const isShadowbanned = user.is_shadowbanned;
    const actionLabel = isShadowbanned ? "Remover Shadowban" : "Aplicar Shadowban";
    Alert.alert(
      actionLabel,
      `${actionLabel}: ${user.full_name ?? user.username}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setActionLoading(true);
            const { error: err } = await supabase
              .from("profiles")
              .update({ is_shadowbanned: !isShadowbanned })
              .eq("id", user.id);
            setActionLoading(false);
            if (err) {
              Alert.alert("Erro", err.message);
            } else {
              Alert.alert("Sucesso", `Shadowban ${isShadowbanned ? "removido" : "aplicado"} com sucesso.`);
              setSelectedUser(null);
              void fetchUsers();
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = (user: AdminUser) => {
    Alert.alert(
      "Resetar Senha",
      `Gerar link de reset de senha para ${user.full_name ?? user.email ?? user.id}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setActionLoading(true);
            try {
              const link = await generateResetLink(user.id);
              setActionLoading(false);
              Alert.alert(
                "Link Gerado",
                `Link de reset:\n\n${link}\n\nCopie e envie ao usuário.`,
                [{ text: "OK" }]
              );
            } catch (e: unknown) {
              setActionLoading(false);
              const msg = e instanceof Error ? e.message : "Erro desconhecido";
              Alert.alert("Erro", msg);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>CRM Usuários</Text>
        <TouchableOpacity onPress={fetchUsers}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <Text style={[styles.heroTitle, { color: colors.navy }]}>CRM Usuários</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Busca global e gestão de usuários</Text>
        </View>

        <View style={[styles.searchBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar por nome, email ou username..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={{ color: colors.mutedForeground, marginTop: 10, fontSize: 13 }}>Carregando usuários...</Text>
          </View>
        ) : error ? (
          <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
            <Feather name="alert-circle" size={32} color="#dc2626" />
            <Text style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.gold }]} onPress={fetchUsers}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.userList, { backgroundColor: "#fff", borderColor: colors.border }]}>
            {filtered.length === 0 ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Nenhum usuário encontrado.</Text>
              </View>
            ) : (
              filtered.map((user, idx) => {
                const isSelected = selectedUser?.id === user.id;
                const initial = getInitial(user.full_name, user.email);
                return (
                  <View key={user.id}>
                    <TouchableOpacity
                      style={[
                        styles.userRow,
                        idx < filtered.length - 1 && !isSelected && { borderBottomWidth: 1, borderBottomColor: colors.border },
                        isSelected && { backgroundColor: colors.gold + "08" },
                      ]}
                      onPress={() => setSelectedUser(isSelected ? null : user)}
                    >
                      <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                        <Text style={[styles.avatarText, { color: colors.gold }]}>{initial}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.userName, { color: colors.navy }]}>{user.full_name ?? user.username ?? "—"}</Text>
                          {user.is_banned && (
                            <View style={{ backgroundColor: "#fee2e2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: "#dc2626", fontSize: 10, fontWeight: "700" }}>BANIDO</Text>
                            </View>
                          )}
                          {user.is_shadowbanned && (
                            <View style={{ backgroundColor: "#f3f4f6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: "#6b7280", fontSize: 10, fontWeight: "700" }}>SHADOW</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {user.email ?? `@${user.username ?? "—"}`} · {user.plan}
                        </Text>
                      </View>
                      <Feather name={isSelected ? "chevron-down" : "chevron-right"} size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>

                    {isSelected && (
                      <View style={[styles.detail, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                        <View style={styles.detailHeader}>
                          <View style={[styles.detailAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                            <Text style={[styles.detailAvatarText, { color: colors.gold }]}>{initial}</Text>
                          </View>
                          <View>
                            <Text style={[styles.detailName, { color: colors.navy }]}>{user.full_name ?? "—"}</Text>
                            <Text style={[styles.detailEmail, { color: colors.mutedForeground }]}>{user.email ?? `@${user.username}`}</Text>
                          </View>
                        </View>

                        <View style={styles.infoGrid}>
                          {[
                            { label: "Plano", value: user.plan },
                            { label: "Cadastro", value: formatDate(user.created_at) },
                            { label: "Banido", value: user.is_banned ? "Sim" : "Não" },
                            { label: "Áreas", value: (user.areas_of_expertise ?? []).join(", ") || "—" },
                          ].map((item) => (
                            <View key={item.label} style={[styles.infoCell, { backgroundColor: colors.background, borderColor: colors.border }]}>
                              <Text style={[styles.infoCellLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                              <Text style={[styles.infoCellValue, { color: colors.navy }]} numberOfLines={2}>{item.value}</Text>
                            </View>
                          ))}
                        </View>

                        <Text style={[styles.idText, { color: colors.mutedForeground }]}>ID: {user.id}</Text>

                        <Text style={[styles.dangerTitle, { color: colors.gold }]}>ZONA DE PERIGO</Text>

                        {actionLoading ? (
                          <ActivityIndicator color={colors.gold} />
                        ) : (
                          <>
                            <TouchableOpacity
                              style={[styles.dangerBtn, { borderColor: colors.border }]}
                              onPress={() => handleResetPassword(user)}
                            >
                              <Feather name="key" size={15} color={colors.foreground} />
                              <Text style={[styles.dangerBtnText, { color: colors.foreground }]}>Resetar Senha</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.dangerBtn, { borderColor: colors.border }]}
                              onPress={() => handleShadowban(user)}
                            >
                              <Feather name="eye-off" size={15} color={colors.foreground} />
                              <Text style={[styles.dangerBtnText, { color: colors.foreground }]}>
                                {user.is_shadowbanned ? "Remover Shadowban" : "Aplicar Shadowban"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.dangerBtn, { borderColor: "#dc2626" }]}
                              onPress={() => handleBan(user)}
                            >
                              <Feather name="slash" size={15} color="#dc2626" />
                              <Text style={[styles.dangerBtnText, { color: "#dc2626" }]}>
                                {user.is_banned ? "Desbanir Usuário" : "Banir Usuário"}
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/crm" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:      { fontSize: 18, fontWeight: "700" },
  heroTitle:        { fontSize: 22, fontWeight: "800" },
  heroSub:          { fontSize: 13 },
  searchBox:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  searchInput:      { flex: 1, fontSize: 14 },
  userList:         { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  userRow:          { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar:           { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText:       { fontSize: 14, fontWeight: "700" },
  userName:         { fontSize: 14, fontWeight: "600" },
  userEmail:        { fontSize: 12, marginTop: 1 },
  detail:           { padding: 16, gap: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  detailHeader:     { flexDirection: "row", alignItems: "center", gap: 14 },
  detailAvatar:     { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  detailAvatarText: { fontSize: 20, fontWeight: "800" },
  detailName:       { fontSize: 16, fontWeight: "700" },
  detailEmail:      { fontSize: 13, marginTop: 2 },
  infoGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoCell:         { width: "47%", borderRadius: 8, borderWidth: 1, padding: 10, gap: 3 },
  infoCellLabel:    { fontSize: 11 },
  infoCellValue:    { fontSize: 14, fontWeight: "700" },
  idText:           { fontSize: 11, fontFamily: "monospace" },
  dangerTitle:      { fontSize: 12, fontWeight: "800", letterSpacing: 0.5, marginTop: 4 },
  dangerBtn:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 10, borderWidth: 1 },
  dangerBtnText:    { fontSize: 14, fontWeight: "600" },
  retryBtn:         { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
