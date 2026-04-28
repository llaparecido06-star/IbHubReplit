import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { PostRichContent } from "@/components/feed/PostRichContent";
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
import { friendlyErrorMessage } from "@/hooks/useAsyncAction";

type CompanyTab  = "publicacoes" | "portfolio" | "painel" | "anuncios";
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
  const [profileFollowers, setProfileFollowers] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<CompanyTab>("publicacoes");

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  useEffect(() => {
    setPosts([]);
    setPostsLoaded(false);
  }, [id]);

  const [products, setProducts]         = useState<LocalProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [sortBy, setSortBy]             = useState<SortKey>("data");
  const [filterCat, setFilterCat]       = useState<ProductCat | "todos">("todos");
  const [showProductForm, setShowProductForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<LocalProduct | null>(null);
  const [editingProduct, setEditingProduct]   = useState<LocalProduct | null>(null);
  const [savingProduct, setSavingProduct]     = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

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

    const [followersRes, ..._] = await Promise.all([
      supabase.from("company_follows").select("id", { count: "exact", head: true }).eq("company_id", id),
      user?.id && page
        ? Promise.all([
            checkIsFollowingCompany(id, user.id).then(f => setIsFollowing(f)),
            checkUserCompanyRole(id, user.id).then(r => {
              setIsManager(r.isOwner || r.role !== null);
              setUserRole(r.role);
            }),
          ])
        : Promise.resolve(null),
    ]);
    setProfileFollowers(followersRes.count ?? 0);
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
    try {
      let imageUrl: string | null | undefined = undefined;

      if (pImageChanged && pImageUri) {
        setUploadingProductImg(true);
        try {
          const tempId = editingProduct?.id ?? `tmp-${Date.now()}`;
          const uploaded = await uploadProductImage(tempId, pImageUri);
          if (uploaded) { imageUrl = uploaded; }
        } finally {
          setUploadingProductImg(false);
        }
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

      resetProductForm();
      setShowProductForm(false);
    } catch (e: unknown) {
      Alert.alert("Erro", friendlyErrorMessage(e));
    } finally {
      setSavingProduct(false);
    }
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

  const handleDeleteProduct = (productId: string) => {
    Alert.alert("Remover produto", "Deseja remover este produto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          setDeletingProductId(productId);
          try {
            const ok = await deleteCompanyProduct(productId);
            if (ok) {
              setProducts((prev) => prev.filter((x) => x.id !== productId));
            } else {
              Alert.alert("Erro", "Não foi possível remover o produto.");
            }
          } catch (e: unknown) {
            Alert.alert("Erro", friendlyErrorMessage(e));
          } finally {
            setDeletingProductId(null);
          }
        },
      },
    ]);
  };

  const handleToggleFollow = async () => {
    if (!user?.id || !id) return;
    setFollowLoading(true);
    const ok = await toggleCompanyFollow(id, user.id, isFollowing);
    if (ok) {
      setIsFollowing(!isFollowing);
      setProfileFollowers(prev => prev === null ? null : isFollowing ? prev - 1 : prev + 1);
    }
    setFollowLoading(false);
  };

  const handleMessage = async () => {
    if (!user?.id || !companyPage?.owner_id || messagingLoading) return;
    setMessagingLoading(true);
    // Companies have no messaging restrictions — forceAccepted=true
    // Tag with companyPage.id so company threads stay separate from personal DMs
    const convoId = await getOrCreateDirectConversation(user.id, companyPage.owner_id, true, companyPage.id);
    setMessagingLoading(false);
    if (convoId) router.push(`/chat/${convoId}?companyId=${companyPage.id}` as any);
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
      {/* Navigation bar */}
      <View style={[styles.navBar, { paddingTop: topPad + 10, backgroundColor: colors.navy }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBackBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{companyName}</Text>
        {isManager ? (
          <TouchableOpacity style={styles.navActionBtn} onPress={() => setShowFab(true)}>
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* ── Profile header ── */}
        <View style={{ backgroundColor: "#fff" }}>
          {/* Cover gradient */}
          <LinearGradient
            colors={[colors.navy, "#1b3d5e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coverGradient}
          />

          {/* Logo overlapping cover */}
          <View style={styles.profileLogoRow}>
            <View style={[styles.profileLogoWrap, { borderColor: "#fff", shadowColor: "#000" }]}>
              {companyLogo ? (
                <Image source={{ uri: companyLogo }} style={styles.profileLogo} />
              ) : (
                <View style={[styles.profileLogoFallback, { backgroundColor: colors.navy }]}>
                  <Text style={[styles.profileLogoInitial, { color: colors.gold }]}>{nameInitial}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Info block */}
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.navy }]}>{companyName}</Text>

            {companyIndustry ? (
              <Text style={[styles.profileIndustry, { color: colors.gold }]}>{companyIndustry}</Text>
            ) : null}

            {/* Meta row: location + website */}
            {(companyPage?.location || companyPage?.website) ? (
              <View style={styles.profileMeta}>
                {companyPage?.location ? (
                  <View style={styles.profileMetaItem}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.profileMetaText, { color: colors.mutedForeground }]}>{companyPage.location}</Text>
                  </View>
                ) : null}
                {companyPage?.website ? (
                  <TouchableOpacity
                    style={styles.profileMetaItem}
                    onPress={() => Linking.openURL(
                      companyPage.website!.startsWith("http") ? companyPage.website! : `https://${companyPage.website}`
                    )}
                  >
                    <Feather name="link" size={12} color={colors.gold} />
                    <Text style={[styles.profileMetaText, { color: colors.gold }]} numberOfLines={1}>
                      {companyPage.website.replace(/^https?:\/\//, "")}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {companyBio ? (
              <Text style={[styles.profileBio, { color: colors.foreground }]}>{companyBio}</Text>
            ) : null}

            {/* Stats */}
            <View style={[styles.profileStats, { borderTopColor: colors.border }]}>
              <View style={styles.profileStat}>
                <Text style={[styles.profileStatNum, { color: colors.navy }]}>
                  {profileFollowers === null ? "—" : String(profileFollowers)}
                </Text>
                <Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Seguidores</Text>
              </View>
              {postsLoaded && posts.length > 0 ? (
                <>
                  <View style={[styles.profileStatDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.profileStat}>
                    <Text style={[styles.profileStatNum, { color: colors.navy }]}>{posts.length}</Text>
                    <Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Publicações</Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* CTA buttons */}
            {isManager ? (
              <View style={styles.profileCtas}>
                <View style={[styles.roleBadge, { backgroundColor: colors.navy + "0f", borderColor: colors.navy + "25" }]}>
                  <Feather name={userRole === "owner" ? "shield" : "user-check"} size={13} color={colors.navy} />
                  <Text style={[styles.roleBadgeText, { color: colors.navy }]}>
                    {userRole === "owner" ? "Proprietário" : userRole === "editor" ? "Editor" : userRole === "moderador" ? "Moderador" : "Admin"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.ctaBtn, styles.ctaBtnPrimary, { backgroundColor: colors.gold }]}
                  onPress={() => router.push(`/manage-business-page?id=${id}` as any)}
                >
                  <Feather name="settings" size={14} color="#fff" />
                  <Text style={styles.ctaBtnPrimaryText}>Gerenciar</Text>
                </TouchableOpacity>
              </View>
            ) : user?.id ? (
              <View style={styles.profileCtas}>
                <TouchableOpacity
                  style={[styles.ctaBtn, styles.ctaBtnPrimary, {
                    flex: 1,
                    backgroundColor: isFollowing ? colors.border : colors.gold,
                  }]}
                  onPress={handleToggleFollow}
                  disabled={followLoading}
                >
                  <Feather
                    name={isFollowing ? "user-check" : "user-plus"}
                    size={14}
                    color={isFollowing ? colors.navy : "#fff"}
                  />
                  <Text style={[styles.ctaBtnPrimaryText, { color: isFollowing ? colors.navy : "#fff" }]}>
                    {followLoading ? "..." : isFollowing ? "Seguindo" : "Seguir"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ctaBtn, styles.ctaBtnOutline, { flex: 1, borderColor: messagingLoading ? colors.border : colors.gold }]}
                  onPress={handleMessage}
                  disabled={messagingLoading}
                >
                  <Feather name="message-circle" size={14} color={messagingLoading ? colors.mutedForeground : colors.gold} />
                  <Text style={[styles.ctaBtnOutlineText, { color: messagingLoading ? colors.mutedForeground : colors.gold }]}>
                    {messagingLoading ? "..." : "Mensagem"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}
          contentContainerStyle={{ flexDirection: "row" }}
        >
          {([
            { key: "publicacoes", label: "PUBLICAÇÕES" },
            { key: "portfolio",   label: "PORTIFÓLIO" },
            ...(isManager ? [
              { key: "painel"   as CompanyTab, label: "PAINEL" },
              { key: "anuncios" as CompanyTab, label: "ANÚNCIOS" },
            ] : []),
          ] as { key: CompanyTab; label: string }[]).map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, { flex: 0, paddingHorizontal: 16 }, activeTab === t.key && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
              onPress={() => {
                if (t.key === "anuncios") {
                  router.push({ pathname: "/empresa/admin" as any, params: { id, name: companyPage?.name ?? "" } });
                } else {
                  setActiveTab(t.key);
                }
              }}
            >
              <Text style={[styles.tabLabel, { color: activeTab === t.key ? colors.gold : colors.mutedForeground }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
                  <PostRichContent post={post as any} />
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

        {/* ── Portifólio ── */}
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
                        <TouchableOpacity
                          style={[styles.productActionBtn, deletingProductId === p.id && { opacity: 0.5 }]}
                          onPress={() => handleDeleteProduct(p.id)}
                          disabled={!!deletingProductId}
                        >
                          {deletingProductId === p.id
                            ? <ActivityIndicator size={14} color="#dc2626" />
                            : <Feather name="trash-2" size={14} color="#dc2626" />}
                          <Text style={[styles.productActionText, { color: "#dc2626" }]}>
                            {deletingProductId === p.id ? "Removendo..." : "Remover"}
                          </Text>
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
        <View style={[styles.formContainer, { backgroundColor: colors.background }]}>
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
              {selectedProduct?.cat && (
                <View style={[styles.catBadgeSmall, { backgroundColor: colors.gold + "18", alignSelf: "flex-start" }]}>
                  <Text style={[styles.catBadgeSmallText, { color: colors.gold }]}>
                    {PRODUCT_CATS.find((c) => c.key === selectedProduct.cat)?.label}
                  </Text>
                </View>
              )}
              {selectedProduct?.price && (
                <Text style={[styles.productPrice, { fontSize: 20 }]}>{selectedProduct.price}</Text>
              )}
              {selectedProduct?.desc && (
                <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 22 }}>{selectedProduct.desc}</Text>
              )}
            </View>
            {user?.id && companyPage?.owner_id && user.id !== companyPage.owner_id && (
              <TouchableOpacity
                style={[styles.formSaveBtn, { backgroundColor: colors.navy, marginTop: 8 }]}
                onPress={async () => {
                  if (!user?.id || !companyPage?.owner_id) return;
                  const convoId = await getOrCreateDirectConversation(user.id, companyPage.owner_id, true, companyPage.id);
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
  // ── Nav bar ──────────────────────────────────────────────────────────────
  navBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  navBackBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, color: "#fff", fontSize: 17, fontWeight: "700" },
  navActionBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  // ── Profile header ────────────────────────────────────────────────────────
  coverGradient: { height: 120 },
  profileLogoRow: { paddingHorizontal: 20, marginTop: -42 },
  profileLogoWrap: { width: 84, height: 84, borderRadius: 16, borderWidth: 3, overflow: "hidden", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  profileLogo: { width: "100%", height: "100%", resizeMode: "cover" },
  profileLogoFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  profileLogoInitial: { fontSize: 34, fontWeight: "800" },
  profileInfo: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 6 },
  profileName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  profileIndustry: { fontSize: 14, fontWeight: "600" },
  profileMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 2 },
  profileMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  profileMetaText: { fontSize: 13 },
  profileBio: { fontSize: 14, lineHeight: 21, marginTop: 2 },
  profileStats: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 14, marginTop: 8, borderTopWidth: 1 },
  profileStat: { alignItems: "center", gap: 1 },
  profileStatNum: { fontSize: 18, fontWeight: "800" },
  profileStatLabel: { fontSize: 12 },
  profileStatDivider: { width: 1, height: 28, opacity: 0.4 },
  profileCtas: { flexDirection: "row", gap: 10, marginTop: 10 },
  roleBadge: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  roleBadgeText: { fontSize: 13, fontWeight: "600" },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12 },
  ctaBtnPrimary: {},
  ctaBtnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  ctaBtnOutline: { borderWidth: 1.5 },
  ctaBtnOutlineText: { fontSize: 14, fontWeight: "700" },
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
