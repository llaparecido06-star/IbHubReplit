import "@/i18n";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth, supabase } from "@/context/AuthContext";
import { UnreadProvider, useUnread } from "@/context/UnreadContext";
import { SidebarNav, useIsDesktop } from "@/components/ui/SidebarNav";

// ── Background unread badge syncer ──────────────────────────────────────────
function UnreadSyncer() {
  const { user } = useAuth();
  const { refreshUnread } = useUnread();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Initial fetch
    refreshUnread(user.id);

    // Refresh every 60 seconds
    timerRef.current = setInterval(() => refreshUnread(user.id), 60_000);

    // Realtime: any new message → re-count
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel(`unread-syncer:${user.id}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => { refreshUnread(user.id); },
        )
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` },
          () => { refreshUnread(user.id); },
        )
        .subscribe();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, refreshUnread]);

  return null;
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthenticatedLayout() {
  const isDesktop = useIsDesktop();

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="social-complete" options={{ headerShown: false }} />
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
      <Stack.Screen name="new-group" options={{ presentation: "modal" }} />
      <Stack.Screen name="my-events" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="new-message" options={{ presentation: "modal" }} />
      <Stack.Screen name="chat/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="post/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="profile/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="empresa/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="event/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="job/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="opportunity/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="conexoes" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="analytics" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="privacy-security" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="notification-settings" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="terms-of-use" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="privacy-policy" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="contact" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="report-bug" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );

  if (isDesktop) {
    return (
      <>
        <UnreadSyncer />
        <View style={{ flex: 1, flexDirection: "row" }}>
          <SidebarNav />
          <View style={{ flex: 1 }}>
            {stack}
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <UnreadSyncer />
      {stack}
    </>
  );
}

function RootLayoutNav() {
  const { session, loading, isRecovering, needsProfileCompletion } = useAuth();
  const router = useRouter();
  const didNavigateIn = useRef(false);

  useEffect(() => {
    if (loading || isRecovering) return;

    if (!session) {
      didNavigateIn.current = false;
      router.replace("/(auth)/login" as any);
    } else if (needsProfileCompletion) {
      router.replace("/social-complete" as any);
    } else if (!didNavigateIn.current) {
      didNavigateIn.current = true;
      setTimeout(() => router.replace("/(tabs)" as any), 80);
    }
  }, [session, loading, isRecovering, needsProfileCompletion]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a" }}>
        <ActivityIndicator color="#c9a84c" size="large" />
      </View>
    );
  }

  if (isRecovering) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)/reset-password" options={{ headerShown: false }} />
      </Stack>
    );
  }

  if (!session) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" redirect />
        <Stack.Screen name="terms-of-use" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="privacy-policy" options={{ animation: "slide_from_right" }} />
      </Stack>
    );
  }

  if (needsProfileCompletion) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="social-complete" options={{ headerShown: false }} />
      </Stack>
    );
  }

  return <AuthenticatedLayout />;
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
            <UnreadProvider>
              <RootLayoutNav />
            </UnreadProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
