import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

// ─── Credit Packages ──────────────────────────────────────────────────────────

interface CreditPackage {
  id: string;
  label: string;
  ai_credits: number;
  revelation_credits: number;
  price_brl: number;
  sort_order: number;
  active: boolean;
}

const EMPTY_PKG = { label: "", ai_credits: 0, revelation_credits: 0, price_brl_str: "", active: true };

function fmtBRL(centavos: number) {
  if (!centavos) return "—";
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseBRL(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[R$\s.]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

interface PkgModalState { label: string; ai_credits: number; revelation_credits: number; price_brl_str: string; active: boolean }

function CreditPackagesSection() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPkg, setEditPkg] = useState<CreditPackage | null>(null);
  const [pkgModal, setPkgModal] = useState<PkgModalState>(EMPTY_PKG);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("credit_packages").select("*").order("sort_order", { ascending: true });
    setPackages((data ?? []) as CreditPackage[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => {
    setEditPkg(null);
    setPkgModal(EMPTY_PKG);
    setMsg(null);
    setShowModal(true);
  };

  const openEdit = (pkg: CreditPackage) => {
    setEditPkg(pkg);
    setPkgModal({ label: pkg.label, ai_credits: pkg.ai_credits, revelation_credits: pkg.revelation_credits, price_brl_str: String(pkg.price_brl / 100), active: pkg.active });
    setMsg(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!pkgModal.label.trim()) { setMsg({ type: "error", text: "Rótulo é obrigatório." }); return; }
    const priceCentavos = parseBRL(pkgModal.price_brl_str);
    if (priceCentavos <= 0) { setMsg({ type: "error", text: "Preço deve ser maior que zero." }); return; }
    setSaving(true); setMsg(null);
    const row = {
      label: pkgModal.label.trim(),
      ai_credits: pkgModal.ai_credits,
      revelation_credits: pkgModal.revelation_credits,
      price_brl: priceCentavos,
      active: pkgModal.active,
    };
    try {
      if (editPkg) {
        const { error } = await supabase.from("credit_packages").update(row).eq("id", editPkg.id);
        if (error) throw error;
        setMsg({ type: "success", text: "Pacote atualizado!" });
      } else {
        const maxOrder = packages.reduce((m, p) => Math.max(m, p.sort_order), -1);
        const newId = pkgModal.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || `pkg_${Date.now()}`;
        const { error } = await supabase.from("credit_packages").insert({ ...row, id: newId, sort_order: maxOrder + 1 });
        if (error) throw error;
        setMsg({ type: "success", text: "Pacote criado!" });
      }
      void load();
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  const handleToggle = async (pkg: CreditPackage) => {
    await supabase.from("credit_packages").update({ active: !pkg.active }).eq("id", pkg.id);
    void load();
  };

  const handleDelete = async (pkg: CreditPackage) => {
    if (!confirm(`Excluir pacote "${pkg.label}"?`)) return;
    await supabase.from("credit_packages").delete().eq("id", pkg.id);
    void load();
  };

  const numInp = (label: string, val: number, onChange: (v: number) => void) => (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", letterSpacing: 0.5, marginBottom: 6 }}>{label}</label>
      <input type="number" min={0} value={val} onChange={e => onChange(parseInt(e.target.value) || 0)} style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
    </div>
  );

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: "0 0 4px" }}>Pacotes de Crédito Avulso</h2>
          <p style={{ fontSize: 13, color: "#8a93a2", margin: 0 }}>Créditos comprados uma única vez — não expiram na virada do mês</p>
        </div>
        <button onClick={openNew} style={{ padding: "9px 18px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Novo Pacote</button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>⏳ Carregando pacotes...</div>
      ) : packages.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#aaa" }}>Nenhum pacote cadastrado ainda.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {packages.map(pkg => (
            <div key={pkg.id} style={{ backgroundColor: "#fff", border: `1px solid ${pkg.active ? "#e8eaed" : "#f3f4f6"}`, borderRadius: 14, padding: 18, opacity: pkg.active ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{pkg.label}</div>
                <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: pkg.active ? "#d1fae5" : "#f3f4f6", color: pkg.active ? "#059669" : "#6b7280", padding: "2px 8px", borderRadius: 5 }}>
                  {pkg.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 8 }}>{fmtBRL(pkg.price_brl)}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 12 }}>
                {pkg.ai_credits > 0 && (
                  <span style={{ fontSize: 11, backgroundColor: `${GOLD}18`, color: GOLD, padding: "2px 8px", borderRadius: 5, fontWeight: 700 }}>⚡ {pkg.ai_credits} IA</span>
                )}
                {pkg.revelation_credits > 0 && (
                  <span style={{ fontSize: 11, backgroundColor: "#f0fdf4", color: "#059669", padding: "2px 8px", borderRadius: 5, fontWeight: 700 }}>🔓 {pkg.revelation_credits} revelações</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => openEdit(pkg)} style={{ flex: 2, padding: "7px", backgroundColor: `${NAVY}0f`, color: NAVY, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✏️ Editar</button>
                <button onClick={() => handleToggle(pkg)} style={{ flex: 2, padding: "7px", backgroundColor: pkg.active ? "#fef2f2" : "#f0fdf4", color: pkg.active ? "#dc2626" : "#16a34a", border: `1px solid ${pkg.active ? "#fca5a5" : "#86efac"}`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{pkg.active ? "Desativar" : "Ativar"}</button>
                <button onClick={() => handleDelete(pkg)} style={{ padding: "7px 10px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Package modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: 0 }}>{editPkg ? `Editar: ${editPkg.label}` : "Novo Pacote Avulso"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>

            {/* Label */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", letterSpacing: 0.5, marginBottom: 6 }}>RÓTULO DO PACOTE</label>
              <input value={pkgModal.label} onChange={e => setPkgModal(p => ({ ...p, label: e.target.value }))} placeholder="Ex: Iniciante — 10 créditos" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
            </div>

            {/* Credits */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              {numInp("⚡ CRÉDITOS IA", pkgModal.ai_credits, v => setPkgModal(p => ({ ...p, ai_credits: v })))}
              {numInp("🔓 REVELAÇÕES", pkgModal.revelation_credits, v => setPkgModal(p => ({ ...p, revelation_credits: v })))}
            </div>

            {/* Price */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8a93a2", letterSpacing: 0.5, marginBottom: 6 }}>PREÇO (R$)</label>
              <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 6px" }}>Ex: 29.90 ou 29,90 — será convertido para centavos automaticamente</p>
              <input value={pkgModal.price_brl_str} onChange={e => setPkgModal(p => ({ ...p, price_brl_str: e.target.value }))} placeholder="29.90" style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
              {pkgModal.price_brl_str && parseBRL(pkgModal.price_brl_str) > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#059669", fontWeight: 700 }}>= {fmtBRL(parseBRL(pkgModal.price_brl_str))}</div>
              )}
            </div>

            {/* Active toggle */}
            <div onClick={() => setPkgModal(p => ({ ...p, active: !p.active }))} style={{ padding: "10px 14px", border: `1px solid ${pkgModal.active ? GOLD : "#e8eaed"}`, borderRadius: 8, cursor: "pointer", backgroundColor: pkgModal.active ? `${GOLD}0d` : "transparent", display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={{ color: pkgModal.active ? GOLD : "#aaa", fontSize: 16 }}>{pkgModal.active ? "☑" : "☐"}</span>
              <span style={{ fontSize: 13, color: pkgModal.active ? NAVY : "#555" }}>Ativo (visível para compra)</span>
            </div>

            {msg && (
              <div style={{ marginBottom: 14, padding: "10px 14px", backgroundColor: msg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${msg.type === "success" ? "#86efac" : "#fca5a5"}`, borderRadius: 8, fontSize: 13, color: msg.type === "success" ? "#16a34a" : "#dc2626" }}>
                {msg.text}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "11px", backgroundColor: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Salvando..." : editPkg ? "Atualizar Pacote" : "Criar Pacote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

      {/* ── Credit Packages Section ── */}
      <CreditPackagesSection />
    </AdminShell>
  );
}
