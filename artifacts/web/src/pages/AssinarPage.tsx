import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { createCheckoutSession } from "@/services/stripe";
import { hasPlanAccess } from "@/utils/entitlement";
import { usePlans, formatPlanPrice, formatOriginalPrice, calcDiscount } from "@/hooks/usePlans";

const NAVY = "#0d1b2a";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#f0e4c2";

const BENEFITS = [
  { icon: "🤝", title: "Rede exclusiva", desc: "Conecte-se com importadores, produtores, sommeliers e distribuidores do setor." },
  { icon: "📊", title: "Inteligência de mercado", desc: "Dados e tendências do mundo do vinho para tomadas de decisão mais precisas." },
  { icon: "🎓", title: "Masterclasses & conteúdo", desc: "Acesso a eventos, palestras e conteúdo exclusivo de especialistas renomados." },
  { icon: "🏢", title: "Página da empresa", desc: "Mostre sua marca, portfólio e serviços para toda a comunidade ibhub." },
  { icon: "🔍", title: "Veja quem visita você", desc: "Saiba exatamente quem acessou seu perfil e abra novas oportunidades." },
  { icon: "💬", title: "Chat sem limites", desc: "Mensagens diretas ilimitadas com qualquer profissional da plataforma." },
];

const TESTIMONIALS = [
  {
    name: "Fernanda Lopes",
    role: "Sommelier · São Paulo",
    text: "O ibhub transformou a minha rede de contatos. Em 2 meses fechei 3 contratos novos com importadoras que nem sabia que existiam.",
    avatar: "FL",
  },
  {
    name: "Carlos Medeiros",
    role: "Importador · Rio de Janeiro",
    text: "A inteligência de mercado do ibhub Pro é indispensável. Consigo identificar tendências antes de todo mundo.",
    avatar: "CM",
  },
  {
    name: "Beatriz Motta",
    role: "Produtora · Serra Gaúcha",
    text: "Minha adega ganhou visibilidade nacional. As conexões que fiz aqui valem muito mais do que a assinatura.",
    avatar: "BM",
  },
];

const FAQS = [
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Você pode cancelar sua assinatura quando quiser, sem taxas ou multas. O acesso continua até o fim do período pago.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "O pagamento é processado de forma segura via Stripe, com cartão de crédito. Você recebe o recibo por e-mail.",
  },
  {
    q: "Posso mudar de plano depois?",
    a: "Sim. Você pode fazer upgrade ou downgrade do seu plano a qualquer momento na sua conta.",
  },
  {
    q: "Existe período de teste gratuito?",
    a: "Oferecemos o plano Gratuito sem custo por tempo ilimitado. Você pode explorar o ibhub antes de decidir pelo Pro.",
  },
];

const STATS = [
  { value: "8.000+", label: "Profissionais na rede" },
  { value: "12+", label: "Países representados" },
  { value: "94%", label: "Renova a assinatura" },
];

const ACCENT_COLORS = [GOLD, "#1a3a5c", "#722f37"];

