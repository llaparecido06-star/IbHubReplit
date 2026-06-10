import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const NAVY = "#0d1b2a";
const DEEP = "#0d1f35";
const GOLD = "#c9a84c";

const FEATURES = [
  { icon: "✦", label: "Rede profissional do vinho", desc: "Conecte-se com importadores, produtores, sommeliers e distribuidores do setor." },
  { icon: "◈", label: "Feed exclusivo da comunidade", desc: "Conteúdo, novidades e tendências do mercado vitivinícola." },
  { icon: "▲", label: "Eventos e masterclasses", desc: "Acesse convites e conteúdos de eventos do setor vitivinícola." },
  { icon: "◉", label: "Chat direto ilimitado", desc: "Mensagens diretas com qualquer profissional da plataforma." },
  { icon: "◎", label: "Adega virtual", desc: "Organize e acompanhe sua coleção de vinhos pessoalmente." },
  { icon: "⬡", label: "Certificações e perfil completo", desc: "Mostre sua trajetória e credenciais para toda a comunidade." },
];

export default function AssinarComunidadePage() {
  const { session, refreshProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    if (!session) {
      sessionStorage.setItem("redirect_after_login", "/comunidade-exclusiva");
      setLocation("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: updated, error: err } = await supabase
        .from("profiles")
        .update({ plan: "comunidade" })
        .or(`id.eq.${session.user.id},user_id.eq.${session.user.id}`)
        .select("id");
      if (err) throw err;
      if (!updated || updated.length === 0) throw new Error("Perfil não encontrado. Por favor, contacte o suporte.");
      await refreshProfile();
      setLocation("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ativar plano. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Inter', -apple-system, sans-serif", backgroundColor: DEEP, color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .comm-cta-btn { transition: all 0.2s ease; }
        .comm-cta-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 12px 52px rgba(201,168,76,0.6), 0 2px 8px rgba(0,0,0,0.3) !important; }
        .comm-cta-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .comm-feature-row { transition: background 0.15s; }
        .comm-feature-row:hover { background: rgba(255,255,255,0.04) !important; border-color: rgba(201,168,76,0.25) !important; }

        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadein { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glow   { 0%,100% { box-shadow: 0 0 60px rgba(201,168,76,0.15), 0 28px 80px rgba(0,0,0,0.5); } 50% { box-shadow: 0 0 90px rgba(201,168,76,0.3), 0 28px 80px rgba(0,0,0,0.5); } }

        .comm-card { animation: glow 3s ease-in-out infinite; }

        @media (max-width: 600px) {
          .comm-hero-h1 { font-size: 28px !important; }
          .comm-hero-sub { font-size: 14px !important; }
          .comm-card-inner { padding: 32px 20px 28px !important; }
          .comm-header { padding: 12px 16px !important; }
          .comm-hero { padding: 60px 16px 72px !important; }
          .comm-section { padding: 56px 16px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header className="comm-header" style={{
        position: "sticky", top: 0, zIndex: 200,
        backgroundColor: "rgba(6,16,30,0.88)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(201,168,76,0.12)",
        padding: "14px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button
          onClick={() => setLocation(session ? "/app" : "/")}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0 }}
        >
          <img src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`} alt="ibhub" style={{ height: 30, objectFit: "contain" }} />
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }}>/</span>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500, letterSpacing: 0.3 }}>Comunidade Exclusiva</span>
        </button>
        {!session && (
          <button
            onClick={() => setLocation("/login")}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.85)", borderRadius: 8,
              padding: "7px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >Entrar</button>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="comm-hero" style={{
        position: "relative", overflow: "hidden",
        padding: "100px 24px 110px",
        textAlign: "center",
        background: `radial-gradient(ellipse 120% 80% at 50% -10%, #1a2f44 0%, ${DEEP} 70%)`,
      }}>
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 500, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(to bottom, transparent, ${DEEP})`, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto", animation: "fadein 0.7s ease both" }}>
          <div style={{ marginBottom: 36 }}>
            <img src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`} alt="ibhub" style={{ height: 40, objectFit: "contain" }} />
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(90deg, rgba(201,168,76,0.18), rgba(201,168,76,0.08))",
            border: "1px solid rgba(201,168,76,0.35)",
            borderRadius: 100, padding: "6px 18px", marginBottom: 32,
          }}>
            <span style={{ color: GOLD, fontSize: 13 }}>✦</span>
            <span style={{ color: GOLD, fontWeight: 600, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" }}>
              A rede profissional do vinho no Brasil
            </span>
          </div>

          <h1 className="comm-hero-h1" style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 46, fontWeight: 900,
            color: "#fff", lineHeight: 1.1,
            marginBottom: 22, letterSpacing: -1,
          }}>
            Entre para a comunidade<br />
            <span style={{
              background: `linear-gradient(90deg, ${GOLD}, #e8c87a, ${GOLD})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>ibhub de vinhos.</span>
          </h1>

          <p className="comm-hero-sub" style={{
            fontSize: 16, color: "rgba(255,255,255,0.5)",
            lineHeight: 1.8, maxWidth: 440, margin: "0 auto 48px",
            fontWeight: 400,
          }}>
            Conecte-se com profissionais, acesse conteúdos exclusivos e faça parte da maior rede do setor vitivinícola do Brasil — sem custo.
          </p>

          <button
            className="comm-cta-btn"
            onClick={handleActivate}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: `linear-gradient(135deg, ${GOLD} 0%, #e8c87a 50%, #b8932a 100%)`,
              color: DEEP, fontWeight: 800, fontSize: 16,
              padding: "17px 48px", borderRadius: 100,
              border: "none", cursor: "pointer", letterSpacing: 0.3,
              boxShadow: "0 8px 40px rgba(201,168,76,0.45), 0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {loading ? (
              <span style={{ width: 18, height: 18, border: "2px solid rgba(13,27,42,0.3)", borderTopColor: DEEP, borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
            ) : "🍷"}
            {loading ? "Ativando…" : "Ativar acesso gratuito"}
          </button>

          {error && (
            <div style={{ marginTop: 20, color: "#f87171", fontSize: 13 }}>⚠ {error}</div>
          )}
        </div>
      </section>

      {/* ── Plan Card ── */}
      <section className="comm-section" style={{ padding: "80px 24px 96px", position: "relative" }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          <div className="comm-card comm-card-inner" style={{
            background: "linear-gradient(160deg, #0e2035 0%, #0d1b2a 100%)",
            border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 24,
            padding: "44px 40px 40px",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Glow accent */}
            <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

            {/* Badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "linear-gradient(90deg, rgba(201,168,76,0.2), rgba(201,168,76,0.1))",
              border: "1px solid rgba(201,168,76,0.4)",
              borderRadius: 100, padding: "5px 16px",
              marginBottom: 28,
            }}>
              <span style={{ color: GOLD, fontSize: 11 }}>✦</span>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" }}>
                Acesso Gratuito — Comunidade de Teste
              </span>
            </div>

            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 28, fontWeight: 800, color: "#fff",
              marginBottom: 10, lineHeight: 1.2,
            }}>
              Plano Exclusivo Comunidade
            </h2>

            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.75, marginBottom: 36 }}>
              Acesse a plataforma ibhub gratuitamente como membro fundador da nossa comunidade. Conecte-se, explore e contribua com o crescimento da rede do vinho no Brasil.
            </p>

            {/* Feature list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40 }}>
              {FEATURES.map(f => (
                <div
                  key={f.label}
                  className="comm-feature-row"
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "14px 16px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                  }}
                >
                  <span style={{ color: GOLD, fontSize: 16, marginTop: 1, flexShrink: 0 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              className="comm-cta-btn"
              onClick={handleActivate}
              disabled={loading}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: `linear-gradient(135deg, ${GOLD} 0%, #e8c87a 50%, #b8932a 100%)`,
                color: DEEP, fontWeight: 800, fontSize: 15,
                padding: "16px 0", borderRadius: 100,
                border: "none", cursor: "pointer", letterSpacing: 0.3,
                boxShadow: "0 8px 40px rgba(201,168,76,0.4), 0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              {loading ? (
                <span style={{ width: 16, height: 16, border: "2px solid rgba(13,27,42,0.3)", borderTopColor: DEEP, borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              ) : "🍷"}
              {loading ? "Ativando…" : "Ativar acesso gratuito"}
            </button>

            {error && (
              <div style={{ marginTop: 14, color: "#f87171", fontSize: 13, textAlign: "center" }}>⚠ {error}</div>
            )}

            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 20 }}>
              Sem cartão de crédito · Sem cobrança · Acesso imediato
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "32px 24px",
        textAlign: "center",
        color: "rgba(255,255,255,0.25)",
        fontSize: 12,
      }}>
        <img src={`${import.meta.env.BASE_URL}logo-ibhub-branco.png`} alt="ibhub" style={{ height: 22, objectFit: "contain", opacity: 0.35, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
        © {new Date().getFullYear()} ibhub · A rede profissional do vinho
      </footer>
    </div>
  );
}
