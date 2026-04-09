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

type Filter = "todos" | "pessoas" | "publicacoes" | "empresas" | "grupos";

interface PersonResult {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  plan: string;
}

interface PostResult {
  id: string;
  content: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  author?: { id: string; full_name: string | null; avatar_url: string | null };
}

interface GroupResult {
  id: string;
  name: string;
  description: string | null;
  members_count: number;
  category: string | null;
}

interface SearchResults {
  pessoas: PersonResult[];
  publicacoes: PostResult[];
  empresas: PersonResult[];
  grupos: GroupResult[];
}

const FILTERS: { key: Filter; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "todos",      label: "Tudo",     icon: "globe" },
  { key: "pessoas",    label: "Pessoas",  icon: "user" },
  { key: "publicacoes",label: "Posts",    icon: "file-text" },
  { key: "empresas",   label: "Empresas", icon: "briefcase" },
  { key: "grupos",     label: "Grupos",   icon: "users" },
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

const EMPTY: SearchResults = { pessoas: [], publicacoes: [], empresas: [], grupos: [] };

export default function SearchScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const { user } = useAuth();
  const insets  = useSafeAreaInsets();
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
    const term = `%${trimmed}%`;
    const myId = user?.id ?? "";

    try {
      const needPessoas    = f === "todos" || f === "pessoas";
      const needPosts      = f === "todos" || f === "publicacoes";
      const needEmpresas   = f === "todos" || f === "empresas";
      const needGrupos     = f === "todos" || f === "grupos";

      const [resP, resPub, resE, resG] = await Promise.all([
        needPessoas
          ? supabase
              .from("profiles")
              .select("id, full_name, username, avatar_url, headline, plan")
              .or(`full_name.ilike.${term},username.ilike.${term},headline.ilike.${term}`)
              .eq("profile_type", "pessoa")
              .neq("id", myId)
              .limit(f === "todos" ? 5 : 30)
          : Promise.resolve({ data: [] }),

        needPosts
          ? supabase
              .from("posts")
              .select("id, content, created_at, likes_count, comments_count, author:profiles!posts_user_id_fkey(id, full_name, avatar_url)")
              .ilike("content", term)
              .order("created_at", { ascending: false })
              .limit(f === "todos" ? 3 : 20)
          : Promise.resolve({ data: [] }),

        needEmpresas
          ? supabase
              .from("profiles")
              .select("id, full_name, username, avatar_url, headline, plan")
              .or(`full_name.ilike.${term},username.ilike.${term},headline.ilike.${term}`)
              .eq("profile_type", "empresa")
              .limit(f === "todos" ? 5 : 30)
          : Promise.resolve({ data: [] }),

        needGrupos
          ? supabase
              .from("groups")
              .select("id, name, description, members_count, category")
              .or(`name.ilike.${term},description.ilike.${term}`)
              .limit(f === "todos" ? 4 : 20)
          : Promise.resolve({ data: [] }),
      ]);

      setResults({
        pessoas:    (resP.data   ?? []) as PersonResult[],
        publicacoes:(resPub.data ?? []) as PostResult[],
        empresas:   (resE.data   ?? []) as PersonResult[],
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
    results.pessoas.length + results.publicacoes.length +
    results.empresas.length + results.grupos.length;

  const PersonRow = ({ item }: { item: PersonResult }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/profile/${item.id}` as any)}
    >
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
        {item.headline ? (
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.headline}</Text>
        ) : null}
        {item.username ? (
          <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>@{item.username}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  const PostRow = ({ item }: { item: PostResult }) => (
    <TouchableOpacity
      style={[styles.postRow, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/post/${item.id}` as any)}
    >
      <View style={styles.postHeader}>
        <Avatar uri={item.author?.avatar_url ?? null} name={item.author?.full_name ?? "?"} size={30} />
        <Text style={[styles.postAuthor, { color: colors.foreground }]} numberOfLines={1}>
          {item.author?.full_name ?? "Usuário"}
        </Text>
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

  const GroupRow = ({ item }: { item: GroupResult }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.groupIcon, { backgroundColor: colors.navy + "14" }]}>
        <Feather name="users" size={22} color={colors.navy} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
        {item.description ? (
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <Text style={[styles.rowUser, { color: colors.mutedForeground }]}>
          {item.members_count ?? 0} membros{item.category ? ` · ${item.category}` : ""}
        </Text>
      </View>
      <TouchableOpacity style={[styles.joinBtn, { borderColor: colors.navy }]}>
        <Text style={[styles.joinBtnText, { color: colors.navy }]}>Entrar</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const SectionHeader = ({
    label, icon, count, filterKey,
  }: { label: string; icon: keyof typeof Feather.glyphMap; count: number; filterKey: Filter }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Feather name={icon} size={14} color={colors.navy} />
      <Text style={[styles.sectionLabel, { color: colors.navy }]}>{label}</Text>
      <View style={[styles.countBadge, { backgroundColor: colors.gold + "22" }]}>
        <Text style={[styles.countText, { color: colors.gold }]}>{count}</Text>
      </View>
      <TouchableOpacity
        style={styles.seeAllBtn}
        onPress={() => setFilter(filterKey)}
      >
        <Text style={[styles.seeAllText, { color: colors.gold }]}>Ver todos</Text>
        <Feather name="chevron-right" size={13} color={colors.gold} />
      </TouchableOpacity>
    </View>
  );

  const renderGlobal = () => {
    if (!query.trim()) return renderEmpty();
    if (loading) return <ActivityIndicator color={colors.gold} style={{ marginTop: 32 }} />;
    if (totalResults === 0) return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Nenhum resultado</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tente outros termos de busca.</Text>
      </View>
    );

    return (
      <>
        {results.pessoas.length > 0 && (
          <>
            <SectionHeader label="Pessoas" icon="user" count={results.pessoas.length} filterKey="pessoas" />
            {results.pessoas.map(p => <PersonRow key={p.id} item={p} />)}
          </>
        )}
        {results.empresas.length > 0 && (
          <>
            <SectionHeader label="Empresas" icon="briefcase" count={results.empresas.length} filterKey="empresas" />
            {results.empresas.map(p => <PersonRow key={p.id} item={p} />)}
          </>
        )}
        {results.publicacoes.length > 0 && (
          <>
            <SectionHeader label="Publicações" icon="file-text" count={results.publicacoes.length} filterKey="publicacoes" />
            {results.publicacoes.map(p => <PostRow key={p.id} item={p} />)}
          </>
        )}
        {results.grupos.length > 0 && (
          <>
            <SectionHeader label="Grupos" icon="users" count={results.grupos.length} filterKey="grupos" />
            {results.grupos.map(g => <GroupRow key={g.id} item={g} />)}
          </>
        )}
      </>
    );
  };

  const renderFiltered = () => {
    if (!query.trim()) return renderEmpty();
    if (loading) return <ActivityIndicator color={colors.gold} style={{ marginTop: 32 }} />;
    const list =
      filter === "pessoas"     ? results.pessoas    :
      filter === "publicacoes" ? results.publicacoes :
      filter === "empresas"    ? results.empresas   : results.grupos;

    if (list.length === 0) return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Nenhum resultado</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tente outros termos de busca.</Text>
      </View>
    );

    if (filter === "publicacoes") {
      return (results.publicacoes as PostResult[]).map(p => <PostRow key={p.id} item={p} />);
    }
    if (filter === "grupos") {
      return (results.grupos as GroupResult[]).map(g => <GroupRow key={g.id} item={g} />);
    }
    return (list as PersonResult[]).map(p => <PersonRow key={p.id} item={p} />);
  };

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Feather name="search" size={48} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Buscar no ibhub</Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        Pesquise pessoas, publicações, empresas e grupos da indústria do vinho.
      </Text>
    </View>
  );

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
        horizontal
        showsHorizontalScrollIndicator={false}
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
              <Text style={[styles.chipLabel, { color: active ? "#fff" : colors.mutedForeground }]}>
                {f.label}
              </Text>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
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
  planBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  planBadgeText: { fontSize: 10, fontWeight: "800" },
  groupIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
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
