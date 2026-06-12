import React, { useEffect, useState } from "react";
import { getCachedSession } from "@/lib/supabase";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const MUTED  = "#7a8494";
const BORDER = "#e8e8e3";

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
  const [loading, setLoading]   = useState(true);
  const [buying, setBuying]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/stripe/credit-packages`)
      .then(r => r.json())
      .then((data: CreditPackage[]) => {
        setPackages(data);
        if (data.length > 0) setSelected(data[0].id);
      })
      .catch(() => setError("Não foi possível carregar os pacotes."))
      .finally(() => setLoading(false));
  }, [apiBase]);

  const handleBuy = async () => {
    const pkg = packages.find(p => p.id === selected);
    if (!pkg) return;
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

  const selectedPkg = packages.find(p => p.id === selected) ?? null;

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "#fff", borderRadius: 20, width: "100%", maxWidth: 620, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: NAVY }}>⚡ Comprar Créditos Avulsos</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>Não expiram e somam ao seu saldo atual</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: MUTED, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Package grid */}
        <div style={{ overflowY: "auto", padding: "20px 20px 0", flexGrow: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 14 }}>⏳ Carregando pacotes…</div>
          ) : error && packages.length === 0 ? (
            <div style={{ padding: 16, backgroundColor: "#fef2f2", borderRadius: 10, color: "#dc2626", fontSize: 13 }}>{error}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {packages.map(pkg => {
                const isSelected = pkg.id === selected;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelected(pkg.id)}
                    style={{
                      border: `2px solid ${isSelected ? GOLD : BORDER}`,
                      borderRadius: 14,
                      padding: "16px 14px",
                      cursor: "pointer",
                      backgroundColor: isSelected ? `${GOLD}08` : "#fafaf9",
                      transition: "border-color 0.15s, background 0.15s",
                      position: "relative",
                    }}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#fff", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>
                      </div>
                    )}

                    {/* Label */}
                    <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 8, paddingRight: isSelected ? 22 : 0 }}>{pkg.label}</div>

                    {/* Price */}
                    <div style={{ fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 10 }}>{fmtBRL(pkg.price_brl)}</div>

                    {/* Credit badges */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {pkg.ai_credits > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, backgroundColor: `${GOLD}15`, padding: "3px 8px", borderRadius: 20, display: "inline-block" }}>
                          ⚡ {pkg.ai_credits} créditos IA
                        </span>
                      )}
                      {pkg.revelation_credits > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", backgroundColor: "#f0fdf4", padding: "3px 8px", borderRadius: 20, display: "inline-block" }}>
                          🔓 {pkg.revelation_credits} revelações
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — selected summary + buy button */}
        {!loading && packages.length > 0 && (
          <div style={{ padding: "16px 20px 20px", borderTop: `1px solid ${BORDER}`, flexShrink: 0, backgroundColor: "#fff" }}>
            {error && (
              <div style={{ marginBottom: 12, padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>{error}</div>
            )}

            {selectedPkg && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{selectedPkg.label}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {[
                      selectedPkg.ai_credits > 0 ? `${selectedPkg.ai_credits} créditos IA` : null,
                      selectedPkg.revelation_credits > 0 ? `${selectedPkg.revelation_credits} revelações` : null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>{fmtBRL(selectedPkg.price_brl)}</span>
                  <button
                    onClick={handleBuy}
                    disabled={buying !== null}
                    style={{
                      padding: "11px 28px", borderRadius: 10,
                      backgroundColor: buying ? `${GOLD}80` : GOLD,
                      border: "none", color: NAVY, fontWeight: 800,
                      fontSize: 14, cursor: buying ? "default" : "pointer",
                      fontFamily: "inherit", whiteSpace: "nowrap",
                    }}
                  >
                    {buying ? "Aguarde…" : "Comprar agora"}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 12px", backgroundColor: `${GOLD}0A`, border: `1px solid ${GOLD}25`, borderRadius: 8 }}>
              <span style={{ fontSize: 14 }}>🔒</span>
              <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                Pagamento único seguro via Stripe. Créditos adicionados imediatamente após confirmação.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
