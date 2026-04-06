import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface DividerProps {
  label?: string;
  style?: ViewStyle;
}

export function Divider({ label, style }: DividerProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      {label && (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flex: 1, height: 1 },
  label: { fontSize: 13, fontWeight: "500" },
});
