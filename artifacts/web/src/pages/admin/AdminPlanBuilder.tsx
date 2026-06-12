import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

// Only features that are actively gated in the app code.
// Add here when a new feature gate is implemented.
const ALL_FEATURES = [
  "Criar Grupos",
  "Relatórios Detalhados",
  "Criar Página Empresa",
  "Publicar Vagas",
  "Upload Certificados",
];

const DELIVERY_STRATEGIES = [
  { value: "NONE",               label: "Nenhuma",           desc: "Sem desbloqueio automático de slides" },
  { value: "FULL_ACCESS",        label: "Acesso Total",      desc: "Todos os slides liberados imediatamente" },
  { value: "SEQUENTIAL_MONTHLY", label: "Sequencial Mensal", desc: "Divide os slides por 30 dias e libera em sequência diariamente" },
  { value: "RANDOM_DAILY",       label: "Aleatório Diário",  desc: "Libera 1 slide aleatório por dia" },
];

interface Plan {
  id: string;
  name: string;
  subtitle: string;
  description?: string | null;
  price_cents: number;
  original_price_cents?: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
  delivery_strategy?: string | null;
  stripe_price_id?: string | null;
  stripe_price_id_annual_onetime?: string | null;
  stripe_price_id_annual_recurring?: string | null;
  ai_search_credits?: number | null;
  reveal_credits?: number | null;
}

const PERIOD_LABELS: Record<string, string> = { mes: "Mês", trimestre: "Trim.", ano: "Ano" };

interface MarketPermission {
  id: string;
  title: string;
  icon: string;
  sort_order: number;
  section_type: string;
  periods?: string[];
}

interface ModalState {
  name: string; subtitle: string; description: string;
  price: string; originalPrice: string; stripeId: string;
  stripeIdAnnualOnetime: string; stripeIdAnnualRecurring: string;
  aiCredits: string; revealCredits: string; delivery: string; features: string[];
}

