const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: NAVY,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      padding: 24,
      textAlign: "center",
    }}>
      <div style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: "rgba(201,168,76,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
        fontSize: 40,
      }}>
        🔧
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: GOLD, margin: "0 0 16px" }}>
        Voltamos já
      </h1>
      <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: 400, margin: "0 0 32px" }}>
        O ibhub está em manutenção programada.<br />
        Voltaremos em breve, obrigado pela paciência!
      </p>
      <div style={{ width: 48, height: 2, backgroundColor: "rgba(201,168,76,0.3)", borderRadius: 1, marginBottom: 24 }} />
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 1, margin: 0 }}>
        ibhub — Rede do Vinho
      </p>
    </div>
  );
}
