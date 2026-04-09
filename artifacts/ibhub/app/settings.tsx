import { useRouter } from "expo-router";
import React, { useState } from "react";
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
import { Feather } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const LANGUAGES = [
  { code: "BR", label: "Português (BR)" },
  { code: "US", label: "English" },
  { code: "ES", label: "Español" },
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
  const { profile, signOut } = useAuth();
  const insets  = useSafeAreaInsets();

  const [langOpen, setLangOpen]         = useState(false);
  const [selectedLang, setSelectedLang] = useState("BR");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const currentLang = LANGUAGES.find((l) => l.code === selectedLang)!;

  const handleSignOut = () => {
    Alert.alert("Sair", "Deseja realmente sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: signOut },
    ]);
  };

  const name      = profile?.full_name ?? "Usuário";
  const initial   = name.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url ?? null;

  const planMap: Record<string, string> = {
    exclusive: "Plano Exclusivo",
    business:  "Plano Business",
    premium:   "Plano Premium",
    basico:    "Plano Básico",
    gratuito:  "Plano Gratuito",
  };
  const planRaw   = profile?.plan || profile?.subscription_tier || "";
  const planLabel = planMap[planRaw.toLowerCase()] ?? (planRaw ? planRaw : "Plano Gratuito");

  const sections: { title?: string; rows: MenuRow[] }[] = [
    {
      title: "CONTA",
      rows: [
        { icon: "edit-2",  label: "Editar Perfil",        sub: "Alterar informações pessoais",  onPress: () => router.push("/edit-profile" as any) },
        { icon: "bar-chart-2", label: "Analytics",         sub: "Estatísticas do seu perfil",    onPress: () => router.push("/analytics" as any) },
        { icon: "shield",  label: "Certificações",         sub: "Certificações",                 onPress: () => router.push("/certifications" as any) },
      ],
    },
    {
      title: "CONTEÚDO",
      rows: [
        { icon: "bookmark", label: "Publicações Salvas",   sub: "Suas publicações favoritas",    onPress: () => router.push("/salvos" as any) },
      ],
    },
    {
      title: "PREFERÊNCIAS",
      rows: [
        { icon: "bell",     label: "Notificações",         sub: "Gerenciar notificações",         onPress: () => router.push("/notification-settings" as any) },
        { icon: "lock",     label: "Privacidade e Segurança", sub: "Visibilidade e senha",        onPress: () => router.push("/privacy-security" as any) },
        { icon: "slash",    label: "Usuários Bloqueados",   sub: "Gerenciar bloqueios",            onPress: () => router.push("/blocked-users" as any) },
      ],
    },
    {
      title: "ASSINATURA",
      rows: [
        { icon: "star",     label: "Assinatura",            sub: "Gerencie seu plano",             onPress: () => router.push("/subscription" as any) },
      ],
    },
    {
      title: "SUPORTE & LEGAL",
      rows: [
        { icon: "file-text", label: "Termos de Uso",         sub: "Termos e condições",             onPress: () => router.push("/terms-of-use") },
        { icon: "file-text", label: "Política de Privacidade", sub: "Como usamos seus dados",       onPress: () => router.push("/privacy-policy") },
        { icon: "mail",      label: "Fale Conosco",           sub: "Suporte e feedback",             onPress: () => router.push("/contact") },
        { icon: "alert-circle", label: "Reportar Bug",        sub: "Nos ajude a melhorar",           onPress: () => router.push("/report-bug") },
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
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Configurações</Text>
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
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Idioma</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {currentLang.code} {currentLang.label}
              </Text>
            </View>
            <Feather name={langOpen ? "chevron-down" : "chevron-right"} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          {langOpen && (
            <View style={[styles.langDropdown, { borderTopColor: colors.border }]}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    { borderBottomColor: colors.border },
                    selectedLang === lang.code && { backgroundColor: colors.gold + "12" },
                  ]}
                  onPress={() => { setSelectedLang(lang.code); setLangOpen(false); }}
                >
                  <Text style={[styles.langCode, { color: selectedLang === lang.code ? colors.gold : colors.mutedForeground }]}>
                    {lang.code}
                  </Text>
                  <Text style={[styles.langLabel, { color: selectedLang === lang.code ? colors.gold : colors.foreground }]}>
                    {lang.label}
                  </Text>
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

        {/* Painel Administrativo */}
        <View style={[styles.menuCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <TouchableOpacity style={styles.menuRow} onPress={() => router.push("/admin" as any)}>
            <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
              <Feather name="settings" size={16} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Painel Administrativo</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Gerenciar plataforma</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Sair da conta */}
        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: "#dc2626" }]}
          onPress={handleSignOut}
        >
          <Feather name="log-out" size={16} color="#dc2626" />
          <Text style={[styles.signOutText, { color: "#dc2626" }]}>Sair da conta</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>ibhub v1.0 · © 2026</Text>
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
  langOption:  { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
  langCode:    { fontSize: 13, fontWeight: "700", width: 24 },
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
