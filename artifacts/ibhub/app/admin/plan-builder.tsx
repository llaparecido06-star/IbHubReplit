import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import * as API from "@/services/api";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

const ALL_GENERAL_FEATURES = [
  "Chat ilimitado",
  "Criar Grupos",
  "Ver Visitantes do Perfil",
  "Smart Match B2B",
  "Relatórios Detalhados",
  "Exportar CSV",
  "Criar Página Empresa",
  "Publicar Vagas",
  "Marketplace B2B",
  "Impulsionar Posts",
  "Upload Certificados",
  "Masterclasses",
];

const DEFAULT_PLANS = [
  { id: "gratuito",     name: "Gratuito",     subtitle: "Acesso básico à plataforma",                  price_cents: 0,     features: [], is_active: true, sort_order: 0 },
  { id: "profissional", name: "Profissional", subtitle: "Acesso à inteligência de mercado",             price_cents: 9990,  features: [], is_active: true, sort_order: 1 },
  { id: "basico",       name: "Básico",       subtitle: "Recursos profissionais essenciais",            price_cents: 14900, features: [], is_active: true, sort_order: 2 },
  { id: "empresa",      name: "Empresa",      subtitle: "Painel de gestão e criação de oportunidades", price_cents: 24700, features: [], is_active: true, sort_order: 3 },
  { id: "executivo",    name: "Executivo",    subtitle: "Acesso completo a todas as funcionalidades",   price_cents: 49900, features: ALL_GENERAL_FEATURES, is_active: true, sort_order: 4 },
];

type DeliveryStrategy = "RANDOM_DAILY" | "SEQUENTIAL_MONTHLY" | "FULL_ACCESS" | "NONE";

const DELIVERY_STRATEGIES: { value: DeliveryStrategy; label: string; desc: string }[] = [
  { value: "NONE",               label: "Nenhuma",              desc: "Sem desbloqueio automático" },
  { value: "FULL_ACCESS",        label: "Acesso Total",         desc: "Todos os slides liberados imediatamente" },
  { value: "SEQUENTIAL_MONTHLY", label: "Sequencial Mensal",    desc: "Libera progressivamente ao longo de 30 dias" },
  { value: "RANDOM_DAILY",       label: "Aleatório Diário",     desc: "Libera 1 slide aleatório por dia" },
];

interface Plan {
  id: string;
  name: string;
  subtitle: string;
  price_cents: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  delivery_strategy?: DeliveryStrategy;
}

