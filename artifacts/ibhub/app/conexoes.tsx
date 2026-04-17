import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import {
  ConnectionProfile,
  fetchPendingConnectionsReceived,
  fetchPendingConnectionsSent,
  fetchConnectedUsers,
  respondToConnection,
  getOrCreateDirectConversation,
} from "@/services/api";

type ConexoesTab = "pendentes" | "conectados";

export default function ConexoesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ConexoesTab>("pendentes");
  const [loading, setLoading] = useState(true);
  const [openingDM, setOpeningDM] = useState<string | null>(null);

  const [received, setReceived] = useState<ConnectionProfile[]>([]);
  const [sent, setSent] = useState<ConnectionProfile[]>([]);
  const [connected, setConnected] = useState<ConnectionProfile[]>([]);

  const openDM = async (personId: string) => {
    if (!user?.id || openingDM) return;
    setOpeningDM(personId);
    try {
      const cid = await getOrCreateDirectConversation(user.id, personId, true, null);
      if (cid) router.push(`/chat/${cid}` as any);
    } finally {
      setOpeningDM(null);
    }
  };

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [rec, snt, conn] = await Promise.all([
      fetchPendingConnectionsReceived(user.id),
      fetchPendingConnectionsSent(user.id),
      fetchConnectedUsers(user.id),
    ]);
    setReceived(rec);
    setSent(snt);
    setConnected(conn);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`connections-${user.id}_${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
          filter: `requester_id=eq.${user.id}`,
        },
        () => { load(); },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => { load(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const handleAccept = async (connectionId: string, profileId: string) => {
    const ok = await respondToConnection(connectionId, "accepted");
    if (ok) {
      const accepted = received.find((r) => r.connectionId === connectionId);
      setReceived((prev) => prev.filter((r) => r.connectionId !== connectionId));
      if (accepted) setConnected((prev) => [accepted, ...prev]);
    }
  };

  const handleReject = async (connectionId: string) => {
    const ok = await respondToConnection(connectionId, "rejected");
    if (ok) setReceived((prev) => prev.filter((r) => r.connectionId !== connectionId));
  };

  const personRow = (person: ConnectionProfile, actions: React.ReactNode) => {
    const name = person.full_name ?? person.username ?? "Usuário";
    const sub = [person.position, person.company].filter(Boolean).join(" · ");
    return (
      <TouchableOpacity
        key={person.connectionId}
        style={[styles.personRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}
        onPress={() => router.push(`/profile/${person.id}` as any)}
        activeOpacity={0.75}
      >
        <Avatar uri={person.avatar_url} name={name} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.personName, { color: colors.navy }]}>{name}</Text>
          {sub ? <Text style={[styles.personRole, { color: colors.mutedForeground }]} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {actions}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Conexões</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "pendentes",  label: `Pendentes${received.length > 0 ? ` (${received.length})` : ""}` },
          { key: "conectados", label: `Conectados (${connected.length})` },
        ] as { key: ConexoesTab; label: string }[]).map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabLabel, { color: activeTab === t.key ? colors.gold : colors.mutedForeground }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>

          {/* ── Pendentes tab ── */}
          {activeTab === "pendentes" && (
            <View>
              {/* Recebidas */}
              {received.length > 0 && (
                <View>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>RECEBIDAS</Text>
                  {received.map((person) =>
                    personRow(
                      person,
                      <View style={styles.receiveActions}>
                        <TouchableOpacity
                          style={[styles.acceptBtn, { backgroundColor: colors.gold }]}
                          onPress={() => handleAccept(person.connectionId, person.id)}
                        >
                          <Text style={styles.acceptText}>Aceitar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectBtn, { borderColor: colors.border }]}
                          onPress={() => handleReject(person.connectionId)}
                        >
                          <Text style={[styles.rejectText, { color: colors.mutedForeground }]}>Recusar</Text>
                        </TouchableOpacity>
                      </View>,
                    )
                  )}
                </View>
              )}

              {/* Enviadas */}
              {sent.length > 0 && (
                <View>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ENVIADAS</Text>
                  {sent.map((person) =>
                    personRow(
                      person,
                      <View style={styles.waitingBadge}>
                        <Feather name="clock" size={13} color={colors.mutedForeground} />
                        <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>Aguardando</Text>
                      </View>,
                    )
                  )}
                </View>
              )}

              {received.length === 0 && sent.length === 0 && (
                <View style={styles.empty}>
                  <Feather name="users" size={36} color={colors.border} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Nenhuma solicitação pendente
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Conectados tab ── */}
          {activeTab === "conectados" && (
            connected.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="user-check" size={36} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma conexão ainda</Text>
              </View>
            ) : (
              <View>
                {connected.map((person) =>
                  personRow(
                    person,
                    <TouchableOpacity
                      style={[styles.msgBtn, { borderColor: colors.border }]}
                      onPress={() => openDM(person.id)}
                      disabled={openingDM === person.id}
                    >
                      <Feather name="message-circle" size={15} color={colors.navy} />
                    </TouchableOpacity>,
                  )
                )}
              </View>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  personName: { fontSize: 15, fontWeight: "600" },
  personRole: { fontSize: 13, marginTop: 2 },
  waitingBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  waitingText: { fontSize: 13 },
  receiveActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  rejectBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  rejectText: { fontSize: 13 },
  msgBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 14 },
});
