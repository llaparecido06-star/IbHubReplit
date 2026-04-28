import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const DURATIONS = ["12 meses", "6 meses", "3 meses", "1 mês"];
const DURATION_MONTHS: Record<string, number> = { "12 meses": 12, "6 meses": 6, "3 meses": 3, "1 mês": 1 };

interface SubscriberRow {
  id: string;
  full_name: string | null;
  username: string | null;
  plan: string;
  courtesy_until: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
}

interface PlanRecord { id: string; name: string; price_cents: number; }
interface KPIs { mrr: number; activeSubscribers: number; activeCourtesies: number; cancellations: number; }

function fmtMRR(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function AdminFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({ mrr: 0, activeSubscribers: 0, activeCourtesies: 0, cancellations: 0 });
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [cortesiaEmail, setCortesiaEmail] = useState("");
  const [cortesiaPlano, setCortesiaPlano] = useState("");
  const [cortesiaValidade, setCortesiaValidade] = useState(DURATIONS[0]);
  const [cortesiaMotivo, setCortesiaMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, plansRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, plan, courtesy_until, stripe_subscription_status, stripe_current_period_end").neq("plan", null),
        supabase.from("plans").select("id, name, price_cents").eq("is_active", true),
      ]);
      const profiles: SubscriberRow[] = (profilesRes.data ?? []) as SubscriberRow[];
      const planList: PlanRecord[] = plansRes.data ?? [];
      setPlans(planList);
      const planPriceMap = new Map(planList.map((p) => [p.id, p.price_cents]));
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const activeViaStripe = profiles.filter((p) => p.stripe_subscription_status === "active" || p.stripe_subscription_status === "trialing");
      const activeCourtesies = profiles.filter((p) => p.courtesy_until !== null && new Date(p.courtesy_until) > now);
      const canceledThisMonth = profiles.filter((p) => {
        if (p.stripe_subscription_status !== "canceled" || !p.stripe_current_period_end) return false;
        const endDate = new Date(p.stripe_current_period_end);
        return endDate >= startOfMonth && endDate <= now;
      });
      const mrr = activeViaStripe.reduce((sum, p) => sum + (planPriceMap.get(p.plan) ?? 0), 0);
      const displaySet = new Map<string, SubscriberRow>();
      [...activeViaStripe, ...activeCourtesies].forEach((p) => displaySet.set(p.id, p));
      setKpis({ mrr, activeSubscribers: activeViaStripe.length, activeCourtesies: activeCourtesies.length, cancellations: canceledThisMonth.length });
      setSubscribers(Array.from(displaySet.values()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const filterPlans = ["Todos", ...plans.map((p) => p.name)];
  const filtered = subscribers.filter((s) => {
    const matchSearch = (s.full_name ?? "").toLowerCase().includes(search.toLowerCase()) || (s.username ?? "").toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === "Todos" || plans.find((p) => p.name === planFilter)?.id === s.plan;
    return matchSearch && matchPlan;
  });

  const handleCortesia = async () => {
    if (!cortesiaEmail.trim()) { setSaveMsg({ type: "error", text: "Informe o email do usuário." }); return; }
    if (!cortesiaPlano) { setSaveMsg({ type: "error", text: "Selecione um plano." }); return; }
    setSaving(true);
    setSaveMsg(null);
    try {
      const planId = cortesiaPlano;
      const months = DURATION_MONTHS[cortesiaValidade] ?? 1;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      const { data: found, error: findErr } = await supabase.from("profiles").select("id, full_name").ilike("email", cortesiaEmail.trim()).maybeSingle();
      if (findErr || !found) {
        setSaveMsg({ type: "error", text: "Usuário não encontrado com esse email." });
        setSaving(false);
        return;
      }
      const { error: updateErr } = await supabase.from("profiles").update({ plan: planId, courtesy_until: expiresAt.toISOString() }).eq("id", found.id);
      if (updateErr) {
        setSaveMsg({ type: "error", text: "Erro ao conceder cortesia: " + updateErr.message });
        setSaving(false);
        return;
      }
      setSaveMsg({ type: "success", text: `Cortesia de ${cortesiaValidade} (${cortesiaPlano}) concedida para ${found.full_name ?? cortesiaEmail}.` });
      setCortesiaEmail(""); setCortesiaPlano(PLAN_OPTIONS[0]); setCortesiaValidade(DURATIONS[0]); setCortesiaMotivo("");
      void loadData();
    } finally {
      setSaving(false);
    }
  };

  const kpiItems = [
    { icon: "💰", iconBg: "#d1fae5", label: "MRR", value: fmtMRR(kpis.mrr) },
    { icon: "💳", iconBg: "#ede9fe", label: "Assinantes Ativos", value: String(kpis.activeSubscribers) },
    { icon: "🎁", iconBg: "#fef9ee", label: "Cortesias Ativas", value: String(kpis.activeCourtesies) },
    { icon: "⚠", iconBg: "#fee2e2", label: "Cancelamentos (mês)", value: String(kpis.cancellations) },
  ];

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Financeiro</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Receita, assinantes e cortesias</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setShowModal(true); setSaveMsg(null); }} style={{ padding: "8px 16px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Conceder Cortesia</button>
            <button onClick={loadData} style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}>↻</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {kpiItems.map((k) => (
            <div key={k.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18 }}>
              <div style={{ width: 42, height: 42, backgroundColor: k.iconBg, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: NAVY }}>{loading ? "..." : k.value}</div>
              <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar assinante..." style={{ flex: 1, padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none" }} />
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 13, outline: "none", cursor: "pointer" }}>
            {filterPlans.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando...</div>
        ) : (
          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Nenhum assinante encontrado.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e8eaed" }}>
                    {["Nome", "Username", "Plano", "Cortesia até", "Status Stripe"].map((h) => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", color: "#8a93a2", fontWeight: 600, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #e8eaed" : "none" }}>
                      <td style={{ padding: "11px 16px", color: NAVY, fontWeight: 600 }}>{s.full_name ?? "—"}</td>
                      <td style={{ padding: "11px 16px", color: "#555" }}>@{s.username ?? "—"}</td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, backgroundColor: `${GOLD}18`, color: GOLD, padding: "2px 8px", borderRadius: 5 }}>{s.plan}</span>
                      </td>
                      <td style={{ padding: "11px 16px", color: s.courtesy_until ? "#059669" : "#aaa" }}>
                        {s.courtesy_until ? new Date(s.courtesy_until).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        {s.stripe_subscription_status ? (
                          <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: s.stripe_subscription_status === "active" ? "#d1fae5" : "#f3f4f6", color: s.stripe_subscription_status === "active" ? "#059669" : "#6b7280", padding: "2px 8px", borderRadius: 5 }}>
                            {s.stripe_subscription_status}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: "0 0 20px" }}>🎁 Conceder Cortesia</h2>
            {[
              { label: "Email do usuário *", value: cortesiaEmail, setter: setCortesiaEmail, placeholder: "usuario@email.com" },
              { label: "Motivo (opcional)", value: cortesiaMotivo, setter: setCortesiaMotivo, placeholder: "Ex: Parceria, influenciador..." },
            ].map((f) => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>{f.label}</label>
                <input value={f.value} onChange={(e) => f.setter(e.target.value)} placeholder={f.placeholder} style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Plano</label>
              <select value={cortesiaPlano} onChange={(e) => setCortesiaPlano(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none" }}>
                <option value="">Selecionar plano</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Validade</label>
              <select value={cortesiaValidade} onChange={(e) => setCortesiaValidade(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none" }}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {saveMsg && (
              <div style={{ marginBottom: 14, padding: "10px 14px", backgroundColor: saveMsg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${saveMsg.type === "success" ? "#86efac" : "#fca5a5"}`, borderRadius: 8, fontSize: 13, color: saveMsg.type === "success" ? "#16a34a" : "#dc2626" }}>
                {saveMsg.text}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "10px", backgroundColor: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleCortesia} disabled={saving} style={{ flex: 1, padding: "10px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Salvando..." : "Conceder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
