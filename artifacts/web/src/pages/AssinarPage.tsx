import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { createCheckoutSession } from "@/services/stripe";

const NAVY  = "#0d1b2a";
const GOLD  = "#c9a84c";
const WINE  = "#722f37";

interface Plan {
  id: string;
  name: string;
  price: string;
  period?: string;
  subtitle: string;
  popular?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "basico",
    name: "Básico",
    price: "Grátis",
    subtitle: "Para iniciantes e exploradores",
    features: [
      "Perfil público completo",
      "Feed de publicações",
      "5 conexões por mês",
      "Acesso ao chat básico",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "R$ 149",
    period: "/mês",
    subtitle: "Para profissionais do vinho",
    popular: true,
    features: [
      "Tudo do Básico",
      "Conexões ilimitadas",
      "Marketplace B2B",
      "Dados de mercado",
      "Criação de grupos",
    ],
  },
  {
    id: "exclusive",
    name: "Exclusive",
    price: "R$ 299",
    period: "/mês",
    subtitle: "Para especialistas e líderes",
    features: [
      "Tudo do Premium",
      "Inteligência de mercado avançada",
      "Apresentações exclusivas",
      "Destaque no feed",
      "Smart Match B2B",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "R$ 499",
    period: "/mês",
    subtitle: "Para empresas e distribuidoras",
    features: [
      "Tudo do Exclusive",
      "Página empresarial",
      "Publicação de vagas",
      "Analytics avançado",
      "Suporte prioritário",
    ],
  },
];

const PLAN_LABELS: Record<string, string> = {
  basico: "Básico",
  premium: "Premium",
  exclusive: "Exclusive",
  business: "Business",
};

export default function AssinarPage() {
  const { session, profile } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = profile?.plan ?? "basico";
  const hasActiveSub =
    (profile as any)?.stripe_subscription_status === "active" ||
    (profile as any)?.stripe_subscription_status === "trialing";

  async function handleAssinar(plan: Plan) {
    if (plan.id === "basico") {
      setError("O plano Básico é gratuito — não é necessária assinatura.");
      return;
    }
    if (!session) {
      // Save intended plan and redirect to login
      sessionStorage.setItem("redirect_after_login", `/assinar?plano=${plan.id}`);
      setLocation("/login");
      return;
    }

    setLoading(plan.id);
    setError(null);
    try {
      const { url } = await createCheckoutSession(session.access_token, plan.id);
      window.location.href = url;
    } catch (e: any) {
      setError(e.message ?? "Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f6f7f9", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header style={{ backgroundColor: NAVY, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => setLocation(session ? "/app" : "/")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}
        >
          <span style={{ fontSize: 20 }}>←</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: GOLD }}>ibhub</span>
        </button>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 15 }}>Assinar</span>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: NAVY, marginBottom: 12 }}>
            Escolha seu plano
          </h1>
          <p style={{ fontSize: 16, color: "#8a93a2", maxWidth: 520, margin: "0 auto" }}>
            Desbloqueie todo o potencial da maior rede do mundo vitivinícola. Cancele quando quiser.
          </p>
          {session && currentPlan !== "basico" && (
            <div style={{
              display: "inline-block", marginTop: 14,
              backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}40`,
              borderRadius: 100, padding: "6px 18px",
            }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>
                Plano atual: {PLAN_LABELS[currentPlan] ?? currentPlan}
                {hasActiveSub ? " · Ativo" : ""}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div style={{
            backgroundColor: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 10, padding: "14px 18px", marginBottom: 24,
            color: "#dc2626", fontSize: 14, textAlign: "center",
          }}>
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}>
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isPaid = plan.id !== "basico";
            const isLoading = loading === plan.id;

            return (
              <div
                key={plan.id}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  border: isCurrent ? `2px solid ${GOLD}` : "1px solid #e8eaed",
                  padding: "28px 24px",
                  position: "relative",
                  boxShadow: plan.popular ? "0 8px 32px rgba(201,168,76,0.15)" : "none",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                    backgroundColor: GOLD, color: "#0d1b2a", fontWeight: 800,
                    fontSize: 11, padding: "4px 16px", borderRadius: 100, letterSpacing: 0.8,
                  }}>
                    MAIS POPULAR
                  </div>
                )}

                <h2 style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginBottom: 4 }}>{plan.name}</h2>
                <p style={{ fontSize: 13, color: "#8a93a2", marginBottom: 16 }}>{plan.subtitle}</p>

                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: GOLD }}>{plan.price}</span>
                  {plan.period && <span style={{ fontSize: 15, color: "#8a93a2" }}>{plan.period}</span>}
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151" }}>
                      <span style={{ color: GOLD, fontSize: 16, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div style={{
                    backgroundColor: `${GOLD}12`, border: `1px solid ${GOLD}30`,
                    borderRadius: 10, padding: "13px 0", textAlign: "center",
                    color: GOLD, fontWeight: 700, fontSize: 15,
                  }}>
                    Plano atual
                  </div>
                ) : (
                  <button
                    onClick={() => handleAssinar(plan)}
                    disabled={isLoading || !!loading}
                    style={{
                      backgroundColor: isPaid ? GOLD : `${NAVY}12`,
                      color: isPaid ? NAVY : NAVY,
                      border: isPaid ? "none" : `1px solid ${NAVY}30`,
                      borderRadius: 10,
                      padding: "14px 0",
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: "pointer",
                      opacity: (isLoading || (!!loading && loading !== plan.id)) ? 0.7 : 1,
                    }}
                  >
                    {isLoading ? "Aguarde..." : isPaid ? `Assinar ${plan.name}` : "Usar gratuitamente"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Trust signals */}
        <div style={{ textAlign: "center", marginTop: 48, color: "#8a93a2", fontSize: 13, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
          <span>🔒 Pagamento 100% seguro via Stripe</span>
          <span>💳 Cartão de crédito</span>
          <span>❌ Cancele quando quiser</span>
          <span>🇧🇷 Preços em Reais</span>
        </div>
      </div>
    </div>
  );
}
