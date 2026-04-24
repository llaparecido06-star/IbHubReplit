import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, bustSessionCache, getCachedSession } from "@/lib/supabase";

export interface ActiveCompany {
  id: string;
  name: string;
  avatar_url?: string | null;
  description?: string | null;
  website?: string | null;
  industry?: string | null;
}

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
  country: string | null;
  referral_code: string | null;
  invited_by_id: string | null;
  is_admin: boolean;
  is_banned: boolean;
  certifications?: string[] | null;
  // Stripe
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  courtesy_until: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  mustChangePassword: boolean;
  activeCompany: ActiveCompany | null;
  setActiveCompany: (company: ActiveCompany | null) => void;
  suspensionMsg: string | null;
  clearSuspensionMsg: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  refreshProfileByUserId: (userId: string) => Promise<void>;
  patchProfile: (patch: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isProfileComplete(data: unknown): boolean {
  return !!(data as { username?: string })?.username?.trim();
}

function hasMustChangeFlag(session: Session | null): boolean {
  return session?.user?.user_metadata?.must_change_password === true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [suspensionMsg, setSuspensionMsg] = useState<string | null>(null);
  const clearSuspensionMsg = useCallback(() => setSuspensionMsg(null), []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Use limit(1) to avoid "multiple rows" error if duplicate profiles exist
      const { data: rows, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${userId},user_id.eq.${userId}`)
        .limit(1);
      const data = rows?.[0] ?? null;
      if (!error && data) {
        const d = data as Record<string, unknown>;
        const headline =
          (d.headline as string | null) ??
          ([d.position, d.company].filter(Boolean).join(" · ") || null);
        const areas_of_expertise: string[] =
          Array.isArray(d.areas_of_expertise) ? d.areas_of_expertise as string[] :
          Array.isArray(d.areas) ? d.areas as string[] : [];
        setProfile({ ...d, headline, areas_of_expertise } as Profile);
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

  useEffect(() => {
    let done = false;

    // Hard 5s safety: unblock the app if INITIAL_SESSION never fires or fetchProfile hangs.
    const safetyTimer = setTimeout(() => {
      if (!done) { done = true; setLoading(false); }
    }, 5000);

    const finishLoading = () => {
      if (!done) { done = true; clearTimeout(safetyTimer); }
      setLoading(false);
    };

    // DO NOT call supabase.auth.getSession() here.
    // Registering onAuthStateChange immediately fires INITIAL_SESSION (gotrue-js fires it
    // internally using its own getSession() call). Adding a second explicit getSession() call
    // creates two concurrent lock acquisitions that race, causing:
    //   "Lock was released because another request stole it"
    // If that error hits the explicit call's .catch(), it sets session=null → PrivateRoute
    // redirects to /login even though the user IS signed in. Use INITIAL_SESSION only.

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // CRITICAL: synchronous callback — do NOT make this async.
      // gotrue-js holds the navigator lock while calling subscribers. Any await inside
      // here keeps the lock held for the entire DB call duration, starving all other
      // auth operations and causing the "lock stolen" error cascade.

      bustSessionCache();

      setSession(session);
      setUser(session?.user ?? null);
      setMustChangePassword(hasMustChangeFlag(session));

      if (session?.user) {
        const u = session.user;

        // profilePromise runs AFTER the lock is released (fire-and-forget).
        const profilePromise = fetchProfile(u.id);

        // INITIAL_SESSION: finish loading after the first profile fetch completes.
        if (event === "INITIAL_SESSION") {
          profilePromise.finally(finishLoading);
        }

        // SIGNED_IN: safety net to ensure a profile row exists for social-auth users.
        if (event === "SIGNED_IN") {
          profilePromise
            .then(() => {
              const meta = u.user_metadata ?? {};
              const googleName = (meta.full_name ?? meta.name ?? u.email?.split("@")[0] ?? "") as string;
              const googleAvatar = (meta.avatar_url ?? meta.picture ?? null) as string | null;
              return supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .or(`id.eq.${u.id},user_id.eq.${u.id}`)
                .limit(1)
                .then(({ data: rows }) => {
                  const existing = (rows ?? [])[0] ?? null;
                  if (!existing) {
                    return supabase.from("profiles").insert({
                      id: u.id,
                      user_id: u.id,
                      full_name: googleName || null,
                      avatar_url: googleAvatar,
                      plan: "gratuito",
                    }).then(() => fetchProfile(u.id));
                  } else if (!existing.full_name && googleName) {
                    const update: Record<string, string | null> = { user_id: u.id, full_name: googleName };
                    if (!existing.avatar_url && googleAvatar) update.avatar_url = googleAvatar;
                    return supabase.from("profiles").update(update).eq("id", existing.id)
                      .then(() => fetchProfile(u.id));
                  }
                });
            })
            .catch(() => {});
        }

        // SIGNED_OUT / TOKEN_REFRESHED with no session: unblock loading.
      } else {
        setProfile(null);
        if (event === "INITIAL_SESSION" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
          finishLoading();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [fetchProfile]);

  // Realtime: detect when admin updates this user's profile (ban, plan, courtesy, etc.)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-watcher-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        async (payload) => {
          const updated = payload.new as { is_banned?: boolean };
          if (updated.is_banned === true) {
            setSuspensionMsg("Sua conta foi suspensa. Entre em contato com o suporte.");
            await supabase.auth.signOut();
          } else {
            // Refresh profile for plan/courtesy/shadowban changes so entitlements apply immediately.
            await fetchProfile(user.id);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message ?? "";
      if (msg.toLowerCase().includes("ban") || msg.toLowerCase().includes("suspend")) {
        return { error: "Sua conta foi suspensa. Entre em contato com o suporte." };
      }
      return { error: msg };
    }
    // Use getCachedSession() instead of supabase.auth.getUser() to avoid re-acquiring
    // the navigator lock immediately after signInWithPassword released it.
    const session = await getCachedSession();
    const authedUser = session?.user ?? null;
    if (authedUser) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("id", authedUser.id)
        .maybeSingle();
      if ((prof as { is_banned?: boolean } | null)?.is_banned) {
        await supabase.auth.signOut();
        return { error: "Sua conta foi suspensa. Entre em contato com o suporte." };
      }
    }
    return { error: null };
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

  const getRedirectUrl = () => {
    const base = window.location.origin;
    const basePath = import.meta.env.BASE_URL ?? "/";
    return `${base}${basePath}auth/callback`;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getRedirectUrl() },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    // scope:'local' clears storage without a network call — works even offline
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const base = window.location.origin;
    const basePath = import.meta.env.BASE_URL ?? "/";
    // Route recovery through /auth/callback (already in Supabase allowlist for OAuth).
    // We pass ?type=recovery so AuthCallbackPage can redirect to /redefinir-senha
    // instead of /app after the PKCE code exchange.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${base}${basePath}auth/callback?type=recovery`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      // Clear the must_change_password flag in user_metadata
      await supabase.auth.updateUser({ data: { must_change_password: false } }).catch(() => {});
      setMustChangePassword(false);
    }
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading,
      mustChangePassword,
      activeCompany, setActiveCompany,
      suspensionMsg, clearSuspensionMsg,
      signIn, signUp, signInWithGoogle, signOut,
      resetPassword, updatePassword,
      refreshProfile, refreshProfileByUserId, patchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
