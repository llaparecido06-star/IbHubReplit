import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface SettingRow {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  type: "arrow" | "toggle" | "danger";
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [showCellar, setShowCellar] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const SECTIONS: { title: string; items: SettingRow[] }[] = [
    {
      title: "Conta",
      items: [
        { label: "Editar perfil", icon: "user", type: "arrow", onPress: () => router.push("/edit-profile" as any) },
        { label: "Alterar senha", icon: "lock", type: "arrow", onPress: () => {} },
        { label: "Email: " + (user?.email ?? ""), icon: "mail", type: "arrow", onPress: () => {} },
      ],
    },
    {
      title: "Notificações",
      items: [
        { label: "Notificações no app", icon: "bell", type: "toggle", value: notifications, onToggle: setNotifications },
        { label: "Push notifications", icon: "smartphone", type: "toggle", value: pushNotifications, onToggle: setPushNotifications },
        { label: "Notificações por email", icon: "mail", type: "toggle", value: emailNotifications, onToggle: setEmailNotifications },
      ],
    },
    {
      title: "Privacidade",
      items: [
        { label: "Perfil privado", icon: "eye-off", type: "toggle", value: privateAccount, onToggle: setPrivateAccount },
        { label: "Mostrar adega pessoal", icon: "package", type: "toggle", value: showCellar, onToggle: setShowCellar },
        { label: "Usuários bloqueados", icon: "slash", type: "arrow", onPress: () => {} },
      ],
    },
    {
      title: "Assinatura",
      items: [
        { label: "Gerenciar plano", icon: "star", type: "arrow", onPress: () => {} },
        { label: "Faturamento", icon: "credit-card", type: "arrow", onPress: () => {} },
      ],
    },
    {
      title: "Sobre",
      items: [
        { label: "Termos de uso", icon: "file-text", type: "arrow", onPress: () => {} },
        { label: "Política de privacidade", icon: "shield", type: "arrow", onPress: () => {} },
        { label: "Versão 1.0.0", icon: "info", type: "arrow", onPress: () => {} },
      ],
    },
    {
      title: "Conta",
      items: [
        { label: "Sair da conta", icon: "log-out", type: "danger", onPress: signOut },
        { label: "Excluir conta", icon: "trash-2", type: "danger", onPress: () => {} },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Configurações</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section, si) => (
          <View key={si} style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={ii}
                  style={[
                    styles.row,
                    { borderBottomColor: colors.border },
                    ii === section.items.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={item.type !== "toggle" ? item.onPress : undefined}
                  activeOpacity={item.type === "toggle" ? 1 : 0.7}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.type === "danger" ? colors.destructive + "15" : colors.gold + "15" }]}>
                    <Feather name={item.icon} size={16} color={item.type === "danger" ? colors.destructive : colors.gold} />
                  </View>
                  <Text style={[styles.rowLabel, { color: item.type === "danger" ? colors.destructive : colors.foreground }]}>
                    {item.label}
                  </Text>
                  {item.type === "toggle" && (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: colors.border, true: colors.gold }}
                      thumbColor="#ffffff"
                    />
                  )}
                  {item.type === "arrow" && (
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  sectionBlock: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  sectionCard: { borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12, borderBottomWidth: 1 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15 },
});
