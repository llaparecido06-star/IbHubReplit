import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
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
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { updateProfile, uploadAvatar, checkUsernameAvailable } from "@/services/api";

const AREAS = [
  "Sommelier", "Produtor", "Importador", "Exportador", "Distribuidor",
  "Enoturismo", "Marketing", "Jornalismo", "Educação", "Consultoria",
  "Enólogo", "Restaurateur",
];

type UsernameStatus = "idle" | "checking" | "available" | "unavailable";

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

  const [avatarUri, setAvatarUri]     = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const isDirty = useCallback(() => {
    return (
      fullName   !== (profile?.full_name    ?? "") ||
      username   !== (profile?.username     ?? "") ||
      bio        !== (profile?.bio          ?? "") ||
      company    !== (profile?.company      ?? "") ||
      position   !== (profile?.position     ?? "") ||
      website    !== (profile?.website      ?? "") ||
      linkedin   !== (profile?.linkedin     ?? "") ||
      instagram  !== (profile?.instagram    ?? "") ||
      avatarChanged ||
      JSON.stringify(selectedAreas)     !== JSON.stringify(profile?.areas_of_expertise  ?? []) ||
      JSON.stringify(certifications)    !== JSON.stringify(
        Array.isArray(profile?.certifications) ? profile.certifications : []
      )
    );
  }, [fullName, username, bio, company, position, website, linkedin, instagram,
      selectedAreas, certifications, avatarChanged, profile]);

  const handleBack = () => {
    if (isDirty()) {
      Alert.alert(
        "Alterações não salvas",
        "Você tem alterações que não foram salvas. Deseja sair mesmo assim?",
        [
          { text: "Continuar editando", style: "cancel" },
          { text: "Sair sem salvar", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos de acesso à sua galeria para alterar a foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarChanged(true);
    }
  };

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    if (!val.trim() || val.trim() === (profile?.username ?? "")) {
      setUsernameStatus("idle");
      return;
    }
    if (val.trim().length < 3) {
      setUsernameStatus("unavailable");
      return;
    }
    setUsernameStatus("checking");
    usernameDebounce.current = setTimeout(async () => {
      if (!user?.id) return;
      const available = await checkUsernameAvailable(val.trim(), user.id);
      setUsernameStatus(available ? "available" : "unavailable");
    }, 600);
  };

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
    if (usernameStatus === "unavailable") {
      Alert.alert("Atenção", "O nome de usuário informado não está disponível.");
      return;
    }
    setSaving(true);

    let finalAvatarUrl: string | null | undefined = undefined;
    if (avatarChanged && avatarUri) {
      setUploadingAvatar(true);
      const uploaded = await uploadAvatar(user.id, avatarUri);
      setUploadingAvatar(false);
      if (!uploaded) {
        Alert.alert("Aviso", "Não foi possível fazer upload da foto, mas o resto do perfil será salvo.");
      } else {
        finalAvatarUrl = uploaded;
      }
    }

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
      ...(finalAvatarUrl !== undefined ? { avatar_url: finalAvatarUrl } : {}),
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

  const name = fullName || profile?.full_name || "?";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
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
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.navy }]}>
              <Text style={[styles.avatarInitial, { color: colors.gold }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.cameraBtn, { backgroundColor: colors.gold }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            <Feather name={uploadingAvatar ? "loader" : "camera"} size={13} color="#fff" />
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
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
            />
            <View style={[styles.checkIcon, { backgroundColor: "#fff", borderColor: colors.border }]}>
              {usernameStatus === "idle"        && <Feather name="minus" size={16} color={colors.mutedForeground} />}
              {usernameStatus === "checking"    && <Feather name="loader" size={16} color={colors.mutedForeground} />}
              {usernameStatus === "available"   && <Feather name="check" size={16} color="#22c55e" />}
              {usernameStatus === "unavailable" && <Feather name="x" size={16} color="#dc2626" />}
            </View>
          </View>
          {usernameStatus === "available"   && <Text style={[styles.usernameHint, { color: "#22c55e" }]}>Disponível</Text>}
          {usernameStatus === "unavailable" && <Text style={[styles.usernameHint, { color: "#dc2626" }]}>Indisponível ou muito curto</Text>}
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
  avatarImg:    { width: 88, height: 88, borderRadius: 44 },
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
  usernameHint: { fontSize: 12, marginTop: -4 },
});
