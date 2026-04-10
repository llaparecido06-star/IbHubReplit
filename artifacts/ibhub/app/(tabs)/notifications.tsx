import { useRouter, useFocusEffect, Router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  AppEvent,
  AppOpportunity,
  fetchEvents,
  fetchOpportunities,
  toggleSaveOpportunity,
} from "@/services/api";

type OporTab = "market" | "vagas" | "eventos";

type MarketSort = "recente" | "expirando" | "mais-visualizados";
type MarketFilter = { sort: MarketSort; category: string | null };
type VagasFilter = { modalidade: string | null; contrato: string | null };
type EventosFilter = { tipo: string | null };

const MARKET_CATS  = ["Vinho", "Insumo", "Equipamento", "Serviço", "Outros"];
const MODALIDADES  = ["Remoto", "Presencial", "Híbrido"];
const CONTRATOS    = ["CLT", "PJ", "Estágio", "Freelancer"];
const EVENTO_TIPOS = ["Online", "Presencial", "Gratuito", "Pago"];

function isNew(createdAt: string): boolean {
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 3 * 24 * 60 * 60 * 1000;
}

function isUrgent(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff < 48 * 60 * 60 * 1000;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  return diffMs > 0 && diffMs < 7 * 24 * 60 * 60 * 1000;
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

export default function OportunidadesScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { profile, user, activeCompany } = useAuth();

  const [tab, setTab]       = useState<OporTab>("market");
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState<AppOpportunity[]>([]);
  const [vagas, setVagas]   = useState<AppOpportunity[]>([]);
  const [eventos, setEventos] = useState<AppEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [marketFilter, setMarketFilter] = useState<MarketFilter>({ sort: "recente", category: null });
  const [vagasFilter, setVagasFilter] = useState<VagasFilter>({ modalidade: null, contrato: null });
  const [eventosFilter, setEventosFilter] = useState<EventosFilter>({ tipo: null });

  const [showFilter, setShowFilter] = useState(false);
  const [pastCollapsed, setPastCollapsed] = useState(true);

  const filterAnim = useRef(new Animated.Value(600)).current;
  const filterOverlay = useRef(new Animated.Value(0)).current;

  // Somente quem está com empresa ativa pode criar vagas, market e eventos
  const isEmpresa = !!activeCompany;

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const TABS: { key: OporTab; label: string; icon: any }[] = [
    { key: "market",  label: "Market",  icon: "shopping-bag" },
    { key: "vagas",   label: "Vagas",   icon: "briefcase" },
    { key: "eventos", label: "Eventos", icon: "calendar" },
  ];

  const loadData = useCallback(async () => {
    const [m, v, ev] = await Promise.all([
      fetchOpportunities("marketplace", "", user?.id ?? ""),
      fetchOpportunities("vaga",        "", user?.id ?? ""),
      fetchEvents("", user?.id ?? ""),
    ]);
    setMarket(m);
    setVagas(v);
    setEventos(ev);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const openFilter = () => {
    setShowFilter(true);
    Animated.parallel([
      Animated.timing(filterAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(filterOverlay, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const closeFilter = () => {
    Animated.parallel([
      Animated.timing(filterAnim, { toValue: 600, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(filterOverlay, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setShowFilter(false));
  };

  const handleCreate = () => {
    if (!isEmpresa) {
      Alert.alert(
        "Funcionalidade Exclusiva para Empresas",
        tab === "eventos"
          ? "Somente empresas podem criar eventos. Selecione ou crie uma página de empresa para continuar."
          : "Para anunciar vagas ou produtos no Market, selecione ou crie uma página de empresa.",
        [
          { text: "Agora não", style: "cancel" },
          { text: "Criar página de empresa", onPress: () => router.push("/manage-business-page" as any) },
        ],
      );
      return;
    }
    if (tab === "eventos") {
      router.push("/new-event" as any);
      return;
    }
    router.push("/new-opportunity" as any);
  };

  const handleToggleSave = async (item: AppOpportunity) => {
    if (!user?.id) return;
    const wasSaved = !!item.is_saved;
    const updater = (list: AppOpportunity[]) =>
      list.map((i) => i.id === item.id ? { ...i, is_saved: !wasSaved } : i);
    if (item.type === "marketplace") setMarket(updater);
    else setVagas(updater);
    await toggleSaveOpportunity(item.id, user.id, wasSaved);
  };

  const filteredMarket = (() => {
    let list = market.filter((i) => {
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (marketFilter.category && i.category !== marketFilter.category) return false;
      return true;
    });
    if (marketFilter.sort === "expirando") {
      list = [...list].sort((a, b) => {
        if (!a.expires_at && !b.expires_at) return 0;
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      });
    } else if (marketFilter.sort === "mais-visualizados") {
      list = [...list].sort((a, b) => (b.interests_count ?? 0) - (a.interests_count ?? 0));
    }
    return list;
  })();

  const filteredVagas = (() => {
    let list = vagas.filter((i) => !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.company ?? "").toLowerCase().includes(search.toLowerCase()));
    if (vagasFilter.contrato) list = list.filter((i) => i.contract_type === vagasFilter.contrato);
    if (vagasFilter.modalidade === "Remoto") {
      list = list.filter((i) => {
        const loc = (i.location ?? "").toLowerCase();
        return loc.includes("remot") || loc.includes("online");
      });
    } else if (vagasFilter.modalidade === "Presencial") {
      list = list.filter((i) => {
        if (!i.location) return false;
        const loc = i.location.toLowerCase();
        return !loc.includes("remot") && !loc.includes("online") && !loc.includes("híbrido") && !loc.includes("hibrido");
      });
    } else if (vagasFilter.modalidade === "Híbrido") {
      list = list.filter((i) => {
        const loc = (i.location ?? "").toLowerCase();
        return loc.includes("híbrido") || loc.includes("hibrido");
      });
    }
    return list;
  })();

  const filteredEventos = eventos.filter((i) => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (eventosFilter.tipo === "Online") return i.location_type === "online";
    if (eventosFilter.tipo === "Presencial") return i.location_type === "presencial";
    if (eventosFilter.tipo === "Gratuito") return i.entry_type === "gratuito";
    if (eventosFilter.tipo === "Pago") return i.entry_type !== "gratuito";
    return true;
  });

  const upcomingEvents = filteredEventos.filter((i) => !isPast(i.start_date));
  const pastEvents     = filteredEventos.filter((i) => isPast(i.start_date));

  const showCriarBtn = isEmpresa;

  const activeFilters = (() => {
    if (tab === "market" && (marketFilter.sort !== "recente" || marketFilter.category)) return true;
    if (tab === "vagas" && (vagasFilter.modalidade || vagasFilter.contrato)) return true;
    if (tab === "eventos" && eventosFilter.tipo) return true;
    return false;
  })();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Oportunidades</Text>
        {showCriarBtn ? (
          <TouchableOpacity style={[styles.criarBtn, { backgroundColor: colors.gold }]} onPress={handleCreate}>
            <Feather name="plus" size={15} color="#fff" />
            <Text style={styles.criarBtnText}>{tab === "eventos" ? "Evento" : "Publicar"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.criarBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleCreate}
          >
            <Feather name="lock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.criarBtnText, { color: colors.mutedForeground }]}>Empresas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search + Filter */}
      <View style={[styles.searchWrap, { backgroundColor: "#fff" }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.background, flex: 1 }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, { backgroundColor: activeFilters ? colors.gold : colors.background }]}
          onPress={openFilter}
        >
          <Feather name="sliders" size={16} color={activeFilters ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {TABS.map((t) => {
          const count = t.key === "market" ? market.length : t.key === "vagas" ? vagas.length : eventos.length;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && { backgroundColor: colors.gold }]}
              onPress={() => setTab(t.key)}
            >
              <Feather name={t.icon} size={14} color={tab === t.key ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.tabBtnText, { color: tab === t.key ? "#fff" : colors.mutedForeground }]}>
                {t.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabCount, { backgroundColor: tab === t.key ? "rgba(255,255,255,0.3)" : colors.background }]}>
                  <Text style={[styles.tabCountText, { color: tab === t.key ? "#fff" : colors.mutedForeground }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 10, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : null}

        {/* ── Market ── */}
        {tab === "market" && !loading && filteredMarket.map((item) => {
          const sellerName = item.company ?? item.creator?.full_name ?? null;
          const novo    = isNew(item.created_at);
          const urgente = isUrgent(item.expires_at);
          const saved   = !!item.is_saved;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border, padding: 0, overflow: "hidden" }]}
              onPress={() => router.push(`/opportunity/${item.id}` as any)}
              activeOpacity={0.75}
            >
              {/* Cover image */}
              {item.cover_image_url ? (
                <Image
                  source={{ uri: item.cover_image_url }}
                  style={styles.cardCoverImage}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ padding: 14, rowGap: 7 }}>
              {/* Badges row */}
              <View style={styles.badgesRow}>
                {novo && (
                  <View style={[styles.badge, { backgroundColor: "#dcfce7" }]}>
                    <Text style={[styles.badgeText, { color: "#16a34a" }]}>Novo</Text>
                  </View>
                )}
                {urgente && (
                  <View style={[styles.badge, { backgroundColor: "#fef2f2" }]}>
                    <Text style={[styles.badgeText, { color: "#dc2626" }]}>Urgente</Text>
                  </View>
                )}
                {item.category ? (
                  <View style={[styles.badge, { backgroundColor: colors.background }]}>
                    <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{item.category}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardTopRow}>
                <Text style={[styles.cardTitle, { color: colors.navy, flex: 1 }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); handleToggleSave(item); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather
                    name={saved ? "bookmark" : "bookmark"}
                    size={20}
                    color={saved ? colors.gold : colors.mutedForeground}
                    style={saved ? styles.savedIcon : undefined}
                  />
                </TouchableOpacity>
              </View>

              {sellerName ? (
                <View style={styles.jobMeta}>
                  <Feather name="user" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{sellerName}</Text>
                </View>
              ) : null}

              <View style={styles.cardMeta}>
                {item.price ? (
                  <Text style={[styles.cardPrice, { color: colors.gold }]}>{item.price}</Text>
                ) : null}
                {(item.interests_count ?? 0) > 0 ? (
                  <View style={styles.metaCounter}>
                    <Feather name="eye" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.metaCounterText, { color: colors.mutedForeground }]}>
                      {item.interests_count} {item.interests_count === 1 ? "interessado" : "interessados"}
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.location ? (
                <View style={styles.jobMeta}>
                  <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.location}</Text>
                </View>
              ) : null}
              {item.expires_at ? (
                <View style={styles.expiryRow}>
                  <Feather name="clock" size={13} color={urgente ? "#dc2626" : colors.mutedForeground} />
                  <Text style={[styles.expiryText, { color: urgente ? "#dc2626" : colors.mutedForeground }]}>
                    Expira: {new Date(item.expires_at).toLocaleDateString("pt-BR")}
                  </Text>
                </View>
              ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Vagas ── */}
        {tab === "vagas" && !loading && filteredVagas.map((item) => {
          const nova  = isNew(item.created_at);
          const saved = !!item.is_saved;
          const isRemote = item.location && (item.location.toLowerCase().includes("remot") || item.location.toLowerCase().includes("online"));
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: "#fff", borderColor: item.is_applied ? colors.gold : colors.border }]}
              onPress={() => router.push(`/opportunity/${item.id}` as any)}
              activeOpacity={0.75}
            >
              {/* Badges */}
              <View style={styles.badgesRow}>
                {nova && (
                  <View style={[styles.badge, { backgroundColor: "#dcfce7" }]}>
                    <Text style={[styles.badgeText, { color: "#16a34a" }]}>Nova</Text>
                  </View>
                )}
                {item.location ? (
                  <View style={[styles.badge, { backgroundColor: isRemote ? "#ede9fe" : "#f0f9ff" }]}>
                    <Text style={[styles.badgeText, { color: isRemote ? "#7c3aed" : "#0369a1" }]}>
                      {isRemote ? "Remoto" : "Presencial"}
                    </Text>
                  </View>
                ) : null}
                {item.contract_type ? (
                  <View style={[styles.badge, { backgroundColor: colors.background }]}>
                    <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{item.contract_type}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardTopRow}>
                <Text style={[styles.cardTitle, { color: colors.navy, flex: 1 }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.is_applied ? (
                  <View style={[styles.appliedTag, { backgroundColor: colors.gold + "18" }]}>
                    <Feather name="check-circle" size={12} color={colors.gold} />
                    <Text style={[styles.appliedTagText, { color: colors.gold }]}>Candidatado</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); handleToggleSave(item); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather
                      name="bookmark"
                      size={20}
                      color={saved ? colors.gold : colors.mutedForeground}
                      style={saved ? styles.savedIcon : undefined}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.jobMeta}>
                {item.company ? (
                  <>
                    <Feather name="briefcase" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.company}</Text>
                  </>
                ) : null}
                {item.location ? (
                  <>
                    <Feather name="map-pin" size={13} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                    <Text style={[styles.cardSeller, { color: colors.mutedForeground }]}>{item.location}</Text>
                  </>
                ) : null}
              </View>

              <View style={styles.cardMeta}>
                {item.salary ? (
                  <Text style={[styles.salaryText, { color: colors.gold }]}>{item.salary}</Text>
                ) : null}
                {(item.applications_count ?? 0) > 0 ? (
                  <View style={styles.metaCounter}>
                    <Feather name="users" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.metaCounterText, { color: colors.mutedForeground }]}>
                      {item.applications_count} {item.applications_count === 1 ? "candidato" : "candidatos"}
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.category ? (
                <View style={[styles.badge, { backgroundColor: colors.background, alignSelf: "flex-start" }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{item.category}</Text>
                </View>
              ) : null}

              {item.expires_at ? (
                <View style={styles.expiryRow}>
                  <Feather name="clock" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>
                    Expira: {new Date(item.expires_at).toLocaleDateString("pt-BR")}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {/* ── Eventos — Upcoming ── */}
        {tab === "eventos" && !loading && upcomingEvents.map((item) => (
          <EventoCard key={item.id} item={item} colors={colors} router={router} />
        ))}

        {/* ── Eventos — Past (collapsible) ── */}
        {tab === "eventos" && !loading && pastEvents.length > 0 && (
          <>
            <TouchableOpacity
              style={[styles.pastHeader, { borderColor: colors.border }]}
              onPress={() => setPastCollapsed((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pastHeaderText, { color: colors.mutedForeground }]}>
                Eventos passados ({pastEvents.length})
              </Text>
              <Feather name={pastCollapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {!pastCollapsed && pastEvents.map((item) => (
              <EventoCard key={item.id} item={item} colors={colors} router={router} past />
            ))}
          </>
        )}

        {/* Empty states */}
        {!loading && tab === "market" && filteredMarket.length === 0 && (
          <View style={styles.empty}>
            <Feather name="shopping-bag" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.navy }]}>Nenhum anúncio encontrado</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {search ? "Tente outro termo de busca." : "Seja o primeiro a anunciar algo na rede! Se você tem uma empresa, publique seus produtos e serviços aqui."}
            </Text>
            {!isEmpresa && !search && (
              <TouchableOpacity
                style={[styles.emptyCTA, { backgroundColor: colors.gold }]}
                onPress={() => router.push("/manage-business-page" as any)}
              >
                <Text style={styles.emptyCTAText}>Criar página de empresa</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {!loading && tab === "vagas" && filteredVagas.length === 0 && (
          <View style={styles.empty}>
            <Feather name="briefcase" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.navy }]}>
              {search ? "Nenhuma vaga encontrada" : "Boa sorte na busca!"}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {search
                ? "Tente outro termo ou remova os filtros."
                : "Se você tem uma empresa, crie sua página e publique vagas para encontrar os melhores talentos do setor."}
            </Text>
            {!isEmpresa && !search && (
              <TouchableOpacity
                style={[styles.emptyCTA, { backgroundColor: colors.gold }]}
                onPress={() => router.push("/manage-business-page" as any)}
              >
                <Text style={styles.emptyCTAText}>Criar página de empresa</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {!loading && tab === "eventos" && upcomingEvents.length === 0 && pastEvents.length === 0 && (
          <View style={styles.empty}>
            <Feather name="calendar" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.navy }]}>Nenhum evento encontrado</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {isEmpresa
                ? "Seja o primeiro a criar um evento e conecte profissionais do setor!"
                : "Os eventos são publicados por empresas e produtores do setor. Em breve haverá novidades!"}
            </Text>
            {isEmpresa && (
              <TouchableOpacity
                style={[styles.emptyCTA, { backgroundColor: colors.gold }]}
                onPress={() => router.push("/new-event" as any)}
              >
                <Text style={styles.emptyCTAText}>Criar evento</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Filter Bottom Sheet */}
      {showFilter && (
        <>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeFilter}>
            <Animated.View
              style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)", opacity: filterOverlay }]}
            />
          </Pressable>
          <Animated.View
            style={[
              styles.filterSheet,
              { backgroundColor: "#fff", transform: [{ translateY: filterAnim }] },
            ]}
          >
              <View style={styles.sheetHandle} />
              <View style={styles.filterHeader}>
                <Text style={[styles.filterTitle, { color: colors.navy }]}>Filtros</Text>
                <TouchableOpacity onPress={closeFilter}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Market filters */}
              {tab === "market" && (
                <>
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterSectionLabel, { color: colors.navy }]}>Ordenar por</Text>
                    <View style={styles.filterChips}>
                      {([
                        { key: "recente", label: "Mais recente" },
                        { key: "expirando", label: "Expirando logo" },
                        { key: "mais-visualizados", label: "Mais visualizados" },
                      ] as { key: MarketSort; label: string }[]).map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.filterChip, { borderColor: marketFilter.sort === opt.key ? colors.gold : colors.border, backgroundColor: marketFilter.sort === opt.key ? colors.gold + "15" : "#fff" }]}
                          onPress={() => setMarketFilter((f) => ({ ...f, sort: opt.key }))}
                        >
                          <Text style={[styles.filterChipText, { color: marketFilter.sort === opt.key ? colors.gold : colors.foreground, fontWeight: marketFilter.sort === opt.key ? "700" : "400" }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterSectionLabel, { color: colors.navy }]}>Categoria</Text>
                    <View style={styles.filterChips}>
                      {MARKET_CATS.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.filterChip, { borderColor: marketFilter.category === cat ? colors.gold : colors.border, backgroundColor: marketFilter.category === cat ? colors.gold + "15" : "#fff" }]}
                          onPress={() => setMarketFilter((f) => ({ ...f, category: f.category === cat ? null : cat }))}
                        >
                          <Text style={[styles.filterChipText, { color: marketFilter.category === cat ? colors.gold : colors.foreground, fontWeight: marketFilter.category === cat ? "700" : "400" }]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* Vagas filters */}
              {tab === "vagas" && (
                <>
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterSectionLabel, { color: colors.navy }]}>Modalidade</Text>
                    <View style={styles.filterChips}>
                      {MODALIDADES.map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.filterChip, { borderColor: vagasFilter.modalidade === m ? colors.gold : colors.border, backgroundColor: vagasFilter.modalidade === m ? colors.gold + "15" : "#fff" }]}
                          onPress={() => setVagasFilter((f) => ({ ...f, modalidade: f.modalidade === m ? null : m }))}
                        >
                          <Text style={[styles.filterChipText, { color: vagasFilter.modalidade === m ? colors.gold : colors.foreground, fontWeight: vagasFilter.modalidade === m ? "700" : "400" }]}>
                            {m}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterSectionLabel, { color: colors.navy }]}>Tipo de contrato</Text>
                    <View style={styles.filterChips}>
                      {CONTRATOS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.filterChip, { borderColor: vagasFilter.contrato === c ? colors.gold : colors.border, backgroundColor: vagasFilter.contrato === c ? colors.gold + "15" : "#fff" }]}
                          onPress={() => setVagasFilter((f) => ({ ...f, contrato: f.contrato === c ? null : c }))}
                        >
                          <Text style={[styles.filterChipText, { color: vagasFilter.contrato === c ? colors.gold : colors.foreground, fontWeight: vagasFilter.contrato === c ? "700" : "400" }]}>
                            {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* Eventos filters */}
              {tab === "eventos" && (
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionLabel, { color: colors.navy }]}>Tipo de evento</Text>
                  <View style={styles.filterChips}>
                    {EVENTO_TIPOS.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.filterChip, { borderColor: eventosFilter.tipo === t ? colors.gold : colors.border, backgroundColor: eventosFilter.tipo === t ? colors.gold + "15" : "#fff" }]}
                        onPress={() => setEventosFilter((f) => ({ ...f, tipo: f.tipo === t ? null : t }))}
                      >
                        <Text style={[styles.filterChipText, { color: eventosFilter.tipo === t ? colors.gold : colors.foreground, fontWeight: eventosFilter.tipo === t ? "700" : "400" }]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Reset + Apply */}
              <View style={styles.filterActions}>
                <TouchableOpacity
                  style={[styles.filterResetBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setMarketFilter({ sort: "recente", category: null });
                    setVagasFilter({ modalidade: null, contrato: null });
                    setEventosFilter({ tipo: null });
                    closeFilter();
                  }}
                >
                  <Text style={[styles.filterResetText, { color: colors.mutedForeground }]}>Limpar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterApplyBtn, { backgroundColor: colors.gold }]}
                  onPress={closeFilter}
                >
                  <Text style={styles.filterApplyText}>Aplicar</Text>
                </TouchableOpacity>
              </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

function EventoCard({ item, colors, router, past }: { item: AppEvent; colors: ReturnType<typeof useColors>; router: Router; past?: boolean }) {
  const dateStr = new Date(item.start_date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const timeStr = new Date(item.start_date).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });
  const locationStr = item.location_type === "online" ? "Online" : (item.location ?? "");
  const hoje      = isToday(item.start_date);
  const semana    = !hoje && isThisWeek(item.start_date);
  const confirmei = !!item.is_attending;
  const count     = item.attendees_count ?? 0;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: "#fff", borderColor: confirmei ? colors.gold : colors.border, opacity: past ? 0.65 : 1 },
      ]}
      onPress={() => router.push(`/event/${item.id}` as any)}
      activeOpacity={0.75}
    >
      {/* Timing + Confirmei badges */}
      <View style={styles.badgesRow}>
        {hoje && (
          <View style={[styles.badge, { backgroundColor: "#fef9c3" }]}>
            <Text style={[styles.badgeText, { color: "#a16207" }]}>Hoje</Text>
          </View>
        )}
        {semana && (
          <View style={[styles.badge, { backgroundColor: "#ede9fe" }]}>
            <Text style={[styles.badgeText, { color: "#6d28d9" }]}>Esta semana</Text>
          </View>
        )}
        {confirmei && (
          <View style={[styles.badge, { backgroundColor: colors.gold + "22" }]}>
            <Feather name="check-circle" size={11} color={colors.gold} />
            <Text style={[styles.badgeText, { color: colors.gold, marginLeft: 3 }]}>Confirmei</Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: item.entry_type === "gratuito" ? "#dcfce7" : "#fef9c3" }]}>
          <Text style={[styles.badgeText, { color: item.entry_type === "gratuito" ? "#16a34a" : "#a16207" }]}>
            {item.entry_type === "gratuito" ? "Gratuito" : "Pago"}
          </Text>
        </View>
      </View>

      <View style={styles.cardTopRow}>
        <Text style={[styles.cardTitle, { color: colors.navy, flex: 1 }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>

      <View style={styles.eventoMeta}>
        <View style={styles.eventoMetaItem}>
          <Feather name="calendar" size={13} color={colors.mutedForeground} />
          <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>{dateStr}</Text>
        </View>
        <View style={styles.eventoMetaItem}>
          <Feather name="clock" size={13} color={colors.mutedForeground} />
          <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>{timeStr}</Text>
        </View>
      </View>

      {/* Attendees counter + location */}
      <View style={styles.eventoMeta}>
        {count > 0 && (
          <View style={styles.eventoMetaItem}>
            <Feather name="users" size={13} color={colors.mutedForeground} />
            <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]}>
              {count} {count === 1 ? "confirmado" : "confirmados"}
            </Text>
          </View>
        )}
        {locationStr ? (
          <View style={styles.eventoMetaItem}>
            <Feather name={item.location_type === "online" ? "link" : "map-pin"} size={13} color={colors.mutedForeground} />
            <Text style={[styles.eventoMetaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {locationStr}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: "800" },
  criarBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  criarBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  filterBtn: { padding: 10, borderRadius: 10 },
  tabRow: { flexDirection: "row", gap: 8, padding: 12, borderBottomWidth: 1 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  tabBtnText: { fontSize: 13, fontWeight: "600" },
  tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  tabCountText: { fontSize: 11, fontWeight: "700" },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 7 },
  cardCoverImage: { width: "100%", height: 160 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 2 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  cardSeller: { fontSize: 13 },
  cardMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  cardPrice: { fontSize: 18, fontWeight: "800" },
  jobMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  expiryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  expiryText: { fontSize: 12 },
  metaCounter: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaCounterText: { fontSize: 12 },
  savedIcon: { opacity: 1 },
  appliedTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  appliedTagText: { fontSize: 11, fontWeight: "700" },
  salaryText: { fontSize: 13, fontWeight: "700" },
  eventoMeta: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  eventoMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  eventoMetaText: { fontSize: 12 },
  pastHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 4, borderTopWidth: 1, marginTop: 4 },
  pastHeaderText: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyHint: { fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  emptyCTA: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyCTAText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  filterSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 40, gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 4 },
  filterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterTitle: { fontSize: 18, fontWeight: "800" },
  filterSection: { gap: 10 },
  filterSectionLabel: { fontSize: 14, fontWeight: "700" },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterChipText: { fontSize: 13 },
  filterActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  filterResetBtn: { flex: 1, borderWidth: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  filterResetText: { fontSize: 14, fontWeight: "600" },
  filterApplyBtn: { flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  filterApplyText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
