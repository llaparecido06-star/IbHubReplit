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
  red:     "#e05252",
  redBg:   "rgba(220,38,38,0.07)",
  redBorder: "rgba(220,38,38,0.2)",
};

export default function Confirmation() {
  return (
    <div style={{ background: C.bg, color: C.white, fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <header style={{
        padding: "24px 48px",
        display: "flex", alignItems: "center", gap: "18px",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <img src={`${BASE}ibhub-logo-white-transparent.png`} alt="ibhub" style={{ height: "44px" }} />
        <span style={{ color: "#3a4050", fontSize: "28px", fontWeight: 300 }}>|</span>
        <img src={`${BASE}idealbi-logo2-transparent.png`} alt="IDEAL.BI" style={{ height: "120px" }} />
      </header>

      {/* ── HERO ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "56px 48px 40px", textAlign: "center" }}>
        <div style={{ fontSize: "11px", color: C.dimmed, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "28px" }}>
          INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
        </div>

        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: "clamp(48px, 7vw, 76px)",
          lineHeight: 1,
          textTransform: "uppercase",
          color: C.white,
          marginBottom: "12px",
        }}>
          INSCRIÇÃO CONFIRMADA!
        </h1>

        <p style={{ fontSize: "20px", color: C.gold, fontWeight: 600, marginBottom: "28px" }}>
          Você já está dentro.
        </p>

        <p style={{ fontSize: "15px", color: C.muted, lineHeight: 1.75, maxWidth: "520px", margin: "0 auto" }}>
          O material preparatório foi enviado para o seu e-mail.<br />
          <span style={{ fontSize: "13px", color: C.dimmed }}>
            Verifique sua caixa de entrada (e o spam, se necessário).
          </span>
        </p>
      </div>

      {/* ── EBOOK BOX ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 48px 28px" }}>
        <div style={{
          background: C.dark,
          border: `1px solid ${C.border}`,
          borderRadius: "12px",
          padding: "40px 44px",
        }}>
          <p style={{ fontSize: "11px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "10px" }}>
            Você acabou de receber:
          </p>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: "28px",
            textTransform: "uppercase", letterSpacing: "0.02em",
            color: C.gold, marginBottom: "10px",
          }}>
            O FUTURO NO MERCADO DE VINHOS – PARTE 1
          </h2>
          <p style={{ fontSize: "15px", color: C.muted, marginBottom: "32px", lineHeight: 1.65 }}>
            Esse material mostra como estamos lendo o mercado hoje.
          </p>

          {/* Warning */}
          <div style={{
            borderLeft: `3px solid ${C.gold}`,
            background: "rgba(201,168,76,0.04)",
            borderRadius: "0 8px 8px 0",
            padding: "18px 20px",
            marginBottom: "36px",
          }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: C.white, lineHeight: 1.8, margin: 0 }}>
              Mas presta atenção nisso:<br />
              O que você recebeu <span style={{ color: C.gold }}>NÃO</span> é a parte mais importante.<br />
              O material mostra o cenário.<br />
              <span style={{ fontWeight: 400, color: C.muted }}>Mas não mostra como usar isso na prática.</span>
            </p>
          </div>

          {/* Part 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", alignItems: "start" }}>
            <p style={{ fontSize: "17px", fontWeight: 700, color: C.white, lineHeight: 1.6, margin: 0 }}>
              No dia 18 de maio,<br />
              vamos liberar a{" "}
              <span style={{ color: C.gold }}>PARTE 2:</span>
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                "Como transformar essa leitura em decisão",
                "Onde está o dinheiro de verdade",
                "Como operar com mais clareza no mercado",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: C.muted, lineHeight: 1.55 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.gold, marginTop: "6px", flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── EVENT META ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 48px 28px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
          alignItems: "center",
          border: `1px solid ${C.border}`,
          borderRadius: "10px",
          overflow: "hidden",
        }}>
          {[
            { label: "Data", value: "18 de maio", sub: "Segunda-feira" },
            null,
            { label: "HORÁRIO", value: "20h00", sub: "Duração: 60 minutos" },
            null,
            { label: "evento fechado", value: "Membros", sub: "da comunidade" },
          ].map((col, i) =>
            col === null ? (
              <div key={i} style={{ background: C.border, height: "60px" }} />
            ) : (
              <div key={i} style={{ textAlign: "center", padding: "24px 16px" }}>
                <div style={{ fontSize: "10px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "8px" }}>
                  {col.label}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "24px", fontWeight: 800, color: C.white, lineHeight: 1 }}>
                  {col.value}
                </div>
                <div style={{ fontSize: "11px", color: C.dimmed, marginTop: "4px" }}>{col.sub}</div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── IMPORTANTE ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 48px 32px" }}>
        <div style={{
          background: C.redBg,
          border: `1px solid ${C.redBorder}`,
          borderRadius: "8px",
          padding: "18px 24px",
          fontSize: "14px", fontWeight: 700,
          color: "#fca5a5",
          textAlign: "center", letterSpacing: "0.01em",
        }}>
          IMPORTANTE: Se você não participar ao vivo, vai perder a parte mais importante.
        </div>
      </div>

      {/* ── STEPS ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 48px 40px" }}>
        <h3 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: "22px",
          textTransform: "uppercase", letterSpacing: "0.06em",
          color: C.white, marginBottom: "24px",
        }}>
          Agora faça o seguinte:
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {[
            { n: "1.", title: "Verifique seu e-mail", body: "O material já está a caminho." },
            { n: "2.", title: "Leia o material", body: "Com calma e atenção." },
            { n: "3.", title: "Esteja presente no dia 18", body: "A Parte 2 será liberada exclusivamente ao vivo." },
          ].map((step, i) => (
            <div key={i} style={{
              background: C.dark,
              border: `1px solid ${C.border}`,
              borderRadius: "10px",
              padding: "24px 20px",
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "32px", fontWeight: 900,
                color: C.gold, marginBottom: "10px", lineHeight: 1,
              }}>
                {step.n}
              </div>
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

      {/* ── CLOSING QUOTE ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 48px 60px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          borderTop: `1px solid ${C.border}`,
          paddingTop: "40px", gap: "0",
        }}>
          <div style={{
            borderRight: `1px solid ${C.border}`,
            paddingRight: "40px",
            fontSize: "15px", color: C.dimmed, lineHeight: 1.85,
          }}>
            Quem só consome informação<br />continua no mesmo lugar.
          </div>
          <div style={{ paddingLeft: "40px", fontSize: "15px", color: C.muted, lineHeight: 1.85 }}>
            Quem entende como usar<br />
            começa a operar diferente.<br />
            <strong style={{ color: C.white, fontWeight: 700 }}>Nos vemos no dia 18!</strong>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`,
        padding: "24px 48px",
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
