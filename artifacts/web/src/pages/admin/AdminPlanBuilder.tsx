import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

const ALL_FEATURES = [
  "Chat ilimitado", "Criar Grupos", "Ver Visitantes do Perfil", "Smart Match B2B",
  "Relatórios Detalhados", "Exportar CSV", "Criar Página Empresa", "Publicar Vagas",
  "Marketplace B2B", "Impulsionar Posts", "Upload Certificados", "Masterclasses",
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
  ai_search_credits?: number | null;
}

interface ModalState {
  name: string; subtitle: string; description: string;
  price: string; originalPrice: string; stripeId: string;
  aiCredits: string; delivery: string; features: string[];
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
    aiCredits: String(p.ai_search_credits ?? 0),
    delivery: p.delivery_strategy ?? "NONE",
    features: p.features ?? [],
  };
}

function toSlug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export default function AdminPlanBuilder() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [modal, setModal] = useState<ModalState>({ name: "", subtitle: "", description: "", price: "0", originalPrice: "", stripeId: "", aiCredits: "0", delivery: "NONE", features: [] });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("sort_order", { ascending: true });
    setPlans((data ?? []) as Plan[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    setModal(planToModal(plan));
    setSaveMsg(null);
    setShowModal(true);
  };

  const openNew = () => {
    setEditPlan(null);
    setModal({ name: "", subtitle: "", description: "", price: "0", originalPrice: "", stripeId: "", aiCredits: "0", delivery: "NONE", features: [] });
    setSaveMsg(null);
    setShowModal(true);
  };

  const toggleFeature = (f: string) => {
    setModal((prev) => ({ ...prev, features: prev.features.includes(f) ? prev.features.filter((x) => x !== f) : [...prev.features, f] }));
  };

  const handleToggleActive = async (plan: Plan) => {
    if (!confirm(`${plan.is_active ? "Desativar" : "Ativar"} plano "${plan.name}"?`)) return;
    await supabase.from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    void loadPlans();
  };

  const handleSave = async () => {
    if (!modal.name.trim()) { setSaveMsg({ type: "error", text: "Nome do plano é obrigatório." }); return; }
    setSaving(true);
    setSaveMsg(null);
    const data = {
      name: modal.name.trim(),
      subtitle: modal.subtitle.trim(),
      description: modal.description.trim() || null,
      price_cents: parsePrice(modal.price),
      original_price_cents: modal.originalPrice.trim() ? parsePrice(modal.originalPrice) : null,
      stripe_price_id: modal.stripeId.trim() || null,
      ai_search_credits: parseInt(modal.aiCredits) || 0,
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
        const newId = toSlug(modal.name);
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

  const inp = (label: string, key: keyof ModalState, placeholder: string, hint?: string, multiline?: boolean) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", letterSpacing: 0.5, marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 6px" }}>{hint}</p>}
      {multiline ? (
        <textarea value={modal[key] as string} onChange={(e) => setModal((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} rows={3} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
      ) : (
        <input value={modal[key] as string} onChange={(e) => setModal((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      )}
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
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ backgroundColor: "#fff", border: `1px solid ${plan.is_active ? "#e8eaed" : "#f3f4f6"}`, borderRadius: 16, padding: 20, opacity: plan.is_active ? 1 : 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{plan.name}</div>
                    <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>{plan.subtitle}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: plan.is_active ? "#d1fae5" : "#f3f4f6", color: plan.is_active ? "#059669" : "#6b7280", padding: "2px 8px", borderRadius: 5 }}>
                    {plan.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginBottom: 4 }}>{centsToStr(plan.price_cents)}<span style={{ fontSize: 12, fontWeight: 400, color: "#8a93a2" }}>/mês</span></div>
                {plan.original_price_cents ? <div style={{ fontSize: 12, color: "#aaa", textDecoration: "line-through" }}>De {centsToStr(plan.original_price_cents)}</div> : null}
                {plan.ai_search_credits != null && (
                  <div style={{ fontSize: 12, color: GOLD, marginTop: 8 }}>⚡ {plan.ai_search_credits} consultas IA/mês</div>
                )}
                {plan.features.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{plan.features.length} funcionalidades</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={() => openEdit(plan)} style={{ flex: 1, padding: "7px", backgroundColor: `${NAVY}0f`, color: NAVY, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Editar</button>
                  <button onClick={() => handleToggleActive(plan)} style={{ flex: 1, padding: "7px", backgroundColor: plan.is_active ? "#fef2f2" : "#f0fdf4", color: plan.is_active ? "#dc2626" : "#16a34a", border: `1px solid ${plan.is_active ? "#fca5a5" : "#86efac"}`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    {plan.is_active ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>{editPlan ? `Editar: ${editPlan.name}` : "Novo Plano"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa", padding: 4 }}>✕</button>
            </div>

            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Identidade</div>
              {inp("NOME DO PLANO", "name", "Ex: Premium")}
              {inp("SUBTÍTULO", "subtitle", "Ex: Para profissionais do vinho")}
              {inp("DESCRIÇÃO (marketing)", "description", "Ex: Ideal para sommeliers...", "Aparece nas telas de assinatura.", true)}
            </div>

            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Precificação</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  {inp('PREÇO "DE:" (R$)', "originalPrice", "Vazio = sem desconto")}
                </div>
                <div>
                  {inp('PREÇO "POR:" (R$)', "price", "0,00")}
                </div>
              </div>
              {inp("STRIPE PRICE ID", "stripeId", "price_1AbCdEfGhI...", "Vazio para planos gratuitos.")}
            </div>

            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Ideal.BI — Busca com IA</div>
              {inp("CONSULTAS IA / MÊS", "aiCredits", "0", "0 = sem acesso à Busca com IA")}
            </div>

            <div style={{ borderBottom: "1px solid #e8eaed", paddingBottom: 18, marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Estratégia de Slides</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DELIVERY_STRATEGIES.map((ds) => {
                  const active = modal.delivery === ds.value;
                  return (
                    <div key={ds.value} onClick={() => setModal((p) => ({ ...p, delivery: ds.value }))} style={{ padding: "10px 14px", border: `1px solid ${active ? "#8b5cf6" : "#e8eaed"}`, borderRadius: 9, cursor: "pointer", backgroundColor: active ? "#8b5cf608" : "transparent", display: "flex", gap: 10, alignItems: "flex-start" }}>
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

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Funcionalidades Gerais</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ALL_FEATURES.map((f) => {
                  const active = modal.features.includes(f);
                  return (
                    <div key={f} onClick={() => toggleFeature(f)} style={{ padding: "9px 14px", border: `1px solid ${active ? GOLD : "#e8eaed"}`, borderRadius: 8, cursor: "pointer", backgroundColor: active ? `${GOLD}0d` : "transparent", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: active ? GOLD : "#aaa", fontSize: 16 }}>{active ? "☑" : "☐"}</span>
                      <span style={{ fontSize: 13, color: active ? NAVY : "#555" }}>{f}</span>
                    </div>
                  );
                })}
              </div>
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
