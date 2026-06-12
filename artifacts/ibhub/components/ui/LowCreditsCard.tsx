import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";

interface Props {
  aiCredits: number | null;
  revealCredits?: number | null;
  compact?: boolean;
  nextPlanLabel?: string;
  nextPlanMonthlyCredits?: number;
}

export function LowCreditsCard({ aiCredits, revealCredits, compact = false, nextPlanLabel, nextPlanMonthlyCredits }: Props) {
  const colors = useColors();
  const router = useRouter();

  const aiLow = aiCredits !== null && aiCredits <= 3;
  const revealLow = revealCredits !== null && revealCredits !== undefined && revealCredits <= 3;

  if (!aiLow && !revealLow) return null;

  return (
    <View style={[styles.card, { backgroundColor: "#fff", borderColor: `${colors.gold}50` }]}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: `${colors.gold}15` }]}>
          <Feather name="zap" size={18} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.navy }]}>Créditos baixos</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {aiLow && aiCredits !== null && (
              <View style={[styles.badge, { backgroundColor: aiCredits === 0 ? "#fef2f2" : "#fef9ee" }]}>
                <Text style={[styles.badgeText, { color: aiCredits === 0 ? "#dc2626" : "#d97706" }]}>
                  ⚡ {aiCredits === 0 ? "Sem créditos IA" : `${aiCredits} crédito${aiCredits === 1 ? "" : "s"} IA`}
                </Text>
              </View>
            )}
            {revealLow && revealCredits !== null && revealCredits !== undefined && (
              <View style={[styles.badge, { backgroundColor: revealCredits === 0 ? "#fef2f2" : "#fef9ee" }]}>
                <Text style={[styles.badgeText, { color: revealCredits === 0 ? "#dc2626" : "#d97706" }]}>
                  🔓 {revealCredits === 0 ? "Sem revelações" : `${revealCredits} revelação${revealCredits === 1 ? "" : "ões"}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {!compact && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.gold }]}
            onPress={() => router.push("/credit-shop" as any)}
            activeOpacity={0.82}
          >
            <Feather name="shopping-cart" size={14} color="#fff" />
            <Text style={styles.btnPrimaryText}>Comprar créditos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border }]}
            onPress={() => router.push("/subscription" as any)}
            activeOpacity={0.82}
          >
            <Feather name="arrow-up-circle" size={14} color={colors.navy} />
            <Text style={[styles.btnSecondaryText, { color: colors.navy }]}>
              {nextPlanLabel
                ? `Upgrade para ${nextPlanLabel}${nextPlanMonthlyCredits ? ` — ${nextPlanMonthlyCredits} créditos/mês` : ""}`
                : "Ver planos"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  btnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
