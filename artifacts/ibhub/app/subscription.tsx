import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Image,
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
import { usePlans, formatPlanPrice, formatOriginalPrice, calcDiscount } from "@/hooks/usePlans";
import { getCanonicalWebBaseUrl } from "@/utils/canonicalUrl";

function getWebBaseUrl(): string {
  return getCanonicalWebBaseUrl();
}

/** Annual discount percentages by plan ID (off accumulated 12× monthly price). */
const ANNUAL_DISCOUNT_PCT: Record<string, number> = {
  profissional: 10,
  empresa:      15,
  executivo:    20,
};

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; bg: string }> = {
  active:   { labelKey: "subscription.status_active",   color: "#059669", bg: "#d1fae5" },
  trialing: { labelKey: "subscription.status_trialing", color: "#2563eb", bg: "#dbeafe" },
  past_due: { labelKey: "subscription.status_past_due", color: "#d97706", bg: "#fef3c7" },
  canceled: { labelKey: "subscription.status_canceled", color: "#dc2626", bg: "#fee2e2" },
  courtesy: { labelKey: "subscription.status_courtesy", color: "#c9a84c", bg: "#fef9ee" },
  annual:   { labelKey: "subscription.status_annual",   color: "#c9a84c", bg: "#fef9ee" },
};

