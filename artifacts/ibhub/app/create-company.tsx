import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { createCompanyPage, uploadCompanyLogo } from "@/services/api";

const CATEGORIES: string[] = [
  "Vinícola", "Adega / Cave",
  "Importadora", "Exportadora", "Distribuidora", "Atacadista", "Representante Comercial",
  "Enoteca", "Loja Especializada", "Supermercado", "E-commerce",
  "Restaurante", "Hotelaria", "Bar / Bistrô",
  "Enoturismo", "Eventos", "Marketing / Agência", "Jornalismo / Imprensa", "Educação",
  "Consultoria", "Outros",
];

function sanitizeUsername(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export default function CreateCompanyScreen() {
  const colors = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const [name,     setName]     = useState("");
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [bio,      setBio]      = useState("");
  const [website,  setWebsite]  = useState("");
  const [logoUri,  setLogoUri]  = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const handlePickLogo = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de acesso à galeria para selecionar a logo.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("O nome da empresa é obrigatório."); return; }
    if (!user?.id) return;
    setError("");
    setSaving(true);

    const created = await createCompanyPage({
      owner_id: user.id,
      name: name.trim(),
      username: username.trim() || undefined,
      industry: category || undefined,
      bio: bio.trim() || undefined,
      website: website.trim() || undefined,
      location: location.trim() || undefined,
    });

    if (!created) {
      setError("Não foi possível criar a página. Verifique se o username já está em uso.");
      setSaving(false);
      return;
    }

    if (logoUri) {
      await uploadCompanyLogo(created.id, logoUri);
    }

    setSaving(false);
    router.replace(`/manage-business-page?id=${created.id}` as any);
  };

  const inputStyle = [styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.gold} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Criar Página Empresarial</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Presença da sua empresa no ibhub</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo picker */}
        <View style={styles.logoRow}>
          <TouchableOpacity style={styles.logoWrap} onPress={handlePickLogo} activeOpacity={0.8}>
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
                style={styles.logoImg}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: colors.gold + "22", borderColor: colors.gold }]}>
                <Feather name="camera" size={26} color={colors.gold} />
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Logo da empresa</Text>
            <TouchableOpacity
              style={[styles.logoBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={handlePickLogo}
            >
              <Text style={[styles.logoBtnText, { color: colors.foreground }]}>
                {logoUri ? "✓ Imagem selecionada" : "Selecionar logo"}
              </Text>
            </TouchableOpacity>
            {logoUri && (
              <TouchableOpacity onPress={() => setLogoUri(null)}>
                <Text style={[styles.removeText, { color: colors.mutedForeground }]}>Remover</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
              PNG, JPG ou WEBP. Pode ser adicionada depois.
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Nome */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
            Nome da empresa <Text style={{ color: "#dc2626" }}>*</Text>
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="Ex: Vinícola Exemplo"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            maxLength={100}
            returnKeyType="next"
          />
        </View>

        {/* Username */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Username da página</Text>
          <View style={styles.usernameRow}>
            <View style={[styles.atBox, { backgroundColor: colors.border }]}>
              <Text style={[styles.atText, { color: colors.mutedForeground }]}>@</Text>
            </View>
            <TextInput
              style={[inputStyle, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
              placeholder="nome-da-empresa"
              placeholderTextColor={colors.mutedForeground}
              value={username}
              onChangeText={v => setUsername(sanitizeUsername(v))}
              autoCapitalize="none"
              maxLength={50}
              returnKeyType="next"
            />
          </View>
          <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
            Letras minúsculas, números, pontos e traços.
          </Text>
        </View>

        {/* Setor */}
        <View style={{ gap: 8 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Setor</Text>
          <View style={styles.chipsWrap}>
            {CATEGORIES.map(cat => {
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.gold : colors.card,
                      borderColor: active ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => setCategory(active ? "" : cat)}
                >
                  <Text style={[styles.chipText, { color: active ? colors.navy : colors.mutedForeground }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Localização */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Localização</Text>
          <TextInput
            style={inputStyle}
            placeholder="Ex: São Paulo, SP"
            placeholderTextColor={colors.mutedForeground}
            value={location}
            onChangeText={setLocation}
            maxLength={100}
            returnKeyType="next"
          />
        </View>

        {/* Descrição */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Descrição</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            placeholder="Descreva sua empresa, missão e diferenciais…"
            placeholderTextColor={colors.mutedForeground}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{bio.length}/500</Text>
        </View>

        {/* Website */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Website</Text>
          <TextInput
            style={inputStyle}
            placeholder="https://suaempresa.com.br"
            placeholderTextColor={colors.mutedForeground}
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            autoCapitalize="none"
            maxLength={200}
            returnKeyType="done"
          />
        </View>

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.gold + "12", borderColor: colors.gold + "30" }]}>
          <Text style={{ fontSize: 18 }}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Você poderá completar depois</Text>
            <Text style={[styles.infoDesc, { color: colors.mutedForeground }]}>
              Após criar, você será redirecionado para as configurações para adicionar equipe, produtos e publicar vagas.
            </Text>
          </View>
        </View>

        {/* Error */}
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.createBtn,
              { backgroundColor: saving || !name.trim() ? colors.border : colors.navy },
            ]}
            onPress={handleCreate}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.createBtnText, { color: saving || !name.trim() ? colors.mutedForeground : "#fff" }]}>
                🏢 Criar Página
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  headerSub:   { fontSize: 12, marginTop: 1 },
  logoRow:     { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  logoWrap:    { flexShrink: 0 },
  logoImg:     { width: 72, height: 72, borderRadius: 12 },
  logoPlaceholder: {
    width: 72, height: 72, borderRadius: 12,
    borderWidth: 2, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  logoBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1,
    alignItems: "center",
  },
  logoBtnText: { fontSize: 13, fontWeight: "600" },
  removeText:  { fontSize: 12 },
  divider:     { height: StyleSheet.hairlineWidth },
  fieldLabel:  { fontSize: 13, fontWeight: "700" },
  fieldHint:   { fontSize: 11, lineHeight: 16 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 14,
  },
  usernameRow: { flexDirection: "row" },
  atBox: {
    paddingHorizontal: 12,
    justifyContent: "center",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  atText: { fontSize: 15, fontWeight: "600" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  textArea: { minHeight: 100, paddingTop: 11 },
  charCount: { fontSize: 11, textAlign: "right" },
  infoBanner: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoTitle: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
  infoDesc:  { fontSize: 12, lineHeight: 17 },
  errorBox:  { borderRadius: 10, borderWidth: 1, padding: 12 },
  errorText: { fontSize: 13, color: "#dc2626" },
  cancelBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700" },
  createBtn: {
    flex: 2, paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: { fontSize: 15, fontWeight: "800" },
});