function centsToString(cents: number): string {
  if (cents === 0) return "Grátis";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function parsePriceString(s: string): number {
  if (!s || s.toLowerCase().includes("grát") || s === "0") return 0;
  const num = parseFloat(s.replace(/[R$\s.]/g, "").replace(",", "."));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function toSlug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

async function updatePlanStrategy(token: string, planId: string, strategy: DeliveryStrategy): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/update-plan-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan_id: planId, delivery_strategy: strategy }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

export default function AdminPlanBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const [editPlan, setEditPlan]             = useState<Plan | null>(null);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [showNewModal, setShowNewModal]     = useState(false);
  const [editName, setEditName]             = useState("");
  const [editSubtitle, setEditSubtitle]     = useState("");
  const [editPrice, setEditPrice]           = useState("");
  const [editFeatures, setEditFeatures]     = useState<string[]>([]);
  const [editDelivery, setEditDelivery]     = useState<DeliveryStrategy>("NONE");

  const [marketPerms, setMarketPerms]       = useState<API.MarketPermission[]>([]);
  const [loadingMp, setLoadingMp]           = useState(true);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let { data, error: err } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (err) throw err;
      if (!data || data.length === 0) {
        const { data: seeded, error: seedErr } = await supabase
          .from("plans")
          .insert(DEFAULT_PLANS)
          .select();
        if (seedErr) throw seedErr;
        data = seeded;
      }
      setPlans((data ?? []) as Plan[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMarketPerms = useCallback(async () => {
    setLoadingMp(true);
    const perms = await API.fetchMarketPermissions();
    setMarketPerms(perms);
    setLoadingMp(false);
  }, []);

  useEffect(() => {
    loadPlans();
    loadMarketPerms();
  }, [loadPlans, loadMarketPerms]);

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    setEditName(plan.name);
    setEditSubtitle(plan.subtitle);
    setEditPrice(plan.price_cents === 0 ? "0" : (plan.price_cents / 100).toFixed(2).replace(".", ","));
    setEditFeatures([...plan.features]);
    setEditDelivery((plan.delivery_strategy ?? "NONE") as DeliveryStrategy);
    setShowEditModal(true);
  };

  const openNew = () => {
    setEditPlan(null);
    setEditName("");
    setEditSubtitle("");
    setEditPrice("0");
    setEditFeatures([]);
    setEditDelivery("NONE");
    setShowNewModal(true);
  };

  const toggleFeature = (f: string) =>
    setEditFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const toggleMarketFeature = (mp: API.MarketPermission) =>
    toggleFeature(`mercado:${mp.id}`);

  const handleSaveEdit = async () => {
    if (!editPlan) return;
    setSaving(true);
    try {
      const price_cents = parsePriceString(editPrice);
      const { error: err } = await supabase
        .from("plans")
        .update({ name: editName, subtitle: editSubtitle, price_cents, features: editFeatures })
        .eq("id", editPlan.id);
      if (err) throw err;
      if (session?.access_token) {
        await updatePlanStrategy(session.access_token, editPlan.id, editDelivery);
      }
      Alert.alert("Sucesso", "Plano atualizado.");
      setShowEditModal(false);
      void loadPlans();
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao salvar plano.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!editName.trim()) { Alert.alert("Erro", "Informe o nome do plano."); return; }
    setSaving(true);
    try {
      const price_cents = parsePriceString(editPrice);
      const newId = toSlug(editName) || `plano_${Date.now()}`;
      const { error: err } = await supabase
        .from("plans")
        .insert({ id: newId, name: editName, subtitle: editSubtitle, price_cents, features: editFeatures, is_active: true, sort_order: plans.length });
      if (err) throw err;
      if (session?.access_token && editDelivery !== "NONE") {
        await updatePlanStrategy(session.access_token, newId, editDelivery);
      }
      Alert.alert("Sucesso", "Novo plano criado.");
      setShowNewModal(false);
      void loadPlans();
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao criar plano.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (plan: Plan) => {
    Alert.alert("Excluir plano", `Excluir o plano "${plan.name}"? Esta ação é irreversível.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive",
        onPress: async () => {
          const { error: err } = await supabase.from("plans").delete().eq("id", plan.id);
          if (err) Alert.alert("Erro", err.message);
          else loadPlans();
        },
      },
    ]);
  };

  const PlanModal = ({ visible, isNew }: { visible: boolean; isNew: boolean }) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.editModal, { backgroundColor: "#fff" }]}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => isNew ? setShowNewModal(false) : setShowEditModal(false)}
          >
            <Feather name="x" size={18} color="#6b7280" />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.navy }]}>
            {isNew ? "Novo Plano" : `Editar: ${editPlan?.name}`}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            <View style={{ gap: 14 }}>
              <View style={styles.mField}>
                <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>NOME</Text>
                <TextInput
                  style={[styles.mInput, { borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Ex: Premium"
                  placeholderTextColor={colors.mutedForeground}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>
              <View style={styles.mField}>
                <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>SUBTÍTULO</Text>
                <TextInput
                  style={[styles.mInput, { borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Ex: Recursos avançados"
                  placeholderTextColor={colors.mutedForeground}
                  value={editSubtitle}
                  onChangeText={setEditSubtitle}
                />
              </View>
              <View style={styles.mField}>
                <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>PREÇO (R$)</Text>
                <TextInput
                  style={[styles.mInput, { borderColor: colors.border, color: colors.foreground }]}
                  placeholder="0,00"
                  placeholderTextColor={colors.mutedForeground}
                  value={editPrice}
                  onChangeText={setEditPrice}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Delivery Strategy */}
              <View style={styles.mField}>
                <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>ESTRATÉGIA DE SLIDES</Text>
                <View style={{ gap: 6, marginTop: 4 }}>
                  {DELIVERY_STRATEGIES.map((ds) => {
                    const active = editDelivery === ds.value;
                    return (
                      <TouchableOpacity
                        key={ds.value}
                        style={[styles.featureToggle, { borderColor: active ? "#8b5cf6" : colors.border, backgroundColor: active ? "#8b5cf610" : "transparent" }]}
                        onPress={() => setEditDelivery(ds.value)}
                      >
                        <Feather name={active ? "check-circle" : "circle"} size={16} color={active ? "#8b5cf6" : colors.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.featureToggleText, { color: active ? colors.navy : colors.foreground, flex: undefined }]}>{ds.label}</Text>
                          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>{ds.desc}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* General features */}
              <View style={styles.mField}>
                <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>FUNCIONALIDADES GERAIS</Text>
                <View style={{ gap: 6, marginTop: 4 }}>
                  {ALL_GENERAL_FEATURES.map((f) => {
                    const active = editFeatures.includes(f);
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[styles.featureToggle, { borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.gold + "10" : "transparent" }]}
                        onPress={() => toggleFeature(f)}
                      >
                        <Feather name={active ? "check-square" : "square"} size={16} color={active ? colors.gold : colors.mutedForeground} />
                        <Text style={[styles.featureToggleText, { color: active ? colors.navy : colors.foreground }]}>{f}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Market permissions */}
              <View style={styles.mField}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Feather name="bar-chart-2" size={12} color={colors.gold} />
                  <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>DADOS DE MERCADO</Text>
                </View>
                {loadingMp ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : marketPerms.length === 0 ? (
                  <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                    Nenhuma permissão de mercado cadastrada ainda.
                  </Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {marketPerms.map((mp) => {
                      const key = `mercado:${mp.id}`;
                      const active = editFeatures.includes(key);
                      return (
                        <TouchableOpacity
                          key={mp.id}
                          style={[styles.featureToggle, { borderColor: active ? "#10b981" : colors.border, backgroundColor: active ? "#10b98110" : "transparent" }]}
                          onPress={() => toggleMarketFeature(mp)}
                        >
                          <Feather name={active ? "check-square" : "square"} size={16} color={active ? "#10b981" : colors.mutedForeground} />
                          <Feather name={mp.icon as any} size={14} color={active ? "#10b981" : colors.mutedForeground} />
                          <Text style={[styles.featureToggleText, { color: active ? colors.navy : colors.foreground }]}>{mp.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.mSaveBtn, { backgroundColor: saving ? colors.gold + "80" : colors.gold, marginTop: 14 }]}
            onPress={isNew ? handleCreateNew : handleSaveEdit}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.mSaveBtnText}>{isNew ? "Criar Plano" : "Salvar Alterações"}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Plan Builder</Text>
        <TouchableOpacity onPress={loadPlans}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.heroTitle, { color: colors.navy }]}>Plan Builder</Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              Planos de assinatura e permissões de acesso
            </Text>
          </View>
          <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.gold }]} onPress={openNew}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.newBtnText}>Novo Plano</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={[{ color: colors.mutedForeground, marginTop: 10, fontSize: 13 }]}>Carregando planos...</Text>
          </View>
        ) : error ? (
          <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
            <Feather name="alert-circle" size={32} color="#dc2626" />
            <Text style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.gold }]} onPress={loadPlans}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          plans.map((plan) => {
            const generalFeats = plan.features.filter(f => !f.startsWith("mercado:"));
            const marketFeats  = plan.features.filter(f => f.startsWith("mercado:"));
            return (
              <View key={plan.id} style={[styles.planCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <View style={styles.planTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: colors.navy }]}>{plan.name}</Text>
                    <Text style={[styles.planSub, { color: colors.mutedForeground }]}>{plan.subtitle}</Text>
                  </View>
                  <Text style={[styles.planPrice, { color: colors.navy }]}>{centsToString(plan.price_cents)}</Text>
                  <TouchableOpacity style={[styles.editBtn, { borderColor: colors.border }]} onPress={() => openEdit(plan)}>
                    <Feather name="edit-2" size={13} color={colors.foreground} />
                    <Text style={[styles.editBtnText, { color: colors.foreground }]}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(plan)}>
                    <Feather name="trash-2" size={18} color="#dc2626" />
                  </TouchableOpacity>
                </View>

                {generalFeats.length > 0 && (
                  <View style={styles.featureChips}>
                    {generalFeats.map((f) => (
                      <View key={f} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.chipText, { color: colors.foreground }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {marketFeats.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text style={[styles.chipSection, { color: colors.mutedForeground }]}>Dados de Mercado</Text>
                    <View style={styles.featureChips}>
                      {marketFeats.map((f) => {
                        const mp = marketPerms.find(p => `mercado:${p.id}` === f);
                        const label = mp?.title ?? f.replace("mercado:", "");
                        return (
                          <View key={f} style={[styles.chip, { backgroundColor: "#10b98110", borderColor: "#10b98140" }]}>
                            <Feather name={(mp?.icon ?? "bar-chart-2") as any} size={11} color="#10b981" />
                            <Text style={[styles.chipText, { color: "#065f46" }]}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {plan.features.length === 0 && (
                  <Text style={[styles.noFeatures, { color: colors.mutedForeground }]}>Nenhum recurso ativo</Text>
                )}
              </View>
            );
          })
        )}

      </ScrollView>

      <PlanModal visible={showEditModal} isNew={false} />
      <PlanModal visible={showNewModal} isNew={true} />

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/plan-builder" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  header:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:       { fontSize: 18, fontWeight: "700" },
  heroRow:           { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroTitle:         { fontSize: 22, fontWeight: "800" },
  heroSub:           { fontSize: 13, lineHeight: 18 },
  newBtn:            { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  newBtnText:        { color: "#fff", fontSize: 13, fontWeight: "700" },
  planCard:          { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  planTopRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  planName:          { fontSize: 16, fontWeight: "800" },
  planSub:           { fontSize: 12, marginTop: 2, lineHeight: 16 },
  planPrice:         { fontSize: 15, fontWeight: "700" },
  editBtn:           { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  editBtnText:       { fontSize: 13 },
  featureChips:      { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip:              { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  chipText:          { fontSize: 12 },
  chipSection:       { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  noFeatures:        { fontSize: 13, fontStyle: "italic" },
  retryBtn:          { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  overlay:           { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  editModal:         { width: "100%", maxWidth: 420, borderRadius: 16, padding: 20, gap: 10 },
  modalClose:        { position: "absolute", top: 14, right: 14, zIndex: 10 },
  modalTitle:        { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  mField:            { gap: 6 },
  mLabel:            { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  mInput:            { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  featureToggle:     { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  featureToggleText: { fontSize: 14, flex: 1 },
  mSaveBtn:          { paddingVertical: 15, borderRadius: 10, alignItems: "center" },
  mSaveBtnText:      { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptyHint:         { fontSize: 13, fontStyle: "italic" },
});
