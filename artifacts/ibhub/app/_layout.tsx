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
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth, supabase } from "@/context/AuthContext";
import { PermissionsProvider } from "@/context/PermissionsContext";
import { FeatureFlagsProvider, useFeatureFlags } from "@/context/FeatureFlagsContext";
import { UnreadProvider, useUnread } from "@/context/UnreadContext";
import { MarketFeedBadgeProvider } from "@/context/MarketFeedBadgeContext";
import { SidebarNav, useIsDesktop } from "@/components/ui/SidebarNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import * as SafeNotifications from "@/utils/safeNotifications";
import { installGlobalErrorHandler, reportCrash } from "@/lib/crashReporter";

// Install global JS error handler as early as possible — before any provider
// or component renders. This catches fatal and non-fatal JS exceptions and
// reports them to our own crash_reports table.
installGlobalErrorHandler();

// Must be called once at module load, before any notification can arrive.
// Without this, notifications received while the app is foregrounded are
// silently discarded — no banner appears on iOS or Android.
SafeNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false, // badge managed manually via UnreadContext
  }),
});

// ── Cold-start notification pre-fetch ────────────────────────────────────────
// Read the last notification response immediately at module load — before any
// React tree renders. By the time auth resolves (even from cache), this promise
// will have settled, letting RootLayoutNav navigate directly to the deep-link
// destination instead of first landing on /(tabs) and then jumping away.
const coldStartDeepLinkPromise: Promise<string | null> = (async () => {
  try {
    const response = await SafeNotifications.getLastNotificationResponseAsync();
    if (response) {
      const data = response.notification.request.content.data ?? {};
      const deepLink = (data as { deepLink?: string }).deepLink;
      if (deepLink && typeof deepLink === "string" && deepLink.startsWith("/")) {
        return deepLink;
      }
    }
  } catch {
    // Not available in Expo Go
  }
  return null;
})();

