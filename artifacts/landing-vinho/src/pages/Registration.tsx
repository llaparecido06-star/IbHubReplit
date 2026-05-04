import { useState } from "react";
import { useLocation } from "wouter";

export default function Registration() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLocation("/confirmacao");
    }, 600);
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: "#070e17", color: "#e8edf3" }}>

      {/* ─── HERO ─── */}
      <section style={{ paddingTop: "60px", paddingBottom: "48px", textAlign: "center", maxWidth: "880px", margin: "0 auto", padding: "60px 24px 48px" }}>

        {/* Badge */}
        <div style={{
          display: "inline-block",
          border: "1px solid rgba(59,130,246,0.5)",
          borderRadius: "4px",
          padding: "6px 16px",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: "#60a5fa",
          marginBottom: "20px",
          textTransform: "uppercase",
        }}>
          INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
        </div>

        {/* Sub-badge line */}
        <div style={{ fontSize: "13px", letterSpacing: "0.12em", color: "#94a3b8", textTransform: "uppercase", marginBottom: "28px", fontWeight: 500 }}>
          ENCONTRO EXCLUSIVO PARA A COMUNIDADE
        </div>

        {/* Main title */}
        <h1 style={{
          fontSize: "clamp(40px, 7vw, 72px)",
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
          color: "#ffffff",
          marginBottom: "20px",
        }}>
          O FUTURO NO<br />MERCADO DE VINHOS
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: "17px", color: "#94a3b8", lineHeight: 1.6, maxWidth: "520px", margin: "0 auto 40px" }}>
          O que está acontecendo no mercado hoje<br />e como isso impacta suas decisões.
        </p>

        {/* Event meta row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0",
          flexWrap: "wrap",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#cbd5e1",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 24px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", display: "inline-block", flexShrink: 0 }} />
            18 DE MAIO<br />SEGUNDA-FEIRA
          </div>
          <div style={{ width: "1px", height: "32px", background: "#1e3a5f" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 24px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", display: "inline-block", flexShrink: 0 }} />
            20H00<br />DURAÇÃO: 60 MINUTOS
          </div>
          <div style={{ width: "1px", height: "32px", background: "#1e3a5f" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 24px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", display: "inline-block", flexShrink: 0 }} />
            EVENTO FECHADO<br />APENAS PARA MEMBROS DA COMUNIDADE
          </div>
        </div>
      </section>

      {/* ─── MAIN CONTENT ─── */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px 72px", display: "grid", gridTemplateColumns: "1fr 420px", gap: "48px", alignItems: "start" }}>

        {/* LEFT */}
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#ffffff", marginBottom: "24px", lineHeight: 1.3 }}>
            PARTICIPE E RECEBA<br />O MATERIAL PREPARATÓRIO
          </h2>

          <div style={{ fontSize: "15px", color: "#94a3b8", lineHeight: 1.8, marginBottom: "32px" }}>
            <p style={{ marginBottom: "12px" }}>
              Ao se inscrever, você recebe a <strong style={{ color: "#e2e8f0" }}>Parte 1 do Raio-X do Mercado de Vinhos 2026</strong>.
            </p>
            <p style={{ marginBottom: "20px" }}>
              Um material estratégico com a base da nossa leitura de mercado.
            </p>
            <p style={{
              borderLeft: "3px solid #3b82f6",
              paddingLeft: "16px",
              color: "#e2e8f0",
              fontWeight: 600,
              lineHeight: 1.7,
            }}>
              Mas o mais importante<br />não está nele.<br />
              A aplicação prática será<br />revelada no encontro.
            </p>
          </div>

          {/* Ebook image */}
          <div style={{
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
            maxWidth: "380px",
          }}>
            <img
              src={`${import.meta.env.BASE_URL}ebook-cover.png`}
              alt="Raio-X do Mercado de Vinhos 2026 – Parte 1"
              style={{ width: "100%", display: "block" }}
            />
          </div>
        </div>

        {/* RIGHT — Form card */}
        <div style={{
          background: "#0d1b2e",
          border: "1px solid #1e3a5f",
          borderRadius: "12px",
          padding: "36px 32px",
          position: "sticky",
          top: "24px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
        }}>
          {/* Top accent line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #1d4ed8, #3b82f6, #1d4ed8)", borderRadius: "12px 12px 0 0" }} />

          <h3 style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ffffff", marginBottom: "6px" }}>
            GARANTA SUA VAGA
          </h3>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "28px", lineHeight: 1.5 }}>
            Preencha seus dados para se inscrever<br />e receber o material preparatório.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <input
              required
              placeholder="Nome completo"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#3b82f6")}
              onBlur={e => (e.target.style.borderColor = "#1e3a5f")}
            />
            <input
              type="email"
              required
              placeholder="E-mail"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#3b82f6")}
              onBlur={e => (e.target.style.borderColor = "#1e3a5f")}
            />
            <input
              required
              placeholder="WhatsApp"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#3b82f6")}
              onBlur={e => (e.target.style.borderColor = "#1e3a5f")}
            />
            <input
              placeholder="Atuação / Empresa (opcional)"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#3b82f6")}
              onBlur={e => (e.target.style.borderColor = "#1e3a5f")}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "8px",
                background: loading ? "#1d4ed8aa" : "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "16px 12px",
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                lineHeight: 1.4,
                textAlign: "center",
                boxShadow: "0 4px 24px rgba(37,99,235,0.4)",
                transition: "background 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = "#1d4ed8"; }}
              onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = "#2563eb"; }}
            >
              {loading ? "PROCESSANDO..." : "QUERO PARTICIPAR E RECEBER\nO MATERIAL PREPARATÓRIO"}
            </button>

            <p style={{ fontSize: "12px", color: "#475569", textAlign: "center", marginTop: "4px" }}>
              🔒 Seus dados estão seguros conosco.
            </p>
          </form>
        </div>
      </section>

      {/* ─── POR QUE PARTICIPAR ─── */}
      <section style={{ background: "#0a1421", borderTop: "1px solid #0f2040", borderBottom: "1px solid #0f2040", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "20px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff", marginBottom: "48px" }}>
            POR QUE PARTICIPAR?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
            {[
              { title: "Conteúdo prático e direto ao ponto", body: "Nada de teoria. Só o que realmente importa." },
              { title: "Baseado em dados e inteligência real", body: "Informação confiável para decisões melhores." },
              { title: "Visão estratégica do mercado", body: "Entenda o todo para agir melhor no detalhe." },
              { title: "Comunidade que pensa à frente", body: "Conecte-se com quem está construindo o futuro do vinho." },
            ].map((item, i) => (
              <div key={i} style={{
                background: "#0d1b2e",
                border: "1px solid #1e3a5f",
                borderRadius: "10px",
                padding: "28px 20px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", marginBottom: "10px", lineHeight: 1.4 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.6 }}>
                  {item.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ textAlign: "center", padding: "28px 24px", background: "#070e17" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569" }}>
          VAGAS LIMITADAS. GARANTA SUA PARTICIPAÇÃO.
        </p>
      </footer>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#070e17",
  border: "1px solid #1e3a5f",
  borderRadius: "6px",
  padding: "13px 14px",
  fontSize: "14px",
  color: "#e2e8f0",
  outline: "none",
  transition: "border-color 0.2s",
  boxSizing: "border-box",
};
