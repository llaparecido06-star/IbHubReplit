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
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import * as Notifications from "@/utils/safeNotifications";
import { useColors } from "@/hooks/useColors";
import {
  DEFAULT_PREFS,
  PrefKey,
  loadPrefs,
  savePrefs,
} from "@/utils/notificationPrefs";

type PushStatus = "granted" | "denied" | "undetermined" | "unavailable";

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULT_PREFS);
  const [pushStatus, setPushStatus] = useState<PushStatus>("unavailable");
  const [pushLoading, setPushLoading] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const NOTIF_ROWS: { icon: keyof typeof Feather.glyphMap; label: string; sub: string; stateKey: PrefKey }[] = [
    { icon: "user-plus",      label: t("notification_settings.rows.followers"),  sub: t("notification_settings.rows.followers_sub"),  stateKey: "followers" },
    { icon: "message-circle", label: t("notification_settings.rows.messages"),   sub: t("notification_settings.rows.messages_sub"),   stateKey: "messages" },
    { icon: "briefcase",      label: t("notification_settings.rows.jobs"),       sub: t("notification_settings.rows.jobs_sub"),       stateKey: "jobs" },
    { icon: "heart",          label: t("notification_settings.rows.likes"),      sub: t("notification_settings.rows.likes_sub"),      stateKey: "likes" },
    { icon: "message-square", label: t("notification_settings.rows.comments"),   sub: t("notification_settings.rows.comments_sub"),   stateKey: "comments" },
    { icon: "at-sign",        label: t("notification_settings.rows.mentions"),   sub: t("notification_settings.rows.mentions_sub"),   stateKey: "mentions" },
  ];

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
    if (pushStatus === "granted" || pushStatus === "denied") {
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
    if (Platform.OS === "web") return t("notification_settings.push_unavailable");
    if (pushStatus === "denied") return t("notification_settings.push_disabled");
    if (pushStatus === "granted") return t("notification_settings.push_enabled");
    return t("notification_settings.push_disabled");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("notification_settings.title")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.pushRow}>
            <View style={[styles.pushIcon, { backgroundColor: colors.gold + "18" }]}>
              <Feather name="smartphone" size={22} color={colors.gold} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.pushTitle, { color: colors.navy }]}>{t("notification_settings.title")}</Text>
              <Text style={[styles.pushSub, { color: colors.mutedForeground }]}>
                {pushSubText()}
              </Text>
              {pushStatus === "denied" && (
                <TouchableOpacity onPress={handlePushToggle}>
                  <Text style={[styles.pushLink, { color: colors.gold }]}>
                    {t("notification_settings.open_settings")}
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
