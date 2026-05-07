import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  AppOpportunity,
  applyToJob,
  fetchOpportunityById,
  fetchUserLastCV,
  getOrCreateDirectConversation,
  sendMessage,
  uploadCV,
} from "@/services/api";

function formatExpiresIn(expiresAt: string | null | undefined, t: (k: string, opts?: any) => string): { expired: boolean; label: string | null } {
  if (!expiresAt) return { expired: false, label: null };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { expired: true, label: null };
  const days = Math.ceil(diff / 86400000);
  if (days === 1) return { expired: false, label: t("job_detail.expires_day") };
  if (days < 30) return { expired: false, label: t("job_detail.expires_days", { count: days }) };
  const months = Math.ceil(days / 30);
  if (months === 1) return { expired: false, label: t("job_detail.expires_month") };
  return { expired: false, label: t("job_detail.expires_months", { count: months }) };
}

const contractColor: Record<string, string> = {
  CLT: "#2ecc71", PJ: "#3498db", Freelancer: "#9b59b6", Estágio: "#e67e22",
};

export default function JobScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const [opp, setOpp]       = useState<(AppOpportunity & { is_applied: boolean; applications_count: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cvName, setCvName]   = useState<string | null>(null);
  const [cvUri, setCvUri]     = useState<string | null>(null);
  const [savedCv, setSavedCv] = useState<{ url: string; name: string } | null>(null);
  const [usingSavedCv, setUsingSavedCv] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!id || !user?.id) return;
    fetchOpportunityById(id, user.id).then((data) => {
      setOpp(data as any);
      setLoading(false);
    });
    fetchUserLastCV(user.id).then((cv) => {
      if (cv) { setSavedCv(cv); setUsingSavedCv(true); }
    });
  }, [id, user?.id]);

  const pickCV = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      setCvUri(result.assets[0].uri);
      setCvName(result.assets[0].name ?? "curriculo.pdf");
      setUsingSavedCv(false);
    }
  };

  const handleApply = async () => {
    if (!opp || !user?.id) return;
    if (opp.is_applied) {
      Alert.alert(t("job_detail.already_applied_title"), t("job_detail.already_applied_msg"));
      return;
    }

    setApplying(true);
    try {
      let cvUrl: string | null = null;
      let finalCvName: string | null = null;

      if (cvUri) {
        cvUrl = await uploadCV(cvUri, user.id);
        finalCvName = cvName;
      } else if (usingSavedCv && savedCv) {
        cvUrl = savedCv.url;
        finalCvName = savedCv.name;
      }

      const ok = await applyToJob(opp.id, user.id, cvUrl, message.trim() || null);
      if (!ok) {
        Alert.alert(t("common.error"), t("job_detail.apply_error"));
        return;
      }

      setOpp((prev) => prev ? { ...prev, is_applied: true } : prev);

      const chatTargetId = opp.company_page?.owner_id ?? opp.created_by;
      const cpId = opp.company_page_id ?? null;
      const convoId = await getOrCreateDirectConversation(user.id, chatTargetId, true, cpId);
      if (convoId) {
        const appMsg = [
          `Me candidatei na sua vaga **${opp.title}**${cvUrl ? " e enviei meu currículo." : "."}`,
          message.trim() ? `\n\n${message.trim()}` : "",
        ].join("");
        await sendMessage(convoId, user.id, appMsg);
        if (cvUrl && finalCvName) {
          await sendMessage(convoId, user.id, finalCvName, {
            message_type: "file",
            metadata: { file_url: cvUrl, file_name: finalCvName, file_type: "document" },
          });
        }
        const route = cpId ? `/chat/${convoId}?companyId=${cpId}` : `/chat/${convoId}`;
        router.push(route as any);
      } else {
        Alert.alert(t("job_detail.apply_success"), t("job_detail.apply_success_msg"));
      }
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!opp) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>{t("job_detail.not_found")}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.navy, fontWeight: "600" }}>{t("job_detail.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { expired, label: expiresLabel } = formatExpiresIn(opp.expires_at, t);
  const companyName = opp.company ?? opp.company_page?.name ?? null;
  const contractClr = opp.contract_type ? (contractColor[opp.contract_type] ?? colors.navy) : colors.navy;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("job_detail.title")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.jobTitle, { color: colors.navy }]}>{opp.title}</Text>

          {(companyName || opp.location) && (
            <View style={styles.metaRow}>
              {companyName && (
                <>
                  <Feather name="briefcase" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{companyName}</Text>
                </>
              )}
              {opp.location && (
                <>
                  <Feather name="map-pin" size={14} color={colors.mutedForeground} style={{ marginLeft: companyName ? 10 : 0 }} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{opp.location}</Text>
                </>
              )}
            </View>
          )}

          <View style={styles.chips}>
            {opp.contract_type && (
              <View style={[styles.chip, { backgroundColor: contractClr + "18" }]}>
                <Text style={[styles.chipText, { color: contractClr, fontWeight: "700" }]}>{opp.contract_type}</Text>
              </View>
            )}
            {opp.category && (
              <View style={[styles.chip, { backgroundColor: colors.background }]}>
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{opp.category}</Text>
              </View>
            )}
            {opp.salary && (
              <View style={[styles.chip, { backgroundColor: colors.background }]}>
                <Feather name="dollar-sign" size={12} color={colors.mutedForeground} />
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{opp.salary}</Text>
              </View>
            )}
            {expired ? (
              <View style={[styles.chip, { backgroundColor: "#fef2f2" }]}>
                <Feather name="alert-circle" size={12} color="#dc2626" />
                <Text style={[styles.chipText, { color: "#dc2626" }]}>{t("job_detail.expired")}</Text>
              </View>
            ) : expiresLabel ? (
              <View style={[styles.chip, { backgroundColor: colors.background }]}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{t("job_detail.expires_in", { label: expiresLabel })}</Text>
              </View>
            ) : null}
          </View>

          {opp.description ? (
            <Text style={[styles.description, { color: colors.foreground }]}>{opp.description}</Text>
          ) : null}

          {opp.contact_email ? (
            <Text style={[styles.contactEmail, { color: colors.mutedForeground }]}>
              {t("job_detail.contact", { email: opp.contact_email })}
            </Text>
          ) : null}
        </View>

        {!expired && !opp.is_applied && (
          <View style={[styles.applyCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.applyHeader}>
              <Feather name="message-circle" size={18} color={colors.gold} />
              <Text style={[styles.applyTitle, { color: colors.navy }]}>{t("job_detail.apply_title")}</Text>
            </View>
            <Text style={[styles.applySub, { color: colors.mutedForeground }]}>
              {t("job_detail.apply_sub")}
            </Text>

            {savedCv && (
              <TouchableOpacity
                style={[styles.cvSavedRow, { backgroundColor: usingSavedCv ? colors.gold + "15" : colors.background, borderColor: usingSavedCv ? colors.gold : colors.border }]}
                onPress={() => setUsingSavedCv((v) => !v)}
              >
                <Feather name="file-text" size={16} color={usingSavedCv ? colors.gold : colors.mutedForeground} />
                <Text style={[styles.cvSavedText, { color: usingSavedCv ? colors.gold : colors.mutedForeground }]}>
                  {usingSavedCv ? "✓ " : ""}{savedCv.name}
                </Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={[styles.messageInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("job_detail.message_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity style={[styles.attachBtn, { borderColor: colors.border }]} onPress={pickCV}>
              <Feather name="upload" size={16} color={colors.navy} />
              <Text style={[styles.attachBtnText, { color: colors.navy }]}>
                {cvName ? cvName : t("job_detail.attach_cv")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.gold, opacity: applying ? 0.7 : 1 }]}
              onPress={handleApply}
              disabled={applying}
            >
              <Feather name="send" size={16} color="#fff" />
              <Text style={styles.applyBtnText}>{applying ? t("job_detail.applying") : t("job_detail.apply_btn")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {opp.is_applied && (
          <View style={[styles.appliedBanner, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
            <Feather name="check-circle" size={18} color="#16a34a" />
            <Text style={{ color: "#16a34a", fontWeight: "700", fontSize: 14 }}>
              {t("job_detail.applied_banner")}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:  { fontSize: 20, fontWeight: "700" },
  infoCard:     { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  jobTitle:     { fontSize: 20, fontWeight: "800", lineHeight: 26 },
  metaRow:      { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  metaText:     { fontSize: 13 },
  chips:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  chipText:     { fontSize: 12 },
  description:  { fontSize: 14, lineHeight: 20 },
  contactEmail: { fontSize: 13 },
  applyCard:    { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  applyHeader:  { flexDirection: "row", alignItems: "center", gap: 8 },
  applyTitle:   { fontSize: 16, fontWeight: "700" },
  applySub:     { fontSize: 13, lineHeight: 18 },
  cvSavedRow:   { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  cvSavedText:  { fontSize: 13, fontWeight: "500", flex: 1 },
  messageInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 100 },
  attachBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1 },
  attachBtnText:{ fontSize: 14, fontWeight: "600" },
  applyBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 10 },
  applyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  appliedBanner:{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 16 },
});
