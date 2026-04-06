import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";

const EVENTS: Record<string, {
  title: string; date: string; time: string; endTime: string;
  location: string; capacity: number; attending: number;
  description: string; organizer: string;
}> = {
  e1: {
    title: "Degustação de Vinhos do Vale do São Francisco",
    date: "segunda-feira, 16 de março",
    time: "01:27",
    endTime: "04:27",
    location: "Enoteca Brasileira, Rua Augusta 1200, São Paulo - SP",
    capacity: 30,
    attending: 0,
    description: "Explore os melhores rótulos da região nordestina em uma noite exclusiva com sommelier especializado. Inclui harmonização com queijos artesanais.",
    organizer: "Lucas Lima",
  },
  e2: {
    title: "Masterclass Online: Vinhos de Borgonha",
    date: "segunda-feira, 23 de março",
    time: "01:27",
    endTime: "03:27",
    location: "Online",
    capacity: 50,
    attending: 0,
    description: "Mergulhe no universo dos vinhos de Borgonha com um dos maiores especialistas do Brasil. Aula transmitida ao vivo com certificado de participação.",
    organizer: "Lucas Lima",
  },
};

export default function EventScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [confirmed, setConfirmed] = useState(false);
  const [count, setCount] = useState(0);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const event = EVENTS[id] ?? EVENTS.e1;
  const remaining = event.capacity - count;

  const handleConfirm = () => {
    if (confirmed) {
      setConfirmed(false);
      setCount((c) => Math.max(0, c - 1));
      return;
    }
    setConfirmed(true);
    setCount((c) => c + 1);
    Alert.alert("Presença confirmada!", `Você está confirmado para "${event.title}".`);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `${event.title} — ibhub.app/evento/${id}` });
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Evento</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare}>
          <Feather name="share-2" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Event main info */}
        <Text style={[styles.eventTitle, { color: colors.navy }]}>{event.title}</Text>

        <View style={styles.metaList}>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={16} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.foreground }]}>{event.date}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="clock" size={16} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.foreground }]}>
              {event.time} — {event.endTime}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={16} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.foreground }]}>{event.location}</Text>
          </View>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            { backgroundColor: confirmed ? "#fff" : colors.gold, borderColor: colors.gold, borderWidth: confirmed ? 2 : 0 },
          ]}
          onPress={handleConfirm}
        >
          <Text style={[styles.confirmBtnText, { color: confirmed ? colors.gold : "#fff" }]}>
            {confirmed ? "Presença confirmada ✓" : "Confirmar Presença"}
          </Text>
        </TouchableOpacity>

        {/* Participants */}
        <View style={[styles.participantsCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.participantsRow}>
            <View style={styles.participantsLeft}>
              <Feather name="users" size={16} color={colors.gold} />
              <Text style={[styles.participantsLabel, { color: colors.navy }]}>
                Participantes ({count})
              </Text>
            </View>
            <Text style={[styles.participantsRemaining, { color: colors.mutedForeground }]}>
              {remaining} vagas restantes
            </Text>
          </View>
        </View>

        {/* About */}
        <View style={[styles.aboutCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.aboutTitle, { color: colors.navy }]}>Sobre o Evento</Text>
          <Text style={[styles.aboutText, { color: colors.foreground }]}>{event.description}</Text>
        </View>

        {/* Organizer */}
        <View style={styles.organizerRow}>
          <Text style={[styles.organizerLabel, { color: colors.mutedForeground }]}>Organizado por</Text>
          <View style={styles.organizerInfo}>
            <Avatar name={event.organizer} size={32} />
            <Text style={[styles.organizerName, { color: colors.navy }]}>{event.organizer}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  eventTitle: { fontSize: 22, fontWeight: "800", lineHeight: 30 },
  metaList: { gap: 10 },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  metaText: { fontSize: 14, lineHeight: 20, flex: 1 },
  confirmBtn: { paddingVertical: 16, borderRadius: 10, alignItems: "center" },
  confirmBtnText: { fontSize: 16, fontWeight: "700" },
  participantsCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  participantsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  participantsLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  participantsLabel: { fontSize: 15, fontWeight: "600" },
  participantsRemaining: { fontSize: 13 },
  aboutCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  aboutTitle: { fontSize: 15, fontWeight: "700" },
  aboutText: { fontSize: 14, lineHeight: 20 },
  organizerRow: { gap: 8 },
  organizerLabel: { fontSize: 13 },
  organizerInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  organizerName: { fontSize: 15, fontWeight: "600" },
});
