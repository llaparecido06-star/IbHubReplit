import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";

type Tab = "membros" | "pendentes" | "convidar" | "link";

interface Member {
  id: string;
  name: string;
  role: "dono" | "admin" | "membro";
}

const GROUP_MAP: Record<string, { name: string; members: Member[] }> = {
  g1: { name: "Enoturismo", members: [
    { id: "m1", name: "Brenda Lima",   role: "dono" },
    { id: "m2", name: "Felipe G.",     role: "membro" },
  ]},
  g2: { name: "Teste 2", members: [
    { id: "m1", name: "Maria Santos", role: "dono" },
  ]},
};

const TABS: { key: Tab; label: string }[] = [
  { key: "membros",   label: "Membros" },
  { key: "pendentes", label: "Pendentes" },
  { key: "convidar",  label: "Convidar" },
  { key: "link",      label: "Link" },
];

export default function GroupSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("membros");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const group = GROUP_MAP[id] ?? { name: "Grupo", members: [] };

  const handleDelete = () => {
    Alert.alert(
      "Excluir grupo",
      "Ao excluir o grupo, todos os membros serão removidos e as mensagens serão apagadas permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => router.replace("/groups" as any) },
      ]
    );
  };

  const renderTab = () => {
    switch (activeTab) {
      case "membros":
        return (
          <View style={{ gap: 10, padding: 16 }}>
            {group.members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[styles.memberRow, { backgroundColor: "#fff", borderColor: colors.border }]}
                onPress={() => router.push(`/profile/${member.id}` as any)}
                activeOpacity={0.7}
              >
                <Avatar name={member.name} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.navy }]}>{member.name}</Text>
                  {member.role === "dono" && (
                    <View style={styles.roleRow}>
                      <Feather name="star" size={12} color={colors.gold} />
                      <Text style={[styles.roleText, { color: colors.gold }]}>Dono</Text>
                    </View>
                  )}
                  {member.role === "admin" && (
                    <Text style={[styles.roleText, { color: colors.mutedForeground }]}>Admin</Text>
                  )}
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}

            {/* Danger zone */}
            <View style={[styles.dangerCard, { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }]}>
              <View style={styles.dangerHeader}>
                <Feather name="alert-triangle" size={16} color="#dc2626" />
                <Text style={[styles.dangerTitle, { color: "#dc2626" }]}>Zona de Perigo</Text>
              </View>
              <Text style={[styles.dangerDesc, { color: "#7f1d1d" }]}>
                Ao excluir o grupo, todos os membros serão removidos e as mensagens serão apagadas permanentemente.
              </Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Feather name="trash-2" size={16} color="#fff" />
                <Text style={styles.deleteBtnText}>Excluir Grupo</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "pendentes":
        return (
          <View style={styles.emptyTab}>
            <Feather name="clock" size={36} color={colors.border} />
            <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
              Nenhuma solicitação pendente
            </Text>
          </View>
        );

      case "convidar":
        return (
          <View style={styles.emptyTab}>
            <Feather name="user-plus" size={36} color={colors.border} />
            <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
              Pesquise usuários para convidar
            </Text>
          </View>
        );

      case "link":
        return (
          <View style={[styles.linkTab, { padding: 16 }]}>
            <View style={[styles.linkBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Feather name="link-2" size={18} color={colors.gold} />
              <Text style={[styles.linkText, { color: colors.navy }]} numberOfLines={1}>
                ibhub.app/grupo/{id}
              </Text>
            </View>
            <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.gold }]}>
              <Feather name="copy" size={16} color="#fff" />
              <Text style={styles.copyBtnText}>Copiar link</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.navy }]}>Configurações</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{group.name}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const label = tab.key === "membros"
            ? `Membros (${group.members.length})`
            : tab.label;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, { color: isActive ? colors.gold : colors.mutedForeground }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {renderTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backRow:         { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle:     { fontSize: 20, fontWeight: "800" },
  headerSubtitle:  { fontSize: 13, marginTop: 2 },
  tabBar:          { flexDirection: "row", borderBottomWidth: 1 },
  tabItem:         { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabLabel:        { fontSize: 12, fontWeight: "600" },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  memberName: { fontSize: 15, fontWeight: "700" },
  roleRow:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  roleText:   { fontSize: 12 },
  dangerCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 10, marginTop: 8 },
  dangerHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerTitle:  { fontSize: 15, fontWeight: "700" },
  dangerDesc:   { fontSize: 13, lineHeight: 18 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#dc2626", paddingVertical: 14, borderRadius: 10, marginTop: 4,
  },
  deleteBtnText:{ color: "#fff", fontSize: 15, fontWeight: "700" },
  emptyTab:     { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTabText: { fontSize: 14 },
  linkTab:      { gap: 12 },
  linkBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 10, borderWidth: 1,
  },
  linkText:     { flex: 1, fontSize: 13 },
  copyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 10,
  },
  copyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
