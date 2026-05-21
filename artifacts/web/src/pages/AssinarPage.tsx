import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { createCheckoutSession } from "@/services/stripe";
import { hasPlanAccess } from "@/utils/entitlement";
import { usePlans, formatPlanPrice, formatOriginalPrice, calcDiscount } from "@/hooks/usePlans";

const NAVY  = "#0d1b2a";
const DEEP  = "#0d1f35";
const GOLD  = "#c9a84c";
const WINE  = "#722f37";

interface PlanCopy {
  tag: string;
  tagline: string;
  highlights: { label: string; desc: string }[];
}

const PLAN_COPY: Record<string, PlanCopy> = {
  profissional: {
    tag: "Profissional individual",
    tagline: "Inteligência de mercado e dados exclusivos do setor.",
    highlights: [
      { label: "1 slide diário de mercado",   desc: "Dados e tendências do setor todo dia" },
      { label: "Gráficos & KPIs Ideal.BI",    desc: "Inteligência de mercado em tempo real" },
      { label: "Feed exclusivo da Ideal.BI",  desc: "Conteúdo privilegiado para profissionais" },
      { label: "50 créditos de IA / mês",     desc: "Busca inteligente no mercado do vinho" },
    ],
  },
  empresa: {
    tag: "Importadoras · Distribuidoras · Produtoras",
    tagline: "Presença corporativa e ferramentas de negócio.",
    highlights: [
      { label: "Página corporativa",             desc: "Vitrine oficial da sua marca na rede" },
      { label: "Publicar vagas",                 desc: "Recrute talentos especializados" },
      { label: "Apresentações diárias",          desc: "Informações novas do mercado todos os dias" },
      { label: "Análises por região",            desc: "Tendências, variedades e dados regionais" },
      { label: "3 reveals de volume exportado", desc: "Descubra quanto cada importador exportou no ano" },
    ],
  },
  executivo: {
    tag: "Líderes e gestores",
    tagline: "Poder total. Sem restrições.",
    highlights: [
      { label: "Acesso imediato a todo o conteúdo", desc: "Nenhuma espera — tudo disponível de uma vez" },
      { label: "100 créditos de IA / mês",          desc: "O dobro do plano Empresa" },
      { label: "5 reveals de volume exportado",     desc: "Mais acesso direto a decisores" },
      { label: "Tudo do plano Empresa",             desc: "Sem limitações de cadência ou conteúdo" },
    ],
  },
};

const TESTIMONIALS = [
  { name: "Fernanda Lopes",  role: "Sommelier · São Paulo",      text: "O ibhub transformou minha rede de contatos. Em 2 meses fechei 3 contratos novos com importadoras que nem sabia que existiam.", avatar: "FL" },
  { name: "Carlos Medeiros", role: "Importador · Rio de Janeiro", text: "A inteligência de mercado do ibhub Pro é indispensável. Consigo identificar tendências antes de todo mundo.",                  avatar: "CM" },
  { name: "Beatriz Motta",   role: "Produtora · Serra Gaúcha",   text: "Minha adega ganhou visibilidade nacional. As conexões que fiz aqui valem muito mais do que a assinatura.",                   avatar: "BM" },
];

const FAQS = [
  { q: "Posso cancelar a qualquer momento?",  a: "Sim. Você pode cancelar sua assinatura quando quiser, sem taxas ou multas. O acesso continua até o fim do período pago." },
  { q: "Como funciona o pagamento?",          a: "O pagamento é processado de forma segura via Stripe, com cartão de crédito. Você recebe o recibo por e-mail." },
  { q: "Posso mudar de plano depois?",        a: "Sim. Você pode fazer upgrade ou downgrade do seu plano a qualquer momento na sua conta." },
  { q: "Existe período de teste gratuito?",   a: "Oferecemos o plano Gratuito sem custo por tempo ilimitado. Você pode explorar o ibhub antes de decidir pelo Pro." },
];

