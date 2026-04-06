import React, { useState } from "react";
import {
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
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path, Text as SvgText, Line } from "react-native-svg";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";

const PLANS = ["Selecionar plano", "Gratuito", "Profissional", "Básico", "Empresa", "Executivo"];
const DURATIONS = ["12 meses", "6 meses", "3 meses", "1 mês"];
const FILTER_PLANS = ["Todos", "Gratuito", "Profissional", "Básico", "Empresa", "Executivo"];

const KPIS = [
  { icon: "dollar-sign" as const, iconColor: "#059669", iconBg: "#d1fae5", trendIcon: "arrow-up-right" as const, trendColor: "#059669", label: "MRR (Receita Mensal)", value: "R$ 0,00" },
  { icon: "users"       as const, iconColor: "#3b82f6", iconBg: "#dbeafe", trendIcon: "arrow-up-right" as const, trendColor: "#059669", label: "Assinantes Ativos",   value: "1" },
  { icon: "gift"        as const, iconColor: "#c9a84c", iconBg: "#fef9ee", trendIcon: null,               trendColor: "",          label: "Cortesias Ativas",       value: "1" },
  { icon: "trending-down" as const, iconColor: "#dc2626", iconBg: "#fee2e2", trendIcon: "arrow-down-right" as const, trendColor: "#dc2626", label: "Cancelamentos",  value: "0" },
];

const SUBSCRIBERS = [
  { initial: "L", name: "Lucas Lima", email: "lucasla925@gmail.com", plan: "Executivo", status: "Cortesia" },
];

function PieChart() {
  const GOLD = "#c9a84c";
  const cx = 90; const cy = 80; const r = 60;
  return (
    <Svg width={200} height={160}>
      <Circle cx={cx} cy={cy} r={r} fill={GOLD} />
      <Line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="#fff" strokeWidth={2} />
      <SvgText x={10} y={cy + 4} fontSize={10} fill="#6b7280">Executivo: 1</SvgText>
    </Svg>
  );
}

