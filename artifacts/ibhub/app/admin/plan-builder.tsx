import React from "react";
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
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { useState } from "react";

const ALL_FEATURES = [
  "Chat ilimitado",
  "Criar Grupos",
  "Ver Visitantes do Perfil",
  "Smart Match B2B",
  "Visão Geral de Mercado",
  "Relatórios Detalhados",
  "Exportar CSV",
  "Criar Página Empresa",
  "Publicar Vagas",
  "Marketplace B2B",
  "Impulsionar Posts",
  "Upload Certificados",
  "Masterclasses",
];

interface Plan {
  id: string;
  name: string;
  sub: string;
  price: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "gratuito",
    name: "Gratuito",
    sub: "Acesso básico à plataforma",
    price: "Grátis",
    features: ALL_FEATURES,
  },
  {
    id: "profissional",
    name: "Profissional",
    sub: "Acesso à inteligência de mercado",
    price: "R$ 99,90",
    features: [],
  },
  {
    id: "basico",
    name: "Básico",
    sub: "Recursos profissionais essenciais",
    price: "R$ 149,00",
    features: [
      "Chat ilimitado",
      "Criar Grupos",
      "Visão Geral de Mercado",
      "Relatórios Detalhados",
      "Criar Página Empresa",
      "Publicar Vagas",
      "Upload Certificados",
    ],
  },
  {
    id: "empresa",
    name: "Empresa",
    sub: "Painel de gestão e criação de oportunidades",
    price: "R$ 247,00",
    features: [],
  },
  {
    id: "executivo",
    name: "Executivo",
    sub: "Acesso completo a todas as funcionalidades",
    price: "R$ 499,00",
    features: ALL_FEATURES,
  },
];

export default function AdminPlanBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const handleEdit  = (plan: Plan) => Alert.alert("Editar plano", `Editar: ${plan.name}`);
  const handleDelete = (plan: Plan) => Alert.alert("Excluir plano", `Excluir: ${plan.name}?`, [
    { text: "Cancelar", style: "cancel" },
    { text: "Excluir", style: "destructive" },
  ]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Plan Builder</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.heroTitle, { color: colors.navy }]}>Plan Builder</Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              Gerencie planos de assinatura e permissões de acesso
            </Text>
          </View>
          <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.gold }]}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.newBtnText}>Novo Plano</Text>
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        {PLANS.map((plan) => (
          <View key={plan.id} style={[styles.planCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            {/* Top row */}
            <View style={styles.planTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planName, { color: colors.navy }]}>{plan.name}</Text>
                <Text style={[styles.planSub, { color: colors.mutedForeground }]}>{plan.sub}</Text>
              </View>
              <Text style={[styles.planPrice, { color: colors.navy }]}>{plan.price}</Text>
              <TouchableOpacity
                style={[styles.editBtn, { borderColor: colors.border }]}
                onPress={() => handleEdit(plan)}
              >
                <Feather name="edit-2" size={13} color={colors.foreground} />
                <Text style={[styles.editBtnText, { color: colors.foreground }]}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(plan)}>
                <Feather name="trash-2" size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>

            {/* Features */}
            {plan.features.length > 0 ? (
              <View style={styles.featureChips}>
                {plan.features.map((f) => (
                  <View key={f} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.chipText, { color: colors.foreground }]}>{f}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.noFeatures, { color: colors.mutedForeground }]}>Nenhum recurso ativo</Text>
            )}
          </View>
        ))}
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/plan-builder" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 18, fontWeight: "700" },
  heroRow:      { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroTitle:    { fontSize: 22, fontWeight: "800" },
  heroSub:      { fontSize: 13, lineHeight: 18 },
  newBtn:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  newBtnText:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  planCard:     { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  planTopRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  planName:     { fontSize: 16, fontWeight: "800" },
  planSub:      { fontSize: 12, marginTop: 2, lineHeight: 16 },
  planPrice:    { fontSize: 15, fontWeight: "700" },
  editBtn:      { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  editBtnText:  { fontSize: 13 },
  featureChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip:         { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  chipText:     { fontSize: 12 },
  noFeatures:   { fontSize: 13, fontStyle: "italic" },
});
