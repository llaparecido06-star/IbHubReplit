export default function Confirmation() {
  return (
    <div className="min-h-screen font-sans" style={{ background: "#070e17", color: "#e8edf3" }}>

      {/* ─── HEADER ─── */}
      <section style={{ maxWidth: "860px", margin: "0 auto", padding: "60px 24px 48px", textAlign: "center" }}>

        {/* Badge */}
        <div style={{
          display: "inline-block",
          border: "1px solid rgba(59,130,246,0.4)",
          borderRadius: "4px",
          padding: "6px 16px",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "#60a5fa",
          textTransform: "uppercase",
          marginBottom: "32px",
        }}>
          INTELIGÊNCIA ESTRATÉGICA PARA O MERCADO DE VINHOS
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 64px)",
          fontWeight: 900,
          letterSpacing: "-0.01em",
          color: "#ffffff",
          lineHeight: 1.1,
          marginBottom: "12px",
        }}>
          INSCRIÇÃO CONFIRMADA!
        </h1>

        <p style={{ fontSize: "20px", color: "#64748b", marginBottom: "36px" }}>
          Você já está dentro.
        </p>

        {/* Email info */}
        <p style={{ fontSize: "16px", color: "#94a3b8", lineHeight: 1.7 }}>
          O material preparatório foi enviado<br />para o seu e-mail.<br />
          <span style={{ color: "#64748b", fontSize: "14px" }}>Verifique sua caixa de entrada (e o spam, se necessário).</span>
        </p>
      </section>

      {/* ─── EBOOK BOX ─── */}
      <section style={{ maxWidth: "860px", margin: "0 auto", padding: "0 24px 40px" }}>
        <div style={{
          background: "#0d1b2e",
          border: "1px solid #1e3a5f",
          borderRadius: "12px",
          padding: "36px 40px",
        }}>
          <p style={{ fontSize: "13px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", fontWeight: 600 }}>
            Você acabou de receber:
          </p>

          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            O FUTURO NO MERCADO DE VINHOS – PARTE 1
          </h2>

          <p style={{ fontSize: "15px", color: "#94a3b8", marginBottom: "28px", lineHeight: 1.6 }}>
            Esse material mostra como estamos lendo o mercado hoje.
          </p>

          {/* Warning */}
          <div style={{
            borderLeft: "3px solid #f59e0b",
            paddingLeft: "18px",
            marginBottom: "32px",
          }}>
            <p style={{ fontSize: "15px", color: "#fbbf24", fontWeight: 600, lineHeight: 1.7 }}>
              Mas presta atenção nisso:<br />
              O que você recebeu <strong>NÃO</strong> é a parte mais importante.<br />
              O material mostra o cenário.<br />
              <span style={{ color: "#94a3b8", fontWeight: 400 }}>Mas não mostra como usar isso na prática.</span>
            </p>
          </div>

          {/* Part 2 section — 2 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", alignItems: "start" }}>
            <div>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.5 }}>
                No dia 18 de maio,<br />vamos liberar a <span style={{ color: "#3b82f6" }}>PARTE 2:</span>
              </p>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                "Como transformar essa leitura em decisão",
                "Onde está o dinheiro de verdade",
                "Como operar com mais clareza no mercado",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: "#cbd5e1", lineHeight: 1.5 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", marginTop: "6px", flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── EVENT META ROW ─── */}
      <section style={{ maxWidth: "860px", margin: "0 auto", padding: "0 24px 40px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
          alignItems: "center",
          borderTop: "1px solid #1e3a5f",
          borderBottom: "1px solid #1e3a5f",
          padding: "24px 0",
          textAlign: "center",
        }}>
          <div>
            <div style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginBottom: "6px" }}>Data</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>18 de maio</div>
          </div>
          <div style={{ background: "#1e3a5f", height: "40px" }} />
          <div>
            <div style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginBottom: "6px" }}>HORÁRIO</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>20h00</div>
          </div>
          <div style={{ background: "#1e3a5f", height: "40px" }} />
          <div>
            <div style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginBottom: "6px" }}>evento fechado</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#94a3b8" }}>Para membros da<br />comunidade</div>
          </div>
        </div>
      </section>

      {/* ─── IMPORTANTE ─── */}
      <section style={{ maxWidth: "860px", margin: "0 auto", padding: "0 24px 40px" }}>
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: "8px",
          padding: "20px 24px",
          fontSize: "15px",
          fontWeight: 700,
          color: "#fca5a5",
          textAlign: "center",
          letterSpacing: "0.01em",
        }}>
          IMPORTANTE: Se você não participar ao vivo, vai perder a parte mais importante.
        </div>
      </section>

      {/* ─── STEPS ─── */}
      <section style={{ maxWidth: "860px", margin: "0 auto", padding: "0 24px 56px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff", marginBottom: "28px", letterSpacing: "0.02em" }}>
          Agora faça o seguinte:
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {[
            { n: "1.", title: "Verifique seu e-mail", body: "O material já está a caminho." },
            { n: "2.", title: "Leia o material", body: "Com calma e atenção." },
            { n: "3.", title: "Esteja presente no dia 18", body: "A Parte 2 será liberada exclusivamente ao vivo." },
          ].map((step, i) => (
            <div key={i} style={{
              background: "#0d1b2e",
              border: "1px solid #1e3a5f",
              borderRadius: "10px",
              padding: "24px 20px",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#3b82f6", marginBottom: "8px" }}>{step.n}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>{step.title}</div>
              <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.6 }}>{step.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CLOSING QUOTE ─── */}
      <section style={{ maxWidth: "860px", margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", borderTop: "1px solid #0f2040", paddingTop: "40px" }}>
          <div style={{
            borderRight: "1px solid #0f2040",
            paddingRight: "40px",
            fontSize: "16px",
            color: "#64748b",
            lineHeight: 1.8,
          }}>
            Quem só consome informação<br />continua no mesmo lugar.
          </div>
          <div style={{
            paddingLeft: "40px",
            fontSize: "16px",
            color: "#94a3b8",
            lineHeight: 1.8,
          }}>
            Quem entende como usar<br />começa a operar diferente.<br />
            <strong style={{ color: "#ffffff" }}>Nos vemos no dia 18!</strong>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        borderTop: "1px solid #0f2040",
        background: "#070e17",
        padding: "28px 24px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "13px", color: "#475569" }}>
          Dúvidas? Fale com a gente:{" "}
          <a href="mailto:atendimento@idealbi.com.br" style={{ color: "#3b82f6", textDecoration: "none" }}>
            atendimento@idealbi.com.br
          </a>
        </p>
      </footer>
    </div>
  );
}
