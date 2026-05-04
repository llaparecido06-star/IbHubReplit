import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { supabase } from "@/context/AuthContext";

/**
 * OAuth callback screen — registered at /auth/callback
 *
 * On Android, Chrome Custom Tab fires the OAuth redirect as a deep link
 * (ibhub://auth/callback?code=xxx). Expo Router intercepts this URL and
 * renders this screen instead of showing "This screen doesn't exist" (404).
 *
 * Two code-exchange paths run in parallel (both are safe / idempotent):
 *   1. handleDeepLink in AuthContext (via Linking.addEventListener) — may
 *      arrive first and exchange the code before this component mounts.
 *   2. This component — exchanges the code if it hasn't been used yet.
 * The second exchange gets an "already used" error which is silently ignored.
 *
 * After a successful exchange, onAuthStateChange fires SIGNED_IN, AuthContext
 * sets session, and RootLayoutNav navigates to /(tabs) or /social-complete
 * automatically. This screen never needs to navigate itself.
 */
export default function AuthCallbackScreen() {
  const { code, error: oauthError } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const router = useRouter();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      if (oauthError) {
        console.warn("[auth/callback] OAuth provider returned error:", oauthError);
        router.replace("/(auth)/login" as any);
        return;
      }

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            const msg = error.message ?? "";
            if (!msg.includes("already") && !msg.includes("expired")) {
              console.error("[auth/callback] exchangeCodeForSession error:", msg);
            }
          }
          // SIGNED_IN will fire → onAuthStateChange drives navigation. Nothing to do here.
        } catch (e: any) {
          console.error("[auth/callback] unexpected error:", e?.message ?? e);
        }
        return;
      }

      // No code and no error — possibly an implicit-flow hash fragment.
      // handleDeepLink in AuthContext handles the #access_token=... case via
      // Linking.addEventListener, so we just wait and let onAuthStateChange fire.
    };

    run();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1b2a" }}>
      <ActivityIndicator color="#c9a84c" size="large" />
    </View>
  );
}