export default function SubscriptionScreen() {
  const { t }    = useTranslation();
  const colors   = useColors();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { profile, refreshProfile, session } = useAuth();
  const { paidPlans, freePlan, getPlanLabel, loading: plansLoading } = usePlans();

  const [openingBrowser, setOpeningBrowser] = useState(false);
  const [billingCycle, setBillingCycle]     = useState<"monthly" | "annual">("monthly");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const currentPlan   = profile?.plan ?? "gratuito";
  const periodEnd     = profile?.stripe_current_period_end ?? null;
  const courtesyUntil = profile?.courtesy_until ?? null;
  const webBase       = getWebBaseUrl();

  const entitleStatus      = getEntitlementStatus(profile);
  const isAnnual           = entitleStatus === "annual";
  const annualPlanExpiresAt = profile?.annual_plan_expires_at ?? null;
  const hasStripeSub       = entitleStatus === "active" || entitleStatus === "trialing" || entitleStatus === "courtesy";
  const hasActiveSub       = hasStripeSub || isAnnual;
  const isPastDue          = entitleStatus === "past_due";
  const isCourtesy         = entitleStatus === "courtesy";
  const isFree             = entitleStatus === "free";
  const isIOS         = Platform.OS === "ios";

  const statusKey = (entitleStatus !== "free" ? entitleStatus : null) ?? "";
  const statusCfg = statusKey ? STATUS_CONFIG[statusKey] : null;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") refreshProfile().catch(() => {});
    });
    return () => sub.remove();
  }, [refreshProfile]);

  const openPlanPage = async (planId?: string, annual?: boolean) => {
    if (!webBase) {
      Alert.alert(t("subscription.no_connection"), t("subscription.no_connection_msg"));
      return;
    }
    const annualParam = annual ? "&ciclo=anual" : "";
    const url = planId ? `${webBase}/assinar?plano=${planId}${annualParam}` : `${webBase}/assinar`;
    setOpeningBrowser(true);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
      else Alert.alert(t("common.error"), t("subscription.error_browser"));
    } catch {
      Alert.alert(t("common.error"), t("subscription.error_browser"));
    } finally {
      setOpeningBrowser(false);
    }
  };

  const openPortal = async () => {
    if (!session?.access_token) {
      Alert.alert(t("common.error"), t("subscription.error_session"));
      return;
    }
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
    setOpeningBrowser(true);
    try {
      const res = await fetch(`${apiUrl}/stripe/create-portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        Alert.alert(t("common.error"), data.error ?? t("subscription.error_portal"));
        return;
      }
      const canOpen = await Linking.canOpenURL(data.url);
      if (canOpen) await Linking.openURL(data.url);
      else Alert.alert(t("common.error"), t("subscription.error_browser"));
    } catch {
      Alert.alert(t("common.error"), t("subscription.error_portal"));
    } finally {
      setOpeningBrowser(false);
    }
  };

  const currentPlanLabel = getPlanLabel(currentPlan);

  const managementChips = [
    { icon: "credit-card", label: t("subscription.change_card") },
    { icon: "file-text",   label: t("subscription.see_invoices") },
    { icon: "x-circle",    label: t("common.cancel") },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("subscription.title")}</Text>
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
            <Image
              source={require("@/assets/images/logo_light.png")}
              style={{ height: 16, width: 62 }}
              resizeMode="contain"
            />
            <Text style={[styles.heroBadgeText, { color: colors.gold }]}>Pro</Text>
          </View>
          <Text style={styles.heroTitle}>{t("subscription.hero_title")}</Text>
          <Text style={styles.heroSub}>
            {isIOS ? t("subscription.ios_hero_sub") : t("subscription.hero_sub")}
          </Text>
        </View>

        {/* Current plan status */}
        <View style={[styles.statusCard, { backgroundColor: "#fff", borderColor: isFree ? colors.border : colors.gold, borderWidth: isFree ? 1 : 2 }]}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>{t("subscription.current_plan")}</Text>
              <Text style={[styles.statusPlan, { color: colors.navy }]}>{currentPlanLabel}</Text>
              {isAnnual && annualPlanExpiresAt ? (
                <Text style={[styles.statusPeriod, { color: colors.mutedForeground }]}>
                  {t("subscription.annual_plan_label")} · {t("subscription.expires_on")}{" "}
                  {new Date(annualPlanExpiresAt).toLocaleDateString()}
                </Text>
              ) : periodEnd ? (
                <Text style={[styles.statusPeriod, { color: colors.mutedForeground }]}>
                  {hasStripeSub ? t("subscription.renews_on") : t("subscription.encerra_em")}{" "}
                  {new Date(periodEnd).toLocaleDateString()}
                </Text>
              ) : null}
              {isCourtesy && courtesyUntil && (
                <Text style={[styles.statusPeriod, { color: colors.mutedForeground }]}>
                  {t("subscription.courtesy_until", { date: new Date(courtesyUntil).toLocaleDateString() })}
                </Text>
              )}
            </View>
            {statusCfg ? (
              <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                <Text style={[styles.badgeText, { color: statusCfg.color }]}>{t(statusCfg.labelKey)}</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: colors.background }]}>
                <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{t("subscription.free_plan")}</Text>
              </View>
            )}
          </View>

          {isPastDue && (
            <View style={[styles.warningBox, { backgroundColor: "#fef3c7" }]}>
              <Feather name="alert-triangle" size={14} color="#d97706" />
              <Text style={[styles.warningText, { color: "#92400e" }]}>
                {isIOS ? t("subscription.past_due_warning_ios") : t("subscription.past_due_warning")}
              </Text>
            </View>
          )}

          {/* On iOS, the manage/portal button and chips are hidden to comply
              with App Store guideline 3.1.3 (no anti-steering / external
              purchase management without entitlement). A static notice
              tells users where to manage their subscription instead. */}
          {(hasStripeSub || isPastDue) && !isIOS && (
            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: colors.border, marginTop: 10 }]}
              onPress={openPortal}
              disabled={openingBrowser}
            >
              {openingBrowser
                ? <ActivityIndicator size="small" color={colors.navy} />
                : <Feather name="settings" size={14} color={colors.navy} />
              }
              <Text style={[styles.manageBtnText, { color: colors.navy }]}>
                {openingBrowser ? t("subscription.opening_portal") : t("subscription.manage_btn")}
              </Text>
            </TouchableOpacity>
          )}
          {(hasStripeSub || isPastDue) && !isIOS && (
            <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {managementChips.map(item => (
                <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.background, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
                  <Feather name={item.icon as any} size={11} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Static iOS-only notice for users with active/past_due subs.
              No external link, no button — purely informational so it does
              not violate App Store guideline 3.1.3 (anti-steering). */}
          {(hasStripeSub || isPastDue) && isIOS && (
            <View style={{ marginTop: 10, flexDirection: "row", gap: 8, padding: 10, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
              <Feather name="info" size={13} color={colors.mutedForeground} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
                {t("subscription.ios_manage_notice")}
              </Text>
            </View>
          )}
        </View>

        {/* Paid plan cards */}
        <Text style={[styles.sectionTitle, { color: colors.navy }]}>
          {hasActiveSub ? t("subscription.other_plans") : t("subscription.upgrade_title")}
        </Text>

        {/* Billing cycle toggle */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, marginTop: 8 }}>
          <View style={{ flexDirection: "row", backgroundColor: colors.background, borderRadius: 100, borderWidth: 1, borderColor: colors.border, padding: 3 }}>
            {(["monthly", "annual"] as const).map(cycle => {
              const isSelected = billingCycle === cycle;
              return (
                <TouchableOpacity
                  key={cycle}
                  onPress={() => setBillingCycle(cycle)}
                  style={{
                    paddingHorizontal: 22, paddingVertical: 8, borderRadius: 100,
                    backgroundColor: isSelected ? colors.gold : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? "#fff" : colors.mutedForeground }}>
                    {cycle === "monthly" ? t("subscription.cycle_monthly") : t("subscription.cycle_annual")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {billingCycle === "annual" && (
            <View style={{ marginLeft: 10, backgroundColor: "#d1fae5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#059669" }}>
                {t("subscription.annual_savings_badge")}
              </Text>
            </View>
          )}
        </View>

        {isIOS && billingCycle === "annual" ? (
          <View style={[styles.infoBox, { backgroundColor: `${colors.gold}0A`, borderColor: `${colors.gold}25`, marginBottom: 8 }]}>
            <Feather name="globe" size={13} color={colors.gold} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              {t("subscription.annual_ios_notice")}
            </Text>
          </View>
        ) : isIOS ? (
          <View style={[styles.infoBox, { backgroundColor: `${colors.gold}0A`, borderColor: `${colors.gold}25` }]}>
            <Feather name="globe" size={13} color={colors.gold} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              {t("subscription.ios_notice_body")}
            </Text>
          </View>
        ) : plansLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{t("subscription.loading_plans")}</Text>
          </View>
        ) : (
          paidPlans.map((plan, idx) => {
            const isActive       = plan.id === currentPlan;
            const isPopular      = idx === 0;
            const price          = formatPlanPrice(plan);
            const originalPrice  = formatOriginalPrice(plan);
            const discount       = calcDiscount(plan);
            const generalFeatures = plan.features.filter(f => !f.startsWith("mercado:"));

            // Annual pricing
            const annualDiscPct    = ANNUAL_DISCOUNT_PCT[plan.id] ?? 0;
            const isAnnual         = billingCycle === "annual" && annualDiscPct > 0;
            const annualMonthly    = plan.price_cents * (1 - annualDiscPct / 100);
            const annualTotal      = annualMonthly * 12;
            const annualMonthlyStr = `R$ ${(annualMonthly / 100).toFixed(2).replace(".", ",")}`;
            const annualTotalStr   = `R$ ${(annualTotal / 100).toFixed(2).replace(".", ",")}`;
            const displayPrice     = isAnnual ? { main: annualMonthlyStr, period: "/mês" } : price;
            const displayOrig      = isAnnual ? `R$ ${(plan.price_cents / 100).toFixed(2).replace(".", ",")}` : originalPrice;
            const displayDiscount  = isAnnual ? annualDiscPct : discount;

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
                    <Text style={styles.popularText}>{t("subscription.popular_badge")}</Text>
                  </View>
                )}
                {isActive && (
                  <View style={[styles.popularBadge, { backgroundColor: "#059669" }]}>
                    <Text style={styles.popularText}>{t("subscription.current_plan_badge")}</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: colors.navy }]}>{plan.name}</Text>
                    <Text style={[styles.planSub, { color: colors.mutedForeground }]}>{plan.subtitle}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {displayOrig && (
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, textDecorationLine: "line-through" }}>
                        {t("subscription.from_prefix")} {displayOrig}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.planPrice, { color: colors.gold }]}>{displayPrice.main}</Text>
                      {displayDiscount && (
                        <View style={{ backgroundColor: "#d1fae5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: "#065f46" }}>-{displayDiscount}%</Text>
                        </View>
                      )}
                    </View>
                    {displayPrice.period && (
                      <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>
                        {displayOrig ? `${t("subscription.by_prefix")} ${displayPrice.main}` : ""}{displayPrice.period}
                      </Text>
                    )}
                    {isAnnual && (
                      <Text style={{ fontSize: 11, color: colors.gold, opacity: 0.75, marginTop: 2, fontWeight: "600" }}>
                        Total anual: {annualTotalStr}
                      </Text>
                    )}
                  </View>
                </View>

                {plan.description && (
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19, fontStyle: "italic" }}>
                    {plan.description}
                  </Text>
                )}

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
                    <Text style={[styles.currentBtnText, { color: colors.gold }]}>{t("subscription.current_badge")}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.selectBtn, { backgroundColor: isPopular ? colors.gold : colors.navy }]}
                    onPress={() => openPlanPage(plan.id, isAnnual)}
                    disabled={openingBrowser}
                    activeOpacity={0.82}
                  >
                    {openingBrowser ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="external-link" size={14} color="#fff" />
                        <Text style={styles.selectBtnText}>
                          {isAnnual
                            ? t("subscription.subscribe_annual", { name: plan.name })
                            : t("subscription.subscribe_plan", { name: plan.name })}
                        </Text>
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
              {t("subscription.free_plan_hint", { name: freePlan.name, subtitle: freePlan.subtitle })}
            </Text>
          </View>
        )}

        {/* Info note — hidden on iOS (Stripe mention not allowed) */}
        {!isIOS && (
          <View style={[styles.infoBox, { backgroundColor: `${colors.gold}0A`, borderColor: `${colors.gold}25` }]}>
            <Feather name="lock" size={13} color={colors.gold} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              {t("subscription.info_text")}
            </Text>
          </View>
        )}
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
