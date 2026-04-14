import React, { useState, useEffect, useCallback } from "react";
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
import { fetchUserByEmail } from "@/services/admin-api";

const PLAN_OPTIONS = ["Selecionar plano", "Gratuito", "Profissional", "Básico", "Empresa", "Executivo"];
const PLAN_ID_MAP: Record<string, string> = {
  "Gratuito": "gratuito",
  "Profissional": "profissional",
  "Básico": "basico",
  "Empresa": "empresa",
  "Executivo": "executivo",
};
const DURATIONS = ["12 meses", "6 meses", "3 meses", "1 mês"];
const DURATION_MONTHS: Record<string, number> = {
  "12 meses": 12,
  "6 meses": 6,
  "3 meses": 3,
  "1 mês": 1,
};

interface SubscriberRow {
  id: string;
  full_name: string | null;
  username: string | null;
  plan: string;
  courtesy_until: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
}

interface PlanRecord {
  id: string;
  name: string;
  price_cents: number;
}

interface KPIs {
  mrr: number;
  activeSubscribers: number;
  activeCourtesies: number;
  cancellations: number;
}

function formatMRR(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function AdminFinanceiroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [search, setSearch]           = useState("");
  const [planFilter, setPlanFilter]   = useState("Todos");
  const [filterOpen, setFilterOpen]   = useState(false);
  const [loading, setLoading]         = useState(true);
  const [kpis, setKpis]               = useState<KPIs>({ mrr: 0, activeSubscribers: 0, activeCourtesies: 0, cancellations: 0 });
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [plans, setPlans]             = useState<PlanRecord[]>([]);

  const [cortesiaEmail, setCortesiaEmail]       = useState("");
  const [cortesiaPlano, setCortesiaPlano]       = useState(PLAN_OPTIONS[0]);
  const [cortesiaValidade, setCortesiaValidade] = useState(DURATIONS[0]);
  const [cortesiaMotivo, setCortesiaMotivo]     = useState("");
  const [planoOpen, setPlanoOpen]               = useState(false);
  const [validadeOpen, setValidadeOpen]         = useState(false);
  const [saving, setSaving]                     = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, plansRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, plan, courtesy_until, stripe_subscription_status, stripe_current_period_end")
          .neq("plan", null),
        supabase
          .from("plans")
          .select("id, name, price_cents")
          .eq("is_active", true),
      ]);

      const profiles: SubscriberRow[] = (profilesRes.data ?? []) as SubscriberRow[];
      const planList: PlanRecord[] = plansRes.data ?? [];
      setPlans(planList);

      const planPriceMap = new Map(planList.map((p) => [p.id, p.price_cents]));
      const now = new Date();

      // Start of current calendar month (for cancellation counting)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const activeViaStripe  = profiles.filter((p) =>
        p.stripe_subscription_status === "active" || p.stripe_subscription_status === "trialing",
      );
      const activeCourtesies = profiles.filter((p) =>
        p.courtesy_until !== null && new Date(p.courtesy_until) > now,
      );

      // Canceled this month: stripe_current_period_end within the current calendar month
      const canceledThisMonth = profiles.filter((p) => {
        if (p.stripe_subscription_status !== "canceled") return false;
        if (!p.stripe_current_period_end) return false;
        const endDate = new Date(p.stripe_current_period_end);
        return endDate >= startOfMonth && endDate <= now;
      });

      // MRR: Stripe-active subscribers' plan price
      const mrr = activeViaStripe.reduce((sum, p) => sum + (planPriceMap.get(p.plan) ?? 0), 0);

      // Display list = Stripe subscribers + courtesy users (deduplicated)
      const displaySet = new Map<string, SubscriberRow>();
      [...activeViaStripe, ...activeCourtesies].forEach((p) => displaySet.set(p.id, p));
      const displaySubscribers = Array.from(displaySet.values());

      setKpis({
        mrr,
        activeSubscribers: activeViaStripe.length,
        activeCourtesies: activeCourtesies.length,
        cancellations: canceledThisMonth.length,
      });

      setSubscribers(displaySubscribers);
    } catch (e) {
      console.error("loadData financeiro:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const FILTER_PLANS = ["Todos", ...plans.map((p) => p.name)];

  const filteredSubscribers = subscribers.filter((s) => {
    const matchSearch =
      (s.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.username ?? "").toLowerCase().includes(search.toLowerCase());
    const matchPlan =
      planFilter === "Todos" ||
      plans.find((p) => p.name === planFilter)?.id === s.plan;
    return matchSearch && matchPlan;
  });

  const handleConcederCortesia = async () => {
    if (!cortesiaEmail.trim()) {
      Alert.alert("Erro", "Informe o email do usuário.");
      return;
    }
    if (cortesiaPlano === PLAN_OPTIONS[0]) {
      Alert.alert("Erro", "Selecione um plano.");
      return;
    }
    setSaving(true);
    try {
      const planId = PLAN_ID_MAP[cortesiaPlano];
      const months = DURATION_MONTHS[cortesiaValidade] ?? 1;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      let found: { id: string; full_name: string | null };
      try {
        const adminUser = await fetchUserByEmail(cortesiaEmail.trim());
        found = { id: adminUser.id, full_name: adminUser.full_name };
      } catch {
        Alert.alert("Usuário não encontrado", "Nenhum usuário encontrado com esse email.");
        setSaving(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ plan: planId, courtesy_until: expiresAt.toISOString() })
        .eq("id", found.id);

      if (updateErr) throw updateErr;

      Alert.alert("Sucesso", `Cortesia ${cortesiaPlano} concedida a ${found.full_name ?? found.id} por ${cortesiaValidade}.`);
      setShowModal(false);
      setCortesiaEmail("");
      setCortesiaPlano(PLAN_OPTIONS[0]);
      setCortesiaValidade(DURATIONS[0]);
      setCortesiaMotivo("");
      void loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao conceder cortesia.";
      Alert.alert("Erro", msg);
    } finally {
      setSaving(false);
    }
  };

  const kpiCards = [
    { icon: "dollar-sign" as const, iconColor: "#059669", iconBg: "#d1fae5", trendIcon: "arrow-up-right" as const, trendColor: "#059669", label: "MRR (Receita Mensal)", value: formatMRR(kpis.mrr) },
    { icon: "users" as const,       iconColor: "#3b82f6", iconBg: "#dbeafe", trendIcon: "arrow-up-right" as const, trendColor: "#059669", label: "Assinantes Stripe Ativos", value: String(kpis.activeSubscribers) },
    { icon: "gift" as const,        iconColor: "#c9a84c", iconBg: "#fef9ee", trendIcon: null,               trendColor: "",          label: "Cortesias Ativas",       value: String(kpis.activeCourtesies) },
    { icon: "trending-down" as const, iconColor: "#dc2626", iconBg: "#fee2e2", trendIcon: "arrow-down-right" as const, trendColor: "#dc2626", label: "Cancelamentos",  value: String(kpis.cancellations) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Financeiro</Text>
        <TouchableOpacity onPress={loadData}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.heroTitle, { color: colors.navy }]}>Financeiro</Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              Receita, assinaturas e{"\n"}gestão financeira
            </Text>
          </View>
          <View style={styles.heroBtns}>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: "#fff", borderColor: colors.border }]}
              onPress={() => setShowModal(true)}
            >
              <Feather name="gift" size={14} color={colors.foreground} />
              <Text style={[styles.heroBtnText, { color: colors.foreground }]}>Cortesia</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              {kpiCards.map((k) => (
                <View key={k.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  <View style={styles.kpiTopRow}>
                    <View style={[styles.kpiIconBox, { backgroundColor: k.iconBg }]}>
                      <Feather name={k.icon} size={18} color={k.iconColor} />
                    </View>
                    {k.trendIcon && <Feather name={k.trendIcon} size={14} color={k.trendColor} />}
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.navy }]}>{k.value}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{k.label}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <Feather name="bar-chart-2" size={14} color={colors.gold} />
                <Text style={[styles.cardTitle, { color: colors.navy }]}>Receita Mensal</Text>
              </View>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {kpis.mrr > 0 ? formatMRR(kpis.mrr) + " / mês (soma dos planos ativos)" : "Sem dados de receita"}
              </Text>
            </View>

            <View style={styles.tableSearchRow}>
              <View style={[styles.tableSearch, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.tableSearchInput, { color: colors.foreground }]}
                  placeholder="Buscar assinante"
                  placeholderTextColor={colors.mutedForeground}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <View>
                <TouchableOpacity
                  style={[styles.filterBtn, { backgroundColor: "#fff", borderColor: colors.border }]}
                  onPress={() => setFilterOpen(!filterOpen)}
                >
                  <Text style={[styles.filterText, { color: colors.foreground }]}>{planFilter}</Text>
                  <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
                {filterOpen && (
                  <View style={[styles.dropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    {FILTER_PLANS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.dropItem, { borderBottomColor: colors.border }, p === planFilter && { backgroundColor: colors.gold + "12" }]}
                        onPress={() => { setPlanFilter(p); setFilterOpen(false); }}
                      >
                        <Text style={[styles.dropText, { color: p === planFilter ? colors.gold : colors.foreground }]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.table, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tableHeadText, { color: colors.mutedForeground, flex: 2 }]}>USUÁRIO</Text>
                <Text style={[styles.tableHeadText, { color: colors.mutedForeground, flex: 1 }]}>PLANO</Text>
                <Text style={[styles.tableHeadText, { color: colors.mutedForeground, width: 60 }]}>STATUS</Text>
              </View>
              {filteredSubscribers.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Nenhum assinante encontrado.</Text>
                </View>
              ) : (
                filteredSubscribers.map((s, i) => {
                  const isCourtesy = s.courtesy_until && new Date(s.courtesy_until) > new Date();
                  const initial = (s.full_name ?? s.username ?? "?").charAt(0).toUpperCase();
                  const displayName = s.full_name ?? s.username ?? "—";
                  const planDisplay = plans.find((p) => p.id === s.plan)?.name ?? s.plan;
                  return (
                    <View key={s.id} style={[styles.tableRow, i < filteredSubscribers.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <View style={styles.subUser}>
                        <View style={[styles.subAvatar, { backgroundColor: colors.navy }]}>
                          <Text style={[styles.subAvatarText, { color: colors.gold }]}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.subName, { color: colors.navy }]} numberOfLines={1}>{displayName}</Text>
                          <Text style={[styles.subEmail, { color: colors.mutedForeground }]} numberOfLines={1}>@{s.username ?? "—"}</Text>
                        </View>
                      </View>
                      <Text style={[styles.subPlan, { color: colors.foreground }]}>{planDisplay}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: isCourtesy ? colors.gold + "18" : "#dbeafe" }]}>
                        <Text style={[styles.statusText, { color: isCourtesy ? colors.gold : "#3b82f6" }]}>
                          {isCourtesy ? "Co" : "At"}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowModal(false)}>
              <Feather name="x" size={18} color="#6b7280" />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.navy }]}>Conceder Acesso Cortesia</Text>

            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>EMAIL DO USUÁRIO</Text>
              <TextInput
                style={[styles.mInput, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="usuario@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={cortesiaEmail}
                onChangeText={setCortesiaEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>PLANO</Text>
              <TouchableOpacity
                style={[styles.mSelect, { borderColor: colors.border }]}
                onPress={() => { setPlanoOpen(!planoOpen); setValidadeOpen(false); }}
              >
                <Text style={[styles.mSelectText, { color: cortesiaPlano === PLAN_OPTIONS[0] ? colors.mutedForeground : colors.foreground }]}>
                  {cortesiaPlano}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              {planoOpen && (
                <View style={[styles.mDropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {PLAN_OPTIONS.map((p) => (
                    <TouchableOpacity key={p} style={[styles.mDropItem, { borderBottomColor: colors.border }]} onPress={() => { setCortesiaPlano(p); setPlanoOpen(false); }}>
                      <Text style={[styles.mDropText, { color: colors.foreground }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>VALIDADE</Text>
              <TouchableOpacity
                style={[styles.mSelect, { borderColor: colors.border }]}
                onPress={() => { setValidadeOpen(!validadeOpen); setPlanoOpen(false); }}
              >
                <Text style={[styles.mSelectText, { color: colors.foreground }]}>{cortesiaValidade}</Text>
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              {validadeOpen && (
                <View style={[styles.mDropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {DURATIONS.map((d) => (
                    <TouchableOpacity key={d} style={[styles.mDropItem, { borderBottomColor: colors.border }]} onPress={() => { setCortesiaValidade(d); setValidadeOpen(false); }}>
                      <Text style={[styles.mDropText, { color: colors.foreground }]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>MOTIVO</Text>
              <TextInput
                style={[styles.mInput, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Ex: Influenciador, Parceiro"
                placeholderTextColor={colors.mutedForeground}
                value={cortesiaMotivo}
                onChangeText={setCortesiaMotivo}
              />
            </View>

            <TouchableOpacity
              style={[styles.mSaveBtn, { backgroundColor: saving ? colors.gold + "80" : colors.gold }]}
              onPress={handleConcederCortesia}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mSaveBtnText}>Conceder Acesso</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/financeiro" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:     { fontSize: 18, fontWeight: "700" },
  heroRow:         { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  heroTitle:       { fontSize: 22, fontWeight: "800" },
  heroSub:         { fontSize: 13, lineHeight: 18 },
  heroBtns:        { gap: 6 },
  heroBtn:         { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  heroBtnText:     { fontSize: 13, fontWeight: "600" },
  kpiGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard:         { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  kpiTopRow:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  kpiIconBox:      { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiValue:        { fontSize: 20, fontWeight: "800" },
  kpiLabel:        { fontSize: 11, lineHeight: 15 },
  card:            { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  cardHead:        { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle:       { fontSize: 14, fontWeight: "700" },
  emptyText:       { textAlign: "center", fontSize: 13 },
  tableSearchRow:  { flexDirection: "row", gap: 8 },
  tableSearch:     { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  tableSearchInput:{ flex: 1, fontSize: 14 },
  filterBtn:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  filterText:      { fontSize: 13 },
  dropdown:        { position: "absolute", top: 48, right: 0, width: 150, borderRadius: 10, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  dropItem:        { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  dropText:        { fontSize: 13 },
  table:           { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableHead:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tableHeadText:   { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  tableRow:        { flexDirection: "row", alignItems: "center", padding: 12 },
  subUser:         { flex: 2, flexDirection: "row", alignItems: "center", gap: 8 },
  subAvatar:       { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  subAvatarText:   { fontSize: 11, fontWeight: "700" },
  subName:         { fontSize: 13, fontWeight: "600" },
  subEmail:        { fontSize: 10 },
  subPlan:         { flex: 1, fontSize: 13 },
  statusBadge:     { width: 50, alignItems: "center", paddingVertical: 4, borderRadius: 8 },
  statusText:      { fontSize: 11, fontWeight: "700" },
  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal:           { width: "100%", maxWidth: 380, borderRadius: 16, padding: 20, gap: 14 },
  modalClose:      { position: "absolute", top: 14, right: 14 },
  modalTitle:      { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  mField:          { gap: 6 },
  mLabel:          { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  mInput:          { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  mSelect:         { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 },
  mSelectText:     { flex: 1, fontSize: 14 },
  mDropdown:       { position: "absolute", top: 50, left: 0, right: 0, borderRadius: 8, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  mDropItem:       { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  mDropText:       { fontSize: 14 },
  mSaveBtn:        { paddingVertical: 15, borderRadius: 10, alignItems: "center" },
  mSaveBtnText:    { color: "#fff", fontSize: 15, fontWeight: "700" },
});
