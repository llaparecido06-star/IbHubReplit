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

const ACTIVE_ADMINS = [
  { name: "Lucas Lima",      email: "lucasla925@gmail.com"      },
  { name: "Maria Santos",    email: "lucas.lima@idealbi.com.br"  },
  { name: "Felipe Galtaroca",email: "felipe@idealbi.com.br"      },
];

export default function AdminAdminsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [nome, setNome]       = useState("");
  const [email, setEmail]     = useState("");
  const [senha, setSenha]     = useState("");
  const [recEmail, setRecEmail] = useState("");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const handleCreate = () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    Alert.alert("Admin criado!", `Admin ${nome} criado com sucesso.`);
    setNome(""); setEmail(""); setSenha("");
  };

  const handleRecovery = () => {
    if (!recEmail.trim()) { Alert.alert("Atenção", "Informe o e-mail."); return; }
    Alert.alert("E-mail enviado!", `E-mail de recuperação enviado para ${recEmail}.`);
    setRecEmail("");
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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Hero */}
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
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.navy }]} onPress={handleCreate}>
            <Text style={styles.createBtnText}>Criar Admin</Text>
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
          <TouchableOpacity style={[styles.recBtn, { borderColor: colors.border }]} onPress={handleRecovery}>
            <Text style={[styles.recBtnText, { color: colors.foreground }]}>Enviar E-mail de Recuperação</Text>
          </TouchableOpacity>
        </View>

        {/* Admins Ativos */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <Feather name="shield" size={15} color={colors.gold} />
            <Text style={[styles.cardTitle, { color: colors.navy }]}>Administradores Ativos</Text>
          </View>
          {ACTIVE_ADMINS.map((admin, i) => (
            <View
              key={admin.email}
              style={[
                styles.adminRow,
                { borderBottomColor: colors.border },
                i < ACTIVE_ADMINS.length - 1 && { borderBottomWidth: 1 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.adminName, { color: colors.navy }]}>{admin.name}</Text>
                <Text style={[styles.adminEmail, { color: colors.mutedForeground }]}>{admin.email}</Text>
              </View>
              <Feather name="shield" size={16} color={colors.gold} />
            </View>
          ))}
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/admins" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 18, fontWeight: "700" },
  heroTitle:    { fontSize: 22, fontWeight: "800" },
  card:         { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  cardHead:     { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle:    { fontSize: 15, fontWeight: "700" },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 },
  createBtn:    { paddingVertical: 15, borderRadius: 10, alignItems: "center" },
  createBtnText:{ color: "#fff", fontSize: 15, fontWeight: "700" },
  recBtn:       { paddingVertical: 15, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  recBtnText:   { fontSize: 14, fontWeight: "600" },
  adminRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  adminName:    { fontSize: 14, fontWeight: "600" },
  adminEmail:   { fontSize: 12, marginTop: 1 },
});
