import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
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
import { fetchReferralLeaderboard, ReferralRankEntry } from "@/services/api";

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const MEDAL_ICONS  = ["🥇", "🥈", "🥉"];

export default function ReferralRankingScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const [leaderboard, setLeaderboard] = useState<ReferralRankEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = insets.bottom + 24;
  const navy      = (colors as any).navyLight as string ?? colors.navy;

  const load = useCallback(async () => {
    const data = await fetchReferralLeaderboard(100);
    setLeaderboard(data);
    setLoading(false);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => { load(); }, [load]);

  const myEntry = leaderboard.find(e => e.id === user?.id);
  const podium  = leaderboard.slice(0, 3);
  const rest    = leaderboard.slice(3);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: navy, paddingTop: topPad }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Ranking de Convites</Text>
          <Text style={styles.headerSub}>Quem mais trouxe pessoas</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🍇</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nenhum convite ainda
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Compartilhe seu código de convite{"\n"}e apareça no ranking!
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        >
          {/* ── My position (sticky reminder) ── */}
          {myEntry && (
            <View style={[styles.myCard, { backgroundColor: colors.gold + "15", borderColor: colors.gold }]}>
              <View style={styles.myRankBadge}>
                <Text style={[styles.myRankNum, { color: navy }]}>#{myEntry.rank}</Text>
              </View>
              <Avatar uri={myEntry.avatar_url} name={myEntry.full_name} size={38} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.myName, { color: colors.foreground }]}>Você</Text>
                <Text style={[styles.mySub, { color: colors.mutedForeground }]}>
                  {myEntry.invite_count} {myEntry.invite_count === 1 ? "convite" : "convites"}
                </Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: colors.gold }]}>
                <Feather name="users" size={12} color={navy} />
                <Text style={[styles.countBadgeText, { color: navy }]}>{myEntry.invite_count}</Text>
              </View>
            </View>
          )}

          {/* ── Podium (top 3) ── */}
          {podium.length > 0 && (
            <View style={[styles.podiumSection, { backgroundColor: navy }]}>
              <Text style={styles.podiumLabel}>Pódio</Text>
              <View style={styles.podiumRow}>
                {/* Reorder: 2nd, 1st, 3rd */}
                {[podium[1], podium[0], podium[2]].map((entry, visualIdx) => {
                  if (!entry) return <View key={`empty-${visualIdx}`} style={{ flex: 1 }} />;
                  const realIdx = [1, 0, 2][visualIdx];
                  const heights = [70, 100, 55];
                  const barH = heights[visualIdx];
                  const isMe = entry.id === user?.id;

                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.podiumItem}
                      onPress={() => router.push(`/profile/${entry.id}` as any)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.podiumMedal}>{MEDAL_ICONS[realIdx]}</Text>
                      <View style={[styles.podiumAvatarWrap, isMe && { borderColor: colors.gold, borderWidth: 2 }]}>
                        <Avatar uri={entry.avatar_url} name={entry.full_name} size={realIdx === 0 ? 54 : 44} />
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{isMe ? "Você" : entry.full_name.split(" ")[0]}</Text>
                      <Text style={styles.podiumCount}>{entry.invite_count} convites</Text>
                      <View style={[styles.podiumBar, { height: barH, backgroundColor: MEDAL_COLORS[realIdx] + "55" }]}>
                        <Text style={[styles.podiumRank, { color: MEDAL_COLORS[realIdx] }]}>#{entry.rank}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Rest of ranking ── */}
          {rest.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16, rowGap: 10 }}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                Classificação completa
              </Text>
              {rest.map(entry => {
                const isMe = entry.id === user?.id;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={[
                      styles.row,
                      { backgroundColor: isMe ? colors.gold + "12" : colors.card, borderColor: isMe ? colors.gold : colors.border },
                    ]}
                    onPress={() => router.push(`/profile/${entry.id}` as any)}
                    activeOpacity={0.8}
                  >
                    {/* Rank */}
                    <View style={styles.rankNumWrap}>
                      <Text style={[styles.rankNum, { color: colors.mutedForeground }]}>#{entry.rank}</Text>
                    </View>

                    {/* Avatar */}
                    <Avatar uri={entry.avatar_url} name={entry.full_name} size={40} />

                    {/* Info */}
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
                        {isMe ? `${entry.full_name} (você)` : entry.full_name}
                      </Text>
                      {!!entry.headline && (
                        <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {entry.headline}
                        </Text>
                      )}
                    </View>

                    {/* Count */}
                    <View style={[styles.countPill, { backgroundColor: colors.gold + "18" }]}>
                      <Feather name="users" size={11} color={colors.gold} />
                      <Text style={[styles.countPillText, { color: colors.gold }]}>
                        {entry.invite_count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* No ranking yet — user not in list */}
          {!myEntry && leaderboard.length > 0 && (
            <View style={[styles.notYetCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="award" size={20} color={colors.mutedForeground} />
              <Text style={[styles.notYetText, { color: colors.mutedForeground }]}>
                Você ainda não aparece no ranking.{"\n"}
                Compartilhe seu código para começar!
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },

  /* Header */
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12 },
  backBtn:        { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  headerCenter:   { flex: 1, alignItems: "center" },
  headerTitle:    { fontSize: 17, fontWeight: "800", color: "#fff" },
  headerSub:      { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },

  /* My card */
  myCard:         { flexDirection: "row", alignItems: "center", margin: 16, borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 8 },
  myRankBadge:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(201,168,76,0.2)", alignItems: "center", justifyContent: "center" },
  myRankNum:      { fontSize: 14, fontWeight: "900" },
  myName:         { fontSize: 15, fontWeight: "700" },
  mySub:          { fontSize: 12, marginTop: 1 },
  countBadge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  countBadgeText: { fontSize: 13, fontWeight: "800" },

  /* Podium */
  podiumSection:  { paddingTop: 20, paddingBottom: 0, paddingHorizontal: 16 },
  podiumLabel:    { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, textAlign: "center" },
  podiumRow:      { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8 },
  podiumItem:     { flex: 1, alignItems: "center" },
  podiumMedal:    { fontSize: 22, marginBottom: 6 },
  podiumAvatarWrap:{ borderRadius: 30, overflow: "hidden", marginBottom: 6 },
  podiumName:     { fontSize: 12, fontWeight: "700", color: "#fff", marginBottom: 2, maxWidth: 80, textAlign: "center" },
  podiumCount:    { fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 4, textAlign: "center" },
  podiumBar:      { width: "100%", borderRadius: 6, alignItems: "center", justifyContent: "center" },
  podiumRank:     { fontSize: 16, fontWeight: "900", paddingVertical: 8 },

  /* Rest list */
  sectionTitle:   { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  row:            { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  rankNumWrap:    { width: 32, alignItems: "center" },
  rankNum:        { fontSize: 13, fontWeight: "700" },
  rowInfo:        { flex: 1 },
  rowName:        { fontSize: 14, fontWeight: "700" },
  rowSub:         { fontSize: 12, marginTop: 1 },
  countPill:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  countPillText:  { fontSize: 13, fontWeight: "800" },

  /* Not yet */
  notYetCard:     { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, borderWidth: 1, borderRadius: 12, padding: 14 },
  notYetText:     { flex: 1, fontSize: 13, lineHeight: 19 },

  /* Empty */
  emptyTitle:     { fontSize: 18, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  emptySub:       { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
