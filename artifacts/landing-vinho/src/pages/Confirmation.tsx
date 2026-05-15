import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;

const C = {
  bg:     "#0c0d0f",
  dark:   "#111318",
  card:   "#13161e",
  gold:   "#c9a84c",
  goldL:  "#e0b84a",
  white:  "#ffffff",
  muted:  "#9aa0a8",
  dimmed: "#5a6270",
  border: "rgba(201,168,76,0.15)",
};

const IconCheck = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0c0d0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);

const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);

const IconMail = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></svg>
);

const IconBook = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
);

const IconStar = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
);

export default function Confirmation() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div style={{ background: C.bg, color: C.white, fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <header style={{
        padding: isMobile ? "12px 20px" : "16px 52px",
        display: "flex", alignItems: "center", gap: "16px",
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(12,13,15,0.97)",
        backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "1px",
          background: "linear-gradient(90deg, rgba(201,168,76,0.6) 0%, rgba(201,168,76,0.15) 60%, transparent 100%)",
        }} />
        <img src={`${BASE}ibhub-logo-white-transparent.png`} alt="ibhub" style={{ height: isMobile ? "28px" : "36px" }} />
        <div style={{ width: "1px", height: "24px", background: "linear-gradient(180deg, transparent, rgba(201,168,76,0.5), transparent)" }} />
        <img src={`${BASE}idealbi-logo2-transparent.png`} alt="IDEAL.BI" style={{ height: isMobile ? "68px" : "88px" }} />
      </header>

      {/* ── HERO ── */}
      <div style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 70%)",
        borderBottom: `1px solid ${C.border}`,
        padding: isMobile ? "44px 24px 40px" : "60px 48px 52px",
        textAlign: "center",
        position: "relative",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "64px", height: "64px", borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`,
          boxShadow: "0 0 0 8px rgba(201,168,76,0.12), 0 0 0 18px rgba(201,168,76,0.05)",
          marginBottom: "24px",
        }}>
          <IconCheck />
        </div>

        <div style={{ fontSize: "10px", color: C.dimmed, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "14px", fontWeight: 500 }}>
          Inteligência Estratégica para o Mercado de Vinhos
        </div>

        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: isMobile ? "clamp(36px, 10vw, 54px)" : "clamp(42px, 6vw, 72px)",
          lineHeight: 1,
          textTransform: "uppercase",
          color: C.white,
          margin: "0 0 14px",
        }}>
          INSCRIÇÃO CONFIRMADA!
        </h1>

        <p style={{ fontSize: isMobile ? "16px" : "19px", color: C.gold, fontWeight: 600, margin: "0 0 24px" }}>
          Você já está dentro.
        </p>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: "10px",
          background: "rgba(201,168,76,0.07)",
          border: "1px solid rgba(201,168,76,0.22)",
          borderRadius: "100px",
          padding: "10px 18px",
          fontSize: "13px", color: C.muted,
          maxWidth: isMobile ? "100%" : "none",
          textAlign: "left",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" style={{ flexShrink: 0 }}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></svg>
          <span>Material enviado ao seu e-mail.{" "}
            <span style={{ color: C.dimmed }}>Cheque o spam se necessário.</span>
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: isMobile ? "32px 20px 0" : "48px 48px 0" }}>

        {/* EBOOK CARD */}
        <div style={{
          background: "linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.02) 50%, rgba(201,168,76,0.05) 100%)",
          border: "1px solid rgba(201,168,76,0.22)",
          borderRadius: "16px",
          padding: isMobile ? "28px 20px" : "40px 44px",
          marginBottom: "16px",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)",
          }} />

          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: C.gold, boxShadow: `0 0 6px ${C.gold}` }} />
            <span style={{ fontSize: "11px", color: C.gold, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>
              Você acabou de receber
            </span>
          </div>

          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: isMobile ? "22px" : "30px",
            textTransform: "uppercase", color: C.white,
            marginBottom: "10px",
          }}>
            O FUTURO NO MERCADO DE VINHOS{" "}
            <span style={{ color: C.gold }}>– PARTE 1</span>
          </h2>
          <p style={{ fontSize: "15px", color: C.muted, marginBottom: "28px", lineHeight: 1.65 }}>
            Esse material mostra como estamos lendo o mercado hoje.
          </p>

          <div style={{
            borderLeft: `3px solid ${C.gold}`,
            background: "rgba(201,168,76,0.05)",
            borderRadius: "0 10px 10px 0",
            padding: "18px 20px",
            marginBottom: "32px",
          }}>
            <p style={{ fontSize: "15px", color: C.white, fontWeight: 700, lineHeight: 1.75, margin: 0 }}>
              Mas presta atenção nisso:
            </p>
            <p style={{ fontSize: "14px", color: C.muted, lineHeight: 1.75, margin: "6px 0 0" }}>
              O que você recebeu <strong style={{ color: C.gold }}>NÃO</strong> é a parte mais importante.<br />
              O material mostra o cenário — mas não mostra como usar isso na prática.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: isMobile ? "20px" : "32px",
            alignItems: "start",
            borderTop: "1px solid rgba(201,168,76,0.12)", paddingTop: "24px",
          }}>
            <div>
              <p style={{ fontSize: "11px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "8px" }}>
                No dia 01 de junho, liberamos
              </p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 900, color: C.gold, textTransform: "uppercase", margin: 0, lineHeight: 1.1 }}>
                A PARTE 2
              </p>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                "Como transformar essa leitura em decisão",
                "Onde está o dinheiro de verdade",
                "Como operar com mais clareza no mercado",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: C.muted, lineHeight: 1.55 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" style={{ marginTop: "2px", flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* EVENT META */}
        <div style={{
          display: "flex",
          background: "linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0.03) 50%, rgba(201,168,76,0.06) 100%)",
          border: "1px solid rgba(201,168,76,0.22)",
          borderRadius: "14px",
          overflow: "hidden",
          marginBottom: "16px",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)",
          }} />
          {[
            { icon: <IconCalendar />, top: "01 DE JUNHO",    bot: "Segunda-feira"   },
            { icon: <IconClock />,    top: "20H00",          bot: "Duração: 60 min" },
            { icon: <IconLock />,     top: "Evento fechado", bot: "Apenas membros"  },
          ].map((col, i) => (
            <div key={i} style={{
              flex: 1, padding: isMobile ? "14px 10px 12px" : "20px 20px 18px",
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

        {/* IMPORTANTE */}
        <div style={{
          background: "rgba(220,38,38,0.06)",
          border: "1px solid rgba(220,38,38,0.18)",
          borderRadius: "12px",
          padding: "14px 20px",
          display: "flex", alignItems: "flex-start", gap: "12px",
          marginBottom: "32px",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: "1px" }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#fca5a5", margin: 0, lineHeight: 1.6 }}>
            <strong>IMPORTANTE:</strong> Se você não participar ao vivo, vai perder a parte mais importante.
          </p>
        </div>

        {/* STEPS */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: C.gold, boxShadow: `0 0 6px ${C.gold}` }} />
            <h3 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: "20px",
              textTransform: "uppercase", letterSpacing: "0.1em",
              color: C.white, margin: 0,
            }}>
              Agora faça o seguinte:
            </h3>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: "12px",
          }}>
            {[
              { n: "01", icon: <IconMail />, title: "Verifique seu e-mail", body: "O material já está a caminho." },
              { n: "02", icon: <IconBook />, title: "Leia o material",       body: "Com calma e atenção." },
              { n: "03", icon: <IconStar />, title: "Esteja no dia 01/06",   body: "A Parte 2 é liberada exclusivamente ao vivo." },
            ].map((step, i) => (
              <div key={i} style={{
                background: "linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.02) 100%)",
                border: "1px solid rgba(201,168,76,0.18)",
                borderRadius: "14px",
                padding: isMobile ? "20px 18px" : "24px 22px",
                position: "relative",
                overflow: "hidden",
                display: isMobile ? "flex" : "block",
                alignItems: isMobile ? "flex-start" : undefined,
                gap: isMobile ? "16px" : undefined,
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                  background: `linear-gradient(90deg, ${C.gold}, transparent)`,
                }} />
                {isMobile && (
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                    background: "rgba(201,168,76,0.1)",
                    border: "1px solid rgba(201,168,76,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {step.icon}
                  </div>
                )}
                <div style={{ flex: isMobile ? 1 : undefined }}>
                  {!isMobile && (
                    <>
                      <div style={{
                        position: "absolute", top: 8, right: 14,
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "52px", fontWeight: 900,
                        color: "rgba(201,168,76,0.07)", lineHeight: 1,
                        letterSpacing: "-2px", userSelect: "none",
                      }}>
                        {step.n}
                      </div>
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "10px",
                        background: "rgba(201,168,76,0.1)",
                        border: "1px solid rgba(201,168,76,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginBottom: "14px",
                      }}>
                        {step.icon}
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: "14px", fontWeight: 700, color: C.white, marginBottom: "4px" }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: "13px", color: C.dimmed, lineHeight: 1.65 }}>
                    {step.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CLOSING QUOTE */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          borderTop: "1px solid rgba(201,168,76,0.15)",
          paddingTop: "36px", gap: "0",
          marginBottom: "56px",
        }}>
          <div style={{
            borderRight: isMobile ? "none" : "1px solid rgba(201,168,76,0.15)",
            borderBottom: isMobile ? "1px solid rgba(201,168,76,0.15)" : "none",
            paddingRight: isMobile ? "0" : "44px",
            paddingBottom: isMobile ? "24px" : "0",
            marginBottom: isMobile ? "24px" : "0",
            fontSize: "15px", color: C.dimmed, lineHeight: 1.9,
            fontStyle: "italic",
            textAlign: isMobile ? "center" : "left",
          }}>
            "Quem só consome informação<br />continua no mesmo lugar."
          </div>
          <div style={{
            paddingLeft: isMobile ? "0" : "44px",
            fontSize: "15px", color: C.muted, lineHeight: 1.9,
            textAlign: isMobile ? "center" : "left",
          }}>
            Quem entende como usar<br />
            começa a operar diferente.<br />
            <strong style={{ color: C.white, fontWeight: 700, fontStyle: "normal" }}>Nos vemos no dia 01/06!</strong>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid rgba(201,168,76,0.15)",
        padding: isMobile ? "20px 20px" : "22px 48px",
        textAlign: "center",
        background: "#0c0d0f",
      }}>
        <p style={{ fontSize: "13px", color: C.dimmed, margin: 0 }}>
          Dúvidas? Fale com a gente:{" "}
          <a href="mailto:atendimento@idealbi.com.br" style={{ color: C.gold, textDecoration: "none", fontWeight: 600 }}>
            atendimento@idealbi.com.br
          </a>
        </p>
      </footer>
    </div>
  );
}
