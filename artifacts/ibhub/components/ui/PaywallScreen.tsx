import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";

interface PaywallScreenProps {
  featureName: string;
  description?: string;
  requiredPlan?: string;
}

export function PaywallScreen({ featureName, description, requiredPlan }: PaywallScreenProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.gold + "15" }]}>
          <Feather name="lock" size={36} color={colors.gold} />
        </View>
        <Text style={[styles.title, { color: colors.navy }]}>{t("paywall.title")}</Text>
        <Text style={[styles.featureName, { color: colors.gold }]}>{featureName}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {description ?? t("paywall.description_default")}
        </Text>
        {requiredPlan && (
          <View style={[styles.planBadge, { backgroundColor: colors.gold + "15" }]}>
            <Text style={[styles.planBadgeText, { color: colors.gold }]}>
              {t("paywall.plan_required", { plan: requiredPlan })}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.gold }]}
          onPress={() => router.push("/subscription")}
        >
          <Feather name="zap" size={16} color="#fff" />
          <Text style={styles.btnText}>{t("paywall.cta_btn")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, { color: colors.mutedForeground }]}>{t("paywall.back_btn")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card:           { width: "100%", maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 14 },
  iconBox:        { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  title:          { fontSize: 22, fontWeight: "800", textAlign: "center" },
  featureName:    { fontSize: 16, fontWeight: "700", textAlign: "center" },
  description:    { fontSize: 14, textAlign: "center", lineHeight: 20 },
  planBadge:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  planBadgeText:  { fontSize: 13, fontWeight: "600" },
  btn:            { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  btnText:        { color: "#fff", fontSize: 15, fontWeight: "700" },
  backBtn:        { paddingVertical: 8 },
  backBtnText:    { fontSize: 14 },
});
