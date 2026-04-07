import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import Svg, { Path, Polyline } from "react-native-svg";

type CompanyTab  = "publicacoes" | "portfolio" | "analytics";
type ProductCat  = "produto" | "vinho" | "acessorio" | "servico";
type SortKey     = "data" | "preco" | "categoria";

interface Product {
  id: string;
  name: string;
  desc?: string;
  price?: string;
  cat: ProductCat;
}

interface Post {
  id: string;
  content: string;
  date: string;
  likes: number;
  comments: number;
}

const PRODUCT_CATS: { key: ProductCat; label: string }[] = [
  { key: "produto",   label: "Produto" },
  { key: "vinho",     label: "Vinho" },
  { key: "acessorio", label: "Acessório" },
  { key: "servico",   label: "Serviço" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "data",      label: "Data" },
  { key: "preco",     label: "Preço" },
  { key: "categoria", label: "Categoria" },
];

const MOCK_POSTS: Post[] = [
  { id: "cp1", content: "Novidades da Ideal.BI: lançamos nossa nova plataforma de Business Intelligence para o setor vitivinícola. Acesse e confira as funcionalidades exclusivas para importadoras e distribuidoras.", date: "05/04/2026", likes: 0, comments: 0 },
];

const KPI_CARDS = [
  { icon: "file-text", label: "Publicações",  value: 1 },
  { icon: "heart",     label: "Curtidas",     value: 0 },
  { icon: "message-circle", label: "Comentários", value: 0 },
  { icon: "users",     label: "Seguidores",   value: 0 },
  { icon: "calendar",  label: "Eventos",      value: 0 },
  { icon: "eye",       label: "Alcance Est.", value: 0 },
];

const GROWTH_ROWS = [
  { label: "Publicações", current: 1, prev: 0 },
  { label: "Seguidores",  current: 0, prev: 0 },
  { label: "Curtidas",    current: 0, prev: 0 },
  { label: "Comentários", current: 0, prev: 0 },
];

const MINI_CHART_POINTS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function MiniLineChart() {
  const colors = useColors();
  const W = 220; const H = 40;
  const n = MINI_CHART_POINTS.length;
  const pts = MINI_CHART_POINTS.map((v, i) => `${(i / (n - 1)) * W},${H - v * H}`).join(" ");
  return (
    <Svg width={W} height={H}>
      <Polyline points={pts} fill="none" stroke={colors.gold} strokeWidth={2} />
    </Svg>
  );
}

