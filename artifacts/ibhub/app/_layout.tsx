import { initLocale } from "@/i18n";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, usePathname, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
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

// Cold-start deep links (app launched by tapping a push notification) are
// handled entirely by PushNotificationHandler below, once the authenticated
// user is available. RootLayoutNav no longer consumes the cold-start link, so
// there is a single owner and no risk of double-navigation.

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
    // This handler is the SOLE owner of cold-start deep links: it reads the
    // last notification response once the authenticated user is available and
    // navigates to the deep-link destination.
    const handleLastResponse = async () => {
      try {
        // Race against a 1.5 s timeout — getLastNotificationResponseAsync() can
        // hang indefinitely on Android when Google Play Services is unavailable
        // or push permissions have not been granted. Without the timeout, this
        // async call becomes an orphan that could deep-link navigate unexpectedly
        // whenever it finally resolves (potentially after logout/re-login).
        const response = await Promise.race([
          SafeNotifications.getLastNotificationResponseAsync(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
        ]);
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

// Full-screen navy overlay shown on top of the (always-mounted) navigator while
// auth is resolving or while a redirect to the correct area is in flight. It is
// purely cosmetic — the navigator underneath is always live.
function LoadingOverlay() {
  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a" },
      ]}
    >
      <ActivityIndicator color="#c9a84c" size="large" />
    </View>
  );
}

// ── Single permanent navigator ──────────────────────────────────────────────
// Every route — auth screens AND authenticated screens — is registered here and
// the Stack is ALWAYS mounted, regardless of auth state. This is the core of the
// post-login freeze fix: because the navigator is never torn down or swapped
// based on auth state, router.replace() always has a mounted target and can
// never silently fail and strand the user on a blank navy screen.
function AppStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
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
      <Stack.Screen name="empresa" options={{ animation: "slide_from_right" }} />
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
}

function RootLayoutNav() {
  const {
    session,
    loading,
    isRecovering,
    mustChangePassword,
    needsProfileCompletion,
    profileChecked,
  } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const manutencao = isEnabled("manutencao");

  // Auth is "ready" once the session state is known and — when logged in — the
  // first profile fetch has resolved. Both conditions have upstream timeouts in
  // AuthContext, so authReady always settles within a few seconds.
  const authReady = !loading && !(session && !profileChecked);

  // Single source of truth for auth-driven navigation. The navigator is always
  // mounted (see render below), so these redirects can never fail silently.
  // There are no refs, no "navInitiated" latch, and no safety-net timers — the
  // previous design's many guard layers existed only to paper over the
  // conditional-Stack-swap bug that this permanent Stack removes entirely.
  useEffect(() => {
    if (!authReady) return;

    // The register screen owns its entire navigation flow: the account is
    // created mid-form (so the user becomes authenticated while still on
    // register) and register.tsx self-navigates to /subscription or /(tabs)
    // when done. Never redirect away from it — in particular, a transient
    // needsProfileCompletion=true must not bounce the user to /social-complete.
    if (pathname.includes("register")) return;

    const root = segments[0] as string | undefined;
    const inAuthGroup = root === "(auth)";
    const onAuthCallback = root === "auth"; // app/auth/callback.tsx (OAuth)
    const onMaintenance = root === "maintenance";
    const onSocialComplete = root === "social-complete";
    const onGate = root === undefined; // transient: no route resolved yet

    // Password recovery / forced password change always takes precedence.
    if (isRecovering || mustChangePassword) {
      if (!pathname.includes("reset-password")) {
        router.replace("/(auth)/reset-password" as any);
      }
      return;
    }

    // ── Unauthenticated ──
    if (!session) {
      if (onAuthCallback) return; // let the OAuth callback finish exchanging the code
      if (manutencao) {
        if (!onMaintenance && !inAuthGroup) router.replace("/maintenance" as any);
      } else if (!inAuthGroup) {
        router.replace("/(auth)/login" as any);
      }
      return;
    }

    // ── Authenticated ──
    // Social-auth users who still need to finish their profile go to social-complete.
    if (needsProfileCompletion) {
      if (!onSocialComplete) router.replace("/social-complete" as any);
      return;
    }

    // Authenticated with a complete profile: move them off the auth / callback /
    // maintenance / gate screens into the app. We deliberately do NOT redirect
    // from the register screen (it drives its own post-signup navigation, which
    // may target /subscription) nor from any in-app screen the user opened.
    if (onGate || onMaintenance || onAuthCallback || (inAuthGroup && !pathname.includes("register"))) {
      router.replace("/(tabs)" as any);
    }
  }, [
    authReady,
    session,
    isRecovering,
    mustChangePassword,
    needsProfileCompletion,
    manutencao,
    segments,
    pathname,
    router,
  ]);

  // Whether the current route matches the correct area for the current auth
  // state. While false we keep the navy overlay up so the user never sees a
  // flash of the wrong screen during the (near-instant) redirect above. This is
  // derived purely from current state + route, so it can never get permanently
  // stuck: once the redirect lands the user in the right area it flips to true.
  const onCorrectArea = (() => {
    const root = segments[0] as string | undefined;
    const inAuthGroup = root === "(auth)";
    // The register screen owns its entire flow (the account is created mid-form,
    // so the user is briefly authenticated while still on register). Never cover
    // it with the overlay or we would hide register's own loading UI.
    if (pathname.includes("register")) return true;
    if (isRecovering || mustChangePassword) return pathname.includes("reset-password");
    if (!session) return inAuthGroup || root === "auth" || root === "maintenance";
    if (needsProfileCompletion) return root === "social-complete";
    return !inAuthGroup; // authenticated: any non-auth screen is fine
  })();

  const showOverlay = !authReady || !onCorrectArea;
  const showSidebar = isDesktop && !!session && !isRecovering && !mustChangePassword;

  return (
    <>
      {!!session && !isRecovering && !mustChangePassword && (
        <>
          <UnreadSyncer />
          <PushNotificationHandler />
          <MaintenanceGuard />
        </>
      )}

      <View style={{ flex: 1, flexDirection: showSidebar ? "row" : "column" }}>
        {showSidebar && <SidebarNav key="sidebar" />}
        <View key="appstack" style={{ flex: 1 }}>
          <AppStack />
        </View>
      </View>

      {showOverlay && <LoadingOverlay />}
    </>
  );
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
