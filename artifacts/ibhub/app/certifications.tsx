import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallScreen } from "@/components/ui/PaywallScreen";
import { updateProfile } from "@/services/api";

const CERT_OPTIONS = [
  "WSET Level 1",
  "WSET Level 2",
  "WSET Level 3",
  "WSET Level 4 – Diploma",
  "CMS Introductory Sommelier",
  "CMS Certified Sommelier",
  "CMS Advanced Sommelier",
  "Master Sommelier",
  "ABEV Sommelier",
  "ISA Sommelier",
  "Enólogo – Bacharelado",
  "Outro",
];

export default function CertificationsScreen() {
  const colors = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user, profile, patchProfile } = useAuth();
  const { hasFeature, isLoading: permLoading } = usePermissions();

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const [certifications, setCertifications] = useState<string[]>(
    Array.isArray(profile?.certifications) ? profile.certifications : []
  );
  const [showForm, setShowForm]     = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedCert, setSelectedCert] = useState("");
  const [customCert, setCustomCert]     = useState("");
  const [saving, setSaving]             = useState(false);

  const handleAdd = async () => {
    const cert = (selectedCert === "Outro" ? customCert : selectedCert).trim();
    if (!cert) { Alert.alert("Atenção", "Selecione ou digite uma certificação."); return; }
    if (certifications.includes(cert)) {
      Alert.alert("Atenção", "Essa certificação já está na lista.");
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    const updated = [...certifications, cert];
    const ok = await updateProfile(user.id, { certifications: updated });
    setSaving(false);

    if (!ok) {
      Alert.alert("Erro", "Não foi possível salvar. Tente novamente.");
      return;
    }

    setCertifications(updated);
    patchProfile({ certifications: updated });
    setSelectedCert(""); setCustomCert(""); setShowForm(false); setShowPicker(false);
  };

  const handleRemove = (cert: string) => {
    Alert.alert("Remover certificação", `Deseja remover "${cert}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          if (!user?.id) return;
          const updated = certifications.filter((c) => c !== cert);
          const ok = await updateProfile(user.id, { certifications: updated });
          if (ok) {
            setCertifications(updated);
            patchProfile({ certifications: updated });
          }
        },
      },
    ]);
  };

  if (permLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!hasFeature("Upload Certificados")) {
    return (
      <PaywallScreen
        featureName="Upload de Certificados"
        description="Exiba suas certificações profissionais de vinho no seu perfil ibhub."
        requiredPlan="Profissional"
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Certificações</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* Add button */}
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.gold, backgroundColor: "#fff" }]}
          onPress={() => { setShowForm(!showForm); setShowPicker(false); }}
        >
          <Feather name="plus" size={16} color={colors.gold} />
          <Text style={[styles.addBtnText, { color: colors.gold }]}>Adicionar Certificação</Text>
        </TouchableOpacity>

        {/* Form */}
        {showForm && (
          <View style={[styles.formCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.navy }]}>Nova Certificação</Text>

            {/* Picker */}
            <TouchableOpacity
              style={[styles.pickerBtn, { borderColor: colors.border }]}
              onPress={() => setShowPicker(!showPicker)}
            >
              <Text style={[styles.pickerBtnText, { color: selectedCert ? colors.foreground : colors.mutedForeground }]}>
                {selectedCert || "Selecione a certificação"}
              </Text>
              <Feather name={showPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {showPicker && (
              <View style={[styles.pickerDropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                {CERT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.pickerOption,
                      { borderBottomColor: colors.border },
                      selectedCert === opt && { backgroundColor: colors.gold + "12" },
                    ]}
                    onPress={() => { setSelectedCert(opt); setShowPicker(false); }}
                  >
                    <Text style={[styles.pickerOptionText, { color: selectedCert === opt ? colors.gold : colors.foreground }]}>
                      {opt}
                    </Text>
                    {selectedCert === opt && <Feather name="check" size={14} color={colors.gold} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedCert === "Outro" && (
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Nome da certificação"
                placeholderTextColor={colors.mutedForeground}
                value={customCert}
                onChangeText={setCustomCert}
              />
            )}

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setShowPicker(false); setSelectedCert(""); }}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.navy, opacity: saving ? 0.7 : 1 }]}
                onPress={handleAdd}
                disabled={saving}
              >
                <Text style={styles.submitText}>{saving ? "Salvando..." : "Adicionar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Empty state */}
        {certifications.length === 0 && !showForm && (
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { borderColor: colors.mutedForeground }]}>
              <Feather name="award" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.navy }]}>Nenhuma certificação ainda</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Adicione suas certificações e credenciais profissionais
            </Text>
          </View>
        )}

        {/* List */}
        {certifications.map((cert, i) => (
          <View key={i} style={[styles.certCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={[styles.certIconWrap, { backgroundColor: colors.gold + "18" }]}>
              <Feather name="award" size={20} color={colors.gold} />
            </View>
            <Text style={[styles.certName, { color: colors.navy, flex: 1 }]}>{cert}</Text>
            <TouchableOpacity onPress={() => handleRemove(cert)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="trash-2" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow:        { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle:    { fontSize: 22, fontWeight: "800" },
  addBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5 },
  addBtnText:     { fontSize: 15, fontWeight: "600" },
  formCard:       { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  formTitle:      { fontSize: 16, fontWeight: "700" },
  pickerBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnText:  { fontSize: 14 },
  pickerDropdown: { borderWidth: 1, borderRadius: 8, overflow: "hidden", marginTop: -4 },
  pickerOption:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  pickerOptionText: { fontSize: 14 },
  input:          { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  formActions:    { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 4 },
  cancelBtn:      { paddingVertical: 10, paddingHorizontal: 16 },
  cancelText:     { fontSize: 14 },
  submitBtn:      { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, minWidth: 100, alignItems: "center" },
  submitText:     { color: "#fff", fontSize: 14, fontWeight: "700" },
  empty:          { alignItems: "center", gap: 14, paddingTop: 48 },
  emptyIconWrap:  { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  emptyTitle:     { fontSize: 18, fontWeight: "700" },
  emptySub:       { fontSize: 14, textAlign: "center", lineHeight: 20 },
  certCard:       { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  certIconWrap:   { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  certName:       { fontSize: 14, fontWeight: "600" },
});
