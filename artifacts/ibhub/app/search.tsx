import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
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

type Category = "pessoas" | "publicacoes" | "empresas" | "grupos";

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

type SearchResults = {
  pessoas: PersonResult[];
  publicacoes: PostResult[];
  empresas: PersonResult[];
  grupos: GroupResult[];
};

const CATEGORIES: { key: Category; label: string; icon: any }[] = [
  { key: "pessoas",     label: "Pessoas",     icon: "user" },
  { key: "publicacoes", label: "Posts",        icon: "file-text" },
  { key: "empresas",    label: "Empresas",    icon: "briefcase" },
  { key: "grupos",      label: "Grupos",      icon: "users" },
];

const PLAN_LABELS: Record<string, string> = {
  business:  "Pro",
  exclusive: "Exclusivo",
  premium:   "Premium",
  basico:    "",
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

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery]       = useState("");
  const [category, setCategory] = useState<Category>("pessoas");
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<SearchResults>({
    pessoas: [], publicacoes: [], empresas: [], grupos: [],
  });

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const search = useCallback(async (q: string, cat: Category) => {
    if (!q.trim()) {
      setResults({ pessoas: [], publicacoes: [], empresas: [], grupos: [] });
      return;
    }
    setLoading(true);
    const term = `%${q.trim()}%`;

    try {
      if (cat === "pessoas") {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, headline, plan")
          .or(`full_name.ilike.${term},username.ilike.${term},headline.ilike.${term}`)
          .neq("id", user?.id ?? "")
          .limit(30);
        setResults(prev => ({ ...prev, pessoas: (data ?? []) as PersonResult[] }));

      } else if (cat === "publicacoes") {
        const { data } = await supabase
          .from("posts")
          .select("id, content, created_at, likes_count, comments_count, author:profiles!posts_user_id_fkey(id, full_name, avatar_url)")
          .ilike("content", term)
          .order("created_at", { ascending: false })
          .limit(20);
        setResults(prev => ({ ...prev, publicacoes: (data ?? []) as any[] }));

      } else if (cat === "empresas") {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, headline, plan")
          .or(`full_name.ilike.${term},headline.ilike.${term}`)
          .in("plan", ["business", "premium", "exclusive"])
          .limit(20);
        setResults(prev => ({ ...prev, empresas: (data ?? []) as PersonResult[] }));

      } else if (cat === "grupos") {
        const { data } = await supabase
          .from("groups")
          .select("id, name, description, members_count, category")
          .or(`name.ilike.${term},description.ilike.${term}`)
          .limit(20);
        setResults(prev => ({ ...prev, grupos: (data ?? []) as GroupResult[] }));
      }
    } catch {}

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => search(query, category), 400);
    return () => clearTimeout(timer);
  }, [query, category, search]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const currentResults: any[] = results[category];

  const renderPerson = ({ item }: { item: PersonResult }) => (
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
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.headline}
          </Text>
        ) : null}
        {item.username ? (
          <Text style={[styles.rowUsername, { color: colors.mutedForeground }]}>@{item.username}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  const renderPost = ({ item }: { item: PostResult }) => (
    <TouchableOpacity
      style={[styles.postRow, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/post/${item.id}` as any)}
    >
      <View style={styles.postRowHeader}>
        <Avatar uri={item.author?.avatar_url} name={item.author?.full_name ?? "?"} size={32} />
        <Text style={[styles.postAuthorName, { color: colors.foreground }]} numberOfLines={1}>
          {item.author?.full_name ?? "Usuário"}
        </Text>
        <Text style={[styles.postTime, { color: colors.mutedForeground }]}>· {timeAgo(item.created_at)}</Text>
      </View>
      <Text style={[styles.postContent, { color: colors.foreground }]} numberOfLines={3}>
        {item.content}
      </Text>
      <View style={styles.postStats}>
        <Feather name="heart" size={13} color={colors.mutedForeground} />
        <Text style={[styles.statText, { color: colors.mutedForeground }]}>{item.likes_count}</Text>
        <Feather name="message-circle" size={13} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
        <Text style={[styles.statText, { color: colors.mutedForeground }]}>{item.comments_count}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderGroup = ({ item }: { item: GroupResult }) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.groupIcon, { backgroundColor: colors.navy + "14" }]}>
        <Feather name="users" size={22} color={colors.navy} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
        {item.description ? (
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <Text style={[styles.rowUsername, { color: colors.mutedForeground }]}>
          {item.members_count ?? 0} membros{item.category ? ` · ${item.category}` : ""}
        </Text>
      </View>
      <TouchableOpacity style={[styles.joinBtn, { borderColor: colors.navy }]}>
        <Text style={[styles.joinBtnText, { color: colors.navy }]}>Entrar</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderItem = (info: any) => {
    if (category === "pessoas" || category === "empresas") return renderPerson(info);
    if (category === "publicacoes") return renderPost(info);
    return renderGroup(info);
  };

  const renderEmpty = () => {
    if (loading) return null;
    if (!query.trim()) {
      return (
        <View style={styles.emptyWrap}>
          <Feather name="search" size={44} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Buscar no ibhub</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Pesquise pessoas, publicações, empresas e grupos da indústria do vinho.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Nenhum resultado</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tente outros termos de busca.</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with search input */}
      <View style={[styles.searchHeader, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Buscar pessoas, publicações..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x-circle" size={17} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.tab,
              category === cat.key && { borderBottomColor: colors.gold },
            ]}
            onPress={() => setCategory(cat.key)}
          >
            <Feather
              name={cat.icon}
              size={14}
              color={category === cat.key ? colors.gold : colors.mutedForeground}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: category === cat.key ? colors.gold : colors.mutedForeground },
                category === cat.key && { fontWeight: "700" },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={colors.gold} />
        </View>
      )}

      <FlatList
        style={{ flex: 1 }}
        data={currentResults}
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={currentResults.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 11,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 12, fontWeight: "500" },
  loadingBar: { paddingVertical: 10, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowBody: { flex: 1, gap: 2 },
  rowNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: { fontSize: 15, fontWeight: "700", flex: 1 },
  rowSub: { fontSize: 12.5 },
  rowUsername: { fontSize: 12 },
  planBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  planBadgeText: { fontSize: 10, fontWeight: "800" },
  groupIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  joinBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  joinBtnText: { fontSize: 12, fontWeight: "700" },
  postRow: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  postRowHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  postAuthorName: { fontSize: 13, fontWeight: "700", flex: 1 },
  postTime: { fontSize: 12 },
  postContent: { fontSize: 14, lineHeight: 20 },
  postStats: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 },
  statText: { fontSize: 12, marginRight: 4 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
