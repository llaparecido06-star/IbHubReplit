import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

interface Certification {
  id: string;
  name: string;
  issuer: string;
  certNumber?: string;
  date?: string;
  status: "pending" | "verified";
  addedAt: string;
}

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

const STORAGE_KEY = "ibhub_certifications_v2";

export default function CertificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [certs, setCerts] = useState<Certification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Form state
  const [selectedCert, setSelectedCert] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [certDate, setCertDate] = useState("");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setCerts(JSON.parse(val));
    });
  }, []);

  const save = async (updated: Certification[]) => {
    setCerts(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSubmit = async () => {
    if (!selectedCert) { Alert.alert("Atenção", "Selecione uma certificação."); return; }
    const cert: Certification = {
      id: Date.now().toString(),
      name: selectedCert,
      issuer: selectedCert.startsWith("WSET") ? "WSET" : selectedCert.startsWith("CMS") ? "Court of Master Sommeliers" : selectedCert.startsWith("ABEV") ? "ABEV" : "ISA",
      certNumber: certNumber || undefined,
      date: certDate || undefined,
      status: "pending",
      addedAt: new Date().toISOString(),
    };
    await save([cert, ...certs]);
    setSelectedCert(""); setCertNumber(""); setCertDate("");
    setShowForm(false);
  };

  const handleRemove = async (id: string) => {
    Alert.alert("Remover", "Deseja remover esta certificação?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => save(certs.filter((c) => c.id !== id)) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Certificações</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Request button */}
        <TouchableOpacity
          style={[styles.requestBtn, { borderColor: colors.border, backgroundColor: "#fff" }]}
          onPress={() => setShowForm(!showForm)}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
          <Text style={[styles.requestBtnText, { color: colors.foreground }]}>Solicitar Verificação</Text>
        </TouchableOpacity>

        {/* Inline form */}
        {showForm && (
          <View style={[styles.formCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.navy }]}>Solicitar Verificação</Text>

            {/* Cert picker */}
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
                    style={[styles.pickerOption, { borderBottomColor: colors.border }, selectedCert === opt && { backgroundColor: colors.gold + "12" }]}
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

            {/* Cert number */}
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Número do certificado (opcional)"
              placeholderTextColor={colors.mutedForeground}
              value={certNumber}
              onChangeText={setCertNumber}
            />

            {/* Date */}
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={colors.mutedForeground}
              value={certDate}
              onChangeText={setCertDate}
              keyboardType="numeric"
            />

            {/* Form actions */}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setShowPicker(false); }}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.navy }]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitText}>Enviar Solicitação</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Empty state or list */}
        {certs.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { borderColor: colors.mutedForeground }]}>
              <Feather name="award" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.navy }]}>Nenhuma certificação ainda</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Solicite a verificação das suas credenciais profissionais
            </Text>
          </View>
        ) : (
          certs.map((cert) => (
            <View key={cert.id} style={[styles.certCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={[styles.certIconWrap, { backgroundColor: cert.status === "verified" ? colors.gold + "18" : colors.background }]}>
                <Feather name="award" size={22} color={cert.status === "verified" ? colors.gold : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.certName, { color: colors.navy }]}>{cert.name}</Text>
                {cert.date && <Text style={[styles.certMeta, { color: colors.mutedForeground }]}>{cert.date}</Text>}
                <View style={[styles.certStatusBadge, { backgroundColor: cert.status === "verified" ? colors.gold + "18" : colors.background }]}>
                  <Text style={[styles.certStatusText, { color: cert.status === "verified" ? colors.gold : colors.mutedForeground }]}>
                    {cert.status === "verified" ? "Verificado" : "Em análise"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleRemove(cert.id)} style={{ padding: 4 }}>
                <Feather name="trash-2" size={17} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  requestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5 },
  requestBtnText: { fontSize: 15, fontWeight: "600" },
  formCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  formTitle: { fontSize: 16, fontWeight: "700" },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  pickerBtnText: { fontSize: 14 },
  pickerDropdown: { borderWidth: 1, borderRadius: 8, overflow: "hidden", marginTop: -4 },
  pickerOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  pickerOptionText: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  formActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 4 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { fontSize: 14 },
  submitBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  submitText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", gap: 14, paddingTop: 48 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  certCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  certIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  certName: { fontSize: 14, fontWeight: "700" },
  certMeta: { fontSize: 12 },
  certStatusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginTop: 2 },
  certStatusText: { fontSize: 11, fontWeight: "600" },
});