export default function AssinarPage() {
  const { session, profile } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Inter', -apple-system, sans-serif", backgroundColor: "#f8f7f3", color: NAVY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(13,27,42,0.14) !important; }
        .cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .benefit-card:hover { background: #fff !important; box-shadow: 0 4px 20px rgba(201,168,76,0.12) !important; }
        .faq-item { cursor: pointer; }
        .faq-item:hover { background: rgba(201,168,76,0.04); }
        @media (max-width: 700px) {
          .hero-headline { font-size: 32px !important; }
          .plans-grid { grid-template-columns: 1fr !important; }
          .benefits-grid { grid-template-columns: 1fr !important; }
          .stats-row { flex-direction: column; gap: 24px !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        backgroundColor: NAVY,
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
      }}>
        <button
          onClick={() => setLocation(session ? "/app" : "/")}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0 }}
        >
          <img
            src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`}
            alt="ibhub"
            style={{ height: 32, objectFit: "contain" }}
          />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 18 }}>/</span>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 600 }}>Planos</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {session && currentPlan !== "gratuito" && hasActiveSub && (
            <span style={{
              backgroundColor: `${GOLD}20`, border: `1px solid ${GOLD}50`,
              borderRadius: 100, padding: "4px 14px",
              color: GOLD, fontSize: 12, fontWeight: 700,
            }}>
              {getPlanLabel(currentPlan)} · Ativo
            </span>
          )}
          {!session && (
            <button
              onClick={() => setLocation("/login")}
              style={{
                backgroundColor: "transparent", border: `1px solid rgba(255,255,255,0.25)`,
                color: "#fff", borderRadius: 8, padding: "7px 18px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >Entrar</button>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, #112238 60%, #1a2f44 100%)`,
        padding: "80px 24px 100px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
          width: 600, height: 400, borderRadius: "50%",
          background: `radial-gradient(ellipse, ${GOLD}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto" }}>
          {/* Logo */}
          <div style={{ marginBottom: 32 }}>
            <img
              src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`}
              alt="ibhub"
              style={{ height: 48, objectFit: "contain" }}
            />
          </div>

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            backgroundColor: `${GOLD}20`, border: `1px solid ${GOLD}50`,
            borderRadius: 100, padding: "7px 20px", marginBottom: 28,
          }}>
            <span style={{ fontSize: 14 }}>🍷</span>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>
              A rede profissional do vinho no Brasil
            </span>
          </div>

          <h1
            className="hero-headline"
            style={{
              fontSize: 48, fontWeight: 900, color: "#fff",
              lineHeight: 1.12, marginBottom: 20, letterSpacing: -1,
            }}
          >
            Sua carreira no vinho<br />
            <span style={{ color: GOLD }}>merece mais conexões.</span>
          </h1>

          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, marginBottom: 40, maxWidth: 520, margin: "0 auto 40px" }}>
            Junte-se a mais de 8.000 profissionais do setor. Acesse inteligência de mercado, 
            crie conexões reais e expanda seus negócios.
          </p>

          {/* Stats */}
          <div className="stats-row" style={{ display: "flex", gap: 40, justifyContent: "center", marginBottom: 40 }}>
            {STATS.map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: GOLD }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Scroll CTA */}
          <a
            href="#planos"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              backgroundColor: GOLD, color: NAVY,
              fontWeight: 800, fontSize: 15, padding: "15px 36px",
              borderRadius: 100, textDecoration: "none",
              boxShadow: `0 8px 32px ${GOLD}50`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${GOLD}70`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${GOLD}50`; }}
          >
            Ver planos e preços ↓
          </a>
        </div>
      </section>

      {/* ── Why ibhub Pro ── */}
      <section style={{ padding: "72px 24px", backgroundColor: "#fff" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
              Por que ibhub Pro?
            </p>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: NAVY, lineHeight: 1.2 }}>
              Tudo que você precisa para<br />crescer no setor de vinhos
            </h2>
          </div>
          <div
            className="benefits-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
          >
            {BENEFITS.map(b => (
              <div
                key={b.title}
                className="benefit-card"
                style={{
                  backgroundColor: "#f8f7f3", borderRadius: 14,
                  padding: "24px 22px", transition: "all 0.2s",
                  border: "1px solid #eeecea",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 12 }}>{b.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 6 }}>{b.title}</h3>
                <p style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.6 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section id="planos" style={{ padding: "80px 24px", backgroundColor: "#f8f7f3" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
              Escolha seu plano
            </p>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: NAVY, lineHeight: 1.2, marginBottom: 12 }}>
              Invista no seu crescimento profissional
            </h2>
            <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 460, margin: "0 auto" }}>
              Sem letras miúdas. Cancele quando quiser. Comece hoje.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              backgroundColor: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 12, padding: "14px 20px", marginBottom: 32,
              color: "#dc2626", fontSize: 14, textAlign: "center", maxWidth: 720, margin: "0 auto 32px",
            }}>
              ⚠️ {error}
            </div>
          )}

          {plansLoading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{
                width: 40, height: 40, border: `3px solid ${GOLD}30`, borderTopColor: GOLD,
                borderRadius: "50%", animation: "spin 1s linear infinite",
                margin: "0 auto 16px",
              }} />
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <p style={{ color: "#9ca3af" }}>Carregando planos...</p>
            </div>
          ) : (
            <>
              <div
                className="plans-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "start" }}
              >
                {paidPlans.map((plan, idx) => {
                  const isCurrent     = plan.id === currentPlan && hasActiveSub;
                  const isLoading     = loading === plan.id;
                  const isPopular     = idx === 0;
                  const price         = formatPlanPrice(plan);
                  const originalPrice = formatOriginalPrice(plan);
                  const discount      = calcDiscount(plan);
                  const accent        = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                  const genFeatures   = plan.features.filter(f => !f.startsWith("mercado:"));
                  const isDark        = isPopular;

                  return (
                    <div
                      key={plan.id}
                      className="plan-card"
                      style={{
                        backgroundColor: isDark ? NAVY : "#fff",
                        borderRadius: 20,
                        border: isCurrent
                          ? `2px solid #059669`
                          : isPopular
                            ? `2px solid ${GOLD}`
                            : "1.5px solid #e5e7eb",
                        padding: "32px 28px 28px",
                        position: "relative",
                        boxShadow: isPopular
                          ? `0 12px 48px ${GOLD}25`
                          : "0 2px 12px rgba(0,0,0,0.06)",
                        display: "flex",
                        flexDirection: "column",
                        transition: "all 0.25s",
                      }}
                    >
                      {/* Badge */}
                      {isPopular && !isCurrent && (
                        <div style={{
                          position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                          background: `linear-gradient(90deg, ${GOLD}, #e0b84a)`,
                          color: NAVY, fontWeight: 900,
                          fontSize: 11, padding: "5px 22px", borderRadius: 100, letterSpacing: 1.2,
                          whiteSpace: "nowrap", boxShadow: `0 4px 14px ${GOLD}50`,
                        }}>
                          ⭐ MAIS POPULAR
                        </div>
                      )}
                      {isCurrent && (
                        <div style={{
                          position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                          backgroundColor: "#059669", color: "#fff", fontWeight: 900,
                          fontSize: 11, padding: "5px 22px", borderRadius: 100, letterSpacing: 1,
                          whiteSpace: "nowrap",
                        }}>
                          ✓ SEU PLANO ATUAL
                        </div>
                      )}

                      {/* Accent strip */}
                      <div style={{
                        height: 3, borderRadius: 2,
                        background: `linear-gradient(90deg, ${accent}, ${accent}80)`,
                        marginBottom: 22, marginLeft: -28, marginRight: -28, marginTop: -8,
                      }} />

                      {/* Header */}
                      <h2 style={{ fontSize: 22, fontWeight: 900, color: isDark ? "#fff" : NAVY, marginBottom: 4 }}>
                        {plan.name}
                      </h2>
                      <p style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.5)" : "#9ca3af", marginBottom: 10, lineHeight: 1.5 }}>
                        {plan.subtitle}
                      </p>
                      {plan.description && (
                        <p style={{ fontSize: 12.5, color: isDark ? "rgba(255,255,255,0.45)" : "#6b7280", marginBottom: 16, lineHeight: 1.6, fontStyle: "italic" }}>
                          {plan.description}
                        </p>
                      )}

                      {/* Price */}
                      <div style={{
                        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : `${accent}0d`,
                        borderRadius: 12, padding: "16px 18px", marginBottom: 24,
                      }}>
                        {originalPrice && (
                          <div style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af", textDecoration: "line-through", marginBottom: 4 }}>
                            De {originalPrice}/mês
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                          <span style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, color: isDark ? GOLD : accent }}>
                            {price.main}
                          </span>
                          {discount && (
                            <span style={{
                              backgroundColor: "#d1fae5", color: "#065f46",
                              fontWeight: 800, fontSize: 12,
                              padding: "3px 9px", borderRadius: 8, marginBottom: 4,
                            }}>-{discount}%</span>
                          )}
                        </div>
                        {price.period && (
                          <div style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.45)" : "#9ca3af", marginTop: 4 }}>
                            {price.period}
                          </div>
                        )}
                      </div>

                      {/* Features */}
                      <ul style={{ listStyle: "none", padding: 0, flex: 1, display: "flex", flexDirection: "column", gap: 11, marginBottom: 28 }}>
                        {genFeatures.map(f => (
                          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: isDark ? "rgba(255,255,255,0.8)" : "#374151" }}>
                            <span style={{
                              color: "#fff", backgroundColor: GOLD,
                              borderRadius: "50%", width: 18, height: 18,
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 900, flexShrink: 0, marginTop: 1,
                            }}>✓</span>
                            {f}
                          </li>
                        ))}
                        {genFeatures.length === 0 && (
                          <li style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af", fontStyle: "italic" }}>
                            Configure as funcionalidades no Plan Builder
                          </li>
                        )}
                      </ul>

                      {/* CTA */}
                      {isCurrent ? (
                        <div style={{
                          backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}40`,
                          borderRadius: 12, padding: "14px 0", textAlign: "center",
                          color: GOLD, fontWeight: 800, fontSize: 15,
                        }}>
                          ✓ Plano atual
                        </div>
                      ) : (
                        <button
                          className="cta-btn"
                          onClick={() => handleAssinar(plan.id)}
                          disabled={isLoading || !!loading}
                          style={{
                            background: isPopular
                              ? `linear-gradient(135deg, ${GOLD}, #e0b84a)`
                              : NAVY,
                            color: isPopular ? NAVY : "#fff",
                            border: "none", borderRadius: 12,
                            padding: "16px 0", fontSize: 15, fontWeight: 800,
                            cursor: (isLoading || !!loading) ? "not-allowed" : "pointer",
                            opacity: (isLoading || (!!loading && loading !== plan.id)) ? 0.65 : 1,
                            transition: "all 0.2s",
                            boxShadow: isPopular ? `0 4px 20px ${GOLD}50` : "none",
                          }}
                        >
                          {isLoading ? "Redirecionando..." : isPopular ? `🚀 Assinar ${plan.name}` : `Assinar ${plan.name}`}
                        </button>
                      )}

                      {!isCurrent && (
                        <p style={{ textAlign: "center", fontSize: 12, color: isDark ? "rgba(255,255,255,0.35)" : "#9ca3af", marginTop: 12 }}>
                          Cancele quando quiser · Sem fidelidade
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Free plan note */}
              {freePlan && (
                <div style={{ textAlign: "center", marginTop: 24 }}>
                  {isFree ? (
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>
                      Você está no plano <strong>{freePlan.name}</strong> · {freePlan.subtitle}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>
                      Ou continue com o plano <strong>{freePlan.name}</strong> gratuitamente
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section style={{
        backgroundColor: NAVY,
        padding: "28px 24px",
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        justifyContent: "center",
        alignItems: "center",
      }}>
        {[
          { icon: "🔒", text: "Pagamento 100% seguro via Stripe" },
          { icon: "💳", text: "Cartão de crédito" },
          { icon: "❌", text: "Cancele quando quiser" },
          { icon: "🇧🇷", text: "Preços em Reais" },
          { icon: "📧", text: "Recibo por e-mail" },
        ].map(t => (
          <div key={t.text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 500 }}>{t.text}</span>
          </div>
        ))}
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: "80px 24px", backgroundColor: "#fff" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
              Quem já usa o ibhub Pro
            </p>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: NAVY }}>
              Histórias reais de crescimento
            </h2>
          </div>
          <div
            className="testimonials-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}
          >
            {TESTIMONIALS.map(t => (
              <div
                key={t.name}
                style={{
                  backgroundColor: "#f8f7f3",
                  borderRadius: 16, padding: "28px 24px",
                  border: "1px solid #eeecea",
                }}
              >
                <div style={{ color: GOLD, fontSize: 24, marginBottom: 14, letterSpacing: -2 }}>❝</div>
                <p style={{ fontSize: 14.5, color: "#374151", lineHeight: 1.7, marginBottom: 20, fontStyle: "italic" }}>
                  "{t.text}"
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    backgroundColor: NAVY, color: GOLD,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guarantee ── */}
      <section style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #1a3a5c 100%)`,
        padding: "64px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🛡️</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 14 }}>
            Sem risco para você
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, marginBottom: 32 }}>
            Se por qualquer motivo você não ficar satisfeito, basta cancelar sua assinatura quando quiser — sem perguntas, sem multas. 
            Seu acesso continua ativo até o fim do período já pago.
          </p>
          <a
            href="#planos"
            style={{
              display: "inline-block",
              backgroundColor: GOLD, color: NAVY,
              fontWeight: 800, fontSize: 15, padding: "14px 36px",
              borderRadius: 100, textDecoration: "none",
              boxShadow: `0 6px 24px ${GOLD}50`,
            }}
          >
            Começar agora →
          </a>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: "80px 24px", backgroundColor: "#f8f7f3" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
              FAQ
            </p>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: NAVY }}>Dúvidas frequentes</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="faq-item"
                style={{
                  backgroundColor: "#fff", borderRadius: 12, overflow: "hidden",
                  border: "1px solid #eeecea",
                  transition: "background 0.2s",
                }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 22px", gap: 16,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: NAVY, flex: 1 }}>{faq.q}</span>
                  <span style={{
                    color: GOLD, fontSize: 20, fontWeight: 900,
                    transform: openFaq === i ? "rotate(45deg)" : "none",
                    transition: "transform 0.2s",
                    flexShrink: 0,
                  }}>+</span>
                </div>
                {openFaq === i && (
                  <div style={{
                    padding: "0 22px 18px",
                    fontSize: 14, color: "#6b7280", lineHeight: 1.7,
                    borderTop: "1px solid #f3f4f6",
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section style={{ backgroundColor: "#fff", padding: "60px 24px", textAlign: "center", borderTop: "1px solid #eeecea" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <img
            src={`${import.meta.env.BASE_URL}logo-ibhub.png`}
            alt="ibhub"
            style={{ height: 36, objectFit: "contain", marginBottom: 20 }}
          />
          <h2 style={{ fontSize: 26, fontWeight: 900, color: NAVY, marginBottom: 12 }}>
            Pronto para elevar sua carreira?
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>
            Mais de 8.000 profissionais já estão na maior rede do vinho do Brasil.
          </p>
          <a
            href="#planos"
            style={{
              display: "inline-block",
              background: `linear-gradient(135deg, ${GOLD}, #e0b84a)`,
              color: NAVY, fontWeight: 800, fontSize: 15,
              padding: "15px 40px", borderRadius: 100, textDecoration: "none",
              boxShadow: `0 6px 28px ${GOLD}40`,
            }}
          >
            Ver planos →
          </a>
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              Tem dúvidas? Fale conosco em{" "}
              <a href="mailto:contato@ibhub.com.br" style={{ color: GOLD, fontWeight: 600 }}>contato@ibhub.com.br</a>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
