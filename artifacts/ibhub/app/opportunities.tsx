import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/hooks/useColors";

interface Opportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  type: "emprego" | "freelance" | "parceria";
  salary?: string;
  posted_at: string;
  is_applied: boolean;
  requirements: string[];
}

const MOCK_OPPORTUNITIES: Opportunity[] = [
  { id: "o1", title: "Sommelier Sênior", company: "Hotel Fasano", location: "São Paulo, SP", type: "emprego", salary: "R$ 8.000 – 12.000", posted_at: "2025-04-04", is_applied: false, requirements: ["WSET Level 3", "5+ anos de experiência"] },
  { id: "o2", title: "Consultor de Carta de Vinhos", company: "Restaurante D.O.M.", location: "Remoto", type: "freelance", posted_at: "2025-04-03", is_applied: true, requirements: ["Conhecimento em vinhos naturais", "Disponibilidade imediata"] },
  { id: "o3", title: "Diretor de Importação – Vinhos Europeus", company: "Mistral Importadora", location: "São Paulo, SP", type: "emprego", salary: "R$ 15.000+", posted_at: "2025-04-02", is_applied: false, requirements: ["10+ anos na área", "Fluência em inglês e espanhol"] },
  { id: "o4", title: "Parceria Comercial – Distribuição RS/SC", company: "Vinícola Góes", location: "Sul do Brasil", type: "parceria", posted_at: "2025-04-01", is_applied: false, requirements: ["Rede de contatos no varejo", "Experiência com distribuição"] },
  { id: "o5", title: "Educador de Vinho – Cursos Online", company: "Wine Academy Brasil", location: "Online", type: "emprego", salary: "R$ 5.000 – 7.000", posted_at: "2025-03-30", is_applied: false, requirements: ["WSET Level 4 ou CMS", "Experiência em ensino"] },
];

export default function OpportunitiesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [opps, setOpps] = useState(MOCK_OPPORTUNITIES);
  const [filter, setFilter] = useState("todos");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const FILTERS = ["todos", "emprego", "freelance", "parceria"];

  const filtered = filter === "todos" ? opps : opps.filter((o) => o.type === filter);

  const toggleApply = (id: string) => {
    setOpps((prev) => prev.map((o) => o.id === id ? { ...o, is_applied: !o.is_applied } : o));
  };

  const typeColors: Record<string, "default" | "gold" | "wine" | "success" | "warning"> = {
    emprego: "gold",
    freelance: "success",
    parceria: "wine",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Oportunidades</Text>
        <TouchableOpacity>
          <Feather name="filter" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(f) => f}
        renderItem={({ item: f }) => (
          <Pressable
            style={[styles.filterBtn, { backgroundColor: filter === f ? colors.navy : colors.secondary, borderRadius: 20 }]}
            onPress={() => setFilter(f)}
          >
            <Text style={{ color: filter === f ? colors.gold : colors.foreground, fontSize: 13, fontWeight: "700" }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        )}
        style={{ maxHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        showsHorizontalScrollIndicator={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.cardTop}>
              <View style={styles.cardTitles}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.cardCompany, { color: colors.mutedForeground }]}>
                  {item.company}
                </Text>
              </View>
              <Badge label={item.type} variant={typeColors[item.type] ?? "default"} />
            </View>

            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.location}</Text>
              </View>
              {item.salary && (
                <View style={styles.metaItem}>
                  <Feather name="dollar-sign" size={13} color={colors.gold} />
                  <Text style={[styles.metaText, { color: colors.gold, fontWeight: "700" }]}>{item.salary}</Text>
                </View>
              )}
            </View>

            <View style={styles.requirements}>
              {item.requirements.map((req, i) => (
                <View key={i} style={styles.reqItem}>
                  <View style={[styles.reqDot, { backgroundColor: colors.gold }]} />
                  <Text style={[styles.reqText, { color: colors.foreground }]}>{req}</Text>
                </View>
              ))}
            </View>

            <View style={styles.cardFooter}>
              <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
                {new Date(item.posted_at).toLocaleDateString("pt-BR")}
              </Text>
              <Button
                title={item.is_applied ? "Candidatura enviada" : "Candidatar-se"}
                onPress={() => toggleApply(item.id)}
                variant={item.is_applied ? "outline" : "gold"}
                size="sm"
                disabled={item.is_applied}
              />
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="briefcase" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma oportunidade no momento
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  filterBtn: { paddingVertical: 7, paddingHorizontal: 16 },
  card: { borderWidth: 1, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardTitles: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "800", lineHeight: 22 },
  cardCompany: { fontSize: 13, marginTop: 2 },
  cardMeta: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13 },
  requirements: { gap: 4 },
  reqItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  reqDot: { width: 5, height: 5, borderRadius: 3 },
  reqText: { fontSize: 13 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardDate: { fontSize: 12 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
