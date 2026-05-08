import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { createCheckoutSession } from "@/services/stripe";
import { hasPlanAccess } from "@/utils/entitlement";
import { usePlans, formatPlanPrice, formatOriginalPrice, calcDiscount } from "@/hooks/usePlans";

const NAVY         = "#0d1b2a";
const GOLD         = "#c9a84c";
const WINE         = "#722f37";
const POPULAR_DARK = "#0a1729";

interface PlanCopy {
  tag: string;
  tagline: string;
  highlights: { icon: string; label: string; desc: string }[];
}

const PLAN_COPY: Record<string, PlanCopy> = {
  profissional: {
    tag: "Profissional individual",
    tagline: "Inteligência de mercado e dados exclusivos do setor.",
    highlights: [
      { icon: "📰", label: "1 slide diário de mercado",     desc: "Dados e tendências do setor todo dia" },
      { icon: "📊", label: "Gráficos & KPIs Ideal.BI",     desc: "Inteligência de mercado em tempo real" },
      { icon: "🔍", label: "Feed exclusivo da Ideal.BI",    desc: "Conteúdo privilegiado para profissionais" },
      { icon: "🤖", label: "50 créditos de IA/mês",        desc: "Busca inteligente no mercado do vinho" },
    ],
  },
  empresa: {
    tag: "Empresas do setor",
    tagline: "Presença corporativa e ferramentas de negócio.",
    highlights: [
      { icon: "🏢", label: "Página corporativa",             desc: "Vitrine oficial da sua marca na rede" },
      { icon: "💼", label: "Publicar vagas",                 desc: "Recrute talentos especializados" },
      { icon: "📑", label: "Apresentações diárias",          desc: "Informações novas do mercado todos os dias" },
      { icon: "🗺",  label: "Análises por região",           desc: "Tendências, variedades e dados regionais" },
      { icon: "🔓", label: "3 reveals de volume exportado",  desc: "Descubra quanto cada importador exportou no ano" },
    ],
  },
  executivo: {
    tag: "Líderes e gestores",
    tagline: "Poder total. Sem restrições.",
    highlights: [
      { icon: "⚡", label: "Acesso imediato",           desc: "Todo o conteúdo disponível de uma vez" },
      { icon: "🤖", label: "100 créditos de IA/mês",   desc: "O dobro do plano Empresa" },
      { icon: "🎯", label: "5 reveals de contato/mês", desc: "Mais acesso direto a decisores" },
      { icon: "👑", label: "Tudo do plano Empresa",    desc: "Sem limitações de cadência ou conteúdo" },
    ],
  },
};

const BENEFITS = [
  { icon: "🤝", color: "#f0e4c2", title: "Rede exclusiva", desc: "Conecte-se com importadores, produtores, sommeliers e distribuidores do setor." },
  { icon: "📊", color: "#dbeafe", title: "Inteligência de mercado", desc: "Dados e tendências do mundo do vinho para tomadas de decisão mais precisas." },
  { icon: "🎓", color: "#ede9fe", title: "Masterclasses & conteúdo", desc: "Acesso a eventos, palestras e conteúdo exclusivo de especialistas renomados." },
  { icon: "🏢", color: "#dcfce7", title: "Página da empresa", desc: "Mostre sua marca, portfólio e serviços para toda a comunidade ibhub." },
  { icon: "🔍", color: "#fef9c3", title: "Veja quem visita você", desc: "Saiba exatamente quem acessou seu perfil e abra novas oportunidades." },
  { icon: "💬", color: "#ffe4e6", title: "Chat sem limites", desc: "Mensagens diretas ilimitadas com qualquer profissional da plataforma." },
];

