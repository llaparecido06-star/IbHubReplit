import { Redirect, Tabs } from "expo-router";
import { Feather } from "@/components/ui/Icon";
import { useIsDesktop } from "@/components/ui/SidebarNav";
import React from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { useUnread } from "@/context/UnreadContext";
import { useMarketFeedBadge } from "@/context/MarketFeedBadgeContext";
import { useTranslation } from "react-i18next";
import LoginScreen from "../(auth)/login";

export default function TabLayout() {
  const colors    = useColors();
  const {
    profile,
    activeCompany,
    session,
    loading,
    isRecovering,
    mustChangePassword,
    needsProfileCompletion,
    profileChecked,
  } = useAuth();
  const isCompany = !!activeCompany || profile?.profile_type === "empresa";
  const insets    = useSafeAreaInsets();
  const { unreadCount } = useUnread();
  const { hasNewPost } = useMarketFeedBadge();
  const isDesktop = useIsDesktop();
  const { t } = useTranslation();
  const { isEnabled } = useFeatureFlags();
  const manutencao = isEnabled("manutencao");

  // ── Auth-driven redirect guard for the tab group ──────────────────────────
  // "/" resolves to (tabs)/index, so a COLD START mounts this layout first. The
  // root layout (_layout.tsx) also redirects imperatively via router.replace(),
  // but on iOS (New Architecture + buildReactNativeFromSource) that imperative
  // call can silently no-op at the very first mount — leaving a logged-out user
  // stranded on the empty navy tabs route with no visible screen (no overlay,
  // because authReady is already true). A DECLARATIVE <Redirect> from THIS
  // mounted route resolves reliably (it runs as part of route resolution, after
  // the navigator exists). Branches mirror the root effect exactly so the two
  // can never ping-pong. While !authReady the root LoadingOverlay covers the UI.
  const authReady = !loading && !(session && !profileChecked);
  if (authReady) {
    if (isRecovering || mustChangePassword) {
      return <Redirect href="/(auth)/reset-password" />;
    }
    if (!session) {
      // Maintenance mode is rare/admin-toggled — a redirect is acceptable there.
      if (manutencao) return <Redirect href="/maintenance" />;
      // iOS (New Arch + source build) silently no-ops BOTH router.replace() and
      // <Redirect> at the very first cold-start mount, stranding logged-out users
      // on an EMPTY navy screen (no overlay, because authReady is already true).
      // So instead of NAVIGATING to the login route, render it DIRECTLY here —
      // zero navigation dependency. When the user signs in, `session` becomes
      // non-null and this layout re-renders into <Tabs> on its own. signIn never
      // flips the global `loading` flag, so a failed attempt keeps LoginScreen
      // mounted and its inline error message visible.
      return <LoginScreen />;
    }
    if (needsProfileCompletion) {
      return <Redirect href="/social-complete" />;
    }
  }

  // Both iOS and Android run edge-to-edge, so the tab bar must reserve space for
  // the device's bottom safe-area inset (home indicator on iOS, system nav bar on
  // Android) or the last row of icons/labels gets drawn under the system buttons.
  // We fold insets.bottom into BOTH the total height and the bottom padding so the
  // content sits above the inset. On devices that report a zero inset (Android
  // gesture navigation), the base padding keeps the layout from collapsing.
  const tabBarHeight = Platform.select({
    ios:     54 + insets.bottom,
    android: 62 + insets.bottom,
    default: 62,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: "#9ca3af",
        headerShown: false,
        tabBarStyle: isDesktop
          ? { display: "none" }
          : {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
          height: tabBarHeight,
          paddingBottom: Platform.select({ ios: insets.bottom || 8, android: insets.bottom + 10, default: 8 }),
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: t("nav.market"),
          href: isCompany ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Feather name="bar-chart-2" size={22} color={color} />
              {hasNewPost && (
                <View style={{
                  position: "absolute", top: -2, right: -4,
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: "#dc2626",
                  borderWidth: 1.5, borderColor: "#fff",
                }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("nav.chat"),
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: "#dc2626", fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("nav.opportunities"),
          tabBarIcon: ({ color }) => <Feather name="briefcase" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isCompany ? t("nav.company") : t("nav.profile"),
          tabBarIcon: ({ color }) => (
            <Feather name={isCompany ? "grid" : "user"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
