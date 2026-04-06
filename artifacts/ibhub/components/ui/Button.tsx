import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "gold";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const colors = useColors();

  const variantStyles: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: colors.navy, borderWidth: 0 },
    secondary: { backgroundColor: colors.secondary, borderWidth: 0 },
    outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.border },
    ghost: { backgroundColor: "transparent", borderWidth: 0 },
    destructive: { backgroundColor: colors.destructive, borderWidth: 0 },
    gold: { backgroundColor: colors.gold, borderWidth: 0 },
  };

  const textVariantColors: Record<Variant, string> = {
    primary: "#ffffff",
    secondary: colors.foreground,
    outline: colors.foreground,
    ghost: colors.foreground,
    destructive: "#ffffff",
    gold: colors.navy,
  };

  const sizeStyles: Record<Size, ViewStyle> = {
    sm: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: colors.radius - 2 },
    md: { paddingVertical: 13, paddingHorizontal: 24, borderRadius: colors.radius },
    lg: { paddingVertical: 17, paddingHorizontal: 32, borderRadius: colors.radius + 2 },
  };

  const textSizes: Record<Size, TextStyle> = {
    sm: { fontSize: 13, fontWeight: "600" },
    md: { fontSize: 15, fontWeight: "600" },
    lg: { fontSize: 17, fontWeight: "700" },
  };

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && { alignSelf: "stretch" },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textVariantColors[variant]} />
      ) : (
        <Text style={[styles.text, textSizes[size], { color: textVariantColors[variant] }, textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  text: {
    letterSpacing: 0.2,
  },
});
