import React, { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

const DRAWER_W = 260;
const NAVY     = "#0d1b2a";
const GOLD     = "#c9a84c";
const MUTED    = "#6688aa";
const ACTIVE   = "#162232";

const SECTIONS = [
  {
    title: "VISÃO GERAL",
    items: [
      { icon: "grid"         as const, label: "Dashboard",        route: "/admin" },
      { icon: "activity"     as const, label: "Logs de Atividade", route: "/admin/logs" },
    ],
  },
  {
    title: "GESTÃO DE CONTEÚDO",
    items: [
      { icon: "film"         as const, label: "Momentos",          route: "/admin/momentos" },
      { icon: "calendar"     as const, label: "Eventos",           route: "/admin/eventos" },
      { icon: "shopping-bag" as const, label: "Marketplace",       route: "/admin/marketplace" },
      { icon: "bar-chart-2"  as const, label: "Mercado",            route: "/admin/slides-mercado" },
      { icon: "layers"       as const, label: "Slides de Apres.",  route: "/admin/presentation-slides" },
      { icon: "shield"       as const, label: "Moderação",         route: "/admin/moderacao" },
    ],
  },
  {
    title: "USUÁRIOS & RECEITA",
    items: [
      { icon: "users"        as const, label: "CRM Usuários",      route: "/admin/crm" },
      { icon: "credit-card"  as const, label: "Financeiro",        route: "/admin/financeiro" },
      { icon: "package"      as const, label: "Plan Builder",      route: "/admin/plan-builder" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { icon: "send"         as const, label: "Comunicação",       route: "/admin/comunicacao" },
      { icon: "user-check"   as const, label: "Admins",            route: "/admin/admins" },
      { icon: "settings"     as const, label: "Configurações",     route: "/admin/configuracoes" },
    ],
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  activeRoute: string;
}

export default function AdminDrawer({ visible, onClose, activeRoute }: Props) {
  const router = useRouter();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const slideX = useRef(new Animated.Value(-DRAWER_W)).current;

  useEffect(() => {
    Animated.spring(slideX, {
      toValue: visible ? 0 : -DRAWER_W,
      friction: 8,
      tension: 80,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [visible]);

  if (!visible) return null;

  const go = (route: string | null) => {
    if (!route) {
      Alert.alert("Em breve", "Esta funcionalidade está em desenvolvimento.");
      return;
    }
    onClose();
    setTimeout(() => router.push(route as any), 60);
  };

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.panel,
          {
            paddingTop: topPad + 16,
            paddingBottom: bottomPad + 16,
            transform: Platform.OS !== "web" ? [{ translateX: slideX }] : undefined,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.dHeader}>
          <View style={styles.logoRow}>
            <Image
              source={require("@/assets/images/logo_light.png")}
              style={{ height: 26, width: 100 }}
              resizeMode="contain"
            />
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Scrollable menu */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {SECTIONS.map((sec) => (
            <View key={sec.title} style={styles.secWrap}>
              <Text style={styles.secTitle}>{sec.title}</Text>
              {sec.items.map((item) => {
                const isActive = activeRoute === item.route;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => go(item.route)}
                    activeOpacity={0.7}
                  >
                    <Feather name={item.icon} size={16} color={isActive ? GOLD : MUTED} />
                    <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={styles.dFooter}>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => { onClose(); setTimeout(() => router.replace("/(tabs)"), 60); }}
          >
            <Feather name="smartphone" size={15} color={MUTED} />
            <Text style={styles.footerText}>Voltar ao App</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => { onClose(); setTimeout(signOut, 60); }}
          >
            <Feather name="log-out" size={15} color="#ef4444" />
            <Text style={[styles.footerText, { color: "#ef4444" }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop:          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
  panel:             { position: "absolute", top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: NAVY },
  dHeader:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#1e3048", marginBottom: 8 },
  logoRow:           { flexDirection: "row", alignItems: "center", gap: 8 },
  logoText:          { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  adminBadge:        { backgroundColor: GOLD, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText:    { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  secWrap:           { marginBottom: 4 },
  secTitle:          { color: MUTED, fontSize: 10, fontWeight: "700", letterSpacing: 0.9, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  menuItem:          { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  menuItemActive:    { backgroundColor: ACTIVE },
  menuLabel:         { color: "#bbc8dc", fontSize: 14 },
  menuLabelActive:   { color: "#fff", fontWeight: "600" },
  dFooter:           { borderTopWidth: 1, borderTopColor: "#1e3048", paddingTop: 10, paddingHorizontal: 16 },
  footerBtn:         { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  footerText:        { color: MUTED, fontSize: 14 },
});
