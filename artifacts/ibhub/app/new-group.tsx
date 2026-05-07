import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallScreen } from "@/components/ui/PaywallScreen";
import { supabase } from "@/context/AuthContext";
import { createGroup, uploadGroupAvatar } from "@/services/api";

type AccessType = "aberto" | "fechado" | "restrito";

const CATEGORIES = [
  "Viticultor", "Produtor", "Enólogo", "Adega / Cave",
  "Importador", "Exportador", "Distribuidor", "Atacadista", "Representante Comercial",
  "Loja Especializada", "Supermercado", "E-commerce", "Adega",
  "Sommelier", "Restaurante", "Hotelaria", "Bar / Bistrô",
  "Enoturismo", "Eventos", "Marketing", "Jornalismo", "Educação",
  "Consultoria", "Comprador", "Investidor", "Entusiasta", "Outros",
];

const ACCESS_OPTIONS: { value: AccessType; label: string; desc: string; icon: any }[] = [
  { value: "aberto",   label: "Aberto",   desc: "Qualquer pessoa pode entrar",   icon: "globe" },
  { value: "fechado",  label: "Fechado",  desc: "Precisa de aprovação do admin",  icon: "lock" },
  { value: "restrito", label: "Restrito", desc: "Somente por convite",           icon: "shield" },
];

export default function NewGroupScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const { hasFeature, isLoading: permLoading } = usePermissions();
  const userId = profile?.id ?? user?.id ?? "";

  const [name, setName]           = useState("");
  const [category, setCategory]   = useState<string | null>(null);
  const [desc, setDesc]           = useState("");
  const [access, setAccess]       = useState<AccessType>("aberto");
  const [loading, setLoading]     = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const canCreate = name.trim().length > 0 && category !== null;

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("new_group_screen.permission_title"), t("new_group_screen.permission_msg"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!canCreate) {
      Alert.alert(t("new_group_screen.validation_title"), t("new_group_screen.validation_msg"));
      return;
    }
    if (!userId) {
      Alert.alert(t("common.error"), t("new_group_screen.error_auth"));
      return;
    }
    setLoading(true);
    const group = await createGroup({
      owner_id: userId,
      name: name.trim(),
      description: desc.trim() || undefined,
      category: category!,
      access,
    });
    if (!group) {
      setLoading(false);
      Alert.alert(t("common.error"), t("new_group_screen.error_create"));
      return;
    }
    // Upload avatar if selected
    if (avatarUri) {
      const url = await uploadGroupAvatar(avatarUri, userId, group.id);
      if (url) {
        await supabase.from("groups").update({ avatar_url: url }).eq("id", group.id);
      }
    }
    setLoading(false);
    router.replace(`/group-chat/${group.id}` as any);
  };

  if (permLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!hasFeature("Criar Grupos")) {
    return (
      <PaywallScreen
        featureName="Criar Grupos"
        description="Crie e gerencie grupos temáticos para conectar profissionais do vinho."
        requiredPlan="Profissional"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? topPad + 50 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>{t("new_group_screen.cancel")}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("new_group_screen.header_title")}</Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: canCreate ? colors.gold : colors.border }]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={[styles.createBtnText, { color: canCreate ? "#fff" : colors.mutedForeground }]}>
            {loading ? t("new_group_screen.creating") : t("new_group_screen.create_btn")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Avatar picker */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.navy + "12", borderColor: colors.border }]}>
                <Feather name="camera" size={24} color={colors.mutedForeground} />
              </View>
            )}
            <View style={[styles.avatarBadge, { backgroundColor: colors.gold }]}>
              <Feather name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>{t("new_group_screen.avatar_hint")}</Text>
        </View>

        {/* Group name */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.navy }]}>{t("new_group_screen.field_name_label")}</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
            placeholder={t("new_group_screen.field_name_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.navy }]}>{t("new_group_screen.field_category_label")}</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: category === cat ? colors.navy : "#fff",
                    borderColor: category === cat ? colors.navy : colors.border,
                  },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.catChipText, { color: category === cat ? "#fff" : colors.foreground }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.navy }]}>{t("new_group_screen.field_desc_label")}</Text>
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder={t("new_group_screen.field_desc_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={4}
            maxLength={300}
          />
        </View>

        {/* Access type */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.navy }]}>{t("new_group_screen.field_access_label")}</Text>
          <View style={styles.accessList}>
            {ACCESS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.accessOption,
                  {
                    backgroundColor: "#fff",
                    borderColor: access === opt.value ? colors.gold : colors.border,
                    borderWidth: access === opt.value ? 2 : 1,
                  },
                ]}
                onPress={() => setAccess(opt.value)}
              >
                <View style={[styles.accessIconWrap, { backgroundColor: access === opt.value ? colors.gold + "20" : colors.background }]}>
                  <Feather name={opt.icon} size={20} color={access === opt.value ? colors.gold : colors.mutedForeground} />
                </View>
                <View style={styles.accessText}>
                  <Text style={[styles.accessLabel, { color: colors.navy }]}>
                    {opt.value === "aberto" ? t("new_group_screen.access_open_label")
                      : opt.value === "fechado" ? t("new_group_screen.access_closed_label")
                      : t("new_group_screen.access_restricted_label")}
                  </Text>
                  <Text style={[styles.accessDesc, { color: colors.mutedForeground }]}>
                    {opt.value === "aberto" ? t("new_group_screen.access_open_desc")
                      : opt.value === "fechado" ? t("new_group_screen.access_closed_desc")
                      : t("new_group_screen.access_restricted_desc")}
                  </Text>
                </View>
                {access === opt.value && (
                  <Feather name="check-circle" size={20} color={colors.gold} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  cancelText:   { fontSize: 15 },
  headerTitle:  { fontSize: 17, fontWeight: "700" },
  createBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  createBtnText:{ fontSize: 14, fontWeight: "700" },
  scroll:       { padding: 16, gap: 24 },
  avatarSection:{ alignItems: "center", paddingVertical: 8, gap: 8 },
  avatarWrap:   { position: "relative" },
  avatarImg:    { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  avatarBadge:  { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarHint:   { fontSize: 13 },
  field:        { gap: 10 },
  fieldLabel:   { fontSize: 15, fontWeight: "700" },
  textInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  catGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip:  { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  catChipText: { fontSize: 13, fontWeight: "500" },
  accessList:  { gap: 10 },
  accessOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 14, borderRadius: 12,
  },
  accessIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  accessText:     { flex: 1 },
  accessLabel:    { fontSize: 15, fontWeight: "700" },
  accessDesc:     { fontSize: 13, marginTop: 2 },
});