function PriceDisplay({ priceStr, gold }: { priceStr: string; gold?: boolean }) {
  const color = gold ? GOLD : "#fff";
  if (priceStr === "Grátis") {
    return <span style={{ fontSize: 40, fontWeight: 900, color }}>{priceStr}</span>;
  }
  const parts   = priceStr.replace("R$ ", "").split(",");
  const integer = parts[0] ?? "0";
  const decimal = parts[1] ?? "00";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 3 }}>
      <span className="price-currency" style={{ fontSize: 15, fontWeight: 700, color, marginTop: 8, lineHeight: 1 }}>R$</span>
      <div style={{ lineHeight: 1 }}>
        <span className="price-integer" style={{ fontSize: 52, fontWeight: 900, color, letterSpacing: -2 }}>{integer}</span>
        <span className="price-decimal" style={{ fontSize: 22, fontWeight: 800, color }}>,{decimal}</span>
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
    <div style={{ minHeight: "100vh", fontFamily: "'Inter', -apple-system, sans-serif", backgroundColor: DEEP, color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .plan-card { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease; }
        .plan-card:hover { transform: translateY(-4px); }
        .plan-card-popular { transform: translateY(0) scale(1.03); }
        .plan-card-popular:hover { transform: translateY(-8px) scale(1.03) !important; }

        .cta-btn { transition: all 0.2s ease; }
        .cta-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }

        .faq-row { cursor: pointer; transition: background 0.15s; }
        .faq-row:hover { background: rgba(201,168,76,0.04) !important; }

        .highlight-row { transition: background 0.15s; }
        .highlight-row:hover { background: rgba(255,255,255,0.04) !important; }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadein  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity:.7 } 50% { opacity:1 } }
        @keyframes glow    { 0%,100% { box-shadow: 0 0 60px ${GOLD}25, 0 28px 80px rgba(0,0,0,0.5); } 50% { box-shadow: 0 0 90px ${GOLD}40, 0 28px 80px rgba(0,0,0,0.5); } }

        .gold-glow { animation: glow 3s ease-in-out infinite; }
        .badge-shimmer { animation: shimmer 2.5s ease-in-out infinite; }

        @media (max-width:900px) {
          .plans-grid { grid-template-columns: 1fr !important; }
          .plans-grid > * { transform: none !important; margin-top: 0 !important; }
          .stats-row { flex-wrap: wrap; gap: 28px !important; }
          .hero-h1 { font-size: 36px !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
          .benefits-grid { grid-template-columns: 1fr 1fr !important; }
        }

        @media (max-width:768px) {
          .header-bar { padding: 12px 16px !important; }
          .hero-section { padding: 72px 20px 80px !important; }
          .hero-h1 { font-size: 30px !important; letter-spacing: -0.5px !important; }
          .hero-body-p { font-size: 15px !important; margin-bottom: 40px !important; }
          .hero-stats { gap: 36px !important; margin-bottom: 44px !important; }
          .hero-cta { padding: 14px 32px !important; font-size: 14px !important; }
          .plans-section { padding: 72px 16px 80px !important; }
          .plans-section-title { font-size: 32px !important; }
          .popular-card-inner { padding: 40px 22px 32px !important; }
          .side-card-inner { padding: 28px 18px 24px !important; }
          .trust-strip { flex-direction: column !important; gap: 10px !important; align-items: flex-start !important; padding: 20px 20px !important; }
          .testimonials-section { padding: 64px 16px !important; }
          .testimonials-title { font-size: 28px !important; }
          .guarantee-section { padding: 64px 20px !important; }
          .guarantee-title { font-size: 26px !important; }
          .faq-section { padding: 64px 16px !important; }
          .faq-title { font-size: 26px !important; }
          .footer-cta-section { padding: 64px 20px !important; }
          .footer-cta-title { font-size: 26px !important; }
          .benefits-section { padding: 72px 20px !important; }
          .benefits-title { font-size: 30px !important; }
          .benefits-grid { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
        }

        @media (max-width:480px) {
          .header-bar { padding: 10px 14px !important; }
          .hero-section { padding: 52px 16px 60px !important; }
          .hero-h1 { font-size: 26px !important; }
          .hero-body-p { font-size: 14px !important; }
          .hero-stats { gap: 20px !important; flex-wrap: wrap !important; justify-content: center !important; margin-bottom: 36px !important; }
          .hero-stats > div { min-width: 80px; }
          .hero-stats .stat-value { font-size: 24px !important; }
          .hero-cta { padding: 13px 28px !important; width: 100% !important; justify-content: center !important; }
          .plans-section { padding: 52px 12px 60px !important; }
          .popular-card-inner { padding: 36px 16px 28px !important; }
          .side-card-inner { padding: 24px 14px 20px !important; }
          .benefits-grid { grid-template-columns: 1fr !important; }
          .benefits-section { padding: 52px 16px !important; }
          .trust-strip { padding: 16px !important; }
          .testimonials-section { padding: 48px 14px !important; }
          .guarantee-section { padding: 48px 16px !important; }
          .faq-section { padding: 48px 14px !important; }
          .footer-cta-section { padding: 48px 16px !important; }
          .price-integer { font-size: 40px !important; }
          .price-decimal { font-size: 18px !important; }
          .price-currency { font-size: 13px !important; margin-top: 6px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header className="header-bar" style={{
        position: "sticky", top: 0, zIndex: 200,
        backgroundColor: "rgba(6,16,30,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid rgba(201,168,76,0.12)`,
        padding: "14px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => setLocation(session ? "/app" : "/")}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0 }}
        >
          <img src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`} alt="ibhub" style={{ height: 30, objectFit: "contain" }} />
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }}>/</span>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500, letterSpacing: 0.3 }}>Planos</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {session && currentPlan !== "gratuito" && hasActiveSub && (
            <span style={{
              background: `linear-gradient(90deg, ${GOLD}25, ${GOLD}15)`,
              border: `1px solid ${GOLD}40`,
              borderRadius: 100, padding: "4px 14px",
              color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
            }}>
              {getPlanLabel(currentPlan)} · Ativo
            </span>
          )}
          {!session && (
            <button
              onClick={() => setLocation("/login")}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "rgba(255,255,255,0.85)", borderRadius: 8,
                padding: "7px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >Entrar</button>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero-section" style={{
        position: "relative", overflow: "hidden",
        padding: "120px 24px 140px",
        textAlign: "center",
        background: `radial-gradient(ellipse 120% 80% at 50% -10%, #1a2f44 0%, ${DEEP} 70%)`,
      }}>
        {/* Grain */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        }} />
        {/* Glow orbs */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translate(-50%,-50%)", width: 800, height: 600, borderRadius: "50%", background: `radial-gradient(ellipse, ${GOLD}10 0%, transparent 65%)`, pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: -100, left: "20%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(ellipse, ${WINE}08 0%, transparent 65%)`, pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(to bottom, transparent, ${DEEP})`, pointerEvents: "none", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", animation: "fadein 0.7s ease both" }}>
          <div style={{ marginBottom: 40 }}>
            <img src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`} alt="ibhub" style={{ height: 44, objectFit: "contain" }} />
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: `linear-gradient(90deg, ${GOLD}18, ${GOLD}08)`,
            border: `1px solid ${GOLD}35`,
            borderRadius: 100, padding: "6px 18px", marginBottom: 36,
          }}>
            <span style={{ color: GOLD, fontSize: 13 }}>✦</span>
            <span style={{ color: GOLD, fontWeight: 600, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" }}>
              A rede profissional do vinho no Brasil
            </span>
          </div>

          <h1
            className="hero-h1"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 58, fontWeight: 900,
              color: "#fff", lineHeight: 1.08,
              marginBottom: 28, letterSpacing: -1,
            }}
          >
            Sua carreira no vinho<br />
            <span style={{
              background: `linear-gradient(90deg, ${GOLD}, #e8c87a, ${GOLD})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>merece mais.</span>
          </h1>

          <p className="hero-body-p" style={{
            fontSize: 17, color: "rgba(255,255,255,0.5)",
            lineHeight: 1.8, marginBottom: 56,
            maxWidth: 480, margin: "0 auto 56px",
            fontWeight: 400,
          }}>
            Junte-se a mais de 8.000 profissionais do setor. Acesse inteligência de mercado exclusiva, crie conexões reais e expanda seus negócios.
          </p>

          {/* Stats */}
          <div className="stats-row hero-stats" style={{ display: "flex", gap: 64, justifyContent: "center", marginBottom: 64 }}>
            {[
              { value: "8.000+", label: "Profissionais na rede" },
              { value: "12+",    label: "Países representados" },
              { value: "94%",    label: "Taxa de renovação" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div className="stat-value" style={{ fontSize: 32, fontWeight: 900, color: GOLD, letterSpacing: -0.5, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", fontWeight: 500, marginTop: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <a
            href="#planos"
            className="hero-cta"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: `linear-gradient(135deg, ${GOLD} 0%, #e8c87a 50%, #b8932a 100%)`,
              color: DEEP, fontWeight: 800, fontSize: 15,
              padding: "16px 44px", borderRadius: 100,
              textDecoration: "none", letterSpacing: 0.3,
              boxShadow: `0 8px 40px ${GOLD}45, 0 2px 8px rgba(0,0,0,0.3)`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 12px 52px ${GOLD}65, 0 2px 8px rgba(0,0,0,0.3)`; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 8px 40px ${GOLD}45, 0 2px 8px rgba(0,0,0,0.3)`; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; }}
          >
            Ver planos e preços
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3L8 13M8 13L4 9M8 13L12 9" stroke={DEEP} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </section>

      {/* ── Por que Pro ── */}
      <section className="benefits-section" style={{ padding: "100px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <p style={{ color: GOLD, fontWeight: 600, fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 16 }}>
              Por que ibhub Pro?
            </p>
            <h2 className="benefits-title" style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 40, fontWeight: 800, color: NAVY, lineHeight: 1.15,
            }}>
              Tudo que você precisa para<br />crescer no setor de vinhos
            </h2>
          </div>
          <div className="benefits-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { icon: "✦", title: "Rede exclusiva",           desc: "Conecte-se com importadores, produtores, sommeliers e distribuidores do setor vitivinícola." },
              { icon: "◈", title: "Inteligência de mercado",  desc: "Dados, gráficos e KPIs exclusivos do Ideal.BI para tomadas de decisão mais precisas." },
              { icon: "▲", title: "Masterclasses & conteúdo", desc: "Acesso a eventos, palestras e apresentações de especialistas renomados do setor." },
              { icon: "◉", title: "Página corporativa",       desc: "Mostre sua marca, portfólio e serviços para toda a comunidade ibhub." },
              { icon: "◎", title: "Reveals de exportação",    desc: "Descubra quanto cada importador exportou e acesse dados diretos de decisores." },
              { icon: "⬡", title: "Chat sem limites",         desc: "Mensagens diretas ilimitadas com qualquer profissional da plataforma." },
            ].map((b, i) => (
              <div
                key={b.title}
                style={{
                  padding: "32px 28px",
                  background: "#f9f8f6",
                  border: "1px solid #ede9e2",
                  borderRadius: 16,
                  transition: "all 0.2s",
                  cursor: "default",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; (e.currentTarget as HTMLDivElement).style.borderColor = `${GOLD}50`; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 24px ${GOLD}12`; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "#f9f8f6"; (e.currentTarget as HTMLDivElement).style.borderColor = "#ede9e2"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ color: GOLD, fontSize: 20, marginBottom: 18, fontWeight: 400 }}>{b.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 10, letterSpacing: 0.1 }}>{b.title}</h3>
                <p style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.75 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section id="planos" className="plans-section" style={{
        padding: "120px 24px 140px",
        background: `radial-gradient(ellipse 100% 60% at 50% 100%, #0d1f35 0%, ${DEEP} 70%)`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 900, height: 600, borderRadius: "50%", background: `radial-gradient(ellipse, ${GOLD}06 0%, transparent 65%)`, pointerEvents: "none" }} />

        <div style={{ maxWidth: 1120, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <p style={{ color: GOLD, fontWeight: 600, fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 16 }}>
              Escolha seu plano
            </p>
            <h2 className="plans-section-title" style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 42, fontWeight: 800, color: "#fff", marginBottom: 16, lineHeight: 1.1,
            }}>
              Invista no seu crescimento
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", maxWidth: 380, margin: "0 auto", fontWeight: 400 }}>
              Sem letras miúdas. Cancele quando quiser.
            </p>
          </div>

          {error && (
            <div style={{
              background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)",
              borderRadius: 12, padding: "14px 20px", marginBottom: 40,
              color: "#f87171", fontSize: 14, textAlign: "center", maxWidth: 720, margin: "0 auto 40px",
            }}>
              ⚠ {error}
            </div>
          )}

          {plansLoading ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{
                width: 36, height: 36, border: `2px solid ${GOLD}25`, borderTopColor: GOLD,
                borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px",
              }} />
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Carregando planos…</p>
            </div>
          ) : (
            <>
              <div
                className="plans-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${paidPlans.length}, 1fr)`,
                  gap: 16,
                  alignItems: "center",
                }}
              >
                {paidPlans.map((plan) => {
                  const isCurrent  = plan.id === currentPlan && hasActiveSub;
                  const isLoading  = loading === plan.id;
                  const planKey    = plan.name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
                  const isPopular  = planKey.includes("empresa");
                  const price      = formatPlanPrice(plan);
                  const origPrice  = formatOriginalPrice(plan);
                  const discount   = calcDiscount(plan);
                  const copy       = PLAN_COPY[planKey] ?? null;

                  if (isPopular) {
                    return (
                      <div
                        key={plan.id}
                        className="plan-card plan-card-popular gold-glow popular-card-inner"
                        style={{
                          background: `linear-gradient(160deg, #0c1e34 0%, #071224 100%)`,
                          borderRadius: 24,
                          border: `1.5px solid ${GOLD}55`,
                          padding: "52px 36px 40px",
                          position: "relative",
                          display: "flex", flexDirection: "column",
                          zIndex: 2,
                        }}
                      >
                        {/* Grain on popular card */}
                        <div style={{
                          position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", zIndex: 0,
                          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
                        }} />
                        {/* Gold top edge */}
                        <div style={{
                          position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "24px 24px 0 0",
                          background: `linear-gradient(90deg, transparent, ${GOLD}, #e8c87a, ${GOLD}, transparent)`,
                        }} />

                        {!isCurrent && (
                          <div className="badge-shimmer" style={{
                            position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                            background: `linear-gradient(90deg, #a07830, ${GOLD}, #e8c87a, ${GOLD}, #a07830)`,
                            backgroundSize: "200%",
                            color: DEEP, fontWeight: 900,
                            fontSize: 10, padding: "6px 22px", borderRadius: 100, letterSpacing: 2,
                            whiteSpace: "nowrap",
                            boxShadow: `0 4px 20px ${GOLD}60`,
                          }}>
                            ✦ MAIS POPULAR
                          </div>
                        )}
                        {isCurrent && (
                          <div style={{
                            position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                            backgroundColor: "#059669", color: "#fff", fontWeight: 900,
                            fontSize: 10, padding: "6px 22px", borderRadius: 100, letterSpacing: 1.5,
                            whiteSpace: "nowrap",
                          }}>
                            ✓ SEU PLANO ATUAL
                          </div>
                        )}

                        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
                          {copy?.tag && (
                            <p style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
                              color: GOLD, textTransform: "uppercase", marginBottom: 10,
                            }}>{copy.tag}</p>
                          )}
                          <h2 style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: 32, fontWeight: 900, color: "#fff",
                            marginBottom: 4, letterSpacing: -0.5,
                          }}>{plan.name}</h2>
                          {copy?.tagline && (
                            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginBottom: 32, fontWeight: 400 }}>
                              {copy.tagline}
                            </p>
                          )}

                          {/* Price */}
                          <div style={{ marginBottom: 32 }}>
                            {origPrice && (
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textDecoration: "line-through", marginBottom: 6 }}>
                                De {origPrice}/mês
                              </div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <PriceDisplay priceStr={price.main} gold />
                              {discount && (
                                <span style={{
                                  background: `${GOLD}20`, color: GOLD,
                                  fontWeight: 800, fontSize: 11,
                                  padding: "3px 10px", borderRadius: 6,
                                  border: `1px solid ${GOLD}35`,
                                  alignSelf: "flex-start", marginTop: 12,
                                }}>−{discount}%</span>
                              )}
                            </div>
                            {price.period && (
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 4 }}>{price.period}</div>
                            )}
                          </div>

                          {/* Separator */}
                          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}30, transparent)`, marginBottom: 28 }} />

                          {/* Highlights */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, marginBottom: 36 }}>
                            {(copy?.highlights ?? []).map((h, i) => (
                              <div
                                key={h.label}
                                className="highlight-row"
                                style={{
                                  display: "flex", alignItems: "flex-start", gap: 14,
                                  padding: "13px 4px",
                                  borderBottom: i < (copy?.highlights.length ?? 0) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                                  borderRadius: 6,
                                }}
                              >
                                <div style={{
                                  width: 20, height: 20, flexShrink: 0, marginTop: 1,
                                  background: `${GOLD}20`, borderRadius: "50%",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  border: `1px solid ${GOLD}40`,
                                }}>
                                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                    <path d="M1 3.5L3.5 6L8 1" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                                <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{h.label}</div>
                                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2, lineHeight: 1.4 }}>{h.desc}</div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {isCurrent ? (
                            <div style={{
                              background: `${GOLD}14`, border: `1px solid ${GOLD}35`,
                              borderRadius: 14, padding: "16px 0", textAlign: "center",
                              color: GOLD, fontWeight: 800, fontSize: 15,
                            }}>✓ Plano atual</div>
                          ) : (
                            <button
                              className="cta-btn"
                              onClick={() => handleAssinar(plan.id)}
                              disabled={isLoading || !!loading}
                              style={{
                                background: `linear-gradient(135deg, ${GOLD} 0%, #e8c87a 50%, #c9a84c 100%)`,
                                color: DEEP, border: "none", borderRadius: 14,
                                padding: "18px 0", fontSize: 15, fontWeight: 900,
                                cursor: (isLoading || !!loading) ? "not-allowed" : "pointer",
                                opacity: (isLoading || (!!loading && loading !== plan.id)) ? 0.6 : 1,
                                width: "100%", letterSpacing: 0.3,
                                boxShadow: `0 6px 32px ${GOLD}45`,
                              }}
                            >
                              {isLoading ? "Redirecionando…" : `Assinar ${plan.name}`}
                            </button>
                          )}
                          {!isCurrent && (
                            <p style={{ textAlign: "center", fontSize: 11.5, color: "rgba(255,255,255,0.25)", marginTop: 14, letterSpacing: 0.2 }}>
                              Cancele quando quiser · Sem fidelidade
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  /* Side cards */
                  return (
                    <div
                      key={plan.id}
                      className="plan-card side-card-inner"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 20,
                        border: isCurrent ? "1.5px solid #05966950" : "1px solid rgba(255,255,255,0.09)",
                        padding: "36px 28px 32px",
                        display: "flex", flexDirection: "column",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      {isCurrent && (
                        <div style={{
                          position: "relative", top: -52, left: "50%", transform: "translateX(-50%)",
                          backgroundColor: "#059669", color: "#fff", fontWeight: 900,
                          fontSize: 10, padding: "5px 18px", borderRadius: 100, letterSpacing: 1.5,
                          whiteSpace: "nowrap", width: "fit-content", margin: "-36px auto 20px",
                        }}>
                          ✓ SEU PLANO ATUAL
                        </div>
                      )}

                      {copy?.tag && (
                        <p style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
                          color: "rgba(201,168,76,0.7)", textTransform: "uppercase", marginBottom: 8,
                        }}>{copy.tag}</p>
                      )}
                      <h2 style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: 26, fontWeight: 800, color: "rgba(255,255,255,0.9)",
                        marginBottom: 4, letterSpacing: -0.3,
                      }}>{plan.name}</h2>
                      {copy?.tagline && (
                        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", marginBottom: 24, fontWeight: 400 }}>
                          {copy.tagline}
                        </p>
                      )}

                      {/* Price */}
                      <div style={{ marginBottom: 24 }}>
                        {origPrice && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textDecoration: "line-through", marginBottom: 4 }}>
                            De {origPrice}/mês
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <PriceDisplay priceStr={price.main} />
                          {discount && (
                            <span style={{
                              background: "rgba(220,38,38,0.15)", color: "#f87171",
                              fontWeight: 700, fontSize: 11,
                              padding: "2px 8px", borderRadius: 5,
                              border: "1px solid rgba(220,38,38,0.2)",
                              alignSelf: "flex-start", marginTop: 12,
                            }}>−{discount}%</span>
                          )}
                        </div>
                        {price.period && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{price.period}</div>
                        )}
                      </div>

                      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 22 }} />

                      {/* Highlights */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, marginBottom: 28 }}>
                        {(copy?.highlights ?? []).map((h, i) => (
                          <div
                            key={h.label}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: 12,
                              padding: "11px 4px",
                              borderBottom: i < (copy?.highlights.length ?? 0) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            }}
                          >
                            <div style={{
                              width: 18, height: 18, flexShrink: 0, marginTop: 1,
                              background: "rgba(255,255,255,0.06)", borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}>
                              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                <path d="M1 3L3 5L7 1" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", lineHeight: 1.3 }}>{h.label}</div>
                              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", marginTop: 2, lineHeight: 1.4 }}>{h.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {isCurrent ? (
                        <div style={{
                          background: "rgba(5,150,105,0.12)", border: "1px solid rgba(5,150,105,0.3)",
                          borderRadius: 12, padding: "14px 0", textAlign: "center",
                          color: "#34d399", fontWeight: 700, fontSize: 14,
                        }}>✓ Plano atual</div>
                      ) : (
                        <button
                          className="cta-btn"
                          onClick={() => handleAssinar(plan.id)}
                          disabled={isLoading || !!loading}
                          style={{
                            background: "rgba(255,255,255,0.07)",
                            border: "1px solid rgba(255,255,255,0.14)",
                            color: "rgba(255,255,255,0.85)", borderRadius: 12,
                            padding: "16px 0", fontSize: 14, fontWeight: 700,
                            cursor: (isLoading || !!loading) ? "not-allowed" : "pointer",
                            opacity: (isLoading || (!!loading && loading !== plan.id)) ? 0.5 : 1,
                            width: "100%", letterSpacing: 0.2,
                          }}
                        >
                          {isLoading ? "Redirecionando…" : `Assinar ${plan.name}`}
                        </button>
                      )}
                      {!isCurrent && (
                        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 12 }}>
                          Cancele quando quiser · Sem fidelidade
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {freePlan && (
                <p style={{ textAlign: "center", marginTop: 36, fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                  {isFree
                    ? <>Você está no plano <strong style={{ color: "rgba(255,255,255,0.5)" }}>{freePlan.name}</strong> · Acesso básico à plataforma</>
                    : <>Ou continue com o plano <strong style={{ color: "rgba(255,255,255,0.5)" }}>{freePlan.name}</strong> gratuitamente</>
                  }
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Trust strip ── */}
      <div className="trust-strip" style={{
        borderTop: `1px solid rgba(255,255,255,0.06)`,
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        backgroundColor: "rgba(255,255,255,0.02)",
        padding: "20px 24px",
        display: "flex", flexWrap: "wrap", gap: 32,
        justifyContent: "center", alignItems: "center",
      }}>
        {[
          { icon: "🔒", text: "Pagamento 100% seguro via Stripe" },
          { icon: "💳", text: "Cartão de crédito" },
          { icon: "✕",  text: "Cancele quando quiser" },
          { icon: "🇧🇷", text: "Preços em Reais" },
          { icon: "📧", text: "Recibo por e-mail" },
        ].map(t => (
          <div key={t.text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 500, letterSpacing: 0.2 }}>{t.text}</span>
          </div>
        ))}
      </div>

      {/* ── Testimonials ── */}
      <section className="testimonials-section" style={{ padding: "100px 24px", background: "#f9f8f6" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <p style={{ color: GOLD, fontWeight: 600, fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 16 }}>
              Quem já usa o ibhub Pro
            </p>
            <h2 className="testimonials-title" style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 38, fontWeight: 800, color: NAVY, lineHeight: 1.15,
            }}>
              Histórias reais de crescimento
            </h2>
          </div>
          <div
            className="testimonials-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
          >
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                style={{
                  padding: "36px 32px",
                  background: i === 1 ? "#fff" : "#fff",
                  border: `1px solid ${i === 1 ? `${GOLD}40` : "#ede9e2"}`,
                  borderRadius: 18,
                  boxShadow: i === 1 ? `0 8px 32px ${GOLD}10` : "0 2px 12px rgba(0,0,0,0.04)",
                  display: "flex", flexDirection: "column",
                }}
              >
                <div style={{ color: GOLD, fontSize: 15, marginBottom: 20, letterSpacing: 3 }}>
                  {"★".repeat(5)}
                </div>
                <p style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 15, color: "#374151",
                  lineHeight: 1.8, marginBottom: 32, flex: 1,
                  fontStyle: "italic", fontWeight: 400,
                }}>
                  "{t.text}"
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${NAVY}, #1a3a5c)`,
                    color: GOLD, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                    border: `1.5px solid ${GOLD}40`,
                  }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guarantee ── */}
      <section className="guarantee-section" style={{
        padding: "100px 24px", textAlign: "center",
        borderTop: `1px solid rgba(255,255,255,0.06)`,
        background: `radial-gradient(ellipse 80% 60% at 50% 50%, #0d1f35 0%, ${DEEP} 80%)`,
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: `${GOLD}12`, border: `1px solid ${GOLD}35`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, margin: "0 auto 28px",
          }}>🛡️</div>
          <h2 className="guarantee-title" style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 18, lineHeight: 1.2,
          }}>
            Sem risco para você
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.42)", lineHeight: 1.85, marginBottom: 44 }}>
            Se por qualquer motivo você não ficar satisfeito, basta cancelar quando quiser — sem perguntas, sem multas. Seu acesso continua ativo até o fim do período já pago.
          </p>
          <a
            href="#planos"
            style={{
              display: "inline-block",
              background: `linear-gradient(135deg, ${GOLD}, #e8c87a, #c9a84c)`,
              color: DEEP, fontWeight: 800, fontSize: 15,
              padding: "16px 44px", borderRadius: 100, textDecoration: "none",
              boxShadow: `0 8px 40px ${GOLD}40`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 12px 52px ${GOLD}60`; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 8px 40px ${GOLD}40`; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; }}
          >
            Começar agora →
          </a>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="faq-section" style={{ padding: "100px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ color: GOLD, fontWeight: 600, fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 16 }}>FAQ</p>
            <h2 className="faq-title" style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 36, fontWeight: 800, color: NAVY,
            }}>Dúvidas frequentes</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="faq-row"
                style={{
                  borderBottom: `1px solid #ede9e2`,
                  overflow: "hidden", borderRadius: 4,
                  backgroundColor: openFaq === i ? `${GOLD}06` : "transparent",
                }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "24px 8px", gap: 16, cursor: "pointer",
                }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: openFaq === i ? NAVY : "#374151", flex: 1, lineHeight: 1.4 }}>
                    {faq.q}
                  </span>
                  <span style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: openFaq === i ? GOLD : "#f3f0ea",
                    color: openFaq === i ? "#fff" : "#9ca3af",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 700, flexShrink: 0,
                    transform: openFaq === i ? "rotate(45deg)" : "none",
                    transition: "all 0.2s",
                  }}>+</span>
                </div>
                {openFaq === i && (
                  <div style={{
                    padding: "0 8px 24px",
                    fontSize: 14, color: "#6b7280", lineHeight: 1.85,
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
      <section className="footer-cta-section" style={{
        padding: "100px 24px", textAlign: "center",
        borderTop: `1px solid rgba(255,255,255,0.06)`,
        background: `radial-gradient(ellipse 80% 60% at 50% 50%, #0d1f35 0%, ${DEEP} 80%)`,
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <img src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`} alt="ibhub" style={{ height: 34, objectFit: "contain", marginBottom: 32, opacity: 0.9 }} />
          <h2 className="footer-cta-title" style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 16, lineHeight: 1.2,
          }}>
            Pronto para elevar sua carreira?
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 40, lineHeight: 1.75 }}>
            Mais de 8.000 profissionais já estão na maior rede do vinho do Brasil.
          </p>
          <a
            href="#planos"
            style={{
              display: "inline-block",
              background: `linear-gradient(135deg, ${GOLD}, #e8c87a, #c9a84c)`,
              color: DEEP, fontWeight: 800, fontSize: 15,
              padding: "16px 48px", borderRadius: 100, textDecoration: "none",
              boxShadow: `0 8px 40px ${GOLD}40`,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 12px 52px ${GOLD}60`; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 8px 40px ${GOLD}40`; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; }}
          >
            Ver planos →
          </a>
          <div style={{ marginTop: 24 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
              Dúvidas?{" "}
              <a href="mailto:contato@ibhub.com.br" style={{ color: `${GOLD}90`, fontWeight: 600, textDecoration: "none" }}>
                contato@ibhub.com.br
              </a>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
