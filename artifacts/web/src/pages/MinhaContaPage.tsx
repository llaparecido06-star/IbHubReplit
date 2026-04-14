import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { createPortalSession } from "@/services/stripe";
import { AppShell } from "@/components/layout/AppShell";

const NAVY  = "#0d1b2a";
const GOLD  = "#c9a84c";

const PLAN_LABELS: Record<string, string> = {
  basico:    "Básico",
  premium:   "Premium",
  exclusive: "Exclusive",
  business:  "Business",
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Ativo",          color: "#059669", bg: "#d1fae5" },
  trialing:  { label: "Período de teste", color: "#2563eb", bg: "#dbeafe" },
  past_due:  { label: "Pagamento pendente", color: "#d97706", bg: "#fef3c7" },
  canceled:  { label: "Cancelado",      color: "#dc2626", bg: "#fee2e2" },
  inactive:  { label: "Gratuito",       color: "#6b7280", bg: "#f3f4f6" },
};

export default function MinhaContaPage() {
  const { session, profile, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const plan = profile?.plan ?? "basico";
  const stripeStatus = (profile as any)?.stripe_subscription_status ?? null;
  const periodEnd: string | null = (profile as any)?.stripe_current_period_end ?? null;
  const status = stripeStatus ? STATUS_LABELS[stripeStatus] ?? STATUS_LABELS.inactive : STATUS_LABELS.inactive;
  const hasActiveSub = stripeStatus === "active" || stripeStatus === "trialing";
  const isPastDue = stripeStatus === "past_due";

  async function handlePortal() {
    if (!session) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { url } = await createPortalSession(session.access_token);
      window.location.href = url;
    } catch (e: any) {
      setPortalError(e.message ?? "Erro ao abrir portal de assinatura.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 16px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: NAVY, marginBottom: 24 }}>Minha Conta</h1>

        {/* Profile summary */}
        <div style={{
          backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed",
          padding: "24px 24px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              backgroundColor: "#722f37",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 900, color: "#fff",
            }}>
              {(profile?.full_name ?? "U")[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{profile?.full_name ?? "Usuário"}</div>
              <div style={{ fontSize: 13, color: "#8a93a2" }}>@{profile?.username ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div style={{
          backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed",
          padding: "24px 24px", marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 16 }}>Assinatura</h2>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>{PLAN_LABELS[plan] ?? plan}</div>
              {periodEnd && (
                <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 4 }}>
                  {hasActiveSub ? "Renova em" : "Encerra em"}: {new Date(periodEnd).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
            <div style={{
              backgroundColor: status.bg, color: status.color,
              fontWeight: 700, fontSize: 12, padding: "5px 14px", borderRadius: 100,
            }}>
              {status.label}
            </div>
          </div>

          {isPastDue && (
            <div style={{
              backgroundColor: "#fef3c7", borderRadius: 10, padding: "12px 14px",
              marginBottom: 14, fontSize: 13, color: "#92400e",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              ⚠️ Seu pagamento está pendente. Atualize seu método de pagamento para manter o acesso.
            </div>
          )}

          {plan === "basico" && !hasActiveSub ? (
            <button
              onClick={() => setLocation("/assinar")}
              style={{
                width: "100%", backgroundColor: GOLD, color: NAVY,
                border: "none", borderRadius: 10, padding: "14px 0",
                fontSize: 15, fontWeight: 800, cursor: "pointer",
              }}
            >
              Fazer upgrade de plano
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(hasActiveSub || isPastDue) && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  style={{
                    width: "100%", backgroundColor: NAVY, color: "#fff",
                    border: "none", borderRadius: 10, padding: "14px 0",
                    fontSize: 15, fontWeight: 700, cursor: "pointer",
                    opacity: portalLoading ? 0.7 : 1,
                  }}
                >
                  {portalLoading ? "Abrindo portal…" : "Gerenciar assinatura"}
                </button>
              )}
              {!hasActiveSub && (
                <button
                  onClick={() => setLocation("/assinar")}
                  style={{
                    width: "100%", backgroundColor: GOLD, color: NAVY,
                    border: "none", borderRadius: 10, padding: "14px 0",
                    fontSize: 15, fontWeight: 800, cursor: "pointer",
                  }}
                >
                  Reativar assinatura
                </button>
              )}
            </div>
          )}

          {portalError && (
            <p style={{ fontSize: 13, color: "#dc2626", marginTop: 10, textAlign: "center" }}>
              {portalError}
            </p>
          )}
        </div>

        {/* Sign out */}
        <div style={{
          backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed",
          padding: "16px 24px",
        }}>
          <button
            onClick={async () => { await signOut(); setLocation("/"); }}
            style={{
              width: "100%", backgroundColor: "transparent", color: "#dc2626",
              border: "1px solid #fee2e2", borderRadius: 10, padding: "12px 0",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </AppShell>
  );
}
