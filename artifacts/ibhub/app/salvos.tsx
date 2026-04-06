import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export default function SalvosScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Salvos</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Empty state */}
      <View style={styles.empty}>
        <Feather name="bookmark" size={56} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.navy }]}>Nenhuma publicação salva</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Toque no ícone de salvar em qualquer publicação
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  empty:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle:  { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptySub:    { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
