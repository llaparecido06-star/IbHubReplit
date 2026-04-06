import React, { useState } from "react";
import {
  Platform,
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

const MAIN_TABS = ["Denúncias", "Certificações"];
const CERT_TABS = ["Pendentes", "Verificadas", "Rejeitadas", "Todas"];

export default function AdminModeracaoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mainTab, setMainTab]       = useState("Denúncias");
  const [certTab, setCertTab]       = useState("Pendentes");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Moderação</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
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
            const label = t === "Denúncias" ? "Denúncias (0)" : t;
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
          /* Denúncias empty */
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma denúncia pendente 🎉</Text>
          </View>
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
            {/* Cert empty */}
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma certificação pendente 🎉</Text>
            </View>
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
});
