import { useState, Fragment } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL;

const C = {
  bg:        "#0a0b0e",
  section:   "#0d1117",
  card:      "#111820",
  border:    "#1a2840",
  orange:    "#e89918",
  white:     "#ffffff",
  muted:     "#8595a8",
  dimmed:    "#4a5a6a",
  input:     "#080d14",
};

export default function Registration() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLocation("/confirmacao"), 600);
  };

  return (
    <div style={{ background: C.bg, color: C.white, fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

      {/* ══════════════════════════════════════
          HEADER — ibhub logo + IDEAL.BI logo
      ══════════════════════════════════════ */}
      <header style={{
        maxWidth: "1060px", margin: "0 auto", padding: "24px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`,
      }}>
        {/* ibhub logo — white background chip */}
        <div style={{
          background: "#ffffff", borderRadius: "8px",
          padding: "8px 14px", display: "inline-flex", alignItems: "center",
        }}>
          <img
            src={`${BASE}ibhub-logo.png`}
            alt="ibhub"
            style={{ height: "28px", display: "block" }}
          />
        </div>

        {/* IDEAL.BI logo */}
        <img
          src={`${BASE}idealbi-logo-transparent.png`}
          alt="IDEAL.BI"
          style={{ height: "52px", display: "block" }}
        />
      </header>

      {/* ══════════════════════════════════════
          HERO — centered badge + title
      ══════════════════════════════════════ */}
      <section style={{ textAlign: "center", padding: "52px 32px 44px", maxWidth: "860px", margin: "0 auto" }}>

        {/* Badge */}
        <div style={{
          display: "inline-block",
          border: `1px solid rgba(232,153,24,0.45)`,
          borderRadius: "4px",
          padding: "5px 18px",
          fontSize: "11px", fontWeight: 700,
          letterSpacing: "0.15em", textTransform: "uppercase",
          color: C.orange, marginBottom: "18px",
        }}>
          INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
        </div>

        <div style={{
          fontSize: "13px", letterSpacing: "0.12em", textTransform: "uppercase",
          color: C.muted, marginBottom: "28px", fontWeight: 500,
        }}>
          ENCONTRO EXCLUSIVO PARA A COMUNIDADE
        </div>

        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900, fontSize: "clamp(52px, 8vw, 80px)",
          lineHeight: 1.0, textTransform: "uppercase",
          letterSpacing: "0.01em", color: C.white,
          marginBottom: "20px",
        }}>
          O FUTURO NO<br />MERCADO DE VINHOS
        </h1>

        <p style={{ fontSize: "16px", color: C.muted, lineHeight: 1.7, marginBottom: "40px" }}>
          O que está acontecendo no mercado hoje<br />e como isso impacta suas decisões.
        </p>

        {/* Event meta — 3 columns */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
          alignItems: "center", gap: "0",
          maxWidth: "680px", margin: "0 auto",
        }}>
          {[
            { top: "18 DE MAIO", bot: "SEGUNDA-FEIRA" },
            { top: "20H00", bot: "DURAÇÃO: 60 MINUTOS" },
            { top: "EVENTO FECHADO", bot: "APENAS PARA MEMBROS DA COMUNIDADE" },
          ].map((col, i) => (
            <Fragment key={i}>
              <div style={{ padding: "0 20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.07em", color: C.white, marginBottom: "4px" }}>
                  {col.top}
                </div>
                <div style={{ fontSize: "11px", color: C.dimmed, letterSpacing: "0.07em" }}>
                  {col.bot}
                </div>
              </div>
              {i < 2 && <div style={{ height: "36px", width: "1px", background: C.border, margin: "0 auto" }} />}
            </Fragment>
          ))}
        </div>
      </section>

      {/* divider */}
      <div style={{ maxWidth: "1060px", margin: "0 auto 0", borderTop: `1px solid ${C.border}` }} />

      {/* ══════════════════════════════════════
          MAIN 2-COLUMN
      ══════════════════════════════════════ */}
      <section style={{
        maxWidth: "1060px", margin: "0 auto",
        padding: "52px 32px 72px",
        display: "grid", gridTemplateColumns: "1fr 400px", gap: "56px", alignItems: "start",
      }}>

        {/* ── LEFT ── */}
        <div>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800, fontSize: "28px",
            textTransform: "uppercase", letterSpacing: "0.04em",
            lineHeight: 1.2, marginBottom: "28px",
          }}>
            <span style={{ color: C.orange }}>PARTICIPE E RECEBA</span>
            <br />
            <span style={{ color: C.white }}>O MATERIAL PREPARATÓRIO</span>
          </h2>

          {/* Ebook card */}
          <div style={{
            display: "flex", gap: "24px", alignItems: "flex-start",
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: "10px", padding: "22px",
          }}>
            <img
              src={`${BASE}ebook-cover.png`}
              alt="Raio-X Mercado de Vinhos 2026"
              style={{ width: "88px", height: "116px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }}
            />
            <div style={{ fontSize: "14px", color: C.muted, lineHeight: 1.75 }}>
              <p style={{ marginBottom: "10px" }}>
                Ao se inscrever, você recebe a{" "}
                <strong style={{ color: C.white }}>Parte 1 do Raio-X do Mercado de Vinhos 2026</strong>.
              </p>
              <p style={{ marginBottom: "14px" }}>
                Um material estratégico com a base da nossa leitura de mercado.
              </p>
              <p style={{
                borderLeft: `3px solid ${C.orange}`,
                paddingLeft: "12px",
                color: C.white, fontWeight: 600,
                lineHeight: 1.65, fontSize: "13px",
              }}>
                Mas o mais importante não está nele.<br />
                A aplicação prática será revelada no encontro.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT — Form card ── */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: "12px", padding: "32px 28px",
          position: "sticky", top: "24px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        }}>
          {/* top accent */}
          <div style={{ height: "3px", background: `linear-gradient(90deg,${C.orange},#f5c040,${C.orange})`, borderRadius: "12px 12px 0 0", margin: "-32px -28px 28px", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }} />

          <h3 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800, fontSize: "22px",
            textTransform: "uppercase", letterSpacing: "0.05em",
            color: C.white, marginBottom: "6px",
          }}>
            GARANTA SUA VAGA
          </h3>
          <p style={{ fontSize: "13px", color: C.dimmed, marginBottom: "24px", lineHeight: 1.55 }}>
            Preencha seus dados para se inscrever<br />e receber o material preparatório.
          </p>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { ph: "Nome completo",               type: "text",  req: true  },
              { ph: "E-mail",                       type: "email", req: true  },
              { ph: "WhatsApp",                     type: "text",  req: true  },
              { ph: "Atuação / Empresa (opcional)", type: "text",  req: false },
            ].map((f, i) => (
              <input
                key={i}
                type={f.type}
                required={f.req}
                placeholder={f.ph}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: C.input, border: `1px solid ${C.border}`,
                  borderRadius: "6px", padding: "13px 14px",
                  fontSize: "14px", color: C.white, outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => (e.target.style.borderColor = C.orange)}
                onBlur={e  => (e.target.style.borderColor = C.border)}
              />
            ))}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "8px",
                background: loading ? "#9a6510" : C.orange,
                color: "#000",
                border: "none", borderRadius: "6px",
                padding: "15px 10px",
                fontSize: "13px", fontWeight: 800,
                letterSpacing: "0.05em", textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                lineHeight: 1.4, textAlign: "center",
                boxShadow: `0 4px 20px rgba(232,153,24,0.35)`,
                transition: "background 0.2s",
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = "#cf8610"; }}
              onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = C.orange; }}
            >
              {loading ? "PROCESSANDO..." : "QUERO PARTICIPAR E RECEBER\nO MATERIAL PREPARATÓRIO"}
            </button>

            <p style={{ fontSize: "12px", color: C.dimmed, textAlign: "center", marginTop: "2px" }}>
              🔒 Seus dados estão seguros conosco.
            </p>
          </form>
        </div>
      </section>

      {/* ══════════════════════════════════════
          POR QUE PARTICIPAR
      ══════════════════════════════════════ */}
      <section style={{ background: C.section, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: "1060px", margin: "0 auto", padding: "56px 32px 64px" }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800, fontSize: "20px",
            textTransform: "uppercase", letterSpacing: "0.14em",
            textAlign: "center", color: C.white, marginBottom: "44px",
          }}>
            POR QUE PARTICIPAR?
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "20px" }}>
            {[
              { title: "Conteúdo prático e direto ao ponto",  body: "Nada de teoria. Só o que realmente importa."             },
              { title: "Baseado em dados e inteligência real", body: "Informação confiável para decisões melhores."             },
              { title: "Visão estratégica do mercado",         body: "Entenda o todo para agir melhor no detalhe."             },
              { title: "Comunidade que pensa à frente",        body: "Conecte-se com quem está construindo o futuro do vinho." },
            ].map((item, i) => (
              <div key={i} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: "10px", padding: "24px 18px",
              }}>
                <div style={{ width: "24px", height: "3px", background: C.orange, borderRadius: "2px", marginBottom: "14px" }} />
                <div style={{ fontSize: "13px", fontWeight: 700, color: C.white, marginBottom: "8px", lineHeight: 1.4 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "12px", color: C.dimmed, lineHeight: 1.65 }}>
                  {item.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer style={{ textAlign: "center", padding: "24px 32px", background: C.bg }}>
        <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: C.dimmed }}>
          VAGAS LIMITADAS. GARANTA SUA PARTICIPAÇÃO.
        </p>
      </footer>
    </div>
  );
}
