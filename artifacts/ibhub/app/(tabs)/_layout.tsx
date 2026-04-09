import { Tabs } from "expo-router";
import { Feather } from "@/components/ui/Icon";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function TabLayout() {
  const colors    = useColors();
  const { profile } = useAuth();
  const isCompany = profile?.profile_type === "empresa";
  const insets    = useSafeAreaInsets();

  const tabBarHeight = Platform.select({
    ios:     54 + insets.bottom,
    android: 62,
    default: 62,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: "#9ca3af",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
          height: tabBarHeight,
          paddingBottom: Platform.select({ ios: insets.bottom || 8, android: 10, default: 8 }),
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
          title: "Início",
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: "Mercado",
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Vagas",
          tabBarIcon: ({ color }) => <Feather name="briefcase" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isCompany ? "Empresa" : "Perfil",
          tabBarIcon: ({ color }) => (
            <Feather name={isCompany ? "briefcase" : "user"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
