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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive web base URL from API URL (strips /api suffix) */
function getWebBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  return apiUrl.replace(/\/api\/?$/, "");
}

const PLAN_LABELS: Record<string, string> = {
  basico:    "Básico",
  premium:   "Premium",
  exclusive: "Exclusive",
  business:  "Business",
  gratuito:  "Gratuito",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: "Ativo",              color: "#059669", bg: "#d1fae5" },
  trialing: { label: "Período de teste",   color: "#2563eb", bg: "#dbeafe" },
  past_due: { label: "Pagamento pendente", color: "#d97706", bg: "#fef3c7" },
  canceled: { label: "Cancelado",          color: "#dc2626", bg: "#fee2e2" },
  courtesy: { label: "Cortesia",           color: "#c9a84c", bg: "#fef9ee" },
};

// ─── Plan data ────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  price: string;
  period?: string;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "basico",
    name: "Básico",
    price: "GRÁTIS",
    features: ["Perfil básico", "Feed de publicações", "5 conexões/mês"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "R$ 149",
    period: "/mês",
    features: ["Tudo do Básico", "Conexões ilimitadas", "Marketplace", "Dados de mercado"],
    popular: true,
  },
  {
    id: "exclusive",
    name: "Exclusive",
    price: "R$ 299",
    period: "/mês",
    features: ["Tudo do Premium", "Inteligência de mercado", "Apresentações exclusivas", "Destaque no feed"],
  },
  {
    id: "business",
    name: "Business",
    price: "R$ 499",
    period: "/mês",
    features: ["Tudo do Exclusive", "Página empresarial", "Vagas de emprego", "Suporte prioritário"],
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const colors   = useColors();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();

  const [openingBrowser, setOpeningBrowser] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const currentPlan      = profile?.plan ?? "basico";
  const stripeStatus     = (profile as any)?.stripe_subscription_status as string | null;
  const courtesyUntil    = (profile as any)?.courtesy_until as string | null;
  const periodEnd        = (profile as any)?.stripe_current_period_end as string | null;
  const hasActiveSub     = stripeStatus === "active" || stripeStatus === "trialing";
  const isPastDue        = stripeStatus === "past_due";
  const isCourtesy       = !!courtesyUntil && new Date(courtesyUntil) > new Date();
  const webBase          = getWebBaseUrl();

  const statusKey = isPastDue ? "past_due"
    : isCourtesy  ? "courtesy"
    : stripeStatus ?? (currentPlan !== "basico" ? "active" : "");
  const statusCfg = statusKey ? STATUS_CONFIG[statusKey] : null;

  // Re-fetch profile when app comes back to foreground (after browser payment)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        refreshProfile().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [refreshProfile]);

  // ─── Open web page in external browser ──────────────────────────────────────

  const openPlanPage = async (planId?: string) => {
    if (!webBase) {
      Alert.alert(
        "Sem conexão",
        "Não foi possível determinar o endereço do site. Tente novamente."
      );
      return;
    }
    const url = planId
      ? `${webBase}/web/assinar?plano=${planId}`
      : `${webBase}/web/assinar`;

    setOpeningBrowser(true);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Erro", "Não foi possível abrir o navegador.");
      }
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
        contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Feather name="award" size={36} color={colors.gold} />
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Seus planos ibhub</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Pagamentos realizados com segurança pelo site
          </Text>
        </View>

        {/* Current status card */}
        <View style={[styles.statusCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <View>
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>Plano atual</Text>
              <Text style={[styles.statusPlan, { color: colors.navy }]}>
                {PLAN_LABELS[currentPlan] ?? currentPlan}
              </Text>
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
            {statusCfg && (
              <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                <Text style={[styles.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
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

          {/* CTA for current subscription management */}
          {(hasActiveSub || isPastDue) && (
            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: colors.border }]}
              onPress={openPortal}
              disabled={openingBrowser}
            >
              <Feather name="external-link" size={14} color={colors.navy} />
              <Text style={[styles.manageBtnText, { color: colors.navy }]}>
                Gerenciar assinatura
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Plan cards */}
        <Text style={[styles.sectionTitle, { color: colors.navy }]}>Planos disponíveis</Text>

        {PLANS.map((plan) => {
          const isActive = plan.id === currentPlan;
          const isPaid   = plan.id !== "basico";

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                {
                  backgroundColor: "#fff",
                  borderColor: isActive ? colors.gold : colors.border,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
            >
              {plan.popular && (
                <View style={[styles.popularBadge, { backgroundColor: colors.gold }]}>
                  <Text style={styles.popularText}>POPULAR</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: colors.navy }]}>{plan.name}</Text>
                <Text style={[styles.planPrice, { color: colors.gold }]}>
                  {plan.price}
                  {plan.period && <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>{plan.period}</Text>}
                </Text>
              </View>

              <View style={styles.features}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Feather name="check" size={14} color={colors.gold} />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                  </View>
                ))}
              </View>

              {isActive ? (
                <View style={[styles.currentBtn, { backgroundColor: `${colors.gold}12`, borderColor: `${colors.gold}30` }]}>
                  <Feather name="check-circle" size={14} color={colors.gold} />
                  <Text style={[styles.currentBtnText, { color: colors.gold }]}>Plano atual</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.selectBtn, { backgroundColor: isPaid ? colors.gold : colors.background, borderColor: colors.border, borderWidth: isPaid ? 0 : 1 }]}
                  onPress={() => isPaid ? openPlanPage(plan.id) : null}
                  disabled={!isPaid || openingBrowser}
                  activeOpacity={isPaid ? 0.8 : 1}
                >
                  {openingBrowser ? (
                    <ActivityIndicator size="small" color={isPaid ? "#fff" : colors.mutedForeground} />
                  ) : (
                    <>
                      {isPaid && <Feather name="external-link" size={14} color="#fff" />}
                      <Text style={[styles.selectBtnText, { color: isPaid ? "#fff" : colors.mutedForeground }]}>
                        {isPaid ? "Assinar pelo site" : "Plano gratuito"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Info note */}
        <View style={[styles.infoBox, { backgroundColor: `${colors.gold}0A`, borderColor: `${colors.gold}25` }]}>
          <Feather name="info" size={14} color={colors.gold} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Assinaturas são processadas pelo site ibhub com segurança via Stripe. Após o pagamento, seu plano é atualizado automaticamente no app.
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
  hero:           { alignItems: "center", gap: 8, paddingVertical: 10 },
  heroTitle:      { fontSize: 22, fontWeight: "800" },
  heroSub:        { fontSize: 14, textAlign: "center" },

  statusCard:     { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  statusRow:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  statusLabel:    { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  statusPlan:     { fontSize: 20, fontWeight: "900" },
  statusPeriod:   { fontSize: 12, marginTop: 4 },
  badge:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  badgeText:      { fontSize: 12, fontWeight: "700" },
  warningBox:     { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 8, padding: 10 },
  warningText:    { fontSize: 12, flex: 1, lineHeight: 18 },
  manageBtn:      { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 12, justifyContent: "center" },
  manageBtnText:  { fontSize: 14, fontWeight: "600" },

  sectionTitle:   { fontSize: 16, fontWeight: "800", marginTop: 4 },
  planCard:       { borderRadius: 12, padding: 16, gap: 12, overflow: "visible" },
  popularBadge:   { alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: -4 },
  popularText:    { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  planHeader:     { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  planName:       { fontSize: 18, fontWeight: "800" },
  planPrice:      { fontSize: 18, fontWeight: "700" },
  planPeriod:     { fontSize: 13 },
  features:       { gap: 6 },
  featureRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText:    { fontSize: 14 },
  currentBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, justifyContent: "center" },
  currentBtnText: { fontSize: 14, fontWeight: "700" },
  selectBtn:      { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "stretch", justifyContent: "center", paddingVertical: 13, borderRadius: 10 },
  selectBtnText:  { fontSize: 15, fontWeight: "700" },

  infoBox:        { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 10, padding: 12 },
  infoText:       { flex: 1, fontSize: 12, lineHeight: 18 },
});
