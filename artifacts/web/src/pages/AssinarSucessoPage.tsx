import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

const NAVY = "#0d1b2a";
const GOLD = "#c9a84c";

const PLAN_LABELS: Record<string, string> = {
  premium: "Premium",
  exclusive: "Exclusive",
  business: "Business",
};

export default function AssinarSucessoPage() {
  const { session, refreshProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(8);

  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plano") ?? "";
  const planLabel = PLAN_LABELS[plan] ?? plan;

  // Refresh profile so UI reflects new plan immediately
  useEffect(() => {
    if (session) {
      refreshProfile();
    }
  }, []);

  // Countdown to redirect
  useEffect(() => {
    if (countdown <= 0) {
      setLocation("/app");
      return;
    }
    const t = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: NAVY,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif",
      padding: 24,
    }}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: "48px 40px",
        maxWidth: 480,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: NAVY, marginBottom: 10 }}>
          Assinatura confirmada!
        </h1>
        {planLabel && (
          <div style={{
            display: "inline-block",
            backgroundColor: `${GOLD}14`,
            border: `1px solid ${GOLD}40`,
            borderRadius: 100,
            padding: "6px 20px",
            marginBottom: 20,
          }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 15 }}>
              Plano {planLabel} ativado 🍷
            </span>
          </div>
        )}
        <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.7, marginBottom: 28 }}>
          Bem-vindo ao ibhub {planLabel}! Seu plano já está ativo.
          Volte ao app para aproveitar todos os benefícios.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={() => setLocation("/app")}
            style={{
              backgroundColor: GOLD, color: NAVY,
              border: "none", borderRadius: 12,
              padding: "16px 0", fontSize: 16, fontWeight: 800, cursor: "pointer",
            }}
          >
            Ir para o feed
          </button>
          <button
            onClick={() => setLocation("/minha-conta")}
            style={{
              backgroundColor: "transparent", color: "#8a93a2",
              border: "1px solid #e8eaed", borderRadius: 12,
              padding: "14px 0", fontSize: 14, cursor: "pointer",
            }}
          >
            Ver minha conta
          </button>
        </div>

        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 20 }}>
          Redirecionando em {countdown}s…
        </p>
      </div>
    </div>
  );
}
