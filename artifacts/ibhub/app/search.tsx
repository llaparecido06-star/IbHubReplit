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
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";

type Filter =
  | "todos" | "pessoas" | "publicacoes" | "empresas"
  | "vagas" | "eventos" | "mercado" | "grupos";

interface PersonResult {
  id: string; full_name: string | null; username: string | null;
  avatar_url: string | null; headline: string | null; plan: string;
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
interface MercadoResult {
  id: string; title: string; description: string | null; cover_url: string | null;
}
interface GroupResult {
  id: string; name: string; description: string | null;
  members_count: number; category: string | null;
}

interface SearchResults {
  pessoas: PersonResult[]; publicacoes: PostResult[];
  empresas: PersonResult[]; vagas: VagaResult[];
  eventos: EventResult[]; mercado: MercadoResult[];
  grupos: GroupResult[];
}

const FILTERS: { key: Filter; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "todos",       label: "Tudo",      icon: "globe" },
  { key: "pessoas",     label: "Pessoas",   icon: "user" },
  { key: "publicacoes", label: "Posts",     icon: "file-text" },
  { key: "empresas",    label: "Empresas",  icon: "briefcase" },
  { key: "vagas",       label: "Vagas",     icon: "clipboard" },
  { key: "eventos",     label: "Eventos",   icon: "calendar" },
  { key: "mercado",     label: "Mercado",   icon: "bar-chart-2" },
  { key: "grupos",      label: "Grupos",    icon: "users" },
];

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
  vagas: [], eventos: [], mercado: [], grupos: [],
};

