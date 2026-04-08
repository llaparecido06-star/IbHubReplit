import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
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
import { useAuth } from "@/context/AuthContext";
import * as API from "@/services/api";
import type { CertificationRequest } from "@/services/api";

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

function getIssuer(name: string): string {
  if (name.startsWith("WSET")) return "WSET";
  if (name.startsWith("CMS")) return "Court of Master Sommeliers";
  if (name.startsWith("ABEV")) return "ABEV";
  if (name.startsWith("ISA")) return "ISA";
  return "Outro";
}

function statusLabel(status: string): string {
  if (status === "verified") return "Verificado";
  if (status === "rejected") return "Rejeitado";
  return "Em análise";
}

function statusColor(status: string, colors: any): string {
  if (status === "verified") return colors.gold;
  if (status === "rejected") return "#dc2626";
  return colors.mutedForeground;
}

function statusBg(status: string, colors: any): string {
  if (status === "verified") return colors.gold + "18";
  if (status === "rejected") return "#dc262618";
  return colors.background;
}

export default function CertificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [certs, setCerts] = useState<CertificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [selectedCert, setSelectedCert] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [certDate, setCertDate] = useState("");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const loadCerts = useCallback(async () => {
    if (!user) return;
    const data = await API.getMyCertificationRequests(user.id);
    setCerts(data);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    loadCerts().finally(() => setLoading(false));
  }, [loadCerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCerts();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!selectedCert) { Alert.alert("Atenção", "Selecione uma certificação."); return; }
    if (!user) return;

    setSubmitting(true);
    const result = await API.submitCertificationRequest({
      user_id: user.id,
      name: selectedCert,
      issuer: getIssuer(selectedCert),
      cert_number: certNumber || undefined,
      date: certDate || undefined,
    });
    setSubmitting(false);

    if (!result) {
      Alert.alert("Erro", "Não foi possível enviar a solicitação. Tente novamente.");
      return;
    }

    setCerts((prev) => [result, ...prev]);
    setSelectedCert(""); setCertNumber(""); setCertDate("");
    setShowForm(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Certificações</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />
        }
      >
        <TouchableOpacity
          style={[styles.requestBtn, { borderColor: colors.border, backgroundColor: "#fff" }]}
          onPress={() => setShowForm(!showForm)}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
          <Text style={[styles.requestBtnText, { color: colors.foreground }]}>Solicitar Verificação</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={[styles.formCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.navy }]}>Solicitar Verificação</Text>

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

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Número do certificado (opcional)"
              placeholderTextColor={colors.mutedForeground}
              value={certNumber}
              onChangeText={setCertNumber}
            />

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={colors.mutedForeground}
              value={certDate}
              onChangeText={setCertDate}
              keyboardType="numeric"
            />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setShowPicker(false); }}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.navy, opacity: submitting ? 0.7 : 1 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Enviar Solicitação</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="small" color={colors.gold} />
          </View>
        ) : certs.length === 0 ? (
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
              <View style={[styles.certIconWrap, { backgroundColor: statusBg(cert.status, colors) }]}>
                <Feather name="award" size={22} color={statusColor(cert.status, colors)} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.certName, { color: colors.navy }]}>{cert.name}</Text>
                {cert.date && <Text style={[styles.certMeta, { color: colors.mutedForeground }]}>{cert.date}</Text>}
                {cert.cert_number && (
                  <Text style={[styles.certMeta, { color: colors.mutedForeground }]}>Nº {cert.cert_number}</Text>
                )}
                <View style={[styles.certStatusBadge, { backgroundColor: statusBg(cert.status, colors) }]}>
                  <Text style={[styles.certStatusText, { color: statusColor(cert.status, colors) }]}>
                    {statusLabel(cert.status)}
                  </Text>
                </View>
              </View>
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
  submitBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, minWidth: 120, alignItems: "center" },
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
