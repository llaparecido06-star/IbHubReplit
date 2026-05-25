import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";

export function TabErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={st.container}>
      <Text style={st.title}>Algo deu errado</Text>
      <Text style={st.message} numberOfLines={4}>{error.message}</Text>
      <TouchableOpacity style={st.btn} onPress={retry}>
        <Text style={st.btnText}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a", padding: 32 },
  title:     { color: "#c9a84c", fontSize: 18, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  message:   { color: "rgba(255,255,255,0.55)", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  btn:       { backgroundColor: "#c9a84c", paddingHorizontal: 28, paddingVertical: 13, borderRadius: 10 },
  btnText:   { color: "#0d1b2a", fontWeight: "700", fontSize: 15 },
});
