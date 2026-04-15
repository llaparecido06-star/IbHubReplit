import { useRouter, useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { PostRichContent } from "@/components/feed/PostRichContent";
import QRCode from "react-native-qrcode-svg";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth, supabase } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { friendlyErrorMessage } from "@/hooks/useAsyncAction";
import * as ImagePicker from "expo-image-picker";
import {
  CompanyPage,
  CompanyProduct,
  FollowProfile,
  SuggestedProfile,
  WineEntry,
  fetchSuggestedConnections,
  fetchFollowers,
  fetchFollowing,
  fetchUserCompanyPages,
  fetchUserPosts,
  fetchCompanyPosts,
  fetchBookmarkedPosts,
  fetchWineCellar,
  fetchCompanyProducts,
  createCompanyProduct,
  updateCompanyProduct,
  deleteCompanyProduct,
  uploadProductImage,
  checkIsFollowingCompany,
  toggleCompanyFollow,
  checkUserCompanyRole,
  getOrCreateDirectConversation,
  sendConnectionRequest,
  toggleLike,
  toggleBookmark,
  addComment,
  deletePost,
  toggleFollow,
  fetchProfileViewsThisWeek,
  ensureReferralCode,
  fetchMyReferralStats,
  fetchCompanyPageById,
} from "@/services/api";
import { Post } from "@/components/feed/PostCard";
import EmpresaDashboard from "@/components/EmpresaDashboard";
import { UserListModal, UserListType } from "@/components/profile/UserListModal";

type StatModal = UserListType | null;

// ── Types for EmpresaTabPage ───────────────────────────────────────────────────
type EmpresaTabKey  = "publicacoes" | "portfolio" | "painel";
type ProductCat     = "produto" | "vinho" | "acessorio" | "servico";
type EmpresaSortKey = "data" | "preco" | "categoria";

interface LocalProduct {
  id: string; name: string; desc?: string; price?: string;
  cat: ProductCat; image_url?: string | null;
}

const EMPRESA_PRODUCT_CATS: { key: ProductCat; label: string }[] = [
  { key: "produto",   label: "Produto" },
  { key: "vinho",     label: "Vinho" },
  { key: "acessorio", label: "Acessório" },
  { key: "servico",   label: "Serviço" },
];

const EMPRESA_SORT_OPTIONS: { key: EmpresaSortKey; label: string }[] = [
  { key: "data",      label: "Data" },
  { key: "preco",     label: "Preço" },
  { key: "categoria", label: "Categoria" },
];

function toLocalProduct(p: CompanyProduct): LocalProduct {
  return { id: p.id, name: p.name, desc: p.description ?? undefined, price: p.price ?? undefined, cat: (p.category as ProductCat) ?? "produto", image_url: p.image_url };
}

