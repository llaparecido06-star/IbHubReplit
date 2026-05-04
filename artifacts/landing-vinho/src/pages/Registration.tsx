import { useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL;

const C = {
  bg:      "#0c0d0f",
  dark:    "#111318",
  gold:    "#c9a84c",
  goldL:   "#e0b84a",
  white:   "#ffffff",
  muted:   "#9aa0a8",
  dimmed:  "#5a6270",
  border:  "#2a2f3a",
  inputBg: "#0a0c10",
};

const IconCalendar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
const IconClock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></svg>
);
const IconLock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><rect x="5" y="11" width="14" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></svg>
);
const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.4 2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);
const IconBriefcase = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
);
const IconTarget = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
const IconChart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
);
const IconGlobe = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/></svg>
);
const IconUsers = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
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

      {/* ═══ HERO ═══ */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "640px",
      }}>
        {/* LEFT */}
        <div style={{
          background: C.bg,
          padding: "40px 56px 44px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}>
          {/* Logos */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "6px" }}>
            <img src={`${BASE}ibhub-logo-white-transparent.png`} alt="ibhub" style={{ height: "36px" }} />
            <span style={{ color: "#3a4050", fontSize: "24px", fontWeight: 300 }}>|</span>
            <img src={`${BASE}idealbi-logo2-transparent.png`} alt="IDEAL.BI" style={{ height: "40px" }} />
          </div>
          <div style={{ fontSize: "11px", color: C.dimmed, letterSpacing: "0.06em", marginBottom: "40px", lineHeight: 1.4 }}>
            INTELIGÊNCIA ESTRATÉGICA PARA O<br />MERCADO DE VINHOS
          </div>

          <div style={{ fontSize: "13px", color: C.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: "14px" }}>
            ENCONTRO EXCLUSIVO PARA A COMUNIDADE
          </div>

          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900,
            fontSize: "clamp(48px, 5.5vw, 72px)",
            lineHeight: 0.95,
            textTransform: "uppercase",
            margin: "0 0 18px",
            whiteSpace: "nowrap",
          }}>
            <span style={{ color: C.white }}>O FUTURO NO</span><br />
            <span style={{ color: C.gold }}>MERCADO DE VINHOS</span>
          </h1>

          <p style={{ fontSize: "17px", color: C.muted, lineHeight: 1.65, margin: "0 0 16px", maxWidth: "420px" }}>
            O que está acontecendo no mercado hoje<br />e como isso impacta suas decisões.
          </p>

          <div style={{ width: "44px", height: "3px", background: C.gold, borderRadius: "2px", marginBottom: "32px" }} />

          {/* Event meta */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", maxWidth: "480px" }}>
            {[
              { icon: <IconCalendar />, top: "18 DE MAIO", bot: "SEGUNDA-FEIRA" },
              { icon: <IconClock />,    top: "20H00",      bot: "DURAÇÃO: 60 MINUTOS" },
              { icon: <IconLock />,     top: "EVENTO FECHADO", bot: "APENAS PARA MEMBROS DA COMUNIDADE" },
            ].map((col, i) => (
              <div key={i}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "50%",
                  border: `1px solid rgba(201,168,76,0.3)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "10px",
                }}>
                  {col.icon}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "0.04em", color: C.white, marginBottom: "3px" }}>
                  {col.top}
                </div>
                <div style={{ fontSize: "11px", color: C.dimmed, letterSpacing: "0.03em", lineHeight: 1.4, maxWidth: "140px" }}>
                  {col.bot}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — wine */}
        <div style={{ position: "relative", overflow: "hidden", background: "#0a0604" }}>
          <img
            src={`${BASE}hero-wine.png`}
            alt="Taça de vinho"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center 20%",
              display: "block",
              filter: "brightness(0.7) contrast(1.1)",
            }}
          />
          <div style={{
            position: "absolute", top: 0, left: 0, width: "25%", height: "100%",
            background: "linear-gradient(90deg, #0c0d0f 0%, transparent 100%)",
          }} />
        </div>
      </section>

      {/* ═══ PARTICIPE + FORM ═══ */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderTop: `1px solid ${C.border}`,
      }}>
        {/* LEFT — ebook pitch */}
        <div style={{
          background: C.bg,
          padding: "56px 60px",
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: "36px", textTransform: "uppercase",
            letterSpacing: "0.02em", lineHeight: 1.12, marginBottom: "32px",
          }}>
            PARTICIPE E RECEBA<br />
            <span style={{ color: C.gold }}>O MATERIAL PREPARATÓRIO</span>
          </h2>

          <div style={{ display: "flex", gap: "28px", alignItems: "center" }}>
            {/* 3D ebook */}
            <div style={{
              flexShrink: 0,
              perspective: "600px",
            }}>
              <div style={{
                width: "130px",
                minHeight: "175px",
                background: "linear-gradient(155deg, #12161f 0%, #1a2030 50%, #151a26 100%)",
                border: "1px solid rgba(201,168,76,0.35)",
                borderRadius: "4px 8px 8px 4px",
                padding: "16px 12px",
                boxShadow: "8px 10px 30px rgba(0,0,0,0.7), inset -2px 0 6px rgba(201,168,76,0.08)",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                transform: "rotateY(-8deg)",
                transformOrigin: "left center",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: "6px",
                  background: "linear-gradient(180deg, rgba(201,168,76,0.4), rgba(201,168,76,0.15))",
                  borderRadius: "4px 0 0 4px",
                }} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px", paddingLeft: "4px" }}>
                    <img src={`${BASE}ibhub-logo-white-transparent.png`} alt="" style={{ height: "10px" }} />
                    <span style={{ color: "#555", fontSize: "8px" }}>|</span>
                    <img src={`${BASE}idealbi-logo2-transparent.png`} alt="" style={{ height: "10px" }} />
                  </div>
                  <div style={{
                    fontSize: "13px", fontWeight: 800, color: "#fff", lineHeight: 1.2,
                    fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase",
                    paddingLeft: "4px",
                  }}>
                    O FUTURO NO<br />MERCADO DE<br />VINHOS
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", gap: "2.5px", alignItems: "flex-end", height: "28px", marginBottom: "8px", paddingLeft: "4px" }}>
                    {[5,9,7,12,8,13,10,16,11].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${h}px`, background: `linear-gradient(180deg, ${C.goldL}, ${C.gold})`, borderRadius: "1px" }} />
                    ))}
                  </div>
                  <div style={{
                    background: `linear-gradient(90deg, ${C.gold}, ${C.goldL})`,
                    borderRadius: "3px", padding: "3px 8px",
                    fontSize: "8px", fontWeight: 700, color: "#0a0800",
                    display: "inline-block", marginLeft: "4px",
                  }}>
                    PARTE 1
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: "15px", color: C.muted, lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 12px" }}>
                Ao se inscrever, você recebe a <strong style={{ color: C.white, fontWeight: 600 }}>Parte 1 do Ralo-X do Mercado de Vinhos 2026</strong>.
              </p>
              <p style={{ margin: "0 0 16px" }}>
                Um material estratégico com a base da nossa leitura de mercado.
              </p>
              <div style={{
                borderLeft: `3px solid ${C.gold}`,
                paddingLeft: "14px",
                background: "rgba(201,168,76,0.03)",
                borderRadius: "0 6px 6px 0",
                padding: "12px 14px 12px 14px",
              }}>
                <p style={{ margin: 0, fontWeight: 700, color: C.white, fontSize: "15px", lineHeight: 1.65 }}>
                  Mas o mais importante não está nele.<br />
                  <span style={{ fontWeight: 400, color: C.muted }}>A aplicação prática será revelada no encontro.</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — form */}
        <div style={{
          background: "#10131a",
          padding: "56px 60px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <h3 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: "30px",
            textTransform: "uppercase", letterSpacing: "0.03em",
            color: C.white, marginBottom: "6px", textAlign: "center",
          }}>
            GARANTA SUA VAGA
          </h3>
          <p style={{ fontSize: "14px", color: C.muted, marginBottom: "24px", lineHeight: 1.55, textAlign: "center" }}>
            Preencha seus dados para se inscrever<br />e receber o material preparatório.
          </p>

          <div style={{ height: "2px", background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, marginBottom: "24px" }} />

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { ph: "Nome completo",               icon: <IconUser />,      type: "text",  req: true  },
              { ph: "E-mail",                       icon: <IconMail />,      type: "email", req: true  },
              { ph: "WhatsApp",                     icon: <IconPhone />,     type: "text",  req: true  },
              { ph: "Atuação / Empresa (opcional)", icon: <IconBriefcase />, type: "text",  req: false },
            ].map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "12px",
                background: C.inputBg, border: `1px solid ${C.border}`,
                borderRadius: "6px", padding: "14px 16px",
                transition: "border-color 0.2s",
              }}>
                {f.icon}
                <input
                  type={f.type}
                  required={f.req}
                  placeholder={f.ph}
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    fontSize: "15px", color: C.white, outline: "none",
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
                marginTop: "12px",
                background: loading ? "#7a5e20" : `linear-gradient(135deg, ${C.gold}, ${C.goldL})`,
                color: "#0a0800",
                border: "none", borderRadius: "8px",
                padding: "18px",
                fontSize: "14px", fontWeight: 800,
                letterSpacing: "0.06em", textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                textAlign: "center",
                lineHeight: 1.5,
                boxShadow: "0 6px 28px rgba(201,168,76,0.4)",
                fontFamily: "'Inter', sans-serif",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => { if (!loading) { (e.target as HTMLElement).style.transform = "translateY(-1px)"; (e.target as HTMLElement).style.boxShadow = "0 8px 32px rgba(201,168,76,0.5)"; }}}
              onMouseLeave={e => { (e.target as HTMLElement).style.transform = "translateY(0)"; (e.target as HTMLElement).style.boxShadow = "0 6px 28px rgba(201,168,76,0.4)"; }}
            >
              {loading ? "PROCESSANDO..." : <>QUERO PARTICIPAR E RECEBER<br />O MATERIAL PREPARATÓRIO</>}
            </button>

            <p style={{ fontSize: "13px", color: C.dimmed, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "6px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.5"><rect x="5" y="11" width="14" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Seus dados estão seguros conosco.
            </p>
          </form>
        </div>
      </section>

      {/* ═══ POR QUE PARTICIPAR? ═══ */}
      <section style={{
        background: C.dark,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "52px 56px 60px",
      }}>
        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: "20px",
          textTransform: "uppercase", letterSpacing: "0.2em",
          textAlign: "center", color: C.white, marginBottom: "44px",
        }}>
          POR QUE PARTICIPAR?
        </h2>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: "28px", maxWidth: "1060px", margin: "0 auto",
        }}>
          {[
            { icon: <IconTarget />, title: "Conteúdo prático e direto ao ponto",  body: "Nada de teoria. Só o que realmente importa." },
            { icon: <IconChart />,  title: "Baseado em dados e inteligência real", body: "Informação confiável para decisões melhores." },
            { icon: <IconGlobe />,  title: "Visão estratégica do mercado",         body: "Entenda o todo para agir melhor no detalhe." },
            { icon: <IconUsers />,  title: "Comunidade que pensa à frente",        body: "Conecte-se com quem está construindo o futuro do vinho." },
          ].map((item, i) => (
            <div key={i}>
              <div style={{
                width: "52px", height: "52px", borderRadius: "50%",
                border: `1px solid rgba(201,168,76,0.35)`,
                background: "rgba(201,168,76,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "14px",
              }}>
                {item.icon}
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: C.white, lineHeight: 1.45, marginBottom: "6px" }}>
                {item.title}
              </div>
              <div style={{ fontSize: "13px", color: C.dimmed, lineHeight: 1.6 }}>
                {item.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ textAlign: "center", padding: "24px 32px", background: C.bg, borderTop: `1px solid ${C.border}` }}>
        <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dimmed }}>
          VAGAS LIMITADAS. GARANTA SUA PARTICIPAÇÃO.
        </p>
      </footer>
    </div>
  );
}
