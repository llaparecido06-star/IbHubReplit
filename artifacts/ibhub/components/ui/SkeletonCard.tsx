import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

function useShimmer() {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

function Box({ opacity, style }: { opacity: Animated.Value; style?: object }) {
  const colors = useColors();
  return (
    <Animated.View
      style={[{ backgroundColor: colors.border, borderRadius: 6, opacity }, style]}
    />
  );
}

export function SkeletonCard() {
  const colors = useColors();
  const opacity = useShimmer();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.header}>
        <Box opacity={opacity} style={styles.avatar} />
        <View style={styles.headerLines}>
          <Box opacity={opacity} style={styles.nameLine} />
          <Box opacity={opacity} style={styles.dateLine} />
        </View>
      </View>

      <Box opacity={opacity} style={styles.line100} />
      <Box opacity={opacity} style={styles.line90} />
      <Box opacity={opacity} style={styles.line65} />

      <View style={styles.actions}>
        <Box opacity={opacity} style={styles.actionBtn} />
        <Box opacity={opacity} style={styles.actionBtn} />
        <Box opacity={opacity} style={styles.actionBtn} />
        <Box opacity={opacity} style={styles.actionBtn} />
      </View>
    </View>
  );
}

export function SkeletonFeed({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

/** Skeleton for profile / public profile screens. */
export function SkeletonProfile() {
  const colors = useColors();
  const opacity = useShimmer();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Cover photo strip */}
      <Box opacity={opacity} style={{ height: 120, borderRadius: 0 }} />
      {/* Avatar + name block */}
      <View style={{ paddingHorizontal: 16, marginTop: -36, marginBottom: 16, gap: 10 }}>
        <Box opacity={opacity} style={{ width: 72, height: 72, borderRadius: 36 }} />
        <Box opacity={opacity} style={{ height: 15, width: "55%", marginTop: 4 }} />
        <Box opacity={opacity} style={{ height: 12, width: "40%" }} />
        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 24, marginTop: 8 }}>
          <Box opacity={opacity} style={{ height: 28, width: 56, borderRadius: 8 }} />
          <Box opacity={opacity} style={{ height: 28, width: 56, borderRadius: 8 }} />
          <Box opacity={opacity} style={{ height: 28, width: 56, borderRadius: 8 }} />
        </View>
      </View>
      {/* Post skeletons below */}
      <SkeletonFeed count={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerLines: {
    flex: 1,
    gap: 7,
  },
  nameLine: {
    height: 13,
    width: "55%",
    borderRadius: 6,
  },
  dateLine: {
    height: 11,
    width: "35%",
    borderRadius: 6,
  },
  line100: {
    height: 13,
    width: "100%",
  },
  line90: {
    height: 13,
    width: "90%",
  },
  line65: {
    height: 13,
    width: "65%",
  },
  actions: {
    flexDirection: "row",
    gap: 20,
    marginTop: 4,
  },
  actionBtn: {
    height: 18,
    width: 48,
    borderRadius: 6,
  },
});
