import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { createCheckoutSession } from "@/services/stripe";
import { hasPlanAccess } from "@/utils/entitlement";
import { usePlans, formatPlanPrice, formatOriginalPrice, calcDiscount } from "@/hooks/usePlans";

const NAVY = "#0d1b2a";
const GOLD = "#c9a84c";

export default function AssinarPage() {
  const { session, profile } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  const { paidPlans, freePlan, getPlanLabel, loading: plansLoading } = usePlans();

  const currentPlan  = profile?.plan ?? "gratuito";
  const hasActiveSub = hasPlanAccess(profile);
  const isFree       = !hasActiveSub;

  async function handleAssinar(planId: string) {
    if (!session) {
      sessionStorage.setItem("redirect_after_login", `/assinar?plano=${planId}`);
      setLocation("/login");
      return;
    }
    setLoading(planId);
    setError(null);
    try {
      const { url } = await createCheckoutSession(session.access_token, planId);
      window.location.href = url;
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Erro ao iniciar checkout. Tente novamente.";
      const message = raw.toLowerCase().includes("no such price")
        ? "Erro de configuração: price ID inválido no Stripe. Verifique o Stripe Price ID no Plan Builder."
        : raw;
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    if (autoTriggered.current || !session || plansLoading || paidPlans.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const planoParam = params.get("plano");
    if (!planoParam) return;
    const plan = paidPlans.find(p => p.id === planoParam);
    if (!plan) return;
    autoTriggered.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    handleAssinar(planoParam);
  }, [session, plansLoading, paidPlans]);

  const ACCENT_COLORS = ["#c9a84c", "#0d1b2a", "#722f37"];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header style={{ backgroundColor: NAVY, padding: "18px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => setLocation(session ? "/app" : "/")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}
        >
          <span style={{ fontSize: 20 }}>←</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: GOLD }}>ibhub</span>
        </button>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>Assinar</span>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "52px 20px 60px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            backgroundColor: `${GOLD}18`, border: `1px solid ${GOLD}40`,
            borderRadius: 100, padding: "6px 18px", marginBottom: 20,
          }}>
            <span style={{ color: GOLD, fontSize: 16 }}>🍷</span>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>ibhub Pro</span>
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 900, color: NAVY, marginBottom: 14, lineHeight: 1.15 }}>
            Invista na sua carreira<br />no mundo do vinho
          </h1>
          <p style={{ fontSize: 16, color: "#6b7280", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Acesse inteligência de mercado, conexões exclusivas e ferramentas para impulsionar seu negócio.
          </p>
          {session && currentPlan !== "gratuito" && (
            <div style={{
              display: "inline-block", marginTop: 18,
              backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}40`,
              borderRadius: 100, padding: "6px 20px",
            }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>
                Plano atual: {getPlanLabel(currentPlan)}{hasActiveSub ? " · Ativo" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            backgroundColor: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 10, padding: "14px 18px", marginBottom: 28,
            color: "#dc2626", fontSize: 14, textAlign: "center",
          }}>
            {error}
          </div>
        )}

        {/* Plan cards — paid only */}
        {plansLoading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⌛</div>
            Carregando planos...
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            marginBottom: 16,
          }}>
            {paidPlans.map((plan, idx) => {
              const isCurrent       = plan.id === currentPlan;
              const isLoading       = loading === plan.id;
              const isPopular       = idx === 0;
              const price           = formatPlanPrice(plan);
              const originalPrice   = formatOriginalPrice(plan);
              const discount        = calcDiscount(plan);
              const accent          = ACCENT_COLORS[idx % ACCENT_COLORS.length];
              const generalFeatures = plan.features.filter(f => !f.startsWith("mercado:"));

              return (
                <div
                  key={plan.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 18,
                    border: isCurrent
                      ? `2px solid ${GOLD}`
                      : isPopular
                        ? `2px solid ${GOLD}70`
                        : "1.5px solid #e5e7eb",
                    padding: "28px 24px 24px",
                    position: "relative",
                    boxShadow: isPopular
                      ? "0 8px 40px rgba(201,168,76,0.14)"
                      : "0 2px 12px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    transition: "box-shadow 0.2s",
                  }}
                >
                  {/* Popular badge */}
                  {isPopular && !isCurrent && (
                    <div style={{
                      position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                      backgroundColor: GOLD, color: NAVY, fontWeight: 900,
                      fontSize: 11, padding: "4px 18px", borderRadius: 100, letterSpacing: 1,
                      whiteSpace: "nowrap",
                    }}>
                      MAIS POPULAR
                    </div>
                  )}
                  {isCurrent && (
                    <div style={{
                      position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                      backgroundColor: "#059669", color: "#fff", fontWeight: 900,
                      fontSize: 11, padding: "4px 18px", borderRadius: 100, letterSpacing: 1,
                      whiteSpace: "nowrap",
                    }}>
                      ✓ PLANO ATUAL
                    </div>
                  )}

                  {/* Top color bar */}
                  <div style={{ height: 4, backgroundColor: accent, borderRadius: 2, marginBottom: 20, marginLeft: -24, marginRight: -24, marginTop: -4 }} />

                  <h2 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>{plan.name}</h2>
                  <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 10px", lineHeight: 1.5 }}>{plan.subtitle}</p>

                  {/* Marketing description */}
                  {plan.description && (
                    <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 14px", lineHeight: 1.6, fontStyle: "italic" }}>
                      {plan.description}
                    </p>
                  )}

                  <div style={{ marginBottom: 22 }}>
                    {originalPrice && (
                      <div style={{ fontSize: 13, color: "#9ca3af", textDecoration: "line-through", marginBottom: 2 }}>
                        De: {originalPrice}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 32, fontWeight: 900, color: accent }}>{price.main}</span>
                      {discount && (
                        <span style={{
                          backgroundColor: "#d1fae5", color: "#065f46",
                          fontWeight: 800, fontSize: 12,
                          padding: "3px 8px", borderRadius: 8,
                        }}>-{discount}%</span>
                      )}
                    </div>
                    {price.period && (
                      <span style={{ fontSize: 14, color: "#9ca3af" }}>
                        {originalPrice ? `Por: ${price.main}` : ""}{price.period}
                      </span>
                    )}
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {generalFeatures.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "#374151" }}>
                        <span style={{ color: GOLD, flexShrink: 0, fontSize: 15 }}>✓</span>
                        {f}
                      </li>
                    ))}
                    {generalFeatures.length === 0 && (
                      <li style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>
                        Configure as funcionalidades no Plan Builder
                      </li>
                    )}
                  </ul>

                  {isCurrent ? (
                    <div style={{
                      backgroundColor: `${GOLD}12`, border: `1px solid ${GOLD}30`,
                      borderRadius: 10, padding: "13px 0", textAlign: "center",
                      color: GOLD, fontWeight: 800, fontSize: 15,
                    }}>
                      ✓ Plano atual
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAssinar(plan.id)}
                      disabled={isLoading || !!loading}
                      style={{
                        backgroundColor: isPopular ? GOLD : NAVY,
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        padding: "15px 0",
                        fontSize: 15,
                        fontWeight: 800,
                        cursor: (isLoading || !!loading) ? "not-allowed" : "pointer",
                        opacity: (isLoading || (!!loading && loading !== plan.id)) ? 0.65 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      {isLoading ? "Aguarde..." : `Assinar ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Free plan — discreet text at bottom */}
        {freePlan && (
          <div style={{
            textAlign: "center",
            marginTop: 8,
            padding: "16px 0",
          }}>
            {isFree ? (
              <span style={{ fontSize: 13, color: "#9ca3af" }}>
                ✓ Você está no plano {freePlan.name} · {freePlan.subtitle}
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "#9ca3af" }}>
                Ou continue com o <span style={{ fontWeight: 600 }}>plano {freePlan.name}</span> sem custos
              </span>
            )}
          </div>
        )}

        {/* Trust signals */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center",
          marginTop: 40, padding: "20px 0",
          borderTop: "1px solid #e5e7eb",
        }}>
          {["🔒 Pagamento 100% seguro via Stripe", "💳 Cartão de crédito", "❌ Cancele quando quiser", "🇧🇷 Preços em Reais"].map(s => (
            <span key={s} style={{ color: "#6b7280", fontSize: 13 }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
