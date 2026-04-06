import React, { useState } from "react";
import {
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

interface CRMUser {
  initial: string;
  name: string;
  email: string;
  plan: string;
  posts: number;
  date: string;
  areas: string;
  id: string;
}

const USERS: CRMUser[] = [
  { initial: "T", name: "Teste IbHub",      email: "teste@ibhub.com",                plan: "Gratuito",  posts: 0,  date: "06/04/2026", areas: "Sommelier",   id: "801b603e-f030-4b04-8dd1-a7b6a5d00a07" },
  { initial: "J", name: "Julia Benetti",     email: "maria.julia@idealbi.com.br",      plan: "Básico",    posts: 3,  date: "10/03/2026", areas: "Enólogo",      id: "a12d3e4f-5678-90ab-cdef-1234567890ab" },
  { initial: "L", name: "Lianertes junior",  email: "lianertesjr@gmail.com",           plan: "Gratuito",  posts: 1,  date: "15/03/2026", areas: "Sommelier",   id: "b23c4d5e-6789-01bc-def0-2345678901bc" },
  { initial: "B", name: "Brenda Lima",       email: "brendaslima14@gmail.com",         plan: "Executivo", posts: 5,  date: "01/03/2026", areas: "Produtor",    id: "c34d5e6f-7890-12cd-ef01-3456789012cd" },
  { initial: "F", name: "Felipe Galtaroca",  email: "felipe@idealbi.com.br",           plan: "Básico",    posts: 2,  date: "20/03/2026", areas: "Importador",  id: "d45e6f70-8901-23de-f012-4567890123de" },
  { initial: "L", name: "Lucas Lima",        email: "lucasla925@gmail.com",            plan: "Executivo", posts: 8,  date: "08/03/2026", areas: "Distribuidor",id: "e56f7081-9012-34ef-0123-5678901234ef" },
  { initial: "J", name: "João Oliveira",     email: "lucas@gmail.com",                 plan: "Gratuito",  posts: 0,  date: "05/04/2026", areas: "Marketing",   id: "f6708192-0123-45f0-1234-6789012345f0" },
];

const AVATAR_COLORS = ["#0d1b2a", "#1e3a5f", "#7c3aed", "#e11d48", "#059669", "#1e3a5f", "#374151"];

export default function AdminCRMScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [search, setSearch]               = useState("");
  const [selectedUser, setSelectedUser]   = useState<CRMUser | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const filtered = USERS.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAction = (action: string, user: CRMUser) => {
    Alert.alert(action, `${action} para ${user.name}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", style: action === "Banir Usuário" ? "destructive" : "default" },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>CRM Usuários</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ gap: 4 }}>
          <Text style={[styles.heroTitle, { color: colors.navy }]}>CRM Usuários</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>Busca global e gestão de usuários</Text>
        </View>

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar por nome, email ou ID..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* User list */}
        <View style={[styles.userList, { backgroundColor: "#fff", borderColor: colors.border }]}>
          {filtered.map((user, idx) => {
            const isSelected = selectedUser?.id === user.id;
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
                    <Text style={[styles.avatarText, { color: colors.gold }]}>{user.initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: colors.navy }]}>{user.name}</Text>
                    <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
                  </View>
                  <Feather name={isSelected ? "chevron-down" : "chevron-right"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>

                {/* Expanded detail */}
                {isSelected && (
                  <View style={[styles.detail, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                    {/* User card header */}
                    <View style={styles.detailHeader}>
                      <View style={[styles.detailAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                        <Text style={[styles.detailAvatarText, { color: colors.gold }]}>{user.initial}</Text>
                      </View>
                      <View>
                        <Text style={[styles.detailName, { color: colors.navy }]}>{user.name}</Text>
                        <Text style={[styles.detailEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
                      </View>
                    </View>

                    {/* Info 2x2 grid */}
                    <View style={styles.infoGrid}>
                      {[
                        { label: "Plano", value: user.plan },
                        { label: "Posts", value: String(user.posts) },
                        { label: "Cadastro", value: user.date },
                        { label: "Áreas", value: user.areas },
                      ].map((item) => (
                        <View key={item.label} style={[styles.infoCell, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <Text style={[styles.infoCellLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                          <Text style={[styles.infoCellValue, { color: colors.navy }]}>{item.value}</Text>
                        </View>
                      ))}
                    </View>

                    {/* ID */}
                    <Text style={[styles.idText, { color: colors.mutedForeground }]}>ID: {user.id}</Text>

                    {/* Danger zone */}
                    <Text style={[styles.dangerTitle, { color: colors.gold }]}>ZONA DE PERIGO</Text>
                    <TouchableOpacity
                      style={[styles.dangerBtn, { borderColor: colors.border }]}
                      onPress={() => handleAction("Resetar Senha", user)}
                    >
                      <Feather name="key" size={15} color={colors.foreground} />
                      <Text style={[styles.dangerBtnText, { color: colors.foreground }]}>Resetar Senha</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dangerBtn, { borderColor: colors.border }]}
                      onPress={() => handleAction("Aplicar Shadowban", user)}
                    >
                      <Feather name="eye-off" size={15} color={colors.foreground} />
                      <Text style={[styles.dangerBtnText, { color: colors.foreground }]}>Aplicar Shadowban</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dangerBtn, { borderColor: "#dc2626" }]}
                      onPress={() => handleAction("Banir Usuário", user)}
                    >
                      <Feather name="slash" size={15} color="#dc2626" />
                      <Text style={[styles.dangerBtnText, { color: "#dc2626" }]}>Banir Usuário</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/crm" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:     { fontSize: 18, fontWeight: "700" },
  heroTitle:       { fontSize: 22, fontWeight: "800" },
  heroSub:         { fontSize: 13 },
  searchBox:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  searchInput:     { flex: 1, fontSize: 14 },
  userList:        { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  userRow:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar:          { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText:      { fontSize: 14, fontWeight: "700" },
  userName:        { fontSize: 14, fontWeight: "600" },
  userEmail:       { fontSize: 12, marginTop: 1 },
  detail:          { padding: 16, gap: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  detailHeader:    { flexDirection: "row", alignItems: "center", gap: 14 },
  detailAvatar:    { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  detailAvatarText:{ fontSize: 20, fontWeight: "800" },
  detailName:      { fontSize: 16, fontWeight: "700" },
  detailEmail:     { fontSize: 13, marginTop: 2 },
  infoGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoCell:        { width: "47%", borderRadius: 8, borderWidth: 1, padding: 10, gap: 3 },
  infoCellLabel:   { fontSize: 11 },
  infoCellValue:   { fontSize: 14, fontWeight: "700" },
  idText:          { fontSize: 11, fontFamily: "monospace" },
  dangerTitle:     { fontSize: 12, fontWeight: "800", letterSpacing: 0.5, marginTop: 4 },
  dangerBtn:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 10, borderWidth: 1 },
  dangerBtnText:   { fontSize: 14, fontWeight: "600" },
});
