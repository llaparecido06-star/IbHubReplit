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
import { Feather } from "@/components/ui/Icon";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { AppReport } from "@/services/api";

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

export default function AdminModeracaoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [reports, setReports]       = useState<AppReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    const data = await API.fetchPendingReports();
    setReports(data);
    setReportsLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
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
            const statusUpdated = await API.updateReportStatus(report.id, "approved");
            if (!statusUpdated) {
              Alert.alert("Erro", "Não foi possível atualizar o status da denúncia. Tente novamente.");
              setActionLoading(null);
              return;
            }
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
        <TouchableOpacity onPress={loadReports}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />
        }
      >
        <View style={{ gap: 4 }}>
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Moderação</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Denúncias e conteúdo inapropriado
          </Text>
        </View>

        {reportsLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="small" color={colors.gold} />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma denúncia pendente 🎉</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={[{ fontSize: 13, color: colors.mutedForeground }]}>
              {reports.length} denúncia{reports.length !== 1 ? "s" : ""} pendente{reports.length !== 1 ? "s" : ""}
            </Text>
            {reports.map((report) => (
              <View key={report.id} style={[styles.reportCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
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

                <Text style={[styles.reporterText, { color: colors.mutedForeground }]}>
                  Denunciado por:{" "}
                  <Text style={{ fontWeight: "600", color: "#374151" }}>
                    {report.reporter?.full_name ?? report.reported_by.slice(0, 8)}
                  </Text>
                </Text>

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
        )}
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/moderacao" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:      { fontSize: 18, fontWeight: "700" },
  heroTitle:        { fontSize: 22, fontWeight: "800" },
  heroSub:          { fontSize: 13, lineHeight: 18 },
  empty:            { alignItems: "center", paddingVertical: 60 },
  emptyText:        { fontSize: 14 },
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
});
