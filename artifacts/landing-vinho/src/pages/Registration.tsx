import { useState, Fragment } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL;

const C = {
  bg:      "#0c0d0f",
  dark:    "#111318",
  card:    "#1a1d24",
  beige:   "#c8b98a",
  beigeL:  "#e8dfc8",
  gold:    "#c9a84c",
  goldL:   "#e0b84a",
  orange:  "#d4900a",
  white:   "#ffffff",
  offWhite:"#e8e0d0",
  muted:   "#9aa0a8",
  dimmed:  "#5a6270",
  border:  "#2a2f3a",
  inputBg: "#0a0c10",
};

/* ── tiny SVG icons ─────────────────────── */
const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/>
  </svg>
);
const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/>
  </svg>
);
const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.4 2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const IconShield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

/* ── Why icons ─────────────────────────── */
const IconTarget = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconChart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/>
  </svg>
);
const IconUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

export default function Registration() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLocation("/confirmacao"), 600);
  };

  return (
    <div style={{ background: C.bg, color: C.white, fontFamily: "'Inter', sans-serif" }}>

      {/* ══════════════════════════════════════════════════════
          HERO — left text + right wine glass photo
      ══════════════════════════════════════════════════════ */}
      <section style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        minHeight: "100vh", position: "relative",
      }}>
        {/* Left dark panel */}
        <div style={{
          background: "linear-gradient(135deg, #0a0b0d 0%, #0f1218 70%, #161c24 100%)",
          padding: "0 48px 48px 48px",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          position: "relative", zIndex: 1,
        }}>
          {/* Logo bar */}
          <div style={{ paddingTop: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              {/* ibhub logo */}
              <img src={`${BASE}ibhub-logo-white-transparent.png`} alt="ibhub" style={{ height: "26px", display: "block" }} />
              <span style={{ color: "#3a4050", fontSize: "20px", fontWeight: 300 }}>|</span>
              {/* IDEAL.BI logo */}
              <img src={`${BASE}idealbi-logo2-transparent.png`} alt="IDEAL.BI" style={{ height: "26px", display: "block" }} />
            </div>
            <div style={{ fontSize: "10px", color: C.muted, letterSpacing: "0.05em", lineHeight: 1.4 }}>
              INTELIGÊNCIA ESTRATÉGICA PARA O<br />MERCADO DE VINHOS
            </div>
          </div>

          {/* Hero text */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: "60px" }}>
            <div style={{ fontSize: "11px", color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: "20px" }}>
              ENCONTRO EXCLUSIVO PARA A COMUNIDADE
            </div>

            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontSize: "clamp(52px, 7vw, 76px)",
              lineHeight: 1.0, textTransform: "uppercase",
              letterSpacing: "0.01em", margin: "0 0 16px",
            }}>
              <span style={{ color: C.white }}>O FUTURO NO<br /></span>
              <span style={{ color: C.gold }}>MERCADO DE VINHOS</span>
            </h1>

            <p style={{ fontSize: "15px", color: "#c0c8d4", lineHeight: 1.65, margin: "0 0 20px", maxWidth: "380px" }}>
              O que está acontecendo no mercado hoje<br />e como isso impacta suas decisões.
            </p>

            {/* Gold accent line */}
            <div style={{ width: "40px", height: "3px", background: C.gold, borderRadius: "2px", marginBottom: "48px" }} />

            {/* Event meta — 3 columns with icons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "0 32px", maxWidth: "420px" }}>
              {[
                { icon: <IconCalendar />, top: "18 DE MAIO",      bot: "SEGUNDA-FEIRA"               },
                { icon: <IconClock />,    top: "20H00",           bot: "DURAÇÃO: 60 MINUTOS"          },
                { icon: <IconLock />,     top: "EVENTO FECHADO",  bot: "APENAS PARA MEMBROS\nDA COMUNIDADE" },
              ].map((col, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {/* Icon in circle */}
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "50%",
                    border: `1px solid rgba(201,168,76,0.35)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: "6px",
                  }}>
                    {col.icon}
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.06em", color: C.white }}>
                    {col.top}
                  </div>
                  <div style={{ fontSize: "10px", color: C.dimmed, letterSpacing: "0.06em", whiteSpace: "pre-line" }}>
                    {col.bot}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right photo panel */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "#1a1008",
        }}>
          <img
            src={`${BASE}hero-wine.png`}
            alt="Taça de vinho"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center top",
              display: "block",
              filter: "brightness(0.75) contrast(1.1)",
            }}
          />
          {/* Left edge gradient — blends with left panel */}
          <div style={{
            position: "absolute", top: 0, left: 0, width: "30%", height: "100%",
            background: "linear-gradient(90deg, #0f1218 0%, transparent 100%)",
          }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PARTICIPE E RECEBA + FORM
      ══════════════════════════════════════════════════════ */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>

        {/* ── LEFT — black panel ── */}
        <div style={{
          background: "#0d0f14",
          padding: "52px 48px",
          borderRight: `1px solid ${C.border}`,
        }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: "32px", textTransform: "uppercase",
            letterSpacing: "0.02em", lineHeight: 1.1, marginBottom: "28px",
          }}>
            <span style={{ color: C.white }}>PARTICIPE E RECEBA<br /></span>
            <span style={{ color: C.gold }}>O MATERIAL PREPARATÓRIO</span>
          </h2>

          {/* Ebook row */}
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
            {/* Ebook cover — styled */}
            <div style={{
              width: "100px", flexShrink: 0,
              background: "linear-gradient(160deg, #0f1420 0%, #1a2030 100%)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: "6px", padding: "14px 10px",
              boxShadow: "6px 10px 28px rgba(0,0,0,0.7)",
              minHeight: "130px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                  <img src={`${BASE}ibhub-logo-white-transparent.png`} alt="ibhub" style={{ height: "8px" }} />
                  <span style={{ color: "#555", fontSize: "7px" }}>|</span>
                  <img src={`${BASE}idealbi-logo2-transparent.png`} alt="IDEAL.BI" style={{ height: "8px" }} />
                </div>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#fff", lineHeight: 1.3, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase" }}>
                  O FUTURO NO<br />MERCADO DE<br />VINHOS
                </div>
              </div>
              <div>
                <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: "26px", marginBottom: "6px" }}>
                  {[6,10,7,13,9,14,11,16,12].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}px`, background: C.gold, borderRadius: "1px", opacity: 0.85 }} />
                  ))}
                </div>
                <div style={{ background: C.gold, borderRadius: "3px", padding: "2px 6px", fontSize: "7px", fontWeight: 700, color: "#000", display: "inline-block" }}>
                  PARTE 1
                </div>
              </div>
            </div>

            {/* Text */}
            <div style={{ fontSize: "13px", color: C.muted, lineHeight: 1.75 }}>
              <p style={{ margin: "0 0 10px" }}>
                Ao se inscrever, você recebe a{" "}
                <strong style={{ color: C.white }}>Parte 1 do Ralo-X do Mercado de Vinhos 2026.</strong>
              </p>
              <p style={{ margin: "0 0 14px" }}>
                Um material estratégico com a base da nossa leitura de mercado.
              </p>
              <div style={{ borderLeft: `3px solid ${C.gold}`, paddingLeft: "12px" }}>
                <p style={{ margin: 0, fontWeight: 700, color: C.white, lineHeight: 1.65 }}>
                  Mas o mais importante não está nele.<br />
                  <span style={{ fontWeight: 400, color: C.muted }}>A aplicação prática será revelada no encontro.</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT — dark form panel ── */}
        <div style={{
          background: "#13161e",
          padding: "52px 48px",
          display: "flex", flexDirection: "column",
        }}>
          <h3 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: "26px",
            textTransform: "uppercase", letterSpacing: "0.04em",
            color: C.white, marginBottom: "6px", textAlign: "center",
          }}>
            GARANTA SUA VAGA
          </h3>
          <p style={{ fontSize: "13px", color: C.muted, marginBottom: "24px", lineHeight: 1.55, textAlign: "center" }}>
            Preencha seus dados para se inscrever<br />e receber o material preparatório.
          </p>

          {/* Top gold accent */}
          <div style={{ height: "2px", background: C.gold, marginBottom: "24px", borderRadius: "1px" }} />

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { ph: "Nome completo",               icon: <IconUser />,      type: "text",  req: true  },
              { ph: "E-mail",                       icon: <IconMail />,      type: "email", req: true  },
              { ph: "WhatsApp",                     icon: <IconPhone />,     type: "text",  req: true  },
              { ph: "Atuação / Empresa (opcional)", icon: <IconBriefcase />, type: "text",  req: false },
            ].map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "10px",
                background: C.inputBg, border: `1px solid ${C.border}`,
                borderRadius: "6px", padding: "12px 14px",
              }}>
                {f.icon}
                <input
                  type={f.type}
                  required={f.req}
                  placeholder={f.ph}
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    fontSize: "13px", color: C.white, outline: "none",
                  }}
                  onFocus={e => { (e.target.parentElement as HTMLElement).style.borderColor = C.gold; }}
                  onBlur={e  => { (e.target.parentElement as HTMLElement).style.borderColor = C.border; }}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "10px",
                background: loading ? "#7a5e20" : `linear-gradient(135deg, ${C.gold} 0%, ${C.goldL} 100%)`,
                color: "#0a0800",
                border: "none", borderRadius: "6px",
                padding: "16px 10px",
                fontSize: "12px", fontWeight: 800,
                letterSpacing: "0.07em", textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                lineHeight: 1.45, textAlign: "center",
                boxShadow: `0 4px 24px rgba(201,168,76,0.35)`,
                fontFamily: "'Inter', sans-serif",
                transition: "opacity 0.2s",
              }}
            >
              {loading ? "PROCESSANDO..." : <>QUERO PARTICIPAR E RECEBER<br />O MATERIAL PREPARATÓRIO</>}
            </button>

            <p style={{ fontSize: "12px", color: C.dimmed, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "4px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Seus dados estão seguros conosco.
            </p>
          </form>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          POR QUE PARTICIPAR
      ══════════════════════════════════════════════════════ */}
      <section style={{
        background: C.dark,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "56px 48px 64px",
      }}>
        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: "18px",
          textTransform: "uppercase", letterSpacing: "0.16em",
          textAlign: "center", color: C.white, marginBottom: "44px",
        }}>
          POR QUE PARTICIPAR?
        </h2>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4,1fr)",
          gap: "24px", maxWidth: "1040px", margin: "0 auto",
        }}>
          {[
            { icon: <IconTarget />, title: "Conteúdo prático e direto ao ponto",  body: "Nada de teoria. Só o que realmente importa."             },
            { icon: <IconChart />,  title: "Baseado em dados e inteligência real", body: "Informação confiável para decisões melhores."             },
            { icon: <IconGlobe />,  title: "Visão estratégica do mercado",         body: "Entenda o todo para agir melhor no detalhe."             },
            { icon: <IconUsers />,  title: "Comunidade que pensa à frente",        body: "Conecte-se com quem está construindo o futuro do vinho." },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                border: `1px solid rgba(201,168,76,0.4)`,
                background: "rgba(201,168,76,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {item.icon}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: C.white, lineHeight: 1.45 }}>
                {item.title}
              </div>
              <div style={{ fontSize: "12px", color: C.dimmed, lineHeight: 1.65 }}>
                {item.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer style={{ textAlign: "center", padding: "22px 32px", background: C.bg }}>
        <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dimmed }}>
          VAGAS LIMITADAS. GARANTA SUA PARTICIPAÇÃO.
        </p>
      </footer>
    </div>
  );
}
