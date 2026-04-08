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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { updateProfile } from "@/services/api";

const AREAS = [
  "Sommelier", "Produtor", "Importador", "Exportador", "Distribuidor",
  "Enoturismo", "Marketing", "Jornalismo", "Educação", "Consultoria",
  "Enólogo", "Restaurateur",
];

export default function EditProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName]       = useState(profile?.full_name    ?? "");
  const [username, setUsername]       = useState(profile?.username     ?? "");
  const [bio, setBio]                 = useState(profile?.bio          ?? "");
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    profile?.areas_of_expertise ?? []
  );
  const [company, setCompany]         = useState(profile?.company      ?? "");
  const [position, setPosition]       = useState(profile?.position     ?? "");
  const [certifications, setCertifications] = useState<string[]>(
    Array.isArray(profile?.certifications) ? profile.certifications : []
  );
  const [certInput, setCertInput]     = useState("");
  const [website, setWebsite]         = useState(profile?.website      ?? "");
  const [linkedin, setLinkedin]       = useState(profile?.linkedin     ?? "");
  const [instagram, setInstagram]     = useState(profile?.instagram    ?? "");
  const [saving, setSaving]           = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) => {
      if (prev.includes(area)) return prev.filter((a) => a !== area);
      if (prev.length >= 3) {
        Alert.alert("Limite atingido", "Selecione no máximo 3 áreas de atuação.");
        return prev;
      }
      return [...prev, area];
    });
  };

  const addCertification = () => {
    const trimmed = certInput.trim();
    if (!trimmed) return;
    if (certifications.includes(trimmed)) {
      setCertInput("");
      return;
    }
    setCertifications((prev) => [...prev, trimmed]);
    setCertInput("");
  };

  const removeCertification = (cert: string) => {
    setCertifications((prev) => prev.filter((c) => c !== cert));
  };

  const handleSave = async () => {
    if (!fullName.trim()) { Alert.alert("Atenção", "Nome completo é obrigatório."); return; }
    if (!user?.id) { Alert.alert("Erro", "Sessão expirada. Faça login novamente."); return; }
    setSaving(true);
    const ok = await updateProfile(user.id, {
      full_name:          fullName.trim(),
      username:           username.trim() || undefined,
      bio:                bio.trim() || null,
      areas_of_expertise: selectedAreas,
      company:            company.trim() || null,
      position:           position.trim() || null,
      website:            website.trim() || null,
      linkedin:           linkedin.trim() || null,
      instagram:          instagram.trim() || null,
      certifications,
    });
    setSaving(false);
    if (!ok) {
      Alert.alert("Erro", "Não foi possível salvar o perfil. Verifique se o nome de usuário já está em uso e tente novamente.");
      return;
    }
    try { await refreshProfile?.(); } catch {}
    Alert.alert("Salvo!", "Perfil atualizado com sucesso.");
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Editar Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.gold + "88" : colors.gold }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Feather name="save" size={14} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? "Salvando..." : "Salvar"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: colors.navy }]}>
            <Text style={[styles.avatarInitial, { color: colors.gold }]}>
              {fullName.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>
          <TouchableOpacity style={[styles.cameraBtn, { backgroundColor: colors.gold }]}>
            <Feather name="camera" size={13} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Nome completo */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Nome completo *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Username */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Nome de usuário</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <View style={[styles.checkIcon, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Feather name="check" size={16} color="#22c55e" />
            </View>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={bio}
            onChangeText={(v) => { if (v.length <= 200) setBio(v); }}
            multiline
            textAlignVertical="top"
            placeholder="Fale sobre você..."
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{bio.length}/200</Text>
        </View>

        {/* Áreas de atuação */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Áreas de atuação (máx. 3)</Text>
          <View style={styles.chips}>
            {AREAS.map((area) => {
              const active = selectedAreas.includes(area);
              return (
                <TouchableOpacity
                  key={area}
                  style={[styles.chip, { backgroundColor: active ? colors.gold : "#fff", borderColor: active ? colors.gold : colors.border }]}
                  onPress={() => toggleArea(area)}
                >
                  <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>{area}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Empresa */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Empresa</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={company}
            onChangeText={setCompany}
          />
        </View>

        {/* Cargo */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Cargo</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={position}
            onChangeText={setPosition}
          />
        </View>

        {/* Certificações — chips */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Certificações</Text>
          {certifications.length > 0 && (
            <View style={styles.chips}>
              {certifications.map((cert) => (
                <View key={cert} style={[styles.certChip, { backgroundColor: colors.navy + "14", borderColor: colors.navy + "30" }]}>
                  <Text style={[styles.certChipText, { color: colors.navy }]}>{cert}</Text>
                  <TouchableOpacity onPress={() => removeCertification(cert)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={13} color={colors.navy} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Ex: WSET Level 3"
              placeholderTextColor={colors.mutedForeground}
              value={certInput}
              onChangeText={setCertInput}
              onSubmitEditing={addCertification}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.gold }]}
              onPress={addCertification}
            >
              <Feather name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Website */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Website</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            placeholder="https://"
            placeholderTextColor={colors.mutedForeground}
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* LinkedIn */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>LinkedIn</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={linkedin}
            onChangeText={setLinkedin}
            autoCapitalize="none"
          />
        </View>

        {/* Instagram */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Instagram</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            placeholder="@"
            placeholderTextColor={colors.mutedForeground}
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow:      { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle:  { fontSize: 20, fontWeight: "700" },
  saveBtn:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  saveBtnText:  { color: "#fff", fontSize: 14, fontWeight: "700" },
  avatarWrap:   { alignSelf: "center", position: "relative" },
  avatar:       { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarInitial:{ fontSize: 36, fontWeight: "800" },
  cameraBtn:    { position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  field:        { gap: 8 },
  label:        { fontSize: 14, fontWeight: "600" },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  inputRow:     { flexDirection: "row", gap: 8, alignItems: "center" },
  inputFlex:    { flex: 1 },
  checkIcon:    { width: 44, height: 46, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  textarea:     { height: 90, textAlignVertical: "top" },
  charCount:    { fontSize: 12, textAlign: "right", marginTop: -4 },
  chips:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:         { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText:     { fontSize: 13 },
  certChip:     { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  certChipText: { fontSize: 13 },
  addBtn:       { width: 46, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
