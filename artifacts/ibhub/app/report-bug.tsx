import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";

type Severity = "Baixa" | "Média" | "Alta" | "Crítica";

const SEVERITIES: { value: Severity; label: string; color: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "Baixa",    label: "Baixa",   color: "#22c55e", icon: "chevron-down" },
  { value: "Média",    label: "Média",   color: "#f59e0b", icon: "minus" },
  { value: "Alta",     label: "Alta",    color: "#ef4444", icon: "chevron-up" },
  { value: "Crítica",  label: "Crítica", color: "#7c3aed", icon: "alert-triangle" },
];

export default function ReportBugScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [title, setTitle]         = useState("");
  const [severity, setSeverity]   = useState<Severity | "">("");
  const [description, setDesc]    = useState("");
  const [steps, setSteps]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  useEffect(() => {
    if (success) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [success]);

  const handleSubmit = async () => {
    setError(null);
    if (!user)           { setError("Você precisa estar autenticado para reportar um bug."); return; }
    if (!title.trim())   { setError("Informe o título do bug."); return; }
    if (!severity)       { setError("Selecione a severidade do bug."); return; }
    if (!description.trim()) { setError("Descreva o bug detalhadamente."); return; }

    setLoading(true);
    const { error: dbError } = await supabase.from("bug_reports").insert({
      user_id:     user.id,
      title:       title.trim(),
      severity,
      description: description.trim(),
      steps:       steps.trim() || null,
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível enviar o relatório. Tente novamente.");
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.navy} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Reportar Bug</Text>
          <View style={{ width: 22 }} />
        </View>
        <Animated.View style={[styles.successContainer, { opacity: opacityAnim }]}>
          <Animated.View style={[styles.successIcon, { backgroundColor: "#7c3aed20", transform: [{ scale: scaleAnim }] }]}>
            <Feather name="check-circle" size={52} color="#7c3aed" />
          </Animated.View>
          <Text style={[styles.successTitle, { color: colors.navy }]}>Bug reportado!</Text>
          <Text style={[styles.successBody, { color: colors.mutedForeground }]}>
            Obrigado por nos ajudar a melhorar o ibhub! Nossa equipe técnica vai investigar o problema em breve.
          </Text>
          <TouchableOpacity
            style={[styles.successBtn, { backgroundColor: colors.navy }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.successBtnText, { color: "#fff" }]}>Voltar às configurações</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Reportar Bug</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.infoCard, { backgroundColor: "#7c3aed15", borderColor: "#7c3aed35" }]}>
            <Feather name="alert-triangle" size={16} color="#7c3aed" />
            <Text style={[styles.infoText, { color: colors.navy }]}>
              Quanto mais detalhes você fornecer, mais rápido conseguiremos corrigir o problema. Obrigado!
            </Text>
          </View>

          {error && (
            <View style={[styles.errorBox, { borderColor: "#fecaca", backgroundColor: "#fff5f5" }]}>
              <Feather name="alert-circle" size={14} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.navy }]}>Título do bug</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.navy }]}
              placeholder="Ex: Tela de perfil não carrega imagem"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />

            <Text style={[styles.label, { color: colors.navy, marginTop: 16 }]}>Severidade</Text>
            <View style={styles.severityRow}>
              {SEVERITIES.map((sev) => (
                <TouchableOpacity
                  key={sev.value}
                  style={[
                    styles.severityChip,
                    { borderColor: severity === sev.value ? sev.color : colors.border },
                    severity === sev.value && { backgroundColor: sev.color + "18" },
                  ]}
                  onPress={() => setSeverity(sev.value)}
                >
                  <Feather name={sev.icon} size={14} color={severity === sev.value ? sev.color : colors.mutedForeground} />
                  <Text style={[styles.severityText, { color: severity === sev.value ? sev.color : colors.mutedForeground }]}>
                    {sev.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.navy, marginTop: 16 }]}>Descrição do bug</Text>
            <TextInput
              style={[styles.textarea, { borderColor: colors.border, color: colors.navy }]}
              placeholder="O que aconteceu? Qual era o comportamento esperado?"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDesc}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {description.length}/2000
            </Text>

            <Text style={[styles.label, { color: colors.navy, marginTop: 16 }]}>
              Passos para reproduzir{" "}
              <Text style={[styles.optional, { color: colors.mutedForeground }]}>(opcional)</Text>
            </Text>
            <TextInput
              style={[styles.textarea, { borderColor: colors.border, color: colors.navy }]}
              placeholder={"1. Abrir o app\n2. Navegar para Perfil\n3. Tocar em..."}
              placeholderTextColor={colors.mutedForeground}
              value={steps}
              onChangeText={setSteps}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: "#7c3aed" }, loading && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Enviar relatório</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:        { fontSize: 20, fontWeight: "700" },
  infoCard:           { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  infoText:           { fontSize: 13, lineHeight: 19, flex: 1 },
  errorBox:           { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  errorText:          { color: "#dc2626", fontSize: 13, flex: 1 },
  card:               { borderRadius: 12, borderWidth: 1, padding: 16 },
  label:              { fontSize: 13, fontWeight: "700", marginBottom: 8, letterSpacing: 0.3 },
  input:              { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  severityRow:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  severityChip:       { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5 },
  severityText:       { fontSize: 14, fontWeight: "600" },
  textarea:           { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 110 },
  charCount:          { fontSize: 12, textAlign: "right", marginTop: 6 },
  optional:           { fontWeight: "400" },
  submitBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 12 },
  submitBtnText:      { color: "#fff", fontSize: 16, fontWeight: "700" },
  successContainer:   { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  successIcon:        { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  successTitle:       { fontSize: 24, fontWeight: "800", textAlign: "center" },
  successBody:        { fontSize: 15, lineHeight: 23, textAlign: "center" },
  successBtn:         { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, marginTop: 8 },
  successBtnText:     { fontSize: 16, fontWeight: "700" },
});
