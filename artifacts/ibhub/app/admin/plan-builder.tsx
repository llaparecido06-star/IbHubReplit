import React, { useState, useEffect, useCallback, memo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
import * as API from "@/services/api";

// Only features that are actively gated in the app code.
// Add here when a new feature gate is implemented.
const ALL_GENERAL_FEATURES = [
  "Criar Grupos",
  "Relatórios Detalhados",
  "Criar Página Empresa",
  "Publicar Vagas",
  "Upload Certificados",
];

const DEFAULT_PLANS = [
  { id: "gratuito",     name: "Gratuito",     subtitle: "Acesso básico à plataforma",                  price_cents: 0,     features: [], is_active: true, sort_order: 0, ai_search_credits: 0 },
  { id: "profissional", name: "Profissional", subtitle: "Para profissionais do vinho",                  price_cents: 14990, features: [], is_active: true, sort_order: 1, ai_search_credits: 3 },
  { id: "empresas",     name: "Empresas",     subtitle: "Para negócios, distribuidoras e importadoras", price_cents: 29990, features: [], is_active: true, sort_order: 2, ai_search_credits: 10 },
  { id: "premium",      name: "Premium",      subtitle: "Acesso completo à plataforma ibhub",           price_cents: 49990, features: ALL_GENERAL_FEATURES, is_active: true, sort_order: 3, ai_search_credits: 25 },
];

type DeliveryStrategy = "RANDOM_DAILY" | "SEQUENTIAL_MONTHLY" | "FULL_ACCESS" | "NONE";

const DELIVERY_STRATEGIES: { value: DeliveryStrategy; label: string; desc: string }[] = [
  { value: "NONE",               label: "Nenhuma",           desc: "Sem desbloqueio automático" },
  { value: "FULL_ACCESS",        label: "Acesso Total",      desc: "Todos os slides liberados imediatamente" },
  { value: "SEQUENTIAL_MONTHLY", label: "Sequencial Mensal", desc: "Divide os slides por 30 dias e libera em sequência diariamente" },
  { value: "RANDOM_DAILY",       label: "Aleatório Diário",  desc: "Libera 1 slide aleatório por dia" },
];

interface Plan {
  id: string;
  name: string;
  subtitle: string;
  description?: string | null;
  price_cents: number;
  original_price_cents?: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
  delivery_strategy?: DeliveryStrategy;
  stripe_price_id?: string | null;
  ai_search_credits?: number | null;
}

interface ModalState {
  name: string;
  subtitle: string;
  description: string;
  price: string;
  originalPrice: string;
  features: string[];
  delivery: DeliveryStrategy;
  stripeId: string;
  aiCredits: string;
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

// ─── Plan Modal ────────────────────────────────────────────────────────────────
interface PlanModalProps {
  visible: boolean;
  isNew: boolean;
  editPlan: Plan | null;
  state: ModalState;
  saving: boolean;
  marketPerms: API.MarketPermission[];
  loadingMp: boolean;
  onChange: (field: keyof ModalState, value: any) => void;
  onToggleFeature: (f: string) => void;
  onToggleMarket: (mp: API.MarketPermission) => void;
  onSave: () => void;
  onClose: () => void;
}

const PlanModal = memo(({
  visible, isNew, editPlan, state, saving,
  marketPerms, loadingMp,
  onChange, onToggleFeature, onToggleMarket,
  onSave, onClose,
}: PlanModalProps) => {
  const colors = useColors();

  const orig = parsePriceString(state.originalPrice);
  const curr = parsePriceString(state.price);
  const discountPct = orig > 0 && curr > 0 && orig > curr ? Math.round(((orig - curr) / orig) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.modalSheet, { backgroundColor: "#fff" }]}>
          {/* Header — fixed outside scroll */}
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: colors.navy }]}>
                {isNew ? "Novo Plano" : `Editar: ${editPlan?.name}`}
              </Text>
              {!isNew && editPlan && (
                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
                  ID: {editPlan.id}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Feather name="x" size={20} color={colors.navy} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: 32 }}>

            {/* ── Identidade ── */}
            <Section label="Identidade">
              <Field label="NOME DO PLANO">
                <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Ex: Premium" placeholderTextColor={colors.mutedForeground}
                  value={state.name} onChangeText={v => onChange("name", v)} />
              </Field>
              <Field label="SUBTÍTULO">
                <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Ex: Para profissionais do vinho" placeholderTextColor={colors.mutedForeground}
                  value={state.subtitle} onChangeText={v => onChange("subtitle", v)} />
              </Field>
              <Field label="DESCRIÇÃO (marketing)" hint="Aparece nas telas de assinatura. Deixe em branco para não exibir.">
                <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground, minHeight: 72, textAlignVertical: "top", paddingTop: 10 }]}
                  placeholder="Ex: Ideal para sommeliers que precisam de visibilidade e dados estratégicos." placeholderTextColor={colors.mutedForeground}
                  value={state.description} onChangeText={v => onChange("description", v)} multiline numberOfLines={3} />
              </Field>
            </Section>

            {/* ── Preço ── */}
            <Section label="Precificação">
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label='PREÇO "DE:" (R$)'>
                    <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
                      placeholder="Deixe vazio para não mostrar desconto" placeholderTextColor={colors.mutedForeground}
                      value={state.originalPrice} onChangeText={v => onChange("originalPrice", v)} keyboardType="decimal-pad" />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label='PREÇO "POR:" (R$)'>
                    <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
                      placeholder="0,00" placeholderTextColor={colors.mutedForeground}
                      value={state.price} onChangeText={v => onChange("price", v)} keyboardType="decimal-pad" />
                  </Field>
                </View>
              </View>
              {discountPct > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f0fdf4", borderRadius: 8, padding: 8 }}>
                  <Feather name="tag" size={13} color="#059669" />
                  <Text style={{ fontSize: 12, color: "#059669", fontWeight: "700" }}>
                    De {centsToString(orig)} por {centsToString(curr)} · -{discountPct}% de desconto
                  </Text>
                </View>
              )}
              <Field label="STRIPE PRICE ID" hint="Deixe em branco para planos gratuitos. Encontre em Stripe → Products → Price ID.">
                <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}
                  placeholder="price_1AbCdEfGhIjKlMnOpQrStUv" placeholderTextColor={colors.mutedForeground}
                  value={state.stripeId} onChangeText={v => onChange("stripeId", v)} autoCapitalize="none" autoCorrect={false} />
              </Field>
            </Section>

            {/* ── Ideal.BI ── */}
            <Section label="Ideal.BI — Busca com IA">
              <Field label="CONSULTAS IA / MÊS" hint="0 = sem acesso à Busca com IA. Renovado todo dia 1º do mês.">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[s.input, { borderColor: colors.border, flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }]}>
                    <Feather name="zap" size={14} color={colors.gold} style={{ marginRight: 6 }} />
                    <TextInput style={{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: Platform.OS === "ios" ? 12 : 10 }}
                      placeholder="0" placeholderTextColor={colors.mutedForeground}
                      value={state.aiCredits} onChangeText={v => onChange("aiCredits", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>consultas</Text>
                  </View>
                </View>
              </Field>
            </Section>

            {/* ── Slides ── */}
            <Section label="Estratégia de Slides">
              <View style={{ gap: 6 }}>
                {DELIVERY_STRATEGIES.map((ds) => {
                  const active = state.delivery === ds.value;
                  return (
                    <TouchableOpacity
                      key={ds.value}
                      style={[s.toggleRow, { borderColor: active ? "#8b5cf6" : colors.border, backgroundColor: active ? "#8b5cf608" : "transparent" }]}
                      onPress={() => onChange("delivery", ds.value)}
                    >
                      <Feather name={active ? "check-circle" : "circle"} size={16} color={active ? "#8b5cf6" : colors.mutedForeground} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: active ? colors.navy : colors.foreground }}>{ds.label}</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>{ds.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {/* ── Funcionalidades ── */}
            <Section label="Funcionalidades Gerais">
              <View style={{ gap: 6 }}>
                {ALL_GENERAL_FEATURES.map((f) => {
                  const active = state.features.includes(f);
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[s.toggleRow, { borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.gold + "0d" : "transparent" }]}
                      onPress={() => onToggleFeature(f)}
                    >
                      <Feather name={active ? "check-square" : "square"} size={16} color={active ? colors.gold : colors.mutedForeground} />
                      <Text style={{ fontSize: 13, color: active ? colors.navy : colors.foreground, flex: 1 }}>{f}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {/* ── Dados de Mercado ── */}
            <Section label="Dados de Mercado (Ideal.BI Feed)">
              {loadingMp ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : marketPerms.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Nenhuma permissão de mercado cadastrada ainda.</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  {marketPerms.map((mp) => {
                    const key = `mercado:${mp.id}`;
                    const active = state.features.includes(key);
                    return (
                      <TouchableOpacity
                        key={mp.id}
                        style={[s.toggleRow, { borderColor: active ? "#10b981" : colors.border, backgroundColor: active ? "#10b98108" : "transparent" }]}
                        onPress={() => onToggleMarket(mp)}
                      >
                        <Feather name={active ? "check-square" : "square"} size={16} color={active ? "#10b981" : colors.mutedForeground} />
                        <Feather name={mp.icon as any} size={14} color={active ? "#10b981" : colors.mutedForeground} />
                        <Text style={{ fontSize: 13, color: active ? colors.navy : colors.foreground, flex: 1 }}>{mp.title}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Section>

            {/* Save button — inside scroll so it's always reachable */}
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: saving ? colors.gold + "90" : colors.gold }]}
              onPress={onSave} disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <><Feather name="check" size={16} color="#fff" /><Text style={s.saveBtnText}>{isNew ? "Criar Plano" : "Salvar Alterações"}</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: "800", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.9 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.5 }}>{label}</Text>
      {children}
      {hint && <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{hint}</Text>}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminPlanBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const [editPlan,      setEditPlan]      = useState<Plan | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewModal,  setShowNewModal]  = useState(false);

  const emptyModal = (): ModalState => ({
    name: "", subtitle: "", description: "", price: "0",
    originalPrice: "", features: [], delivery: "NONE", stripeId: "", aiCredits: "0",
  });

  const [modalState, setModalState] = useState<ModalState>(emptyModal());

  const [marketPerms, setMarketPerms] = useState<API.MarketPermission[]>([]);
  const [loadingMp,   setLoadingMp]   = useState(true);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const loadPlans = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let { data, error: err } = await supabase.from("plans").select("*").order("sort_order", { ascending: true });
      if (err) throw err;
      if (!data || data.length === 0) {
        const { data: seeded, error: seedErr } = await supabase.from("plans").insert(DEFAULT_PLANS).select();
        if (seedErr) throw seedErr;
        data = seeded;
      }
      setPlans((data ?? []) as Plan[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar planos");
    } finally { setLoading(false); }
  }, []);

  const loadMarketPerms = useCallback(async () => {
    setLoadingMp(true);
    const perms = await API.fetchMarketPermissions();
    setMarketPerms(perms);
    setLoadingMp(false);
  }, []);

  useEffect(() => { loadPlans(); loadMarketPerms(); }, [loadPlans, loadMarketPerms]);

  // Realtime: refresh market permissions whenever a category is added/updated/deleted
  useEffect(() => {
    const channel = supabase
      .channel("plan-builder-market-perms")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "market_permissions" }, () => {
        loadMarketPerms();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMarketPerms]);

  const planToModal = (plan: Plan): ModalState => ({
    name:          plan.name,
    subtitle:      plan.subtitle,
    description:   plan.description ?? "",
    price:         plan.price_cents === 0 ? "0" : (plan.price_cents / 100).toFixed(2).replace(".", ","),
    originalPrice: plan.original_price_cents ? (plan.original_price_cents / 100).toFixed(2).replace(".", ",") : "",
    features:      [...plan.features],
    delivery:      (plan.delivery_strategy ?? "NONE") as DeliveryStrategy,
    stripeId:      plan.stripe_price_id ?? "",
    aiCredits:     String(plan.ai_search_credits ?? 0),
  });

  const openEdit = (plan: Plan) => { setEditPlan(plan); setModalState(planToModal(plan)); setShowEditModal(true); };
  const openNew  = () => { setEditPlan(null); setModalState(emptyModal()); setShowNewModal(true); };

  const handleChange = (field: keyof ModalState, value: any) =>
    setModalState(prev => ({ ...prev, [field]: value }));

  const handleToggleFeature = (f: string) =>
    setModalState(prev => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter(x => x !== f) : [...prev.features, f],
    }));

  const handleToggleMarket = (mp: API.MarketPermission) =>
    handleToggleFeature(`mercado:${mp.id}`);

  const buildPayload = () => ({
    name:                  modalState.name,
    subtitle:              modalState.subtitle,
    description:           modalState.description.trim() || null,
    price_cents:           parsePriceString(modalState.price),
    original_price_cents:  parsePriceString(modalState.originalPrice) || null,
    features:              modalState.features,
    delivery_strategy:     modalState.delivery,
    stripe_price_id:       modalState.stripeId.trim() || null,
    ai_search_credits:     Math.max(0, parseInt(modalState.aiCredits, 10) || 0),
  });

  const handleSaveEdit = async () => {
    if (!editPlan) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.from("plans").update(buildPayload()).eq("id", editPlan.id);
      if (err) throw err;
      Alert.alert("Sucesso", "Plano atualizado.");
      setShowEditModal(false);
      void loadPlans();
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao salvar plano.");
    } finally { setSaving(false); }
  };

  const handleCreateNew = async () => {
    if (!modalState.name.trim()) { Alert.alert("Erro", "Informe o nome do plano."); return; }
    setSaving(true);
    try {
      const newId = toSlug(modalState.name) || `plano_${Date.now()}`;
      const { error: err } = await supabase.from("plans").insert({ id: newId, is_active: true, sort_order: plans.length, ...buildPayload() });
      if (err) throw err;
      Alert.alert("Sucesso", "Novo plano criado.");
      setShowNewModal(false);
      void loadPlans();
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Erro ao criar plano.");
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (plan: Plan) => {
    const { error: err } = await supabase.from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    if (err) Alert.alert("Erro", err.message);
    else setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: !p.is_active } : p));
  };

  const handleDelete = (plan: Plan) => {
    Alert.alert("Excluir plano", `Excluir o plano "${plan.name}"? Esta ação é irreversível.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        const { error: err } = await supabase.from("plans").delete().eq("id", plan.id);
        if (err) Alert.alert("Erro", err.message);
        else loadPlans();
      }},
    ]);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.navy }]}>Plan Builder</Text>
        <TouchableOpacity onPress={loadPlans}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero row */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: colors.navy }}>Plan Builder</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Planos de assinatura e permissões de acesso</Text>
          </View>
          <TouchableOpacity style={[s.newBtn, { backgroundColor: colors.gold }]} onPress={openNew}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={s.newBtnText}>Novo Plano</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={{ color: colors.mutedForeground, marginTop: 10, fontSize: 13 }}>Carregando planos...</Text>
          </View>
        ) : error ? (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
            <Feather name="alert-circle" size={32} color="#dc2626" />
            <Text style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>{error}</Text>
            <TouchableOpacity style={{ backgroundColor: colors.gold, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }} onPress={loadPlans}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          plans.map((plan) => {
            const generalFeats = plan.features.filter(f => !f.startsWith("mercado:"));
            const marketFeats  = plan.features.filter(f => f.startsWith("mercado:"));
            const aiCredits    = plan.ai_search_credits ?? 0;

            return (
              <View key={plan.id} style={[s.planCard, { backgroundColor: "#fff", borderColor: colors.border, opacity: plan.is_active ? 1 : 0.6 }]}>
                {/* Top row */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: colors.navy }}>{plan.name}</Text>
                      <View style={{ backgroundColor: plan.is_active ? "#dcfce7" : "#f3f4f6", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: plan.is_active ? "#16a34a" : "#6b7280" }}>
                          {plan.is_active ? "Ativo" : "Inativo"}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>{plan.subtitle}</Text>
                    <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 1, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
                      id: {plan.id}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    {plan.original_price_cents && plan.original_price_cents > plan.price_cents && (
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, textDecorationLine: "line-through" }}>
                        {centsToString(plan.original_price_cents)}
                      </Text>
                    )}
                    <Text style={{ fontSize: 17, fontWeight: "900", color: colors.navy }}>{centsToString(plan.price_cents)}</Text>
                    {plan.original_price_cents && plan.original_price_cents > plan.price_cents && (
                      <Text style={{ fontSize: 10, color: "#059669", fontWeight: "700" }}>
                        -{Math.round(((plan.original_price_cents - plan.price_cents) / plan.original_price_cents) * 100)}% OFF
                      </Text>
                    )}
                  </View>
                </View>

                {/* Badges row */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {/* AI Credits */}
                  <View style={[s.badge, { backgroundColor: aiCredits > 0 ? colors.gold + "15" : "#f3f4f6", borderColor: aiCredits > 0 ? colors.gold + "50" : "#e5e7eb" }]}>
                    <Feather name="zap" size={11} color={aiCredits > 0 ? colors.gold : "#9ca3af"} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: aiCredits > 0 ? colors.gold : "#9ca3af" }}>
                      {aiCredits > 0 ? `${aiCredits} consultas IA/mês` : "Sem busca IA"}
                    </Text>
                  </View>
                  {/* Delivery */}
                  {plan.delivery_strategy && plan.delivery_strategy !== "NONE" && (
                    <View style={[s.badge, { backgroundColor: "#ede9fe", borderColor: "#ddd6fe" }]}>
                      <Feather name="layers" size={11} color="#7c3aed" />
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "#7c3aed" }}>
                        {DELIVERY_STRATEGIES.find(d => d.value === plan.delivery_strategy)?.label ?? plan.delivery_strategy}
                      </Text>
                    </View>
                  )}
                  {/* Stripe */}
                  {plan.stripe_price_id && (
                    <View style={[s.badge, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                      <Feather name="credit-card" size={11} color="#059669" />
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "#059669" }}>Stripe</Text>
                    </View>
                  )}
                </View>

                {/* Features */}
                {generalFeats.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {generalFeats.map(f => (
                      <View key={f} style={[s.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={{ fontSize: 11, color: colors.foreground }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {marketFeats.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Dados de Mercado
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {marketFeats.map(f => {
                        const mp = marketPerms.find(p => `mercado:${p.id}` === f);
                        return (
                          <View key={f} style={[s.chip, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                            <Feather name={(mp?.icon ?? "bar-chart-2") as any} size={10} color="#10b981" />
                            <Text style={{ fontSize: 11, color: "#065f46" }}>{mp?.title ?? f.replace("mercado:", "")}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Action row */}
                <View style={[s.actionRow, { borderTopColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Switch
                      value={plan.is_active}
                      onValueChange={() => handleToggleActive(plan)}
                      trackColor={{ false: "#e5e7eb", true: colors.gold + "80" }}
                      thumbColor={plan.is_active ? colors.gold : "#9ca3af"}
                    />
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                      {plan.is_active ? "Visível" : "Oculto"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity style={[s.actionBtn, { borderColor: colors.border }]} onPress={() => openEdit(plan)}>
                      <Feather name="edit-2" size={13} color={colors.foreground} />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { borderColor: "#fca5a5" }]} onPress={() => handleDelete(plan)}>
                      <Feather name="trash-2" size={13} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <PlanModal
        visible={showEditModal}
        isNew={false}
        editPlan={editPlan}
        state={modalState}
        saving={saving}
        marketPerms={marketPerms}
        loadingMp={loadingMp}
        onChange={handleChange}
        onToggleFeature={handleToggleFeature}
        onToggleMarket={handleToggleMarket}
        onSave={handleSaveEdit}
        onClose={() => setShowEditModal(false)}
      />
      <PlanModal
        visible={showNewModal}
        isNew={true}
        editPlan={null}
        state={modalState}
        saving={saving}
        marketPerms={marketPerms}
        loadingMp={loadingMp}
        onChange={handleChange}
        onToggleFeature={handleToggleFeature}
        onToggleMarket={handleToggleMarket}
        onSave={handleCreateNew}
        onClose={() => setShowNewModal(false)}
      />

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/plan-builder" />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  newBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  newBtnText:  { color: "#fff", fontSize: 13, fontWeight: "800" },

  planCard:   { borderRadius: 14, borderWidth: 1, padding: 14, gap: 0 },
  badge:      { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chip:       { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  actionRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  actionBtn:  { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },

  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet:  { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 0, maxHeight: "92%" },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  modalTitle:  { fontSize: 18, fontWeight: "900" },
  modalCloseBtn: { padding: 4, marginLeft: 8 },

  input:    { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 10, fontSize: 14 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 10 },

  saveBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 12, marginBottom: Platform.OS === "ios" ? 24 : 12 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
