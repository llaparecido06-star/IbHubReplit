import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a" }}>
        <ActivityIndicator color="#c9a84c" size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" redirect />
      </Stack>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-post" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="search" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="wine-cellar" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="certifications" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
      <Stack.Screen name="events" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="opportunities" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="groups" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="saved-posts" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="my-events" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="new-message" options={{ presentation: "modal" }} />
      <Stack.Screen name="chat/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="post/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="profile/[id]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
