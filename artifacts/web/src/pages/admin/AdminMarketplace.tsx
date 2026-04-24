import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const FILTERS = ["Todos os tipos", "Vagas", "Compra/Venda", "Serviços"];

interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  type: "vaga" | "marketplace" | "servico";
  is_active: boolean;
  created_at: string;
  user_id: string;
  price_cents?: number | null;
}

function typeLabel(type: string) {
  if (type === "vaga") return "Vaga";
  if (type === "servico") return "Serviço";
  return "Compra/Venda";
}

function typeBg(type: string) {
  if (type === "vaga") return { bg: "#ede9fe", color: "#6d28d9" };
  if (type === "servico") return { bg: "#d1fae5", color: "#059669" };
  return { bg: "#fff7ed", color: "#ea580c" };
}

export default function AdminMarketplace() {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [applicationsCount, setApplicationsCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oppRes, appRes] = await Promise.all([
        supabase.from("opportunities").select("*").order("created_at", { ascending: false }),
        supabase.from("opportunity_applications").select("id", { count: "exact", head: true }),
      ]);
      setOpportunities((oppRes.data ?? []) as Opportunity[]);
      setApplicationsCount(appRes.count ?? 0);
    } catch (e) {
      console.error("AdminMarketplace load:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = async (opp: Opportunity) => {
    setTogglingId(opp.id);
    const newVal = !opp.is_active;
    const { error } = await supabase.from("opportunities").update({ is_active: newVal }).eq("id", opp.id);
    if (!error) {
      setOpportunities((prev) => prev.map((o) => o.id === opp.id ? { ...o, is_active: newVal } : o));
    } else {
      alert("Erro ao atualizar status.");
    }
    setTogglingId(null);
  };

  const activeCount = opportunities.filter((o) => o.is_active).length;
  const inactiveCount = opportunities.filter((o) => !o.is_active).length;

  const filtered = opportunities.filter((o) => {
    const matchSearch = !search.trim() || o.title.toLowerCase().includes(search.toLowerCase()) || (o.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === FILTERS[0] ||
      (filter === "Vagas" && o.type === "vaga") ||
      (filter === "Compra/Venda" && o.type === "marketplace") ||
      (filter === "Serviços" && o.type === "servico");
    return matchSearch && matchFilter;
  });

  const kpiItems = [
    { icon: "🛍", iconBg: "#d1fae5", label: "Ativos",    value: activeCount },
    { icon: "🚫", iconBg: "#fee2e2", label: "Inativos",   value: inactiveCount },
    { icon: "📋", iconBg: "#ede9fe", label: "Total",      value: opportunities.length },
    { icon: "✉",  iconBg: "#fef9ee", label: "Candidaturas", value: applicationsCount },
  ];

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Marketplace</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Gerencie vagas, produtos e serviços</p>
          </div>
          <button onClick={load} style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}>↻ Atualizar</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {kpiItems.map((k) => (
            <div key={k.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18 }}>
              <div style={{ width: 42, height: 42, backgroundColor: k.iconBg, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>{loading ? "..." : k.value}</div>
              <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar oportunidades..." style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: "#fff", boxSizing: "border-box" }} />
          </div>
          <div style={{ position: "relative" }}>
            <button onClick={() => setFilterOpen(!filterOpen)} style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              {filter} <span>▾</span>
            </button>
            {filterOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 10, minWidth: 160, zIndex: 99, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                {FILTERS.map((f) => (
                  <div key={f} onClick={() => { setFilter(f); setFilterOpen(false); }} style={{ padding: "11px 14px", cursor: "pointer", fontSize: 13, backgroundColor: f === filter ? `${GOLD}12` : "transparent", color: f === filter ? GOLD : "#333", fontWeight: f === filter ? 700 : 400, borderBottom: "1px solid #e8eaed" }}>
                    {f}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛍</div>
            <p style={{ color: "#aaa" }}>Nenhuma oportunidade encontrada.</p>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            {filtered.map((opp, i) => {
              const style = typeBg(opp.type);
              return (
                <div key={opp.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i < filtered.length - 1 ? "1px solid #e8eaed" : "none", opacity: opp.is_active ? 1 : 0.55 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: style.bg, color: style.color, padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>{typeLabel(opp.type)}</span>
                    </div>
                    {opp.description && <div style={{ fontSize: 12, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.description}</div>}
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{new Date(opp.created_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <button
                    onClick={() => handleToggle(opp)}
                    disabled={togglingId === opp.id}
                    style={{
                      padding: "6px 14px",
                      backgroundColor: opp.is_active ? "#fef2f2" : "#f0fdf4",
                      color: opp.is_active ? "#dc2626" : "#16a34a",
                      border: `1px solid ${opp.is_active ? "#fca5a5" : "#86efac"}`,
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >{togglingId === opp.id ? "..." : opp.is_active ? "Desativar" : "Ativar"}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
