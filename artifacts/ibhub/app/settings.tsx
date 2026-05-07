import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { changeLocale, LOCALE_STORAGE_KEY } from "@/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGES = [
  { code: "pt-BR", flag: "🇧🇷", label: "Português (BR)" },
  { code: "en",    flag: "🇺🇸", label: "English" },
  { code: "es",    flag: "🇪🇸", label: "Español" },
  { code: "fr",    flag: "🇫🇷", label: "Français" },
  { code: "it",    flag: "🇮🇹", label: "Italiano" },
];

interface MenuRow {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
}

export default function SettingsScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const insets  = useSafeAreaInsets();

  const [langOpen, setLangOpen]         = useState(false);
  const [selectedLang, setSelectedLang] = useState(i18n.language || "pt-BR");

  // Sync selectedLang with persisted value on mount
  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((saved) => {
      if (saved) setSelectedLang(saved);
    }).catch(() => {});
  }, []);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const currentLang = LANGUAGES.find((l) => l.code === selectedLang) ?? LANGUAGES[0];

  const handleSignOut = () => {
    Alert.alert(t("settings.sign_out_title"), t("settings.sign_out_msg"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.sign_out"), style: "destructive", onPress: signOut },
    ]);
  };

  const handleSelectLang = async (code: string) => {
    setSelectedLang(code);
    setLangOpen(false);
    await changeLocale(code);
  };

  const name      = profile?.full_name ?? "Usuário";
  const initial   = name.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url ?? null;

  const planMap: Record<string, string> = {
    exclusive: t("settings.plans.exclusive"),
    business:  t("settings.plans.business"),
    premium:   t("settings.plans.premium"),
    basico:    t("settings.plans.basico"),
    gratuito:  t("settings.plans.gratuito"),
  };
  const planRaw   = profile?.plan || profile?.subscription_tier || "";
  const planLabel = planMap[planRaw.toLowerCase()] ?? (planRaw ? planRaw : t("settings.plans.gratuito"));

  const sections: { title?: string; rows: MenuRow[] }[] = [
    {
      title: t("settings.sections.account"),
      rows: [
        { icon: "edit-2",      label: t("settings.rows.edit_profile"),    sub: t("settings.rows.edit_profile_sub"),    onPress: () => router.push("/edit-profile" as any) },
        { icon: "bar-chart-2", label: t("settings.rows.analytics"),       sub: t("settings.rows.analytics_sub"),       onPress: () => router.push("/analytics" as any) },
        { icon: "shield",      label: t("settings.rows.certifications"),  sub: t("settings.rows.certifications_sub"),  onPress: () => router.push("/certifications" as any) },
      ],
    },
    {
      title: t("settings.sections.content"),
      rows: [
        { icon: "bookmark",    label: t("settings.rows.saved"),           sub: t("settings.rows.saved_sub"),           onPress: () => router.push("/salvos" as any) },
      ],
    },
    {
      title: t("settings.sections.preferences"),
      rows: [
        { icon: "bell",        label: t("settings.rows.notifications"),   sub: t("settings.rows.notifications_sub"),   onPress: () => router.push("/notification-settings" as any) },
        { icon: "lock",        label: t("settings.rows.privacy"),         sub: t("settings.rows.privacy_sub"),         onPress: () => router.push("/privacy-security" as any) },
        { icon: "slash",       label: t("settings.rows.blocked"),         sub: t("settings.rows.blocked_sub"),         onPress: () => router.push("/blocked-users" as any) },
      ],
    },
    {
      title: t("settings.sections.subscription"),
      rows: [
        { icon: "star",        label: t("settings.rows.subscription"),    sub: t("settings.rows.subscription_sub"),    onPress: () => router.push("/subscription" as any) },
      ],
    },
    {
      title: t("settings.sections.support"),
      rows: [
        { icon: "file-text",   label: t("settings.rows.terms"),           sub: t("settings.rows.terms_sub"),           onPress: () => router.push("/terms-of-use") },
        { icon: "file-text",   label: t("settings.rows.privacy_policy"),  sub: t("settings.rows.privacy_policy_sub"),  onPress: () => router.push("/privacy-policy") },
        { icon: "mail",        label: t("settings.rows.contact"),         sub: t("settings.rows.contact_sub"),         onPress: () => router.push("/contact") },
        { icon: "alert-circle",label: t("settings.rows.report_bug"),      sub: t("settings.rows.report_bug_sub"),      onPress: () => router.push("/report-bug") },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("settings.title")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, rowGap: 16 }}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* User card */}
        <View style={[styles.userCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.userAvatarImg} />
          ) : (
            <View style={[styles.userAvatar, { backgroundColor: colors.navy }]}>
              <Text style={[styles.userInitial, { color: colors.gold }]}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.navy }]}>{name}</Text>
            <Text style={[styles.userPlan, { color: colors.mutedForeground }]}>{planLabel}</Text>
          </View>
        </View>

        {/* Language picker */}
        <View style={[styles.menuCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <TouchableOpacity style={styles.langRow} onPress={() => setLangOpen(!langOpen)}>
            <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
              <Feather name="globe" size={16} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("settings.language")}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {currentLang.flag} {currentLang.label}
              </Text>
            </View>
            <Feather name={langOpen ? "chevron-down" : "chevron-right"} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          {langOpen && (
            <View style={[styles.langDropdown, { borderTopColor: colors.border }]}>
              {LANGUAGES.map((lang, idx) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    idx < LANGUAGES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    selectedLang === lang.code && { backgroundColor: colors.gold + "12" },
                  ]}
                  onPress={() => handleSelectLang(lang.code)}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, { color: selectedLang === lang.code ? colors.gold : colors.foreground }]}>
                    {lang.label}
                  </Text>
                  {selectedLang === lang.code && (
                    <Feather name="check" size={16} color={colors.gold} style={{ marginLeft: "auto" }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Sections */}
        {sections.map((section, si) => (
          <View key={si}>
            {section.title && (
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>
            )}
            <View style={[styles.menuCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              {section.rows.map((row, ri) => (
                <TouchableOpacity
                  key={row.label}
                  style={[
                    styles.menuRow,
                    ri < section.rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={row.onPress}
                >
                  <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
                    <Feather name={row.icon} size={16} color={colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.navy }]}>{row.label}</Text>
                    {row.sub ? <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{row.sub}</Text> : null}
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Painel Administrativo — visível apenas para admins */}
        {profile?.is_admin && (
          <View style={[styles.menuCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <TouchableOpacity style={styles.menuRow} onPress={() => router.push("/admin" as any)}>
              <View style={[styles.iconWrap, { backgroundColor: "#c9a84c18" }]}>
                <Feather name="shield" size={16} color="#c9a84c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("settings.rows.admin")}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{t("settings.rows.admin_sub")}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* Sair da conta */}
        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: "#dc2626" }]}
          onPress={handleSignOut}
        >
          <Feather name="log-out" size={16} color="#dc2626" />
          <Text style={[styles.signOutText, { color: "#dc2626" }]}>{t("settings.sign_out")}</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={{ alignItems: "center", gap: 4 }}>
          <Image
            source={require("@/assets/images/logo_dark.png")}
            style={{ height: 20, width: 76 }}
            resizeMode="contain"
            accessibilityLabel="ibhub"
          />
          <Text style={[styles.footer, { color: colors.mutedForeground }]}>v1.0 · © 2026</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  userCard:      { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 12, borderWidth: 1, padding: 16 },
  userAvatar:    { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  userAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  userInitial:   { fontSize: 20, fontWeight: "800" },
  userName:    { fontSize: 16, fontWeight: "700" },
  userPlan:    { fontSize: 13, marginTop: 2 },
  menuCard:    { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  langRow:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  langDropdown:{ borderTopWidth: 1 },
  langOption:  { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  langFlag:    { fontSize: 20 },
  langLabel:   { fontSize: 14 },
  sectionTitle:{ fontSize: 12, fontWeight: "700", letterSpacing: 0.8, paddingHorizontal: 2, marginBottom: 8, marginTop: 8 },
  menuRow:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  iconWrap:    { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel:    { fontSize: 15, fontWeight: "600" },
  rowSub:      { fontSize: 12, marginTop: 1 },
  signOutBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5 },
  signOutText: { fontSize: 15, fontWeight: "700" },
  footer:      { textAlign: "center", fontSize: 12, paddingBottom: 8 },
});