function centsToStr(c: number) {
  if (c === 0) return "Grátis";
  return `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
}

function parsePrice(s: string) {
  if (!s || s.toLowerCase().includes("grát") || s === "0") return 0;
  const n = parseFloat(s.replace(/[R$\s.]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function planToModal(p: Plan): ModalState {
  return {
    name: p.name,
    subtitle: p.subtitle,
    description: p.description ?? "",
    price: p.price_cents === 0 ? "0" : String(p.price_cents / 100),
    originalPrice: p.original_price_cents ? String(p.original_price_cents / 100) : "",
    stripeId: p.stripe_price_id ?? "",
    stripeIdAnnualOnetime: p.stripe_price_id_annual_onetime ?? "",
    stripeIdAnnualRecurring: p.stripe_price_id_annual_recurring ?? "",
    aiCredits: String(p.ai_search_credits ?? 0),
    revealCredits: String(p.reveal_credits ?? 0),
    delivery: p.delivery_strategy ?? "NONE",
    features: [...(p.features ?? [])],
  };
}

function toSlug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export default function AdminPlanBuilder() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketPerms, setMarketPerms] = useState<MarketPermission[]>([]);
  const [loadingMp, setLoadingMp] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [modal, setModal] = useState<ModalState>({
    name: "", subtitle: "", description: "", price: "0", originalPrice: "",
    stripeId: "", stripeIdAnnualOnetime: "", stripeIdAnnualRecurring: "",
    aiCredits: "0", revealCredits: "0", delivery: "NONE", features: [],
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("sort_order", { ascending: true });
    setPlans((data ?? []) as Plan[]);
    setLoading(false);
  }, []);

  const loadMarketPerms = useCallback(async () => {
    setLoadingMp(true);
    const { data } = await supabase.from("market_permissions").select("*").order("sort_order", { ascending: true });
    setMarketPerms((data ?? []) as MarketPermission[]);
    setLoadingMp(false);
  }, []);

  useEffect(() => {
    void loadPlans();
    void loadMarketPerms();
  }, [loadPlans, loadMarketPerms]);

  // Realtime: refresh market permissions whenever a category is added/updated/deleted
  useEffect(() => {
    const channel = supabase
      .channel("plan-builder-market-perms")
      .on("postgres_changes", { event: "*", schema: "public", table: "market_permissions" }, () => {
        void loadMarketPerms();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadMarketPerms]);

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    setModal(planToModal(plan));
    setSaveMsg(null);
    setShowModal(true);
  };

  const openNew = () => {
    setEditPlan(null);
    setModal({ name: "", subtitle: "", description: "", price: "0", originalPrice: "", stripeId: "", stripeIdAnnualOnetime: "", stripeIdAnnualRecurring: "", aiCredits: "0", revealCredits: "0", delivery: "NONE", features: [] });
    setSaveMsg(null);
    setShowModal(true);
  };

  const toggleFeature = (f: string) => {
    setModal(prev => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter(x => x !== f) : [...prev.features, f],
    }));
  };

  const handleTogglePeriod = (mp: MarketPermission, pd: string) => {
    setModal(prev => {
      let features = [...prev.features];
      // Migrate legacy key mercado:{id} → per-period keys on first interaction
      if (features.includes(`mercado:${mp.id}`)) {
        features = features.filter(f => f !== `mercado:${mp.id}`);
        const available = mp.periods && mp.periods.length > 0 ? mp.periods : ["mes", "trimestre", "ano"];
        for (const p of available) {
          if (!features.includes(`mercado:${mp.id}:${p}`)) features.push(`mercado:${mp.id}:${p}`);
        }
      }
      const key = `mercado:${mp.id}:${pd}`;
      return { ...prev, features: features.includes(key) ? features.filter(f => f !== key) : [...features, key] };
    });
  };

  const handleToggleActive = async (plan: Plan) => {
    if (!confirm(`${plan.is_active ? "Desativar" : "Ativar"} plano "${plan.name}"?`)) return;
    await supabase.from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    void loadPlans();
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Excluir o plano "${plan.name}"? Esta ação é irreversível.`)) return;
    await supabase.from("plans").delete().eq("id", plan.id);
    void loadPlans();
  };

  const handleSave = async () => {
    if (!modal.name.trim()) { setSaveMsg({ type: "error", text: "Nome do plano é obrigatório." }); return; }
    setSaving(true);
    setSaveMsg(null);
    const orig = parsePrice(modal.originalPrice);
    const curr = parsePrice(modal.price);
    const data = {
      name: modal.name.trim(),
      subtitle: modal.subtitle.trim(),
      description: modal.description.trim() || null,
      price_cents: curr,
      original_price_cents: orig > curr ? orig : null,
      stripe_price_id: modal.stripeId.trim() || null,
      stripe_price_id_annual_onetime: modal.stripeIdAnnualOnetime.trim() || null,
      stripe_price_id_annual_recurring: modal.stripeIdAnnualRecurring.trim() || null,
      ai_search_credits: parseInt(modal.aiCredits) || 0,
      reveal_credits: parseInt(modal.revealCredits) || 0,
      delivery_strategy: modal.delivery,
      features: modal.features,
      is_active: true,
    };
    try {
      if (editPlan) {
        const { error } = await supabase.from("plans").update(data).eq("id", editPlan.id);
        if (error) throw error;
        setSaveMsg({ type: "success", text: "Plano atualizado com sucesso!" });
      } else {
        const newId = toSlug(modal.name) || `plano_${Date.now()}`;
        const maxOrder = plans.reduce((m, p) => Math.max(m, p.sort_order), -1);
        const { error } = await supabase.from("plans").insert({ ...data, id: newId, sort_order: maxOrder + 1 });
        if (error) throw error;
        setSaveMsg({ type: "success", text: "Plano criado com sucesso!" });
      }
      void loadPlans();
    } catch (e) {
      setSaveMsg({ type: "error", text: e instanceof Error ? e.message : "Erro ao salvar plano." });
    } finally {
      setSaving(false);
    }
  };

  const orig = parsePrice(modal.originalPrice);
  const curr = parsePrice(modal.price);
  const discountPct = orig > 0 && curr > 0 && orig > curr ? Math.round(((orig - curr) / orig) * 100) : 0;

  const inp = (label: string, key: keyof ModalState, placeholder: string, hint?: string, multiline?: boolean) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", letterSpacing: 0.5, marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 6px" }}>{hint}</p>}
      {multiline ? (
        <textarea value={modal[key] as string} onChange={e => setModal(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} rows={3} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
      ) : (
        <input value={modal[key] as string} onChange={e => setModal(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      )}
    </div>
  );

  const sectionLabel = (label: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: 1 }}>{label}</div>
  );

  const featureToggle = (label: string, active: boolean, onClick: () => void, color?: string) => (
    <div onClick={onClick} style={{ padding: "9px 14px", border: `1px solid ${active ? (color ?? GOLD) : "#e8eaed"}`, borderRadius: 8, cursor: "pointer", backgroundColor: active ? `${color ?? GOLD}0d` : "transparent", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: active ? (color ?? GOLD) : "#aaa", fontSize: 16 }}>{active ? "☑" : "☐"}</span>
      <span style={{ fontSize: 13, color: active ? NAVY : "#555" }}>{label}</span>
    </div>
  );

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Plan Builder</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Configure planos de assinatura da plataforma</p>
          </div>
          <button onClick={openNew} style={{ padding: "9px 18px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Novo Plano</button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#aaa" }}>⏳ Carregando planos...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, color: "#aaa" }}>Nenhum plano. Crie o primeiro!</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {plans.map(plan => {
              const marketKeys = (plan.features ?? []).filter(f => f.startsWith("mercado:"));
              return (
                <div key={plan.id} style={{ backgroundColor: "#fff", border: `1px solid ${plan.is_active ? "#e8eaed" : "#f3f4f6"}`, borderRadius: 16, padding: 20, opacity: plan.is_active ? 1 : 0.6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{plan.name}</div>
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>ID: {plan.id}</div>
                      <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>{plan.subtitle}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: plan.is_active ? "#d1fae5" : "#f3f4f6", color: plan.is_active ? "#059669" : "#6b7280", padding: "2px 8px", borderRadius: 5 }}>
                      {plan.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginBottom: 4 }}>
                    {centsToStr(plan.price_cents)}
                    {plan.price_cents > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: "#8a93a2" }}>/mês</span>}
                  </div>
                  {plan.original_price_cents && plan.original_price_cents > plan.price_cents && (
                    <div style={{ fontSize: 12, color: "#aaa", textDecoration: "line-through", marginBottom: 4 }}>
                      De {centsToStr(plan.original_price_cents)}
                    </div>
                  )}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {plan.ai_search_credits != null && plan.ai_search_credits > 0 && (
                      <span style={{ fontSize: 11, backgroundColor: `${GOLD}18`, color: GOLD, padding: "2px 8px", borderRadius: 5, fontWeight: 700 }}>⚡ {plan.ai_search_credits} IA</span>
                    )}
                    {plan.reveal_credits != null && plan.reveal_credits > 0 && (
                      <span style={{ fontSize: 11, backgroundColor: "#f0fdf4", color: "#059669", padding: "2px 8px", borderRadius: 5, fontWeight: 700 }}>🔓 {plan.reveal_credits} especiais</span>
                    )}
                    {(plan.features ?? []).filter(f => !f.startsWith("mercado:")).length > 0 && (
                      <span style={{ fontSize: 11, backgroundColor: "#f0f4ff", color: "#4f46e5", padding: "2px 8px", borderRadius: 5 }}>
                        {(plan.features ?? []).filter(f => !f.startsWith("mercado:")).length} funcionalidades
                      </span>
                    )}
                    {marketKeys.length > 0 && (
                      <span style={{ fontSize: 11, backgroundColor: "#f0fdf4", color: "#059669", padding: "2px 8px", borderRadius: 5 }}>
                        {marketKeys.length} categorias mercado
                      </span>
                    )}
                    {plan.stripe_price_id && (
                      <span style={{ fontSize: 11, backgroundColor: "#faf5ff", color: "#7c3aed", padding: "2px 8px", borderRadius: 5 }}>💳 Stripe OK</span>
                    )}
                    {!plan.stripe_price_id && plan.price_cents > 0 && (
                      <span style={{ fontSize: 11, backgroundColor: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 5 }}>⚠️ Sem Stripe ID</span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={() => openEdit(plan)} style={{ flex: 2, padding: "7px", backgroundColor: `${NAVY}0f`, color: NAVY, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏️ Editar</button>
                    <button onClick={() => handleToggleActive(plan)} style={{ flex: 2, padding: "7px", backgroundColor: plan.is_active ? "#fef2f2" : "#f0fdf4", color: plan.is_active ? "#dc2626" : "#16a34a", border: `1px solid ${plan.is_active ? "#fca5a5" : "#86efac"}`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      {plan.is_active ? "Desativar" : "Ativar"}
                    </button>
                    <button onClick={() => handleDelete(plan)} style={{ padding: "7px 10px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 580, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>
                {editPlan ? `Editar: ${editPlan.name}` : "Novo Plano"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa", padding: 4 }}>✕</button>
            </div>

            {/* ── Identidade ── */}
            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              {sectionLabel("Identidade")}
              {inp("NOME DO PLANO", "name", "Ex: Premium")}
              {inp("SUBTÍTULO", "subtitle", "Ex: Para profissionais do vinho")}
              {inp("DESCRIÇÃO (marketing)", "description", "Aparece nas telas de assinatura", undefined, true)}
            </div>

            {/* ── Precificação ── */}
            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              {sectionLabel("Precificação")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>{inp('PREÇO "DE:" (R$)', "originalPrice", "Vazio = sem desconto")}</div>
                <div>{inp('PREÇO "POR:" (R$)', "price", "0,00")}</div>
              </div>
              {discountPct > 0 && (
                <div style={{ padding: "8px 12px", backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: 12, color: "#059669", fontWeight: 700, marginBottom: 12 }}>
                  🏷 De {centsToStr(orig)} por {centsToStr(curr)} · -{discountPct}% de desconto
                </div>
              )}
              {inp("STRIPE PRICE ID (mensal)", "stripeId", "price_1AbCdEfGhI...", "Vazio para planos gratuitos. Comece com 'price_'.")}
              {modal.stripeId && !modal.stripeId.startsWith("price_") && (
                <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#dc2626", marginTop: -8, marginBottom: 12 }}>
                  ⚠️ Stripe Price ID inválido — deve começar com "price_"
                </div>
              )}
              {inp("STRIPE PRICE ID ANUAL ÚNICO", "stripeIdAnnualOnetime", "price_...", "Pagamento único anual (Profissional/Exclusivo/Enterprise). Cria sessão mode: payment.")}
              {modal.stripeIdAnnualOnetime && !modal.stripeIdAnnualOnetime.startsWith("price_") && (
                <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#dc2626", marginTop: -8, marginBottom: 12 }}>
                  ⚠️ Price ID anual único inválido — deve começar com "price_"
                </div>
              )}
              {inp("STRIPE PRICE ID ANUAL RECORRENTE", "stripeIdAnnualRecurring", "price_...", "Somente Enterprise. Assinatura mensal recorrente com fidelidade anual (R$ 750/mês).")}
              {modal.stripeIdAnnualRecurring && !modal.stripeIdAnnualRecurring.startsWith("price_") && (
                <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#dc2626", marginTop: -8, marginBottom: 12 }}>
                  ⚠️ Price ID anual recorrente inválido — deve começar com "price_"
                </div>
              )}
            </div>

            {/* ── Ideal.BI ── */}
            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              {sectionLabel("Ideal.BI — Créditos Mensais")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>{inp("⚡ CONSULTAS DE IA / MÊS", "aiCredits", "0", "0 = sem acesso. Renovado dia 1º.")}</div>
                <div>{inp("🔓 CONSULTAS ESPECIAIS / MÊS", "revealCredits", "0", "Revelar dados financeiros (FOB, CX9L).")}</div>
              </div>
            </div>

            {/* ── Estratégia de Slides ── */}
            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              {sectionLabel("Estratégia de Slides")}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DELIVERY_STRATEGIES.map(ds => {
                  const active = modal.delivery === ds.value;
                  return (
                    <div key={ds.value} onClick={() => setModal(p => ({ ...p, delivery: ds.value }))} style={{ padding: "10px 14px", border: `1px solid ${active ? "#8b5cf6" : "#e8eaed"}`, borderRadius: 9, cursor: "pointer", backgroundColor: active ? "#8b5cf608" : "transparent", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: active ? "#8b5cf6" : "#aaa", marginTop: 1 }}>{active ? "●" : "○"}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: active ? NAVY : "#555" }}>{ds.label}</div>
                        <div style={{ fontSize: 11, color: "#8a93a2", marginTop: 2 }}>{ds.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Funcionalidades Gerais ── */}
            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              {sectionLabel("Funcionalidades Gerais")}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ALL_FEATURES.map(f => featureToggle(f, modal.features.includes(f), () => toggleFeature(f)))}
              </div>
            </div>

            {/* ── Dados de Mercado ── */}
            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              {sectionLabel("Dados de Mercado (Ideal.BI)")}

              {/* Feed Exclusivo toggle */}
              <div style={{ marginBottom: 10 }}>
                {featureToggle("Feed Exclusivo (Ideal.BI)", modal.features.includes("mercado:feed_exclusivo"), () => toggleFeature("mercado:feed_exclusivo"))}
              </div>
              <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 14px 2px" }}>
                Permite acesso ao feed de análises e insights exclusivos publicados pela Ideal.BI.
              </p>

              {/* AI Search Credits */}
              {inp("⚡ CRÉDITOS DE BUSCA POR IA / MÊS", "aiCredits", "0", "0 = sem acesso à busca por IA. Renovado dia 1º.")}

              {/* Market categories */}
              {loadingMp ? (
                <div style={{ color: "#aaa", fontSize: 13, padding: "8px 0" }}>⏳ Carregando categorias...</div>
              ) : marketPerms.length === 0 ? (
                <div style={{ color: "#aaa", fontSize: 13, padding: "8px 0" }}>
                  Nenhuma categoria de mercado cadastrada ainda. Crie em <strong>Mercado → Categorias</strong>.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {marketPerms.map(mp => {
                    const available = mp.periods && mp.periods.length > 0 ? mp.periods : ["mes", "trimestre", "ano"];
                    return (
                      <div key={mp.id}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{mp.title}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                          {available.map(pd => {
                            const key = `mercado:${mp.id}:${pd}`;
                            const legacyKey = `mercado:${mp.id}`;
                            const active = modal.features.includes(key) || modal.features.includes(legacyKey);
                            return (
                              <div key={pd} onClick={() => handleTogglePeriod(mp, pd)} style={{
                                padding: "5px 16px",
                                border: `1px solid ${active ? "#10b981" : "#e8eaed"}`,
                                borderRadius: 20,
                                cursor: "pointer",
                                backgroundColor: active ? "#10b98112" : "transparent",
                                fontSize: 12,
                                fontWeight: active ? 700 : 400,
                                color: active ? "#10b981" : "#666",
                                userSelect: "none" as const,
                              }}>
                                {PERIOD_LABELS[pd] ?? pd}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {saveMsg && (
              <div style={{ marginBottom: 14, padding: "10px 14px", backgroundColor: saveMsg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${saveMsg.type === "success" ? "#86efac" : "#fca5a5"}`, borderRadius: 8, fontSize: 13, color: saveMsg.type === "success" ? "#16a34a" : "#dc2626" }}>
                {saveMsg.text}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "11px", backgroundColor: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Salvando..." : editPlan ? "Atualizar Plano" : "Criar Plano"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