export default function EmpresaScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<CompanyTab>("publicacoes");

  // Portfolio state
  const [products, setProducts]         = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [sortBy, setSortBy]             = useState<SortKey>("data");
  const [filterCat, setFilterCat]       = useState<ProductCat | "todos">("todos");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct]   = useState<Product | null>(null);

  // Product form state
  const [pName, setPName]   = useState("");
  const [pDesc, setPDesc]   = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCat, setPCat]     = useState<ProductCat>("produto");

  // FAB menu
  const [showFab, setShowFab] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const resetProductForm = () => { setPName(""); setPDesc(""); setPPrice(""); setPCat("produto"); setEditingProduct(null); };

  const handleSaveProduct = () => {
    if (!pName.trim()) { Alert.alert("Atenção", "Informe o nome do produto."); return; }
    if (editingProduct) {
      setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, name: pName, desc: pDesc, price: pPrice, cat: pCat } : p));
    } else {
      setProducts((prev) => [{ id: Date.now().toString(), name: pName.trim(), desc: pDesc || undefined, price: pPrice || undefined, cat: pCat }, ...prev]);
    }
    resetProductForm();
    setShowProductForm(false);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p); setPName(p.name); setPDesc(p.desc ?? ""); setPPrice(p.price ?? ""); setPCat(p.cat);
    setShowProductForm(true);
  };

  const filteredProducts = products.filter((p) => {
    if (filterCat !== "todos" && p.cat !== filterCat) return false;
    if (productSearch && !p.name.toLowerCase().includes(productSearch.toLowerCase())) return false;
    return true;
  });

  const catCounts: Record<string, number> = {};
  products.forEach((p) => { catCounts[p.cat] = (catCounts[p.cat] ?? 0) + 1; });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Feather name="home" size={18} color={colors.gold} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Ideal.BI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: colors.gold }]}
          onPress={() => setShowFab(true)}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Company card */}
        <View style={[styles.companyCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <View style={[styles.companyLogo, { backgroundColor: colors.navy }]}>
            <Text style={[styles.companyLogoText, { color: colors.gold }]}>I</Text>
          </View>
          <Text style={[styles.companyName, { color: colors.navy }]}>Ideal.BI</Text>
          <View style={[styles.catBadge, { backgroundColor: colors.gold + "18" }]}>
            <Text style={[styles.catBadgeText, { color: colors.gold }]}>Consultoria</Text>
          </View>
          <View style={styles.managedRow}>
            <View style={[styles.managerAvatar, { backgroundColor: colors.navy }]}>
              <Text style={[styles.managerInitial, { color: colors.gold }]}>M</Text>
            </View>
            <Text style={[styles.managedText, { color: colors.mutedForeground }]}>Gerenciado por Maria Santos</Text>
          </View>
          <View style={styles.modeRow}>
            <View style={[styles.modeBadge, { backgroundColor: colors.navy + "12" }]}>
              <Feather name="home" size={12} color={colors.navy} />
              <Text style={[styles.modeBadgeText, { color: colors.navy }]}>Modo empresa ativo</Text>
            </View>
            <TouchableOpacity
              style={[styles.manageBtn, { backgroundColor: colors.gold }]}
              onPress={() => router.push(`/manage-business-page?id=${id}` as any)}
            >
              <Feather name="home" size={13} color="#fff" />
              <Text style={styles.manageBtnText}>Gerenciar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          {([
            { key: "publicacoes", label: "PUBLICAÇÕES" },
            { key: "portfolio",   label: "PORTFÓLIO" },
            { key: "analytics",   label: "ANALYTICS" },
          ] as { key: CompanyTab; label: string }[]).map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, activeTab === t.key && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabLabel, { color: activeTab === t.key ? colors.gold : colors.mutedForeground }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Publicações ── */}
        {activeTab === "publicacoes" && (
          <View>
            {MOCK_POSTS.map((post) => (
              <View key={post.id} style={[styles.postCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
                <View style={styles.postHeader}>
                  <View style={[styles.postAvatar, { backgroundColor: colors.navy }]}>
                    <Text style={[styles.postAvatarText, { color: colors.gold }]}>I</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.postName, { color: colors.navy }]}>Ideal.BI</Text>
                    <Text style={[styles.postDate, { color: colors.mutedForeground }]}>{post.date}</Text>
                  </View>
                  <TouchableOpacity>
                    <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
                <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={styles.postActionBtn}>
                    <Feather name="heart" size={17} color={colors.mutedForeground} />
                    <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.likes}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postActionBtn}>
                    <Feather name="message-circle" size={17} color={colors.mutedForeground} />
                    <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.comments}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.postActionBtn, { marginLeft: "auto" as any }]}>
                    <Feather name="share-2" size={17} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Portfólio ── */}
        {activeTab === "portfolio" && (
          <View style={{ padding: 16, gap: 14 }}>
            <TouchableOpacity
              style={[styles.addProductBtn, { backgroundColor: colors.gold }]}
              onPress={() => { resetProductForm(); setShowProductForm(true); }}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.addProductBtnText}>Adicionar Produto</Text>
            </TouchableOpacity>

            <View style={[styles.searchBar, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Buscar produto..."
                placeholderTextColor={colors.mutedForeground}
                value={productSearch}
                onChangeText={setProductSearch}
              />
            </View>

            {/* Sort + filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SORT_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.chip, { backgroundColor: sortBy === s.key ? colors.gold : "#fff", borderColor: sortBy === s.key ? colors.gold : colors.border }]}
                  onPress={() => setSortBy(s.key)}
                >
                  <Text style={[styles.chipText, { color: sortBy === s.key ? "#fff" : colors.mutedForeground }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
              <View style={[styles.chipDivider, { backgroundColor: colors.border }]} />
              {([{ key: "todos" as const, label: "Todos" }, ...PRODUCT_CATS.filter((c) => catCounts[c.key])]).map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, { backgroundColor: filterCat === c.key ? colors.navy + "18" : "#fff", borderColor: colors.border }]}
                  onPress={() => setFilterCat(c.key as any)}
                >
                  <Text style={[styles.chipText, { color: colors.navy }]}>
                    {c.label}{c.key !== "todos" && catCounts[c.key] ? ` (${catCounts[c.key]})` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredProducts.length === 0 ? (
              <View style={styles.portfolioEmpty}>
                <Feather name="package" size={32} color={colors.border} />
                <Text style={[styles.portfolioEmptyText, { color: colors.mutedForeground }]}>Nenhum produto cadastrado</Text>
              </View>
            ) : (
              filteredProducts.map((p) => (
                <View key={p.id} style={[styles.productCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  <View style={[styles.productImg, { backgroundColor: colors.background }]}>
                    <Feather name="package" size={28} color={colors.border} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.productName, { color: colors.navy }]} numberOfLines={2}>{p.name}</Text>
                    <View style={[styles.catBadgeSmall, { backgroundColor: colors.gold + "18" }]}>
                      <Text style={[styles.catBadgeSmallText, { color: colors.gold }]}>
                        {PRODUCT_CATS.find((c) => c.key === p.cat)?.label}
                      </Text>
                    </View>
                    {p.price && <Text style={[styles.productPrice, { color: colors.gold }]}>{p.price}</Text>}
                    <View style={styles.productActions}>
                      <TouchableOpacity style={styles.productActionBtn} onPress={() => openEditProduct(p)}>
                        <Feather name="edit-2" size={14} color={colors.navy} />
                        <Text style={[styles.productActionText, { color: colors.navy }]}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.productActionBtn} onPress={() => setProducts((prev) => prev.filter((x) => x.id !== p.id))}>
                        <Feather name="trash-2" size={14} color="#dc2626" />
                        <Text style={[styles.productActionText, { color: "#dc2626" }]}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Analytics ── */}
        {activeTab === "analytics" && (
          <View style={{ padding: 16, gap: 16 }}>
            {/* KPI grid */}
            <View style={styles.kpiGrid}>
              {KPI_CARDS.map((k) => (
                <View key={k.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  <View style={styles.kpiTop}>
                    <Feather name={k.icon as any} size={16} color={colors.mutedForeground} />
                    <View style={[styles.kpiBadge, { backgroundColor: colors.background }]}>
                      <Text style={[styles.kpiBadgeText, { color: colors.mutedForeground }]}>—0%</Text>
                    </View>
                  </View>
                  <Text style={[styles.kpiNum, { color: colors.navy }]}>{k.value}</Text>
                  <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{k.label}</Text>
                </View>
              ))}
            </View>

            {/* Weekly growth */}
            <View style={[styles.analyticsCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Text style={[styles.analyticsCardTitle, { color: colors.navy }]}>Crescimento Semanal</Text>
              {GROWTH_ROWS.map((row) => (
                <View key={row.label} style={[styles.growthRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.growthLabel, { color: colors.foreground }]}>{row.label}</Text>
                  <View style={styles.growthValues}>
                    <Text style={[styles.growthCurrent, { color: colors.navy }]}>{row.current}</Text>
                    <Text style={[styles.growthSep, { color: colors.mutedForeground }]}>vs</Text>
                    <Text style={[styles.growthPrev, { color: colors.mutedForeground }]}>{row.prev}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Engagement */}
            <View style={[styles.analyticsCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Text style={[styles.analyticsCardTitle, { color: colors.navy }]}>Taxa de Engajamento</Text>
              <Text style={[styles.engagementRate, { color: colors.gold }]}>0.0</Text>
              <Text style={[styles.engagementSub, { color: colors.mutedForeground }]}>interações/post</Text>
            </View>

            {/* Chart */}
            <View style={[styles.analyticsCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Text style={[styles.analyticsCardTitle, { color: colors.navy }]}>Engajamento (14 dias)</Text>
              <View style={{ paddingTop: 8 }}>
                <MiniLineChart />
              </View>
            </View>

            {/* Top posts */}
            <View style={[styles.analyticsCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Text style={[styles.analyticsCardTitle, { color: colors.navy }]}>Posts com Mais Engajamento</Text>
              <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>Nenhum dado disponível ainda.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Product Form Modal */}
      <Modal visible={showProductForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProductForm(false)}>
        <View style={[styles.formContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.formHeader, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.navy }]}>{editingProduct ? "Editar Produto" : "Adicionar Produto"}</Text>
            <TouchableOpacity onPress={() => setShowProductForm(false)}>
              <Feather name="x" size={22} color={colors.navy} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <TextInput
              style={[styles.formInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Nome do produto" placeholderTextColor={colors.mutedForeground} value={pName} onChangeText={setPName} />
            <TextInput
              style={[styles.formInput, styles.formTextarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Descrição" placeholderTextColor={colors.mutedForeground} value={pDesc} onChangeText={setPDesc} multiline textAlignVertical="top" />
            <TextInput
              style={[styles.formInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Preço (ex: R$ 150,00)" placeholderTextColor={colors.mutedForeground} value={pPrice} onChangeText={setPPrice} />
            <View style={styles.catChips}>
              {PRODUCT_CATS.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catChip, { backgroundColor: pCat === c.key ? colors.gold : "#fff", borderColor: pCat === c.key ? colors.gold : colors.border }]}
                  onPress={() => setPCat(c.key)}
                >
                  <Text style={[styles.catChipText, { color: pCat === c.key ? "#fff" : colors.foreground }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.photoBtn}>
              <Feather name="image" size={16} color={colors.mutedForeground} />
              <Text style={[styles.photoBtnText, { color: colors.mutedForeground }]}>Adicionar foto</Text>
            </TouchableOpacity>
            <View style={styles.formBtns}>
              <TouchableOpacity
                style={[styles.formSaveBtn, { backgroundColor: colors.gold }]}
                onPress={handleSaveProduct}
              >
                <Text style={styles.formSaveBtnText}>Salvar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowProductForm(false)}
              >
                <Text style={[styles.formCancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* FAB menu */}
      <Modal visible={showFab} transparent animationType="fade" onRequestClose={() => setShowFab(false)}>
        <Pressable style={styles.fabOverlay} onPress={() => setShowFab(false)}>
          <View style={[styles.fabMenu, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFab(false); }}>
              <Feather name="file-text" size={16} color={colors.navy} />
              <Text style={[styles.fabMenuText, { color: colors.navy }]}>Nova Publicação</Text>
            </TouchableOpacity>
            <View style={[styles.fabMenuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFab(false); }}>
              <Feather name="calendar" size={16} color={colors.navy} />
              <Text style={[styles.fabMenuText, { color: colors.navy }]}>Novo Evento</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  fabButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  companyCard: { padding: 20, alignItems: "center", gap: 10, borderBottomWidth: 1, backgroundColor: "#fff" },
  companyLogo: { width: 80, height: 80, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  companyLogoText: { fontSize: 32, fontWeight: "800" },
  companyName: { fontSize: 22, fontWeight: "800" },
  catBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  catBadgeText: { fontSize: 13, fontWeight: "600" },
  managedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  managerAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  managerInitial: { fontSize: 11, fontWeight: "800" },
  managedText: { fontSize: 13 },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%" },
  modeBadge: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 20 },
  modeBadgeText: { fontSize: 12, fontWeight: "600" },
  manageBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  manageBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, backgroundColor: "#fff" },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  tabLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  postCard: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, gap: 10 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  postAvatarText: { fontSize: 16, fontWeight: "800" },
  postName: { fontSize: 14, fontWeight: "700" },
  postDate: { fontSize: 12 },
  postContent: { fontSize: 14, lineHeight: 21 },
  postActions: { flexDirection: "row", alignItems: "center", gap: 20, paddingTop: 10, borderTopWidth: 1 },
  postActionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  postActionText: { fontSize: 13 },
  addProductBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10 },
  addProductBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  chipDivider: { width: 1, marginHorizontal: 4 },
  portfolioEmpty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  portfolioEmptyText: { fontSize: 14 },
  productCard: { flexDirection: "row", borderWidth: 1, borderRadius: 12, overflow: "hidden", gap: 0 },
  productImg: { width: 90, height: 90, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 14, fontWeight: "700", flexShrink: 1, padding: 10, paddingBottom: 0 },
  catBadgeSmall: { marginHorizontal: 10, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  catBadgeSmallText: { fontSize: 11, fontWeight: "600" },
  productPrice: { fontSize: 14, fontWeight: "700", paddingHorizontal: 10 },
  productActions: { flexDirection: "row", gap: 16, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4 },
  productActionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  productActionText: { fontSize: 13 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { width: "47%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  kpiTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kpiBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  kpiBadgeText: { fontSize: 10 },
  kpiNum: { fontSize: 24, fontWeight: "800" },
  kpiLabel: { fontSize: 11 },
  analyticsCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  analyticsCardTitle: { fontSize: 15, fontWeight: "700" },
  growthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  growthLabel: { fontSize: 13 },
  growthValues: { flexDirection: "row", alignItems: "center", gap: 6 },
  growthCurrent: { fontSize: 13, fontWeight: "700" },
  growthSep: { fontSize: 11 },
  growthPrev: { fontSize: 13 },
  engagementRate: { fontSize: 36, fontWeight: "800" },
  engagementSub: { fontSize: 12 },
  noDataText: { fontSize: 13 },
  formContainer: { flex: 1 },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  formTitle: { fontSize: 18, fontWeight: "700" },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  formTextarea: { height: 80, textAlignVertical: "top" },
  catChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  catChipText: { fontSize: 13 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  photoBtnText: { fontSize: 14 },
  formBtns: { flexDirection: "row", gap: 12 },
  formSaveBtn: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 10 },
  formSaveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  formCancelBtn: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 10, borderWidth: 1 },
  formCancelText: { fontSize: 15 },
  fabOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 80, paddingRight: 16 },
  fabMenu: { borderRadius: 14, overflow: "hidden", elevation: 8, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, minWidth: 180 },
  fabMenuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  fabMenuText: { fontSize: 14, fontWeight: "500" },
  fabMenuDivider: { height: 1 },
});
