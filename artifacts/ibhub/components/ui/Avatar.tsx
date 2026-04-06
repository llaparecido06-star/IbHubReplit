import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: object;
}

export function Avatar({ uri, name, size = 40, style }: AvatarProps) {
  const colors = useColors();
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const fontSize = size * 0.38;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          style,
        ]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.navyMid,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize, color: colors.gold }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
