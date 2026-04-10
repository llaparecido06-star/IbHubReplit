import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface AdminProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  is_admin?: boolean;
}

function UserAvatar({ uri, name, size = 40, colors }: {
  uri: string | null;
  name: string | null;
  size?: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.gold + "22", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.gold, fontSize: size * 0.35, fontWeight: "700" }}>{initials}</Text>
    </View>
  );
}

export default function AdminAdminsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [admins, setAdmins]               = useState<AdminProfile[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [fetchError, setFetchError]       = useState<string | null>(null);

  const [searchQuery, setSearchQuery]       = useState("");
  const [searchResults, setSearchResults]   = useState<AdminProfile[]>([]);
  const [searching, setSearching]           = useState(false);
  const [granting, setGranting]             = useState<string | null>(null);
  const [revoking, setRevoking]             = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const authHeader = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? ""}`,
  }), [session?.access_token]);

  const fetchAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_URL}/admin/admin-list`, { headers: authHeader() });
      if (res.ok) {
        const json = await res.json();
        setAdmins(json.admins ?? []);
      } else {
        const json = await res.json().catch(() => ({}));
        setFetchError(json.error ?? "Erro ao carregar admins.");
      }
    } catch {
      setFetchError("Falha de conexão.");
    }
    setLoadingAdmins(false);
  }, [authHeader]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/admin/search-users?q=${encodeURIComponent(q.trim())}`, { headers: authHeader() });
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.users ?? []);
      }
    } catch {}
    setSearching(false);
  }, [authHeader]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(text), 400);
  };

  const handleGrant = async (user: AdminProfile) => {
    if (granting) return;
    Alert.alert(
      "Conceder acesso admin",
      `Deseja conceder acesso ao painel administrativo para ${user.full_name ?? user.email ?? "este usuário"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setGranting(user.id);
            try {
              const res = await fetch(`${API_URL}/admin/grant-admin`, {
                method: "POST",
                headers: authHeader(),
                body: JSON.stringify({ userId: user.id }),
              });
              const json = await res.json();
              if (res.ok) {
                Alert.alert("Sucesso", `${user.full_name ?? "Usuário"} agora é administrador.`);
                setSearchQuery("");
                setSearchResults([]);
                fetchAdmins();
              } else {
                Alert.alert("Erro", json.error ?? "Não foi possível conceder acesso.");
              }
            } catch {
              Alert.alert("Erro", "Falha de conexão. Tente novamente.");
            }
            setGranting(null);
          },
        },
      ],
    );
  };

  const handleRevoke = async (user: AdminProfile) => {
    if (revoking) return;
    Alert.alert(
      "Revogar acesso admin",
      `Deseja remover o acesso administrativo de ${user.full_name ?? user.email ?? "este usuário"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revogar",
          style: "destructive",
          onPress: async () => {
            setRevoking(user.id);
            try {
              const res = await fetch(`${API_URL}/admin/revoke-admin`, {
                method: "POST",
                headers: authHeader(),
                body: JSON.stringify({ userId: user.id }),
              });
              const json = await res.json();
              if (res.ok) {
                Alert.alert("Pronto", `Acesso revogado com sucesso.`);
                fetchAdmins();
              } else {
                Alert.alert("Erro", json.error ?? "Não foi possível revogar o acesso.");
              }
            } catch {
              Alert.alert("Erro", "Falha de conexão. Tente novamente.");
            }
            setRevoking(null);
          },
        },
      ],
    );
  };

  const adminIds = new Set(admins.map(a => a.id));
  const filteredResults = searchResults.filter(u => !adminIds.has(u.id));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Admins</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heroTitle, { color: colors.navy }]}>Gestão de Administradores</Text>

        {/* Conceder Acesso */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <Feather name="user-plus" size={15} color={colors.gold} />
            <Text style={[styles.cardTitle, { color: colors.navy }]}>Conceder Acesso de Admin</Text>
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Pesquise por nome, usuário ou e-mail de um usuário já cadastrado para conceder acesso ao painel.
          </Text>
          <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Buscar usuário..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={colors.gold} />}
          </View>

          {filteredResults.length > 0 && (
            <View style={[styles.resultList, { borderColor: colors.border }]}>
              {filteredResults.map((user, i) => (
                <View
                  key={user.id}
                  style={[styles.resultRow, { borderBottomColor: colors.border }, i < filteredResults.length - 1 && { borderBottomWidth: 1 }]}
                >
                  <UserAvatar uri={user.avatar_url} name={user.full_name} size={36} colors={colors} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: colors.navy }]}>{user.full_name ?? user.username ?? "Usuário"}</Text>
                    {user.email && <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>}
                  </View>
                  <TouchableOpacity
                    style={[styles.grantBtn, { backgroundColor: colors.gold, opacity: granting === user.id ? 0.6 : 1 }]}
                    onPress={() => handleGrant(user)}
                    disabled={granting === user.id}
                  >
                    {granting === user.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.grantBtnText}>Conceder</Text>
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {searchQuery.length >= 2 && !searching && filteredResults.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum usuário encontrado ou já é admin.</Text>
          )}
        </View>

        {/* Administradores Ativos */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <Feather name="shield" size={15} color={colors.gold} />
            <Text style={[styles.cardTitle, { color: colors.navy }]}>Administradores Ativos</Text>
          </View>

          {loadingAdmins ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : fetchError ? (
            <Text style={[styles.emptyText, { color: "#e74c3c" }]}>{fetchError}</Text>
          ) : admins.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum admin encontrado.</Text>
          ) : (
            admins.map((admin, i) => (
              <View
                key={admin.id}
                style={[styles.adminRow, { borderBottomColor: colors.border }, i < admins.length - 1 && { borderBottomWidth: 1 }]}
              >
                <UserAvatar uri={admin.avatar_url} name={admin.full_name} size={40} colors={colors} />
                <View style={{ flex: 1 }}>
                  <View style={styles.adminNameRow}>
                    <Text style={[styles.adminName, { color: colors.navy }]}>
                      {admin.full_name ?? admin.username ?? "Admin"}
                    </Text>
                    <View style={[styles.adminBadge, { backgroundColor: colors.gold }]}>
                      <Text style={styles.adminBadgeText}>ADMIN</Text>
                    </View>
                  </View>
                  {admin.email ? (
                    <Text style={[styles.adminEmail, { color: colors.mutedForeground }]}>{admin.email}</Text>
                  ) : admin.username ? (
                    <Text style={[styles.adminEmail, { color: colors.mutedForeground }]}>@{admin.username}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[styles.revokeBtn, { borderColor: "#dc2626", opacity: revoking === admin.id ? 0.5 : 1 }]}
                  onPress={() => handleRevoke(admin)}
                  disabled={revoking === admin.id}
                >
                  {revoking === admin.id
                    ? <ActivityIndicator size="small" color="#dc2626" />
                    : <Feather name="user-x" size={14} color="#dc2626" />
                  }
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/admins" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:   { fontSize: 18, fontWeight: "700" },
  heroTitle:     { fontSize: 22, fontWeight: "800" },
  card:          { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  cardHead:      { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle:     { fontSize: 15, fontWeight: "700" },
  hint:          { fontSize: 13, lineHeight: 18 },
  searchRow:     { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:   { flex: 1, fontSize: 14 },
  resultList:    { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  resultRow:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  userName:      { fontSize: 14, fontWeight: "600" },
  userEmail:     { fontSize: 12, marginTop: 1 },
  grantBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  grantBtnText:  { color: "#fff", fontSize: 13, fontWeight: "700" },
  adminRow:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  adminNameRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  adminName:     { fontSize: 14, fontWeight: "600" },
  adminBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText:{ color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  adminEmail:    { fontSize: 12, marginTop: 2 },
  revokeBtn:     { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  emptyText:     { fontSize: 13 },
});