const TESTIMONIALS = [
  { name: "Fernanda Lopes",  role: "Sommelier · São Paulo",     text: "O ibhub transformou a minha rede de contatos. Em 2 meses fechei 3 contratos novos com importadoras que nem sabia que existiam.", avatar: "FL", stars: 5 },
  { name: "Carlos Medeiros", role: "Importador · Rio de Janeiro", text: "A inteligência de mercado do ibhub Pro é indispensável. Consigo identificar tendências antes de todo mundo.",                  avatar: "CM", stars: 5 },
  { name: "Beatriz Motta",   role: "Produtora · Serra Gaúcha",  text: "Minha adega ganhou visibilidade nacional. As conexões que fiz aqui valem muito mais do que a assinatura.",                  avatar: "BM", stars: 5 },
];

const FAQS = [
  { q: "Posso cancelar a qualquer momento?",  a: "Sim. Você pode cancelar sua assinatura quando quiser, sem taxas ou multas. O acesso continua até o fim do período pago." },
  { q: "Como funciona o pagamento?",          a: "O pagamento é processado de forma segura via Stripe, com cartão de crédito. Você recebe o recibo por e-mail." },
  { q: "Posso mudar de plano depois?",        a: "Sim. Você pode fazer upgrade ou downgrade do seu plano a qualquer momento na sua conta." },
  { q: "Existe período de teste gratuito?",   a: "Oferecemos o plano Gratuito sem custo por tempo ilimitado. Você pode explorar o ibhub antes de decidir pelo Pro." },
];

const STATS = [
  { value: "8.000+", label: "Profissionais na rede" },
  { value: "12+",    label: "Países representados" },
  { value: "94%",    label: "Renova a assinatura" },
];

const PLAN_ACCENTS = [GOLD, "#1a3a5c", WINE];

function PriceDisplay({ priceStr, isDark }: { priceStr: string; isDark: boolean }) {
  if (priceStr === "Grátis") {
    return <span style={{ fontSize: 38, fontWeight: 900, color: isDark ? GOLD : NAVY }}>Grátis</span>;
  }
  const parts   = priceStr.replace("R$ ", "").split(",");
  const integer = parts[0] ?? "0";
  const decimal = parts[1] ?? "00";
  const numColor = isDark ? GOLD : NAVY;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: numColor, marginTop: 6, lineHeight: 1 }}>R$</span>
      <div style={{ lineHeight: 1 }}>
        <span style={{ fontSize: 48, fontWeight: 900, color: numColor, letterSpacing: -2 }}>{integer}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: numColor }}>,{decimal}</span>
      </div>
    </div>
  );
}

