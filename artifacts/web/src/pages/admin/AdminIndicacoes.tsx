import React, { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const WINE = "#722f37";

// ── Commission tiers ──────────────────────────────────────────
interface Tier {
  pct: number;
  color: string;
  bg: string;
  border: string;
  label: string;
  nextAt?: number;
  nextPct?: number;
}

function getTier(total: number): Tier {
  if (total >= 200) return { pct: 20, color: WINE,      bg: "#f9f0f1", border: "#e4b5ba", label: "20%",           nextAt: undefined, nextPct: undefined };
  if (total >= 50)  return { pct: 15, color: "#7c3aed",  bg: "#f5f3ff", border: "#c4b5fd", label: "15%",           nextAt: 200,  nextPct: 20 };
                    return { pct: 10, color: "#1d4ed8",  bg: "#eff6ff", border: "#bfdbfe", label: "10%",           nextAt: 50,   nextPct: 15 };
}

// ── Types ─────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
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
  if (active && isPaid)  return { label: "Ativo",    bg: "#dcfce7", color: "#16a34a", border: "#86efac" };
  if (isPaid && !active) return { label: "Expirado", bg: "#fef9c3", color: "#92400e", border: "#fde68a" };
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

// Validate referral code: 4–20 chars, letters/numbers/hyphens, no spaces
function validateCode(code: string): string | null {
  if (!code.trim()) return "Código não pode ser vazio.";
  if (code.length < 4) return "Mínimo 4 caracteres.";
  if (code.length > 20) return "Máximo 20 caracteres.";
  if (!/^[A-Za-z0-9-]+$/.test(code)) return "Use apenas letras, números e hífens.";
  return null;
}

// ── Progress bar toward next tier ─────────────────────────────
function TierProgress({ total, tier }: { total: number; tier: Tier }) {
  if (!tier.nextAt) return null;
  const from = tier.pct === 10 ? 0 : 50;
  const progress = Math.min(((total - from) / (tier.nextAt - from)) * 100, 100);
  const remaining = tier.nextAt - total;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8a93a2", marginBottom: 3 }}>
        <span>{tier.nextPct}% a partir de {tier.nextAt} indicados</span>
        <span>faltam {remaining}</span>
      </div>
      <div style={{ height: 5, backgroundColor: "#e8eaed", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, backgroundColor: tier.color, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

// ── Referral code editor ──────────────────────────────────────
function CodeEditor({
  repId,
  currentCode,
  onSaved,
}: {
  repId: string;
  currentCode: string | null;
  onSaved: (repId: string, newCode: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(currentCode ?? "");
    setError(null);
    setSuccess(false);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
    setError(null);
  };

  const save = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const trimmed = value.trim().toUpperCase();
    const err = validateCode(trimmed);
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ referral_code: trimmed })
      .eq("id", repId);
    setSaving(false);
    if (dbErr) {
      if (dbErr.code === "23505") {
        setError("Esse código já está em uso. Escolha outro.");
      } else {
        setError(dbErr.message);
      }
      return;
    }
    setSuccess(true);
    setEditing(false);
    onSaved(repId, trimmed);
    setTimeout(() => setSuccess(false), 2500);
  };

  if (editing) {
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value.toUpperCase()); setError(null); }}
          placeholder="Ex: JOAO2024"
          maxLength={20}
          style={{
            padding: "5px 9px", border: `1px solid ${error ? "#fca5a5" : "#e8eaed"}`, borderRadius: 6,
            fontSize: 12, fontFamily: "monospace", outline: "none", width: 130,
            backgroundColor: error ? "#fef2f2" : "#fff",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { void save(e as unknown as React.MouseEvent); }
            if (e.key === "Escape") { setEditing(false); }
          }}
        />
        <button
          onClick={(e) => { void save(e); }}
          disabled={saving}
          style={{ padding: "5px 10px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
        >{saving ? "..." : "Salvar"}</button>
        <button
          onClick={cancel}
          style={{ padding: "5px 8px", backgroundColor: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
        >✕</button>
        {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {currentCode ? (
        <span style={{
          fontSize: 11, fontWeight: 800, backgroundColor: `${GOLD}20`, color: GOLD,
          padding: "2px 8px", borderRadius: 5, fontFamily: "monospace", letterSpacing: 0.5,
        }}>{currentCode}</span>
      ) : (
        <span style={{ fontSize: 11, color: "#aaa", fontStyle: "italic" }}>sem código</span>
      )}
      <button
        onClick={startEdit}
        title="Editar código de convite"
        style={{
          padding: "2px 7px", backgroundColor: "transparent", border: "1px solid #e8eaed",
          borderRadius: 5, fontSize: 11, color: "#6b7280", cursor: "pointer",
        }}
      >✏ editar</button>
      {success && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓ Salvo!</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
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

      const inviterIds = [...new Set(referidos.map((r) => r.invited_by_id as string))];

      const { data: inviters, error: err2 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, referral_code, plan, created_at")
        .in("id", inviterIds);

      if (err2) throw err2;

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

      result.sort((a, b) => b.referidos.length - a.referidos.length);
      setRepresentantes(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar indicações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Update referral code locally after save
  const handleCodeSaved = (repId: string, newCode: string) => {
    setRepresentantes((prev) =>
      prev.map((r) => r.id === repId ? { ...r, referral_code: newCode } : r)
    );
  };

  // ── Derived stats ─────────────────────────────────────────
  const totalIndicados = representantes.reduce((s, r) => s + r.referidos.length, 0);
  const totalAtivos    = representantes.reduce((s, r) => s + r.referidos.filter(isPlanActive).length, 0);
  const totalPagantes  = representantes.reduce(
    (s, r) => s + r.referidos.filter((f) => f.plan !== "gratuito" && f.plan !== "free" && !!f.plan).length, 0
  );

  // ── Filter ────────────────────────────────────────────────
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
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>CRM de Indicações</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Representantes · Códigos de convite · Comissões</p>
          </div>
          <button
            onClick={() => { void load(); }}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >↻ Atualizar</button>
        </div>

        {/* Commission tier legend */}
        <div style={{
          backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12,
          padding: "14px 18px", marginBottom: 20,
          display: "flex", gap: 0, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginRight: 16, display: "flex", alignItems: "center" }}>
            Tabela de comissões:
          </div>
          {[
            { range: "0 – 49 indicados",   pct: "10%", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
            { range: "50 – 199 indicados",  pct: "15%", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
            { range: "200+ indicados",      pct: "20%", color: WINE,      bg: "#f9f0f1", border: "#e4b5ba" },
          ].map((t) => (
            <div key={t.pct} style={{
              display: "flex", alignItems: "center", gap: 8, marginRight: 20, marginTop: 2,
            }}>
              <span style={{
                fontSize: 13, fontWeight: 900, color: t.color,
                backgroundColor: t.bg, border: `1px solid ${t.border}`,
                padding: "3px 10px", borderRadius: 6,
              }}>{t.pct}</span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{t.range}</span>
            </div>
          ))}
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Representantes", value: representantes.length, icon: "👤", color: NAVY },
            { label: "Total Indicados",  value: totalIndicados,         icon: "🔗", color: "#1d4ed8" },
            { label: "Plano Ativo",      value: totalAtivos,            icon: "✅", color: "#16a34a" },
            { label: "Plano Pago",       value: totalPagantes,          icon: "💳", color: GOLD },
          ].map((c) => (
            <div key={c.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
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
            >{v === "all" ? "Todos" : v === "paid" ? "Com ativos" : "Sem ativos"}</button>
          ))}
        </div>

        {/* List */}
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
              const isOpen   = expanded === rep.id;
              const total    = rep.referidos.length;
              const ativos   = rep.referidos.filter(isPlanActive).length;
              const pagantes = rep.referidos.filter((f) => f.plan !== "gratuito" && f.plan !== "free" && !!f.plan).length;
              const convRate = total > 0 ? Math.round((pagantes / total) * 100) : 0;
              const tier     = getTier(total);

              return (
                <div key={rep.id}>
                  {/* ── Representante row ── */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : rep.id)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px",
                      cursor: "pointer",
                      borderBottom: !isOpen && idx < filtered.length - 1 ? "1px solid #e8eaed" : "none",
                      backgroundColor: isOpen ? `${GOLD}08` : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <Avatar name={rep.full_name} email={rep.email} size={42} />

                    {/* Info + code editor */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
                        {rep.full_name ?? rep.username ?? "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#8a93a2", marginBottom: 6 }}>
                        {rep.email ?? `@${rep.username ?? "—"}`}
                      </div>
                      {/* Code editor — stop propagation so click doesn't toggle expand */}
                      <CodeEditor
                        repId={rep.id}
                        currentCode={rep.referral_code}
                        onSaved={handleCodeSaved}
                      />

                      {/* Commission tier badge + progress */}
                      <div style={{ marginTop: 8 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 900,
                          color: tier.color, backgroundColor: tier.bg,
                          border: `1px solid ${tier.border}`,
                          padding: "3px 10px", borderRadius: 6,
                        }}>
                          {tier.label} comissão
                        </span>
                        {tier.pct < 20 && (
                          <TierProgress total={total} tier={tier} />
                        )}
                      </div>
                    </div>

                    {/* Stats chips */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
                      {[
                        { value: total,    label: "indicados", color: NAVY },
                        { value: ativos,   label: "ativos",    color: "#16a34a" },
                        { value: `${convRate}%`, label: "conversão", color: GOLD },
                      ].map((s) => (
                        <div key={s.label} style={{ textAlign: "center", minWidth: 46 }}>
                          <div style={{ fontSize: 17, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>{s.label}</div>
                        </div>
                      ))}
                      <span style={{ color: "#aaa", fontSize: 18, marginLeft: 2 }}>{isOpen ? "▾" : "›"}</span>
                    </div>
                  </div>

                  {/* ── Expanded panel ── */}
                  {isOpen && (
                    <div style={{
                      borderBottom: idx < filtered.length - 1 ? "1px solid #e8eaed" : "none",
                      backgroundColor: "#fafbfc",
                    }}>
                      {/* Summary bar */}
                      <div style={{
                        display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center",
                        padding: "12px 20px", borderBottom: "1px solid #e8eaed",
                        backgroundColor: `${NAVY}05`,
                      }}>
                        {[
                          { label: "Total indicados",  value: total,          color: NAVY },
                          { label: "Com plano ativo",  value: ativos,         color: "#16a34a" },
                          { label: "Plano pago",       value: pagantes,       color: GOLD },
                          { label: "Taxa de conversão",value: `${convRate}%`, color: convRate >= 50 ? "#16a34a" : convRate >= 20 ? GOLD : "#6b7280" },
                          { label: "Comissão atual",   value: `${tier.pct}%`, color: tier.color },
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
                        <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>Nenhum indicado ainda.</div>
                      ) : (
                        rep.referidos.map((ref, i) => {
                          const badge  = statusBadge(ref);
                          const isPaid = ref.plan !== "gratuito" && ref.plan !== "free" && !!ref.plan;
                          return (
                            <div key={ref.id} style={{
                              display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr",
                              padding: "11px 20px", alignItems: "center",
                              borderBottom: i < rep.referidos.length - 1 ? "1px solid #f0f2f4" : "none",
                              backgroundColor: "#fff",
                            }}>
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

                              <div>
                                <span style={{
                                  fontSize: 12, fontWeight: 700,
                                  color: isPaid ? planColor(ref.plan) : "#6b7280",
                                  backgroundColor: isPaid ? `${planColor(ref.plan)}15` : "#f3f4f6",
                                  padding: "3px 8px", borderRadius: 5,
                                }}>{planLabel(ref.plan)}</span>
                              </div>

                              <div>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, color: badge.color,
                                  backgroundColor: badge.bg, border: `1px solid ${badge.border}`,
                                  padding: "2px 7px", borderRadius: 5,
                                }}>{badge.label}</span>
                              </div>

                              <div style={{ fontSize: 12, color: "#555" }}>{planExpiry(ref)}</div>

                              <div style={{ fontSize: 12, color: "#8a93a2" }}>{fmt(ref.created_at)}</div>
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
