const BASE = import.meta.env.BASE_URL;

const C = {
  bg:        "#0c0d0f",
  dark:      "#111318",
  card:      "#13161e",
  gold:      "#c9a84c",
  goldL:     "#e0b84a",
  white:     "#ffffff",
  muted:     "#9aa0a8",
  dimmed:    "#5a6270",
  border:    "#2a2f3a",
  borderL:   "#353d4e",
};

const IconCheck = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0c0d0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></svg>
);

const IconBook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
);

const IconStar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
);

export default function Confirmation() {
  return (
    <div style={{ background: C.bg, color: C.white, fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <header style={{
        padding: "20px 48px",
        display: "flex", alignItems: "center", gap: "16px",
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(12,13,15,0.95)",
        backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <img src={`${BASE}ibhub-logo-white-transparent.png`} alt="ibhub" style={{ height: "32px" }} />
        <span style={{ color: C.border, fontSize: "22px", fontWeight: 300 }}>|</span>
        <img src={`${BASE}idealbi-logo2-transparent.png`} alt="IDEAL.BI" style={{ height: "68px" }} />
      </header>

      {/* ── HERO ── */}
      <div style={{
        background: `radial-gradient(ellipse 70% 50% at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 70%)`,
        borderBottom: `1px solid ${C.border}`,
        padding: "64px 48px 56px",
        textAlign: "center",
      }}>
        {/* Checkmark badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "64px", height: "64px", borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`,
          boxShadow: `0 0 0 8px rgba(201,168,76,0.12), 0 0 0 16px rgba(201,168,76,0.05)`,
          marginBottom: "28px",
        }}>
          <IconCheck />
        </div>

        <div style={{ fontSize: "11px", color: C.dimmed, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "16px" }}>
          INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
        </div>

        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: "clamp(42px, 6vw, 72px)",
          lineHeight: 1,
          textTransform: "uppercase",
          color: C.white,
          margin: "0 0 14px",
          letterSpacing: "-0.01em",
        }}>
          INSCRIÇÃO CONFIRMADA!
        </h1>

        <p style={{ fontSize: "19px", color: C.gold, fontWeight: 600, margin: "0 0 24px" }}>
          Você já está dentro.
        </p>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: "10px",
          background: "rgba(201,168,76,0.07)",
          border: `1px solid rgba(201,168,76,0.2)`,
          borderRadius: "8px",
          padding: "12px 20px",
          fontSize: "14px", color: C.muted,
          maxWidth: "480px",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></svg>
          <span>Material preparatório enviado ao seu e-mail.{" "}
            <span style={{ color: C.dimmed, fontSize: "13px" }}>Cheque o spam se necessário.</span>
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 48px 0" }}>

        {/* EBOOK CARD */}
        <div style={{
          background: `linear-gradient(135deg, #14181f 0%, #111520 100%)`,
          border: `1px solid ${C.borderL}`,
          borderRadius: "16px",
          padding: "40px 44px",
          marginBottom: "24px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* top gold accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "3px",
            background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", color: C.gold, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>
              Você acabou de receber
            </span>
          </div>

          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: "30px",
            textTransform: "uppercase", color: C.white,
            marginBottom: "10px",
            letterSpacing: "0.01em",
          }}>
            O FUTURO NO MERCADO DE VINHOS{" "}
            <span style={{ color: C.gold }}>– PARTE 1</span>
          </h2>
          <p style={{ fontSize: "15px", color: C.muted, marginBottom: "32px", lineHeight: 1.65 }}>
            Esse material mostra como estamos lendo o mercado hoje.
          </p>

          {/* Warning */}
          <div style={{
            borderLeft: `3px solid ${C.gold}`,
            background: "rgba(201,168,76,0.05)",
            borderRadius: "0 10px 10px 0",
            padding: "20px 24px",
            marginBottom: "36px",
          }}>
            <p style={{ fontSize: "15px", color: C.white, fontWeight: 700, lineHeight: 1.75, margin: 0 }}>
              Mas presta atenção nisso:
            </p>
            <p style={{ fontSize: "14px", color: C.muted, lineHeight: 1.75, margin: "6px 0 0" }}>
              O que você recebeu <strong style={{ color: C.gold }}>NÃO</strong> é a parte mais importante.<br />
              O material mostra o cenário — mas não mostra como usar isso na prática.
            </p>
          </div>

          {/* Part 2 */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "32px", alignItems: "start",
            borderTop: `1px solid ${C.border}`, paddingTop: "28px",
          }}>
            <div>
              <p style={{ fontSize: "13px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "10px" }}>
                No dia 18 de maio, liberamos
              </p>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "26px", fontWeight: 900, color: C.gold, textTransform: "uppercase", margin: 0, lineHeight: 1.1 }}>
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
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          border: `1px solid ${C.border}`,
          borderRadius: "12px", overflow: "hidden",
          marginBottom: "24px",
        }}>
          {[
            { label: "Data", value: "18 de Maio", sub: "Segunda-feira" },
            { label: "Horário", value: "20h00", sub: "Duração: 60 minutos" },
            { label: "Formato", value: "Evento Fechado", sub: "Apenas membros da comunidade" },
          ].map((col, i) => (
            <div key={i} style={{
              textAlign: "center", padding: "28px 20px",
              background: i === 1 ? "rgba(201,168,76,0.04)" : C.dark,
              borderRight: i < 2 ? `1px solid ${C.border}` : undefined,
            }}>
              <div style={{ fontSize: "10px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, marginBottom: "10px" }}>
                {col.label}
              </div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 800, color: C.white, lineHeight: 1, marginBottom: "6px" }}>
                {col.value}
              </div>
              <div style={{ fontSize: "12px", color: C.dimmed, lineHeight: 1.4 }}>{col.sub}</div>
            </div>
          ))}
        </div>

        {/* IMPORTANTE */}
        <div style={{
          background: "rgba(220,38,38,0.06)",
          border: "1px solid rgba(220,38,38,0.18)",
          borderRadius: "10px",
          padding: "16px 24px",
          display: "flex", alignItems: "center", gap: "12px",
          marginBottom: "40px",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#fca5a5", margin: 0 }}>
            <strong>IMPORTANTE:</strong> Se você não participar ao vivo, vai perder a parte mais importante.
          </p>
        </div>

        {/* STEPS */}
        <div style={{ marginBottom: "48px" }}>
          <h3 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800, fontSize: "20px",
            textTransform: "uppercase", letterSpacing: "0.1em",
            color: C.white, marginBottom: "20px",
          }}>
            Agora faça o seguinte:
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            {[
              { n: "01", icon: <IconMail />, title: "Verifique seu e-mail", body: "O material já está a caminho." },
              { n: "02", icon: <IconBook />, title: "Leia o material", body: "Com calma e atenção." },
              { n: "03", icon: <IconStar />, title: "Esteja no dia 18", body: "A Parte 2 é liberada exclusivamente ao vivo." },
            ].map((step, i) => (
              <div key={i} style={{
                background: C.dark,
                border: `1px solid ${C.border}`,
                borderRadius: "12px",
                padding: "24px 22px",
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: 0, right: 0,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "56px", fontWeight: 900,
                  color: "rgba(201,168,76,0.06)", lineHeight: 1,
                  letterSpacing: "-2px", userSelect: "none",
                }}>
                  {step.n}
                </div>
                <div style={{ marginBottom: "14px" }}>{step.icon}</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: C.white, marginBottom: "6px" }}>
                  {step.title}
                </div>
                <div style={{ fontSize: "13px", color: C.dimmed, lineHeight: 1.65 }}>
                  {step.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CLOSING QUOTE */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          borderTop: `1px solid ${C.border}`,
          paddingTop: "40px", gap: "0",
          marginBottom: "60px",
        }}>
          <div style={{
            borderRight: `1px solid ${C.border}`, paddingRight: "44px",
            fontSize: "15px", color: C.dimmed, lineHeight: 1.9,
            fontStyle: "italic",
          }}>
            "Quem só consome informação<br />continua no mesmo lugar."
          </div>
          <div style={{ paddingLeft: "44px", fontSize: "15px", color: C.muted, lineHeight: 1.9 }}>
            Quem entende como usar<br />
            começa a operar diferente.<br />
            <strong style={{ color: C.white, fontWeight: 700, fontStyle: "normal" }}>Nos vemos no dia 18!</strong>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`,
        padding: "22px 48px",
        textAlign: "center",
        background: C.bg,
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
