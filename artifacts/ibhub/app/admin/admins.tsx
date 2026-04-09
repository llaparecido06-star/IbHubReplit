import React, { useEffect, useState } from "react";
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
import { supabase } from "@/context/AuthContext";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface AdminProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
}

function AdminAvatar({ uri, name, colors }: { uri: string | null; name: string | null; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (uri) {
    return <Image source={{ uri }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.gold + "22" }]}>
      <Text style={[styles.avatarInitials, { color: colors.gold }]}>{initials}</Text>
    </View>
  );
}

export default function AdminAdminsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [nome, setNome]             = useState("");
  const [email, setEmail]           = useState("");
  const [senha, setSenha]           = useState("");
  const [recEmail, setRecEmail]     = useState("");

  const [admins, setAdmins]               = useState<AdminProfile[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [creating, setCreating]           = useState(false);
  const [sendingRec, setSendingRec]       = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    setFetchError(null);
    try {
      const token = session?.access_token;
      if (!token) { setLoadingAdmins(false); return; }
      const res = await fetch(`${API_URL}/admin/admin-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setAdmins(json.admins ?? []);
      } else {
        const json = await res.json().catch(() => ({}));
        setFetchError(json.error ?? "Erro ao carregar admins.");
      }
    } catch {
      setFetchError("Falha de conexão ao carregar administradores.");
    }
    setLoadingAdmins(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, [session?.access_token]);

  const handleCreate = async () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    if (!session?.access_token) {
      Alert.alert("Erro", "Sessão inválida. Faça login novamente.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/admin/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ fullName: nome.trim(), email: email.trim(), password: senha }),
      });
      const json = await res.json();
      if (!res.ok) {
        Alert.alert("Erro", json.error ?? "Não foi possível criar o admin.");
      } else {
        Alert.alert("Sucesso", `Admin ${nome} criado com sucesso.`);
        setNome(""); setEmail(""); setSenha("");
        fetchAdmins();
      }
    } catch {
      Alert.alert("Erro", "Falha de conexão. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const handleRecovery = async () => {
    if (!recEmail.trim()) { Alert.alert("Atenção", "Informe o e-mail."); return; }
    setSendingRec(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recEmail.trim());
    setSendingRec(false);
    if (error) {
      Alert.alert("Erro", error.message);
    } else {
      Alert.alert("E-mail enviado!", `E-mail de recuperação enviado para ${recEmail}.`);
      setRecEmail("");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Admins</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heroTitle, { color: colors.navy }]}>Gestão de Administradores</Text>

        {/* Criar Novo Admin */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <Feather name="user-plus" size={15} color={colors.gold} />
            <Text style={[styles.cardTitle, { color: colors.navy }]}>Criar Novo Admin</Text>
          </View>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            placeholder="Nome completo"
            placeholderTextColor={colors.mutedForeground}
            value={nome}
            onChangeText={setNome}
          />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            placeholder="E-mail"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            placeholder="Senha"
            placeholderTextColor={colors.mutedForeground}
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: creating ? colors.navy + "88" : colors.navy }]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Criar Admin</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Recuperação de Senha */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <Feather name="key" size={15} color={colors.gold} />
            <Text style={[styles.cardTitle, { color: colors.navy }]}>Enviar Recuperação de Senha</Text>
          </View>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            placeholder="E-mail do usuário"
            placeholderTextColor={colors.mutedForeground}
            value={recEmail}
            onChangeText={setRecEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.recBtn, { borderColor: colors.border, opacity: sendingRec ? 0.6 : 1 }]}
            onPress={handleRecovery}
            disabled={sendingRec}
          >
            {sendingRec ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Text style={[styles.recBtnText, { color: colors.foreground }]}>Enviar E-mail de Recuperação</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Admins Ativos */}
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
                style={[
                  styles.adminRow,
                  { borderBottomColor: colors.border },
                  i < admins.length - 1 && { borderBottomWidth: 1 },
                ]}
              >
                <AdminAvatar uri={admin.avatar_url} name={admin.full_name} colors={colors} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.adminName, { color: colors.navy }]}>
                    {admin.full_name ?? admin.username ?? "Admin"}
                  </Text>
                  {admin.email ? (
                    <Text style={[styles.adminEmail, { color: colors.mutedForeground }]}>{admin.email}</Text>
                  ) : admin.username ? (
                    <Text style={[styles.adminEmail, { color: colors.mutedForeground }]}>@{admin.username}</Text>
                  ) : null}
                </View>
                <Feather name="shield" size={16} color={colors.gold} />
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
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:    { fontSize: 18, fontWeight: "700" },
  heroTitle:      { fontSize: 22, fontWeight: "800" },
  card:           { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  cardHead:       { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle:      { fontSize: 15, fontWeight: "700" },
  input:          { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 },
  createBtn:      { paddingVertical: 15, borderRadius: 10, alignItems: "center" },
  createBtnText:  { color: "#fff", fontSize: 15, fontWeight: "700" },
  recBtn:         { paddingVertical: 15, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  recBtnText:     { fontSize: 14, fontWeight: "600" },
  adminRow:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  avatar:         { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 14, fontWeight: "700" },
  adminName:      { fontSize: 14, fontWeight: "600" },
  adminEmail:     { fontSize: 12, marginTop: 1 },
  emptyText:      { fontSize: 13 },
});
