import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { getEntitlementStatus } from "@/utils/entitlement";
import { usePlans, formatPlanPrice } from "@/hooks/usePlans";

function getWebBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  return apiUrl.replace(/\/api\/?$/, "");
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: "Ativo",              color: "#059669", bg: "#d1fae5" },
  trialing: { label: "Período de teste",   color: "#2563eb", bg: "#dbeafe" },
  past_due: { label: "Pagamento pendente", color: "#d97706", bg: "#fef3c7" },
  canceled: { label: "Cancelado",          color: "#dc2626", bg: "#fee2e2" },
  courtesy: { label: "Cortesia",           color: "#c9a84c", bg: "#fef9ee" },
};

export default function SubscriptionScreen() {
  const colors   = useColors();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const { paidPlans, freePlan, getPlanLabel, loading: plansLoading } = usePlans();

  const [openingBrowser, setOpeningBrowser] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const currentPlan   = profile?.plan ?? "gratuito";
  const periodEnd     = profile?.stripe_current_period_end ?? null;
  const courtesyUntil = profile?.courtesy_until ?? null;
  const webBase       = getWebBaseUrl();

  const entitleStatus = getEntitlementStatus(profile);
  const hasActiveSub  = entitleStatus === "active" || entitleStatus === "trialing" || entitleStatus === "courtesy";
  const isPastDue     = entitleStatus === "past_due";
  const isCourtesy    = entitleStatus === "courtesy";
  const isFree        = entitleStatus === "free";

  const statusKey = (entitleStatus !== "free" ? entitleStatus : null) ?? "";
  const statusCfg = statusKey ? STATUS_CONFIG[statusKey] : null;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") refreshProfile().catch(() => {});
    });
    return () => sub.remove();
  }, [refreshProfile]);

  const openPlanPage = async (planId?: string) => {
    if (!webBase) {
      Alert.alert("Sem conexão", "Não foi possível determinar o endereço do site. Tente novamente.");
      return;
    }
    const url = planId ? `${webBase}/web/assinar?plano=${planId}` : `${webBase}/web/assinar`;
    setOpeningBrowser(true);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
      else Alert.alert("Erro", "Não foi possível abrir o navegador.");
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o navegador.");
    } finally {
      setOpeningBrowser(false);
    }
  };

  const openPortal = async () => {
    const url = `${webBase}/web/minha-conta`;
    setOpeningBrowser(true);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o navegador.");
    } finally {
      setOpeningBrowser(false);
    }
  };

  const currentPlanLabel = getPlanLabel(currentPlan);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Assinatura</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.navy, borderRadius: 16, padding: 20 }]}>
          <View style={[styles.heroBadge, { backgroundColor: "rgba(201,168,76,0.15)" }]}>
            <Feather name="award" size={16} color={colors.gold} />
            <Text style={[styles.heroBadgeText, { color: colors.gold }]}>ibhub Pro</Text>
          </View>
          <Text style={styles.heroTitle}>Desbloqueie todo o potencial da rede do vinho</Text>
          <Text style={styles.heroSub}>Pagamentos seguros via Stripe · Cancele quando quiser</Text>
        </View>

        {/* Current plan status */}
        <View style={[styles.statusCard, { backgroundColor: "#fff", borderColor: isFree ? colors.border : colors.gold, borderWidth: isFree ? 1 : 2 }]}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>Plano atual</Text>
              <Text style={[styles.statusPlan, { color: colors.navy }]}>{currentPlanLabel}</Text>
              {periodEnd && (
                <Text style={[styles.statusPeriod, { color: colors.mutedForeground }]}>
                  {hasActiveSub ? "Renova em " : "Encerra em "}
                  {new Date(periodEnd).toLocaleDateString("pt-BR")}
                </Text>
              )}
              {isCourtesy && courtesyUntil && (
                <Text style={[styles.statusPeriod, { color: colors.mutedForeground }]}>
                  Cortesia até {new Date(courtesyUntil).toLocaleDateString("pt-BR")}
                </Text>
              )}
            </View>
            {statusCfg ? (
              <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                <Text style={[styles.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: colors.background }]}>
                <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>Gratuito</Text>
              </View>
            )}
          </View>

          {isPastDue && (
            <View style={[styles.warningBox, { backgroundColor: "#fef3c7" }]}>
              <Feather name="alert-triangle" size={14} color="#d97706" />
              <Text style={[styles.warningText, { color: "#92400e" }]}>
                Pagamento pendente — atualize pelo site para manter o acesso.
              </Text>
            </View>
          )}

          {(hasActiveSub || isPastDue) && (
            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: colors.border }]}
              onPress={openPortal}
              disabled={openingBrowser}
            >
              <Feather name="external-link" size={14} color={colors.navy} />
              <Text style={[styles.manageBtnText, { color: colors.navy }]}>Gerenciar assinatura</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Paid plan cards */}
        <Text style={[styles.sectionTitle, { color: colors.navy }]}>
          {hasActiveSub ? "Outros planos" : "Escolha seu plano"}
        </Text>

        {plansLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Carregando planos...</Text>
          </View>
        ) : (
          paidPlans.map((plan, idx) => {
            const isActive  = plan.id === currentPlan;
            const isPopular = idx === 0;
            const price     = formatPlanPrice(plan);
            const generalFeatures = plan.features.filter(f => !f.startsWith("mercado:"));

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: "#fff",
                    borderColor: isActive ? colors.gold : isPopular ? `${colors.gold}50` : colors.border,
                    borderWidth: isActive ? 2 : isPopular ? 1.5 : 1,
                  },
                ]}
              >
                {isPopular && !isActive && (
                  <View style={[styles.popularBadge, { backgroundColor: colors.gold }]}>
                    <Text style={styles.popularText}>MAIS POPULAR</Text>
                  </View>
                )}
                {isActive && (
                  <View style={[styles.popularBadge, { backgroundColor: "#059669" }]}>
                    <Text style={styles.popularText}>✓ PLANO ATUAL</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: colors.navy }]}>{plan.name}</Text>
                    <Text style={[styles.planSub, { color: colors.mutedForeground }]}>{plan.subtitle}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.planPrice, { color: colors.gold }]}>{price.main}</Text>
                    {price.period && (
                      <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>{price.period}</Text>
                    )}
                  </View>
                </View>

                {generalFeatures.length > 0 && (
                  <View style={styles.features}>
                    {generalFeatures.map((f) => (
                      <View key={f} style={styles.featureRow}>
                        <Feather name="check" size={13} color={colors.gold} />
                        <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {isActive ? (
                  <View style={[styles.currentBtn, { backgroundColor: `${colors.gold}12`, borderColor: `${colors.gold}30` }]}>
                    <Feather name="check-circle" size={14} color={colors.gold} />
                    <Text style={[styles.currentBtnText, { color: colors.gold }]}>Plano atual</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.selectBtn, { backgroundColor: isPopular ? colors.gold : colors.navy }]}
                    onPress={() => openPlanPage(plan.id)}
                    disabled={openingBrowser}
                    activeOpacity={0.82}
                  >
                    {openingBrowser ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="external-link" size={14} color="#fff" />
                        <Text style={styles.selectBtnText}>Assinar {plan.name}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {/* Free plan — discrete, at the bottom */}
        {freePlan && isFree && (
          <View style={[styles.freePlanHint, { borderColor: colors.border }]}>
            <Feather name="check-circle" size={14} color={colors.mutedForeground} />
            <Text style={[styles.freePlanText, { color: colors.mutedForeground }]}>
              Você está no plano {freePlan.name} · {freePlan.subtitle}
            </Text>
          </View>
        )}

        {/* Info note */}
        <View style={[styles.infoBox, { backgroundColor: `${colors.gold}0A`, borderColor: `${colors.gold}25` }]}>
          <Feather name="lock" size={13} color={colors.gold} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Assinaturas processadas com segurança via Stripe. Após o pagamento, seu plano é atualizado automaticamente no app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:    { fontSize: 20, fontWeight: "700" },

  hero:           { gap: 10 },
  heroBadge:      { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  heroBadgeText:  { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  heroTitle:      { fontSize: 20, fontWeight: "900", color: "#fff", lineHeight: 28 },
  heroSub:        { fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 18 },

  statusCard:     { borderRadius: 14, padding: 16, gap: 10, backgroundColor: "#fff" },
  statusRow:      { flexDirection: "row", alignItems: "flex-start" },
  statusLabel:    { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  statusPlan:     { fontSize: 22, fontWeight: "900" },
  statusPeriod:   { fontSize: 12, marginTop: 4 },
  badge:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  badgeText:      { fontSize: 12, fontWeight: "700" },
  warningBox:     { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 8, padding: 10 },
  warningText:    { fontSize: 12, flex: 1, lineHeight: 18 },
  manageBtn:      { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 12, justifyContent: "center" },
  manageBtnText:  { fontSize: 14, fontWeight: "600" },

  sectionTitle:   { fontSize: 17, fontWeight: "800", marginTop: 4 },

  loadingBox:     { alignItems: "center", paddingVertical: 32, gap: 10 },
  loadingText:    { fontSize: 13 },

  planCard:       { borderRadius: 14, padding: 16, gap: 12, overflow: "visible" },
  popularBadge:   { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: -4 },
  popularText:    { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  planHeader:     { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  planName:       { fontSize: 18, fontWeight: "800" },
  planSub:        { fontSize: 12, marginTop: 2, lineHeight: 17 },
  planPrice:      { fontSize: 20, fontWeight: "900" },
  planPeriod:     { fontSize: 12, marginTop: 1 },
  features:       { gap: 7 },
  featureRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText:    { fontSize: 13 },
  currentBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, justifyContent: "center" },
  currentBtnText: { fontSize: 14, fontWeight: "700" },
  selectBtn:      { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "stretch", justifyContent: "center", paddingVertical: 14, borderRadius: 10 },
  selectBtnText:  { fontSize: 15, fontWeight: "700", color: "#fff" },

  freePlanHint:   { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  freePlanText:   { fontSize: 13, flex: 1, lineHeight: 18 },

  infoBox:        { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 10, padding: 12 },
  infoText:       { flex: 1, fontSize: 12, lineHeight: 18 },
});
