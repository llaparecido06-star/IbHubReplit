import React, { useEffect, useState } from "react";
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
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import { broadcastPushNotification } from "@/services/admin-api";

interface PlanOption { id: string; name: string; }

interface ReferralTrackingEntry {
  id: string;
  full_name: string | null;
  referral_code: string | null;
  invite_count: number;
}

interface PushLog {
  id: string;
  created_at: string;
  titulo: string;
  mensagem: string;
  segmento: string;
  deep_link: string | null;
  sent_at: string | null;
  recipients_count: number | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminComunicacaoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [titulo, setTitulo]           = useState("");
  const [mensagem, setMensagem]       = useState("");
  const [segmento, setSegmento]       = useState("all");
  const [segOpen, setSegOpen]         = useState(false);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);

  const segments = [
    { id: "all", label: "Todos os usuários" },
    ...planOptions.map((p) => ({ id: p.id, label: p.name })),
  ];
  const segmentoLabel = segments.find((s) => s.id === segmento)?.label ?? segmento;
  const [deepLink, setDeepLink]       = useState("");
  const [sending, setSending]         = useState(false);

  const [logs, setLogs]               = useState<PushLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logsError, setLogsError]     = useState<string | null>(null);

  const [tracking, setTracking]               = useState<ReferralTrackingEntry[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(true);
  const [trackingError, setTrackingError]     = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const canSend = titulo.trim().length > 0 && mensagem.trim().length > 0;

  const fetchTracking = async () => {
    setLoadingTracking(true);
    setTrackingError(null);

    // Step 1: get all profiles that have a referral_code
    const { data: inviters, error: invErr } = await supabase
      .from("profiles")
      .select("id, full_name, referral_code")
      .not("referral_code", "is", null);

    if (invErr) {
      setTrackingError("Erro ao carregar rastreamento: " + invErr.message);
      setLoadingTracking(false);
      return;
    }

    if (!inviters || inviters.length === 0) {
      setTracking([]);
      setLoadingTracking(false);
      return;
    }

    // Step 2: count how many profiles have invited_by_id pointing to each inviter
    const { data: invited, error: cntErr } = await supabase
      .from("profiles")
      .select("invited_by_id")
      .not("invited_by_id", "is", null);

    if (cntErr) {
      setTrackingError("Erro ao contar convites: " + cntErr.message);
      setLoadingTracking(false);
      return;
    }

    // Build count map
    const countMap: Record<string, number> = {};
    for (const row of invited ?? []) {
      const id = (row as any).invited_by_id as string;
      if (id) countMap[id] = (countMap[id] ?? 0) + 1;
    }

    const entries: ReferralTrackingEntry[] = (inviters as any[])
      .map((p) => ({
        id: p.id as string,
        full_name: p.full_name as string | null,
        referral_code: p.referral_code as string | null,
        invite_count: countMap[p.id] ?? 0,
      }))
      .filter((e) => e.invite_count > 0)
      .sort((a, b) => b.invite_count - a.invite_count);

    setTracking(entries);
    setLoadingTracking(false);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogsError(null);
    const { data, error } = await supabase
      .from("push_notification_logs")
      .select("id, created_at, titulo, mensagem, segmento, deep_link, sent_at, recipients_count")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setLogsError("Erro ao carregar histórico: " + error.message);
    } else if (data) {
      setLogs(data as PushLog[]);
    }
    setLoadingLogs(false);
  };

  useEffect(() => {
    fetchLogs();
    fetchTracking();
    supabase.from("plans").select("id, name").eq("is_active", true).order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setPlanOptions(data as PlanOption[]); });
  }, []);

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);
    const userId = session?.user?.id ?? null;
    const titSend = titulo.trim();
    const msgSend = mensagem.trim();
    const dlSend = deepLink.trim() || null;

    // Insert log entry first
    const { data: logData, error } = await supabase
      .from("push_notification_logs")
      .insert({ titulo: titSend, mensagem: msgSend, segmento: segmentoLabel, deep_link: dlSend, sent_by: userId })
      .select("id")
      .single();

    if (error) {
      setSending(false);
      Alert.alert("Erro", "Não foi possível registrar a notificação: " + error.message);
      return;
    }

    // Dispatch actual push notifications via API server
    try {
      const { sent, total } = await broadcastPushNotification({
        title: titSend,
        body: msgSend,
        segment: segmento,
        deepLink: dlSend ?? undefined,
        logId: logData?.id,
      });
      Alert.alert(
        "Enviado!",
        total > 0
          ? `${sent}/${total} dispositivos notificados (segmento: ${segmento}).`
          : `Notificação registrada. Nenhum token encontrado para "${segmento}".`
      );
    } catch (apiErr: any) {
      Alert.alert("Parcialmente enviado", `Notificação registrada, mas o envio falhou: ${apiErr?.message ?? "erro desconhecido"}`);
    }

    setSending(false);
    setTitulo(""); setMensagem(""); setDeepLink("");
    fetchLogs();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Comunicação</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={styles.twoCol}>
          {/* Left: Nova Notificação */}
          <View style={[styles.leftCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Feather name="send" size={13} color={colors.gold} />
              <Text style={[styles.cardTitle, { color: colors.navy }]}>Nova{"\n"}Notificação</Text>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TÍTULO</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Ex: Nova fu..."
                placeholderTextColor={colors.mutedForeground}
                value={titulo}
                onChangeText={setTitulo}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MENSAGEM</Text>
              <TextInput
                style={[styles.textarea, { borderColor: colors.border, color: colors.foreground }]}
                placeholder={"Corpo da\nnotificação..."}
                placeholderTextColor={colors.mutedForeground}
                value={mensagem}
                onChangeText={setMensagem}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SEGMENTO</Text>
              <TouchableOpacity
                style={[styles.select, { borderColor: colors.border }]}
                onPress={() => setSegOpen(!segOpen)}
              >
                <Text style={[styles.selectText, { color: colors.foreground }]} numberOfLines={1}>
                  {segmentoLabel.length > 10 ? segmentoLabel.slice(0, 8) + "..." : segmentoLabel}
                </Text>
                <Feather name="chevron-down" size={12} color={colors.mutedForeground} />
              </TouchableOpacity>
              {segOpen && (
                <View style={[styles.dropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {segments.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.dropItem, { borderBottomColor: colors.border }, s.id === segmento && { backgroundColor: colors.gold + "12" }]}
                      onPress={() => { setSegmento(s.id); setSegOpen(false); }}
                    >
                      <Text style={[styles.dropText, { color: s.id === segmento ? colors.gold : colors.foreground }]}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DEEP LINK{"\n"}(OPCIONAL)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="/events/123..."
                placeholderTextColor={colors.mutedForeground}
                value={deepLink}
                onChangeText={setDeepLink}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: canSend ? colors.gold : colors.gold + "55" }]}
              onPress={handleSend}
              disabled={!canSend || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="send" size={13} color="#fff" />
              )}
              <Text style={styles.sendBtnText}>Enviar{"\n"}Notificação</Text>
            </TouchableOpacity>
          </View>

          {/* Right: Histórico */}
          <View style={[styles.rightCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Text style={[styles.histTitle, { color: colors.navy }]}>Histórico</Text>
            {loadingLogs ? (
              <ActivityIndicator size="small" color={colors.gold} />
            ) : logsError ? (
              <Text style={[styles.histEmpty, { color: "#e74c3c" }]}>{logsError}</Text>
            ) : logs.length === 0 ? (
              <Text style={[styles.histEmpty, { color: colors.mutedForeground }]}>
                Nenhum envio{"\n"}realizado
              </Text>
            ) : (
              logs.map((log) => (
                <View key={log.id} style={[styles.logItem, { borderTopColor: colors.border }]}>
                  <Text style={[styles.logDate, { color: colors.mutedForeground }]}>{formatDate(log.created_at)}</Text>
                  <Text style={[styles.logTitle, { color: colors.navy }]} numberOfLines={1}>{log.titulo}</Text>
                  <Text style={[styles.logSeg, { color: colors.gold }]} numberOfLines={1}>{log.segmento}</Text>
                  {log.recipients_count != null && (
                    <Text style={[styles.logDate, { color: colors.mutedForeground }]}>
                      {log.recipients_count} dispositivo{log.recipients_count !== 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
        {/* ── Rastreamento de Convites ── */}
        <View style={[styles.trackCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.trackHead}>
            <Feather name="users" size={14} color={colors.gold} />
            <Text style={[styles.trackTitle, { color: colors.navy }]}>Rastreamento de Convites</Text>
          </View>

          {loadingTracking ? (
            <ActivityIndicator size="small" color={colors.gold} style={{ marginTop: 8 }} />
          ) : trackingError ? (
            <Text style={[styles.trackEmpty, { color: "#e74c3c" }]}>{trackingError}</Text>
          ) : tracking.length === 0 ? (
            <Text style={[styles.trackEmpty, { color: colors.mutedForeground }]}>
              Nenhum convite registrado ainda.
            </Text>
          ) : (
            <View style={styles.trackTable}>
              {/* Header row */}
              <View style={[styles.trackRow, styles.trackHeaderRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.trackHeaderCell, { color: colors.mutedForeground, flex: 3 }]}>USUÁRIO</Text>
                <Text style={[styles.trackHeaderCell, { color: colors.mutedForeground, flex: 2 }]}>CÓDIGO</Text>
                <Text style={[styles.trackHeaderCell, { color: colors.mutedForeground, flex: 1, textAlign: "right" }]}>CONVIDADOS</Text>
              </View>
              {tracking.map((entry, idx) => (
                <View
                  key={entry.id}
                  style={[
                    styles.trackRow,
                    { borderBottomColor: colors.border },
                    idx === tracking.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={[styles.trackCell, { color: colors.foreground, flex: 3 }]} numberOfLines={1}>
                    {entry.full_name ?? "—"}
                  </Text>
                  <View style={[styles.codePill, { backgroundColor: colors.gold + "18", flex: 2 }]}>
                    <Text style={[styles.codeText, { color: colors.gold }]}>{entry.referral_code}</Text>
                  </View>
                  <View style={[styles.countWrap, { flex: 1 }]}>
                    <Text style={[styles.countNum, { color: colors.navy }]}>{entry.invite_count}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/comunicacao" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  twoCol:      { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  leftCard:    { flex: 3, borderRadius: 12, borderWidth: 1, padding: 12, gap: 12 },
  rightCard:   { flex: 2, borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  cardHead:    { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  cardTitle:   { fontSize: 14, fontWeight: "700", lineHeight: 18 },
  field:       { gap: 4 },
  fieldLabel:  { fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
  input:       { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12 },
  textarea:    { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12, height: 70 },
  select:      { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8 },
  selectText:  { flex: 1, fontSize: 12 },
  dropdown:    { position: "absolute", top: 38, left: 0, right: 0, borderRadius: 8, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  dropItem:    { paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1 },
  dropText:    { fontSize: 12 },
  sendBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 8 },
  sendBtnText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  histTitle:   { fontSize: 15, fontWeight: "700" },
  histEmpty:   { fontSize: 12, lineHeight: 18 },
  logItem:     { borderTopWidth: 1, paddingTop: 8, gap: 2 },
  logDate:     { fontSize: 10 },
  logTitle:    { fontSize: 12, fontWeight: "600" },
  logSeg:      { fontSize: 10 },

  trackCard:       { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  trackHead:       { flexDirection: "row", alignItems: "center", gap: 8 },
  trackTitle:      { fontSize: 15, fontWeight: "700" },
  trackEmpty:      { fontSize: 13, lineHeight: 19 },
  trackTable:      { gap: 0 },
  trackHeaderRow:  { borderBottomWidth: 1, paddingBottom: 6, marginBottom: 4 },
  trackRow:        { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  trackHeaderCell: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  trackCell:       { fontSize: 13, fontWeight: "500" },
  codePill:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  codeText:        { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  countWrap:       { alignItems: "flex-end" },
  countNum:        { fontSize: 14, fontWeight: "800" },
});
