const BASE = import.meta.env.BASE_URL;

const C = {
  bg:        "#0a0b0d",
  card:      "#12171f",
  cardBorder:"#1c2a3a",
  orange:    "#e89a18",
  white:     "#ffffff",
  muted:     "#8a9ab0",
  dimmed:    "#5a6a7a",
};

export default function Confirmation() {
  return (
    <div style={{ background: C.bg, color: C.white, fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

      {/* ── LOGO BAR ── */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
        <div style={{ paddingTop: "28px", paddingBottom: "20px", borderBottom: `1px solid ${C.cardBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "22px", letterSpacing: "0.02em", color: C.white }}>ibhub</span>
            <span style={{ color: "#2a4060", fontSize: "20px", fontWeight: 300 }}>|</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "16px", letterSpacing: "0.06em", color: C.orange }}>IDEAL.BI</span>
          </div>
          <div style={{ fontSize: "10px", color: C.dimmed, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: "4px" }}>
            INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
          </div>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "52px 32px 40px", textAlign: "center" }}>
        <div style={{ display: "inline-block", border: `1px solid rgba(232,154,24,0.4)`, borderRadius: "4px", padding: "5px 16px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", color: C.orange, textTransform: "uppercase", marginBottom: "28px" }}>
          INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
        </div>

        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "clamp(40px, 7vw, 70px)", lineHeight: 1.05, textTransform: "uppercase", color: C.white, marginBottom: "10px" }}>
          INSCRIÇÃO CONFIRMADA!
        </h1>
        <p style={{ fontSize: "18px", color: C.dimmed, marginBottom: "28px" }}>Você já está dentro.</p>

        <p style={{ fontSize: "15px", color: C.muted, lineHeight: 1.7 }}>
          O material preparatório foi enviado para o seu e-mail.<br />
          <span style={{ fontSize: "13px", color: C.dimmed }}>Verifique sua caixa de entrada (e o spam, se necessário).</span>
        </p>
      </div>

      {/* ── EBOOK BOX ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px 32px" }}>
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: "12px", padding: "36px 40px" }}>

          <p style={{ fontSize: "11px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "8px" }}>
            Você acabou de receber:
          </p>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "24px", textTransform: "uppercase", letterSpacing: "0.03em", color: C.white, marginBottom: "8px" }}>
            O FUTURO NO MERCADO DE VINHOS – PARTE 1
          </h2>
          <p style={{ fontSize: "14px", color: C.muted, marginBottom: "24px", lineHeight: 1.6 }}>
            Esse material mostra como estamos lendo o mercado hoje.
          </p>

          {/* Warning */}
          <div style={{ borderLeft: `3px solid ${C.orange}`, paddingLeft: "18px", marginBottom: "32px" }}>
            <p style={{ fontSize: "14px", color: "#f5c060", fontWeight: 600, lineHeight: 1.75 }}>
              Mas presta atenção nisso:<br />
              O que você recebeu <strong>NÃO</strong> é a parte mais importante.<br />
              O material mostra o cenário.<br />
              <span style={{ color: C.muted, fontWeight: 400 }}>Mas não mostra como usar isso na prática.</span>
            </p>
          </div>

          {/* Part 2 — 2 cols */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", alignItems: "start" }}>
            <p style={{ fontSize: "16px", fontWeight: 700, color: C.white, lineHeight: 1.55 }}>
              No dia 18 de maio,<br />vamos liberar a{" "}
              <span style={{ color: C.orange }}>PARTE 2:</span>
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                "Como transformar essa leitura em decisão",
                "Onde está o dinheiro de verdade",
                "Como operar com mais clareza no mercado",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#c5d0dc", lineHeight: 1.5 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.orange, marginTop: "5px", flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── EVENT META ROW ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", alignItems: "center", borderTop: `1px solid ${C.cardBorder}`, borderBottom: `1px solid ${C.cardBorder}`, padding: "24px 0", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: "10px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "6px" }}>Data</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 800, color: C.white }}>18 de maio</div>
          </div>
          <div style={{ background: C.cardBorder, height: "40px" }} />
          <div>
            <div style={{ fontSize: "10px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "6px" }}>HORÁRIO</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: 800, color: C.white }}>20h00</div>
          </div>
          <div style={{ background: C.cardBorder, height: "40px" }} />
          <div>
            <div style={{ fontSize: "10px", color: C.dimmed, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "6px" }}>evento fechado</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: C.muted, lineHeight: 1.4 }}>Para membros da<br />comunidade</div>
          </div>
        </div>
      </div>

      {/* ── IMPORTANTE ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px 32px" }}>
        <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)", borderRadius: "8px", padding: "18px 24px", fontSize: "14px", fontWeight: 700, color: "#fca5a5", textAlign: "center", letterSpacing: "0.01em" }}>
          IMPORTANTE: Se você não participar ao vivo, vai perder a parte mais importante.
        </div>
      </div>

      {/* ── STEPS ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px 52px" }}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", color: C.white, marginBottom: "24px" }}>
          Agora faça o seguinte:
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {[
            { n: "1.", title: "Verifique seu e-mail", body: "O material já está a caminho." },
            { n: "2.", title: "Leia o material", body: "Com calma e atenção." },
            { n: "3.", title: "Esteja presente no dia 18", body: "A Parte 2 será liberada exclusivamente ao vivo." },
          ].map((step, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: "10px", padding: "22px 18px" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "28px", fontWeight: 900, color: C.orange, marginBottom: "8px", lineHeight: 1 }}>{step.n}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: C.white, marginBottom: "6px" }}>{step.title}</div>
              <div style={{ fontSize: "13px", color: C.dimmed, lineHeight: 1.6 }}>{step.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CLOSING QUOTE ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", borderTop: `1px solid ${C.cardBorder}`, paddingTop: "36px" }}>
          <div style={{ borderRight: `1px solid ${C.cardBorder}`, paddingRight: "36px", fontSize: "15px", color: C.dimmed, lineHeight: 1.8 }}>
            Quem só consome informação<br />continua no mesmo lugar.
          </div>
          <div style={{ paddingLeft: "36px", fontSize: "15px", color: C.muted, lineHeight: 1.8 }}>
            Quem entende como usar<br />começa a operar diferente.<br />
            <strong style={{ color: C.white }}>Nos vemos no dia 18!</strong>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${C.cardBorder}`, background: C.bg, padding: "24px 32px", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: C.dimmed }}>
          Dúvidas? Fale com a gente:{" "}
          <a href="mailto:atendimento@idealbi.com.br" style={{ color: C.orange, textDecoration: "none" }}>
            atendimento@idealbi.com.br
          </a>
        </p>
      </footer>
    </div>
  );
}