// Tracks whether RootLayoutNav has already consumed the cold-start deep link.
// PushNotificationHandler checks this flag to avoid double-navigating.
let coldStartLinkConsumed = false;

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
    //
    // NOTE: RootLayoutNav pre-reads getLastNotificationResponseAsync() at
    // module load and navigates directly to the deep-link destination before
    // this component mounts. If it has already consumed the cold-start link,
    // we skip this call entirely to prevent double-navigation.
    const handleLastResponse = async () => {
      if (coldStartLinkConsumed) return;
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
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
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
      <Stack.Screen name="group-settings/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="new-group" options={{ presentation: "modal" }} />
      <Stack.Screen name="my-events" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="new-message" options={{ presentation: "modal" }} />
      <Stack.Screen name="chat/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="group-chat/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="story/[id]" options={{ animation: "fade", presentation: "fullScreenModal" }} />
      <Stack.Screen name="story-viewer" options={{ animation: "fade", presentation: "fullScreenModal" }} />
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

  // True once router.replace() has been called at least once for an authenticated
  // user. On cold start with a cached session, loading + profileChecked resolve
  // synchronously, but the navigation useEffect runs *after* the first render —
  // leaving AuthenticatedLayout with an empty Stack for one frame (white screen).
  // Keeping this false until navigation fires means we show the navy spinner
  // instead of the blank Stack, eliminating the visible white flash.
  const [navInitiated, setNavInitiated] = useState(false);

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
    if (!shouldRedirect) {
      // Even if we skip the redirect, ensure navInitiated is marked so the
      // loading guard doesn't block AuthenticatedLayout indefinitely when the
      // user is already on the correct screen (e.g. deep-link cold start).
      setNavInitiated(true);
      return;
    }

    // Never auto-redirect from the register screen — it drives its own
    // navigation at the end of the signup flow. Auto-redirecting here would
    // race with the register screen's own router.replace("/(tabs)") and cause
    // a visible flash back to the first onboarding step.
    if (pathname.includes("register")) {
      lastDestination.current = destination;
      setNavInitiated(true);
      return;
    }

    // Edge case: needsProfileCompletion=true but already on social-complete or
    // an auth screen → don't bounce the user off it.
    const completionBlockPaths = ["social-complete", "reset-password", "forgot-password"];
    if (needsProfileCompletion && completionBlockPaths.some(p => pathname.includes(p))) {
      lastDestination.current = destination;
      setNavInitiated(true);
      return;
    }

    lastDestination.current = destination;

    // For /(tabs), check whether a cold-start notification was tapped.
    // The deep link was pre-fetched at module load so the promise is already
    // settled by the time we get here, keeping navigation instantaneous.
    if (destination === "/(tabs)") {
      (async () => {
        const coldLink = await coldStartDeepLinkPromise;
        if (coldLink && !coldStartLinkConsumed) {
          coldStartLinkConsumed = true;
          router.replace(coldLink as any);
        } else {
          router.replace("/(tabs)" as any);
        }
        setNavInitiated(true);
      })();
    } else {
      router.replace(destination as any);
      setNavInitiated(true);
    }
  }, [
    session, loading, isRecovering, mustChangePassword, manutencao,
    flagsLoading, isAuthPath, needsProfileCompletion, profileChecked, pathname,
  ]);

  // Safety-net: if the navigation effect somehow never fires (extreme edge case —
  // e.g. coldStartDeepLinkPromise hangs without rejecting), unblock after 3 s.
  // IMPORTANT: also call router.replace so AuthenticatedLayout has an active
  // route. Without this, navInitiated=true renders an empty Stack → white screen.
  useEffect(() => {
    if (navInitiated || loading || flagsLoading || !session || !profileChecked || isRecovering || mustChangePassword) return;
    const t = setTimeout(() => {
      console.warn("[RootLayoutNav] navInitiated safety-net fired after 3s — forcing navigation");
      const destination = needsProfileCompletion ? "/social-complete" : "/(tabs)";
      router.replace(destination as any);
      setNavInitiated(true);
    }, 3_000);
    return () => clearTimeout(t);
  }, [navInitiated, loading, flagsLoading, session, profileChecked, isRecovering, mustChangePassword, needsProfileCompletion, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a" }}>
        <ActivityIndicator color="#c9a84c" size="large" />
      </View>
    );
  }

  // Feature flags still loading — auth resolved but navigation effect is
  // blocked on flagsLoading. Without this guard, RootLayoutNav falls through
  // to <AuthenticatedLayout /> which renders a Stack with no active route
  // (there is no app/index.tsx), producing a blank/white screen on cold start.
  // The second open avoids this because the session is cached in AsyncStorage
  // and the flags query resolves before or simultaneously with auth.
  if (flagsLoading) {
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
        {/* auth/callback handles the OAuth deep-link on Android; must be in
            both stacks so Expo Router never shows "This screen doesn't exist" */}
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" redirect />
        <Stack.Screen name="maintenance" options={{ headerShown: false }} />
        <Stack.Screen name="terms-of-use" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="privacy-policy" options={{ animation: "slide_from_right" }} />
      </Stack>
    );
  }

  // Auth is fully resolved and session exists, but router.replace() hasn't
  // fired yet (useEffect runs after render). Show the navy spinner to prevent
  // the one-frame blank white screen from the empty Stack in AuthenticatedLayout.
  if (!navInitiated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a" }}>
        <ActivityIndicator color="#c9a84c" size="large" />
      </View>
    );
  }

  return <AuthenticatedLayout />;
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Safety-net: if useFonts gets stuck (neither resolves nor errors — possible
  // on rare asset-registration failures in the native runtime), force the app
  // to proceed after 3s so the splash screen never stays up indefinitely.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontTimeout(true), 3_000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    // Restore persisted language before first render
    initLocale();
  }, []);

  const fontsReady = fontsLoaded || !!fontError || fontTimeout;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  // Return a dark background instead of null so that if SplashScreen fails to
  // stay visible, the user sees navy instead of a white flash while fonts load.
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: "#0d1b2a" }} />;

  return (
    <ErrorBoundary
      onError={(error, stack) => {
        if (__DEV__) {
          console.error("[RootErrorBoundary]", error, stack);
        }
        reportCrash({
          type: "render_error",
          message: error?.message,
          stack: error?.stack,
          component_stack: stack,
        });
      }}
    >
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <FeatureFlagsProvider>
                <PermissionsProvider>
                  <UnreadProvider>
                    <MarketFeedBadgeProvider>
                      <RootLayoutNav />
                    </MarketFeedBadgeProvider>
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

export default RootLayout;