export default function AssinarPage() {
  const { session, profile } = useAuth();
  const [, setLocation]      = useLocation();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]    = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const autoTriggered        = useRef(false);

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
    const params     = new URLSearchParams(window.location.search);
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

        .plan-card { transition: transform 0.25s, box-shadow 0.25s; }
        .plan-card:hover { transform: translateY(-6px); }
        .plan-card-popular:hover { transform: translateY(-10px) !important; }

        .cta-btn { transition: all 0.2s; }
        .cta-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }

        .benefit-card { transition: all 0.2s; }
        .benefit-card:hover { background: #fff !important; box-shadow: 0 6px 24px rgba(201,168,76,0.13) !important; transform: translateY(-2px); }

        .faq-item { cursor: pointer; transition: background 0.15s; }
        .faq-item:hover { background: rgba(201,168,76,0.05) !important; }

        .trust-item { transition: opacity 0.2s; }
        .trust-item:hover { opacity: 1 !important; }

        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%, 100% { box-shadow: 0 4px 18px ${GOLD}60; } 50% { box-shadow: 0 6px 28px ${GOLD}90; } }
        @keyframes fadein  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 720px) {
          .hero-headline  { font-size: 30px !important; }
          .plans-grid     { grid-template-columns: 1fr !important; }
          .plans-grid > * { margin-top: 0 !important; }
          .benefits-grid  { grid-template-columns: 1fr !important; }
          .stats-row      { flex-direction: column; gap: 20px !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        backgroundColor: NAVY, padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 24px rgba(0,0,0,0.35)",
      }}>
        <button
          onClick={() => setLocation(session ? "/app" : "/")}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0 }}
        >
          <img src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`} alt="ibhub" style={{ height: 32, objectFit: "contain" }} />
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 18 }}>/</span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600 }}>Planos</span>
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
                backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff", borderRadius: 8, padding: "7px 18px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >Entrar</button>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, #0f2235 55%, #1a2f44 100%)`,
        padding: "88px 24px 108px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "35%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 500, borderRadius: "50%", background: `radial-gradient(ellipse, ${GOLD}14 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(to bottom, transparent, #f8f7f3)", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto", animation: "fadein 0.6s ease both" }}>
          <div style={{ marginBottom: 36 }}>
            <img src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`} alt="ibhub" style={{ height: 48, objectFit: "contain" }} />
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            backgroundColor: `${GOLD}22`, border: `1px solid ${GOLD}55`,
            borderRadius: 100, padding: "7px 20px", marginBottom: 32,
          }}>
            <span style={{ fontSize: 14 }}>🍷</span>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: 0.4 }}>
              A rede profissional do vinho no Brasil
            </span>
          </div>

          <h1
            className="hero-headline"
            style={{ fontSize: 50, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 22, letterSpacing: -1.5 }}
          >
            Sua carreira no vinho<br />
            <span style={{ color: GOLD }}>merece mais conexões.</span>
          </h1>

          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.6)", lineHeight: 1.75, marginBottom: 44, maxWidth: 500, margin: "0 auto 44px" }}>
            Junte-se a mais de 8.000 profissionais do setor. Acesse inteligência de mercado,
            crie conexões reais e expanda seus negócios.
          </p>

          <div className="stats-row" style={{ display: "flex", gap: 48, justifyContent: "center", marginBottom: 48 }}>
            {STATS.map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: GOLD, letterSpacing: -0.5 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <a
            href="#planos"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              backgroundColor: GOLD, color: NAVY,
              fontWeight: 800, fontSize: 15, padding: "15px 38px",
              borderRadius: 100, textDecoration: "none",
              boxShadow: `0 8px 32px ${GOLD}55`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 12px 40px ${GOLD}80`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 8px 32px ${GOLD}55`; }}
          >
            Ver planos e preços ↓
          </a>
        </div>
      </section>

      {/* ── Por que Pro ── */}
      <section style={{ padding: "80px 24px", backgroundColor: "#fff" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              Por que ibhub Pro?
            </p>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: NAVY, lineHeight: 1.15 }}>
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
                  backgroundColor: "#f8f7f3", borderRadius: 16,
                  padding: "26px 24px", border: "1px solid #eeecea",
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  backgroundColor: b.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, marginBottom: 16,
                }}>
                  {b.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 8 }}>{b.title}</h3>
                <p style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.65 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section id="planos" style={{ padding: "80px 24px 96px", backgroundColor: "#f8f7f3" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              Escolha seu plano
            </p>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: NAVY, lineHeight: 1.15, marginBottom: 12 }}>
              Invista no seu crescimento profissional
            </h2>
            <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 440, margin: "0 auto" }}>
              Sem letras miúdas. Cancele quando quiser. Comece hoje.
            </p>
          </div>

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
            <div style={{ textAlign: "center", padding: "64px 0" }}>
              <div style={{
                width: 40, height: 40, border: `3px solid ${GOLD}30`, borderTopColor: GOLD,
                borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px",
              }} />
              <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando planos...</p>
            </div>
          ) : (
            <>
              <div
                className="plans-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${paidPlans.length}, 1fr)`,
                  gap: 20,
                  alignItems: "end",
                }}
              >
                {paidPlans.map((plan, idx) => {
                  const isCurrent     = plan.id === currentPlan && hasActiveSub;
                  const isLoading     = loading === plan.id;
                  const planKey       = plan.name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
                  const isPopular     = planKey.includes("empresa");
                  const price         = formatPlanPrice(plan);
                  const originalPrice = formatOriginalPrice(plan);
                  const discount      = calcDiscount(plan);
                  const accent        = PLAN_ACCENTS[idx % PLAN_ACCENTS.length];
                  const genFeatures   = plan.features.filter(f => !f.startsWith("mercado:"));
                  const isDark        = isPopular;
                  const popularBg     = POPULAR_DARK;
                  const copy          = PLAN_COPY[planKey] ?? null;

                  const checkColor = isDark ? GOLD : accent === NAVY ? "#1a3a5c" : accent;

                  return (
                    <div
                      key={plan.id}
                      className={`plan-card${isPopular ? " plan-card-popular" : ""}`}
                      style={{
                        backgroundColor: isDark ? popularBg : "#fff",
                        borderRadius: 22,
                        border: isCurrent
                          ? "2px solid #059669"
                          : isPopular
                            ? `2px solid ${GOLD}`
                            : "1.5px solid #e5e7eb",
                        padding: isPopular ? "44px 28px 32px" : "32px 28px 28px",
                        marginTop: isPopular ? 0 : 20,
                        position: "relative",
                        boxShadow: isPopular
                          ? `0 24px 64px ${GOLD}25, 0 4px 16px rgba(0,0,0,0.18)`
                          : "0 2px 16px rgba(0,0,0,0.07)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Popular badge */}
                      {isPopular && !isCurrent && (
                        <div style={{
                          position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                          background: `linear-gradient(90deg, ${GOLD}, #e0b84a)`,
                          color: NAVY, fontWeight: 900,
                          fontSize: 11, padding: "6px 24px", borderRadius: 100, letterSpacing: 1.4,
                          whiteSpace: "nowrap", animation: "pulse 2.5s ease-in-out infinite",
                        }}>
                          ⭐ MAIS POPULAR
                        </div>
                      )}
                      {isCurrent && (
                        <div style={{
                          position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                          backgroundColor: "#059669", color: "#fff", fontWeight: 900,
                          fontSize: 11, padding: "6px 24px", borderRadius: 100, letterSpacing: 1,
                          whiteSpace: "nowrap",
                        }}>
                          ✓ SEU PLANO ATUAL
                        </div>
                      )}

                      {/* Accent strip */}
                      <div style={{
                        height: 3, borderRadius: 2,
                        background: isPopular
                          ? `linear-gradient(90deg, ${GOLD}, #e0b84a)`
                          : `linear-gradient(90deg, ${accent}, ${accent}60)`,
                        marginBottom: 24, marginLeft: -28, marginRight: -28, marginTop: -12,
                      }} />

                      {/* Header */}
                      {copy?.tag && (
                        <p style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                          color: isDark ? GOLD : accent,
                          textTransform: "uppercase", marginBottom: 8,
                        }}>
                          {copy.tag}
                        </p>
                      )}
                      <h2 style={{
                        fontSize: 26, fontWeight: 900, letterSpacing: -0.5,
                        color: isDark ? "#fff" : NAVY, marginBottom: 4,
                      }}>
                        {plan.name}
                      </h2>
                      {copy?.tagline && (
                        <p style={{
                          fontSize: 13, fontWeight: 500,
                          color: isDark ? "rgba(255,255,255,0.45)" : "#9ca3af",
                          marginBottom: 22, lineHeight: 1.4,
                        }}>
                          {copy.tagline}
                        </p>
                      )}

                      {/* Price */}
                      <div style={{
                        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : `${accent}09`,
                        border: isDark ? `1px solid ${GOLD}18` : `1px solid ${accent}18`,
                        borderRadius: 14, padding: "16px 18px", marginBottom: 26,
                      }}>
                        {originalPrice && (
                          <div style={{
                            fontSize: 12, color: isDark ? "rgba(255,255,255,0.28)" : "#c0c4cc",
                            textDecoration: "line-through", marginBottom: 4, fontWeight: 500,
                          }}>
                            De {originalPrice}/mês
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <PriceDisplay priceStr={price.main} isDark={isDark} />
                          {discount && (
                            <span style={{
                              backgroundColor: isDark ? `${GOLD}20` : "#fef2f2",
                              color: isDark ? GOLD : WINE,
                              fontWeight: 800, fontSize: 11,
                              padding: "3px 9px", borderRadius: 6,
                              border: isDark ? `1px solid ${GOLD}35` : `1px solid ${WINE}25`,
                              alignSelf: "flex-start", marginTop: 10,
                            }}>-{discount}%</span>
                          )}
                        </div>
                        {price.period && (
                          <div style={{ fontSize: 12, color: isDark ? "rgba(255,255,255,0.35)" : "#b0b7c0", marginTop: 4, fontWeight: 500 }}>
                            {price.period}
                          </div>
                        )}
                      </div>

                      {/* Highlights */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                        {(copy?.highlights ?? []).map(h => (
                          <div key={h.label} style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "11px 14px",
                            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                            borderRadius: 10,
                            border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
                          }}>
                            <span style={{
                              width: 36, height: 36, flexShrink: 0,
                              backgroundColor: isDark ? `${GOLD}18` : `${accent}12`,
                              borderRadius: 9,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 17,
                            }}>{h.icon}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#fff" : NAVY, lineHeight: 1.2 }}>{h.label}</div>
                              <div style={{ fontSize: 11.5, color: isDark ? "rgba(255,255,255,0.42)" : "#9ca3af", marginTop: 2, lineHeight: 1.3 }}>{h.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      {isCurrent ? (
                        <div style={{
                          backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}40`,
                          borderRadius: 12, padding: "15px 0", textAlign: "center",
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
                              ? `linear-gradient(135deg, ${GOLD} 0%, #e0b84a 100%)`
                              : NAVY,
                            color: isPopular ? NAVY : "#fff",
                            border: "none", borderRadius: 12,
                            padding: "17px 0", fontSize: 15, fontWeight: 800,
                            cursor: (isLoading || !!loading) ? "not-allowed" : "pointer",
                            opacity: (isLoading || (!!loading && loading !== plan.id)) ? 0.6 : 1,
                            boxShadow: isPopular ? `0 6px 24px ${GOLD}55` : "none",
                            width: "100%",
                          }}
                        >
                          {isLoading ? "Redirecionando..." : isPopular ? `🚀 Assinar ${plan.name}` : `Assinar ${plan.name}`}
                        </button>
                      )}

                      {!isCurrent && (
                        <p style={{ textAlign: "center", fontSize: 12, color: isDark ? "rgba(255,255,255,0.3)" : "#b0b7c0", marginTop: 12 }}>
                          Cancele quando quiser · Sem fidelidade
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {freePlan && (
                <div style={{ textAlign: "center", marginTop: 28 }}>
                  {isFree ? (
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>
                      Você está no plano <strong style={{ color: NAVY }}>{freePlan.name}</strong> · {freePlan.subtitle}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>
                      Ou continue com o plano <strong style={{ color: NAVY }}>{freePlan.name}</strong> gratuitamente
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
        backgroundColor: NAVY, padding: "26px 24px",
        display: "flex", flexWrap: "wrap", gap: 20,
        justifyContent: "center", alignItems: "center",
      }}>
        {[
          { icon: "🔒", text: "Pagamento 100% seguro via Stripe" },
          { icon: "💳", text: "Cartão de crédito" },
          { icon: "✕",  text: "Cancele quando quiser", iconColor: "#f87171" },
          { icon: "🇧🇷", text: "Preços em Reais" },
          { icon: "📧", text: "Recibo por e-mail" },
        ].map(t => (
          <div key={t.text} className="trust-item" style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.75 }}>
            <span style={{ fontSize: 15, color: t.iconColor }}>{t.icon}</span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500 }}>{t.text}</span>
          </div>
        ))}
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: "84px 24px", backgroundColor: "#fff" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              Quem já usa o ibhub Pro
            </p>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: NAVY, lineHeight: 1.2 }}>
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
                  backgroundColor: "#f8f7f3", borderRadius: 18, padding: "30px 26px",
                  border: "1px solid #eeecea", display: "flex", flexDirection: "column", gap: 0,
                }}
              >
                <div style={{ color: GOLD, fontSize: 20, marginBottom: 4, letterSpacing: 1 }}>
                  {"★".repeat(t.stars)}
                </div>
                <div style={{ color: GOLD, fontSize: 28, marginBottom: 10, lineHeight: 1 }}>❝</div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, marginBottom: 22, fontStyle: "italic", flex: 1 }}>
                  "{t.text}"
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${NAVY}, #1a3a5c)`,
                    color: GOLD, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                    border: `2px solid ${GOLD}40`,
                  }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guarantee ── */}
      <section style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #112238 100%)`,
        padding: "72px 24px", textAlign: "center",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            backgroundColor: `${GOLD}20`, border: `2px solid ${GOLD}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, margin: "0 auto 24px",
          }}>🛡️</div>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginBottom: 16 }}>
            Sem risco para você
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.75, marginBottom: 36 }}>
            Se por qualquer motivo você não ficar satisfeito, basta cancelar sua assinatura quando quiser — sem perguntas, sem multas.
            Seu acesso continua ativo até o fim do período já pago.
          </p>
          <a
            href="#planos"
            style={{
              display: "inline-block", backgroundColor: GOLD, color: NAVY,
              fontWeight: 800, fontSize: 15, padding: "15px 40px",
              borderRadius: 100, textDecoration: "none",
              boxShadow: `0 6px 28px ${GOLD}55`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 10px 36px ${GOLD}80`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 6px 28px ${GOLD}55`; }}
          >
            Começar agora →
          </a>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: "84px 24px", backgroundColor: "#f8f7f3" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
              FAQ
            </p>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: NAVY }}>Dúvidas frequentes</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="faq-item"
                style={{
                  backgroundColor: "#fff", borderRadius: 14, overflow: "hidden",
                  border: openFaq === i ? `1.5px solid ${GOLD}50` : "1.5px solid #eeecea",
                  boxShadow: openFaq === i ? `0 4px 20px ${GOLD}12` : "none",
                }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", gap: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: NAVY, flex: 1 }}>{faq.q}</span>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%",
                    backgroundColor: openFaq === i ? GOLD : "#f3f4f6",
                    color: openFaq === i ? NAVY : "#6b7280",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 900, flexShrink: 0,
                    transform: openFaq === i ? "rotate(45deg)" : "none",
                    transition: "all 0.2s",
                  }}>+</span>
                </div>
                {openFaq === i && (
                  <div style={{
                    padding: "0 24px 20px",
                    fontSize: 14, color: "#6b7280", lineHeight: 1.75,
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
      <section style={{ backgroundColor: "#fff", padding: "64px 24px", textAlign: "center", borderTop: "1px solid #eeecea" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <img src={`${import.meta.env.BASE_URL}logo-ibhub.png`} alt="ibhub" style={{ height: 36, objectFit: "contain", marginBottom: 24 }} />
          <h2 style={{ fontSize: 28, fontWeight: 900, color: NAVY, marginBottom: 14, lineHeight: 1.2 }}>
            Pronto para elevar sua carreira?
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32, lineHeight: 1.65 }}>
            Mais de 8.000 profissionais já estão na maior rede do vinho do Brasil.
          </p>
          <a
            href="#planos"
            style={{
              display: "inline-block",
              background: `linear-gradient(135deg, ${GOLD}, #e0b84a)`,
              color: NAVY, fontWeight: 800, fontSize: 15,
              padding: "16px 44px", borderRadius: 100, textDecoration: "none",
              boxShadow: `0 6px 28px ${GOLD}45`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 10px 36px ${GOLD}70`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 6px 28px ${GOLD}45`; }}
          >
            Ver planos →
          </a>
          <div style={{ marginTop: 20 }}>
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
