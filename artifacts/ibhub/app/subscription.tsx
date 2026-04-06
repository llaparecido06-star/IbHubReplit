import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Plan {
  id: string;
  name: string;
  price: string;
  features: string[];
  popular?: boolean;
  current?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "gratuito",
    name: "Gratuito",
    price: "GRÁTIS",
    features: ["Perfil básico", "Feed de publicações", "5 conexões/mês"],
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "R$ 100/mês",
    features: ["Acesso à inteligência de mercado"],
  },
  {
    id: "basico",
    name: "Básico",
    price: "R$ 149/mês",
    features: ["Tudo do Gratuito", "Conexões ilimitadas", "Marketplace", "Dados de mercado"],
    popular: true,
  },
  {
    id: "empresa",
    name: "Empresa",
    price: "R$ 247/mês",
    features: ["Painel de gestão e criação de oportunidades"],
  },
  {
    id: "executivo",
    name: "Executivo",
    price: "R$ 499/mês",
    features: ["Tudo do Básico", "Inteligência de mercado", "Vagas de emprego", "Suporte prioritário", "Página empresarial"],
    current: true,
  },
];

export default function SubscriptionScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activePlan, setActivePlan] = useState("executivo");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const handleSelect = (plan: Plan) => {
    if (plan.current || plan.id === activePlan) return;
    Alert.alert(
      "Trocar plano",
      `Deseja trocar para o plano ${plan.name} por ${plan.price}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: () => setActivePlan(plan.id) },
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
          const isActive  = plan.id === activePlan;
          const isCurrent = plan.current || isActive;
          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                {
                  backgroundColor: "#fff",
                  borderColor: isCurrent ? colors.gold : colors.border,
                  borderWidth: isCurrent ? 2 : 1,
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
              {isCurrent && !plan.popular && (
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
                  { backgroundColor: isCurrent ? colors.background : colors.gold },
                ]}
                onPress={() => handleSelect(plan)}
                disabled={isCurrent}
              >
                <Text style={[styles.selectBtnText, { color: isCurrent ? colors.mutedForeground : "#fff" }]}>
                  {isCurrent ? "Plano atual" : "Selecionar"}
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
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 20, fontWeight: "700" },
  hero:         { alignItems: "center", gap: 8, paddingVertical: 10 },
  heroTitle:    { fontSize: 22, fontWeight: "800" },
  heroSub:      { fontSize: 14 },
  planCard:     { borderRadius: 12, padding: 16, gap: 12, overflow: "visible" },
  popularBadge: { alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: -4 },
  popularText:  { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  planHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName:     { fontSize: 18, fontWeight: "800" },
  planPrice:    { fontSize: 16, fontWeight: "700" },
  currentLabel: { fontSize: 13, fontWeight: "600", marginTop: -6 },
  features:     { gap: 6 },
  featureRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText:  { fontSize: 14 },
  selectBtn:    { alignItems: "center", paddingVertical: 14, borderRadius: 10 },
  selectBtnText:{ fontSize: 15, fontWeight: "700" },
});
