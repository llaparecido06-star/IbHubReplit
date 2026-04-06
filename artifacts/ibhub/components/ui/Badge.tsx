import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

type BadgeVariant = "default" | "gold" | "wine" | "success" | "warning";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  style?: ViewStyle;
}

export function Badge({ label, variant = "default", size = "sm", style }: BadgeProps) {
  const colors = useColors();

  const variantConfig: Record<BadgeVariant, { bg: string; text: string }> = {
    default: { bg: colors.secondary, text: colors.mutedForeground },
    gold: { bg: colors.gold + "22", text: colors.gold },
    wine: { bg: colors.wine + "22", text: colors.wine },
    success: { bg: "#27ae6022", text: "#27ae60" },
    warning: { bg: "#f39c1222", text: "#f39c12" },
  };

  const cfg = variantConfig[variant];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: cfg.bg,
          paddingVertical: size === "sm" ? 3 : 5,
          paddingHorizontal: size === "sm" ? 8 : 12,
          borderRadius: size === "sm" ? 6 : 8,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: cfg.text, fontSize: size === "sm" ? 11 : 13 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
