import { Link } from "wouter";
import { useState, useEffect } from "react";

function useIsMobile() {
  const [mobile, setMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

/* ─── Paleta ─────────────────────────────── */
const navy  = "#0d1b2a";
const gold  = "#c9a84c";
const bg    = "#f5f5f0";
const white = "#ffffff";

/* ─── Dados ──────────────────────────────── */
const FEATURES = [
  {
    svg: (
      <svg width="28" height="28" fill="none" stroke={gold} strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: "Rede Profissional",
    desc:  "Conecte-se com produtores, sommeliers, importadores e mais profissionais do vinho.",
  },
  {
    svg: (
      <svg width="28" height="28" fill="none" stroke={gold} strokeWidth="1.8" viewBox="0 0 24 24">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><polyline points="22 12 18 8 14 12"/>
      </svg>
    ),
    title: "Dados de Mercado",
    desc:  "Acesse indicadores, apresentações e análises exclusivas do mercado vitivinícola.",
  },
  {
    svg: (
      <svg width="28" height="28" fill="none" stroke={gold} strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
    title: "Oportunidades",
    desc:  "Vagas, marketplace B2B e negócios diretos entre profissionais do setor.",
  },
  {
    svg: (
      <svg width="28" height="28" fill="none" stroke={gold} strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: "Eventos",
    desc:  "Descubra e participe de degustações, feiras e encontros do mundo do vinho.",
  },
  {
    svg: (
      <svg width="28" height="28" fill="none" stroke={gold} strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M8 22H5a2 2 0 0 1-2-2V6l3-3h14a2 2 0 0 1 2 2v5"/>
        <polyline points="3 6 5 6 5 3"/><circle cx="16" cy="16" r="6"/>
        <polyline points="16 13 16 16 18 16"/>
      </svg>
    ),
    title: "Adega Digital",
    desc:  "Gerencie sua coleção de vinhos, avaliações e notas de degustação.",
  },
  {
    svg: (
      <svg width="28" height="28" fill="none" stroke={gold} strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "Chat & Grupos",
    desc:  "Converse e colabore com sua rede em tempo real.",
  },
];

const PLANS = [
  {
    key: "gratuito", name: "Gratuito", price: "R$ 0", period: "/mês",
    popular: false,
    features: ["Perfil básico", "Feed de publicações", "5 conexões/mês", "Grupos públicos"],
    cta: "Começar grátis",
  },
  {
    key: "profissional", name: "Profissional", price: "R$ 99,90", period: "/mês",
    popular: true,
    features: ["Conexões ilimitadas", "Dados de mercado", "Chat ilimitado", "Ver visitantes do perfil"],
    cta: "Assinar",
  },
  {
    key: "empresa", name: "Empresa", price: "R$ 247", period: "/mês",
    popular: false,
    features: ["Página empresarial", "Publicar vagas e produtos", "Mini-CRM e analytics", "Marketplace B2B"],
    cta: "Assinar",
  },
  {
    key: "executivo", name: "Executivo", price: "R$ 499", period: "/mês",
    popular: false,
    features: ["Relatórios exclusivos", "Apresentações de mercado", "Selo verificado premium", "Suporte prioritário"],
    cta: "Assinar",
  },
];

const TESTIMONIALS = [
  {
    stars: 5,
    text: '"O ibhub transformou como conecto com importadores. Fechei 3 parcerias no primeiro mês."',
    name: "Maria Santos",
    role: "Sommelier, SP",
  },
  {
    stars: 5,
    text: '"Os dados de mercado me ajudam a tomar decisões estratégicas para minha vinícola."',
    name: "João Oliveira",
    role: "Produtor, RS",
  },
  {
    stars: 5,
    text: '"Encontro os melhores profissionais do setor em um só lugar. Indispensável!"',
    name: "Ana Costa",
    role: "Importadora, RJ",
  },
];

const FAQS = [
  { q: "O ibhub é gratuito?",         a: "Sim! Você pode criar sua conta gratuitamente e usar as funcionalidades básicas sem custo. Planos pagos oferecem recursos adicionais como conexões ilimitadas, dados de mercado e muito mais." },
  { q: "Quem pode usar o ibhub?",     a: "O ibhub é voltado para qualquer profissional do universo do vinho: sommeliers, produtores, importadores, distribuidores, varejistas e entusiastas que queiram se conectar ao mercado de forma profissional." },
  { q: "Posso criar uma página empresarial?", a: "Sim, as páginas empresariais estão disponíveis no plano Empresa. Com elas você pode publicar produtos, vagas de emprego e gerenciar contatos de negócios." },
  { q: "Como funciona o marketplace?", a: "O marketplace B2B do ibhub permite que produtores, importadores e distribuidores negociem diretamente, com visibilidade de preços, regiões e condições comerciais." },
];

/* ─── Componente FAQ accordion ─────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        backgroundColor: white,
        border: "1px solid #e8e8e3",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
      }}
      onClick={() => setOpen(!open)}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 24px",
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: navy }}>{q}</span>
        <svg
          width="18" height="18" fill="none" stroke={navy} strokeWidth="2" viewBox="0 0 24 24"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
      {open && (
        <div style={{ padding: "0 24px 18px", fontSize: 14, color: "#5a6577", lineHeight: 1.7 }}>
          {a}
        </div>
      )}
    </div>
  );
}

/* ─── Landing Page ───────────────────────── */
export default function LandingPage() {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: navy, backgroundColor: bg, margin: 0, padding: 0 }}>

      {/* ── Navbar ─────────────────────────── */}
      <nav style={{
        backgroundColor: white,
        borderBottom: "1px solid #eaeae5",
        padding: isMobile ? "0 16px" : "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 58, position: "sticky", top: 0, zIndex: 200,
        flexWrap: "wrap",
      }}>
        {/* Logo */}
        <img src={`${import.meta.env.BASE_URL}logo-ibhub.png`} alt="ibhub" style={{ height: 28, objectFit: "contain" }} />

        {isMobile ? (
          /* ── Mobile: Entrar + Hambúrguer ── */
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: navy, textDecoration: "none" }}>Entrar</Link>
            <Link href="/cadastro" style={{
              fontSize: 13, fontWeight: 700, color: navy, textDecoration: "none",
              backgroundColor: gold, padding: "7px 14px", borderRadius: 8,
            }}>Cadastrar</Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex", flexDirection: "column", gap: 5, marginLeft: 4 }}
              aria-label="Menu"
            >
              <span style={{ display: "block", width: 22, height: 2, backgroundColor: menuOpen ? gold : navy, borderRadius: 2, transition: "background 0.2s" }} />
              <span style={{ display: "block", width: 22, height: 2, backgroundColor: menuOpen ? gold : navy, borderRadius: 2, transition: "background 0.2s" }} />
              <span style={{ display: "block", width: 16, height: 2, backgroundColor: menuOpen ? gold : navy, borderRadius: 2, transition: "background 0.2s" }} />
            </button>
          </div>
        ) : (
          /* ── Desktop: links + ações ── */
          <>
            <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
              {["Recursos", "Planos", "Depoimentos", "FAQ"].map((l) => (
                <a key={l} href={`#${l.toLowerCase()}`}
                  style={{ fontSize: 14, color: "#555", textDecoration: "none", fontWeight: 500 }}
                >{l}</a>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: navy, textDecoration: "none" }}>Entrar</Link>
              <Link href="/cadastro" style={{
                fontSize: 14, fontWeight: 700, color: navy, textDecoration: "none",
                backgroundColor: gold, padding: "8px 20px", borderRadius: 8,
              }}>Cadastrar-se</Link>
            </div>
          </>
        )}

        {/* ── Mobile dropdown menu ── */}
        {isMobile && menuOpen && (
          <div style={{
            width: "100%", backgroundColor: white,
            borderTop: "1px solid #eaeae5",
            padding: "12px 0 16px",
          }}>
            {["Recursos", "Planos", "Depoimentos", "FAQ"].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "block", padding: "12px 16px",
                  fontSize: 15, fontWeight: 500, color: navy,
                  textDecoration: "none", borderBottom: "1px solid #f0f0eb",
                }}
              >{l}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── Hero ───────────────────────────── */}
      <section style={{
        backgroundColor: navy,
        padding: "100px 24px 80px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* subtle grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(201,168,76,0.06) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }} />

        <div style={{ position: "relative", maxWidth: 760, margin: "0 auto" }}>
          {/* badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 100, padding: "7px 18px", marginBottom: 36,
          }}>
            <svg width="14" height="14" fill="none" stroke={gold} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M8 22H5a2 2 0 0 1-2-2V6l3-3h14a2 2 0 0 1 2 2v5"/><circle cx="16" cy="16" r="6"/>
            </svg>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>A rede profissional do vinho</span>
          </div>

          {/* headline */}
          <h1 style={{
            fontSize: "clamp(38px, 6vw, 68px)", fontWeight: 900, lineHeight: 1.1,
            color: white, letterSpacing: -1.5, margin: "0 0 24px",
          }}>
            Conecte-se ao mundo do<br />
            <span style={{ color: gold }}>vinho profissional</span>
          </h1>

          {/* subtitle */}
          <p style={{
            fontSize: 17, color: "rgba(255,255,255,0.65)", lineHeight: 1.75,
            maxWidth: 580, margin: "0 auto 44px",
          }}>
            A plataforma onde sommeliers, produtores, importadores e entusiastas
            se encontram para networking, dados de mercado e oportunidades de negócio.
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/cadastro" style={{
              backgroundColor: gold, color: navy, fontWeight: 800, fontSize: 15,
              textDecoration: "none", padding: "14px 32px", borderRadius: 10,
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              Comece gratuitamente →
            </Link>
            <Link href="/login" style={{
              backgroundColor: "rgba(255,255,255,0.08)", color: white, fontWeight: 700, fontSize: 15,
              textDecoration: "none", padding: "14px 32px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)", display: "inline-block",
            }}>
              Já tenho conta
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display: "flex", gap: 0, justifyContent: "center",
            marginTop: 72, flexWrap: "wrap",
          }}>
            {[
              ["2.500+", "Profissionais"],
              ["150+",   "Empresas"],
              ["500+",   "Conexões/mês"],
              ["50+",    "Eventos"],
            ].map(([num, label], i) => (
              <div key={label} style={{
                textAlign: "center",
                padding: "0 40px",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.12)" : "none",
              }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: gold }}>{num}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────── */}
      <section id="recursos" style={{ padding: "96px 24px", backgroundColor: bg }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: navy, marginBottom: 14, letterSpacing: -0.5 }}>
              Tudo que você precisa em um só lugar
            </h2>
            <p style={{ fontSize: 16, color: "#7a8494", maxWidth: 520, margin: "0 auto", lineHeight: 1.65 }}>
              Ferramentas projetadas para profissionais do vinho crescerem sua rede e seus negócios.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                backgroundColor: white,
                border: "1px solid #eaeae5",
                borderRadius: 14,
                padding: "28px 24px",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  backgroundColor: `${gold}14`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 18,
                }}>{f.svg}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: navy, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#7a8494", lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ─────────────────────────── */}
      <section id="planos" style={{ padding: "96px 24px", backgroundColor: bg }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: navy, marginBottom: 14, letterSpacing: -0.5 }}>
              Planos para cada necessidade
            </h2>
            <p style={{ fontSize: 16, color: "#7a8494" }}>
              Comece gratuitamente e evolua conforme sua rede cresce.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20, alignItems: "start" }}>
            {PLANS.map((plan) => (
              <div key={plan.key} style={{
                backgroundColor: white,
                border: plan.popular ? `2px solid ${gold}` : "1px solid #eaeae5",
                borderRadius: 16,
                padding: "28px 24px",
                position: "relative",
              }}>
                {plan.popular && (
                  <div style={{
                    position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                    backgroundColor: gold, color: navy,
                    fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
                    padding: "4px 16px", borderRadius: 100, whiteSpace: "nowrap",
                  }}>Mais popular</div>
                )}

                <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 700, color: "#7a8494" }}>{plan.name}</div>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: navy }}>{plan.price}</span>
                  <span style={{ fontSize: 14, color: "#7a8494", marginLeft: 2 }}>{plan.period}</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.features.map((feat) => (
                    <li key={feat} style={{ fontSize: 14, color: "#4a5568", display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="15" height="15" fill="none" stroke={gold} strokeWidth="2.5" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link href="/cadastro" style={{
                  display: "block", textAlign: "center", padding: "11px 0",
                  borderRadius: 9, fontWeight: 700, fontSize: 14,
                  textDecoration: "none",
                  backgroundColor: plan.popular ? gold : white,
                  color: plan.popular ? navy : navy,
                  border: plan.popular ? "none" : "1.5px solid #d4d4cc",
                } as React.CSSProperties}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Depoimentos ────────────────────── */}
      <section id="depoimentos" style={{ padding: "96px 24px", backgroundColor: white }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: navy, marginBottom: 56, textAlign: "center", letterSpacing: -0.5 }}>
            O que dizem nossos membros
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} style={{
                backgroundColor: white,
                border: "1px solid #eaeae5",
                borderRadius: 14,
                padding: "28px 24px",
              }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill={gold}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
                <p style={{ fontSize: 14, color: "#4a5568", lineHeight: 1.7, marginBottom: 20, fontStyle: "italic" }}>{t.text}</p>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: navy }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: "#7a8494" }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────── */}
      <section id="faq" style={{ padding: "96px 24px", backgroundColor: bg }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: navy, marginBottom: 48, textAlign: "center", letterSpacing: -0.5 }}>
            Perguntas Frequentes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQS.map((faq) => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ── CTA Final ──────────────────────── */}
      <section style={{ padding: "96px 24px", backgroundColor: bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{
            backgroundColor: navy,
            borderRadius: 20,
            padding: "72px 48px",
            textAlign: "center",
          }}>
            <h2 style={{
              fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900,
              color: white, marginBottom: 16, letterSpacing: -0.8,
            }}>
              Pronto para expandir sua rede no mundo do vinho?
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginBottom: 40 }}>
              Junte-se a milhares de profissionais que já estão conectados no ibhub.
            </p>
            <Link href="/cadastro" style={{
              backgroundColor: gold, color: navy, fontWeight: 800, fontSize: 15,
              textDecoration: "none", padding: "15px 36px", borderRadius: 10,
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              Criar conta gratuita →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────── */}
      <footer style={{
        backgroundColor: white,
        borderTop: "1px solid #eaeae5",
        padding: isMobile ? "20px 16px" : "24px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <img src={`${import.meta.env.BASE_URL}logo-ibhub.png`} alt="ibhub" style={{ height: 24, objectFit: "contain" }} />
          <span style={{ fontSize: 13, color: "#9a9a8e" }}>© 2026 ibhub. Todos os direitos reservados.</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="#" style={{ fontSize: 13, color: "#7a8494", textDecoration: "none" }}>Termos</a>
          <a href="#" style={{ fontSize: 13, color: "#7a8494", textDecoration: "none" }}>Privacidade</a>
        </div>
      </footer>
    </div>
  );
}
