import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import * as API from "@/services/api";
import type { AppReport, CertificationRequest } from "@/services/api";

const MAIN_TABS = ["Denúncias", "Certificações"];
const CERT_TABS = ["Pendentes", "Verificadas", "Rejeitadas", "Todas"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function certTabToStatus(tab: string): "pending" | "verified" | "rejected" | undefined {
  if (tab === "Pendentes") return "pending";
  if (tab === "Verificadas") return "verified";
  if (tab === "Rejeitadas") return "rejected";
  return undefined;
}

export default function AdminModeracaoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mainTab, setMainTab]       = useState("Denúncias");
  const [certTab, setCertTab]       = useState("Pendentes");

  const [reports, setReports]       = useState<AppReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [certRequests, setCertRequests] = useState<CertificationRequest[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);
  const [certActionLoading, setCertActionLoading] = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    const data = await API.fetchPendingReports();
    setReports(data);
    setReportsLoading(false);
  }, []);

  const loadCerts = useCallback(async (tab: string) => {
    setCertsLoading(true);
    const data = await API.getAdminCertificationRequests(certTabToStatus(tab));
    setCertRequests(data);
    setCertsLoading(false);
  }, []);

  useEffect(() => {
    if (mainTab === "Denúncias") {
      loadReports();
    } else {
      loadCerts(certTab);
    }
  }, [mainTab, certTab, loadReports, loadCerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (mainTab === "Denúncias") {
      await loadReports();
    } else {
      await loadCerts(certTab);
    }
    setRefreshing(false);
  };

  const handleCertReview = async (req: CertificationRequest, action: "verified" | "rejected") => {
    if (!user) return;
    const label = action === "verified" ? "aprovar" : "rejeitar";
    Alert.alert(
      action === "verified" ? "Aprovar Certificação" : "Rejeitar Certificação",
      `Deseja ${label} a certificação "${req.name}" de ${req.requester?.full_name ?? "usuário"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: action === "verified" ? "Aprovar" : "Rejeitar",
          style: action === "rejected" ? "destructive" : "default",
          onPress: async () => {
            setCertActionLoading(req.id);
            const ok = await API.reviewCertificationRequest(req.id, action, user.id);
            if (ok) {
              setCertRequests((prev) => {
                const status = certTabToStatus(certTab);
                if (status === undefined) {
                  return prev.map((r) => r.id === req.id ? { ...r, status: action } : r);
                }
                return prev.filter((r) => r.id !== req.id);
              });
            } else {
              Alert.alert("Erro", "Não foi possível processar a solicitação. Tente novamente.");
            }
            setCertActionLoading(null);
          },
        },
      ],
    );
  };

  const handleApprove = async (report: AppReport) => {
    Alert.alert(
      "Remover publicação",
      "Esta ação removerá a publicação denunciada. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            setActionLoading(report.id);
            // Update status FIRST (before post deletion cascades the report row away)
            const statusUpdated = await API.updateReportStatus(report.id, "approved");
            if (!statusUpdated) {
              Alert.alert("Erro", "Não foi possível atualizar o status da denúncia. Tente novamente.");
              setActionLoading(null);
              return;
            }
            // Now delete the post (ON DELETE CASCADE will remove the report row)
            const deleted = await API.deletePost(report.post_id);
            if (!deleted) {
              Alert.alert("Atenção", "Status da denúncia atualizado, mas não foi possível remover a publicação. Verifique suas permissões.");
            }
            setReports((prev) => prev.filter((r) => r.id !== report.id));
            setActionLoading(null);
          },
        },
      ],
    );
  };

  const handleReject = async (report: AppReport) => {
    setActionLoading(report.id);
    const ok = await API.updateReportStatus(report.id, "rejected");
    if (ok) {
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    }
    setActionLoading(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Moderação</Text>
        <TouchableOpacity onPress={mainTab === "Denúncias" ? loadReports : () => loadCerts(certTab)}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />
        }
      >
        {/* Hero */}
        <View style={{ gap: 4 }}>
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Moderação</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Denúncias, aprovações e verificações de certificações
          </Text>
        </View>

        {/* Main tabs */}
        <View style={styles.mainTabRow}>
          {MAIN_TABS.map((t) => {
            const isActive = t === mainTab;
            const label = t === "Denúncias"
              ? `Denúncias${reports.length > 0 ? ` (${reports.length})` : " (0)"}`
              : t;
            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.mainTab,
                  { borderColor: isActive ? colors.gold : colors.border, backgroundColor: "#fff" },
                  isActive && { borderWidth: 1.5 },
                ]}
                onPress={() => setMainTab(t)}
              >
                <Feather
                  name={t === "Denúncias" ? "alert-octagon" : "award"}
                  size={14}
                  color={isActive ? colors.gold : colors.mutedForeground}
                />
                <Text style={[styles.mainTabText, { color: isActive ? colors.gold : colors.foreground, fontWeight: isActive ? "700" : "400" }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {mainTab === "Denúncias" ? (
          reportsLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="small" color={colors.gold} />
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma denúncia pendente 🎉</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {reports.map((report) => (
                <View key={report.id} style={[styles.reportCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {/* Report header */}
                  <View style={styles.reportCardHeader}>
                    <View style={[styles.flagIcon, { backgroundColor: "#fef2f2" }]}>
                      <Feather name="flag" size={14} color="#dc2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reportReason, { color: "#0d1b2a" }]} numberOfLines={1}>
                        {report.reason}
                      </Text>
                      <Text style={[styles.reportMeta, { color: colors.mutedForeground }]}>
                        {timeAgo(report.created_at)}
                      </Text>
                    </View>
                  </View>

                  {/* Post preview */}
                  {report.post && (
                    <View style={[styles.postPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.postPreviewText, { color: "#374151" }]} numberOfLines={3}>
                        {report.post.content ?? "(sem conteúdo)"}
                      </Text>
                      <Text style={[styles.postPreviewId, { color: colors.mutedForeground }]}>
                        Post ID: {report.post_id.slice(0, 8)}…
                      </Text>
                    </View>
                  )}

                  {/* Reporter */}
                  <Text style={[styles.reporterText, { color: colors.mutedForeground }]}>
                    Denunciado por:{" "}
                    <Text style={{ fontWeight: "600", color: "#374151" }}>
                      {report.reporter?.full_name ?? report.reported_by.slice(0, 8)}
                    </Text>
                  </Text>

                  {/* Actions */}
                  <View style={styles.reportActions}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, { borderColor: colors.border }]}
                      onPress={() => handleReject(report)}
                      disabled={actionLoading === report.id}
                    >
                      {actionLoading === report.id ? (
                        <ActivityIndicator size="small" color="#6b7280" />
                      ) : (
                        <>
                          <Feather name="x-circle" size={14} color="#6b7280" />
                          <Text style={[styles.rejectBtnText, { color: "#6b7280" }]}>Ignorar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, { backgroundColor: "#dc2626" }]}
                      onPress={() => handleApprove(report)}
                      disabled={actionLoading === report.id}
                    >
                      {actionLoading === report.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="trash-2" size={14} color="#fff" />
                          <Text style={styles.approveBtnText}>Remover post</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          <>
            {/* Cert sub-tabs */}
            <View style={styles.certTabRow}>
              {CERT_TABS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.certTab,
                    { backgroundColor: t === certTab ? colors.navy : "#f3f4f6" },
                  ]}
                  onPress={() => setCertTab(t)}
                >
                  <Text style={[styles.certTabText, { color: t === certTab ? "#fff" : colors.foreground }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {certsLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator size="small" color={colors.gold} />
              </View>
            ) : certRequests.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {certTab === "Pendentes" ? "Nenhuma solicitação pendente 🎉" : "Nenhuma certificação nessa categoria"}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {certRequests.map((req) => (
                  <View key={req.id} style={[styles.reportCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    <View style={styles.reportCardHeader}>
                      <View style={[styles.flagIcon, { backgroundColor: colors.gold + "18" }]}>
                        <Feather name="award" size={14} color={colors.gold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reportReason, { color: "#0d1b2a" }]} numberOfLines={1}>
                          {req.name}
                        </Text>
                        <Text style={[styles.reportMeta, { color: colors.mutedForeground }]}>
                          {timeAgo(req.created_at)}
                        </Text>
                      </View>
                      {req.status !== "pending" && (
                        <View style={[styles.certStatusBadge, {
                          backgroundColor: req.status === "verified" ? colors.gold + "18" : "#dc262618",
                        }]}>
                          <Text style={[styles.certStatusText, {
                            color: req.status === "verified" ? colors.gold : "#dc2626",
                          }]}>
                            {req.status === "verified" ? "Verificado" : "Rejeitado"}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={[styles.postPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.postPreviewText, { color: "#374151" }]}>
                        Emissor: {req.issuer}
                      </Text>
                      {req.cert_number && (
                        <Text style={[styles.postPreviewText, { color: "#374151" }]}>
                          Nº {req.cert_number}
                        </Text>
                      )}
                      {req.date && (
                        <Text style={[styles.postPreviewText, { color: "#374151" }]}>
                          Data: {req.date}
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.reporterText, { color: colors.mutedForeground }]}>
                      Solicitante:{" "}
                      <Text style={{ fontWeight: "600", color: "#374151" }}>
                        {req.requester?.full_name ?? req.user_id.slice(0, 8)}
                      </Text>
                    </Text>

                    {req.status === "pending" && (
                      <View style={styles.reportActions}>
                        <TouchableOpacity
                          style={[styles.rejectBtn, { borderColor: "#dc2626" }]}
                          onPress={() => handleCertReview(req, "rejected")}
                          disabled={certActionLoading === req.id}
                        >
                          {certActionLoading === req.id ? (
                            <ActivityIndicator size="small" color="#dc2626" />
                          ) : (
                            <>
                              <Feather name="x-circle" size={14} color="#dc2626" />
                              <Text style={[styles.rejectBtnText, { color: "#dc2626" }]}>Rejeitar</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.approveBtn, { backgroundColor: colors.gold }]}
                          onPress={() => handleCertReview(req, "verified")}
                          disabled={certActionLoading === req.id}
                        >
                          {certActionLoading === req.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Feather name="check-circle" size={14} color="#fff" />
                              <Text style={styles.approveBtnText}>Aprovar</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/moderacao" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 18, fontWeight: "700" },
  heroTitle:    { fontSize: 22, fontWeight: "800" },
  heroSub:      { fontSize: 13, lineHeight: 18 },
  mainTabRow:   { flexDirection: "row", gap: 8 },
  mainTab:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  mainTabText:  { fontSize: 13 },
  certTabRow:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  certTab:      { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  certTabText:  { fontSize: 13, fontWeight: "600" },
  empty:        { alignItems: "center", paddingVertical: 60 },
  emptyText:    { fontSize: 14 },

  // Report card
  reportCard:       { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  reportCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  flagIcon:         { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  reportReason:     { fontSize: 15, fontWeight: "700" },
  reportMeta:       { fontSize: 12, marginTop: 1 },
  postPreview:      { borderRadius: 10, borderWidth: 1, padding: 12, gap: 4 },
  postPreviewText:  { fontSize: 13.5, lineHeight: 20 },
  postPreviewId:    { fontSize: 11, marginTop: 2 },
  reporterText:     { fontSize: 13 },
  reportActions:    { flexDirection: "row", gap: 10, marginTop: 4 },
  rejectBtn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5 },
  rejectBtnText:    { fontSize: 14, fontWeight: "600" },
  approveBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  approveBtnText:   { fontSize: 14, fontWeight: "600", color: "#fff" },
  certStatusBadge:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  certStatusText:   { fontSize: 11, fontWeight: "600" },
});
