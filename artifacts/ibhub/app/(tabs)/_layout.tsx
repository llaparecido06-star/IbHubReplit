import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();

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
          height: Platform.OS === "web" ? 64 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: Platform.OS === "ios" ? 0 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={22} color={color} />,
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
          title: "Oportunidades",
          tabBarIcon: ({ color }) => <Feather name="briefcase" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
