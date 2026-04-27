import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter, usePathname, type Href } from "expo-router";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useUnread } from "@/context/UnreadContext";

const DESKTOP_BREAKPOINT = 900;

interface NavItem {
  route: Href;
  icon: string;
  label: string;
  matchPaths: string[];
  badge?: number;
}

export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
}

export function SidebarNav() {
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const { profile, activeCompany } = useAuth();
  const { unreadCount } = useUnread();
  const { width } = useWindowDimensions();

  const isCollapsed = width < 1200 && width >= DESKTOP_BREAKPOINT;

  const name = activeCompany?.name ?? profile?.full_name ?? "Usuário";
  const avatarUri = activeCompany?.avatar_url ?? profile?.avatar_url ?? null;
  const username = profile?.username ?? "";
  const isCompany = !!activeCompany || profile?.profile_type === "empresa";

  const primaryItems: NavItem[] = [
    { route: "/(tabs)",               icon: "home",           label: "Início",         matchPaths: ["/", ""] },
    { route: "/(tabs)/network",       icon: "bar-chart-2",    label: "Mercado",        matchPaths: ["/network"] },
    { route: "/(tabs)/messages",      icon: "message-circle", label: "Chat",           matchPaths: ["/messages", "/chat"], badge: unreadCount > 0 ? unreadCount : undefined },
    { route: "/(tabs)/notifications", icon: "briefcase",      label: "Oportunidades",  matchPaths: ["/notifications"] },
    { route: "/(tabs)/profile",       icon: isCompany ? "briefcase" : "user", label: isCompany ? "Empresa" : "Perfil", matchPaths: ["/profile"] },
  ];

  const secondaryItems: NavItem[] = [
    { route: "/conexoes",       icon: "users",      label: "Conexões",     matchPaths: ["/conexoes"] },
    { route: "/search",         icon: "search",     label: "Buscar",       matchPaths: ["/search"] },
    { route: "/groups",         icon: "layers",     label: "Grupos",       matchPaths: ["/groups", "/new-group"] },
    { route: "/wine-cellar",    icon: isCompany ? "briefcase" : "archive", label: isCompany ? "Portfólio" : "Adega", matchPaths: ["/wine-cellar"] },
    { route: "/certifications", icon: "award",      label: "Certificações",matchPaths: ["/certifications"] },
    { route: "/analytics",      icon: "trending-up",label: "Analytics",    matchPaths: ["/analytics"] },
  ];

  const isActive = (item: NavItem) => {
    for (const mp of item.matchPaths) {
      if (mp === "/" || mp === "") {
        if (pathname === "/" || pathname === "" || pathname === "/(tabs)") return true;
      } else if (pathname === mp || pathname.startsWith(mp + "/")) {
        return true;
      }
    }
    return false;
  };

  const handleNav = (route: Href) => {
    router.push(route);
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item);
    return (
      <TouchableOpacity
        key={item.label}
        style={[
          styles.navItem,
          active && { backgroundColor: colors.gold + "18" },
          isCollapsed && styles.navItemCollapsed,
        ]}
        onPress={() => handleNav(item.route)}
        activeOpacity={0.7}
      >
        <View style={styles.navIconWrap}>
          <Feather
            name={item.icon}
            size={20}
            color={active ? colors.gold : colors.mutedForeground}
          />
          {item.badge !== undefined && item.badge > 0 && (
            <View style={[styles.badge, { backgroundColor: "#dc2626" }]}>
              <Text style={styles.badgeText}>{item.badge > 99 ? "99+" : item.badge}</Text>
            </View>
          )}
        </View>
        {!isCollapsed && (
          <Text style={[styles.navLabel, { color: active ? colors.gold : colors.navy, fontWeight: active ? "700" : "500" }]}>
            {item.label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.sidebar, { backgroundColor: "#fff", borderRightColor: colors.border, width: isCollapsed ? 72 : 240 }]}>
      {/* Logo */}
      <TouchableOpacity style={styles.logoWrap} onPress={() => handleNav("/(tabs)")}>
        {isCollapsed ? (
          <View style={[styles.logoIcon, { backgroundColor: colors.navy }]}>
            <Text style={[styles.logoIconText, { color: colors.gold }]}>ib</Text>
          </View>
        ) : (
          <View style={styles.logoRow}>
            <View style={[styles.logoIcon, { backgroundColor: colors.navy }]}>
              <Text style={[styles.logoIconText, { color: colors.gold }]}>ib</Text>
            </View>
            <View>
              <Text style={[styles.logoTitle, { color: colors.navy }]}>ibhub</Text>
              <Text style={[styles.logoSub, { color: colors.gold }]}>Rede do Vinho</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Scrollable nav */}
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Primary nav items */}
        <View style={styles.navSection}>
          {primaryItems.map(renderNavItem)}
        </View>

        {/* Divider + secondary nav */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.navSection}>
          {!isCollapsed && (
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Social</Text>
          )}
          {secondaryItems.map(renderNavItem)}
        </View>
      </ScrollView>

      {/* Bottom: settings + user card */}
      <View style={[styles.bottomSection, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.userCard]}
          onPress={() => handleNav("/(tabs)/profile")}
          activeOpacity={0.7}
        >
          <Avatar uri={avatarUri} name={name} size={34} />
          {!isCollapsed && (
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.navy }]} numberOfLines={1}>{name}</Text>
              {username ? (
                <Text style={[styles.userHandle, { color: colors.mutedForeground }]} numberOfLines={1}>@{username}</Text>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => handleNav("/settings")}
        >
          <Feather name="settings" size={17} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    height: "100%",
    borderRightWidth: 1,
    flexDirection: "column",
    paddingTop: 16,
  },
  logoWrap: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIconText: {
    fontSize: 14,
    fontWeight: "800",
  },
  logoTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  logoSub: {
    fontSize: 10,
    fontWeight: "600",
  },
  scrollArea: {
    flex: 1,
  },
  navSection: {
    paddingHorizontal: 8,
    gap: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
  },
  navItemCollapsed: {
    paddingHorizontal: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
    marginHorizontal: 8,
  },
  navIconWrap: {
    position: "relative",
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  navLabel: {
    fontSize: 14,
  },
  bottomSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  userCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: "700",
  },
  userHandle: {
    fontSize: 11,
  },
  settingsBtn: {
    padding: 6,
  },
});
