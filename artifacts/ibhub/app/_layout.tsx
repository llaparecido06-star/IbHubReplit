import { initLocale } from "@/i18n";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, usePathname, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth, supabase } from "@/context/AuthContext";
import { PermissionsProvider } from "@/context/PermissionsContext";
import { FeatureFlagsProvider, useFeatureFlags } from "@/context/FeatureFlagsContext";
import { UnreadProvider, useUnread } from "@/context/UnreadContext";
import { SidebarNav, useIsDesktop } from "@/components/ui/SidebarNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import * as SafeNotifications from "@/utils/safeNotifications";

// ── Background unread badge syncer ──────────────────────────────────────────
function UnreadSyncer() {
  const { user } = useAuth();
  const { refreshUnread } = useUnread();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    refreshUnread(user.id);
    timerRef.current = setInterval(() => refreshUnread(user.id), 60_000);

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

// ── Push notification deep-link handler ──────────────────────────────────────
function navigateDeepLink(router: ReturnType<typeof useRouter>, deepLink: string) {
  // Only allow absolute paths starting with "/" to prevent open redirects
  if (!deepLink.startsWith("/")) return;
  router.push(deepLink as Href);
}

function PushNotificationHandler() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Handle cold-start: app was launched by tapping a notification.
    // Token registration (requestPermissionsAsync) is intentionally NOT done
    // here — it is done in the feed screen after navigation has settled, so
    // the OS permission dialog never appears mid-onboarding.
    const handleLastResponse = async () => {
      try {
        const response = await SafeNotifications.getLastNotificationResponseAsync();
        if (response) {
          const data = response.notification.request.content.data ?? {};
          const deepLink = (data as { deepLink?: string }).deepLink;
          if (deepLink && typeof deepLink === "string") {
            navigateDeepLink(router, deepLink);
          }
        }
      } catch {
        // Not available in Expo Go
      }
    };

    handleLastResponse();

    // Listen for notification taps while app is foregrounded/backgrounded
    const sub = SafeNotifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      const deepLink = (data as { deepLink?: string }).deepLink;
      if (deepLink && typeof deepLink === "string") {
        navigateDeepLink(router, deepLink);
      }
    });

    return () => sub.remove();
  }, [user?.id]);

  return null;
}

// ── Maintenance mode guard ────────────────────────────────────────────────────
function MaintenanceGuard() {
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const { profile, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const manutencao = isEnabled("manutencao");

  useEffect(() => {
    // Wait for both feature flags and auth/profile to finish loading before acting.
    // This prevents premature sign-out while profile.is_admin is still being fetched.
    if (flagsLoading || authLoading) return;
    if (!session) return;
    if (profile?.is_admin) return;
    if (manutencao) {
      supabase.auth.signOut().then(() => {
        router.replace("/maintenance" as any);
      });
    }
  }, [manutencao, flagsLoading, authLoading, profile?.is_admin, session]);

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
      <Stack.Screen name="maintenance" options={{ headerShown: false }} />
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
        <PushNotificationHandler />
        <MaintenanceGuard />
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
      <PushNotificationHandler />
      <MaintenanceGuard />
      {stack}
    </>
  );
}

function RootLayoutNav() {
  const { session, loading, isRecovering, mustChangePassword, needsProfileCompletion, profileChecked } = useAuth();
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const router = useRouter();
  const pathname = usePathname();
  // Track the last destination we navigated to so we can re-navigate when the
  // intended destination changes (e.g. needsProfileCompletion flips during OAuth).
  const lastDestination = useRef<string | null>(null);
  const manutencao = isEnabled("manutencao");

  // Auth routes that must remain accessible without a session
  const isAuthPath = ["login", "register", "forgot-password", "reset-password", "auth"].some(
    (p) => pathname.includes(p),
  );

  useEffect(() => {
    if (loading || isRecovering || mustChangePassword || flagsLoading) return;

    // ── Unauthenticated ────────────────────────────────────────────────────
    if (!session) {
      lastDestination.current = null;
      if (manutencao && !isAuthPath) {
        router.replace("/maintenance" as any);
      } else if (!manutencao && !isAuthPath) {
        router.replace("/(auth)/login" as any);
      }
      return;
    }

    // ── Authenticated ──────────────────────────────────────────────────────
    // Wait for the first profile fetch to complete before deciding destination.
    // Otherwise, for new social-auth users, needsProfileCompletion starts as false,
    // we navigate to /(tabs), and then a moment later it flips to true and we
    // bounce them to /social-complete — visible flicker.
    if (!profileChecked) return;

    // Decide destination once, based on whether the social-auth user still needs
    // to complete their profile. Single source of truth avoids the previous
    // double-effect race.
    const destination = needsProfileCompletion ? "/social-complete" : "/(tabs)";

    // Don't override screens the user explicitly navigated to (settings, profile, etc.).
    // Only redirect when on an auth screen or when the destination actually changed.
    const shouldRedirect = isAuthPath || lastDestination.current !== destination;
    if (!shouldRedirect) return;

    // Never auto-redirect from the register screen — it drives its own
    // navigation at the end of the signup flow. Auto-redirecting here would
    // race with the register screen's own router.replace("/(tabs)") and cause
    // a visible flash back to the first onboarding step.
    if (pathname.includes("register")) {
      lastDestination.current = destination;
      return;
    }

    // Edge case: needsProfileCompletion=true but already on social-complete or
    // an auth screen → don't bounce the user off it.
    const completionBlockPaths = ["social-complete", "reset-password", "forgot-password"];
    if (needsProfileCompletion && completionBlockPaths.some(p => pathname.includes(p))) {
      lastDestination.current = destination;
      return;
    }

    lastDestination.current = destination;
    router.replace(destination as any);
  }, [
    session, loading, isRecovering, mustChangePassword, manutencao,
    flagsLoading, isAuthPath, needsProfileCompletion, profileChecked, pathname,
  ]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a" }}>
        <ActivityIndicator color="#c9a84c" size="large" />
      </View>
    );
  }

  // Session was just established (e.g. OAuth SIGNED_IN fired) but the first
  // profile fetch hasn't completed yet. Show a loading screen instead of
  // briefly flashing AuthenticatedLayout with no valid route (blank screen).
  if (session && !profileChecked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a" }}>
        <ActivityIndicator color="#c9a84c" size="large" />
      </View>
    );
  }

  if (isRecovering || mustChangePassword) {
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
        <Stack.Screen name="maintenance" options={{ headerShown: false }} />
        <Stack.Screen name="terms-of-use" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="privacy-policy" options={{ animation: "slide_from_right" }} />
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
    // Restore persisted language before first render
    initLocale();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary
      onError={(error, stack) => {
        if (__DEV__) {
          console.error("[RootErrorBoundary]", error, stack);
        }
      }}
    >
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <FeatureFlagsProvider>
                <PermissionsProvider>
                  <UnreadProvider>
                    <RootLayoutNav />
                  </UnreadProvider>
                </PermissionsProvider>
              </FeatureFlagsProvider>
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
