import { Link } from "wouter";

const FEATURES = [
  { icon: "🍷", title: "Feed Profissional", desc: "Compartilhe degustações, artigos e atualizações com a comunidade do vinho." },
  { icon: "🏪", title: "Marketplace", desc: "Compre e venda vinhos, equipamentos e serviços diretamente na plataforma." },
  { icon: "🗂️", title: "Adega Virtual", desc: "Organize e gerencie sua coleção de vinhos com avaliações e notas pessoais." },
  { icon: "💬", title: "Chat & Networking", desc: "Conecte-se com sommeliers, produtores e importadores do mundo todo." },
  { icon: "💼", title: "Vagas & Oportunidades", desc: "Encontre e publique oportunidades no mercado de vinhos." },
  { icon: "📊", title: "Dados de Mercado", desc: "Inteligência e tendências do mercado vitivinícola em tempo real." },
];

const PLANS = [
  { key: "basico", name: "Básico", price: "Grátis", subtitle: "Para iniciantes", popular: false, features: ["Perfil básico", "Feed de publicações", "5 conexões/mês"], cta: "Começar grátis" },
  { key: "premium", name: "Premium", price: "R$ 149", period: "/mês", subtitle: "Para profissionais", popular: true, features: ["Tudo do Básico", "Conexões ilimitadas", "Marketplace", "Dados de mercado"], cta: "Começar Premium" },
  { key: "exclusive", name: "Exclusive", price: "R$ 299", period: "/mês", subtitle: "Para especialistas", popular: false, features: ["Tudo do Premium", "Inteligência de mercado", "Apresentações exclusivas", "Destaque no feed"], cta: "Começar Exclusive" },
  { key: "business", name: "Business", price: "R$ 499", period: "/mês", subtitle: "Para empresas", popular: false, features: ["Tudo do Exclusive", "Página empresarial", "Vagas de emprego", "Suporte prioritário"], cta: "Começar Business" },
];

