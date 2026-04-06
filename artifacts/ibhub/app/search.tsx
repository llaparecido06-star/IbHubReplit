import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
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
import { UserCard, UserSummary } from "@/components/network/UserCard";
import { useColors } from "@/hooks/useColors";

const PROFILE_TYPES = ["Profissional", "Sommelier", "Produtor", "Importador", "Distribuidor"];
const AREAS = ["Vinhos Tintos","Vinhos Brancos","Espumantes","Vinhos Rosés","Vinificação","Viticultura","Sommellerie","Enologia","Exportação","Importação","Marketing","Vendas"];

const MOCK_USERS: UserSummary[] = [
  { id: "u1", full_name: "Isabela Mondavi",  headline: "Enóloga | Vinhedo Santa Clara",      plan: "business" },
  { id: "u2", full_name: "Rafael Borges",    headline: "Importador de Vinhos Europeus",       plan: "basico"   },
  { id: "u3", full_name: "Carolina Stein",   headline: "Sommelier | Hotel Grand Plaza",       plan: "business" },
  { id: "u4", full_name: "Lucas Lima",       headline: "Produtor | Vinícola Aurora",          plan: "basico"   },
  { id: "u5", full_name: "Julia Benetti",    headline: "Head de marketing na Ideal.BI",       plan: "business" },
];

type SearchTab = "todos" | "pessoas" | "empresas" | "grupos" | "posts";

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery]         = useState("");
  const [tab, setTab]             = useState<SearchTab>("todos");
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [selProfileTypes, setSelProfileTypes] = useState<string[]>([]);
  const [selAreas, setSelAreas]               = useState<string[]>([]);
  const [locInput, setLocInput]               = useState("");
  const [empresaInput, setEmpresaInput]       = useState("");

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const filteredUsers = MOCK_USERS.filter((u) =>
    u.full_name.toLowerCase().includes(query.toLowerCase())
  );

  const TABS: { key: SearchTab; label: string }[] = [
    { key: "todos",    label: "Todos"     },
    { key: "pessoas",  label: "Pessoas"   },
    { key: "empresas", label: "Empresas"  },
    { key: "grupos",   label: "Grupos"    },
    { key: "posts",    label: "Posts"     },
  ];

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, item: string) =>
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);

  const clearFilters = () => { setSelProfileTypes([]); setSelAreas([]); setLocInput(""); setEmpresaInput(""); };

  const filtersActive = selProfileTypes.length > 0 || selAreas.length > 0 || locInput || empresaInput;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <View style={[styles.searchBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar usuários, grupos, publicações..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.filterBtn}>
          <Feather name="sliders" size={20} color={filtersActive ? colors.gold : colors.navy} />
          {filtersActive && <View style={[styles.filterDot, { backgroundColor: colors.gold }]} />}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsWrap, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tab, tab === t.key && [styles.tabActive, { borderBottomColor: colors.gold, backgroundColor: colors.gold }]]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, { color: tab === t.key ? "#fff" : colors.foreground }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Results */}
      {!query && !filtersActive ? (
        <View style={styles.emptyState}>
          <Feather name="search" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Digite para buscar pessoas, grupos ou publicações
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Use os filtros para refinar sua busca
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <UserCard user={item} compact />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="search" size={40} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Nenhum resultado para "{query}"
              </Text>
            </View>
          }
        />
      )}

      {/* Advanced Filters Modal */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={styles.filterOverlay}>
          <View style={[styles.filterModal, { backgroundColor: "#fff" }]}>
            <View style={[styles.filterHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.filterTitle, { color: colors.navy }]}>Filtros Avançados</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.filterBody} showsVerticalScrollIndicator={false}>
              {/* Tipo de Perfil */}
              <Text style={[styles.filterSectionTitle, { color: colors.navy }]}>Tipo de Perfil</Text>
              <View style={styles.chipRow}>
                {PROFILE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterChip, { borderColor: selProfileTypes.includes(t) ? colors.gold : colors.border, backgroundColor: selProfileTypes.includes(t) ? colors.gold + "14" : "#fff" }]}
                    onPress={() => toggleItem(selProfileTypes, setSelProfileTypes, t)}
                  >
                    <Text style={[styles.filterChipText, { color: selProfileTypes.includes(t) ? colors.gold : colors.foreground }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Área de Atuação */}
              <Text style={[styles.filterSectionTitle, { color: colors.navy }]}>Área de Atuação</Text>
              <View style={styles.chipRow}>
                {AREAS.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.filterChip, { borderColor: selAreas.includes(a) ? colors.gold : colors.border, backgroundColor: selAreas.includes(a) ? colors.gold + "14" : "#fff" }]}
                    onPress={() => toggleItem(selAreas, setSelAreas, a)}
                  >
                    <Text style={[styles.filterChipText, { color: selAreas.includes(a) ? colors.gold : colors.foreground }]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Localização */}
              <Text style={[styles.filterSectionTitle, { color: colors.navy }]}>Localização</Text>
              <TextInput
                style={[styles.filterInput, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Ex: São Paulo, Portugal..."
                placeholderTextColor={colors.mutedForeground}
                value={locInput}
                onChangeText={setLocInput}
              />

              {/* Empresa */}
              <Text style={[styles.filterSectionTitle, { color: colors.navy }]}>Empresa</Text>
              <TextInput
                style={[styles.filterInput, { borderColor: colors.border, color: colors.foreground }]}
                placeholder="Ex: Vinícola Aurora..."
                placeholderTextColor={colors.mutedForeground}
                value={empresaInput}
                onChangeText={setEmpresaInput}
              />
            </ScrollView>

            <View style={[styles.filterFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[styles.clearBtn, { borderColor: colors.border }]} onPress={clearFilters}>
                <Text style={[styles.clearBtnText, { color: colors.foreground }]}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.navy }]} onPress={() => setShowFilters(false)}>
                <Text style={styles.applyBtnText}>Aplicar Filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn:            { padding: 4 },
  searchBox:          { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput:        { flex: 1, fontSize: 14 },
  filterBtn:          { padding: 4, position: "relative" },
  filterDot:          { position: "absolute", top: 2, right: 2, width: 7, height: 7, borderRadius: 4 },
  tabsWrap:           { borderBottomWidth: 1 },
  tabsScroll:         { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  tab:                { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 0 },
  tabActive:          {},
  tabText:            { fontSize: 13, fontWeight: "600" },
  emptyState:         { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyTitle:         { fontSize: 15, fontWeight: "600", textAlign: "center" },
  emptySub:           { fontSize: 13, textAlign: "center" },
  filterOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  filterModal:        { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", overflow: "hidden" },
  filterHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  filterTitle:        { fontSize: 17, fontWeight: "700" },
  filterBody:         { padding: 20, gap: 12 },
  filterSectionTitle: { fontSize: 15, fontWeight: "700" },
  chipRow:            { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip:         { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  filterChipText:     { fontSize: 13 },
  filterInput:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  filterFooter:       { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1 },
  clearBtn:           { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  clearBtnText:       { fontSize: 15, fontWeight: "600" },
  applyBtn:           { flex: 2, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  applyBtnText:       { color: "#fff", fontSize: 15, fontWeight: "700" },
});
