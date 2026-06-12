import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const WINE = "#722f37";

// ── Types ────────────────────────────────────────────────────
interface Referido {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  plan: string;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  courtesy_until: string | null;
  created_at: string;
}

interface Representante {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  referral_code: string | null;
  plan: string;
  created_at: string;
  referidos: Referido[];
}

// ── Helpers ──────────────────────────────────────────────────
function fmt(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function planLabel(plan: string): string {
  const map: Record<string, string> = {
    gratuito: "Gratuito", free: "Gratuito",
    premium: "Premium", profissional: "Premium",
    exclusive: "Exclusivo", exclusivo: "Exclusivo",
    business: "Business", empresa: "Business", empresas: "Business",
  };
  return map[plan?.toLowerCase()] ?? plan ?? "—";
}

function planColor(plan: string): string {
  const p = plan?.toLowerCase();
  if (p === "gratuito" || p === "free") return "#6b7280";
  if (p === "premium" || p === "profissional") return "#1d4ed8";
  if (p === "exclusive" || p === "exclusivo") return "#7c3aed";
  if (p === "business" || p === "empresa" || p === "empresas") return WINE;
  return "#6b7280";
}

function isPlanActive(r: Referido): boolean {
  const stripeActive = r.stripe_subscription_status === "active" || r.stripe_subscription_status === "trialing";
  const courtesyActive = !!r.courtesy_until && new Date(r.courtesy_until) > new Date();
  return stripeActive || courtesyActive;
}

function planExpiry(r: Referido): string {
  if (r.courtesy_until && new Date(r.courtesy_until) > new Date()) return fmt(r.courtesy_until);
  if (r.stripe_current_period_end) return fmt(r.stripe_current_period_end);
  return "—";
}

function statusBadge(r: Referido) {
  const active = isPlanActive(r);
  const isPaid = r.plan !== "gratuito" && r.plan !== "free" && !!r.plan;
  if (active && isPaid) {
    return { label: "Ativo", bg: "#dcfce7", color: "#16a34a", border: "#86efac" };
  }
  if (isPaid && !active) {
    return { label: "Expirado", bg: "#fef9c3", color: "#92400e", border: "#fde68a" };
  }
  return { label: "Gratuito", bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
}

function Avatar({ name, email, size = 36 }: { name: string | null; email: string | null; size?: number }) {
  const ch = ((name ?? email ?? "?")[0]).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: NAVY, display: "flex", alignItems: "center", justifyContent: "center",
      color: GOLD, fontSize: size * 0.38, fontWeight: 800,
    }}>{ch}</div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function AdminIndicacoes() {
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterPlan, setFilterPlan] = useState<"all" | "paid" | "free">("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all profiles that were invited by someone
      const { data: referidos, error: err1 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, plan, stripe_subscription_status, stripe_current_period_end, courtesy_until, created_at, invited_by_id")
        .not("invited_by_id", "is", null);

      if (err1) throw err1;
      if (!referidos || referidos.length === 0) {
        setRepresentantes([]);
        setLoading(false);
        return;
      }

      // Collect unique inviter IDs
      const inviterIds = [...new Set(referidos.map((r) => r.invited_by_id as string))];

      // Fetch inviters' profiles
      const { data: inviters, error: err2 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, referral_code, plan, created_at")
        .in("id", inviterIds);

      if (err2) throw err2;

      // Group referidos by inviter
      const map = new Map<string, Referido[]>();
      for (const r of referidos) {
        const iid = r.invited_by_id as string;
        if (!map.has(iid)) map.set(iid, []);
        map.get(iid)!.push({
          id: r.id,
          full_name: r.full_name,
          email: r.email,
          username: r.username,
          plan: r.plan ?? "gratuito",
          stripe_subscription_status: r.stripe_subscription_status,
          stripe_current_period_end: r.stripe_current_period_end,
          courtesy_until: r.courtesy_until,
          created_at: r.created_at,
        });
      }

      const result: Representante[] = (inviters ?? []).map((inv) => ({
        id: inv.id,
        full_name: inv.full_name,
        email: inv.email,
        username: inv.username,
        referral_code: inv.referral_code,
        plan: inv.plan ?? "gratuito",
        created_at: inv.created_at,
        referidos: (map.get(inv.id) ?? []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }));

      // Sort by number of referrals desc
      result.sort((a, b) => b.referidos.length - a.referidos.length);

      setRepresentantes(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar indicações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // ── Derived stats ──────────────────────────────────────────
  const totalIndicados = representantes.reduce((s, r) => s + r.referidos.length, 0);
  const totalAtivos = representantes.reduce((s, r) => s + r.referidos.filter(isPlanActive).length, 0);
  const totalPagantes = representantes.reduce(
    (s, r) => s + r.referidos.filter((f) => f.plan !== "gratuito" && f.plan !== "free" && !!f.plan).length,
    0
  );

  // ── Filter ─────────────────────────────────────────────────
  const filtered = representantes.filter((rep) => {
    if (search.trim()) {
      const s = search.toLowerCase();
      const match =
        (rep.full_name ?? "").toLowerCase().includes(s) ||
        (rep.email ?? "").toLowerCase().includes(s) ||
        (rep.username ?? "").toLowerCase().includes(s) ||
        (rep.referral_code ?? "").toLowerCase().includes(s);
      if (!match) return false;
    }
    if (filterPlan === "paid") return rep.referidos.some(isPlanActive);
    if (filterPlan === "free") return !rep.referidos.some(isPlanActive);
    return true;
  });

  return (
    <AdminShell>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>CRM de Indicações</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>
              Rastreamento de códigos de convite e comissões de representantes
            </p>
          </div>
          <button
            onClick={() => { void load(); }}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >↻ Atualizar</button>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Representantes", value: representantes.length, icon: "👤", color: NAVY },
            { label: "Total Indicados", value: totalIndicados, icon: "🔗", color: "#1d4ed8" },
            { label: "Com Plano Ativo", value: totalAtivos, icon: "✅", color: "#16a34a" },
            { label: "Plano Pago", value: totalPagantes, icon: "💳", color: GOLD },
          ].map((c) => (
            <div key={c.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: c.color, lineHeight: 1 }}>{loading ? "…" : c.value}</div>
              <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, email ou código..."
              style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {(["all", "paid", "free"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterPlan(v)}
              style={{
                padding: "10px 16px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                backgroundColor: filterPlan === v ? NAVY : "#fff",
                color: filterPlan === v ? "#fff" : "#555",
              }}
            >
              {v === "all" ? "Todos" : v === "paid" ? "Com ativos" : "Sem ativos"}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando indicações...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
            <p style={{ color: "#dc2626" }}>{error}</p>
            <button onClick={() => { void load(); }} style={{ marginTop: 12, padding: "8px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Tentar novamente</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
            <p style={{ color: "#aaa" }}>{search ? "Nenhum representante encontrado." : "Nenhuma indicação registrada ainda."}</p>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            {filtered.map((rep, idx) => {
              const isOpen = expanded === rep.id;
              const ativos = rep.referidos.filter(isPlanActive).length;
              const pagantes = rep.referidos.filter((f) => f.plan !== "gratuito" && f.plan !== "free" && !!f.plan).length;
              const convRate = rep.referidos.length > 0 ? Math.round((pagantes / rep.referidos.length) * 100) : 0;

              return (
                <div key={rep.id}>
                  {/* Representante row */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : rep.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
                      cursor: "pointer", borderBottom: !isOpen && idx < filtered.length - 1 ? "1px solid #e8eaed" : "none",
                      backgroundColor: isOpen ? `${GOLD}08` : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <Avatar name={rep.full_name} email={rep.email} size={42} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{rep.full_name ?? rep.username ?? "—"}</span>
                        {rep.referral_code && (
                          <span style={{
                            fontSize: 11, fontWeight: 800, backgroundColor: `${GOLD}20`, color: GOLD,
                            padding: "2px 8px", borderRadius: 5, fontFamily: "monospace", letterSpacing: 0.5,
                          }}>{rep.referral_code}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#8a93a2" }}>{rep.email ?? `@${rep.username ?? "—"}`}</div>
                    </div>

                    {/* Stats chips */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      <div style={{ textAlign: "center", minWidth: 44 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: NAVY, lineHeight: 1 }}>{rep.referidos.length}</div>
                        <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>indicados</div>
                      </div>
                      <div style={{ textAlign: "center", minWidth: 44 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#16a34a", lineHeight: 1 }}>{ativos}</div>
                        <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>ativos</div>
                      </div>
                      <div style={{ textAlign: "center", minWidth: 44 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: GOLD, lineHeight: 1 }}>{convRate}%</div>
                        <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>conversão</div>
                      </div>
                      <span style={{ color: "#aaa", fontSize: 18, marginLeft: 4 }}>{isOpen ? "▾" : "›"}</span>
                    </div>
                  </div>

                  {/* Expanded: list of referidos */}
                  {isOpen && (
                    <div style={{
                      borderBottom: idx < filtered.length - 1 ? "1px solid #e8eaed" : "none",
                      backgroundColor: "#fafbfc",
                    }}>
                      {/* Summary bar */}
                      <div style={{
                        display: "flex", gap: 16, flexWrap: "wrap",
                        padding: "12px 20px", borderBottom: "1px solid #e8eaed",
                        backgroundColor: `${NAVY}06`,
                      }}>
                        {[
                          { label: "Total indicados", value: rep.referidos.length, color: NAVY },
                          { label: "Com plano ativo", value: ativos, color: "#16a34a" },
                          { label: "Plano pago", value: pagantes, color: GOLD },
                          { label: "Taxa de conversão", value: `${convRate}%`, color: convRate >= 50 ? "#16a34a" : convRate >= 20 ? GOLD : "#6b7280" },
                        ].map((s) => (
                          <div key={s.label} style={{ fontSize: 12 }}>
                            <span style={{ color: "#8a93a2" }}>{s.label}: </span>
                            <span style={{ fontWeight: 800, color: s.color }}>{s.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Table header */}
                      <div style={{
                        display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr",
                        padding: "8px 20px", fontSize: 11, fontWeight: 700, color: "#8a93a2",
                        textTransform: "uppercase" as const, letterSpacing: 0.5,
                        borderBottom: "1px solid #e8eaed",
                      }}>
                        <span>Usuário</span>
                        <span>Plano</span>
                        <span>Status</span>
                        <span>Vence em</span>
                        <span>Cadastro</span>
                      </div>

                      {/* Referido rows */}
                      {rep.referidos.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#aaa", fontSize: 13 }}>Nenhum indicado ainda.</div>
                      ) : (
                        rep.referidos.map((ref, i) => {
                          const badge = statusBadge(ref);
                          const isPaid = ref.plan !== "gratuito" && ref.plan !== "free" && !!ref.plan;
                          return (
                            <div
                              key={ref.id}
                              style={{
                                display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr",
                                padding: "11px 20px", alignItems: "center",
                                borderBottom: i < rep.referidos.length - 1 ? "1px solid #f0f2f4" : "none",
                                backgroundColor: "#fff",
                              }}
                            >
                              {/* Nome */}
                              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                <Avatar name={ref.full_name} email={ref.email} size={28} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {ref.full_name ?? ref.username ?? "—"}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {ref.email ?? `@${ref.username ?? ref.id.slice(0, 8)}`}
                                  </div>
                                </div>
                              </div>

                              {/* Plano */}
                              <div>
                                <span style={{
                                  fontSize: 12, fontWeight: 700, color: isPaid ? planColor(ref.plan) : "#6b7280",
                                  backgroundColor: isPaid ? `${planColor(ref.plan)}15` : "#f3f4f6",
                                  padding: "3px 8px", borderRadius: 5,
                                }}>{planLabel(ref.plan)}</span>
                              </div>

                              {/* Status */}
                              <div>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, color: badge.color,
                                  backgroundColor: badge.bg, border: `1px solid ${badge.border}`,
                                  padding: "2px 7px", borderRadius: 5,
                                }}>{badge.label}</span>
                              </div>

                              {/* Vencimento */}
                              <div style={{ fontSize: 12, color: "#555" }}>
                                {planExpiry(ref)}
                              </div>

                              {/* Cadastro */}
                              <div style={{ fontSize: 12, color: "#8a93a2" }}>
                                {fmt(ref.created_at)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