export default function SearchScreen() {
  const colors   = useColors();
  const router   = useRouter();
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query,   setQuery]   = useState("");
  const [filter,  setFilter]  = useState<Filter>("todos");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const runSearch = useCallback(async (q: string, f: Filter) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults(EMPTY); return; }
    setLoading(true);
    const term  = `%${trimmed}%`;
    const myId  = user?.id ?? "";
    const isAll = f === "todos";
    const lim   = (full: number) => (isAll ? Math.ceil(full / 2) : full);

    try {
      const [resP, resPub, resE, resV, resEv, resM, resG] = await Promise.all([
        (isAll || f === "pessoas")
          ? supabase.from("profiles")
              .select("id, full_name, username, avatar_url, headline, plan")
              .or(`full_name.ilike.${term},username.ilike.${term},headline.ilike.${term}`)
              .eq("profile_type", "pessoa").neq("id", myId).limit(lim(30))
          : Promise.resolve({ data: [] }),

        (isAll || f === "publicacoes")
          ? supabase.from("posts")
              .select("id, content, created_at, likes_count, comments_count, author:profiles!posts_user_id_fkey(id, full_name, avatar_url)")
              .ilike("content", term).order("created_at", { ascending: false }).limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "empresas")
          ? supabase.from("profiles")
              .select("id, full_name, username, avatar_url, headline, plan")
              .or(`full_name.ilike.${term},username.ilike.${term},headline.ilike.${term}`)
              .eq("profile_type", "empresa").limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "vagas")
          ? supabase.from("opportunities")
              .select("id, title, description, company, location, contract_type, created_at")
              .or(`title.ilike.${term},description.ilike.${term},company.ilike.${term},category.ilike.${term}`)
              .eq("type", "vaga").eq("is_active", true)
              .order("created_at", { ascending: false }).limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "eventos")
          ? supabase.from("events")
              .select("id, title, description, start_date, location, entry_type")
              .or(`title.ilike.${term},description.ilike.${term},location.ilike.${term}`)
              .eq("is_active", true)
              .order("start_date", { ascending: true }).limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "mercado")
          ? supabase.from("market_presentations")
              .select("id, title, description, cover_url")
              .or(`title.ilike.${term},description.ilike.${term}`)
              .eq("published", true).limit(lim(15))
          : Promise.resolve({ data: [] }),

        (isAll || f === "grupos")
          ? supabase.from("groups")
              .select("id, name, description, members_count, category")
              .or(`name.ilike.${term},description.ilike.${term}`).limit(lim(20))
          : Promise.resolve({ data: [] }),
      ]);

      setResults({
        pessoas:    (resP.data   ?? []) as PersonResult[],
        publicacoes:(resPub.data ?? []) as PostResult[],
        empresas:   (resE.data   ?? []) as PersonResult[],
        vagas:      (resV.data   ?? []) as VagaResult[],
        eventos:    (resEv.data  ?? []) as EventResult[],
        mercado:    (resM.data   ?? []) as MercadoResult[],
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
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const totalResults =
    results.pessoas.length + results.publicacoes.length + results.empresas.length +
    results.vagas.length + results.eventos.length + results.mercado.length + results.grupos.length;

  // ── Row renderers ────────────────────────────────────────────────────────────

  const PersonRow = ({ item }: { item: PersonResult }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/profile/${item.id}` as any)}>
      <Avatar uri={item.avatar_url} name={item.full_name ?? "?"} size={46} />
      <View style={styles.rowBody}>
        <View style={styles.rowNameRow}>
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
            {item.full_name ?? item.username ?? "Usuário"}
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
        <Text style={[styles.postAuthor, { color: colors.foreground }]} numberOfLines={1}>{item.author?.full_name ?? "Usuário"}</Text>
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
            <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>{item.entry_type === "gratuito" ? "Gratuito" : "Pago"}</Text>
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  const MercadoRow = ({ item }: { item: MercadoResult }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: "#10b98118" }]}>
        <Feather name="bar-chart-2" size={20} color="#10b981" />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
        {item.description ? (
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
        ) : null}
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
          {item.members_count ?? 0} membros{item.category ? ` · ${item.category}` : ""}
        </Text>
      </View>
      <TouchableOpacity style={[styles.joinBtn, { borderColor: colors.navy }]}>
        <Text style={[styles.joinBtnText, { color: colors.navy }]}>Entrar</Text>
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
        <Text style={[styles.seeAllText, { color: colors.gold }]}>Ver todos</Text>
        <Feather name="chevron-right" size={13} color={colors.gold} />
      </TouchableOpacity>
    </View>
  );

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Feather name="search" size={48} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Buscar no ibhub</Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        Pesquise pessoas, vagas, eventos, publicações, mercado e muito mais.
      </Text>
    </View>
  );

  const renderNoResults = () => (
    <View style={styles.emptyWrap}>
      <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Nenhum resultado</Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tente outros termos de busca.</Text>
    </View>
  );

  const renderGlobal = () => {
    if (!query.trim()) return renderEmpty();
    if (loading) return <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />;
    if (totalResults === 0) return renderNoResults();

    const sections: JSX.Element[] = [];

    if (results.pessoas.length > 0) {
      sections.push(
        <View key="pessoas">
          <SectionHeader label="Pessoas" icon="user" count={results.pessoas.length} filterKey="pessoas" />
          {results.pessoas.map(p => <PersonRow key={p.id} item={p} />)}
        </View>
      );
    }
    if (results.empresas.length > 0) {
      sections.push(
        <View key="empresas">
          <SectionHeader label="Empresas" icon="briefcase" count={results.empresas.length} filterKey="empresas" />
          {results.empresas.map(p => <PersonRow key={p.id} item={p} />)}
        </View>
      );
    }
    if (results.vagas.length > 0) {
      sections.push(
        <View key="vagas">
          <SectionHeader label="Vagas" icon="clipboard" count={results.vagas.length} filterKey="vagas" />
          {results.vagas.map(v => <VagaRow key={v.id} item={v} />)}
        </View>
      );
    }
    if (results.eventos.length > 0) {
      sections.push(
        <View key="eventos">
          <SectionHeader label="Eventos" icon="calendar" count={results.eventos.length} filterKey="eventos" />
          {results.eventos.map(e => <EventRow key={e.id} item={e} />)}
        </View>
      );
    }
    if (results.mercado.length > 0) {
      sections.push(
        <View key="mercado">
          <SectionHeader label="Mercado" icon="bar-chart-2" count={results.mercado.length} filterKey="mercado" />
          {results.mercado.map(m => <MercadoRow key={m.id} item={m} />)}
        </View>
      );
    }
    if (results.publicacoes.length > 0) {
      sections.push(
        <View key="publicacoes">
          <SectionHeader label="Publicações" icon="file-text" count={results.publicacoes.length} filterKey="publicacoes" />
          {results.publicacoes.map(p => <PostRow key={p.id} item={p} />)}
        </View>
      );
    }
    if (results.grupos.length > 0) {
      sections.push(
        <View key="grupos">
          <SectionHeader label="Grupos" icon="users" count={results.grupos.length} filterKey="grupos" />
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
    if (filter === "mercado")     return results.mercado.length    ? <>{results.mercado.map(m    => <MercadoRow key={m.id} item={m} />)}</> : renderNoResults();
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
            placeholder="Buscar em todo o ibhub..."
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
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
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
