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
//
// IMPORTANT: getLastNotificationResponseAsync() can hang indefinitely on Android
// when push notification permissions have not been granted or Google Play Services
// is unavailable. We race it against a 1.5 s timeout so coldStartDeepLinkPromise
// always settles promptly and the navigation IIFE is never permanently blocked.
const coldStartDeepLinkPromise: Promise<string | null> = (async () => {
  try {
    const response = await Promise.race([
      SafeNotifications.getLastNotificationResponseAsync(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
    ]);
    if (response) {
      const data = response.notification.request.content.data ?? {};
      const deepLink = (data as { deepLink?: string }).deepLink;
      if (deepLink && typeof deepLink === "string" && deepLink.startsWith("/")) {
        console.log("[ColdStart] deep-link from notification:", deepLink);
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

  // True while the cold-start IIFE (await coldStartDeepLinkPromise → router.replace)
  // is in flight. Prevents the !shouldRedirect branch from calling setNavInitiated(true)
  // before router.replace has been called, which would render AuthenticatedLayout with
  // an empty Stack (navy frozen screen) when flagsLoading or manutencao changes mid-IIFE.
  const navIifePendingRef = useRef(false);

  // Synchronous mirror of navInitiated state. navInitiated is React state (async commit),
  // so there is a brief window between navIifePendingRef.current=false and navInitiated
  // becoming true in which TOKEN_REFRESHED can re-trigger the effect and launch a second
  // IIFE → double router.replace → Android loop. navInitiatedRef is set synchronously
  // before navIifePendingRef is reset, closing that window entirely.
  const navInitiatedRef = useRef(false);

  // Guards the safety-net timer so it is only armed once per login session.
  // Without this, every TOKEN_REFRESHED event (frequent on Android) changes
  // `session`, re-runs the safety-net useEffect, cancels the in-flight timeout,
  // and starts a fresh 3 s timer — so it never fires and the spinner hangs
  // forever if the main IIFE is also blocked (e.g. coldStartDeepLinkPromise stall).
  const safetyNetArmed = useRef(false);

  // Reset the armed flag whenever the user logs out so a subsequent login
  // can re-arm the safety net if needed.
  useEffect(() => {
    if (!session) {
      safetyNetArmed.current = false;
      console.log("[RootLayoutNav] session cleared — safety-net flag reset");
    }
  }, [session]);

  // Auth routes that must remain accessible without a session
  const isAuthPath = ["login", "register", "forgot-password", "reset-password", "auth"].some(
    (p) => pathname.includes(p),
  );

  useEffect(() => {
    console.log(
      `[RootLayoutNav] effect — loading=${loading} session=${!!session} profileChecked=${profileChecked}` +
      ` navInitiated=${navInitiated} navIifePending=${navIifePendingRef.current}` +
      ` isAuthPath=${isAuthPath} needsCompletion=${needsProfileCompletion}`
    );

    if (loading || isRecovering || mustChangePassword) return;

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
    if (!profileChecked) {
      console.log("[RootLayoutNav] waiting for profileChecked…");
      return;
    }

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
      // IMPORTANT: do NOT set navInitiated=true if the navigation IIFE is still
      // in flight — calling it here would render AuthenticatedLayout before
      // router.replace completes, producing an empty Stack (navy frozen screen).
      // The IIFE calls setNavInitiated(true) itself once router.replace is done.
      if (!navIifePendingRef.current) {
        navInitiatedRef.current = true;
        setNavInitiated(true);
      }
      return;
    }

    // Guard against double-navigation on Android (and any platform):
    // After the first router.replace("/(tabs)") fires, there is a brief window
    // where isAuthPath is still true (pathname hasn't updated yet) but the
    // session object changes due to a TOKEN_REFRESHED event. Without this
    // guard the effect would re-run with shouldRedirect=true (isAuthPath &&
    // same destination) and launch a second async IIFE that calls router.replace
    // a second time — causing the "advances, freezes, goes back" freeze on Android.
    //
    // navInitiatedRef (sync) is checked alongside navInitiated (async state) so
    // the guard fires immediately even before React commits the state update.
    if ((navInitiated || navInitiatedRef.current) && lastDestination.current === destination) {
      return;
    }

    // Never auto-redirect from the register screen — it drives its own
    // navigation at the end of the signup flow. Set lastDestination so that
    // when the register screen calls router.replace and the pathname changes,
    // the re-run of this effect finds shouldRedirect=false and sets
    // navInitiated=true without issuing a second router.replace.
    // Do NOT call setNavInitiated(true) here: AuthenticatedLayout must not
    // render until router.replace has been called, otherwise the Stack has
    // no active route and shows a blank screen.
    if (pathname.includes("register")) {
      lastDestination.current = destination;
      return;
    }

    // Edge case: needsProfileCompletion=true but already on social-complete or
    // an auth screen → don't bounce the user off it.
    const completionBlockPaths = ["social-complete", "reset-password", "forgot-password"];
    if (needsProfileCompletion && completionBlockPaths.some(p => pathname.includes(p))) {
      lastDestination.current = destination;
      navInitiatedRef.current = true;
      setNavInitiated(true);
      return;
    }

    lastDestination.current = destination;

    // Guard: if a navigation IIFE is already in flight (e.g. TOKEN_REFRESHED
    // fired while the IIFE was awaiting coldStartDeepLinkPromise), do NOT start
    // a second IIFE. lastDestination is already set above, so the next effect
    // re-run will find shouldRedirect=false and the !navIifePendingRef.current
    // check will set navInitiated=true once the IIFE finishes.
    // Without this guard, two concurrent IIFEs both call router.replace("/(tabs)")
    // → double-replace → Android "avança 1cm e volta" infinite loop.
    if (navIifePendingRef.current) {
      return;
    }

    // For /(tabs), check whether a cold-start notification was tapped.
    // The deep link was pre-fetched at module load so the promise is already
    // settled by the time we get here, keeping navigation instantaneous.
    // NOTE: coldStartDeepLinkPromise is now raced against a 1.5 s timeout so
    // it always settles — getLastNotificationResponseAsync() can hang on Android.
    if (destination === "/(tabs)") {
      navIifePendingRef.current = true;
      console.log("[RootLayoutNav] IIFE started — awaiting coldStartDeepLinkPromise");
      (async () => {
        const coldLink = await coldStartDeepLinkPromise;
        console.log("[RootLayoutNav] IIFE resolved — coldLink:", coldLink ?? "null");
        if (coldLink && !coldStartLinkConsumed) {
          coldStartLinkConsumed = true;
          console.log("[RootLayoutNav] router.replace →", coldLink);
          router.replace(coldLink as any);
        } else {
          console.log("[RootLayoutNav] router.replace → /(tabs)");
          router.replace("/(tabs)" as any);
        }
        // Set navInitiatedRef BEFORE clearing navIifePendingRef so the guard
        // at the top of the effect fires synchronously if TOKEN_REFRESHED
        // re-triggers the effect before React commits setNavInitiated(true).
        navInitiatedRef.current = true;
        navIifePendingRef.current = false;
        setNavInitiated(true);
        console.log("[RootLayoutNav] navInitiated set to true");
      })();
    } else {
      console.log("[RootLayoutNav] router.replace →", destination);
      navInitiatedRef.current = true;
      router.replace(destination as any);
      setNavInitiated(true);
    }
  }, [
    session, loading, isRecovering, mustChangePassword, manutencao,
    isAuthPath, needsProfileCompletion, profileChecked, pathname,
    navInitiated,
  ]);

  // Safety-net: if the navigation effect somehow never fires (e.g. the main IIFE
  // is blocked), unblock after 3 s.
  //
  // CRITICAL: do NOT cancel the timer on re-runs caused by TOKEN_REFRESHED.
  // On Android, TOKEN_REFRESHED fires repeatedly and changes `session`, which
  // re-runs this effect and resets the timeout via the cleanup — so it NEVER
  // fires, leaving the spinner up forever.
  //
  // Solution: arm the timer only once via `safetyNetArmed` ref. Subsequent
  // re-runs from TOKEN_REFRESHED hit the early-return and don't create a new
  // timer, so the original 3 s countdown runs to completion undisturbed.
  // The callback checks navInitiatedRef.current to skip if navigation already
  // happened before the 3 s elapsed.
  useEffect(() => {
    if (navInitiated || loading || !session || !profileChecked || isRecovering || mustChangePassword) return;
    if (safetyNetArmed.current) return;
    safetyNetArmed.current = true;
    console.log("[RootLayoutNav] safety-net armed (3 s)");
    setTimeout(() => {
      if (navInitiatedRef.current) return;
      console.warn("[RootLayoutNav] safety-net fired — forcing navigation");
      const destination = needsProfileCompletion ? "/social-complete" : "/(tabs)";
      navInitiatedRef.current = true;
      router.replace(destination as any);
      setNavInitiated(true);
    }, 3_000);
    // Intentionally no cleanup: we never cancel this timer once armed.
    // safetyNetArmed.current prevents double-arming on re-runs.
  }, [navInitiated, loading, session, profileChecked, isRecovering, mustChangePassword, needsProfileCompletion, router]);

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
