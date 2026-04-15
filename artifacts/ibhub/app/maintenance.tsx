import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";

export default function MaintenanceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Feather name="tool" size={48} color="#c9a84c" />
        </View>
        <Text style={styles.title}>Voltamos já</Text>
        <Text style={styles.subtitle}>
          O ibhub está em manutenção programada.{"\n"}
          Voltaremos em breve, obrigado pela paciência!
        </Text>
        <View style={styles.divider} />
        <Text style={styles.footer}>ibhub — Rede do Vinho</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#0d1b2a" },
  content:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  iconWrap:   { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(201,168,76,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title:      { fontSize: 28, fontWeight: "800", color: "#c9a84c", marginBottom: 16, textAlign: "center" },
  subtitle:   { fontSize: 16, color: "rgba(255,255,255,0.7)", lineHeight: 24, textAlign: "center", marginBottom: 32 },
  divider:    { width: 48, height: 2, backgroundColor: "rgba(201,168,76,0.3)", borderRadius: 1, marginBottom: 24 },
  footer:     { fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1 },
});
