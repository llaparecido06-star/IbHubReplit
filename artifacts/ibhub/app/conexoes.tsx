import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type ConexoesTab = "pendentes" | "conectados";

const ENVIADAS = [
  { id: "e1", name: "Lucas Lima",      role: "",           initial: "L" },
  { id: "e2", name: "João Oliveira",   role: "Importador", initial: "J" },
  { id: "e3", name: "Felipe Galtaroca",role: "Produtor",   initial: "F" },
  { id: "e4", name: "Brenda Lima",     role: "Outros",     initial: "B" },
  { id: "e5", name: "Julia Benetti",   role: "Outros",     initial: "J" },
];

const RECEBIDAS: typeof ENVIADAS = [];

export default function ConexoesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<ConexoesTab>("pendentes");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

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
          { key: "pendentes",   label: "Pendentes" },
          { key: "conectados",  label: `Conectados (0)` },
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

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* ── Pendentes tab ── */}
        {activeTab === "pendentes" && (
          <View>
            {/* Enviadas */}
            {ENVIADAS.length > 0 && (
              <View>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ENVIADAS</Text>
                {ENVIADAS.map((person) => (
                  <View
                    key={person.id}
                    style={[styles.personRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.avatar, { backgroundColor: colors.navy }]}>
                      <Text style={[styles.avatarInitial, { color: colors.gold }]}>{person.initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.personName, { color: colors.navy }]}>{person.name}</Text>
                      {person.role ? (
                        <Text style={[styles.personRole, { color: colors.mutedForeground }]}>{person.role}</Text>
                      ) : null}
                    </View>
                    <View style={styles.waitingBadge}>
                      <Feather name="clock" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>Aguardando</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Recebidas */}
            {RECEBIDAS.length > 0 && (
              <View>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>RECEBIDAS</Text>
                {RECEBIDAS.map((person) => (
                  <View
                    key={person.id}
                    style={[styles.personRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.avatar, { backgroundColor: colors.navy }]}>
                      <Text style={[styles.avatarInitial, { color: colors.gold }]}>{person.initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.personName, { color: colors.navy }]}>{person.name}</Text>
                      {person.role ? (
                        <Text style={[styles.personRole, { color: colors.mutedForeground }]}>{person.role}</Text>
                      ) : null}
                    </View>
                    <View style={styles.receiveActions}>
                      <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.gold }]}>
                        <Text style={styles.acceptText}>Aceitar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.rejectBtn, { borderColor: colors.border }]}>
                        <Text style={[styles.rejectText, { color: colors.mutedForeground }]}>Recusar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {ENVIADAS.length === 0 && RECEBIDAS.length === 0 && (
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
          <View style={styles.empty}>
            <Feather name="user-check" size={36} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma conexão ainda</Text>
          </View>
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
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 18, fontWeight: "800" },
  personName: { fontSize: 15, fontWeight: "600" },
  personRole: { fontSize: 13, marginTop: 2 },
  waitingBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  waitingText: { fontSize: 13 },
  receiveActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  rejectBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  rejectText: { fontSize: 13 },
  empty: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 14 },
});
