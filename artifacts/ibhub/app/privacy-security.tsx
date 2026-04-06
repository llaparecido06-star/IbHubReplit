import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export default function PrivacySecurityScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [publicProfile, setPublicProfile] = useState(true);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const handleDeleteAccount = () => {
    Alert.alert(
      "Excluir conta",
      "Todos os seus dados serão permanentemente removidos. Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => {} },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Privacidade e Segurança</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Visibilidade */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.sectionHead}>
            <Feather name="eye" size={15} color={colors.gold} />
            <Text style={[styles.sectionHeadText, { color: colors.navy }]}>Visibilidade do Perfil</Text>
          </View>
          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Perfil Público</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Qualquer pessoa pode ver seu perfil e publicações
              </Text>
            </View>
            <Switch
              value={publicProfile}
              onValueChange={setPublicProfile}
              trackColor={{ false: colors.border, true: colors.navy }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Segurança */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.sectionHead}>
            <Feather name="shield" size={15} color={colors.gold} />
            <Text style={[styles.sectionHeadText, { color: colors.navy }]}>Segurança</Text>
          </View>
          <TouchableOpacity style={[styles.arrowRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.navy }]}>Alterar senha</Text>
            <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Zona de Perigo */}
        <View style={[styles.dangerCard, { backgroundColor: "#fff5f5", borderColor: "#fecaca" }]}>
          <View style={styles.dangerHead}>
            <Feather name="trash-2" size={15} color="#dc2626" />
            <Text style={[styles.dangerTitle, { color: "#dc2626" }]}>Zona de Perigo</Text>
          </View>
          <Text style={[styles.dangerText, { color: colors.mutedForeground }]}>
            Ao excluir sua conta, todos os seus dados serão permanentemente removidos. Esta ação não pode ser desfeita.
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: "#dc2626" }]}
            onPress={handleDeleteAccount}
          >
            <Text style={[styles.deleteBtnText, { color: "#dc2626" }]}>Excluir minha conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:     { fontSize: 20, fontWeight: "700" },
  card:            { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  sectionHead:     { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  sectionHeadText: { fontSize: 15, fontWeight: "700" },
  row:             { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1 },
  arrowRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1 },
  rowLabel:        { fontSize: 15, fontWeight: "600" },
  rowSub:          { fontSize: 12, marginTop: 2 },
  dangerCard:      { borderRadius: 12, borderWidth: 1.5, padding: 16, gap: 12 },
  dangerHead:      { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerTitle:     { fontSize: 15, fontWeight: "700" },
  dangerText:      { fontSize: 13, lineHeight: 20 },
  deleteBtn:       { alignItems: "center", paddingVertical: 14, borderRadius: 10, borderWidth: 1.5 },
  deleteBtnText:   { fontSize: 15, fontWeight: "600" },
});
