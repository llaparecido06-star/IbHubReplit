import React from "react";
import { useLocation } from "wouter";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const MUTED  = "#7a8494";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";

interface PaywallPageProps {
  featureName: string;
  description?: string;
  requiredPlan?: string;
}

export function PaywallPage({ featureName, description, requiredPlan }: PaywallPageProps) {
  const [, setLocation] = useLocation();

  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: BG }}>
      <div style={{
        background: "#fff",
        borderRadius: 20,
        border: `1px solid ${BORDER}`,
        padding: "40px 36px",
        maxWidth: 420,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: `${GOLD}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
        }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, textAlign: "center" }}>
          Recurso Premium
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, textAlign: "center" }}>
          {featureName}
        </div>
        <div style={{ fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 1.6 }}>
          {description ?? "Este recurso está disponível nos planos pagos do ibhub."}
        </div>
        {requiredPlan && (
          <div style={{
            background: `${GOLD}12`, borderRadius: 20,
            padding: "6px 16px", fontSize: 13, fontWeight: 600, color: GOLD,
          }}>
            A partir do plano {requiredPlan}
          </div>
        )}
        <button
          onClick={() => setLocation("/comunidade-exclusiva")}
          style={{
            background: GOLD, color: "#fff", border: "none",
            borderRadius: 12, padding: "14px 28px",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, marginTop: 4,
          }}
        >
          ⚡ Ver Planos e Assinar
        </button>
        <button
          onClick={() => window.history.back()}
          style={{
            background: "transparent", border: "none",
            color: MUTED, fontSize: 14, cursor: "pointer", padding: "8px 0",
          }}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