export default function AdminFinanceiroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [search, setSearch]             = useState("");
  const [planFilter, setPlanFilter]     = useState("Todos");
  const [filterOpen, setFilterOpen]     = useState(false);

  // Modal state
  const [cortesiaEmail, setCortesiaEmail]   = useState("");
  const [cortesiaPlano, setCortesiaPlano]   = useState(PLANS[0]);
  const [cortesiaValidade, setCortesiaValidade] = useState(DURATIONS[0]);
  const [cortesiaMotivo, setCortesiaMotivo] = useState("");
  const [planoOpen, setPlanoOpen]           = useState(false);
  const [validadeOpen, setValidadeOpen]     = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Financeiro</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero + buttons */}
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
            <TouchableOpacity style={[styles.heroBtn, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Feather name="download" size={14} color={colors.foreground} />
              <Text style={[styles.heroBtnText, { color: colors.foreground }]}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI 2x2 */}
        <View style={styles.kpiGrid}>
          {KPIS.map((k) => (
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

        {/* Receita Mensal */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <Feather name="bar-chart-2" size={14} color={colors.gold} />
            <Text style={[styles.cardTitle, { color: colors.navy }]}>Receita Mensal</Text>
          </View>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sem dados de receita</Text>
        </View>

        {/* Distribuição por Plano */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <Feather name="credit-card" size={14} color={colors.gold} />
            <Text style={[styles.cardTitle, { color: colors.navy }]}>Distribuição por Plano</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <PieChart />
          </View>
        </View>

        {/* Subscriber table */}
        <View style={styles.tableSearchRow}>
          <View style={[styles.tableSearch, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[styles.tableSearchInput, { color: colors.foreground }]}
              placeholder="Buscar por"
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
            <Text style={[styles.tableHeadText, { color: colors.mutedForeground, width: 50 }]}>STATUS</Text>
          </View>
          {SUBSCRIBERS.map((s, i) => (
            <View key={i} style={[styles.tableRow, i < SUBSCRIBERS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={styles.subUser}>
                <View style={[styles.subAvatar, { backgroundColor: colors.navy }]}>
                  <Text style={[styles.subAvatarText, { color: colors.gold }]}>{s.initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subName, { color: colors.navy }]} numberOfLines={1}>{s.name}</Text>
                  <Text style={[styles.subEmail, { color: colors.mutedForeground }]} numberOfLines={1}>{s.email}</Text>
                </View>
              </View>
              <Text style={[styles.subPlan, { color: colors.foreground }]}>{s.plan}</Text>
              <View style={[styles.statusBadge, { backgroundColor: colors.gold + "18" }]}>
                <Text style={[styles.statusText, { color: colors.gold }]}>{s.status.slice(0, 2)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Cortesia Modal */}
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
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.mutedForeground }]}>PLANO</Text>
              <TouchableOpacity
                style={[styles.mSelect, { borderColor: colors.border }]}
                onPress={() => { setPlanoOpen(!planoOpen); setValidadeOpen(false); }}
              >
                <Text style={[styles.mSelectText, { color: cortesiaPlano === PLANS[0] ? colors.mutedForeground : colors.foreground }]}>
                  {cortesiaPlano}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              {planoOpen && (
                <View style={[styles.mDropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {PLANS.map((p) => (
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

            <TouchableOpacity style={[styles.mSaveBtn, { backgroundColor: colors.gold }]} onPress={() => setShowModal(false)}>
              <Text style={styles.mSaveBtnText}>Conceder Acesso</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/financeiro" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:    { fontSize: 18, fontWeight: "700" },
  heroRow:        { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  heroTitle:      { fontSize: 22, fontWeight: "800" },
  heroSub:        { fontSize: 13, lineHeight: 18 },
  heroBtns:       { gap: 6 },
  heroBtn:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  heroBtnText:    { fontSize: 13, fontWeight: "600" },
  kpiGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard:        { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  kpiTopRow:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  kpiIconBox:     { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiValue:       { fontSize: 20, fontWeight: "800" },
  kpiLabel:       { fontSize: 11, lineHeight: 15 },
  card:           { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  cardHead:       { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle:      { fontSize: 14, fontWeight: "700" },
  emptyText:      { textAlign: "center", fontSize: 13 },
  tableSearchRow: { flexDirection: "row", gap: 8 },
  tableSearch:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  tableSearchInput:{ flex: 1, fontSize: 14 },
  filterBtn:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  filterText:     { fontSize: 13 },
  dropdown:       { position: "absolute", top: 48, right: 0, width: 150, borderRadius: 10, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  dropItem:       { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  dropText:       { fontSize: 13 },
  table:          { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableHead:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tableHeadText:  { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  tableRow:       { flexDirection: "row", alignItems: "center", padding: 12 },
  subUser:        { flex: 2, flexDirection: "row", alignItems: "center", gap: 8 },
  subAvatar:      { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  subAvatarText:  { fontSize: 11, fontWeight: "700" },
  subName:        { fontSize: 13, fontWeight: "600" },
  subEmail:       { fontSize: 10 },
  subPlan:        { flex: 1, fontSize: 13 },
  statusBadge:    { width: 50, alignItems: "center", paddingVertical: 4, borderRadius: 8 },
  statusText:     { fontSize: 11, fontWeight: "700" },
  overlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal:          { width: "100%", maxWidth: 380, borderRadius: 16, padding: 20, gap: 14 },
  modalClose:     { position: "absolute", top: 14, right: 14 },
  modalTitle:     { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  mField:         { gap: 6 },
  mLabel:         { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  mInput:         { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  mSelect:        { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 },
  mSelectText:    { flex: 1, fontSize: 14 },
  mDropdown:      { position: "absolute", top: 50, left: 0, right: 0, borderRadius: 8, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  mDropItem:      { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  mDropText:      { fontSize: 14 },
  mSaveBtn:       { paddingVertical: 15, borderRadius: 10, alignItems: "center" },
  mSaveBtnText:   { color: "#fff", fontSize: 15, fontWeight: "700" },
});
