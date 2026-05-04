import { useState, useEffect } from "react";
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
  borderL: "#353d4e",
  inputBg: "#0a0c10",
};

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
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
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
const IconChart = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
);
const IconGlobe = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/></svg>
);
const IconUsers = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

export default function Registration() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    try {
      const res = await fetch("/api/event-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          whatsapp: formData.get("whatsapp"),
          company: formData.get("company"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "ALREADY_REGISTERED"
          ? "Este e-mail já está inscrito."
          : data.message || "Erro ao processar inscrição.");
        setLoading(false);
        return;
      }
      setLocation("/confirmacao");
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div style={{ background: C.bg, color: C.white, fontFamily: "'Inter', sans-serif" }}>

      {/* ═══ HERO ═══ */}
      <section style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "44% 56%",
        minHeight: isMobile ? "auto" : "760px",
      }}>

        {/* LEFT — content */}
        <div style={{
          background: `radial-gradient(ellipse 100% 70% at -10% 60%, rgba(201,168,76,0.09) 0%, transparent 65%),
                       radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,168,76,0.04) 0%, transparent 70%),
                       ${C.bg}`,
          padding: isMobile ? "36px 24px 40px" : "44px 64px 56px",
          display: "flex", flexDirection: "column", justifyContent: "flex-start",
          position: "relative", zIndex: 1,
          order: isMobile ? 1 : 0,
        }}>
          {/* thin gold line top */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "1px",
            background: "linear-gradient(90deg, rgba(201,168,76,0.6) 0%, rgba(201,168,76,0.15) 60%, transparent 100%)",
          }} />

          {/* Logos */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "6px" }}>
            <img src={`${BASE}ibhub-logo-white-transparent.png`} alt="ibhub" style={{ height: isMobile ? "32px" : "40px" }} />
            <div style={{ width: "1px", height: "26px", background: "linear-gradient(180deg, transparent, rgba(201,168,76,0.5), transparent)" }} />
            <img src={`${BASE}idealbi-logo2-transparent.png`} alt="IDEAL.BI" style={{ height: isMobile ? "80px" : "110px" }} />
          </div>
          <div style={{
            fontSize: "10px", color: C.dimmed, letterSpacing: "0.14em",
            marginBottom: isMobile ? "28px" : "44px", textTransform: "uppercase", fontWeight: 500,
          }}>
            Inteligência Estratégica para o Mercado de Vinhos
          </div>

          {/* Eyebrow pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.28)",
            borderRadius: "100px",
            padding: "6px 14px",
            marginBottom: "18px",
            alignSelf: "flex-start",
          }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.gold, boxShadow: `0 0 8px ${C.gold}` }} />
            <span style={{ fontSize: "11px", color: C.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
              Encontro exclusivo para a comunidade
            </span>
          </div>

          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900,
            fontSize: isMobile ? "clamp(44px, 12vw, 64px)" : "clamp(52px, 5.5vw, 76px)",
            lineHeight: 0.92,
            textTransform: "uppercase",
            margin: "0 0 20px",
            whiteSpace: isMobile ? "normal" : "nowrap",
          }}>
            <span style={{ color: C.white }}>O FUTURO NO</span><br />
            <span style={{ color: C.gold }}>MERCADO DE VINHOS</span>
          </h1>

          <p style={{ fontSize: "15px", color: C.muted, lineHeight: 1.75, margin: "0 0 24px", maxWidth: "380px" }}>
            O que está acontecendo no mercado hoje<br />e como isso impacta suas decisões.
          </p>

          {/* CTA scroll */}
          <a
            href="#inscricao"
            onClick={e => { e.preventDefault(); document.getElementById("inscricao")?.scrollIntoView({ behavior: "smooth" }); }}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
              background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldL} 100%)`,
              color: "#0a0800", borderRadius: "10px",
              padding: "14px 24px",
              fontSize: "12px", fontWeight: 900,
              letterSpacing: "0.08em", textTransform: "uppercase",
              textDecoration: "none",
              alignSelf: isMobile ? "stretch" : "flex-start",
              boxShadow: "0 4px 24px rgba(201,168,76,0.35)",
              marginBottom: "32px",
            }}
          >
            Garantir minha vaga
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>

          {/* Event meta — premium status bar */}
          <div style={{
            display: "flex",
            background: "linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0.03) 50%, rgba(201,168,76,0.06) 100%)",
            border: "1px solid rgba(201,168,76,0.22)",
            borderRadius: "14px",
            overflow: "hidden",
            maxWidth: isMobile ? "100%" : "430px",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)",
            }} />
            {[
              { icon: <IconCalendar />, top: "18 DE MAIO",     bot: "Segunda-feira"   },
              { icon: <IconClock />,    top: "20H00",          bot: "Duração: 60 min" },
              { icon: <IconLock />,     top: "Evento fechado", bot: "Apenas membros"  },
            ].map((col, i) => (
              <div key={i} style={{
                flex: 1, padding: isMobile ? "14px 10px 12px" : "18px 16px 16px",
                borderRight: i < 2 ? "1px solid rgba(201,168,76,0.12)" : "none",
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px",
              }}>
                <div style={{
                  width: isMobile ? "28px" : "32px", height: isMobile ? "28px" : "32px",
                  borderRadius: "8px",
                  background: "rgba(201,168,76,0.12)",
                  border: "1px solid rgba(201,168,76,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 10px rgba(201,168,76,0.1)",
                  color: C.gold,
                }}>
                  {col.icon}
                </div>
                <div style={{
                  fontSize: isMobile ? "11px" : "13px", fontWeight: 900, letterSpacing: "0.03em",
                  background: `linear-gradient(135deg, #fff 30%, ${C.goldL})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  lineHeight: 1,
                }}>
                  {col.top}
                </div>
                <div style={{ fontSize: "9px", color: C.dimmed, letterSpacing: "0.03em", lineHeight: 1 }}>
                  {col.bot}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — wine image */}
        <div style={{
          position: "relative", overflow: "hidden", background: "#06080a",
          height: isMobile ? "280px" : "auto",
          order: isMobile ? 0 : 1,
        }}>
          <img
            src={`${BASE}hero-wine2.png`}
            alt="Taça de vinho"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: isMobile ? "62% 20%" : "62% center",
              display: "block",
              filter: "brightness(0.88) contrast(1.06)",
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: isMobile
              ? "linear-gradient(180deg, transparent 40%, #0c0d0f 100%)"
              : "linear-gradient(90deg, #0c0d0f 0%, rgba(12,13,15,0.92) 8%, rgba(12,13,15,0.6) 20%, rgba(12,13,15,0.2) 38%, transparent 58%)",
          }} />
          {!isMobile && (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(270deg, #0c0d0f 0%, rgba(12,13,15,0.5) 8%, transparent 22%)",
            }} />
          )}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, transparent 60%, rgba(12,13,15,0.65) 100%)",
          }} />
        </div>
      </section>

      {/* ═══ PARTICIPE + FORM ═══ */}
      <section id="inscricao" style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        borderTop: "1px solid rgba(201,168,76,0.15)",
        background: `radial-gradient(ellipse 70% 80% at 25% 50%, rgba(201,168,76,0.05) 0%, transparent 65%), #0c0d0f`,
        alignItems: "center",
        position: "relative",
      }}>
        {/* LEFT — ebook pitch */}
        <div style={{
          padding: isMobile ? "40px 24px 32px" : "56px 44px 56px 56px",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: isMobile ? "28px" : "38px",
            textTransform: "uppercase",
            letterSpacing: "0.02em", lineHeight: 1.1,
            marginBottom: isMobile ? "28px" : "40px",
            marginLeft: isMobile ? "0" : "45px",
          }}>
            PARTICIPE E RECEBA<br />
            <span style={{ color: C.gold }}>O MATERIAL PREPARATÓRIO</span>
          </h2>

          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "center" : "center",
            gap: isMobile ? "24px" : "36px",
          }}>
            <div style={{ perspective: "900px", flexShrink: 0 }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{
                  position: "absolute", inset: "-30px -20px",
                  background: "radial-gradient(ellipse at 50% 65%, rgba(201,168,76,0.28) 0%, transparent 65%)",
                  filter: "blur(24px)", zIndex: 0,
                }} />
                <img
                  src={`${BASE}ebook-parte1.png`}
                  alt="O Futuro no Mercado de Vinhos — Parte 1"
                  style={{
                    width: isMobile ? "150px" : "200px",
                    display: "block", position: "relative", zIndex: 1,
                    transform: "rotateY(-12deg) rotateX(3deg)",
                    transformOrigin: "center center",
                    filter: "drop-shadow(24px 36px 64px rgba(0,0,0,1))",
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: "15px", color: C.muted, lineHeight: 1.8, flex: 1 }}>
              <p style={{ margin: "0 0 12px" }}>
                Ao se inscrever, você recebe a{" "}
                <strong style={{ color: C.white, fontWeight: 600 }}>Parte 1 do Ralo-X do Mercado de Vinhos 2026</strong>.
              </p>
              <p style={{ margin: "0 0 16px" }}>
                Um material estratégico com a base da nossa leitura de mercado.
              </p>
              <div style={{
                borderLeft: `3px solid ${C.gold}`,
                background: "rgba(201,168,76,0.04)",
                borderRadius: "0 8px 8px 0",
                padding: "14px 16px",
              }}>
                <p style={{ margin: 0, fontWeight: 700, color: C.white, fontSize: "15px", lineHeight: 1.7 }}>
                  Mas o mais importante não está nele.<br />
                  <span style={{ fontWeight: 400, color: C.muted }}>A aplicação prática será revelada no encontro.</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — card de inscrição */}
        <div style={{
          padding: isMobile ? "8px 24px 48px" : "48px 56px 48px 32px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            position: "relative",
            width: "100%", maxWidth: "440px",
            background: "linear-gradient(160deg, #161a24 0%, #111318 100%)",
            border: "1.5px solid rgba(201,168,76,0.5)",
            borderRadius: "18px",
            padding: isMobile ? "32px 20px 24px" : "40px 36px 32px",
            boxShadow: "0 0 0 1px rgba(201,168,76,0.08), 0 8px 48px rgba(0,0,0,0.6), 0 0 80px rgba(201,168,76,0.07)",
          }}>
            <div style={{
              position: "absolute", top: 0, left: "15%", right: "15%", height: "3px",
              background: `linear-gradient(90deg, transparent, ${C.gold}, ${C.goldL}, ${C.gold}, transparent)`,
              borderRadius: "0 0 4px 4px",
            }} />

            <h3 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontSize: "34px",
              textTransform: "uppercase", letterSpacing: "0.04em",
              color: C.white, marginBottom: "6px", textAlign: "center",
            }}>
              GARANTA SUA VAGA
            </h3>
            <p style={{ fontSize: "13px", color: C.muted, marginBottom: "24px", lineHeight: 1.6, textAlign: "center" }}>
              Preencha seus dados para se inscrever<br />e receber o material preparatório.
            </p>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { ph: "Nome completo",               icon: <IconUser />,      type: "text",  req: true,  name: "name"    },
                { ph: "E-mail",                       icon: <IconMail />,      type: "email", req: true,  name: "email"   },
                { ph: "WhatsApp",                     icon: <IconPhone />,     type: "text",  req: true,  name: "whatsapp"},
                { ph: "Atuação / Empresa (opcional)", icon: <IconBriefcase />, type: "text",  req: false, name: "company" },
              ].map((f, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                  borderRadius: "10px", padding: "13px 16px",
                  transition: "border-color 0.2s, background 0.2s",
                }}>
                  {f.icon}
                  <input
                    name={f.name}
                    type={f.type}
                    required={f.req}
                    placeholder={f.ph}
                    style={{
                      flex: 1, background: "transparent", border: "none",
                      fontSize: "14px", color: C.white, outline: "none",
                    }}
                    onFocus={e => {
                      const p = e.target.parentElement as HTMLElement;
                      p.style.borderColor = C.gold;
                      p.style.background = "rgba(201,168,76,0.04)";
                    }}
                    onBlur={e => {
                      const p = e.target.parentElement as HTMLElement;
                      p.style.borderColor = C.border;
                      p.style.background = "rgba(255,255,255,0.04)";
                    }}
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "16px",
                  background: loading ? "#6a5018" : `linear-gradient(135deg, ${C.gold} 0%, ${C.goldL} 60%, ${C.gold} 100%)`,
                  color: "#0a0800",
                  border: "none", borderRadius: "12px",
                  padding: "20px 16px",
                  fontSize: "13px", fontWeight: 900,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "center", lineHeight: 1.5,
                  boxShadow: loading ? "none" : "0 4px 24px rgba(201,168,76,0.4), 0 0 0 1px rgba(201,168,76,0.2)",
                  fontFamily: "'Inter', sans-serif",
                  width: "100%",
                }}
              >
                {loading ? "PROCESSANDO..." : <>QUERO PARTICIPAR E RECEBER<br />O MATERIAL PREPARATÓRIO</>}
              </button>

              {error && (
                <p style={{ fontSize: "13px", color: "#e05252", textAlign: "center", margin: "4px 0 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e05252" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </p>
              )}

              <p style={{ fontSize: "12px", color: C.dimmed, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "12px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.dimmed} strokeWidth="1.5"><rect x="5" y="11" width="14" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Seus dados estão seguros conosco.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* ═══ POR QUE PARTICIPAR? ═══ */}
      <section style={{
        background: `radial-gradient(ellipse 90% 60% at 50% 100%, rgba(201,168,76,0.06) 0%, transparent 70%), #0c0d0f`,
        borderTop: "1px solid rgba(201,168,76,0.15)",
        padding: isMobile ? "56px 20px 64px" : "80px 64px 96px",
        position: "relative",
      }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? "40px" : "64px" }}>
          <p style={{
            fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase",
            color: C.gold, fontWeight: 600, marginBottom: "16px",
          }}>
            BENEFÍCIOS EXCLUSIVOS
          </p>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: isMobile ? "28px" : "36px",
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: C.white, marginBottom: "20px",
          }}>
            POR QUE PARTICIPAR?
          </h2>
          <div style={{ width: "56px", height: "2px", background: `linear-gradient(90deg, transparent, ${C.gold}, ${C.goldL}, transparent)`, margin: "0 auto" }} />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: isMobile ? "14px" : "24px",
          maxWidth: "1140px", margin: "0 auto",
        }}>
          {[
            { icon: <IconTarget />, title: "Conteúdo prático e direto ao ponto",  body: "Nada de teoria. Só o que realmente importa para o seu negócio." },
            { icon: <IconChart />,  title: "Baseado em dados e inteligência real", body: "Informação confiável para tomar decisões melhores." },
            { icon: <IconGlobe />,  title: "Visão estratégica do mercado",         body: "Entenda o todo para agir melhor em cada detalhe." },
            { icon: <IconUsers />,  title: "Comunidade que pensa à frente",        body: "Conecte-se com quem está construindo o futuro do vinho." },
          ].map((item, i) => (
            <div key={i} style={{
              textAlign: "center",
              background: "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid rgba(201,168,76,0.18)",
              borderRadius: "16px",
              padding: isMobile ? "24px 14px 20px" : "36px 24px 32px",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
                background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)",
              }} />
              <div style={{
                width: isMobile ? "44px" : "56px", height: isMobile ? "44px" : "56px",
                borderRadius: "14px",
                border: "1px solid rgba(201,168,76,0.3)",
                background: "linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.03) 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                {item.icon}
              </div>
              <div style={{ fontSize: isMobile ? "12px" : "14px", fontWeight: 700, color: C.white, lineHeight: 1.4, marginBottom: "10px" }}>
                {item.title}
              </div>
              <div style={{ fontSize: isMobile ? "11px" : "12px", color: C.dimmed, lineHeight: 1.7 }}>
                {item.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ textAlign: "center", padding: isMobile ? "24px 20px" : "28px 32px", background: "#0c0d0f", borderTop: "1px solid rgba(201,168,76,0.15)" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dimmed, margin: "0 0 8px" }}>
          VAGAS LIMITADAS. GARANTA SUA PARTICIPAÇÃO.
        </p>
        <p style={{ fontSize: "12px", color: C.dimmed, margin: 0 }}>
          Dúvidas?{" "}
          <a href="mailto:atendimento@idealbi.com.br" style={{ color: C.gold, textDecoration: "none" }}>
            atendimento@idealbi.com.br
          </a>
        </p>
      </footer>
    </div>
  );
}