const navLinkOutline: React.CSSProperties = {
  color: "#c9a84c", fontWeight: 700, fontSize: 14, textDecoration: "none",
  padding: "8px 20px", borderRadius: 8, border: "1.5px solid #c9a84c", display: "inline-block",
};
const navLinkFill: React.CSSProperties = {
  backgroundColor: "#c9a84c", color: "#0d1b2a", fontWeight: 800, fontSize: 14,
  textDecoration: "none", padding: "8px 20px", borderRadius: 8, display: "inline-block",
};
const heroBtnPrimary: React.CSSProperties = {
  backgroundColor: "#c9a84c", color: "#0d1b2a", fontWeight: 800, fontSize: 16,
  textDecoration: "none", padding: "16px 36px", borderRadius: 12,
  boxShadow: "0 8px 32px rgba(201,168,76,0.35)", display: "inline-block",
};
const heroBtnSecondary: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.1)", color: "#ffffff", fontWeight: 700, fontSize: 16,
  textDecoration: "none", padding: "16px 36px", borderRadius: 12,
  border: "1.5px solid rgba(255,255,255,0.25)", display: "inline-block",
};

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#0d1b2a", backgroundColor: "#f2f3f5" }}>
      {/* Navbar */}
      <nav style={{
        backgroundColor: "#0d1b2a", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#c9a84c", letterSpacing: -0.5 }}>ibhub</span>
          <span style={{
            fontSize: 8, fontWeight: 800, color: "#c9a84c",
            backgroundColor: "rgba(201,168,76,0.12)", padding: "2px 7px", borderRadius: 4,
            marginTop: 2, letterSpacing: 2.5,
          }}>REDE DO VINHO</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/login" style={navLinkOutline}>Entrar</Link>
          <Link href="/cadastro" style={navLinkFill}>Criar conta</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(135deg, #0d1b2a 0%, #243b55 60%, #722f37 100%)",
        minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "80px 24px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: "radial-gradient(circle at 2px 2px, #c9a84c 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div style={{ position: "relative", maxWidth: 720 }}>
          <div style={{
            display: "inline-block",
            backgroundColor: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 100, padding: "6px 20px", marginBottom: 28,
          }}>
            <span style={{ color: "#c9a84c", fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>
              🍷 A REDE PROFISSIONAL DO VINHO
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, color: "#ffffff",
            lineHeight: 1.12, marginBottom: 24, letterSpacing: -1,
          }}>
            Onde o mundo do vinho<br />
            <span style={{ color: "#c9a84c" }}>se encontra</span>
          </h1>
          <p style={{
            fontSize: 18, color: "rgba(255,255,255,0.75)", lineHeight: 1.7,
            maxWidth: 540, margin: "0 auto 40px",
          }}>
            Conecte-se com sommeliers, produtores, importadores e entusiastas.
            Gerencie sua adega, acesse o marketplace e encontre oportunidades de carreira.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/cadastro" style={heroBtnPrimary}>Criar conta grátis</Link>
            <Link href="/login" style={heroBtnSecondary}>Já tenho conta</Link>
          </div>
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 52, flexWrap: "wrap" }}>
            {[["5.000+", "Profissionais"], ["120+", "Países"], ["98%", "Satisfação"]].map(([num, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#c9a84c" }}>{num}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section style={{ padding: "96px 24px", backgroundColor: "#ffffff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 60, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <div style={{ width: 48, height: 4, backgroundColor: "#c9a84c", borderRadius: 2, marginBottom: 20 }} />
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0d1b2a", lineHeight: 1.2, marginBottom: 20 }}>
              A plataforma feita para quem vive o vinho
            </h2>
            <p style={{ fontSize: 17, color: "#4a5568", lineHeight: 1.8, marginBottom: 16 }}>
              O ibhub nasce da necessidade de um espaço profissional dedicado ao universo do vinho — onde conexões reais geram negócios reais.
            </p>
            <p style={{ fontSize: 17, color: "#4a5568", lineHeight: 1.8 }}>
              Seja você um sommelier buscando oportunidades, um produtor querendo expandir mercado, ou um importador conectando-se com fornecedores globais — o ibhub é o seu hub.
            </p>
          </div>
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[["🌍", "Alcance global"], ["🤝", "Networking real"], ["🔒", "Plataforma segura"], ["📱", "App mobile"]].map(([icon, label]) => (
                <div key={label as string} style={{
                  backgroundColor: "#f9f9fb", borderRadius: 12, padding: "20px 16px",
                  textAlign: "center", border: "1px solid #eef0f3",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0d1b2a" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "96px 24px", backgroundColor: "#f2f3f5" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0d1b2a", marginBottom: 14 }}>
              Tudo que você precisa em um só lugar
            </h2>
            <p style={{ fontSize: 17, color: "#8a93a2", maxWidth: 480, margin: "0 auto" }}>
              Funcionalidades construídas para o profissional do vinho moderno.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                backgroundColor: "#ffffff", borderRadius: 16, padding: 28,
                border: "1px solid #eef0f3", boxShadow: "0 2px 12px rgba(13,27,42,0.05)",
              }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0d1b2a", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 15, color: "#8a93a2", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section style={{ padding: "96px 24px", backgroundColor: "#0d1b2a" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#ffffff", marginBottom: 14 }}>Planos para cada perfil</h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.55)", maxWidth: 460, margin: "0 auto" }}>Comece grátis e faça upgrade quando quiser.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
            {PLANS.map((plan) => (
              <div key={plan.key} style={{
                backgroundColor: plan.popular ? "#c9a84c" : "rgba(255,255,255,0.06)",
                borderRadius: 16, padding: 28,
                border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.1)",
                position: "relative",
              }}>
                {plan.popular && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    backgroundColor: "#722f37", color: "#ffffff", fontSize: 11, fontWeight: 800,
                    padding: "4px 14px", borderRadius: 100, letterSpacing: 1.5, whiteSpace: "nowrap",
                  }}>MAIS POPULAR</div>
                )}
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: plan.popular ? "#0d1b2a" : "#8a93a2" }}>{plan.subtitle}</span>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: plan.popular ? "#0d1b2a" : "#ffffff", marginBottom: 4 }}>{plan.name}</h3>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: plan.popular ? "#0d1b2a" : "#c9a84c" }}>{plan.price}</span>
                  {"period" in plan && <span style={{ fontSize: 15, color: plan.popular ? "#0d1b2a" : "#8a93a2" }}>{plan.period}</span>}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: 14, color: plan.popular ? "#0d1b2a" : "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: plan.popular ? "#0d1b2a" : "#c9a84c", fontWeight: 800 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro" style={{
                  display: "block", textAlign: "center", padding: "12px 0", borderRadius: 10,
                  fontWeight: 800, fontSize: 14, textDecoration: "none",
                  backgroundColor: plan.popular ? "#0d1b2a" : "rgba(201,168,76,0.15)",
                  color: "#c9a84c",
                  border: plan.popular ? "none" : "1px solid rgba(201,168,76,0.3)",
                } as React.CSSProperties}>{plan.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: "96px 24px", background: "linear-gradient(135deg, #722f37 0%, #0d1b2a 100%)", textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: "#ffffff", marginBottom: 16, lineHeight: 1.15 }}>
            Pronto para fazer parte da rede?
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", marginBottom: 40, lineHeight: 1.7 }}>
            Junte-se a milhares de profissionais do vinho que já usam o ibhub para crescer.
          </p>
          <Link href="/cadastro" style={{
            display: "inline-block", backgroundColor: "#c9a84c", color: "#0d1b2a",
            fontWeight: 800, fontSize: 17, padding: "18px 48px", borderRadius: 12,
            textDecoration: "none", boxShadow: "0 8px 32px rgba(201,168,76,0.35)",
          }}>Criar minha conta grátis</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: "#0d1b2a", padding: "48px 24px 28px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 32, marginBottom: 40 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#c9a84c", marginBottom: 8 }}>ibhub</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(201,168,76,0.6)", letterSpacing: 2.5, marginBottom: 14 }}>REDE DO VINHO</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", maxWidth: 260, lineHeight: 1.65 }}>A plataforma profissional para o universo do vinho.</p>
            </div>
            <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
              {[
                { title: "Produto", links: ["Funcionalidades", "Planos", "Marketplace", "App Mobile"] },
                { title: "Legal", links: ["Termos de Uso", "Privacidade", "Cookies"] },
                { title: "Suporte", links: ["Central de Ajuda", "Contato", "Blog"] },
              ].map(({ title, links }) => (
                <div key={title}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", marginBottom: 14 }}>{title}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {links.map((l) => (
                      <a key={l} href="#" style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>{l}</a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>© 2025 ibhub. Todos os direitos reservados.</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Feito com 🍷 para profissionais do vinho</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
