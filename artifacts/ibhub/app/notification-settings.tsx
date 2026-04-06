import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface NotifRow {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub: string;
  stateKey: string;
}

const NOTIF_ROWS: NotifRow[] = [
  { icon: "user-plus",      label: "Novos Seguidores",       sub: "Quando alguém começar a seguir você",   stateKey: "followers" },
  { icon: "message-circle", label: "Mensagens",              sub: "Novas mensagens diretas",               stateKey: "messages" },
  { icon: "briefcase",      label: "Vagas e Oportunidades",  sub: "Novas vagas na sua área",               stateKey: "jobs" },
  { icon: "heart",          label: "Curtidas",               sub: "Quando curtirem suas publicações",      stateKey: "likes" },
  { icon: "message-square", label: "Comentários",            sub: "Novos comentários nas suas publicações",stateKey: "comments" },
];

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    followers: true, messages: true, jobs: true, likes: true, comments: true,
  });

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const toggle = (key: string) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Notificações</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Push card */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.pushRow}>
            <View style={[styles.pushIcon, { backgroundColor: colors.gold + "18" }]}>
              <Feather name="smartphone" size={22} color={colors.gold} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.pushTitle, { color: colors.navy }]}>Notificações Push</Text>
              <Text style={[styles.pushSub, { color: colors.mutedForeground }]}>
                Receba notificações mesmo com o app fechado
              </Text>
              <Text style={[styles.pushWarning, { color: "#dc2626" }]}>
                Notificações bloqueadas pelo navegador. Ative nas configurações do site.
              </Text>
            </View>
            <Switch
              value={false}
              disabled
              trackColor={{ false: colors.border, true: colors.navy }}
            />
          </View>
        </View>

        {/* Individual toggles */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          {NOTIF_ROWS.map((row, i) => (
            <View
              key={row.stateKey}
              style={[
                styles.notifRow,
                i < NOTIF_ROWS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.notifIcon, { backgroundColor: colors.gold + "18" }]}>
                <Feather name={row.icon} size={16} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifLabel, { color: colors.navy }]}>{row.label}</Text>
                <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>{row.sub}</Text>
              </View>
              <Switch
                value={prefs[row.stateKey]}
                onValueChange={() => toggle(row.stateKey)}
                trackColor={{ false: colors.border, true: colors.navy }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:  { fontSize: 20, fontWeight: "700" },
  card:         { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  pushRow:      { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16 },
  pushIcon:     { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pushTitle:    { fontSize: 15, fontWeight: "700" },
  pushSub:      { fontSize: 12 },
  pushWarning:  { fontSize: 12, marginTop: 4 },
  notifRow:     { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  notifIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  notifLabel:   { fontSize: 15, fontWeight: "600" },
  notifSub:     { fontSize: 12, marginTop: 1 },
});
