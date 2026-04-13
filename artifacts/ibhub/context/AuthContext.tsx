import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: async (key: string) => AsyncStorage.getItem(key),
      setItem: async (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: async (key: string) => AsyncStorage.removeItem(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

interface Profile {
  id: string;
  user_id: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  headline: string | null;
  position: string | null;
  company: string | null;
  plan: string | null;
  areas_of_expertise: string[];
  areas: string[];
  country: string | null;
  referral_code: string | null;
  invited_by_id: string | null;
  avatar_url?: string | null;
  industry?: string | null;
}

interface ActiveCompany {
  id: string;
  name: string;
  avatar_url?: string | null;
  industry?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isRecovering: boolean;
  needsProfileCompletion: boolean;
  activeCompany: ActiveCompany | null;
  setActiveCompany: (company: ActiveCompany | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  clearRecovery: () => void;
  clearProfileCompletion: () => void;
  refreshProfile: () => Promise<void>;
  refreshProfileByUserId: (userId: string) => Promise<void>;
  patchProfile: (patch: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Parses `access_token`, `refresh_token`, and `type` from a deep link URL fragment */
function parseRecoveryUrl(url: string): { accessToken: string; refreshToken: string } | null {
  try {
    const fragment = url.split("#")[1] ?? url.split("?")[1] ?? "";
    const params = Object.fromEntries(new URLSearchParams(fragment));
    if (params.type === "recovery" && params.access_token && params.refresh_token) {
      return { accessToken: params.access_token, refreshToken: params.refresh_token };
    }
  } catch {}
  return null;
}

/** Check if a profile has the minimum required fields filled */
function isProfileComplete(data: any): boolean {
  const hasName = !!data?.full_name?.trim();
  const hasUsername = !!data?.username?.trim();
  const hasAreas =
    (Array.isArray(data?.areas_of_expertise) && data.areas_of_expertise.length > 0) ||
    (Array.isArray(data?.areas) && data.areas.length > 0);
  return hasName && hasUsername && hasAreas;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]                   = useState<Session | null>(null);
  const [user, setUser]                         = useState<User | null>(null);
  const [profile, setProfile]                   = useState<Profile | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [isRecovering, setIsRecovering]         = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [activeCompany, setActiveCompany]       = useState<ActiveCompany | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${userId},user_id.eq.${userId}`)
        .maybeSingle();
      if (!error && data) {
        const d = data as any;
        const headline =
          d.headline ??
          ([d.position, d.company].filter(Boolean).join(" · ") || null);
        const areas_of_expertise: string[] =
          Array.isArray(d.areas_of_expertise) ? d.areas_of_expertise :
          Array.isArray(d.areas) ? d.areas : [];
        setProfile({ ...d, headline, areas_of_expertise } as Profile);
        setNeedsProfileCompletion(!isProfileComplete({ ...d, areas_of_expertise }));
      } else {
        // No profile row yet — new social auth user
        setNeedsProfileCompletion(true);
      }
    } catch {}
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const refreshProfileByUserId = useCallback(async (userId: string) => {
    await fetchProfile(userId);
  }, [fetchProfile]);

  const patchProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => prev ? { ...prev, ...patch } : prev);
  }, []);

  const clearProfileCompletion = useCallback(() => {
    setNeedsProfileCompletion(false);
  }, []);

  /** Handles a deep link URL — sets session if it is a password recovery link */
  const handleDeepLink = useCallback(async (url: string | null) => {
    if (!url) return;
    const tokens = parseRecoveryUrl(url);
    if (tokens) {
      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (!error) setIsRecovering(true);
    }
  }, []);

  useEffect(() => {
    // Complete any pending auth sessions (handles OAuth redirects on app resume)
    WebBrowser.maybeCompleteAuthSession();

    // 1. Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Auth state changes (including PASSWORD_RECOVERY and OAuth SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovering(true);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);

        // Apply pending referral code (saved by registration screen before sign-up).
        if (event === "SIGNED_IN") {
          try {
            const pendingCode = await AsyncStorage.getItem("pending_invite_code");
            if (pendingCode) {
              const { data: prof } = await supabase
                .from("profiles")
                .select("invited_by_id")
                .eq("id", session.user.id)
                .single();
              if (!prof?.invited_by_id) {
                const { data: inviter } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("referral_code", pendingCode.trim().toUpperCase())
                  .maybeSingle();
                if (inviter?.id && inviter.id !== session.user.id) {
                  await supabase
                    .from("profiles")
                    .update({ invited_by_id: inviter.id })
                    .eq("id", session.user.id);
                }
              }
              await AsyncStorage.removeItem("pending_invite_code");
            }
          } catch {}
        }
      } else {
        setProfile(null);
        setNeedsProfileCompletion(false);
      }
    });

    // 3. Handle deep link that launched the app (cold start)
    Linking.getInitialURL().then(handleDeepLink);

    // 4. Handle deep links while app is already open (warm start)
    const linkSub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, [fetchProfile, handleDeepLink]);

  const clearRecovery = useCallback(() => setIsRecovering(false), []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };

    if (data.user) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        return { error: "Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar." };
      }
    }
    return { error: null };
  };

  /** Build the redirect URI for OAuth — works in Expo Go and production */
  const getRedirectUri = () => Linking.createURL("auth/callback");

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    try {
      const redirectTo = getRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error: error.message };
      if (!data?.url) return { error: "Não foi possível iniciar o login com Google." };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (err) return { error: err.message };
        }
      } else if (result.type === "cancel") {
        return { error: null }; // user cancelled, no error
      }
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? "Erro ao entrar com Google." };
    }
  };

  const signInWithApple = async (): Promise<{ error: string | null }> => {
    try {
      const redirectTo = getRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error: error.message };
      if (!data?.url) return { error: "Não foi possível iniciar o login com Apple." };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (err) return { error: err.message };
        }
      } else if (result.type === "cancel") {
        return { error: null };
      }
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? "Erro ao entrar com Apple." };
    }
  };

  const signOut = async () => {
    setActiveCompany(null);
    setNeedsProfileCompletion(false);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "ibhub://reset-password",
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setIsRecovering(false);
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, loading, isRecovering, needsProfileCompletion,
        activeCompany, setActiveCompany,
        signIn, signUp, signInWithGoogle, signInWithApple, signOut,
        resetPassword, updatePassword, clearRecovery, clearProfileCompletion,
        refreshProfile, refreshProfileByUserId, patchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