// ── EmpresaTabPage ─────────────────────────────────────────────────────────────
// Full empresa profile rendered as a tab (no back button, tab bar visible).
function EmpresaTabPage({ companyId, topPad, bottomPad }: { companyId: string; topPad: number; bottomPad: number }) {
  const colors  = useColors();
  const router  = useRouter();
  const { user, activeCompany, setActiveCompany } = useAuth();

  const [companyPage,      setCompanyPage]      = useState<CompanyPage | null>(null);
  const [companyLoading,   setCompanyLoading]   = useState(true);
  const [isManager,        setIsManager]        = useState(false);
  const [userRole,         setUserRole]         = useState<string | null>(null);
  const [activeTab,        setActiveTab]        = useState<EmpresaTabKey>("publicacoes");

  const [posts,            setPosts]            = useState<Post[]>([]);
  const [postsLoading,     setPostsLoading]     = useState(false);
  const [postsLoaded,      setPostsLoaded]      = useState(false);

  const [products,         setProducts]         = useState<LocalProduct[]>([]);
  const [productsLoading,  setProductsLoading]  = useState(false);
  const [productsLoaded,   setProductsLoaded]   = useState(false);
  const [productSearch,    setProductSearch]    = useState("");
  const [sortBy,           setSortBy]           = useState<EmpresaSortKey>("data");
  const [filterCat,        setFilterCat]        = useState<ProductCat | "todos">("todos");
  const [showProductForm,  setShowProductForm]  = useState(false);
  const [selectedProduct,  setSelectedProduct]  = useState<LocalProduct | null>(null);
  const [editingProduct,   setEditingProduct]   = useState<LocalProduct | null>(null);
  const [savingProduct,    setSavingProduct]    = useState(false);
  const [deletingId,       setDeletingId]       = useState<string | null>(null);

  const [pName,  setPName]  = useState("");
  const [pDesc,  setPDesc]  = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCat,   setPCat]   = useState<ProductCat>("produto");
  const [pImg,   setPImg]   = useState<string | null>(null);
  const [pImgChanged, setPImgChanged] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const [showFab,          setShowFab]          = useState(false);
  const [analyticsLoaded,  setAnalyticsLoaded]  = useState(false);
  const [followersCount,   setFollowersCount]   = useState<number | null>(null);
  const [vacanciesCount,   setVacanciesCount]   = useState<number | null>(null);
  const [marketCount,      setMarketCount]      = useState<number | null>(null);
  const [viewsCount,       setViewsCount]       = useState<number | null>(null);
  const [engagementCount,  setEngagementCount]  = useState<number | null>(null);

  // ── Load company ───────────────────────────────────────────────────────────
  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    setCompanyLoading(true);
    const page = await fetchCompanyPageById(companyId);
    setCompanyPage(page);
    if (user?.id && page) {
      const roleInfo = await checkUserCompanyRole(companyId, user.id);
      setIsManager(roleInfo.isOwner || roleInfo.role !== null);
      setUserRole(roleInfo.role);
    }
    setCompanyLoading(false);
  }, [companyId, user?.id]);

  const loadPosts = useCallback(async () => {
    if (!companyId || postsLoaded) return;
    setPostsLoading(true);
    const data = await fetchCompanyPosts(companyId, user?.id, activeCompany?.id ?? null);
    setPosts(data); setPostsLoaded(true); setPostsLoading(false);
  }, [companyId, user?.id, activeCompany?.id, postsLoaded]);

  const loadProducts = useCallback(async () => {
    if (!companyId || productsLoaded) return;
    setProductsLoading(true);
    const data = await fetchCompanyProducts(companyId);
    setProducts(data.map(toLocalProduct)); setProductsLoaded(true); setProductsLoading(false);
  }, [companyId, productsLoaded]);

  useEffect(() => { loadCompany(); }, [loadCompany]);
  useEffect(() => {
    if (activeTab === "publicacoes") loadPosts();
    if (activeTab === "portfolio")   loadProducts();
    if (activeTab === "painel" && !analyticsLoaded && companyId) {
      (async () => {
        const since7 = new Date(); since7.setDate(since7.getDate() - 7);
        const since7Str = since7.toISOString().split("T")[0];
        const ownerId = companyPage?.owner_id ?? null;
        const [fRes, vRes, mRes, likesRes, commentsRes] = await Promise.all([
          supabase.from("company_follows").select("id", { count: "exact", head: true }).eq("company_id", companyId),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("company_page_id", companyId).eq("type", "vaga").eq("is_active", true),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("company_page_id", companyId).eq("type", "marketplace").eq("is_active", true),
          supabase.from("likes").select("id", { count: "exact", head: true }).eq("company_page_id", companyId),
          supabase.from("comments").select("id", { count: "exact", head: true }).eq("company_page_id", companyId),
        ]);
        let views = 0;
        if (ownerId) {
          const { count } = await supabase.from("profile_views").select("id", { count: "exact", head: true }).eq("profile_id", ownerId).gte("viewed_at", since7Str);
          views = count ?? 0;
        }
        setFollowersCount(fRes.count ?? 0); setVacanciesCount(vRes.count ?? 0);
        setMarketCount(mRes.count ?? 0); setViewsCount(views);
        setEngagementCount((likesRes.count ?? 0) + (commentsRes.count ?? 0));
        setAnalyticsLoaded(true);
      })();
    }
  }, [activeTab, loadPosts, loadProducts, analyticsLoaded, companyId, companyPage]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase.channel(`company-tab-${companyId}-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `company_page_id=eq.${companyId}` }, async (payload) => {
        const { fetchPostById } = await import("@/services/api");
        const full = await fetchPostById((payload.new as any).id, user?.id);
        if (full) setPosts(prev => prev.some(p => p.id === full.id) ? prev : [full, ...prev]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes" }, (payload) => {
        const pid = (payload.new as any)?.post_id;
        if (pid) setPosts(prev => prev.map(p => p.id === pid ? { ...p, likes_count: p.likes_count + 1 } : p));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "likes" }, (payload) => {
        const pid = (payload.old as any)?.post_id;
        if (pid) setPosts(prev => prev.map(p => p.id === pid ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
        const pid = (payload.new as any)?.post_id;
        if (pid) setPosts(prev => prev.map(p => p.id === pid ? { ...p, comments_count: p.comments_count + 1 } : p));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId, user?.id]);

  // ── Product helpers ────────────────────────────────────────────────────────
  const resetForm = () => { setPName(""); setPDesc(""); setPPrice(""); setPCat("produto"); setPImg(null); setPImgChanged(false); setEditingProduct(null); };
  const openEdit  = (p: LocalProduct) => { setEditingProduct(p); setPName(p.name); setPDesc(p.desc ?? ""); setPPrice(p.price ?? ""); setPCat(p.cat); setPImg(p.image_url ?? null); setPImgChanged(false); setShowProductForm(true); };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permissão necessária", "Precisamos de acesso à sua galeria."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) { setPImg(result.assets[0].uri); setPImgChanged(true); }
  };

  const handleSaveProduct = async () => {
    if (!pName.trim()) { Alert.alert("Atenção", "Informe o nome do produto."); return; }
    setSavingProduct(true);
    try {
      let imageUrl: string | null | undefined = undefined;
      if (pImgChanged && pImg) {
        setUploadingImg(true);
        try { const u = await uploadProductImage(editingProduct?.id ?? `tmp-${Date.now()}`, pImg); if (u) imageUrl = u; } finally { setUploadingImg(false); }
      }
      if (editingProduct) {
        const ok = await updateCompanyProduct(editingProduct.id, { name: pName.trim(), description: pDesc || null, price: pPrice || null, category: pCat, ...(imageUrl !== undefined ? { image_url: imageUrl } : {}) });
        if (ok) setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, name: pName, desc: pDesc, price: pPrice, cat: pCat, image_url: imageUrl !== undefined ? imageUrl : p.image_url } : p));
        else Alert.alert("Erro", "Não foi possível atualizar o produto.");
      } else {
        const created = await createCompanyProduct({ company_id: companyId, name: pName.trim(), description: pDesc || null, price: pPrice || null, category: pCat, image_url: imageUrl ?? null });
        if (created) setProducts(prev => [toLocalProduct(created), ...prev]);
        else Alert.alert("Erro", "Não foi possível criar o produto.");
      }
      resetForm(); setShowProductForm(false);
    } catch (e: unknown) { Alert.alert("Erro", friendlyErrorMessage(e)); } finally { setSavingProduct(false); }
  };

  const handleDeleteProduct = (productId: string) => {
    Alert.alert("Remover produto", "Deseja remover este produto?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => {
        setDeletingId(productId);
        try { const ok = await deleteCompanyProduct(productId); if (ok) setProducts(prev => prev.filter(x => x.id !== productId)); else Alert.alert("Erro", "Não foi possível remover."); }
        catch (e: unknown) { Alert.alert("Erro", friendlyErrorMessage(e)); } finally { setDeletingId(null); }
      }},
    ]);
  };

  const handleLikePost = async (post: Post) => {
    if (!user?.id) return;
    const wasLiked = post.is_liked ?? false;
    const prevCount = post.likes_count;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_liked: !wasLiked, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    try {
      const ok = await toggleLike(post.id, user.id, wasLiked, activeCompany?.id);
      if (!ok) { setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_liked: wasLiked, likes_count: prevCount } : p)); Alert.alert("Erro", "Não foi possível curtir."); }
    } catch (e: unknown) { setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_liked: wasLiked, likes_count: prevCount } : p)); }
  };

  const handleBookmarkPost = async (post: Post) => {
    if (!user?.id) return;
    const wasBookmarked = post.is_bookmarked ?? false;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_bookmarked: !wasBookmarked } : p));
    await toggleBookmark(post.id, user.id, wasBookmarked);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const catCounts: Record<string, number> = {};
  products.forEach(p => { catCounts[p.cat] = (catCounts[p.cat] ?? 0) + 1; });
  const filteredProducts = products.filter(p => {
    if (filterCat !== "todos" && p.cat !== filterCat) return false;
    if (productSearch && !p.name.toLowerCase().includes(productSearch.toLowerCase())) return false;
    return true;
  });

  const companyName    = companyPage?.name      ?? "Empresa";
  const companyIndustry = companyPage?.industry  ?? null;
  const companyBio     = companyPage?.bio        ?? null;
  const companyLogo    = companyPage?.avatar_url ?? null;
  const nameInitial    = companyName.charAt(0).toUpperCase();

  if (companyLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header (no back button) ── */}
      <View style={{ paddingTop: topPad + 14, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {companyLogo ? (
            <Image source={{ uri: companyLogo }} style={{ width: 28, height: 28, borderRadius: 6 }} />
          ) : (
            <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.gold }}>{nameInitial}</Text>
            </View>
          )}
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.navy, flex: 1 }} numberOfLines={1}>{companyName}</Text>
        </View>
        {isManager ? (
          <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }} onPress={() => setShowFab(true)}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
            onPress={() => setActiveCompany(null)}
          >
            <Feather name="user" size={13} color={colors.mutedForeground} />
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Perfil pessoal</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* ── Company card ── */}
        <View style={{ padding: 20, alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: "#fff" }}>
          {companyLogo ? (
            <Image source={{ uri: companyLogo }} style={{ width: 80, height: 80, borderRadius: 12 }} />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 32, fontWeight: "800", color: colors.gold }}>{nameInitial}</Text>
            </View>
          )}
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.navy }}>{companyName}</Text>
          {companyIndustry ? (
            <View style={{ backgroundColor: colors.gold + "18", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.gold }}>{companyIndustry}</Text>
            </View>
          ) : null}
          {companyBio ? <Text style={{ fontSize: 14, lineHeight: 20, textAlign: "center", color: colors.foreground }}>{companyBio}</Text> : null}

          {isManager ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, width: "100%" }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.navy + "12" }}>
                <Feather name={userRole === "owner" ? "shield" : "user-check"} size={12} color={colors.navy} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.navy }}>
                  {userRole === "owner" ? "Proprietário" : userRole === "editor" ? "Editor" : userRole === "moderador" ? "Moderador" : "Admin"}
                </Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.gold }}
                onPress={() => router.push(`/manage-business-page?id=${companyId}` as any)}
              >
                <Feather name="settings" size={13} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Gerenciar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* ── Tabs ── */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: "#fff" }}>
          {([
            { key: "publicacoes" as EmpresaTabKey, label: "PUBLICAÇÕES" },
            { key: "portfolio"   as EmpresaTabKey, label: "PORTIFÓLIO" },
            ...(isManager ? [{ key: "painel" as EmpresaTabKey, label: "PAINEL" }] : []),
          ]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderBottomWidth: activeTab === t.key ? 2 : 0, borderBottomColor: colors.gold }}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.5, color: activeTab === t.key ? colors.gold : colors.mutedForeground }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Publicações ── */}
        {activeTab === "publicacoes" && (
          <View>
            {postsLoading ? <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} /> :
             posts.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48, gap: 10 }}>
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Nenhuma publicação ainda</Text>
              </View>
            ) : posts.map(post => (
              <View key={post.id} style={{ backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {companyLogo ? <Image source={{ uri: companyLogo }} style={{ width: 40, height: 40, borderRadius: 20 }} /> :
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 16, fontWeight: "800", color: colors.gold }}>{nameInitial}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.navy }}>{companyName}</Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{new Date(post.created_at).toLocaleDateString("pt-BR")}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, lineHeight: 21, color: colors.foreground }}>{post.content}</Text>
                <PostRichContent post={post as any} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 5 }} onPress={() => handleLikePost(post)}>
                    <Feather name="heart" size={17} color={post.is_liked ? "#e11d48" : colors.mutedForeground} />
                    <Text style={{ fontSize: 13, color: post.is_liked ? "#e11d48" : colors.mutedForeground }}>{post.likes_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Feather name="message-circle" size={17} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{post.comments_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 5 }} onPress={() => handleBookmarkPost(post)}>
                    <Feather name="bookmark" size={17} color={post.is_bookmarked ? colors.gold : colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 5, marginLeft: "auto" as any }} onPress={() => router.push(`/post/${post.id}` as any)}>
                    <Feather name="external-link" size={17} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Portfólio ── */}
        {activeTab === "portfolio" && (
          <View style={{ padding: 16, rowGap: 14 }}>
            {isManager ? (
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10, backgroundColor: colors.gold }}
                onPress={() => { resetForm(); setShowProductForm(true); }}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Adicionar Produto</Text>
              </TouchableOpacity>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput style={{ flex: 1, fontSize: 14, color: colors.foreground }} placeholder="Buscar produto..." placeholderTextColor={colors.mutedForeground} value={productSearch} onChangeText={setProductSearch} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {EMPRESA_SORT_OPTIONS.map(s => (
                <TouchableOpacity key={s.key} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: sortBy === s.key ? colors.gold : "#fff", borderColor: sortBy === s.key ? colors.gold : colors.border }} onPress={() => setSortBy(s.key)}>
                  <Text style={{ fontSize: 13, color: sortBy === s.key ? "#fff" : colors.mutedForeground }}>{s.label}</Text>
                </TouchableOpacity>
              ))}
              <View style={{ width: 1, marginHorizontal: 4, backgroundColor: colors.border }} />
              {([{ key: "todos" as const, label: "Todos" }, ...EMPRESA_PRODUCT_CATS.filter(c => catCounts[c.key])]).map(c => (
                <TouchableOpacity key={c.key} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: filterCat === c.key ? colors.navy + "18" : "#fff", borderColor: colors.border }} onPress={() => setFilterCat(c.key as any)}>
                  <Text style={{ fontSize: 13, color: colors.navy }}>{c.label}{c.key !== "todos" && catCounts[c.key] ? ` (${catCounts[c.key]})` : ""}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {productsLoading ? <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} /> :
             filteredProducts.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
                <Feather name="package" size={32} color={colors.border} />
                <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Nenhum produto cadastrado</Text>
              </View>
            ) : filteredProducts.map(p => (
              <TouchableOpacity key={p.id} style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: "#fff" }}
                onPress={() => !isManager && setSelectedProduct(p)} activeOpacity={isManager ? 1 : 0.75}>
                <View style={{ width: 90, height: 90, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
                  {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 90, height: 90 }} /> : <Feather name="package" size={28} color={colors.border} />}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.navy, flexShrink: 1, padding: 10, paddingBottom: 0 }} numberOfLines={2}>{p.name}</Text>
                  <View style={{ marginHorizontal: 10, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.gold + "18" }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.gold }}>{EMPRESA_PRODUCT_CATS.find(c => c.key === p.cat)?.label}</Text>
                  </View>
                  {p.price ? <Text style={{ fontSize: 14, fontWeight: "700", color: colors.gold, paddingHorizontal: 10 }}>{p.price}</Text> : null}
                  {isManager ? (
                    <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4 }}>
                      <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 5 }} onPress={() => openEdit(p)}>
                        <Feather name="edit-2" size={14} color={colors.navy} /><Text style={{ fontSize: 13, color: colors.navy }}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 5, opacity: deletingId === p.id ? 0.5 : 1 }} onPress={() => handleDeleteProduct(p.id)} disabled={!!deletingId}>
                        {deletingId === p.id ? <ActivityIndicator size={14} color="#dc2626" /> : <Feather name="trash-2" size={14} color="#dc2626" />}
                        <Text style={{ fontSize: 13, color: "#dc2626" }}>{deletingId === p.id ? "Removendo..." : "Remover"}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : <Text style={{ fontSize: 13, color: colors.gold, marginTop: 4, paddingHorizontal: 10 }}>Ver detalhes →</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Painel ── */}
        {activeTab === "painel" && isManager && (
          <View style={{ padding: 16, gap: 16 }}>
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.navy }}
              onPress={() => router.push(`/manage-business-page?id=${companyId}` as any)}>
              <Feather name="settings" size={16} color="#fff" />
              <Text style={{ flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" }}>Gerenciar Página da Empresa</Text>
              <Feather name="chevron-right" size={16} color="#fff" />
            </TouchableOpacity>

            {/* Voltar ao perfil pessoal */}
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }}
              onPress={() => setActiveCompany(null)}>
              <Feather name="user" size={16} color={colors.navy} />
              <Text style={{ flex: 1, color: colors.navy, fontSize: 14, fontWeight: "700" }}>Voltar ao perfil pessoal</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14, backgroundColor: "#fff" }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.navy }}>Resumo da Empresa</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {[
                  { label: "Seguidores",    value: followersCount,   icon: "users" },
                  { label: "Publicações",   value: posts.length,     icon: "file-text" },
                  { label: "Visitas (7d)",  value: viewsCount,       icon: "eye" },
                  { label: "Engajamento",   value: engagementCount,  icon: "heart" },
                  { label: "Vagas abertas", value: vacanciesCount,   icon: "briefcase" },
                  { label: "Marketplace",   value: marketCount,      icon: "shopping-bag" },
                ].map(stat => (
                  <View key={stat.label} style={{ width: "46%", padding: 14, alignItems: "center", gap: 6, backgroundColor: colors.background, borderRadius: 10 }}>
                    <Feather name={stat.icon as any} size={20} color={colors.gold} />
                    <Text style={{ fontSize: 24, fontWeight: "800", color: colors.navy }}>{stat.value === null ? "—" : String(stat.value)}</Text>
                    <Text style={{ fontSize: 12, textAlign: "center", color: colors.mutedForeground }}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Product Form Modal */}
      <Modal visible={showProductForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProductForm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: "#fff" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.navy }}>{editingProduct ? "Editar Produto" : "Adicionar Produto"}</Text>
            <TouchableOpacity onPress={() => setShowProductForm(false)}><Feather name="x" size={22} color={colors.navy} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14 }}>
            <TextInput style={{ borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }} placeholder="Nome do produto" placeholderTextColor={colors.mutedForeground} value={pName} onChangeText={setPName} />
            <TextInput style={{ borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, height: 80, textAlignVertical: "top", backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }} placeholder="Descrição" placeholderTextColor={colors.mutedForeground} value={pDesc} onChangeText={setPDesc} multiline textAlignVertical="top" />
            <TextInput style={{ borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }} placeholder="Preço (ex: R$ 150,00)" placeholderTextColor={colors.mutedForeground} value={pPrice} onChangeText={setPPrice} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {EMPRESA_PRODUCT_CATS.map(c => (
                <TouchableOpacity key={c.key} style={{ borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: pCat === c.key ? colors.gold : "#fff", borderColor: pCat === c.key ? colors.gold : colors.border }} onPress={() => setPCat(c.key)}>
                  <Text style={{ fontSize: 13, color: pCat === c.key ? "#fff" : colors.foreground }}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }} onPress={pickImage} disabled={uploadingImg}>
              {pImg ? <Image source={{ uri: pImg }} style={{ width: 36, height: 36, borderRadius: 6 }} /> : <Feather name="image" size={16} color={colors.mutedForeground} />}
              <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{pImg ? "Trocar foto" : "Adicionar foto"}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border }} onPress={() => { resetForm(); setShowProductForm(false); }}>
                <Text style={{ fontSize: 15, color: colors.foreground }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 10, backgroundColor: savingProduct ? colors.gold + "88" : colors.gold }} onPress={handleSaveProduct} disabled={savingProduct}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{savingProduct ? "Salvando..." : "Salvar"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Product detail modal */}
      <Modal visible={!!selectedProduct} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedProduct(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: "#fff" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.navy }} numberOfLines={1}>{selectedProduct?.name ?? ""}</Text>
            <TouchableOpacity onPress={() => setSelectedProduct(null)}><Feather name="x" size={22} color={colors.navy} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {selectedProduct?.image_url && <Image source={{ uri: selectedProduct.image_url }} style={{ width: "100%", height: 220, borderRadius: 12 }} resizeMode="cover" />}
            <View style={{ gap: 8 }}>
              {selectedProduct?.cat && (
                <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.gold + "18" }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.gold }}>{EMPRESA_PRODUCT_CATS.find(c => c.key === selectedProduct.cat)?.label}</Text>
                </View>
              )}
              {selectedProduct?.price && <Text style={{ fontSize: 20, fontWeight: "700", color: colors.gold }}>{selectedProduct.price}</Text>}
              {selectedProduct?.desc && <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 22 }}>{selectedProduct.desc}</Text>}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* FAB menu */}
      <Modal visible={showFab} transparent animationType="fade" onRequestClose={() => setShowFab(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: topPad + 60, paddingRight: 16 }} onPress={() => setShowFab(false)}>
          <View style={{ borderRadius: 14, overflow: "hidden", elevation: 8, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, minWidth: 180, backgroundColor: "#fff" }}>
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }} onPress={() => { setShowFab(false); router.push("/create-post" as any); }}>
              <Feather name="file-text" size={16} color={colors.navy} /><Text style={{ fontSize: 14, fontWeight: "500", color: colors.navy }}>Nova Publicação</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }} onPress={() => { setShowFab(false); resetForm(); setShowProductForm(true); }}>
              <Feather name="package" size={16} color={colors.navy} /><Text style={{ fontSize: 14, fontWeight: "500", color: colors.navy }}>Novo Produto</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }} onPress={() => { setShowFab(false); setActiveCompany(null); }}>
              <Feather name="user" size={16} color={colors.navy} /><Text style={{ fontSize: 14, fontWeight: "500", color: colors.navy }}>Perfil pessoal</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function ProfileScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { profile, user, signOut, activeCompany } = useAuth();

  const [activeTab,    setActiveTab]    = useState<"feed" | "salvos" | "adega">("feed");
  const [showComments, setShowComments] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
  const [commentText,  setCommentText]  = useState("");
  const [statModal,    setStatModal]    = useState<StatModal>(null);

  const [posts,          setPosts]          = useState<Post[]>([]);
  const [savedPosts,     setSavedPosts]     = useState<Post[]>([]);
  const [wineEntries,    setWineEntries]    = useState<WineEntry[]>([]);
  const [followers,      setFollowers]      = useState<FollowProfile[]>([]);
  const [following,      setFollowing]      = useState<FollowProfile[]>([]);
  const [suggestions,    setSuggestions]    = useState<SuggestedProfile[]>([]);
  const [followingSet,   setFollowingSet]   = useState<Set<string>>(new Set());
  const [connectingId,   setConnectingId]   = useState<string | null>(null);
  const [companyPages,   setCompanyPages]   = useState<CompanyPage[]>([]);
  const [loadingData,    setLoadingData]    = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);


  // Engagement state
  const [profileViews,  setProfileViews]  = useState(0);
  const [showQrModal,   setShowQrModal]   = useState(false);
  const [referralCode,  setReferralCode]  = useState<string | null>(null);
  const [inviteCount,   setInviteCount]   = useState(0);
  const [inviteRank,    setInviteRank]    = useState(0);

  const isCompany = !!activeCompany || profile?.profile_type === "empresa";
  const name      = profile?.full_name ?? profile?.username ?? "Usuário";
  const username  = profile?.username  ?? "";
  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  // ── All hooks must run before any conditional return ──────────────────────

  // Always keep company pages fresh — fires on mount, focus, and identity switch
  const refreshCompanyPages = useCallback(async () => {
    if (!user?.id) return;
    const cp = await fetchUserCompanyPages(user.id);
    setCompanyPages(cp);
  }, [user?.id]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    // Always fetch company pages regardless of mode
    refreshCompanyPages();
    // Skip heavy personal data when in company mode (we show EmpresaProfileProxy anyway)
    if (isCompany) { setLoadingData(false); setRefreshing(false); return; }
    const areas = profile?.areas_of_expertise ?? [];
    const [p, saved, wines, fr, fg, sg] = await Promise.all([
      fetchUserPosts(user.id, user.id),
      fetchBookmarkedPosts(user.id),
      fetchWineCellar(user.id),
      fetchFollowers(user.id),
      fetchFollowing(user.id),
      fetchSuggestedConnections(user.id, areas, 8),
    ]);
    setPosts(p);
    setSavedPosts(saved);
    setWineEntries(wines);
    setFollowers(fr);
    setFollowing(fg);
    setFollowingSet(new Set(fg.map((f) => f.id)));
    setSuggestions(sg);
    setLoadingData(false);
    setRefreshing(false);
  }, [user?.id, isCompany, refreshCompanyPages]);

  const loadEngagement = useCallback(async () => {
    if (!user?.id) return;
    const [views, refCode, stats] = await Promise.all([
      fetchProfileViewsThisWeek(user.id),
      ensureReferralCode(user.id),
      fetchMyReferralStats(user.id),
    ]);
    setProfileViews(views);
    setReferralCode(refCode);
    setInviteCount(stats.count);
    setInviteRank(stats.rank);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadEngagement(); }, [loadEngagement]);
  // Reload company pages every time the tab gains focus
  useFocusEffect(useCallback(() => { refreshCompanyPages(); }, [refreshCompanyPages]));
  // Also reload when switching identity (activeCompany change)
  useEffect(() => { refreshCompanyPages(); }, [refreshCompanyPages, activeCompany]);

  // Realtime: remove accepted connections from suggestions
  useEffect(() => {
    if (!user?.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`profile_connections_suggestions_${user.id}_${uid}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "connections",
      }, (payload) => {
        const row = payload.new as any;
        if (row.status !== "accepted") return;
        const isInvolved = row.requester_id === user.id || row.receiver_id === user.id;
        if (!isInvolved) return;
        const otherId = row.requester_id === user.id ? row.receiver_id : row.requester_id;
        setSuggestions(prev => prev.filter(s => s.id !== otherId));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  // ─────────────────────────────────────────────────────────────────────────

  const onRefresh = () => { setRefreshing(true); loadData(); loadEngagement(); };

  // Profile completion (0-100)
  const computeCompletion = () => {
    if (!profile) return 0;
    const fields = [
      !!profile.full_name,
      !!profile.username,
      !!profile.headline,
      !!profile.bio,
      !!profile.avatar_url,
      !!profile.location,
      !!(profile.areas_of_expertise ?? []).length,
      !!profile.company || !!profile.position,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  };
  const completion = computeCompletion();

  // Badges
  const badges = [
    posts.length >= 1    && { icon: "✍️", label: "Primeiro Post" },
    posts.length >= 10   && { icon: "📝", label: "Publicador Ativo" },
    (profile?.followers_count ?? 0) >= 10  && { icon: "🌟", label: "10 Seguidores" },
    (profile?.followers_count ?? 0) >= 100 && { icon: "🏆", label: "100 Seguidores" },
    (profile?.connections_count ?? 0) >= 5 && { icon: "🤝", label: "Bem Conectado" },
    wineEntries.length >= 5 && { icon: "🍷", label: "Enólogo" },
    wineEntries.length >= 20 && { icon: "🥂", label: "Colecionador" },
    completion >= 100 && { icon: "💎", label: "Perfil Completo" },
    profileViews >= 10 && { icon: "👁️", label: "Destaque da Semana" },
    !!referralCode && { icon: "🎁", label: "Embaixador" },
  ].filter(Boolean) as { icon: string; label: string }[];

  const handleDeletePost = (id: string) => {
    setShowPostMenu(null);
    Alert.alert("Excluir publicação", "Deseja excluir esta publicação?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive", onPress: async () => {
          const ok = await deletePost(id);
          if (ok) {
            setPosts((p) => p.filter((x) => x.id !== id));
          } else {
            Alert.alert("Erro", "Não foi possível excluir a publicação. Tente novamente.");
          }
        }
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert("Sair", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  };

  const handleBusinessPage = async () => {
    if (!profile?.id) return;
    if (companyPages.length === 0) {
      router.push("/manage-business-page" as any);
    } else if (companyPages.length === 1) {
      router.push(`/manage-business-page?id=${companyPages[0].id}` as any);
    } else {
      Alert.alert(
        "Suas páginas",
        "Selecione qual página gerenciar:",
        [
          ...companyPages.map((p) => ({
            text: p.name,
            onPress: () => router.push(`/manage-business-page?id=${p.id}` as any),
          })),
          { text: "Cancelar", style: "cancel" as const },
        ],
      );
    }
  };

  const handleConnect = async (targetId: string) => {
    if (!user?.id || connectingId) return;
    const suggestion = suggestions.find((s) => s.id === targetId);
    const alreadyFollowing = suggestion?.is_following ?? followingSet.has(targetId);
    setConnectingId(targetId);
    setSuggestions((prev) =>
      prev.map((s) => s.id === targetId ? { ...s, connection_status: "pending" as const, is_following: true } : s)
    );
    await sendConnectionRequest(targetId, user.id);
    if (!alreadyFollowing) {
      await toggleFollow(targetId, user.id, false);
      setFollowingSet((prev) => { const next = new Set(prev); next.add(targetId); return next; });
    }
    setConnectingId(null);
  };

  const handleLikePost = async (post: Post) => {
    if (!user?.id) return;
    const wasLiked = post.is_liked ?? false;
    const prevCount = post.likes_count;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, is_liked: !wasLiked, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      )
    );
    try {
      const ok = await toggleLike(post.id, user.id, wasLiked, activeCompany?.id);
      if (!ok) {
        setPosts((prev) =>
          prev.map((p) => p.id === post.id ? { ...p, is_liked: wasLiked, likes_count: prevCount } : p)
        );
        Alert.alert("Erro", "Não foi possível curtir. Tente novamente.");
      }
    } catch (e: unknown) {
      setPosts((prev) =>
        prev.map((p) => p.id === post.id ? { ...p, is_liked: wasLiked, likes_count: prevCount } : p)
      );
      Alert.alert("Erro de Conexão", friendlyErrorMessage(e));
    }
  };

  const handleBookmarkPost = async (post: Post) => {
    if (!user?.id) return;
    const wasBookmarked = post.is_bookmarked ?? false;
    setPosts((prev) =>
      prev.map((p) => p.id === post.id ? { ...p, is_bookmarked: !wasBookmarked } : p)
    );
    if (wasBookmarked) {
      setSavedPosts((prev) => prev.filter((p) => p.id !== post.id));
    }
    await toggleBookmark(post.id, user.id, wasBookmarked);
  };

  const handleSubmitComment = async () => {
    const text = commentText.trim();
    if (!text || !showComments || !user?.id) return;
    const targetId = showComments;
    setCommentText("");
    setShowComments(null);
    setPosts((prev) =>
      prev.map((p) => p.id === targetId ? { ...p, comments_count: p.comments_count + 1 } : p)
    );
    try {
      await addComment(targetId, user.id, text);
    } catch (e: unknown) {
      setPosts((prev) =>
        prev.map((p) => p.id === targetId ? { ...p, comments_count: p.comments_count - 1 } : p)
      );
      Alert.alert("Erro de Conexão", friendlyErrorMessage(e));
    }
  };

  const wineInCellar = wineEntries.filter((w) => w.status === "adega").length;
  const wineTotal    = wineEntries.length;

  if (activeCompany) {
    return <EmpresaTabPage companyId={activeCompany.id} topPad={topPad} bottomPad={bottomPad} />;
  }

  if (profile?.profile_type === "empresa") {
    return <EmpresaDashboard />;
  }

  return (
    <>
    {/* QR Code Modal */}
    <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
      <Pressable style={styles.qrOverlay} onPress={() => setShowQrModal(false)}>
        <Pressable style={[styles.qrCard, { backgroundColor: "#fff" }]} onPress={() => {}}>
          <Text style={[styles.qrTitle, { color: colors.navy }]}>Meu QR Code</Text>
          <Text style={[styles.qrSub, { color: colors.mutedForeground }]}>Mostre para conectar rapidamente</Text>
          <View style={styles.qrBox}>
            <QRCode
              value={Linking.createURL(`profile/${user?.id ?? "me"}`)}
              size={200}
              color={colors.navy}
              backgroundColor="#ffffff"
            />
          </View>
          <Text style={[styles.qrName, { color: colors.navy }]}>{name}</Text>
          {username ? <Text style={[styles.qrUsername, { color: colors.mutedForeground }]}>@{username}</Text> : null}
          <TouchableOpacity
            style={[styles.qrShareBtn, { backgroundColor: colors.gold }]}
            onPress={async () => {
              setShowQrModal(false);
              const profileLink = Linking.createURL(`profile/${user?.id ?? "me"}`);
              await Share.share({ message: `Conecte-se comigo na ibhub!\n${profileLink}` });
            }}
          >
            <Feather name="share-2" size={16} color="#fff" />
            <Text style={styles.qrShareBtnText}>Compartilhar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setShowQrModal(false)}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>

    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* ── Cover ── */}
      <View style={[styles.cover, { backgroundColor: colors.navyLight, paddingTop: topPad }]}>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push("/settings" as any)}>
          <Feather name="settings" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Profile card ── */}
      <View style={[styles.profileCard, { backgroundColor: "#fff" }]}>
        {/* Avatar row */}
        <View style={styles.avatarRow}>
          <Avatar uri={profile?.avatar_url} name={name} size={84} />
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: colors.border }]}
            onPress={() => router.push("/edit-profile" as any)}
          >
            <Feather name="edit-2" size={14} color={colors.navy} />
            <Text style={[styles.editBtnText, { color: colors.navy }]}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.name, { color: colors.navy }]}>{name}</Text>
        {username ? <Text style={[styles.username, { color: colors.mutedForeground }]}>@{username}</Text> : null}

        {/* Stats */}
        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          {[
            { label: "Publicações", value: posts.length,                             onPress: undefined },
            { label: "Seguidores",  value: profile?.followers_count  ?? followers.length,  onPress: () => setStatModal("followers") },
            { label: "Seguindo",    value: profile?.following_count  ?? following.length,  onPress: () => setStatModal("following") },
            { label: "Conexões",    value: profile?.connections_count ?? 0,            onPress: () => router.push("/conexoes" as any) },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <TouchableOpacity style={styles.stat} onPress={s.onPress} disabled={!s.onPress}>
                <Text style={[styles.statNum, { color: colors.navy }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio}</Text>
        ) : null}

        {/* Work / certs */}
        {(profile?.company || profile?.position) ? (
          <View style={styles.metaRow}>
            <Feather name="briefcase" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {[profile.company, profile.position].filter(Boolean).join(" · ")}
            </Text>
            <TouchableOpacity style={styles.certsBtn} onPress={() => router.push("/certifications" as any)}>
              <Feather name="shield" size={13} color={colors.gold} />
              <Text style={[styles.certsBtnText, { color: colors.gold }]}>Certificações</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.certsBtn} onPress={() => router.push("/certifications" as any)}>
            <Feather name="shield" size={13} color={colors.gold} />
            <Text style={[styles.certsBtnText, { color: colors.gold }]}>Certificações</Text>
          </TouchableOpacity>
        )}

        {/* Profile views counter */}
        {profileViews > 0 && (
          <View style={[styles.viewsBanner, { backgroundColor: colors.gold + "10", borderColor: colors.gold + "30" }]}>
            <Feather name="eye" size={14} color={colors.gold} />
            <Text style={[styles.viewsBannerText, { color: colors.navy }]}>
              <Text style={{ fontWeight: "800", color: colors.gold }}>{profileViews}</Text>
              {" "}pessoa{profileViews !== 1 ? "s" : ""} visualizaram seu perfil esta semana
            </Text>
          </View>
        )}

        {/* Profile completion bar */}
        {completion < 100 && (
          <TouchableOpacity
            style={[styles.completionCard, { backgroundColor: "#f8fafc", borderColor: colors.border }]}
            onPress={() => router.push("/edit-profile" as any)}
            activeOpacity={0.8}
          >
            <View style={styles.completionHeader}>
              <Text style={[styles.completionTitle, { color: colors.navy }]}>Completar perfil — {completion}%</Text>
              <Feather name="chevron-right" size={15} color={colors.gold} />
            </View>
            <View style={[styles.completionTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.completionFill, { width: `${completion}%` as any, backgroundColor: colors.gold }]} />
            </View>
            <Text style={[styles.completionHint, { color: colors.mutedForeground }]}>
              {completion < 50 ? "Adicione bio, foto e localização para ter mais visibilidade." :
               completion < 80 ? "Quase lá! Adicione áreas de expertise e empresa." :
               "Adicione uma informação final para completar 100%."}
            </Text>
          </TouchableOpacity>
        )}

        {/* Tags */}
        {(profile?.areas_of_expertise ?? []).length > 0 ? (
          <View style={styles.tags}>
            {(profile!.areas_of_expertise!).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.tagText, { color: colors.navy }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Action cards */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.gold + "12", borderColor: colors.gold + "30" }]} onPress={handleBusinessPage} activeOpacity={0.75}>
            <View style={[styles.actionCardIcon, { backgroundColor: colors.gold }]}>
              <Feather name="briefcase" size={18} color="#fff" />
            </View>
            <Text style={[styles.actionCardLabel, { color: colors.navy }]}>
              {companyPages.length === 0 ? "Empresa" : "Empresa"}
            </Text>
            <Text style={[styles.actionCardSub, { color: colors.mutedForeground }]}>
              {companyPages.length === 0 ? "Criar página" : "Gerenciar"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.navyLight + "14", borderColor: colors.navyLight + "30" }]} onPress={() => router.push("/conexoes" as any)} activeOpacity={0.75}>
            <View style={[styles.actionCardIcon, { backgroundColor: colors.navy }]}>
              <Feather name="users" size={18} color="#fff" />
            </View>
            <Text style={[styles.actionCardLabel, { color: colors.navy }]}>Conexões</Text>
            <Text style={[styles.actionCardSub, { color: colors.mutedForeground }]}>
              {profile?.connections_count ?? 0} contatos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { backgroundColor: "#6366f1" + "12", borderColor: "#6366f1" + "30" }]} onPress={() => setShowQrModal(true)} activeOpacity={0.75}>
            <View style={[styles.actionCardIcon, { backgroundColor: "#6366f1" }]}>
              <Feather name="maximize" size={18} color="#fff" />
            </View>
            <Text style={[styles.actionCardLabel, { color: colors.navy }]}>QR Code</Text>
            <Text style={[styles.actionCardSub, { color: colors.mutedForeground }]}>Compartilhar</Text>
          </TouchableOpacity>
        </View>

        {/* Referral code */}
        {referralCode && (
          <View style={[styles.referralCard, { backgroundColor: colors.navy + "08", borderColor: colors.navy + "20" }]}>
            {/* Top row: code + share */}
            <View style={styles.referralTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.referralTitle, { color: colors.navy }]}>Seu código de convite</Text>
                <Text style={[styles.referralCode, { color: colors.gold }]}>{referralCode}</Text>
              </View>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => Share.share({ message: `Junte-se à ibhub — Rede do Vinho com meu convite: ${referralCode}\nhttps://ibhub.com.br` })}
              >
                <Feather name="share-2" size={18} color={colors.gold} />
              </TouchableOpacity>
            </View>
            {/* Bottom row: stats + ranking button */}
            <View style={styles.referralBottomRow}>
              <View style={[styles.inviteStatBadge, { backgroundColor: colors.gold + "18" }]}>
                <Feather name="users" size={12} color={colors.gold} />
                <Text style={[styles.inviteStatText, { color: colors.gold }]}>
                  {inviteCount} {inviteCount === 1 ? "convidado" : "convidados"}
                </Text>
                {inviteRank > 0 && (
                  <Text style={[styles.inviteStatText, { color: colors.gold, opacity: 0.7 }]}>
                    · #{inviteRank}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.rankingBtn, { borderColor: colors.navy + "30" }]}
                onPress={() => router.push("/referral-ranking" as any)}
              >
                <Feather name="award" size={12} color={colors.navy} />
                <Text style={[styles.rankingBtnText, { color: colors.navy }]}>Ver Ranking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <View style={styles.badgesSection}>
            <Text style={[styles.badgesTitle, { color: colors.navy }]}>Conquistas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {badges.map((b) => (
                <View key={b.label} style={[styles.badgeChip, { backgroundColor: colors.gold + "14", borderColor: colors.gold + "30" }]}>
                  <Text style={{ fontSize: 16 }}>{b.icon}</Text>
                  <Text style={[styles.badgeLabel, { color: colors.navy }]}>{b.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Company page card */}
        {companyPages.length > 0 ? (
          <TouchableOpacity
            style={[styles.companyRow, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => router.push(`/manage-business-page?id=${companyPages[0].id}` as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.companyLogoMini, { backgroundColor: colors.navy }]}>
              <Text style={[styles.companyLogoText, { color: colors.gold }]}>
                {companyPages[0].name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.companyInfo}>
              <Text style={[styles.companyName, { color: colors.navy }]}>{companyPages[0].name}</Text>
              {companyPages[0].industry ? (
                <Text style={[styles.companyCategory, { color: colors.mutedForeground }]}>{companyPages[0].industry}</Text>
              ) : null}
            </View>
            <View style={styles.switchBtn}>
              <Feather name="chevron-right" size={16} color={colors.gold} />
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Sugestões (mesmo layout do feed) ── */}
      {suggestions.length > 0 ? (
        <View style={[styles.suggestSection, { backgroundColor: "#fff" }]}>
          <View style={styles.suggestHeader}>
            <Text style={[styles.suggestTitle, { color: colors.navy }]}>Pessoas que você pode conhecer</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestScroll}>
            {suggestions.map((s) => {
              const isPending   = s.connection_status === "pending";
              const isConnected = s.connection_status === "connected";
              const isLoading   = connectingId === s.id;
              return (
                <View key={s.id} style={[styles.suggestCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  <TouchableOpacity onPress={() => router.push(`/profile/${s.id}` as any)}>
                    <Avatar uri={s.avatar_url} name={s.full_name ?? "?"} size={52} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push(`/profile/${s.id}` as any)}>
                    <Text style={[styles.suggestName, { color: colors.navy }]} numberOfLines={1}>
                      {s.full_name ?? s.username ?? "Usuário"}
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={[styles.suggestRole, { color: colors.mutedForeground, opacity: s.headline ? 1 : 0.4 }]}
                    numberOfLines={2}
                  >
                    {s.headline || "—"}
                  </Text>
                  {s.match_score > 0 && (
                    <View style={[styles.matchBadge, { backgroundColor: colors.gold + "18" }]}>
                      <Feather name="zap" size={10} color={colors.gold} />
                      <Text style={[styles.matchBadgeText, { color: colors.gold }]}>
                        {s.match_score} área{s.match_score > 1 ? "s" : ""} em comum
                      </Text>
                    </View>
                  )}
                  {isConnected ? (
                    <View style={[styles.suggestBtnFilled, { backgroundColor: colors.navy + "14" }]}>
                      <Feather name="check" size={12} color={colors.navy} />
                      <Text style={[styles.suggestBtnFilledText, { color: colors.navy }]}>Conectado</Text>
                    </View>
                  ) : isPending ? (
                    <View style={[styles.suggestBtnFilled, { backgroundColor: colors.border }]}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.suggestBtnFilledText, { color: colors.mutedForeground }]}>Enviado</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.suggestBtnFilled, { backgroundColor: colors.navy }, isLoading && { opacity: 0.6 }]}
                      onPress={() => handleConnect(s.id)}
                      disabled={!!connectingId}
                    >
                      <Feather name="user-plus" size={12} color="#fff" />
                      <Text style={[styles.suggestBtnFilledText, { color: "#fff" }]}>
                        {isLoading ? "..." : "Conectar"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Profile tabs ── */}
      <View style={[styles.tabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "feed",   label: "FEED",   icon: null },
          { key: "salvos", label: "SALVOS", icon: "bookmark" },
          { key: "adega",  label: "ADEGA",  icon: "wind" },
        ] as const).map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, activeTab === t.key && [styles.tabActive, { borderBottomColor: colors.gold }]]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, { color: activeTab === t.key ? colors.gold : colors.mutedForeground }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── FEED ── */}
      {activeTab === "feed" && (
        <View style={{ gap: 0 }}>
          {loadingData ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
          ) : posts.length === 0 ? (
            <View style={styles.emptyTab}>
              <Feather name="file-text" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>Nenhuma publicação ainda</Text>
              <TouchableOpacity
                style={[styles.emptyTabBtn, { backgroundColor: colors.gold }]}
                onPress={() => router.push("/create-post" as any)}
              >
                <Text style={styles.emptyTabBtnText}>Criar publicação</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={[styles.postCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
                <View style={styles.postHeader}>
                  <Avatar uri={profile?.avatar_url} name={name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.postName, { color: colors.navy }]}>{name}</Text>
                    <Text style={[styles.postDate, { color: colors.mutedForeground }]}>
                      {new Date(post.created_at).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowPostMenu(post.id)}>
                    <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
                <PostRichContent post={post as any} />
                <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={styles.postActionBtn} onPress={() => handleLikePost(post)}>
                    <Feather name="heart" size={18} color={post.is_liked ? "#e11d48" : colors.mutedForeground} />
                    <Text style={[styles.postActionText, { color: post.is_liked ? "#e11d48" : colors.mutedForeground }]}>{post.likes_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postActionBtn} onPress={() => setShowComments(post.id)}>
                    <Feather name="message-circle" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.comments_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postActionBtn} onPress={() => handleBookmarkPost(post)}>
                    <Feather name="bookmark" size={18} color={post.is_bookmarked ? colors.gold : colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.postActionBtn, { marginLeft: "auto" as any }]}
                    onPress={() => router.push(`/post/${post.id}` as any)}
                  >
                    <Feather name="external-link" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── SALVOS ── */}
      {activeTab === "salvos" && (
        <View style={{ gap: 0 }}>
          {loadingData ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
          ) : savedPosts.length === 0 ? (
            <View style={styles.emptyTab}>
              <Feather name="bookmark" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTabTitle, { color: colors.navy }]}>Nenhuma publicação salva</Text>
              <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
                Salve posts do feed para ler mais tarde
              </Text>
            </View>
          ) : (
            savedPosts.map((post) => {
              const authorName = post.author?.full_name ?? post.author?.username ?? "Usuário";
              return (
                <TouchableOpacity
                  key={post.id}
                  style={[styles.postCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}
                  onPress={() => router.push(`/post/${post.id}` as any)}
                  activeOpacity={0.85}
                >
                  <View style={styles.postHeader}>
                    <Avatar uri={post.author?.avatar_url} name={authorName} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.postName, { color: colors.navy }]}>{authorName}</Text>
                      <Text style={[styles.postDate, { color: colors.mutedForeground }]}>
                        {new Date(post.created_at).toLocaleDateString("pt-BR")}
                      </Text>
                    </View>
                    <Feather name="bookmark" size={16} color={colors.gold} />
                  </View>
                  <Text style={[styles.postContent, { color: colors.foreground }]} numberOfLines={4}>{post.content}</Text>
                  <PostRichContent post={post as any} />
                  <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                    <View style={styles.postActionBtn}>
                      <Feather name="heart" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.likes_count}</Text>
                    </View>
                    <View style={styles.postActionBtn}>
                      <Feather name="message-circle" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.comments_count}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {/* ── ADEGA ── */}
      {activeTab === "adega" && (
        <View style={{ backgroundColor: "#fff" }}>
          {/* KPI row */}
          <View style={styles.adegaKpiRow}>
            {[
              { label: "Na Adega",   value: wineInCellar,                                          icon: "wind",   color: colors.gold },
              { label: "Consumidos", value: wineEntries.filter((w) => w.status === "consumido").length, icon: "coffee", color: colors.mutedForeground },
              { label: "Wishlist",   value: wineEntries.filter((w) => w.status === "wishlist").length,  icon: "star",   color: "#f59e0b" },
            ].map((k) => (
              <View key={k.label} style={[styles.adegaKpiCard, { borderColor: colors.border }]}>
                <Feather name={k.icon as any} size={20} color={k.color} />
                <Text style={[styles.adegaKpiNum, { color: colors.navy }]}>{k.value}</Text>
                <Text style={[styles.adegaKpiLabel, { color: colors.mutedForeground }]}>{k.label}</Text>
              </View>
            ))}
          </View>

          {/* Recent wines preview */}
          {wineEntries.length > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
              <Text style={[styles.adegaPreviewTitle, { color: colors.navy }]}>Últimos adicionados</Text>
              {wineEntries.slice(0, 3).map((wine) => (
                <View key={wine.id} style={[styles.adegaWineRow, { borderColor: colors.border }]}>
                  <View style={[styles.adegaWineDot, { backgroundColor: colors.gold }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.adegaWineName, { color: colors.navy }]} numberOfLines={1}>{wine.name}</Text>
                    {wine.producer || wine.vintage ? (
                      <Text style={[styles.adegaWineSub, { color: colors.mutedForeground }]}>
                        {[wine.producer, wine.vintage].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.adegaWineQty, { color: colors.mutedForeground }]}>{wine.qty}x</Text>
                  {wine.is_private ? <Feather name="eye-off" size={12} color={colors.mutedForeground} /> : null}
                </View>
              ))}
              {wineTotal > 3 ? (
                <Text style={[styles.adegaMoreText, { color: colors.mutedForeground }]}>
                  + {wineTotal - 3} vinho{wineTotal - 3 !== 1 ? "s" : ""} na adega
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyTab}>
              <Feather name="wind" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTabTitle, { color: colors.navy }]}>Sua adega está vazia</Text>
              <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
                Adicione vinhos para montar sua coleção
              </Text>
            </View>
          )}

          {/* Open Adega button */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            <TouchableOpacity
              style={[styles.adegaOpenBtn, { backgroundColor: colors.gold }]}
              onPress={() => router.push("/wine-cellar" as any)}
            >
              <Feather name="wind" size={16} color="#fff" />
              <Text style={styles.adegaOpenBtnText}>
                {wineEntries.length === 0 ? "Abrir Adega e Adicionar Vinho" : "Gerenciar Adega"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Comments modal ── */}
      <Modal visible={showComments !== null} transparent animationType="slide" onRequestClose={() => { setShowComments(null); setCommentText(""); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setShowComments(null); setCommentText(""); }}>
          <View style={[styles.commentsSheet, { backgroundColor: "#fff" }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.commentsTitle, { color: colors.navy }]}>Comentários</Text>
              <TouchableOpacity onPress={() => { setShowComments(null); setCommentText(""); }}>
                <Feather name="x" size={20} color={colors.navy} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.commentsBody]}
              activeOpacity={0.8}
              onPress={() => { const pid = showComments; setShowComments(null); setCommentText(""); if (pid) router.push(`/post/${pid}` as any); }}
            >
              <Text style={[styles.commentsEmpty, { color: colors.mutedForeground }]}>
                Ver comentários completos →
              </Text>
            </TouchableOpacity>
            <View style={[styles.commentInput, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.commentTextInput, { color: colors.foreground }]}
                placeholder="Adicionar comentário..."
                placeholderTextColor={colors.mutedForeground}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity
                onPress={commentText.trim() ? handleSubmitComment : () => { if (showComments) { setCommentText(""); setShowComments(null); router.push(`/post/${showComments}` as any); } }}
              >
                <Feather name="send" size={20} color={commentText.trim() ? colors.gold : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Post menu modal ── */}
      <Modal visible={showPostMenu !== null} transparent animationType="fade" onRequestClose={() => setShowPostMenu(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowPostMenu(null)}>
          <View style={[styles.menuCard, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowPostMenu(null); router.push(`/edit-post/${showPostMenu}` as any); }}>
              <Feather name="edit-2" size={17} color={colors.navy} />
              <Text style={[styles.menuItemText, { color: colors.navy }]}>Editar</Text>
            </TouchableOpacity>
            <View style={[styles.menuDiv, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => handleDeletePost(showPostMenu!)}>
              <Feather name="trash-2" size={17} color="#dc2626" />
              <Text style={[styles.menuItemText, { color: "#dc2626" }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <UserListModal
        visible={statModal !== null}
        type={statModal}
        userId={user?.id ?? null}
        onClose={() => setStatModal(null)}
      />
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  cover:              { height: 130, justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 12, alignItems: "flex-end" },
  settingsBtn:        { padding: 4 },
  profileCard:        { padding: 16, gap: 10 },
  avatarRow:          { marginTop: -48, marginBottom: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  editBtn:            { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  editBtnText:        { fontSize: 13, fontWeight: "600" },
  name:               { fontSize: 24, fontWeight: "800" },
  username:           { fontSize: 14, marginTop: -4 },
  statsRow:           { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, marginVertical: 4 },
  stat:               { flex: 1, alignItems: "center", gap: 2 },
  statNum:            { fontSize: 18, fontWeight: "800" },
  statLabel:          { fontSize: 11 },
  statDivider:        { width: 1, height: 28 },
  bio:                { fontSize: 14, lineHeight: 21 },
  metaRow:            { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaText:           { fontSize: 13, flex: 1 },
  certsBtn:           { flexDirection: "row", alignItems: "center", gap: 4 },
  certsBtnText:       { fontSize: 13, fontWeight: "600" },
  tags:               { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag:                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tagText:            { fontSize: 13 },
  viewsBanner:        { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  viewsBannerText:    { fontSize: 13, flex: 1 },
  completionCard:     { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  completionHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  completionTitle:    { fontSize: 14, fontWeight: "700" },
  completionTrack:    { height: 6, borderRadius: 3, overflow: "hidden" },
  completionFill:     { height: 6, borderRadius: 3 },
  completionHint:     { fontSize: 12, lineHeight: 17 },
  referralCard:       { borderWidth: 1, borderRadius: 10, padding: 14, rowGap: 12 },
  referralTopRow:     { flexDirection: "row", alignItems: "center" },
  referralBottomRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  referralTitle:      { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  referralCode:       { fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  inviteStatBadge:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  inviteStatText:     { fontSize: 12, fontWeight: "700" },
  rankingBtn:         { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  rankingBtnText:     { fontSize: 12, fontWeight: "700" },
  badgesSection:      { gap: 10, paddingBottom: 4 },
  badgesTitle:        { fontSize: 14, fontWeight: "700" },
  badgeChip:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  badgeLabel:         { fontSize: 12, fontWeight: "700" },
  qrOverlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  qrCard:             { borderRadius: 24, padding: 28, alignItems: "center", width: 300, gap: 10, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20 },
  qrTitle:            { fontSize: 20, fontWeight: "800" },
  qrSub:              { fontSize: 13, textAlign: "center" },
  qrBox:              { marginVertical: 10, padding: 16, borderRadius: 16, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8 },
  qrName:             { fontSize: 16, fontWeight: "800" },
  qrUsername:         { fontSize: 13 },
  qrShareBtn:         { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  qrShareBtnText:     { color: "#fff", fontWeight: "700", fontSize: 14 },
  actionGrid:         { flexDirection: "row", gap: 10, marginTop: 4 },
  actionCard:         { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1, gap: 6 },
  actionCardIcon:     { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actionCardLabel:    { fontSize: 13, fontWeight: "700", textAlign: "center" },
  actionCardSub:      { fontSize: 11, textAlign: "center" },
  companyRow:         { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  companyLogoMini:    { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  companyLogoText:    { fontSize: 16, fontWeight: "800" },
  companyInfo:        { flex: 1 },
  companyName:        { fontSize: 14, fontWeight: "700" },
  companyCategory:    { fontSize: 12 },
  switchBtn:          { flexDirection: "row", alignItems: "center", gap: 5 },
  switchText:         { fontSize: 13, fontWeight: "600" },
  suggestSection:      { paddingTop: 12, paddingBottom: 14, marginTop: 10 },
  suggestHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  suggestTitle:        { fontSize: 14, fontWeight: "800" },
  suggestScroll:       { paddingHorizontal: 16, gap: 10 },
  suggestCard:         { width: 128, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 6 },
  suggestName:         { fontSize: 12.5, fontWeight: "700", textAlign: "center" },
  suggestRole:         { fontSize: 10.5, textAlign: "center", lineHeight: 14 },
  matchBadge:          { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  matchBadgeText:      { fontSize: 9.5, fontWeight: "700" },
  suggestBtnFilled:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, marginTop: 2 },
  suggestBtnFilledText:{ fontSize: 11, fontWeight: "700" },
  tabRow:             { flexDirection: "row", borderBottomWidth: 1, marginTop: 10, backgroundColor: "#fff" },
  tab:                { flex: 1, alignItems: "center", paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive:          {},
  tabText:            { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  emptyTab:           { backgroundColor: "#fff", alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
  emptyTabText:       { fontSize: 13, textAlign: "center" },
  emptyTabTitle:      { fontSize: 15, fontWeight: "600", textAlign: "center", lineHeight: 22 },
  emptyTabBtn:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyTabBtnText:    { color: "#fff", fontSize: 14, fontWeight: "700" },
  postCard:           { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  postHeader:         { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  postName:           { fontSize: 14, fontWeight: "700" },
  postDate:           { fontSize: 12 },
  postContent:        { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  postActions:        { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 1 },
  postActionBtn:      { flexDirection: "row", alignItems: "center", gap: 5, marginRight: 20 },
  postActionText:     { fontSize: 13 },
  adegaKpiRow:        { flexDirection: "row", gap: 10, padding: 16 },
  adegaKpiCard:       { flex: 1, alignItems: "center", gap: 4, padding: 12, borderRadius: 12, borderWidth: 1 },
  adegaKpiNum:        { fontSize: 20, fontWeight: "800" },
  adegaKpiLabel:      { fontSize: 11, textAlign: "center" },
  adegaPreviewTitle:  { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  adegaWineRow:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  adegaWineDot:       { width: 8, height: 8, borderRadius: 4 },
  adegaWineName:      { fontSize: 14, fontWeight: "600" },
  adegaWineSub:       { fontSize: 12, marginTop: 2 },
  adegaWineQty:       { fontSize: 12 },
  adegaMoreText:      { fontSize: 12, textAlign: "center", marginTop: 4 },
  adegaOpenBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  adegaOpenBtnText:   { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  commentsSheet:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" },
  commentsHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  commentsTitle:      { fontSize: 17, fontWeight: "700" },
  commentsBody:       { paddingVertical: 24, alignItems: "center" },
  commentsEmpty:      { fontSize: 14 },
  commentInput:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  commentTextInput:   { flex: 1, fontSize: 14 },
  menuOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end", paddingBottom: 40, paddingHorizontal: 16 },
  menuCard:           { borderRadius: 14, overflow: "hidden" },
  menuItem:           { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  menuItemText:       { fontSize: 15, fontWeight: "500" },
  menuDiv:            { height: 1 },
});
