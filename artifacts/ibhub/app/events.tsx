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
import { Feather } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/hooks/useColors";

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  type: "presencial" | "online";
  organizer: string;
  attendees: number;
  is_rsvp: boolean;
  category: string;
}

const MOCK_EVENTS: Event[] = [
  { id: "e1", title: "Degustação Exclusiva Bordeaux 2020", date: "2025-04-15T19:00:00", location: "Hotel Grand Plaza, São Paulo", type: "presencial", organizer: "Clube do Vinho SP", attendees: 48, is_rsvp: false, category: "Degustação" },
  { id: "e2", title: "Masterclass WSET Level 2 - Módulo 3", date: "2025-04-18T18:00:00", location: "Online via Zoom", type: "online", organizer: "Wine Education Brasil", attendees: 120, is_rsvp: true, category: "Educação" },
  { id: "e3", title: "Visita à Vinícola Miolo - Safra 2025", date: "2025-04-25T09:00:00", location: "Vale dos Vinhedos, RS", type: "presencial", organizer: "Enoturismo Brasil", attendees: 22, is_rsvp: false, category: "Enoturismo" },
  { id: "e4", title: "Festival Cerveja Artesanal & Vinho Natural", date: "2025-05-03T14:00:00", location: "Parque Ibirapuera, SP", type: "presencial", organizer: "GastroFest", attendees: 350, is_rsvp: false, category: "Festival" },
  { id: "e5", title: "Webinar: Tendências do Mercado de Vinhos 2025", date: "2025-05-10T10:00:00", location: "Online", type: "online", organizer: "ibhub", attendees: 89, is_rsvp: true, category: "Mercado" },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function EventsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [filter, setFilter] = useState("todos");
  const [loadingRsvpId, setLoadingRsvpId] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const FILTERS = ["todos", "presencial", "online", "meus"];

  const filtered = events.filter((e) => {
    if (filter === "presencial") return e.type === "presencial";
    if (filter === "online") return e.type === "online";
    if (filter === "meus") return e.is_rsvp;
    return true;
  });

  const toggleRSVP = async (id: string) => {
    if (loadingRsvpId) return;
    setLoadingRsvpId(id);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, is_rsvp: !e.is_rsvp, attendees: e.is_rsvp ? e.attendees - 1 : e.attendees + 1 } : e));
    setLoadingRsvpId(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Eventos</Text>
        <TouchableOpacity>
          <Feather name="plus" size={24} color={colors.foreground} />
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, rowGap: 8 }}
        showsHorizontalScrollIndicator={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.dateBox, { backgroundColor: colors.navy }]}>
              <Text style={{ color: colors.gold, fontSize: 22, fontWeight: "900" }}>
                {new Date(item.date).getDate()}
              </Text>
              <Text style={{ color: colors.gold + "aa", fontSize: 11, fontWeight: "600", textTransform: "uppercase" }}>
                {new Date(item.date).toLocaleDateString("pt-BR", { month: "short" })}
              </Text>
            </View>
            <View style={styles.eventInfo}>
              <View style={styles.eventTop}>
                <Badge label={item.category} variant="gold" size="sm" />
                <Badge label={item.type === "online" ? "Online" : "Presencial"} variant={item.type === "online" ? "success" : "default"} size="sm" />
              </View>
              <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.eventMeta}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={[styles.eventMetaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
              <View style={styles.eventMeta}>
                <Feather name="users" size={12} color={colors.mutedForeground} />
                <Text style={[styles.eventMetaText, { color: colors.mutedForeground }]}>
                  {item.attendees} confirmados
                </Text>
              </View>
              <Button
                title={item.is_rsvp ? "Confirmado ✓" : "Confirmar presença"}
                onPress={() => toggleRSVP(item.id)}
                variant={item.is_rsvp ? "outline" : "gold"}
                size="sm"
                loading={loadingRsvpId === item.id}
                disabled={!!loadingRsvpId && loadingRsvpId !== item.id}
                style={{ marginTop: 8, alignSelf: "flex-start" }}
              />
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 16, rowGap: 12, paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="calendar" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum evento encontrado
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
  eventCard: { flexDirection: "row", borderWidth: 1, overflow: "hidden", gap: 0 },
  dateBox: { width: 64, alignItems: "center", justifyContent: "center", gap: 2 },
  eventInfo: { flex: 1, padding: 14, gap: 5 },
  eventTop: { flexDirection: "row", gap: 6 },
  eventTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  eventMetaText: { fontSize: 12, flex: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});
