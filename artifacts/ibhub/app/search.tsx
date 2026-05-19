import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import { fetchProfilesForIds } from "@/services/api";
import { useTranslation } from "react-i18next";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

type Filter =
  | "todos" | "pessoas" | "publicacoes" | "empresas"
  | "vagas" | "eventos" | "grupos";

interface PersonResult {
  id: string; full_name: string | null; username: string | null;
  avatar_url: string | null; headline: string | null; plan: string;
  kind?: "profile" | "company_page";
}
interface PostResult {
  id: string; content: string; created_at: string;
  likes_count: number; comments_count: number;
  author?: { id: string; full_name: string | null; avatar_url: string | null };
}
interface EventResult {
  id: string; title: string; description: string | null;
  start_date: string; location: string | null; entry_type: string;
}
interface VagaResult {
  id: string; title: string; description: string | null;
  company: string | null; location: string | null;
  contract_type: string | null; created_at: string;
}
interface GroupResult {
  id: string; name: string; description: string | null;
  members_count: number; category: string | null;
}

interface SearchResults {
  pessoas: PersonResult[]; publicacoes: PostResult[];
  empresas: PersonResult[]; vagas: VagaResult[];
  eventos: EventResult[]; grupos: GroupResult[];
}

const PLAN_LABELS: Record<string, string> = {
  business: "Pro", exclusive: "Exclusivo", premium: "Premium",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const EMPTY: SearchResults = {
  pessoas: [], publicacoes: [], empresas: [],
  vagas: [], eventos: [], grupos: [],
};

export default function SearchScreen() {
  const colors   = useColors();
  const router   = useRouter();
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { t } = useTranslation();

  const [query,   setQuery]   = useState("");
  const [filter,  setFilter]  = useState<Filter>("todos");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const FILTERS: { key: Filter; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "todos",       label: t("search.filters.all"),       icon: "globe" },
    { key: "pessoas",     label: t("search.filters.people"),    icon: "user" },
    { key: "publicacoes", label: t("search.filters.posts"),     icon: "file-text" },
    { key: "empresas",    label: t("search.filters.companies"), icon: "briefcase" },
    { key: "vagas",       label: t("search.filters.jobs"),      icon: "clipboard" },
    { key: "eventos",     label: t("search.filters.events"),    icon: "calendar" },
    { key: "grupos",      label: t("search.filters.groups"),    icon: "users" },
  ];

  const runSearch = useCallback(async (q: string, f: Filter) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults(EMPTY); return; }
    setLoading(true);
    const myId  = user?.id ?? "";
    const isAll = f === "todos";
    const lim   = (full: number) => (isAll ? Math.ceil(full / 2) : full);

    try {
      // Authoritative post search: call API server so shadowban is enforced server-side.
      const searchPostsViaApi = async (): Promise<{ data: any[] }> => {
        if (!trimmed) return { data: [] };
        const session = (await supabase.auth.getSession()).data.session;
        if (!session?.access_token) return { data: [] };
        const params = new URLSearchParams({ q: trimmed, limit: String(lim(20)) });
        const res = await fetch(`${API_URL}/search/posts?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return { data: [] };
        const { posts: rawPosts } = await res.json() as { posts: any[] };
        if (!rawPosts?.length) return { data: [] };
        const userIds = [...new Set(rawPosts.map((p: any) => p.user_id as string).filter(Boolean))];
        const profileMap = await fetchProfilesForIds(userIds);
        const enriched = rawPosts.map((p: any) => {
          const profile = p.user_id ? profileMap.get(p.user_id) : undefined;
          return { ...p, author: profile ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url } : null };
        });
        return { data: enriched };
      };

      const [resP, resPub, resE, resCP, resV, resEv, resG] = await Promise.all([
        (isAll || f === "pessoas")
          ? supabase.from("profiles")
              .select("id, full_name, username, avatar_url, headline, plan")
              .or(`full_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%,headline.ilike.%${trimmed}%`)
              .eq("profile_type", "pessoa").neq("id", myId).limit(lim(30))
          : Promise.resolve({ data: [] }),

        (isAll || f === "publicacoes") ? searchPostsViaApi() : Promise.resolve({ data: [] }),

        (isAll || f === "empresas")
          ? supabase.from("profiles")
              .select("id, full_name, username, avatar_url, headline, plan")
              .or(`full_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%,headline.ilike.%${trimmed}%`)
              .eq("profile_type", "empresa").limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "empresas")
          ? supabase.from("company_pages")
              .select("id, name, avatar_url, industry")
              .ilike("name", `%${trimmed}%`).limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "vagas")
          ? supabase.from("opportunities")
              .select("id, title, description, company, location, contract_type, created_at")
              .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%,company.ilike.%${trimmed}%,category.ilike.%${trimmed}%`)
              .eq("type", "vaga").eq("is_active", true)
              .order("created_at", { ascending: false }).limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "eventos")
          ? supabase.from("events")
              .select("id, title, description, start_date, location, entry_type")
              .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%,location.ilike.%${trimmed}%`)
              .eq("is_active", true)
              .order("start_date", { ascending: true }).limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "grupos")
          ? supabase.from("groups")
              .select("id, name, description, members_count, category")
              .or(`name.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
              .neq("access", "restrito")
              .limit(lim(20))
          : Promise.resolve({ data: [] }),
      ]);

      const mappedPosts: PostResult[] = (resPub.data ?? []).map((p: any) => ({
        id: p.id,
        content: p.content,
        created_at: p.created_at,
        likes_count: p.likes_count,
        comments_count: p.comments_count,
        author: Array.isArray(p.author) ? p.author[0] : p.author,
      }));

      const profileEmpresas: PersonResult[] = ((resE.data ?? []) as any[]).map(p => ({
        id: p.id,
        full_name: p.full_name ?? null,
        username: p.username ?? null,
        avatar_url: p.avatar_url ?? null,
        headline: p.headline ?? null,
        plan: p.plan ?? "",
        kind: "profile",
      }));
      const companyPages: PersonResult[] = ((resCP.data ?? []) as any[]).map(c => ({
        id: c.id,
        full_name: c.name ?? null,
        username: null,
        avatar_url: c.avatar_url ?? null,
        headline: c.industry ?? null,
        plan: "",
        kind: "company_page",
      }));
      const seenIds = new Set<string>();
      const mergedEmpresas = [...companyPages, ...profileEmpresas].filter(e => {
        if (seenIds.has(e.id)) return false;
        seenIds.add(e.id);
        return true;
      });

      setResults({
        pessoas:    (resP.data   ?? []) as PersonResult[],
        publicacoes: mappedPosts,
        empresas:   mergedEmpresas,
        vagas:      (resV.data   ?? []) as VagaResult[],
        eventos:    (resEv.data  ?? []) as EventResult[],
        grupos:     (resG.data   ?? []) as GroupResult[],
      });
    } catch {}

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query, filter), 350);
    return () => clearTimeout(t);
  }, [query, filter, runSearch]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, []);

  const totalResults =
    results.pessoas.length + results.publicacoes.length + results.empresas.length +
    results.vagas.length + results.eventos.length + results.grupos.length;

  // ── Row renderers ────────────────────────────────────────────────────────────

  const PersonRow = ({ item }: { item: PersonResult }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => router.push(
        (item.kind === "company_page" ? `/empresa/${item.id}` : `/profile/${item.id}`) as any,
      )}>
      <Avatar uri={item.avatar_url} name={item.full_name ?? "?"} size={46} />
      <View style={styles.rowBody}>
        <View style={styles.rowNameRow}>
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
            {item.full_name ?? item.username ?? t("common.user_fallback")}
          </Text>
          {PLAN_LABELS[item.plan] ? (
            <View style={[styles.planBadge, { backgroundColor: colors.gold + "18", borderColor: colors.gold + "60" }]}>
              <Text style={[styles.planBadgeText, { color: colors.gold }]}>{PLAN_LABELS[item.plan]}</Text>
            </View>
          ) : null}
        </View>
        {item.headline ? <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.headline}</Text> : null}
        {item.username ? <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>@{item.username}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  const PostRow = ({ item }: { item: PostResult }) => (
    <TouchableOpacity style={[styles.postRow, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/post/${item.id}` as any)}>
      <View style={styles.postHeader}>
        <Avatar uri={item.author?.avatar_url ?? null} name={item.author?.full_name ?? "?"} size={30} />
        <Text style={[styles.postAuthor, { color: colors.foreground }]} numberOfLines={1}>{item.author?.full_name ?? t("common.user_fallback")}</Text>
        <Text style={[styles.postTime, { color: colors.mutedForeground }]}>· {timeAgo(item.created_at)}</Text>
      </View>
      <Text style={[styles.postContent, { color: colors.foreground }]} numberOfLines={3}>{item.content}</Text>
      <View style={styles.postStats}>
        <Feather name="heart" size={13} color={colors.mutedForeground} />
        <Text style={[styles.statText, { color: colors.mutedForeground }]}>{item.likes_count}</Text>
        <Feather name="message-circle" size={13} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
        <Text style={[styles.statText, { color: colors.mutedForeground }]}>{item.comments_count}</Text>
      </View>
    </TouchableOpacity>
  );

  const VagaRow = ({ item }: { item: VagaResult }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/opportunity/${item.id}` as any)}>
      <View style={[styles.iconCircle, { backgroundColor: "#f59e0b18" }]}>
        <Feather name="clipboard" size={20} color="#f59e0b" />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
        {item.company ? <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.company}</Text> : null}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {item.location ? (
            <View style={styles.tagRow}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>{item.location}</Text>
            </View>
          ) : null}
          {item.contract_type ? (
            <View style={styles.tagRow}>
              <Feather name="clock" size={11} color={colors.mutedForeground} />
              <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>{item.contract_type}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  const EventRow = ({ item }: { item: EventResult }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/event/${item.id}` as any)}>
      <View style={[styles.iconCircle, { backgroundColor: colors.navy + "14" }]}>
        <Feather name="calendar" size={20} color={colors.navy} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {item.start_date ? (
            <View style={styles.tagRow}>
              <Feather name="clock" size={11} color={colors.mutedForeground} />
              <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>{fmtDate(item.start_date)}</Text>
            </View>
          ) : null}
          {item.location ? (
            <View style={styles.tagRow}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>{item.location}</Text>
            </View>
          ) : null}
          <View style={styles.tagRow}>
            <Feather name="tag" size={11} color={colors.mutedForeground} />
            <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>{item.entry_type === "gratuito" ? t("common.free") : t("common.paid")}</Text>
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  const GroupRow = ({ item }: { item: GroupResult }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.navy + "14" }]}>
        <Feather name="users" size={20} color={colors.navy} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
        {item.description ? <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.description}</Text> : null}
        <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>
          {item.members_count ?? 0} {t("common.members")}{item.category ? ` · ${item.category}` : ""}
        </Text>
      </View>
      <TouchableOpacity style={[styles.joinBtn, { borderColor: colors.navy }]}>
        <Text style={[styles.joinBtnText, { color: colors.navy }]}>{t("common.join")}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ── Section header ───────────────────────────────────────────────────────────

  const SectionHeader = ({ label, icon, count, filterKey }: {
    label: string; icon: keyof typeof Feather.glyphMap; count: number; filterKey: Filter;
  }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Feather name={icon} size={14} color={colors.navy} />
      <Text style={[styles.sectionLabel, { color: colors.navy }]}>{label}</Text>
      <View style={[styles.countBadge, { backgroundColor: colors.gold + "22" }]}>
        <Text style={[styles.countText, { color: colors.gold }]}>{count}</Text>
      </View>
      <TouchableOpacity style={styles.seeAllBtn} onPress={() => setFilter(filterKey)}>
        <Text style={[styles.seeAllText, { color: colors.gold }]}>{t("common.see_all_label")}</Text>
        <Feather name="chevron-right" size={13} color={colors.gold} />
      </TouchableOpacity>
    </View>
  );

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Feather name="search" size={48} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>{t("search.empty_title")}</Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        {t("search.empty_sub")}
      </Text>
    </View>
  );

  const renderNoResults = () => (
    <View style={styles.emptyWrap}>
      <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>{t("search.no_results")}</Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{t("search.no_results_sub")}</Text>
    </View>
  );

  const renderGlobal = () => {
    if (!query.trim()) return renderEmpty();
    if (loading) return <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />;
    if (totalResults === 0) return renderNoResults();

    const sections: React.ReactElement[] = [];

    if (results.pessoas.length > 0) {
      sections.push(
        <View key="pessoas">
          <SectionHeader label={t("search.filters.people")} icon="user" count={results.pessoas.length} filterKey="pessoas" />
          {results.pessoas.map(p => <PersonRow key={p.id} item={p} />)}
        </View>
      );
    }
    if (results.empresas.length > 0) {
      sections.push(
        <View key="empresas">
          <SectionHeader label={t("search.filters.companies")} icon="briefcase" count={results.empresas.length} filterKey="empresas" />
          {results.empresas.map(p => <PersonRow key={p.id} item={p} />)}
        </View>
      );
    }
    if (results.vagas.length > 0) {
      sections.push(
        <View key="vagas">
          <SectionHeader label={t("search.filters.jobs")} icon="clipboard" count={results.vagas.length} filterKey="vagas" />
          {results.vagas.map(v => <VagaRow key={v.id} item={v} />)}
        </View>
      );
    }
    if (results.eventos.length > 0) {
      sections.push(
        <View key="eventos">
          <SectionHeader label={t("search.filters.events")} icon="calendar" count={results.eventos.length} filterKey="eventos" />
          {results.eventos.map(e => <EventRow key={e.id} item={e} />)}
        </View>
      );
    }
    if (results.publicacoes.length > 0) {
      sections.push(
        <View key="publicacoes">
          <SectionHeader label={t("search.filters.posts")} icon="file-text" count={results.publicacoes.length} filterKey="publicacoes" />
          {results.publicacoes.map(p => <PostRow key={p.id} item={p} />)}
        </View>
      );
    }
    if (results.grupos.length > 0) {
      sections.push(
        <View key="grupos">
          <SectionHeader label={t("search.filters.groups")} icon="users" count={results.grupos.length} filterKey="grupos" />
          {results.grupos.map(g => <GroupRow key={g.id} item={g} />)}
        </View>
      );
    }

    return <>{sections}</>;
  };

  const renderFiltered = () => {
    if (!query.trim()) return renderEmpty();
    if (loading) return <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />;

    if (filter === "pessoas")     return results.pessoas.length    ? <>{results.pessoas.map(p    => <PersonRow  key={p.id} item={p} />)}</> : renderNoResults();
    if (filter === "empresas")    return results.empresas.length   ? <>{results.empresas.map(p   => <PersonRow  key={p.id} item={p} />)}</> : renderNoResults();
    if (filter === "publicacoes") return results.publicacoes.length? <>{results.publicacoes.map(p => <PostRow   key={p.id} item={p} />)}</> : renderNoResults();
    if (filter === "vagas")       return results.vagas.length      ? <>{results.vagas.map(v      => <VagaRow   key={v.id} item={v} />)}</> : renderNoResults();
    if (filter === "eventos")     return results.eventos.length    ? <>{results.eventos.map(e    => <EventRow  key={e.id} item={e} />)}</> : renderNoResults();
    if (filter === "grupos")      return results.grupos.length     ? <>{results.grupos.map(g     => <GroupRow  key={g.id} item={g} />)}</> : renderNoResults();
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder={t("search.placeholder")}
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setResults(EMPTY); }}>
              <Feather name="x-circle" size={17} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        {loading && <ActivityIndicator size="small" color={colors.gold} />}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={[styles.filtersBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, rowGap: 8 }}
      >
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.navy, borderColor: colors.navy }
                  : { backgroundColor: "transparent", borderColor: colors.border },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Feather name={f.icon} size={13} color={active ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.chipLabel, { color: active ? "#fff" : colors.mutedForeground }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results */}
      <ScrollView
        style={{ flex: 1 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
      >
        {filter === "todos" ? renderGlobal() : renderFiltered()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingBottom: 10, gap: 8, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  inputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 8, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15 },
  filtersBar: { borderBottomWidth: 1, flexGrow: 0 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5,
  },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", flex: 1 },
  countBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  countText: { fontSize: 11, fontWeight: "800" },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 12, fontWeight: "600" },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  rowBody: { flex: 1, gap: 2 },
  rowNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: { fontSize: 15, fontWeight: "700", flex: 1 },
  rowSub: { fontSize: 12.5 },
  rowUser: { fontSize: 12 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  planBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  planBadgeText: { fontSize: 10, fontWeight: "800" },
  iconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  joinBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  joinBtnText: { fontSize: 12, fontWeight: "700" },
  postRow: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  postAuthor: { fontSize: 13, fontWeight: "700", flex: 1 },
  postTime: { fontSize: 12 },
  postContent: { fontSize: 14, lineHeight: 20 },
  postStats: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 },
  statText: { fontSize: 12, marginRight: 4 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
