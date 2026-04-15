import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Feather } from "@/components/ui/Icon";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useAuth, supabase } from "@/context/AuthContext";
import {
  fetchCompanyPageById,
  CompanyPage,
  fetchCompanyPosts,
  CompanyProduct,
  fetchCompanyProducts,
  createCompanyProduct,
  updateCompanyProduct,
  deleteCompanyProduct,
  uploadProductImage,
  checkIsFollowingCompany,
  toggleCompanyFollow,
  toggleLike,
  toggleBookmark,
  checkUserCompanyRole,
  getOrCreateDirectConversation,
} from "@/services/api";
import { Post } from "@/components/feed/PostCard";

type CompanyTab  = "publicacoes" | "portfolio" | "painel";
type ProductCat  = "produto" | "vinho" | "acessorio" | "servico";
type SortKey     = "data" | "preco" | "categoria";

interface LocalProduct {
  id: string;
  name: string;
  desc?: string;
  price?: string;
  cat: ProductCat;
  image_url?: string | null;
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

function toLocalProduct(p: CompanyProduct): LocalProduct {
  return {
    id:        p.id,
    name:      p.name,
    desc:      p.description ?? undefined,
    price:     p.price ?? undefined,
    cat:       (p.category as ProductCat) ?? "produto",
    image_url: p.image_url,
  };
}

export default function EmpresaScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, activeCompany } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [companyPage, setCompanyPage] = useState<CompanyPage | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<CompanyTab>("publicacoes");

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  const [products, setProducts]         = useState<LocalProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [sortBy, setSortBy]             = useState<SortKey>("data");
  const [filterCat, setFilterCat]       = useState<ProductCat | "todos">("todos");
  const [showProductForm, setShowProductForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CompanyProduct | null>(null);
  const [editingProduct, setEditingProduct]   = useState<LocalProduct | null>(null);
  const [savingProduct, setSavingProduct]     = useState(false);

  const [pName, setPName]   = useState("");
  const [pDesc, setPDesc]   = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCat, setPCat]     = useState<ProductCat>("produto");
  const [pImageUri, setPImageUri] = useState<string | null>(null);
  const [pImageChanged, setPImageChanged] = useState(false);
  const [uploadingProductImg, setUploadingProductImg] = useState(false);

  const [showFab, setShowFab] = useState(false);

  // Analytics (Painel)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [vacanciesCount, setVacanciesCount] = useState<number | null>(null);
  const [marketCount, setMarketCount] = useState<number | null>(null);
  const [viewsCount, setViewsCount] = useState<number | null>(null);
  const [engagementCount, setEngagementCount] = useState<number | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const loadCompany = useCallback(async () => {
    if (!id) return;
    setCompanyLoading(true);
    const page = await fetchCompanyPageById(id);
    setCompanyPage(page);

    if (user?.id && page) {
      const [following, roleInfo] = await Promise.all([
        checkIsFollowingCompany(id, user.id),
        checkUserCompanyRole(id, user.id),
      ]);
      setIsFollowing(following);
      setIsManager(roleInfo.isOwner || roleInfo.role !== null);
      setUserRole(roleInfo.role);
    }
    setCompanyLoading(false);
  }, [id, user?.id]);

  const loadPosts = useCallback(async () => {
    if (!id || postsLoaded) return;
    setPostsLoading(true);
    const data = await fetchCompanyPosts(id, user?.id, activeCompany?.id ?? null);
    setPosts(data);
    setPostsLoaded(true);
    setPostsLoading(false);
  }, [id, user?.id, activeCompany?.id, postsLoaded]);

  const loadProducts = useCallback(async () => {
    if (!id || productsLoaded) return;
    setProductsLoading(true);
    const data = await fetchCompanyProducts(id);
    setProducts(data.map(toLocalProduct));
    setProductsLoaded(true);
    setProductsLoading(false);
  }, [id, productsLoaded]);

  useEffect(() => { loadCompany(); }, [loadCompany]);

  useEffect(() => {
    if (activeTab === "publicacoes") { loadPosts(); }
    if (activeTab === "portfolio")   { loadProducts(); }
    if (activeTab === "painel" && !analyticsLoaded && id) {
      (async () => {
        const ownerId = companyPage?.owner_id ?? null;
        const since7 = new Date(); since7.setDate(since7.getDate() - 7);
        const since7Str = since7.toISOString().split("T")[0];

        const [fRes, vRes, mRes, likesRes, commentsRes] = await Promise.all([
          supabase.from("company_follows").select("id", { count: "exact", head: true }).eq("company_id", id),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("company_page_id", id).eq("type", "vaga").eq("is_active", true),
          supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("company_page_id", id).eq("type", "marketplace").eq("is_active", true),
          supabase.from("likes").select("id", { count: "exact", head: true }).eq("company_page_id", id),
          supabase.from("comments").select("id", { count: "exact", head: true }).eq("company_page_id", id),
        ]);

        let views = 0;
        if (ownerId) {
          const { count } = await supabase
            .from("profile_views")
            .select("id", { count: "exact", head: true })
            .eq("profile_id", ownerId)
            .gte("viewed_at", since7Str);
          views = count ?? 0;
        }

        setFollowersCount(fRes.count ?? 0);
        setVacanciesCount(vRes.count ?? 0);
        setMarketCount(mRes.count ?? 0);
        setViewsCount(views);
        setEngagementCount((likesRes.count ?? 0) + (commentsRes.count ?? 0));
        setAnalyticsLoaded(true);
      })();
    }
  }, [activeTab, loadPosts, loadProducts, analyticsLoaded, id, companyPage]);

  // ── Realtime: posts, likes and comments for this company ──
  useEffect(() => {
    if (!id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`company-${id}-realtime_${uid}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: `company_page_id=eq.${id}` },
        async (payload) => {
          const raw = payload.new as any;
          const { fetchPostById } = await import("@/services/api");
          const full = await fetchPostById(raw.id, user?.id);
          if (!full) return;
          setPosts(prev => prev.some(p => p.id === full.id) ? prev : [full, ...prev]);
        }
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes" }, (payload) => {
        const postId = (payload.new as any)?.post_id;
        if (!postId) return;
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p
        ));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "likes" }, (payload) => {
        const postId = (payload.old as any)?.post_id;
        if (!postId) return;
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p
        ));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
        const postId = (payload.new as any)?.post_id;
        if (!postId) return;
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user?.id]);

  const resetProductForm = () => {
    setPName(""); setPDesc(""); setPPrice(""); setPCat("produto");
    setPImageUri(null); setPImageChanged(false);
    setEditingProduct(null);
  };

  const handlePickProductImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos de acesso à sua galeria.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPImageUri(result.assets[0].uri);
      setPImageChanged(true);
    }
  };

  const handleSaveProduct = async () => {
    if (!pName.trim()) { Alert.alert("Atenção", "Informe o nome do produto."); return; }
    if (!id) return;
    setSavingProduct(true);

    let imageUrl: string | null | undefined = undefined;

    if (pImageChanged && pImageUri) {
      setUploadingProductImg(true);
      const tempId = editingProduct?.id ?? `tmp-${Date.now()}`;
      const uploaded = await uploadProductImage(tempId, pImageUri);
      setUploadingProductImg(false);
      if (uploaded) { imageUrl = uploaded; }
    }

    if (editingProduct) {
      const ok = await updateCompanyProduct(editingProduct.id, {
        name:        pName.trim(),
        description: pDesc || null,
        price:       pPrice || null,
        category:    pCat,
        ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
      });
      if (ok) {
        setProducts((prev) => prev.map((p) =>
          p.id === editingProduct.id
            ? { ...p, name: pName, desc: pDesc, price: pPrice, cat: pCat, image_url: imageUrl !== undefined ? imageUrl : p.image_url }
            : p
        ));
      } else {
        Alert.alert("Erro", "Não foi possível atualizar o produto.");
      }
    } else {
      const created = await createCompanyProduct({
        company_id:  id,
        name:        pName.trim(),
        description: pDesc || null,
        price:       pPrice || null,
        category:    pCat,
        image_url:   imageUrl ?? null,
      });
      if (created) {
        setProducts((prev) => [toLocalProduct(created), ...prev]);
      } else {
        Alert.alert("Erro", "Não foi possível criar o produto.");
      }
    }

    setSavingProduct(false);
    resetProductForm();
    setShowProductForm(false);
  };

  const openEditProduct = (p: LocalProduct) => {
    setEditingProduct(p);
    setPName(p.name);
    setPDesc(p.desc ?? "");
    setPPrice(p.price ?? "");
    setPCat(p.cat);
    setPImageUri(p.image_url ?? null);
    setPImageChanged(false);
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    Alert.alert("Remover produto", "Deseja remover este produto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          const ok = await deleteCompanyProduct(productId);
          if (ok) {
            setProducts((prev) => prev.filter((x) => x.id !== productId));
          } else {
            Alert.alert("Erro", "Não foi possível remover o produto.");
          }
        },
      },
    ]);
  };

  const handleToggleFollow = async () => {
    if (!user?.id || !id) return;
    setFollowLoading(true);
    const ok = await toggleCompanyFollow(id, user.id, isFollowing);
    if (ok) { setIsFollowing(!isFollowing); }
    setFollowLoading(false);
  };

  const handleMessage = async () => {
    if (!user?.id || !companyPage?.owner_id || messagingLoading) return;
    setMessagingLoading(true);
    // Companies have no messaging restrictions — forceAccepted=true
    const convoId = await getOrCreateDirectConversation(user.id, companyPage.owner_id, true);
    setMessagingLoading(false);
    if (convoId) router.push(`/chat/${convoId}?companyId=${companyPage.id}` as any);
  };

  const handleLikePost = async (post: Post) => {
    if (!user?.id) return;
    const wasLiked = post.is_liked ?? false;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, is_liked: !wasLiked, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      )
    );
    const ok = await toggleLike(post.id, user.id, wasLiked, activeCompany?.id);
    if (!ok) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, is_liked: wasLiked, likes_count: wasLiked ? p.likes_count + 1 : p.likes_count - 1 } : p
        )
      );
    }
  };

  const handleBookmarkPost = async (post: Post) => {
    if (!user?.id) return;
    const wasBookmarked = post.is_bookmarked ?? false;
    setPosts((prev) =>
      prev.map((p) => p.id === post.id ? { ...p, is_bookmarked: !wasBookmarked } : p)
    );
    await toggleBookmark(post.id, user.id, wasBookmarked);
  };

  const filteredProducts = products.filter((p) => {
    if (filterCat !== "todos" && p.cat !== filterCat) return false;
    if (productSearch && !p.name.toLowerCase().includes(productSearch.toLowerCase())) return false;
    return true;
  });

  const catCounts: Record<string, number> = {};
  products.forEach((p) => { catCounts[p.cat] = (catCounts[p.cat] ?? 0) + 1; });

  const companyName    = companyPage?.name      ?? "Empresa";
  const companyIndustry = companyPage?.industry  ?? null;
  const companyBio     = companyPage?.bio        ?? null;
  const companyLogo    = companyPage?.avatar_url ?? null;
  const nameInitial    = companyName.charAt(0).toUpperCase();

  if (companyLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          {companyLogo ? (
            <Image source={{ uri: companyLogo }} style={styles.headerLogo} />
          ) : (
            <View style={[styles.headerLogoFallback, { backgroundColor: colors.navy }]}>
              <Text style={[styles.headerLogoText, { color: colors.gold }]}>{nameInitial}</Text>
            </View>
          )}
          <Text style={[styles.headerTitle, { color: colors.navy }]} numberOfLines={1}>{companyName}</Text>
        </TouchableOpacity>
        {isManager ? (
          <TouchableOpacity
            style={[styles.fabButton, { backgroundColor: colors.gold }]}
            onPress={() => setShowFab(true)}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        ) : user?.id ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              style={[styles.headerIconBtn, { borderColor: messagingLoading ? colors.border : colors.gold }]}
              onPress={handleMessage}
              disabled={messagingLoading}
            >
              <Feather name="message-circle" size={16} color={messagingLoading ? colors.mutedForeground : colors.gold} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.followBtn, { backgroundColor: isFollowing ? colors.border : colors.gold }]}
              onPress={handleToggleFollow}
              disabled={followLoading}
            >
              <Feather name={isFollowing ? "user-check" : "user-plus"} size={14} color={isFollowing ? colors.navy : "#fff"} />
              <Text style={[styles.followBtnText, { color: isFollowing ? colors.navy : "#fff" }]}>
                {followLoading ? "..." : isFollowing ? "Seguindo" : "Seguir"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Company card */}
        <View style={[styles.companyCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          {companyLogo ? (
            <Image source={{ uri: companyLogo }} style={styles.companyLogo} />
          ) : (
            <View style={[styles.companyLogoFallback, { backgroundColor: colors.navy }]}>
              <Text style={[styles.companyLogoText, { color: colors.gold }]}>{nameInitial}</Text>
            </View>
          )}
          <Text style={[styles.companyName, { color: colors.navy }]}>{companyName}</Text>
          {companyIndustry ? (
            <View style={[styles.catBadge, { backgroundColor: colors.gold + "18" }]}>
              <Text style={[styles.catBadgeText, { color: colors.gold }]}>{companyIndustry}</Text>
            </View>
          ) : null}
          {companyBio ? (
            <Text style={[styles.companyBioText, { color: colors.foreground }]}>{companyBio}</Text>
          ) : null}

          {isManager ? (
            <View style={styles.modeRow}>
              <View style={[styles.modeBadge, { backgroundColor: colors.navy + "12" }]}>
                <Feather name={userRole === "owner" ? "shield" : "user-check"} size={12} color={colors.navy} />
                <Text style={[styles.modeBadgeText, { color: colors.navy }]}>
                  {userRole === "owner" ? "Proprietário" : userRole === "editor" ? "Editor" : userRole === "moderador" ? "Moderador" : "Admin"}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.manageBtn, { backgroundColor: colors.gold }]}
                onPress={() => router.push(`/manage-business-page?id=${id}` as any)}
              >
                <Feather name="settings" size={13} color="#fff" />
                <Text style={styles.manageBtnText}>Gerenciar</Text>
              </TouchableOpacity>
            </View>
          ) : !user?.id ? null : (
            <View style={styles.companyActionRow}>
              <TouchableOpacity
                style={[styles.followBtnLarge, { backgroundColor: isFollowing ? colors.border : colors.gold, flex: 1 }]}
                onPress={handleToggleFollow}
                disabled={followLoading}
              >
                <Feather name={isFollowing ? "user-check" : "user-plus"} size={15} color={isFollowing ? colors.navy : "#fff"} />
                <Text style={[styles.followBtnLargeText, { color: isFollowing ? colors.navy : "#fff" }]}>
                  {followLoading ? "..." : isFollowing ? "Seguindo" : "Seguir"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.messageBtnLarge, { borderColor: messagingLoading ? colors.border : colors.gold, flex: 1 }]}
                onPress={handleMessage}
                disabled={messagingLoading}
              >
                <Feather name="message-circle" size={15} color={messagingLoading ? colors.mutedForeground : colors.gold} />
                <Text style={[styles.messageBtnLargeText, { color: messagingLoading ? colors.mutedForeground : colors.gold }]}>
                  {messagingLoading ? "..." : "Mensagem"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          {([
            { key: "publicacoes", label: "PUBLICAÇÕES" },
            { key: "portfolio",   label: "PORTIFÓLIO" },
            ...(isManager ? [{ key: "painel" as CompanyTab, label: "PAINEL" }] : []),
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
            {postsLoading ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
            ) : posts.length === 0 ? (
              <View style={styles.emptyTab}>
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>Nenhuma publicação ainda</Text>
              </View>
            ) : (
              posts.map((post) => (
                <View key={post.id} style={[styles.postCard, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
                  <View style={styles.postHeader}>
                    {companyLogo ? (
                      <Image source={{ uri: companyLogo }} style={styles.postAvatar} />
                    ) : (
                      <View style={[styles.postAvatarFallback, { backgroundColor: colors.navy }]}>
                        <Text style={[styles.postAvatarText, { color: colors.gold }]}>{nameInitial}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.postName, { color: colors.navy }]}>{companyName}</Text>
                      <Text style={[styles.postDate, { color: colors.mutedForeground }]}>
                        {new Date(post.created_at).toLocaleDateString("pt-BR")}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
                  <View style={[styles.postActions, { borderTopColor: colors.border }]}>
                    <TouchableOpacity style={styles.postActionBtn} onPress={() => handleLikePost(post)}>
                      <Feather name="heart" size={17} color={post.is_liked ? "#e11d48" : colors.mutedForeground} />
                      <Text style={[styles.postActionText, { color: post.is_liked ? "#e11d48" : colors.mutedForeground }]}>{post.likes_count}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postActionBtn}>
                      <Feather name="message-circle" size={17} color={colors.mutedForeground} />
                      <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>{post.comments_count}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postActionBtn} onPress={() => handleBookmarkPost(post)}>
                      <Feather name="bookmark" size={17} color={post.is_bookmarked ? colors.gold : colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.postActionBtn, { marginLeft: "auto" as any }]} onPress={() => router.push(`/post/${post.id}` as any)}>
                      <Feather name="external-link" size={17} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Portfólio ── */}
        {activeTab === "portfolio" && (
          <View style={{ padding: 16, rowGap: 14 }}>
            {isManager ? (
              <TouchableOpacity
                style={[styles.addProductBtn, { backgroundColor: colors.gold }]}
                onPress={() => { resetProductForm(); setShowProductForm(true); }}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.addProductBtnText}>Adicionar Produto</Text>
              </TouchableOpacity>
            ) : null}

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

            {productsLoading ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
            ) : filteredProducts.length === 0 ? (
              <View style={styles.portfolioEmpty}>
                <Feather name="package" size={32} color={colors.border} />
                <Text style={[styles.portfolioEmptyText, { color: colors.mutedForeground }]}>Nenhum produto cadastrado</Text>
              </View>
            ) : (
              filteredProducts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.productCard, { backgroundColor: "#fff", borderColor: colors.border }]}
                  onPress={() => !isManager && setSelectedProduct(p)}
                  activeOpacity={isManager ? 1 : 0.75}
                >
                  <View style={[styles.productImgWrap, { backgroundColor: colors.background }]}>
                    {p.image_url ? (
                      <Image source={{ uri: p.image_url }} style={styles.productImg} />
                    ) : (
                      <Feather name="package" size={28} color={colors.border} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.productName, { color: colors.navy }]} numberOfLines={2}>{p.name}</Text>
                    <View style={[styles.catBadgeSmall, { backgroundColor: colors.gold + "18" }]}>
                      <Text style={[styles.catBadgeSmallText, { color: colors.gold }]}>
                        {PRODUCT_CATS.find((c) => c.key === p.cat)?.label}
                      </Text>
                    </View>
                    {p.price ? <Text style={[styles.productPrice, { color: colors.gold }]}>{p.price}</Text> : null}
                    {isManager ? (
                      <View style={styles.productActions}>
                        <TouchableOpacity style={styles.productActionBtn} onPress={() => openEditProduct(p)}>
                          <Feather name="edit-2" size={14} color={colors.navy} />
                          <Text style={[styles.productActionText, { color: colors.navy }]}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.productActionBtn} onPress={() => handleDeleteProduct(p.id)}>
                          <Feather name="trash-2" size={14} color="#dc2626" />
                          <Text style={[styles.productActionText, { color: "#dc2626" }]}>Remover</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={[styles.productActionText, { color: colors.gold, marginTop: 4 }]}>Ver detalhes →</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ── Painel (managers only) ── */}
        {activeTab === "painel" && isManager && (
          <View style={{ padding: 16, gap: 16 }}>
            {/* Quick actions */}
            <TouchableOpacity
              style={[styles.panelManageBtn, { backgroundColor: colors.navy }]}
              onPress={() => router.push(`/manage-business-page?id=${id}` as any)}
            >
              <Feather name="settings" size={16} color="#fff" />
              <Text style={styles.panelManageBtnText}>Gerenciar Página da Empresa</Text>
              <Feather name="chevron-right" size={16} color="#fff" />
            </TouchableOpacity>

            {/* Analytics grid */}
            <View style={[styles.analyticsCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Text style={[styles.analyticsTitle, { color: colors.navy }]}>Resumo da Empresa</Text>
              <View style={styles.analyticsGrid}>
                {[
                  { label: "Seguidores",      value: followersCount,    icon: "users" },
                  { label: "Publicações",     value: posts.length,      icon: "file-text" },
                  { label: "Visitas (7d)",    value: viewsCount,        icon: "eye" },
                  { label: "Engajamento",     value: engagementCount,   icon: "heart" },
                  { label: "Vagas abertas",   value: vacanciesCount,    icon: "briefcase" },
                  { label: "Marketplace",     value: marketCount,       icon: "shopping-bag" },
                ].map((stat) => (
                  <View key={stat.label} style={[styles.analyticsStat, { backgroundColor: colors.background, borderRadius: 10 }]}>
                    <Feather name={stat.icon as any} size={20} color={colors.gold} />
                    <Text style={[styles.analyticsStatValue, { color: colors.navy }]}>
                      {stat.value === null ? "—" : String(stat.value)}
                    </Text>
                    <Text style={[styles.analyticsStatLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* New content shortcuts */}
            <View style={[styles.analyticsCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Text style={[styles.analyticsTitle, { color: colors.navy }]}>Publicar Conteúdo</Text>
              <View style={{ gap: 10 }}>
                {[
                  { label: "Nova Publicação",  icon: "edit",         route: "/create-post" },
                  { label: "Nova Vaga",        icon: "briefcase",    route: "/new-opportunity" },
                  { label: "Novo Anúncio",     icon: "shopping-bag", route: "/new-opportunity" },
                  { label: "Novo Evento",      icon: "calendar",     route: "/new-event" },
                ].map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    style={[styles.panelActionRow, { borderColor: colors.border }]}
                    onPress={() => router.push(action.route as any)}
                  >
                    <View style={[styles.panelActionIcon, { backgroundColor: colors.gold + "18" }]}>
                      <Feather name={action.icon as any} size={16} color={colors.gold} />
                    </View>
                    <Text style={[styles.panelActionLabel, { color: colors.navy }]}>{action.label}</Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </View>
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
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14 }}>
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

            {/* Product image */}
            <TouchableOpacity
              style={[styles.photoBtn, { borderColor: colors.border }]}
              onPress={handlePickProductImage}
              disabled={uploadingProductImg}
            >
              {pImageUri ? (
                <Image source={{ uri: pImageUri }} style={styles.productImgPreview} />
              ) : (
                <Feather name="image" size={16} color={colors.mutedForeground} />
              )}
              <Text style={[styles.photoBtnText, { color: colors.mutedForeground }]}>
                {pImageUri ? "Trocar foto" : "Adicionar foto"}
              </Text>
            </TouchableOpacity>

            <View style={styles.formBtns}>
              <TouchableOpacity
                style={[styles.formCancelBtn, { borderColor: colors.border }]}
                onPress={() => { resetProductForm(); setShowProductForm(false); }}
              >
                <Text style={[styles.formCancelText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formSaveBtn, { backgroundColor: savingProduct ? colors.gold + "88" : colors.gold }]}
                onPress={handleSaveProduct}
                disabled={savingProduct}
              >
                <Text style={styles.formSaveBtnText}>{savingProduct ? "Salvando..." : "Salvar"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Product detail modal (non-managers) */}
      <Modal visible={!!selectedProduct} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedProduct(null)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.formHeader, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.navy }]} numberOfLines={1}>{selectedProduct?.name ?? ""}</Text>
            <TouchableOpacity onPress={() => setSelectedProduct(null)}>
              <Feather name="x" size={22} color={colors.navy} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {selectedProduct?.image_url && (
              <Image source={{ uri: selectedProduct.image_url }} style={{ width: "100%", height: 220, borderRadius: 12 }} resizeMode="cover" />
            )}
            <View style={{ gap: 8 }}>
              {selectedProduct?.category && (
                <View style={[styles.catBadgeSmall, { backgroundColor: colors.gold + "18", alignSelf: "flex-start" }]}>
                  <Text style={[styles.catBadgeSmallText, { color: colors.gold }]}>
                    {PRODUCT_CATS.find((c) => c.key === selectedProduct.category)?.label ?? selectedProduct.category}
                  </Text>
                </View>
              )}
              {selectedProduct?.price && (
                <Text style={[styles.productPrice, { fontSize: 20 }]}>{selectedProduct.price}</Text>
              )}
              {selectedProduct?.description && (
                <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 22 }}>{selectedProduct.description}</Text>
              )}
            </View>
            {user?.id && companyPage?.owner_id && user.id !== companyPage.owner_id && (
              <TouchableOpacity
                style={[styles.formSaveBtn, { backgroundColor: colors.navy, marginTop: 8 }]}
                onPress={async () => {
                  if (!user?.id || !companyPage?.owner_id) return;
                  const convoId = await getOrCreateDirectConversation(user.id, companyPage.owner_id, true);
                  if (convoId) {
                    setSelectedProduct(null);
                    router.push(`/chat/${convoId}?companyId=${companyPage.id}` as any);
                  }
                }}
              >
                <Feather name="message-circle" size={16} color="#fff" />
                <Text style={[styles.formSaveBtnText, { marginLeft: 8 }]}>Entrar em contato</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* FAB menu */}
      <Modal visible={showFab} transparent animationType="fade" onRequestClose={() => setShowFab(false)}>
        <Pressable style={styles.fabOverlay} onPress={() => setShowFab(false)}>
          <View style={[styles.fabMenu, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFab(false); router.push("/create-post" as any); }}>
              <Feather name="file-text" size={16} color={colors.navy} />
              <Text style={[styles.fabMenuText, { color: colors.navy }]}>Nova Publicação</Text>
            </TouchableOpacity>
            <View style={[styles.fabMenuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setShowFab(false); resetProductForm(); setShowProductForm(true); }}>
              <Feather name="package" size={16} color={colors.navy} />
              <Text style={[styles.fabMenuText, { color: colors.navy }]}>Novo Produto</Text>
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
  backRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  headerLogo: { width: 28, height: 28, borderRadius: 6 },
  headerLogoFallback: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  headerLogoText: { fontSize: 13, fontWeight: "800" },
  fabButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  followBtnText: { fontSize: 13, fontWeight: "700" },
  headerIconBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  companyCard: { padding: 20, alignItems: "center", gap: 10, borderBottomWidth: 1, backgroundColor: "#fff" },
  companyLogo: { width: 80, height: 80, borderRadius: 12 },
  companyLogoFallback: { width: 80, height: 80, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  companyLogoText: { fontSize: 32, fontWeight: "800" },
  companyName: { fontSize: 22, fontWeight: "800" },
  companyBioText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  catBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  catBadgeText: { fontSize: 13, fontWeight: "600" },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%" },
  modeBadge: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 20 },
  modeBadgeText: { fontSize: 12, fontWeight: "600" },
  manageBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  manageBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  followBtnLarge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  followBtnLargeText: { fontSize: 14, fontWeight: "700" },
  companyActionRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  messageBtnLarge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5 },
  messageBtnLargeText: { fontSize: 14, fontWeight: "700" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, backgroundColor: "#fff" },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  tabLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  emptyTab: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTabText: { fontSize: 13, textAlign: "center" },
  postCard: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, gap: 10 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postAvatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
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
  productCard: { flexDirection: "row", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  productImgWrap: { width: 90, height: 90, alignItems: "center", justifyContent: "center" },
  productImg: { width: 90, height: 90 },
  productName: { fontSize: 14, fontWeight: "700", flexShrink: 1, padding: 10, paddingBottom: 0 },
  catBadgeSmall: { marginHorizontal: 10, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  catBadgeSmallText: { fontSize: 11, fontWeight: "600" },
  productPrice: { fontSize: 14, fontWeight: "700", paddingHorizontal: 10 },
  productActions: { flexDirection: "row", gap: 16, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4 },
  productActionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  productActionText: { fontSize: 13 },
  formContainer: { flex: 1 },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  formTitle: { fontSize: 18, fontWeight: "700" },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  formTextarea: { height: 80, textAlignVertical: "top" },
  catChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  catChipText: { fontSize: 13 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14 },
  photoBtnText: { fontSize: 14 },
  productImgPreview: { width: 36, height: 36, borderRadius: 6 },
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
  // Painel / Analytics
  panelManageBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12 },
  panelManageBtnText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  analyticsCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 14 },
  analyticsTitle: { fontSize: 15, fontWeight: "700" },
  analyticsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  analyticsStat: { width: "46%", padding: 14, alignItems: "center", gap: 6 },
  analyticsStatValue: { fontSize: 24, fontWeight: "800" },
  analyticsStatLabel: { fontSize: 12, textAlign: "center" },
  panelActionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  panelActionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  panelActionLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
});
