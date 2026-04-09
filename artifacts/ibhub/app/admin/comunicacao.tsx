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

const SEGMENTS = ["Todos os usuários", "Gratuito", "Básico", "Empresa", "Executivo", "Profissional"];

interface PushLog {
  id: string;
  created_at: string;
  titulo: string;
  mensagem: string;
  segmento: string;
  deep_link: string | null;
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
  const [segmento, setSegmento]       = useState(SEGMENTS[0]);
  const [segOpen, setSegOpen]         = useState(false);
  const [deepLink, setDeepLink]       = useState("");
  const [sending, setSending]         = useState(false);

  const [logs, setLogs]               = useState<PushLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logsError, setLogsError]     = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const canSend = titulo.trim().length > 0 && mensagem.trim().length > 0;

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogsError(null);
    const { data, error } = await supabase
      .from("push_notification_logs")
      .select("id, created_at, titulo, mensagem, segmento, deep_link")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setLogsError("Erro ao carregar histórico.");
    } else if (data) {
      setLogs(data as PushLog[]);
    }
    setLoadingLogs(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);
    const userId = session?.user?.id ?? null;
    const { error } = await supabase.from("push_notification_logs").insert({
      titulo: titulo.trim(),
      mensagem: mensagem.trim(),
      segmento,
      deep_link: deepLink.trim() || null,
      sent_by: userId,
    });
    setSending(false);
    if (error) {
      Alert.alert("Erro", "Não foi possível registrar a notificação: " + error.message);
      return;
    }
    Alert.alert("Enviado!", `Notificação "${titulo}" registrada para ${segmento}.`);
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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
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
                  {segmento.length > 10 ? segmento.slice(0, 8) + "..." : segmento}
                </Text>
                <Feather name="chevron-down" size={12} color={colors.mutedForeground} />
              </TouchableOpacity>
              {segOpen && (
                <View style={[styles.dropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {SEGMENTS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.dropItem, { borderBottomColor: colors.border }, s === segmento && { backgroundColor: colors.gold + "12" }]}
                      onPress={() => { setSegmento(s); setSegOpen(false); }}
                    >
                      <Text style={[styles.dropText, { color: s === segmento ? colors.gold : colors.foreground }]}>{s}</Text>
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
                </View>
              ))
            )}
          </View>
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
});
