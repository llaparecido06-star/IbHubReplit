import { useState, Fragment } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL;

/* ── colour tokens ── */
const C = {
  bg:        "#0a0b0d",
  card:      "#12171f",
  cardBorder:"#1c2a3a",
  orange:    "#e89a18",
  orangeHov: "#cf8710",
  white:     "#ffffff",
  muted:     "#8a9ab0",
  dimmed:    "#5a6a7a",
  input:     "#0c1118",
  inputBord: "#1e2e40",
};

export default function Registration() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLocation("/confirmacao"), 600);
  };

  return (
    <div style={{ background: C.bg, color: C.white, fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

      {/* ═══════════ HERO ═══════════ */}
      <div style={{ position: "relative", overflow: "hidden" }}>

        {/* Wine glass photo — right side */}
        <div style={{
          position: "absolute",
          top: 0, right: 0,
          width: "42%",
          height: "100%",
          zIndex: 0,
        }}>
          <img
            src={`${BASE}hero-wine.png`}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
          {/* gradient fade to left */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, #0a0b0d 0%, rgba(10,11,13,0.6) 40%, transparent 100%)",
          }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>

          {/* ── LOGO BAR ── */}
          <div style={{ paddingTop: "28px", paddingBottom: "20px", borderBottom: "1px solid #1c2a3a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "22px", letterSpacing: "0.02em", color: C.white }}>
                ibhub
              </span>
              <span style={{ color: "#2a4060", fontSize: "20px", fontWeight: 300 }}>|</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "16px", letterSpacing: "0.06em", color: C.orange }}>
                IDEAL.BI
              </span>
            </div>
            <div style={{ fontSize: "10px", color: C.dimmed, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: "4px" }}>
              INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
            </div>
          </div>

          {/* ── HERO TEXT ── */}
          <div style={{ paddingTop: "36px", paddingBottom: "20px", maxWidth: "58%" }}>

            <div style={{ fontSize: "12px", color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "18px" }}>
              ENCONTRO EXCLUSIVO PARA A COMUNIDADE:
            </div>

            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(52px, 7vw, 82px)",
              lineHeight: 1.0,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              color: C.white,
              marginBottom: "20px",
            }}>
              O FUTURO NO<br />MERCADO DE<br />VINHOS
            </h1>

            <p style={{ fontSize: "15px", color: C.muted, lineHeight: 1.7, maxWidth: "440px", marginBottom: "36px" }}>
              O que está acontecendo no mercado hoje<br />e como isso impacta suas decisões.
            </p>

            {/* Event meta */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1px auto 1px auto", gap: "0", alignItems: "center", marginBottom: "48px", width: "fit-content" }}>
              {[
                { icon: "📅", label: "18 DE MAIO", sub: "SEGUNDA-FEIRA" },
                { icon: "🕗", label: "20H00", sub: "DURAÇÃO: 60 MINUTOS" },
                { icon: "🔒", label: "EVENTO FECHADO", sub: "APENAS PARA MEMBROS" },
              ].map((item, i) => (
                <Fragment key={i}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "0 20px" }}>
                    <span style={{ fontSize: "15px", marginTop: "2px" }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: C.white, whiteSpace: "nowrap" }}>{item.label}</div>
                      <div style={{ fontSize: "10px", color: C.dimmed, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{item.sub}</div>
                    </div>
                  </div>
                  {i < 2 && <div style={{ width: "1px", height: "32px", background: "#1c2a3a" }} />}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ MAIN 2-COL ═══════════ */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 32px 72px", display: "grid", gridTemplateColumns: "1fr 400px", gap: "48px", alignItems: "start" }}>

        {/* LEFT */}
        <div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "26px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>
            <span style={{ color: C.orange }}>PARTICIPE E RECEBA</span>
          </h2>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "26px", textTransform: "uppercase", letterSpacing: "0.04em", color: C.white, marginBottom: "24px" }}>
            O MATERIAL PREPARATÓRIO
          </h2>

          {/* Ebook card */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "24px", background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: "10px", padding: "20px" }}>
            <img
              src={`${BASE}ebook-cover.png`}
              alt="Raio-X do Mercado de Vinhos 2026"
              style={{ width: "90px", height: "120px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }}
            />
            <div style={{ fontSize: "14px", color: C.muted, lineHeight: 1.7 }}>
              <p style={{ marginBottom: "10px" }}>
                Ao se inscrever, você recebe a <strong style={{ color: C.white }}>Parte 1 do Raio-X do Mercado de Vinhos 2026</strong>.
              </p>
              <p style={{ marginBottom: "12px" }}>
                Um material estratégico com a base da nossa leitura de mercado.
              </p>
              <p style={{ color: C.white, fontWeight: 600, borderLeft: `3px solid ${C.orange}`, paddingLeft: "12px", lineHeight: 1.6 }}>
                Mas o mais importante não está nele. A aplicação prática será revelada no encontro.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT — Form */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: "12px",
          padding: "32px 28px",
          position: "sticky",
          top: "24px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "22px", textTransform: "uppercase", letterSpacing: "0.06em", color: C.white, marginBottom: "6px" }}>
            GARANTA SUA VAGA
          </h3>
          <p style={{ fontSize: "13px", color: C.dimmed, marginBottom: "24px", lineHeight: 1.5 }}>
            Preencha seus dados para se inscrever<br />e receber o material preparatório.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { placeholder: "Nome completo", type: "text", required: true },
              { placeholder: "E-mail", type: "email", required: true },
              { placeholder: "WhatsApp", type: "text", required: true },
              { placeholder: "Atuação / Empresa (opcional)", type: "text", required: false },
            ].map((field, i) => (
              <input
                key={i}
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                style={{
                  width: "100%",
                  background: C.input,
                  border: `1px solid ${C.inputBord}`,
                  borderRadius: "6px",
                  padding: "13px 14px",
                  fontSize: "14px",
                  color: C.white,
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => (e.target.style.borderColor = C.orange)}
                onBlur={e => (e.target.style.borderColor = C.inputBord)}
              />
            ))}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "8px",
                background: loading ? "#a06010" : C.orange,
                color: "#000000",
                border: "none",
                borderRadius: "6px",
                padding: "15px 12px",
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                lineHeight: 1.4,
                textAlign: "center",
                boxShadow: "0 4px 20px rgba(232,154,24,0.35)",
                transition: "background 0.2s",
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = C.orangeHov; }}
              onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = C.orange; }}
            >
              {loading ? "PROCESSANDO..." : "QUERO PARTICIPAR E RECEBER\nO MATERIAL PREPARATÓRIO"}
            </button>

            <p style={{ fontSize: "12px", color: C.dimmed, textAlign: "center", marginTop: "2px" }}>
              🔒 Seus dados estão seguros conosco.
            </p>
          </form>
        </div>
      </div>

      {/* ═══════════ POR QUE PARTICIPAR ═══════════ */}
      <div style={{ borderTop: `1px solid ${C.cardBorder}`, background: "#090a0c" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "56px 32px 64px" }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: "20px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            textAlign: "center",
            color: C.white,
            marginBottom: "40px",
          }}>
            POR QUE PARTICIPAR?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
            {[
              { title: "Conteúdo prático e direto ao ponto", body: "Nada de teoria. Só o que realmente importa." },
              { title: "Baseado em dados e inteligência real", body: "Informação confiável para decisões melhores." },
              { title: "Visão estratégica do mercado", body: "Entenda o todo para agir melhor no detalhe." },
              { title: "Comunidade que pensa à frente", body: "Conecte-se com quem está construindo o futuro do vinho." },
            ].map((item, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: "10px", padding: "24px 18px" }}>
                <div style={{ width: "28px", height: "3px", background: C.orange, borderRadius: "2px", marginBottom: "14px" }} />
                <div style={{ fontSize: "13px", fontWeight: 700, color: C.white, marginBottom: "8px", lineHeight: 1.4 }}>{item.title}</div>
                <div style={{ fontSize: "13px", color: C.dimmed, lineHeight: 1.6 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer style={{ textAlign: "center", padding: "22px 24px", background: C.bg, borderTop: `1px solid ${C.cardBorder}` }}>
        <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dimmed }}>
          VAGAS LIMITADAS. GARANTA SUA PARTICIPAÇÃO.
        </p>
      </footer>
    </div>
  );
}
