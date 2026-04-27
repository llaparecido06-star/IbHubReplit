import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { ensureReferralCode } from "@/services/api";

const AREAS = [
  "Sommelier", "Comprador", "Importador", "Produtor",
  "Enólogo", "Consultor", "Investidor", "Entusiasta", "Outros",
];

export default function SocialCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile, clearProfileCompletion } = useAuth();

  const [fullName,   setFullName]   = useState("");
  const [username,   setUsername]   = useState("");
  const [position,   setPosition]   = useState("");
  const [areas,      setAreas]      = useState<string[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Derived from user metadata — never editable
  const oauthEmail  = user?.email ?? null;
  const oauthAvatar = (() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (meta.avatar_url ?? meta.picture ?? null) as string | null;
  })();

  // Pre-fill editable fields from OAuth metadata
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name = ((meta.full_name ?? meta.name ?? "") as string).trim();
    if (name) setFullName(name);

    const suggestion = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20);
    if (suggestion) setUsername(suggestion);
  }, [user]);

  const toggleArea = (a: string) => {
    setAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    if (!fullName.trim())   { setError("Insira seu nome completo"); return; }
    if (!username.trim())   { setError("Escolha um nome de usuário"); return; }
    if (areas.length === 0) { setError("Selecione pelo menos uma área de atuação"); return; }

    setLoading(true);
    setError(null);

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.trim().toLowerCase())
      .neq("id", user.id)
      .maybeSingle();
    if (taken) { setError("Esse nome de usuário já está em uso"); setLoading(false); return; }

    const { error: upsertErr } = await supabase.from("profiles").upsert({
      id: user.id,
      user_id: user.id,
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      position: position.trim() || null,
      areas_of_expertise: areas,
      areas,
      plan: "basico",
      created_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (upsertErr) {
      setError("Erro ao salvar perfil. Tente novamente.");
      setLoading(false);
      return;
    }

    await ensureReferralCode(user.id);

    if (oauthAvatar) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!existing?.avatar_url) {
        await supabase.from("profiles").update({ avatar_url: oauthAvatar }).eq("id", user.id);
      }
    }

    await refreshProfile();
    clearProfileCompletion();
    setLoading(false);
    router.replace("/(tabs)" as any);
  }, [user, fullName, username, position, areas, oauthAvatar, refreshProfile, clearProfileCompletion, router]);

  return (
    <View style={styles.root}>
      <View style={styles.topBand} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar + header */}
          <View style={styles.header}>
            {oauthAvatar ? (
              <Image source={{ uri: oauthAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={32} color="#8fa3b8" />
              </View>
            )}
            <Text style={styles.title}>Finalize seu cadastro</Text>
            <Text style={styles.subtitle}>Só mais algumas informações para completar seu perfil profissional.</Text>
          </View>

          <View style={styles.card}>
            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#c0392b" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email — read-only, from Google */}
            {oauthEmail && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>E-mail</Text>
                <View style={[styles.fieldWrap, styles.fieldWrapReadOnly]}>
                  <Feather name="mail" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                  <Text style={styles.fieldReadOnly}>{oauthEmail}</Text>
                  <Feather name="lock" size={13} color="#b0bec9" />
                </View>
                <Text style={styles.fieldHint}>Importado da sua conta Google — não é possível alterar aqui.</Text>
              </View>
            )}

            {/* Full name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nome completo <Text style={styles.required}>*</Text></Text>
              <View style={styles.fieldWrap}>
                <Feather name="user" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Seu nome"
                  placeholderTextColor="#aab4c0"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nome de usuário <Text style={styles.required}>*</Text></Text>
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldIcon, { color: "#8fa3b8", fontSize: 15, lineHeight: 20 }]}>@</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="seunome"
                  placeholderTextColor="#aab4c0"
                  value={username}
                  onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.fieldHint}>Apenas letras minúsculas, números, _ e .</Text>
            </View>

            {/* Position */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Cargo / função <Text style={styles.optional}>(opcional)</Text></Text>
              <View style={styles.fieldWrap}>
                <Feather name="briefcase" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Ex: Sommelier, Importador..."
                  placeholderTextColor="#aab4c0"
                  value={position}
                  onChangeText={setPosition}
                />
              </View>
            </View>

            {/* Areas */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Área de atuação <Text style={styles.required}>*</Text></Text>
              <Text style={styles.fieldHint}>Selecione uma ou mais áreas</Text>
              <View style={styles.areasWrap}>
                {AREAS.map(a => {
                  const sel = areas.includes(a);
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[styles.areaChip, sel && styles.areaChipSel]}
                      onPress={() => toggleArea(a)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.areaChipText, sel && styles.areaChipTextSel]}>{a}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (loading || areas.length === 0 || !fullName.trim() || !username.trim()) && styles.primaryBtnDisabled]}
              onPress={handleSave}
              disabled={loading || areas.length === 0 || !fullName.trim() || !username.trim()}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Entrar no ibhub</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: "#f4f5f7" },
  topBand:  { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: "#c9a84c" },
  scroll:   { paddingHorizontal: 24, flexGrow: 1 },

  header:   { alignItems: "center", marginBottom: 24, gap: 12 },
  avatar:   { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: "#c9a84c" },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#e8edf3", alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#dde4ed",
  },
  title:    { fontSize: 22, fontWeight: "800", color: "#0d1b2a", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#5a7a99", lineHeight: 20, textAlign: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    gap: 16,
    shadowColor: "#0d1b2a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  errorBox:  { flexDirection: "row", alignItems: "center", backgroundColor: "#fdecea", borderRadius: 8, padding: 10 },
  errorText: { fontSize: 13, color: "#c0392b", flex: 1 },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#0d1b2a" },
  fieldHint:  { fontSize: 11, color: "#8fa3b8" },
  required:   { color: "#c0392b" },
  optional:   { color: "#8fa3b8", fontWeight: "400" },

  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dde4ed",
    borderRadius: 10,
    backgroundColor: "#f8f9fb",
    paddingHorizontal: 12,
    height: 46,
  },
  fieldWrapReadOnly: {
    backgroundColor: "#f0f3f7",
    borderColor: "#e0e6ef",
  },
  fieldIcon:      { marginRight: 8 },
  fieldInput:     { flex: 1, fontSize: 15, color: "#0d1b2a" },
  fieldReadOnly:  { flex: 1, fontSize: 15, color: "#5a7a99" },

  areasWrap:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  areaChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#dde4ed", backgroundColor: "#f8f9fb" },
  areaChipSel:    { borderColor: "#c9a84c", backgroundColor: "#fdf6e7" },
  areaChipText:   { fontSize: 13, color: "#5a7a99", fontWeight: "500" },
  areaChipTextSel:{ color: "#b5862a", fontWeight: "700" },

  primaryBtn:         { backgroundColor: "#0d1b2a", borderRadius: 12, height: 50, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },
});
