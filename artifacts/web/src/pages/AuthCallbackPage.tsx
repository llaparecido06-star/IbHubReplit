import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const timeout = setTimeout(() => {
      if (!cancelled) setError("Autenticação demorou demais. Tente novamente.");
    }, 12000);

    const searchParams = new URLSearchParams(
      window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search
    );
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
    );

    const code     = searchParams.get("code");
    const flowType = searchParams.get("type");

    // ── PKCE flow ─────────────────────────────────────────────────────────
    // Supabase JS v2 (detectSessionInUrl: true + flowType: "pkce") automatically
    // detects and exchanges the ?code= on client initialization.
    // Calling exchangeCodeForSession() manually here would fail with
    // "invalid request: code already used". We just subscribe to onAuthStateChange
    // and wait for SIGNED_IN, which fires after the internal exchange completes.
    if (code) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if (cancelled) { subscription.unsubscribe(); return; }

        if (event === "SIGNED_IN" && s) {
          subscription.unsubscribe();
          clearTimeout(timeout);
          setLocation(flowType === "recovery" ? "/redefinir-senha" : "/app");
        }

        // Edge case: INITIAL_SESSION already has a session (e.g. concurrent tab completed the flow)
        if (event === "INITIAL_SESSION" && s) {
          subscription.unsubscribe();
          clearTimeout(timeout);
          setLocation(flowType === "recovery" ? "/redefinir-senha" : "/app");
        }
      });
      unsubscribe = () => subscription.unsubscribe();
      return;
    }

    // ── Implicit / magic-link flow ─────────────────────────────────────────
    // Token fragment: #access_token=...&type=recovery (older Supabase projects
    // or when PKCE is disabled). type is in the hash, not the query string.
    async function handleImplicit() {
      try {
        const hashType = hashParams.get("type") ?? searchParams.get("type");

        if (hashType === "recovery") {
          const accessToken  = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
          if (!cancelled) { clearTimeout(timeout); setLocation("/redefinir-senha"); }
          return;
        }

        // Fragment tokens or session already established (implicit OAuth)
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          if (session) { clearTimeout(timeout); setLocation("/app"); return; }

          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
            if (cancelled) { subscription.unsubscribe(); return; }
            if (event === "SIGNED_IN" && s) {
              subscription.unsubscribe();
              clearTimeout(timeout);
              setLocation("/app");
            }
          });
          unsubscribe = () => subscription.unsubscribe();
        }
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message ?? "Erro ao autenticar.");
      }
    }

    void handleImplicit();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [setLocation]);

  if (error) {
    return (
      <div style={{
        minHeight: "100vh", backgroundColor: "#f2f3f5",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif", padding: 24,
      }}>
        <div style={{ backgroundColor: "#fdecea", border: "1px solid #f5c6cb", borderRadius: 12, padding: "20px 24px", maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ fontSize: 15, color: "#c0392b", marginBottom: 20 }}>{error}</p>
          <button
            onClick={() => setLocation("/login")}
            style={{
              backgroundColor: "#c9a84c", color: "#0d1b2a", fontWeight: 800,
              fontSize: 14, padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
            }}
          >Voltar ao login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#0d1b2a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 48, height: 48,
          border: "4px solid rgba(201,168,76,0.3)", borderTopColor: "#c9a84c",
          borderRadius: "50%", margin: "0 auto 20px",
          animation: "spin 1s linear infinite",
        }} />
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Autenticando...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
