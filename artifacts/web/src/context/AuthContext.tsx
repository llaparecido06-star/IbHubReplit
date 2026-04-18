import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<ActiveCompany | null>(null);
  const [suspensionMsg, setSuspensionMsg] = useState<string | null>(null);
  const clearSuspensionMsg = useCallback(() => setSuspensionMsg(null), []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${userId},user_id.eq.${userId}`)
        .maybeSingle();
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);

        // Safety net: create a minimal profile for new social-auth users
        // (Google, etc.) if the DB trigger didn't run.
        if (event === "SIGNED_IN") {
          try {
            const u = session.user;
            const { count } = await supabase
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .or(`id.eq.${u.id},user_id.eq.${u.id}`);
            if (count === 0) {
              const meta = u.user_metadata ?? {};
              await supabase.from("profiles").upsert({
                user_id: u.id,
                full_name: meta.full_name ?? meta.name ?? (u.email?.split("@")[0] ?? ""),
                avatar_url: meta.avatar_url ?? meta.picture ?? null,
                plan: "gratuito",
              }, { onConflict: "user_id", ignoreDuplicates: true });
              await fetchProfile(u.id);
            }
          } catch {}
        }
      } else {
        setProfile(null);
      }
    });

    return () => { subscription.unsubscribe(); };
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
    const { data: { user: authedUser } } = await supabase.auth.getUser();
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
    const basePath = import.meta.env.BASE_URL ?? "/web/";
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
    await supabase.auth.signOut();
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const base = window.location.origin;
    const basePath = import.meta.env.BASE_URL ?? "/web/";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${base}${basePath}redefinir-senha`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading,
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
