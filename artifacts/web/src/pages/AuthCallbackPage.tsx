import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Hard timeout: if auth doesn't resolve in 12s, show an error.
    const timeout = setTimeout(() => {
      if (!cancelled) setError("Autenticação demorou demais. Tente novamente.");
    }, 12000);

    async function handleCallback() {
      try {
        const hash   = window.location.hash;
        const search = window.location.search;
        const searchParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        const hashParams   = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : "");

        const code     = searchParams.get("code");
        const flowType = searchParams.get("type");

        // ── PKCE flow ─────────────────────────────────────────────────────────
        // Supabase sends a one-time ?code=xxx for both OAuth sign-in and password
        // recovery. We pass ?type=recovery in the redirectTo so we can tell them apart.
        if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled) {
            if (err) { setError(err.message); return; }
            setLocation(flowType === "recovery" ? "/redefinir-senha" : "/app");
          }
          return;
        }

        // ── Implicit / magic-link flow ─────────────────────────────────────────
        // Token fragment: #access_token=...&type=recovery (older Supabase projects
        // or when PKCE is disabled). type is in the hash, not the query string.
        const hashType = hashParams.get("type") ?? searchParams.get("type");
        if (hashType === "recovery") {
          const accessToken  = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
          if (!cancelled) setLocation("/redefinir-senha");
          return;
        }

        // Implicit OAuth (fragment tokens) or session already established
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          if (session) { setLocation("/app"); return; }

          // Last resort: wait for onAuthStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
            if (cancelled) { subscription.unsubscribe(); return; }
            if (event === "SIGNED_IN" && s) {
              subscription.unsubscribe();
              setLocation("/app");
            }
          });
        }
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message ?? "Erro ao autenticar.");
      }
    }

    void handleCallback();
    return () => { cancelled = true; clearTimeout(timeout); };
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
