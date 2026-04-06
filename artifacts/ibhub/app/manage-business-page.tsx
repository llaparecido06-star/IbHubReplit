import { useRouter } from "expo-router";
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
import { useColors } from "@/hooks/useColors";

type Tab = "preview" | "editar" | "equipe";
type RoleKey = "editor" | "moderador" | "visualizador";

const CATEGORIES = ["Vinícola", "Importadora", "Distribuidora", "Restaurante", "Enoteca", "Consultoria", "Enoturismo", "Outros"];
const ROLES: { key: RoleKey; label: string }[] = [
  { key: "editor",      label: "Editor" },
  { key: "moderador",   label: "Moderador" },
  { key: "visualizador",label: "Visualizador" },
];

export default function ManageBusinessPageScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>("preview");

  // Editar state
  const [companyName, setCompanyName] = useState("Ideal.BI");
  const [category, setCategory]       = useState("Consultoria");
  const [desc, setDesc]               = useState("");
  const [website, setWebsite]         = useState("");
  const [phone, setPhone]             = useState("");
  const [email, setEmail]             = useState("");
  const [address, setAddress]         = useState("");
  const [city, setCity]               = useState("");

  // Equipe state
  const [selectedRole, setSelectedRole] = useState<RoleKey>("editor");
  const [memberSearch, setMemberSearch] = useState("");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const handleDelete = () => {
    Alert.alert("Excluir página", "Esta ação é irreversível. Deseja continuar?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => router.back() },
    ]);
  };

  const handleSave = () => {
    Alert.alert("Salvo!", "As alterações foram salvas com sucesso.");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Página Empresarial</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "preview", label: "Preview", icon: "eye" },
          { key: "editar",  label: "Editar",  icon: "edit-2" },
          { key: "equipe",  label: "Equipe",  icon: "users" },
        ] as { key: Tab; label: string; icon: any }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={activeTab === t.key ? colors.gold : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: activeTab === t.key ? colors.gold : colors.mutedForeground }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* ── Preview ── */}
        {activeTab === "preview" && (
          <View style={{ padding: 16, gap: 16 }}>
            <View style={styles.previewCard}>
              <View style={[styles.companyLogo, { backgroundColor: colors.navy }]}>
                <Text style={[styles.companyLogoText, { color: colors.gold }]}>I</Text>
              </View>
              <Text style={[styles.previewName, { color: colors.navy }]}>{companyName}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: colors.gold + "18" }]}>
                <Text style={[styles.categoryBadgeText, { color: colors.gold }]}>{category}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.deletePageBtn, { borderColor: "#dc2626" }]}
              onPress={handleDelete}
            >
              <Feather name="trash-2" size={16} color="#dc2626" />
              <Text style={[styles.deletePageText, { color: "#dc2626" }]}>Excluir página</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Editar ── */}
        {activeTab === "editar" && (
          <View style={{ padding: 16, gap: 18 }}>
            {/* Logo with camera overlay */}
            <View style={styles.logoWrap}>
              <View style={[styles.companyLogoLarge, { backgroundColor: colors.navy }]}>
                <Text style={[styles.companyLogoLargeText, { color: colors.gold }]}>I</Text>
              </View>
              <TouchableOpacity style={[styles.cameraOverlay, { backgroundColor: colors.gold }]}>
                <Feather name="camera" size={14} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Nome da empresa *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                value={companyName}
                onChangeText={setCompanyName}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Categoria *</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, {
                      backgroundColor: category === cat ? colors.gold : "#fff",
                      borderColor: category === cat ? colors.gold : colors.border,
                    }]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catChipText, { color: category === cat ? "#fff" : colors.foreground }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Descrição</Text>
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="Sobre a empresa..."
                placeholderTextColor={colors.mutedForeground}
                value={desc}
                onChangeText={setDesc}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{desc.length}/500</Text>
            </View>

            {[
              { label: "Website",  value: website,  onChange: setWebsite,  placeholder: "" },
              { label: "Telefone", value: phone,    onChange: setPhone,    placeholder: "" },
              { label: "E-mail",   value: email,    onChange: setEmail,    placeholder: "" },
              { label: "Endereço", value: address,  onChange: setAddress,  placeholder: "" },
              { label: "Cidade",   value: city,     onChange: setCity,     placeholder: "Ex: São Paulo - SP" },
            ].map((f) => (
              <View key={f.label} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.navy }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={f.value}
                  onChangeText={f.onChange}
                />
              </View>
            ))}

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSave}>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Salvar alterações</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Equipe ── */}
        {activeTab === "equipe" && (
          <View style={{ padding: 16, gap: 16 }}>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.navy }]}>Adicionar membro</Text>
              <View style={styles.roleChips}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.roleChip, { backgroundColor: selectedRole === r.key ? colors.gold : "#fff", borderColor: selectedRole === r.key ? colors.gold : colors.border }]}
                    onPress={() => setSelectedRole(r.key)}
                  >
                    <Text style={[styles.roleChipText, { color: selectedRole === r.key ? "#fff" : colors.mutedForeground }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.memberSearchBar, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.memberSearchInput, { color: colors.foreground }]}
                  placeholder="Buscar usuário..."
                  placeholderTextColor={colors.mutedForeground}
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                />
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.teamSectionTitle, { color: colors.navy }]}>Equipe (0)</Text>
            <View style={styles.teamEmpty}>
              <Text style={[styles.teamEmptyText, { color: colors.mutedForeground }]}>Nenhum membro na equipe.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  tabLabel: { fontSize: 13, fontWeight: "600" },
  previewCard: { alignItems: "center", gap: 12, padding: 24, borderRadius: 12, borderWidth: 1, borderColor: "#e8eaed", backgroundColor: "#fff" },
  companyLogo: { width: 80, height: 80, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  companyLogoText: { fontSize: 32, fontWeight: "800" },
  previewName: { fontSize: 22, fontWeight: "800" },
  categoryBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  categoryBadgeText: { fontSize: 13, fontWeight: "600" },
  deletePageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5 },
  deletePageText: { fontSize: 15, fontWeight: "700" },
  logoWrap: { alignSelf: "center", position: "relative" },
  companyLogoLarge: { width: 100, height: 100, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  companyLogoLargeText: { fontSize: 40, fontWeight: "800" },
  cameraOverlay: { position: "absolute", bottom: -6, right: -6, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  field: { gap: 8 },
  fieldLabel: { fontSize: 15, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea: { height: 110, textAlignVertical: "top" },
  charCount: { fontSize: 12, textAlign: "right" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  catChipText: { fontSize: 13 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 10 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  roleChips: { flexDirection: "row", gap: 8 },
  roleChip: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  roleChipText: { fontSize: 13, fontWeight: "500" },
  memberSearchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  memberSearchInput: { flex: 1, fontSize: 14 },
  divider: { height: 1 },
  teamSectionTitle: { fontSize: 15, fontWeight: "700" },
  teamEmpty: { alignItems: "center", paddingVertical: 24 },
  teamEmptyText: { fontSize: 14 },
});
