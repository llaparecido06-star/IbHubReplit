import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useColors } from "@/hooks/useColors";
import {
  DEFAULT_PREFS,
  PrefKey,
  loadPrefs,
  savePrefs,
} from "@/utils/notificationPrefs";

interface NotifRow {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub: string;
  stateKey: PrefKey;
}

const NOTIF_ROWS: NotifRow[] = [
  { icon: "user-plus",      label: "Novos Seguidores",       sub: "Quando alguém começar a seguir você",    stateKey: "followers" },
  { icon: "message-circle", label: "Mensagens",              sub: "Novas mensagens diretas",                stateKey: "messages" },
  { icon: "briefcase",      label: "Vagas e Oportunidades",  sub: "Novas vagas na sua área",                stateKey: "jobs" },
  { icon: "heart",          label: "Curtidas",               sub: "Quando curtirem suas publicações",       stateKey: "likes" },
  { icon: "message-square", label: "Comentários",            sub: "Novos comentários nas suas publicações", stateKey: "comments" },
  { icon: "at-sign",        label: "Menções",                sub: "Quando alguém mencionar você",           stateKey: "mentions" },
];

type PushStatus = "granted" | "denied" | "undetermined" | "unavailable";

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULT_PREFS);
  const [pushStatus, setPushStatus] = useState<PushStatus>("unavailable");
  const [pushLoading, setPushLoading] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const checkPushStatus = useCallback(async () => {
    if (Platform.OS === "web") {
      setPushStatus("unavailable");
      return;
    }
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPushStatus(status as PushStatus);
    } catch {
      setPushStatus("unavailable");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const saved = await loadPrefs();
        if (active) setPrefs(saved);
        await checkPushStatus();
      })();
      return () => { active = false; };
    }, [checkPushStatus])
  );

  const toggle = async (key: PrefKey) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savePrefs(next);
      return next;
    });
  };

  const handlePushToggle = async () => {
    if (pushStatus === "granted") {
      Linking.openSettings();
      return;
    }
    if (pushStatus === "denied") {
      Linking.openSettings();
      return;
    }
    setPushLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPushStatus(status as PushStatus);
    } catch {
      /* no-op */
    } finally {
      setPushLoading(false);
    }
  };

  const pushGranted = pushStatus === "granted";

  const pushSubText = () => {
    if (Platform.OS === "web") return "Notificações push não estão disponíveis na versão web.";
    if (pushStatus === "denied") return "Permissão bloqueada. Toque para abrir as configurações do sistema.";
    if (pushStatus === "undetermined") return "Toque para ativar notificações push.";
    if (pushStatus === "granted") return "Receba notificações mesmo com o app fechado.";
    return "Receba notificações mesmo com o app fechado.";
  };

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
                {pushSubText()}
              </Text>
              {pushStatus === "denied" && (
                <TouchableOpacity onPress={handlePushToggle}>
                  <Text style={[styles.pushLink, { color: colors.gold }]}>
                    Abrir configurações do sistema
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Switch
              value={pushGranted}
              disabled={Platform.OS === "web" || pushStatus === "unavailable" || pushLoading}
              onValueChange={handlePushToggle}
              trackColor={{ false: colors.border, true: colors.navy }}
              thumbColor="#fff"
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
  pushLink:     { fontSize: 12, marginTop: 4, fontWeight: "600" },
  notifRow:     { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  notifIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  notifLabel:   { fontSize: 15, fontWeight: "600" },
  notifSub:     { fontSize: 12, marginTop: 1 },
});
