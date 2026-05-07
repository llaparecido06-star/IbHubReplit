import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
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
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { updateProfile, uploadAvatar, checkUsernameAvailable } from "@/services/api";
import { useAsyncAction } from "@/hooks/useAsyncAction";

const AREAS = [
  // Produção
  "Viticultor", "Produtor", "Enólogo", "Adega / Cave",
  // Comércio exterior & distribuição
  "Importador", "Exportador", "Distribuidor", "Atacadista", "Representante Comercial",
  // Varejo & ponto de venda
  "Loja Especializada", "Supermercado", "E-commerce", "Adega",
  // Hospitalidade & serviço
  "Sommelier", "Restaurante", "Hotelaria", "Bar / Bistrô",
  // Experiências & comunicação
  "Enoturismo", "Eventos", "Marketing", "Jornalismo", "Educação",
  // Negócios & outros
  "Consultoria", "Comprador", "Investidor", "Entusiasta", "Outros",
];

type UsernameStatus = "idle" | "checking" | "available" | "unavailable";

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { user, profile, refreshProfile, patchProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName]       = useState(profile?.full_name    ?? "");
  const [username, setUsername]       = useState(profile?.username     ?? "");
  const [bio, setBio]                 = useState(profile?.bio          ?? "");
  const [phone, setPhone]             = useState(profile?.phone        ?? "");
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    profile?.areas_of_expertise ?? []
  );
  const [company, setCompany]         = useState(profile?.company      ?? "");
  const [position, setPosition]       = useState(profile?.position     ?? "");
  const [certifications, setCertifications] = useState<string[]>(
    Array.isArray(profile?.certifications) ? profile.certifications : []
  );
  const [certInput, setCertInput]     = useState("");

  const [avatarUri, setAvatarUri]     = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { execute: executeSave, isLoading: saving } = useAsyncAction(async () => {
    if (!user?.id) { Alert.alert(t("common.error"), t("common.session_expired")); return; }
    let finalAvatarUrl: string | null | undefined = undefined;
    if (avatarChanged && avatarUri) {
      setUploadingAvatar(true);
      try {
        const uploaded = await uploadAvatar(user.id, avatarUri);
        if (!uploaded) {
          Alert.alert(t("edit_profile.avatar_warning_title"), t("edit_profile.avatar_warning_msg"));
        } else {
          finalAvatarUrl = uploaded;
        }
      } finally {
        setUploadingAvatar(false);
      }
    }
    const ok = await updateProfile(user.id, {
      full_name:          fullName.trim(),
      username:           username.trim() || undefined,
      bio:                bio.trim() || undefined,
      phone:              phone.trim() || null,
      areas_of_expertise: selectedAreas,
      company:            company.trim() || null,
      position:           position.trim() || null,
      certifications,
      ...(finalAvatarUrl !== undefined ? { avatar_url: finalAvatarUrl } : {}),
    });
    if (!ok) {
      Alert.alert(t("common.error"), t("edit_profile.save_error"));
      return;
    }
    if (finalAvatarUrl) {
      setAvatarUri(finalAvatarUrl);
      setAvatarChanged(false);
      patchProfile({ avatar_url: finalAvatarUrl });
    }
    try { await refreshProfile?.(); } catch {}
    Alert.alert(t("edit_profile.saved_title"), t("edit_profile.saved_msg"));
    router.back();
  });

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const isDirty = useCallback(() => {
    return (
      fullName   !== (profile?.full_name    ?? "") ||
      username   !== (profile?.username     ?? "") ||
      bio        !== (profile?.bio          ?? "") ||
      phone      !== (profile?.phone        ?? "") ||
      company    !== (profile?.company      ?? "") ||
      position   !== (profile?.position     ?? "") ||
      avatarChanged ||
      JSON.stringify(selectedAreas)     !== JSON.stringify(profile?.areas_of_expertise  ?? []) ||
      JSON.stringify(certifications)    !== JSON.stringify(
        Array.isArray(profile?.certifications) ? profile.certifications : []
      )
    );
  }, [fullName, username, bio, phone, company, position,
      selectedAreas, certifications, avatarChanged, profile]);

  const handleBack = () => {
    if (isDirty()) {
      Alert.alert(
        t("edit_profile.unsaved_title"),
        t("edit_profile.unsaved_msg"),
        [
          { text: t("edit_profile.keep_editing"), style: "cancel" },
          { text: t("edit_profile.exit_no_save"), style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.permission_required"), t("edit_profile.gallery_permission"));
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
        Alert.alert(t("edit_profile.area_limit_title"), t("edit_profile.area_limit_msg"));
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

  const handleSave = () => {
    if (!fullName.trim()) { Alert.alert(t("common.attention"), t("edit_profile.error_name")); return; }
    if (usernameStatus === "unavailable") {
      Alert.alert(t("common.attention"), t("edit_profile.error_username_unavailable"));
      return;
    }
    executeSave();
  };

  const name = fullName || profile?.full_name || "?";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("edit_profile.title")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.gold + "88" : colors.gold }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Feather name="save" size={14} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? t("common.saving") : t("common.save")}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? topPad + 50 : 0}
      >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, rowGap: 18, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets bounces>
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
          <Text style={[styles.label, { color: colors.foreground }]}>{t("edit_profile.full_name")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Username */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("edit_profile.username")}</Text>
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
          {usernameStatus === "available"   && <Text style={[styles.usernameHint, { color: "#22c55e" }]}>{t("edit_profile.username_available")}</Text>}
          {usernameStatus === "unavailable" && <Text style={[styles.usernameHint, { color: "#dc2626" }]}>{t("edit_profile.username_unavailable")}</Text>}
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("edit_profile.bio")}</Text>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={bio}
            onChangeText={(v) => { if (v.length <= 200) setBio(v); }}
            multiline
            textAlignVertical="top"
            placeholder={t("edit_profile.bio_placeholder")}
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{bio.length}/200</Text>
        </View>

        {/* Telefone */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("edit_profile.phone")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="+55 11 99999-9999"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
          />
        </View>

        {/* Áreas de atuação */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("edit_profile.areas")}</Text>
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
          <Text style={[styles.label, { color: colors.foreground }]}>{t("edit_profile.company")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={company}
            onChangeText={setCompany}
          />
        </View>

        {/* Cargo */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("edit_profile.position")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            value={position}
            onChangeText={setPosition}
          />
        </View>

        {/* Certificações — chips */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("certifications.title")}</Text>
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
              placeholder={t("edit_profile.cert_placeholder")}
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

      </ScrollView>
      </KeyboardAvoidingView>
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
