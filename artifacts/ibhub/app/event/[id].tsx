import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  AppEvent,
  AppEventAttendee,
  cancelAttendance,
  checkAttendance,
  confirmAttendance,
  fetchEventAttendees,
  fetchEventById,
} from "@/services/api";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const entryLabels: Record<string, string> = {
  "gratuito": "Gratuito",
  "pago-externo": "Pago (link externo)",
  "pago-integrado": "Pago",
};

export default function EventScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<AppEvent | null>(null);
  const [attendees, setAttendees] = useState<AppEventAttendee[]>([]);
  const [isAttending, setIsAttending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showAllAttendees, setShowAllAttendees] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const loadData = useCallback(async () => {
    if (!id) return;
    const [ev, att, attending] = await Promise.all([
      fetchEventById(id),
      fetchEventAttendees(id),
      user?.id ? checkAttendance(id, user.id) : Promise.resolve(false),
    ]);
    setEvent(ev);
    setAttendees(att);
    setIsAttending(attending);
    setLoading(false);
    setRefreshing(false);
  }, [id, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const isCreator = !!(user?.id && event?.user_id && user.id === event.user_id);

  const handleRSVP = async () => {
    if (!user?.id || !event) return;
    if (isCreator) return;
    setRsvpLoading(true);
    if (isAttending) {
      const ok = await cancelAttendance(event.id, user.id);
      if (ok) {
        setIsAttending(false);
        setAttendees((prev) => prev.filter((a) => a.user_id !== user.id));
      }
    } else {
      if (event.capacity != null && attendees.length >= event.capacity) {
        Alert.alert("Evento lotado", "Não há mais vagas disponíveis para este evento.");
        setRsvpLoading(false);
        return;
      }
      const organizerId = event.user_id;
      const ok = await confirmAttendance(event.id, user.id, organizerId, event.title);
      if (ok) {
        setIsAttending(true);
        Alert.alert("Presença confirmada!", `Você está confirmado para "${event.title}".`);
        loadData();
      } else {
        Alert.alert("Erro", "Não foi possível confirmar presença. Tente novamente.");
      }
    }
    setRsvpLoading(false);
  };

  const handleShare = async () => {
    if (!event) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "ibhub.app";
    const shareUrl = `https://${domain}/event/${event.id}`;
    const locationStr = event.location_type === "online" ? "Online" : (event.location ?? "");
    try {
      await Share.share({
        message: `${event.title}\n📅 ${fmtDateTime(event.start_date)}\n📍 ${locationStr}\n\n${shareUrl}`,
        url: shareUrl,
        title: event.title,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Feather name="arrow-left" size={22} color={colors.navy} />
            <Text style={[styles.headerTitle, { color: colors.navy }]}>Evento</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Feather name="calendar" size={40} color={colors.mutedForeground} />
          <Text style={[{ color: colors.mutedForeground, fontSize: 16 }]}>Evento não encontrado.</Text>
        </View>
      </View>
    );
  }

  const remaining = event.capacity != null ? event.capacity - attendees.length : null;
  const visibleAttendees = showAllAttendees ? attendees : attendees.slice(0, 5);

  const companyOrg = event.company_organizer;
  const orgName = companyOrg?.name ?? event.organizer?.full_name ?? event.organizer?.username ?? "Organizador";
  const orgAvatar = companyOrg?.avatar_url ?? event.organizer?.avatar_url ?? null;
  const orgHandle = !companyOrg && event.organizer?.username ? `@${event.organizer.username}` : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Evento</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="share-2" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad, rowGap: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* Cover image */}
        {event.image_url ? (
          <Image
            source={{ uri: event.image_url }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : null}

        <View style={{ padding: 16, gap: 14 }}>
          {/* Title + entry badge */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.eventTitle, { color: colors.navy }]}>{event.title}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: event.entry_type === "gratuito" ? "#dcfce7" : "#fef9c3" }]}>
                <Text style={[styles.badgeText, { color: event.entry_type === "gratuito" ? "#16a34a" : "#a16207" }]}>
                  {entryLabels[event.entry_type] ?? event.entry_type}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.background }]}>
                <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                  {event.location_type === "online" ? "🌐 Online" : "📍 Presencial"}
                </Text>
              </View>
            </View>
          </View>

          {/* Meta */}
          <View style={styles.metaList}>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={16} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>
                {fmtDateTime(event.start_date)}
              </Text>
            </View>
            {event.end_date ? (
              <View style={styles.metaRow}>
                <Feather name="clock" size={16} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  Até {fmtTime(event.end_date)}
                </Text>
              </View>
            ) : null}
            {(event.location || event.location_type === "online") ? (
              <View style={styles.metaRow}>
                <Feather name="map-pin" size={16} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {event.location_type === "online" ? "Online" : event.location}
                </Text>
              </View>
            ) : null}
            {event.pay_link ? (
              <View style={styles.metaRow}>
                <Feather name="external-link" size={16} color={colors.gold} />
                <Text style={[styles.metaText, { color: colors.gold }]} numberOfLines={1}>
                  {event.pay_link}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Online link — visible only to confirmed attendees */}
          {event.location_type === "online" && event.link && isAttending ? (
            <TouchableOpacity
              style={[styles.onlineLinkCard, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}
              onPress={() => Linking.openURL(event.link!).catch(() => {})}
              activeOpacity={0.8}
            >
              <Feather name="video" size={18} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#1d4ed8" }}>
                  Link de acesso ao evento
                </Text>
                <Text style={{ fontSize: 12, color: "#3b82f6", marginTop: 2 }} numberOfLines={1}>
                  {event.link}
                </Text>
              </View>
              <Feather name="external-link" size={16} color="#3b82f6" />
            </TouchableOpacity>
          ) : event.location_type === "online" && event.link && !isAttending && !isCreator ? (
            <View style={[styles.onlineLinkCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, color: colors.mutedForeground, flex: 1 }}>
                O link de acesso é disponibilizado após confirmar presença
              </Text>
            </View>
          ) : null}

          {/* RSVP button — hidden for creator */}
          {isCreator ? (
            <View style={[styles.creatorBadge, { backgroundColor: colors.background, borderColor: colors.gold }]}>
              <Feather name="star" size={14} color={colors.gold} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.gold }}>
                Você é o organizador deste evento
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: isAttending ? "#fff" : colors.gold,
                  borderColor: colors.gold,
                  borderWidth: isAttending ? 2 : 0,
                  opacity: rsvpLoading ? 0.7 : 1,
                },
              ]}
              onPress={handleRSVP}
              disabled={rsvpLoading}
            >
              {rsvpLoading ? (
                <ActivityIndicator color={isAttending ? colors.gold : "#fff"} />
              ) : (
                <Text style={[styles.confirmBtnText, { color: isAttending ? colors.gold : "#fff" }]}>
                  {isAttending ? "✓ Presença confirmada — Cancelar" : "Confirmar Presença"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Participants */}
          <View style={[styles.participantsCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.participantsTopRow}>
              <View style={styles.participantsLeft}>
                <Feather name="users" size={16} color={colors.gold} />
                <Text style={[styles.participantsLabel, { color: colors.navy }]}>
                  Participantes ({attendees.length}
                  {event.capacity != null ? `/${event.capacity}` : ""})
                </Text>
              </View>
              {remaining != null && (
                <Text style={[styles.participantsRemaining, { color: remaining > 0 ? colors.mutedForeground : "#dc2626" }]}>
                  {remaining > 0 ? `${remaining} vagas` : "Lotado"}
                </Text>
              )}
            </View>

            {attendees.length === 0 ? (
              <Text style={[styles.noAttendees, { color: colors.mutedForeground }]}>
                Seja o primeiro a confirmar presença!
              </Text>
            ) : (
              <View style={{ gap: 10, marginTop: 10 }}>
                {visibleAttendees.map((att) => {
                  const name = att.profile?.full_name ?? att.profile?.username ?? "Participante";
                  const sub  = att.profile?.position;
                  return (
                    <TouchableOpacity
                      key={att.id}
                      style={styles.attendeeRow}
                      onPress={() => router.push(`/profile/${att.user_id}` as any)}
                      activeOpacity={0.7}
                    >
                      <Avatar uri={att.profile?.avatar_url} name={name} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.attendeeName, { color: colors.navy }]}>{name}</Text>
                        {sub ? (
                          <Text style={[styles.attendeeSub, { color: colors.mutedForeground }]}>{sub}</Text>
                        ) : null}
                      </View>
                      {att.status === "confirmed" ? (
                        <Feather name="check-circle" size={16} color="#16a34a" />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                {attendees.length > 5 && (
                  <TouchableOpacity onPress={() => setShowAllAttendees((v) => !v)} style={styles.showMoreBtn}>
                    <Text style={[styles.showMoreText, { color: colors.gold }]}>
                      {showAllAttendees ? "Ver menos" : `Ver todos (${attendees.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* About */}
          {event.description ? (
            <View style={[styles.aboutCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Text style={[styles.aboutTitle, { color: colors.navy }]}>Sobre o Evento</Text>
              <Text style={[styles.aboutText, { color: colors.foreground }]}>{event.description}</Text>
            </View>
          ) : null}

          {/* Organizer */}
          <View style={styles.organizerRow}>
            <Text style={[styles.organizerLabel, { color: colors.mutedForeground }]}>Organizado por</Text>
            <TouchableOpacity
              style={styles.organizerInfo}
              onPress={() =>
                companyOrg
                  ? router.push(`/company/${companyOrg.id}` as any)
                  : router.push(`/profile/${event.user_id}` as any)
              }
              activeOpacity={0.7}
            >
              <Avatar uri={orgAvatar} name={orgName} size={36} />
              <View>
                <Text style={[styles.organizerName, { color: colors.navy }]}>{orgName}</Text>
                {companyOrg ? (
                  <Text style={[styles.organizerHandle, { color: colors.mutedForeground }]}>Página de empresa</Text>
                ) : orgHandle ? (
                  <Text style={[styles.organizerHandle, { color: colors.mutedForeground }]}>{orgHandle}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
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
  coverImage: { width: "100%", aspectRatio: 16 / 9 },
  eventTitle: { fontSize: 22, fontWeight: "800", lineHeight: 30 },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  metaList: { gap: 10 },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  metaText: { fontSize: 14, lineHeight: 20, flex: 1 },
  onlineLinkCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 10, borderWidth: 1, padding: 12,
  },
  creatorBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, borderWidth: 1.5, padding: 14,
    justifyContent: "center",
  },
  confirmBtn: { paddingVertical: 16, borderRadius: 10, alignItems: "center" },
  confirmBtnText: { fontSize: 16, fontWeight: "700" },
  participantsCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  participantsTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  participantsLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  participantsLabel: { fontSize: 15, fontWeight: "600" },
  participantsRemaining: { fontSize: 13 },
  noAttendees: { fontSize: 13, marginTop: 10, textAlign: "center" },
  attendeeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  attendeeName: { fontSize: 14, fontWeight: "600" },
  attendeeSub: { fontSize: 12, marginTop: 1 },
  showMoreBtn: { paddingVertical: 4, alignItems: "center" },
  showMoreText: { fontSize: 14, fontWeight: "600" },
  aboutCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  aboutTitle: { fontSize: 15, fontWeight: "700" },
  aboutText: { fontSize: 14, lineHeight: 20 },
  organizerRow: { gap: 8 },
  organizerLabel: { fontSize: 13 },
  organizerInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  organizerName: { fontSize: 15, fontWeight: "600" },
  organizerHandle: { fontSize: 12, marginTop: 1 },
});
