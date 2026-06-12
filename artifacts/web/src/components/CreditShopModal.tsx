import React, { useEffect, useState } from "react";
import { getCachedSession } from "@/lib/supabase";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const MUTED  = "#7a8494";
const BORDER = "#e8e8e3";
const WHITE  = "#fff";
const BG     = "#f5f4ef";

export interface CreditPackage {
  id: string;
  label: string;
  ai_credits: number;
  revelation_credits: number;
  price_brl: number;
  sort_order: number;
}

interface Props {
  onClose: () => void;
}

function fmtBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CreditShopModal({ onClose }: Props) {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? `${window.location.origin}/api`;
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/stripe/credit-packages`)
      .then(r => r.json())
      .then((data: CreditPackage[]) => { setPackages(data); })
      .catch(() => { setError("Não foi possível carregar os pacotes."); })
      .finally(() => setLoading(false));
  }, [apiBase]);

  const handleBuy = async (pkg: CreditPackage) => {
    setBuying(pkg.id);
    setError(null);
    try {
      const session = await getCachedSession();
      if (!session?.access_token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(`${apiBase}/stripe/create-credit-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Erro ao iniciar pagamento.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Erro ao processar. Tente novamente.");
    } finally {
      setBuying(null);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: WHITE, borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 16px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: NAVY }}>⚡ Comprar Créditos</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>Créditos avulsos — não expiram e somam ao seu saldo atual</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: MUTED, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: MUTED }}>Carregando pacotes…</div>
          ) : error ? (
            <div style={{ padding: 16, backgroundColor: "#fef2f2", borderRadius: 10, color: "#dc2626", fontSize: 13 }}>{error}</div>
          ) : (
            packages.map(pkg => (
              <div
                key={pkg.id}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  border: `1px solid ${BORDER}`, borderRadius: 14,
                  backgroundColor: BG,
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${GOLD}80`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{pkg.label}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, backgroundColor: `${GOLD}15`, padding: "2px 8px", borderRadius: 20 }}>
                      ⚡ {pkg.ai_credits} créditos IA
                    </span>
                    {pkg.revelation_credits > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", backgroundColor: "#f0fdf4", padding: "2px 8px", borderRadius: 20 }}>
                        🔓 {pkg.revelation_credits} revelações
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: NAVY, marginBottom: 6 }}>{fmtBRL(pkg.price_brl)}</div>
                  <button
                    onClick={() => handleBuy(pkg)}
                    disabled={buying !== null}
                    style={{
                      padding: "8px 18px", borderRadius: 10,
                      backgroundColor: buying === pkg.id ? `${GOLD}80` : GOLD,
                      border: "none", color: NAVY, fontWeight: 700,
                      fontSize: 13, cursor: buying !== null ? "default" : "pointer",
                      fontFamily: "inherit", transition: "opacity 0.15s",
                    }}
                  >
                    {buying === pkg.id ? "…" : "Comprar"}
                  </button>
                </div>
              </div>
            ))
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", backgroundColor: `${GOLD}0A`, border: `1px solid ${GOLD}25`, borderRadius: 10, marginTop: 4 }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
              Pagamento único seguro via Stripe. Os créditos são adicionados ao seu saldo imediatamente após a confirmação.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
