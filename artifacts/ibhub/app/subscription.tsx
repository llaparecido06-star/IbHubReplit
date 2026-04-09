import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from "@/context/AuthContext";

interface Plan {
  id: string;
  name: string;
  price: string;
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
    price: "R$ 149/mês",
    features: ["Tudo do Básico", "Conexões ilimitadas", "Mercado", "Dados de mercado"],
    popular: true,
  },
  {
    id: "exclusive",
    name: "Exclusive",
    price: "R$ 299/mês",
    features: ["Tudo do Premium", "Inteligência de mercado", "Apresentações exclusivas", "Destaque no feed"],
  },
  {
    id: "business",
    name: "Business",
    price: "R$ 499/mês",
    features: ["Tudo do Exclusive", "Página empresarial", "Vagas de emprego", "Suporte prioritário"],
  },
];

export default function SubscriptionScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user, refreshProfile } = useAuth();

  const [activePlan, setActivePlan] = useState<string>(profile?.plan ?? "basico");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (profile?.plan) {
      setActivePlan(profile.plan);
    }
  }, [profile?.plan]);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const handleSelect = (plan: Plan) => {
    if (plan.id === activePlan) return;
    Alert.alert(
      "Trocar plano",
      `Deseja trocar para o plano ${plan.name} por ${plan.price}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            if (!user) return;
            setUpdating(true);
            try {
              const { error } = await supabase
                .from("profiles")
                .update({ plan: plan.id })
                .eq("id", user.id);

              if (error) {
                Alert.alert("Erro", "Não foi possível trocar o plano. Tente novamente.");
              } else {
                setActivePlan(plan.id);
                await refreshProfile();
                Alert.alert("Sucesso", `Plano alterado para ${plan.name} com sucesso!`);
              }
            } catch {
              Alert.alert("Erro", "Não foi possível trocar o plano. Tente novamente.");
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
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

      {updating && (
        <View style={[styles.loadingOverlay, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
          <View style={[styles.loadingBox, { backgroundColor: "#fff" }]}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.navy }]}>Atualizando plano…</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Feather name="award" size={36} color={colors.gold} />
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Escolha seu plano</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Desbloqueie todo o potencial do ibhub
          </Text>
        </View>

        {/* Plan cards */}
        {PLANS.map((plan) => {
          const isActive = plan.id === activePlan;
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
                <Text style={[styles.planPrice, { color: colors.gold }]}>{plan.price}</Text>
              </View>
              {isActive && !plan.popular && (
                <Text style={[styles.currentLabel, { color: colors.gold }]}>Plano atual</Text>
              )}
              <View style={styles.features}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Feather name="check" size={14} color={colors.gold} />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[
                  styles.selectBtn,
                  { backgroundColor: isActive ? colors.background : colors.gold },
                ]}
                onPress={() => handleSelect(plan)}
                disabled={isActive || updating}
              >
                <Text style={[styles.selectBtnText, { color: isActive ? colors.mutedForeground : "#fff" }]}>
                  {isActive ? "Plano atual" : "Selecionar"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
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
  heroSub:        { fontSize: 14 },
  planCard:       { borderRadius: 12, padding: 16, gap: 12, overflow: "visible" },
  popularBadge:   { alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: -4 },
  popularText:    { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  planHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName:       { fontSize: 18, fontWeight: "800" },
  planPrice:      { fontSize: 16, fontWeight: "700" },
  currentLabel:   { fontSize: 13, fontWeight: "600", marginTop: -6 },
  features:       { gap: 6 },
  featureRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText:    { fontSize: 14 },
  selectBtn:      { alignItems: "center", paddingVertical: 14, borderRadius: 10 },
  selectBtnText:  { fontSize: 15, fontWeight: "700" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 99 },
  loadingBox:     { borderRadius: 16, padding: 28, alignItems: "center", gap: 14, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  loadingText:    { fontSize: 15, fontWeight: "600" },
});
