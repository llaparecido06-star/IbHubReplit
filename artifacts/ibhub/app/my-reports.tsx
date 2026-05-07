import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import * as API from "@/services/api";
import type { MyReport } from "@/services/api";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MyReportsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const [reports, setReports]   = useState<MyReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: t("my_reports.status_pending"),  color: "#d97706", bg: "#fffbeb" },
    approved: { label: t("my_reports.status_approved"), color: "#059669", bg: "#f0fdf4" },
    rejected: { label: t("my_reports.status_rejected"), color: "#6b7280", bg: "#f9fafb" },
  };

  const load = useCallback(async () => {
    if (!user?.id) return;
    const data = await API.fetchMyReports(user.id);
    setReports(data);
  }, [user?.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("my_reports.title")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.gold} />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.center}>
            <Feather name="flag" size={36} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t("my_reports.empty")}
            </Text>
          </View>
        ) : (
          reports.map((r) => {
            const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
            return (
              <View key={r.id} style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: "#fef2f2" }]}>
                    <Feather name="flag" size={14} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reason, { color: colors.navy }]} numberOfLines={1}>{r.reason}</Text>
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                      {r.post_id ? "Post" : t("common.others")} · {timeAgo(r.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  center:      { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyText:   { fontSize: 15, fontWeight: "600", textAlign: "center" },
  card:        { borderRadius: 12, borderWidth: 1, padding: 14 },
  cardHeader:  { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge:   { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  reason:      { fontSize: 14, fontWeight: "600" },
  meta:        { fontSize: 12, marginTop: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 11, fontWeight: "700" },
});
