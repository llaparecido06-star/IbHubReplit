import { useLocation } from "wouter";

const NAVY = "#0d1b2a";
const GOLD = "#c9a84c";

const PLAN_LABELS: Record<string, string> = {
  premium: "Premium",
  exclusive: "Exclusive",
  business: "Business",
};

export default function AssinarCanceladoPage() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plano") ?? "";
  const planLabel = PLAN_LABELS[plan] ?? "";

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f6f7f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif",
      padding: 24,
    }}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: "48px 40px",
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
        border: "1px solid #e8eaed",
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>😕</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, marginBottom: 10 }}>
          Pagamento cancelado
        </h1>
        <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.7, marginBottom: 28 }}>
          Você cancelou o processo de assinatura. Nenhuma cobrança foi realizada.
          {planLabel && ` O plano ${planLabel} continua disponível quando quiser.`}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {planLabel && (
            <button
              onClick={() => setLocation(`/assinar?plano=${plan}`)}
              style={{
                backgroundColor: GOLD, color: NAVY,
                border: "none", borderRadius: 12,
                padding: "16px 0", fontSize: 16, fontWeight: 800, cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
          )}
          <button
            onClick={() => setLocation("/assinar")}
            style={{
              backgroundColor: "transparent", color: NAVY,
              border: `1px solid ${NAVY}30`, borderRadius: 12,
              padding: "14px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            Ver todos os planos
          </button>
          <button
            onClick={() => setLocation("/app")}
            style={{
              backgroundColor: "transparent", color: "#9ca3af",
              border: "1px solid #e8eaed", borderRadius: 12,
              padding: "14px 0", fontSize: 14, cursor: "pointer",
            }}
          >
            Voltar ao feed
          </button>
        </div>
      </div>
    </div>
  );
}
