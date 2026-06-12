import React, { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const WINE = "#722f37";

// ── Country list + fast lookup ────────────────────────────────
const ADMIN_COUNTRIES = [
  { flag: "🇧🇷", name: "Brasil",         code: "BR" },
  { flag: "🇺🇸", name: "Estados Unidos", code: "US" },
  { flag: "🇵🇹", name: "Portugal",       code: "PT" },
  { flag: "🇦🇷", name: "Argentina",      code: "AR" },
  { flag: "🇨🇱", name: "Chile",          code: "CL" },
  { flag: "🇺🇾", name: "Uruguai",        code: "UY" },
  { flag: "🇵🇾", name: "Paraguai",       code: "PY" },
  { flag: "🇧🇴", name: "Bolívia",        code: "BO" },
  { flag: "🇵🇪", name: "Peru",           code: "PE" },
  { flag: "🇨🇴", name: "Colômbia",       code: "CO" },
  { flag: "🇲🇽", name: "México",         code: "MX" },
  { flag: "🇪🇸", name: "Espanha",        code: "ES" },
  { flag: "🇫🇷", name: "França",         code: "FR" },
  { flag: "🇮🇹", name: "Itália",         code: "IT" },
  { flag: "🇩🇪", name: "Alemanha",       code: "DE" },
  { flag: "🇬🇧", name: "Reino Unido",    code: "GB" },
  { flag: "🇨🇳", name: "China",          code: "CN" },
  { flag: "🇯🇵", name: "Japão",          code: "JP" },
  { flag: "🇦🇺", name: "Austrália",      code: "AU" },
  { flag: "🇿🇦", name: "África do Sul",  code: "ZA" },
];
const COUNTRY_MAP = new Map(ADMIN_COUNTRIES.map(c => [c.code, c]));

// ── Commission tiers ──────────────────────────────────────────
interface Tier { pct: number; color: string; bg: string; border: string; nextAt?: number; nextPct?: number; }
function getTier(total: number): Tier {
  if (total >= 200) return { pct: 20, color: WINE,     bg: "#f9f0f1", border: "#e4b5ba" };
  if (total >= 50)  return { pct: 15, color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", nextAt: 200, nextPct: 20 };
                    return { pct: 10, color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", nextAt: 50,  nextPct: 15 };
}
function effectivePct(total: number, override: number | null) { return override !== null ? override : getTier(total).pct; }

// ── Types ─────────────────────────────────────────────────────
interface Referido {
  id: string; full_name: string | null; email: string | null; username: string | null;
  plan: string; stripe_subscription_status: string | null;
  stripe_current_period_end: string | null; courtesy_until: string | null; created_at: string;
  // Cross-ref (filled in RepresentantesTab)
  country_code?: string | null;
  country_flag?: string | null;
  country_name?: string | null;
  socio_name?: string | null;
  socio_gross_pct?: number | null;
  socio_net_pct?: number | null;
}
interface Representante {
  id: string; full_name: string | null; email: string | null; username: string | null;
  referral_code: string | null; commission_override: number | null; plan: string; created_at: string;
  referidos: Referido[];
}
interface TerritoryUser extends Referido {
  invited_by_id: string | null;
  // Cross-ref (filled in ParceirosTab)
  rep_id?: string | null;
  rep_name?: string | null;
  rep_pct?: number | null;
}
interface Territory {
  id: string; partner_id: string; country_code: string; country_name: string;
  country_flag: string | null; notes: string | null; created_at: string;
  commission_pct: number | null;        // partner_territories.commission_pct (sócio's rate)
  partner_name: string | null; partner_email: string | null;
  partner_username: string | null; partner_referral_code: string | null;
  users: TerritoryUser[];
}
interface CommissionRecord {
  user_id: string; user_name: string | null; user_email: string | null; user_plan: string;
  is_active: boolean; created_at: string;
  country_code: string | null; country_flag: string | null; country_name: string | null;
  socio_id: string | null; socio_name: string | null;
  socio_gross_pct: number | null; socio_net_pct: number | null;
  rep_id: string | null; rep_name: string | null; rep_pct: number | null;
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}
function planLabel(plan: string): string {
  const m: Record<string, string> = { gratuito:"Gratuito", free:"Gratuito", premium:"Premium", profissional:"Premium", exclusive:"Exclusivo", exclusivo:"Exclusivo", business:"Business", empresa:"Business", empresas:"Business" };
  return m[plan?.toLowerCase()] ?? plan ?? "—";
}
function planColor(plan: string): string {
  const p = plan?.toLowerCase();
  if (p === "gratuito" || p === "free") return "#6b7280";
  if (p === "premium" || p === "profissional") return "#1d4ed8";
  if (p === "exclusive" || p === "exclusivo") return "#7c3aed";
  if (p === "business" || p === "empresa" || p === "empresas") return WINE;
  return "#6b7280";
}
function isPlanActive(r: { plan: string; stripe_subscription_status: string | null; courtesy_until: string | null }): boolean {
  return r.stripe_subscription_status === "active" || r.stripe_subscription_status === "trialing" ||
    (!!r.courtesy_until && new Date(r.courtesy_until) > new Date());
}
function planExpiry(r: Referido): string {
  if (r.courtesy_until && new Date(r.courtesy_until) > new Date()) return fmt(r.courtesy_until);
  if (r.stripe_current_period_end) return fmt(r.stripe_current_period_end);
  return "—";
}
function statusBadge(r: { plan: string; stripe_subscription_status: string | null; courtesy_until: string | null }) {
  const active = isPlanActive(r);
  const isPaid = r.plan !== "gratuito" && r.plan !== "free" && !!r.plan;
  if (active && isPaid)  return { label: "Ativo",    bg: "#dcfce7", color: "#16a34a", border: "#86efac" };
  if (isPaid && !active) return { label: "Expirado", bg: "#fef9c3", color: "#92400e", border: "#fde68a" };
                         return { label: "Gratuito", bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
}
function Avatar({ name, email, size = 36 }: { name: string | null; email: string | null; size?: number }) {
  const ch = ((name ?? email ?? "?")[0]).toUpperCase();
  return <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: size * 0.38, fontWeight: 800 }}>{ch}</div>;
}
function validateCode(code: string): string | null {
  if (!code.trim()) return "Código não pode ser vazio.";
  if (code.length < 4) return "Mínimo 4 caracteres.";
  if (code.length > 20) return "Máximo 20 caracteres.";
  if (!/^[A-Za-z0-9-]+$/.test(code)) return "Use apenas letras, números e hífens.";
  return null;
}

// ── Commission pill ───────────────────────────────────────────
function PctPill({ pct, label, color, bg, border }: { pct: number; label?: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 900, color, backgroundColor: bg, border: `1px solid ${border}`, padding: "2px 8px", borderRadius: 5, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {pct}%{label && <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7 }}>{label}</span>}
    </span>
  );
}
function CommissionBadge({ pct, isManual }: { pct: number; isManual: boolean }) {
  const color  = isManual ? GOLD : (pct >= 20 ? WINE : pct >= 15 ? "#7c3aed" : "#1d4ed8");
  const bg     = isManual ? `${GOLD}18` : (pct >= 20 ? "#f9f0f1" : pct >= 15 ? "#f5f3ff" : "#eff6ff");
  const border = isManual ? `${GOLD}60` : (pct >= 20 ? "#e4b5ba" : pct >= 15 ? "#c4b5fd" : "#bfdbfe");
  return (
    <span style={{ fontSize: 12, fontWeight: 900, color, backgroundColor: bg, border: `1px solid ${border}`, padding: "3px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 5 }}>
      {pct}% comissão
      {isManual && <span style={{ fontSize: 9, fontWeight: 700, backgroundColor: GOLD, color: "#fff", padding: "1px 5px", borderRadius: 3 }}>MANUAL</span>}
    </span>
  );
}

// ── Tier progress ─────────────────────────────────────────────
function TierProgress({ total, tier }: { total: number; tier: Tier }) {
  if (!tier.nextAt) return null;
  const from = tier.pct === 10 ? 0 : 50;
  const progress = Math.min(((total - from) / (tier.nextAt - from)) * 100, 100);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8a93a2", marginBottom: 3 }}>
        <span>{tier.nextPct}% a partir de {tier.nextAt} indicados</span>
        <span>faltam {tier.nextAt - total}</span>
      </div>
      <div style={{ height: 5, backgroundColor: "#e8eaed", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, backgroundColor: tier.color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ── Code editor ───────────────────────────────────────────────
function CodeEditor({ repId, currentCode, onSaved }: { repId: string; currentCode: string | null; onSaved: (id: string, code: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => { e.stopPropagation(); setValue(currentCode ?? ""); setError(null); setOk(false); setEditing(true); setTimeout(() => ref.current?.focus(), 50); };
  const cancel = (e: React.MouseEvent) => { e.stopPropagation(); setEditing(false); setError(null); };
  const save = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const t = value.trim().toUpperCase();
    const err = validateCode(t); if (err) { setError(err); return; }
    setSaving(true); setError(null);
    const { error: dbErr } = await supabase.from("profiles").update({ referral_code: t }).eq("id", repId);
    setSaving(false);
    if (dbErr) { setError(dbErr.code === "23505" ? "Código já em uso." : dbErr.message); return; }
    setOk(true); setEditing(false); onSaved(repId, t); setTimeout(() => setOk(false), 2500);
  };
  if (editing) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
      <input ref={ref} value={value} onChange={e => { setValue(e.target.value.toUpperCase()); setError(null); }} placeholder="Ex: JOAO2024" maxLength={20}
        style={{ padding: "5px 9px", border: `1px solid ${error ? "#fca5a5" : "#e8eaed"}`, borderRadius: 6, fontSize: 12, fontFamily: "monospace", outline: "none", width: 130, backgroundColor: error ? "#fef2f2" : "#fff" }}
        onKeyDown={e => { if (e.key === "Enter") void save(e); if (e.key === "Escape") setEditing(false); }} />
      <button onClick={e => { void save(e); }} disabled={saving} style={{ padding: "5px 10px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "..." : "Salvar"}</button>
      <button onClick={cancel} style={{ padding: "5px 8px", backgroundColor: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
      {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {currentCode ? <span style={{ fontSize: 11, fontWeight: 800, backgroundColor: `${GOLD}20`, color: GOLD, padding: "2px 8px", borderRadius: 5, fontFamily: "monospace" }}>{currentCode}</span>
        : <span style={{ fontSize: 11, color: "#aaa", fontStyle: "italic" }}>sem código</span>}
      <button onClick={startEdit} style={{ padding: "2px 7px", backgroundColor: "transparent", border: "1px solid #e8eaed", borderRadius: 5, fontSize: 11, color: "#6b7280", cursor: "pointer" }}>✏ editar</button>
      {ok && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓ Salvo!</span>}
    </div>
  );
}

// ── Commission editor ─────────────────────────────────────────
function CommissionEditor({ repId, currentOverride, tierPct, onSaved }: { repId: string; currentOverride: number | null; tierPct: number; onSaved: (id: string, v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentOverride !== null ? String(currentOverride) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => { e.stopPropagation(); setValue(currentOverride !== null ? String(currentOverride) : ""); setError(null); setOk(false); setEditing(true); setTimeout(() => ref.current?.focus(), 50); };
  const cancel = (e: React.MouseEvent) => { e.stopPropagation(); setEditing(false); setError(null); };
  const save = async (e: React.MouseEvent | React.KeyboardEvent, clear = false) => {
    e.stopPropagation();
    let newVal: number | null = null;
    if (!clear) { const p = parseFloat(String(value).replace(",", ".")); if (isNaN(p) || p < 0 || p > 100) { setError("Valor entre 0 e 100."); return; } newVal = Math.round(p * 100) / 100; }
    setSaving(true); setError(null);
    const { error: dbErr } = await supabase.from("profiles").update({ commission_override: newVal }).eq("id", repId);
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    setOk(true); setEditing(false); onSaved(repId, newVal); setTimeout(() => setOk(false), 2500);
  };
  if (editing) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${error ? "#fca5a5" : "#e8eaed"}`, borderRadius: 6, overflow: "hidden", backgroundColor: error ? "#fef2f2" : "#fff" }}>
        <input ref={ref} type="number" min={0} max={100} step={0.5} value={value} onChange={e => { setValue(e.target.value); setError(null); }} placeholder={String(tierPct)}
          style={{ padding: "5px 6px", border: "none", fontSize: 13, fontWeight: 700, outline: "none", width: 60, backgroundColor: "transparent" }}
          onKeyDown={e => { if (e.key === "Enter") void save(e); if (e.key === "Escape") setEditing(false); }} />
        <span style={{ padding: "5px 8px 5px 0", fontSize: 13, fontWeight: 700, color: "#555" }}>%</span>
      </div>
      <button onClick={e => { void save(e); }} disabled={saving} style={{ padding: "5px 12px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "..." : "Salvar"}</button>
      {currentOverride !== null && <button onClick={e => { void save(e, true); }} disabled={saving} style={{ padding: "5px 10px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↺ Automático</button>}
      <button onClick={cancel} style={{ padding: "5px 8px", backgroundColor: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
      {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
    </div>
  );
  const isManual = currentOverride !== null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <CommissionBadge pct={isManual ? currentOverride! : tierPct} isManual={isManual} />
      <button onClick={startEdit} style={{ padding: "3px 8px", backgroundColor: "transparent", border: "1px solid #e8eaed", borderRadius: 5, fontSize: 11, color: "#6b7280", cursor: "pointer" }}>✏ alterar</button>
      {ok && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓ Salvo!</span>}
    </div>
  );
}

// ── Add Representante Modal ───────────────────────────────────
function AddRepresentanteModal({ open, onClose, existingIds, onAdded }: {
  open: boolean; onClose: () => void; existingIds: string[];
  onAdded: (rep: Representante) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string | null; email: string | null; username: string | null; referral_code: string | null }[]>([]);
  const [selected, setSelected] = useState<typeof results[0] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); setSelected(null); setError(null); }
    else { setTimeout(() => inputRef.current?.focus(), 80); }
  }, [open]);

  const search = async () => {
    const q = query.trim(); if (q.length < 2) return;
    setSearching(true);
    const { data } = await supabase.from("profiles").select("id, full_name, email, username, referral_code")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`).limit(10);
    setResults((data ?? []).filter(p => !existingIds.includes(p.id)));
    setSearching(false);
  };

  const genCode = (username: string | null): string => {
    const base = (username ?? "REP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${base}${suffix}`;
  };

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      let code = selected.referral_code;
      if (!code) {
        code = genCode(selected.username);
        for (let i = 0; i < 5; i++) {
          const { data: existing } = await supabase.from("profiles").select("id").eq("referral_code", code).maybeSingle();
          if (!existing) break;
          code = genCode(selected.username);
        }
        const { error: codeErr } = await supabase.from("profiles").update({ referral_code: code }).eq("id", selected.id);
        if (codeErr) throw codeErr;
      }
      await supabase.from("profiles").update({ commission_override: 10 }).eq("id", selected.id).is("commission_override", null);
      const { data: profile, error: fetchErr } = await supabase.from("profiles").select("id, full_name, email, username, referral_code, commission_override, plan, created_at").eq("id", selected.id).single();
      if (fetchErr) throw fetchErr;
      onAdded({ id: profile.id, full_name: profile.full_name, email: profile.email, username: profile.username, referral_code: profile.referral_code, commission_override: profile.commission_override ?? null, plan: profile.plan ?? "gratuito", created_at: profile.created_at, referidos: [] });
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ backgroundColor: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>Novo Representante</div><div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>Busque um perfil existente no IBHUB</div></div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: "#aaa" }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Buscar perfil</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 15 }}>🔍</span>
              <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }} onKeyDown={e => { if (e.key === "Enter") void search(); }}
                placeholder="Nome, email ou @username..."
                style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={() => { void search(); }} disabled={searching || query.trim().length < 2} style={{ padding: "10px 18px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: query.trim().length < 2 ? 0.5 : 1 }}>{searching ? "..." : "Buscar"}</button>
          </div>
        </div>
        {results.length > 0 && (
          <div style={{ border: "1px solid #e8eaed", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            {results.map((p, i) => {
              const isSel = selected?.id === p.id;
              return (
                <div key={p.id} onClick={() => setSelected(isSel ? null : p)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer", backgroundColor: isSel ? `${GOLD}12` : "#fff", borderBottom: i < results.length - 1 ? "1px solid #e8eaed" : "none" }}>
                  <Avatar name={p.full_name} email={p.email} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name ?? p.username ?? "—"}</div>
                    <div style={{ fontSize: 12, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
                  </div>
                  {p.referral_code && <span style={{ fontSize: 10, fontWeight: 800, backgroundColor: `${GOLD}20`, color: GOLD, padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0 }}>{p.referral_code}</span>}
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isSel ? GOLD : "#d1d5db"}`, backgroundColor: isSel ? GOLD : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSel && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {selected && (
          <div style={{ padding: "10px 14px", backgroundColor: `${NAVY}06`, border: `1px solid ${NAVY}20`, borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={selected.full_name} email={selected.email} size={30} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{selected.full_name ?? selected.username}</div><div style={{ fontSize: 11, color: "#8a93a2" }}>{selected.email}</div></div>
            <div style={{ fontSize: 11, color: "#8a93a2", textAlign: "right" }}>
              {selected.referral_code ? <span>Código: <span style={{ fontFamily: "monospace", fontWeight: 700, color: GOLD }}>{selected.referral_code}</span></span> : <span style={{ color: "#f59e0b" }}>⚡ Código será gerado</span>}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11, color: "#8a93a2", marginBottom: 16, padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: 8 }}>
          💡 O usuário receberá comissão de <strong>10%</strong> (tier base). Você pode ajustar depois na lista.
        </div>
        {error && <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", backgroundColor: "#f3f4f6", color: "#555", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { void handleAdd(); }} disabled={saving || !selected} style={{ padding: "10px 24px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: !selected ? 0.5 : 1 }}>
            {saving ? "Adicionando..." : "Designar Representante"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Territory Modal ───────────────────────────────────────
function AddTerritoryModal({ open, onClose, onAdded, takenCodes }: {
  open: boolean; onClose: () => void;
  onAdded: (t: Territory) => void; takenCodes: string[];
}) {
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerResults, setPartnerResults] = useState<{ id: string; full_name: string | null; email: string | null; username: string | null; commission_override: number | null }[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<typeof partnerResults[0] | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<typeof ADMIN_COUNTRIES[0] | null>(null);
  const [notes, setNotes] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!open) { setPartnerSearch(""); setPartnerResults([]); setSelectedPartner(null); setSelectedCountry(null); setNotes(""); setError(null); } }, [open]);

  const searchPartners = async () => {
    if (partnerSearch.trim().length < 2) return;
    setSearching(true);
    const q = partnerSearch.trim();
    const { data } = await supabase.from("profiles").select("id, full_name, email, username, commission_override")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`).limit(8);
    setPartnerResults(data ?? []);
    setSearching(false);
  };

  const handleAdd = async () => {
    if (!selectedPartner || !selectedCountry) { setError("Selecione um parceiro e um país."); return; }
    if (takenCodes.includes(selectedCountry.code)) { setError(`${selectedCountry.name} já tem um parceiro.`); return; }
    setSaving(true); setError(null);
    const row = { partner_id: selectedPartner.id, country_code: selectedCountry.code, country_name: selectedCountry.name, country_flag: selectedCountry.flag, notes: notes.trim() || null };
    const { data, error: dbErr } = await supabase.from("partner_territories").insert(row).select().single();
    setSaving(false);
    if (dbErr) { setError(dbErr.code === "23505" ? "Esse país já tem parceiro." : dbErr.message); return; }
    onAdded({ ...data, commission_pct: null, partner_name: selectedPartner.full_name, partner_email: selectedPartner.email, partner_username: selectedPartner.username, partner_referral_code: null, users: [] });
    onClose();
  };

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ backgroundColor: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>Novo Parceiro Internacional</div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: "#aaa" }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Parceiro (usuário existente)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={partnerSearch} onChange={e => setPartnerSearch(e.target.value)} placeholder="Buscar por nome ou email..."
              style={{ flex: 1, padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none" }}
              onKeyDown={e => { if (e.key === "Enter") void searchPartners(); }} />
            <button onClick={() => { void searchPartners(); }} disabled={searching} style={{ padding: "9px 16px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{searching ? "..." : "Buscar"}</button>
          </div>
          {partnerResults.length > 0 && (
            <div style={{ border: "1px solid #e8eaed", borderRadius: 8, marginTop: 6, overflow: "hidden" }}>
              {partnerResults.map((p, i) => (
                <div key={p.id} onClick={() => { setSelectedPartner(p); setPartnerResults([]); setPartnerSearch(p.full_name ?? p.email ?? p.username ?? ""); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", backgroundColor: selectedPartner?.id === p.id ? `${GOLD}10` : "#fff", borderBottom: i < partnerResults.length - 1 ? "1px solid #e8eaed" : "none" }}>
                  <Avatar name={p.full_name} email={p.email} size={30} />
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{p.full_name ?? p.username ?? "—"}</div><div style={{ fontSize: 11, color: "#8a93a2" }}>{p.email}</div></div>
                  {selectedPartner?.id === p.id && <span style={{ marginLeft: "auto", color: "#16a34a", fontWeight: 700 }}>✓</span>}
                </div>
              ))}
            </div>
          )}
          {selectedPartner && (
            <div style={{ marginTop: 8, padding: "8px 12px", backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}40`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={selectedPartner.full_name} email={selectedPartner.email} size={26} />
              <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{selectedPartner.full_name ?? selectedPartner.username}</span>
              <span style={{ fontSize: 11, color: "#8a93a2" }}>{selectedPartner.email}</span>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Território (país)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6, maxHeight: 220, overflowY: "auto", border: "1px solid #e8eaed", borderRadius: 8, padding: 8 }}>
            {ADMIN_COUNTRIES.map(c => {
              const taken = takenCodes.includes(c.code);
              const sel = selectedCountry?.code === c.code;
              return (
                <button key={c.code} onClick={() => !taken && setSelectedCountry(c)} disabled={taken}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", border: `1px solid ${sel ? GOLD : "#e8eaed"}`, borderRadius: 7, cursor: taken ? "not-allowed" : "pointer", backgroundColor: sel ? `${GOLD}15` : taken ? "#f9fafb" : "#fff", opacity: taken ? 0.5 : 1 }}>
                  <span style={{ fontSize: 18 }}>{c.flag}</span>
                  <span style={{ fontSize: 12, fontWeight: sel ? 700 : 400, color: taken ? "#aaa" : NAVY }}>{c.name}</span>
                  {taken && <span style={{ fontSize: 9, color: "#aaa", marginLeft: "auto" }}>ocupado</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Observações <span style={{ color: "#aaa", fontWeight: 400 }}>(opcional)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Acordo assinado em jan/2025..."
            style={{ width: "100%", padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", minHeight: 60, boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
        {error && <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", backgroundColor: "#f3f4f6", color: "#555", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { void handleAdd(); }} disabled={saving || !selectedPartner || !selectedCountry}
            style={{ padding: "10px 24px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: (!selectedPartner || !selectedCountry) ? 0.5 : 1 }}>
            {saving ? "Salvando..." : "Atribuir Território"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Territory Commission editor ───────────────────────────────
function TerritoryCommissionEditor({ territoryId, currentPct, tierPct, onSaved }: {
  territoryId: string; currentPct: number | null; tierPct: number;
  onSaved: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentPct !== null ? String(currentPct) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => { e.stopPropagation(); setValue(currentPct !== null ? String(currentPct) : ""); setError(null); setOk(false); setEditing(true); setTimeout(() => ref.current?.focus(), 50); };
  const cancel    = (e: React.MouseEvent) => { e.stopPropagation(); setEditing(false); setError(null); };
  const save = async (e: React.MouseEvent | React.KeyboardEvent, clear = false) => {
    e.stopPropagation();
    let newVal: number | null = null;
    if (!clear) { const p = parseFloat(String(value).replace(",", ".")); if (isNaN(p) || p < 0 || p > 100) { setError("Valor entre 0 e 100."); return; } newVal = Math.round(p * 100) / 100; }
    setSaving(true); setError(null);
    const { error: dbErr } = await supabase.from("partner_territories").update({ commission_pct: newVal }).eq("id", territoryId);
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    setOk(true); setEditing(false); onSaved(newVal); setTimeout(() => setOk(false), 2500);
  };

  if (editing) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${error ? "#fca5a5" : "#e8eaed"}`, borderRadius: 6, overflow: "hidden", backgroundColor: error ? "#fef2f2" : "#fff" }}>
        <input ref={ref} type="number" min={0} max={100} step={0.5} value={value} onChange={e => { setValue(e.target.value); setError(null); }} placeholder={String(tierPct)}
          style={{ padding: "5px 6px", border: "none", fontSize: 13, fontWeight: 700, outline: "none", width: 60, backgroundColor: "transparent" }}
          onKeyDown={e => { if (e.key === "Enter") void save(e); if (e.key === "Escape") setEditing(false); }} />
        <span style={{ padding: "5px 8px 5px 0", fontSize: 13, fontWeight: 700, color: "#555" }}>%</span>
      </div>
      <button onClick={e => { void save(e); }} disabled={saving} style={{ padding: "5px 12px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{saving ? "..." : "Salvar"}</button>
      {currentPct !== null && <button onClick={e => { void save(e, true); }} disabled={saving} style={{ padding: "5px 10px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↺ Automático</button>}
      <button onClick={cancel} style={{ padding: "5px 8px", backgroundColor: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
      {error && <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>}
    </div>
  );

  const isManual = currentPct !== null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <CommissionBadge pct={isManual ? currentPct! : tierPct} isManual={isManual} />
      <button onClick={startEdit} style={{ padding: "3px 8px", backgroundColor: "transparent", border: "1px solid #e8eaed", borderRadius: 5, fontSize: 11, color: "#6b7280", cursor: "pointer" }}>✏ alterar</button>
      {ok && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓ Salvo!</span>}
    </div>
  );
}

// ── Commission split display ──────────────────────────────────
function CommissionSplit({ grossPct, repPct }: { grossPct: number; repPct: number | null }) {
  const netPct = repPct !== null ? Math.max(0, grossPct - repPct) : grossPct;
  if (repPct === null) {
    return <PctPill pct={grossPct} label="bruto" color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      <PctPill pct={grossPct} label="bruto" color="#6b7280" bg="#f3f4f6" border="#e5e7eb" />
      <span style={{ fontSize: 10, color: "#aaa" }}>−</span>
      <PctPill pct={repPct} label="rep" color="#7c3aed" bg="#f5f3ff" border="#c4b5fd" />
      <span style={{ fontSize: 10, color: "#aaa" }}>=</span>
      <PctPill pct={netPct} label="líq." color={netPct > 0 ? "#16a34a" : "#dc2626"} bg={netPct > 0 ? "#dcfce7" : "#fef2f2"} border={netPct > 0 ? "#86efac" : "#fca5a5"} />
    </div>
  );
}

// ── Parceiros Tab ─────────────────────────────────────────────
function ParceirosTab() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const { data: terrs, error: err1 } = await supabase
        .from("partner_territories")
        .select("id, partner_id, country_code, country_name, country_flag, notes, created_at, commission_pct")
        .order("created_at", { ascending: false });
      if (err1) throw err1;
      if (!terrs || terrs.length === 0) { setTerritories([]); setLoading(false); return; }

      const partnerIds = [...new Set(terrs.map(t => t.partner_id as string))];
      const [{ data: partners }, ...userResults] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, username, referral_code, commission_override").in("id", partnerIds),
        ...terrs.map(t =>
          supabase.from("profiles")
            .select("id, full_name, email, username, plan, stripe_subscription_status, stripe_current_period_end, courtesy_until, created_at, invited_by_id")
            .eq("country", t.country_code).order("created_at", { ascending: false })
        ),
      ]);

      const partnerMap = new Map((partners ?? []).map(p => [p.id, p]));

      // Collect all invited_by_ids across all territories to batch-fetch rep info
      const allUsers = userResults.flatMap(r => r.data ?? []);
      const inviterIds = [...new Set(allUsers.filter(u => u.invited_by_id).map(u => u.invited_by_id as string))];

      let repMap = new Map<string, { full_name: string | null; commission_override: number | null; referidos_count: number }>();
      if (inviterIds.length > 0) {
        const { data: reps } = await supabase.from("profiles")
          .select("id, full_name, commission_override")
          .in("id", inviterIds)
          .not("commission_override", "is", null);
        // Also get referido counts for each rep (for tier calculation)
        const counts = await Promise.all(
          (reps ?? []).map(r => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("invited_by_id", r.id))
        );
        (reps ?? []).forEach((r, i) => {
          repMap.set(r.id, { full_name: r.full_name, commission_override: r.commission_override ?? null, referidos_count: counts[i]?.count ?? 0 });
        });
      }

      const result: Territory[] = terrs.map((t, idx) => {
        const p = partnerMap.get(t.partner_id);
        const rawUsers = userResults[idx]?.data ?? [];
        const users: TerritoryUser[] = rawUsers.map(u => {
          const rep = u.invited_by_id ? repMap.get(u.invited_by_id) ?? null : null;
          const rep_pct = rep ? effectivePct(rep.referidos_count, rep.commission_override) : null;
          return {
            id: u.id, full_name: u.full_name, email: u.email, username: u.username,
            plan: u.plan ?? "gratuito", stripe_subscription_status: u.stripe_subscription_status,
            stripe_current_period_end: u.stripe_current_period_end, courtesy_until: u.courtesy_until,
            created_at: u.created_at, invited_by_id: u.invited_by_id,
            rep_id: rep ? u.invited_by_id : null,
            rep_name: rep?.full_name ?? null,
            rep_pct,
          };
        });
        return {
          ...t, commission_pct: (t as { commission_pct?: number | null }).commission_pct ?? null,
          partner_name: p?.full_name ?? null, partner_email: p?.email ?? null,
          partner_username: p?.username ?? null, partner_referral_code: p?.referral_code ?? null,
          users,
        };
      });

      setTerritories(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar parceiros"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleRemove = async (id: string, countryName: string) => {
    if (!confirm(`Remover o território "${countryName}"?`)) return;
    setRemovingId(id);
    await supabase.from("partner_territories").delete().eq("id", id);
    setTerritories(prev => prev.filter(t => t.id !== id));
    if (expanded === id) setExpanded(null);
    setRemovingId(null);
  };

  const takenCodes = territories.map(t => t.country_code);
  const totalUsers = territories.reduce((s, t) => s + t.users.length, 0);
  const totalAtivos = territories.reduce((s, t) => s + t.users.filter(isPlanActive).length, 0);
  const totalWithRep = territories.reduce((s, t) => s + t.users.filter(u => u.rep_id).length, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Territórios",     value: territories.length, icon: "🌍", color: NAVY },
          { label: "Usuários no ext.", value: totalUsers,          icon: "👥", color: "#1d4ed8" },
          { label: "Plano Ativo",      value: totalAtivos,         icon: "✅", color: "#16a34a" },
          { label: "Com Representante",value: totalWithRep,        icon: "🔗", color: "#7c3aed" },
        ].map(c => (
          <div key={c.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color, lineHeight: 1 }}>{loading ? "…" : c.value}</div>
            <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
        <div style={{ backgroundColor: "#fff", border: `2px dashed ${GOLD}60`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 6 }} onClick={() => setShowAdd(true)}>
          <div style={{ fontSize: 24 }}>＋</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>Novo Parceiro</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div><p style={{ color: "#aaa" }}>Carregando...</p></div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
          <p style={{ color: "#dc2626" }}>{error}</p>
          <button onClick={() => { void load(); }} style={{ marginTop: 12, padding: "8px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Tentar novamente</button>
        </div>
      ) : territories.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌍</div>
          <p style={{ color: "#555", fontWeight: 600 }}>Nenhum parceiro internacional cadastrado</p>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: "10px 28px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>+ Novo Parceiro</button>
        </div>
      ) : (
        <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
          {territories.map((t, idx) => {
            const isOpen   = expanded === t.id;
            const ativos   = t.users.filter(isPlanActive).length;
            const pagantes = t.users.filter(u => u.plan !== "gratuito" && u.plan !== "free" && !!u.plan).length;
            const convRate = t.users.length > 0 ? Math.round((pagantes / t.users.length) * 100) : 0;
            const tier     = getTier(t.users.length);
            const effPct   = effectivePct(t.users.length, t.commission_pct);
            const isManual = t.commission_pct !== null;
            const comRep   = t.users.filter(u => u.rep_id).length;

            return (
              <div key={t.id}>
                <div onClick={() => setExpanded(isOpen ? null : t.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px", cursor: "pointer", borderBottom: !isOpen && idx < territories.length - 1 ? "1px solid #e8eaed" : "none", backgroundColor: isOpen ? `${GOLD}08` : "transparent" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: `${NAVY}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
                    {t.country_flag ?? "🌍"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{t.country_name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", backgroundColor: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>{t.country_code}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#8a93a2", marginBottom: 6 }}>
                      Parceiro: <span style={{ fontWeight: 600, color: NAVY }}>{t.partner_name ?? t.partner_username ?? "—"}</span>
                      {t.partner_email && <span style={{ color: "#aaa" }}> · {t.partner_email}</span>}
                    </div>
                    <CommissionBadge pct={effPct} isManual={isManual} />
                    {t.notes && <div style={{ fontSize: 11, color: "#8a93a2", marginTop: 6, fontStyle: "italic" }}>"{t.notes}"</div>}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                    {[
                      { value: t.users.length, label: "usuários",  color: NAVY },
                      { value: ativos,          label: "ativos",   color: "#16a34a" },
                      { value: `${convRate}%`,  label: "conversão",color: GOLD },
                      { value: comRep,          label: "c/ rep",   color: "#7c3aed" },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "center", minWidth: 46 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                    <button onClick={e => { e.stopPropagation(); void handleRemove(t.id, t.country_name); }} disabled={removingId === t.id} title="Remover" style={{ padding: "4px 8px", backgroundColor: "transparent", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#dc2626" }}>{removingId === t.id ? "..." : "✕"}</button>
                    <span style={{ color: "#aaa", fontSize: 18 }}>{isOpen ? "▾" : "›"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderBottom: idx < territories.length - 1 ? "1px solid #e8eaed" : "none", backgroundColor: "#fafbfc" }}>
                    {/* Summary bar */}
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid #e8eaed", backgroundColor: `${NAVY}05`, alignItems: "center" }}>
                      {[
                        { label: "Total território", value: t.users.length, color: NAVY },
                        { label: "Ativos",            value: ativos,         color: "#16a34a" },
                        { label: "Pagantes",          value: pagantes,       color: GOLD },
                        { label: "Com rep. nacional", value: comRep,         color: "#7c3aed" },
                        { label: "Sem rep.",          value: t.users.length - comRep, color: "#6b7280" },
                      ].map(s => (
                        <div key={s.label} style={{ fontSize: 12 }}><span style={{ color: "#8a93a2" }}>{s.label}: </span><span style={{ fontWeight: 800, color: s.color }}>{s.value}</span></div>
                      ))}
                      <div style={{ marginLeft: "auto" }}>
                        <TerritoryCommissionEditor territoryId={t.id} currentPct={t.commission_pct} tierPct={tier.pct} onSaved={v => setTerritories(prev => prev.map(tr => tr.id === t.id ? { ...tr, commission_pct: v } : tr))} />
                      </div>
                    </div>

                    {/* Table header */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr", padding: "8px 20px", fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "1px solid #e8eaed" }}>
                      <span>Usuário</span><span>Comissão Sócio</span><span>Plano</span><span>Status</span><span>Representante</span><span>Cadastro</span>
                    </div>

                    {t.users.length === 0 ? (
                      <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>
                        Nenhum usuário com país "{t.country_code}" ainda.
                        <br /><span style={{ fontSize: 11 }}>Novos cadastros no app aparecerão aqui automaticamente.</span>
                      </div>
                    ) : t.users.map((u, i) => {
                      const badge = statusBadge(u);
                      const isPaid = u.plan !== "gratuito" && u.plan !== "free" && !!u.plan;
                      const socioNetPct = u.rep_pct !== null ? Math.max(0, effPct - u.rep_pct) : null;
                      return (
                        <div key={u.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr", padding: "11px 20px", alignItems: "center", borderBottom: i === t.users.length - 1 ? "none" : "1px solid #f0f2f4", backgroundColor: "#fff" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <Avatar name={u.full_name} email={u.email} size={28} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name ?? u.username ?? "—"}</div>
                              <div style={{ fontSize: 11, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email ?? `@${u.username ?? u.id?.slice(0, 8) ?? ""}`}</div>
                            </div>
                          </div>
                          <div>
                            {u.rep_pct !== null
                              ? <CommissionSplit grossPct={effPct} repPct={u.rep_pct} />
                              : <PctPill pct={effPct} label="íntegro" color="#16a34a" bg="#dcfce7" border="#86efac" />
                            }
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isPaid ? planColor(u.plan) : "#6b7280", backgroundColor: isPaid ? `${planColor(u.plan)}15` : "#f3f4f6", padding: "3px 8px", borderRadius: 5 }}>{planLabel(u.plan)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.border}`, padding: "2px 7px", borderRadius: 5 }}>{badge.label}</span>
                          <div style={{ fontSize: 12 }}>
                            {u.rep_name
                              ? <div>
                                  <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>🔗 {u.rep_name}</span>
                                  {u.rep_pct !== null && <div style={{ fontSize: 10, color: "#aaa" }}>−{u.rep_pct}% da comissão</div>}
                                </div>
                              : <span style={{ fontSize: 11, color: "#aaa" }}>—</span>
                            }
                          </div>
                          <span style={{ fontSize: 12, color: "#8a93a2" }}>{fmt(u.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddTerritoryModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={t => setTerritories(prev => [t, ...prev])} takenCodes={takenCodes} />
    </div>
  );
}

// ── Representantes Tab ────────────────────────────────────────
function RepresentantesTab() {
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterPlan, setFilterPlan] = useState<"all" | "paid" | "free">("all");
  const [showAdd, setShowAdd] = useState(false);
  // territory lookup: country_code → { partner_name, gross_pct }
  const [territoryIndex, setTerritoryIndex] = useState<Map<string, { partner_name: string | null; gross_pct: number; territory_count: number }>>(new Map());

  const load = async () => {
    setLoading(true); setError(null);
    try {
      // Load territories for cross-reference (commission_pct is the sócio's own rate)
      const { data: terrs } = await supabase.from("partner_territories")
        .select("country_code, partner_id, commission_pct");
      const terrPartnerIds = [...new Set((terrs ?? []).map(t => t.partner_id as string))];
      const { data: terrPartners } = terrPartnerIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", terrPartnerIds)
        : { data: [] };
      const terrPartnerMap = new Map((terrPartners ?? []).map(p => [p.id, p]));

      // User counts per territory for auto-tier (only needed when commission_pct is null)
      const terrCounts = new Map<string, number>();
      const terrsNeedingCount = (terrs ?? []).filter(t => t.commission_pct == null);
      if (terrsNeedingCount.length > 0) {
        const countResults = await Promise.all(
          terrsNeedingCount.map(t => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("country", t.country_code))
        );
        terrsNeedingCount.forEach((t, i) => { terrCounts.set(t.country_code, countResults[i]?.count ?? 0); });
      }

      const tIdx = new Map<string, { partner_name: string | null; gross_pct: number; territory_count: number }>();
      (terrs ?? []).forEach(t => {
        const p = terrPartnerMap.get(t.partner_id);
        const cnt = terrCounts.get(t.country_code) ?? 0;
        // Use territory's own commission_pct; fall back to auto-tier
        const gross_pct = t.commission_pct != null ? Number(t.commission_pct) : effectivePct(cnt, null);
        tIdx.set(t.country_code, {
          partner_name: p?.full_name ?? null,
          gross_pct,
          territory_count: cnt,
        });
      });
      setTerritoryIndex(tIdx);

      // Load referidos (invited users)
      const { data: referidos, error: err1 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, plan, stripe_subscription_status, stripe_current_period_end, courtesy_until, created_at, invited_by_id, country")
        .not("invited_by_id", "is", null);
      if (err1) throw err1;

      // Load designated representantes
      const { data: designated, error: err2 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, referral_code, commission_override, plan, created_at")
        .not("commission_override", "is", null);
      if (err2) throw err2;

      const map = new Map<string, Referido[]>();
      for (const r of (referidos ?? [])) {
        const iid = r.invited_by_id as string;
        if (!map.has(iid)) map.set(iid, []);
        const terr = r.country ? tIdx.get(r.country) ?? null : null;
        map.get(iid)!.push({
          id: r.id, full_name: r.full_name, email: r.email, username: r.username,
          plan: r.plan ?? "gratuito", stripe_subscription_status: r.stripe_subscription_status,
          stripe_current_period_end: r.stripe_current_period_end, courtesy_until: r.courtesy_until,
          created_at: r.created_at,
          country_code: r.country ?? null,
          country_flag: r.country ? (COUNTRY_MAP.get(r.country)?.flag ?? null) : null,
          country_name: r.country ? (COUNTRY_MAP.get(r.country)?.name ?? r.country) : null,
          socio_name: terr?.partner_name ?? null,
          socio_gross_pct: terr?.gross_pct ?? null,
        });
      }

      const allIds = new Set<string>([...map.keys(), ...(designated ?? []).map(d => d.id)]);
      if (allIds.size === 0) { setRepresentantes([]); setLoading(false); return; }

      const { data: repProfiles, error: err3 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, referral_code, commission_override, plan, created_at")
        .in("id", [...allIds]);
      if (err3) throw err3;

      const result: Representante[] = (repProfiles ?? []).map(inv => ({
        id: inv.id, full_name: inv.full_name, email: inv.email, username: inv.username,
        referral_code: inv.referral_code, commission_override: inv.commission_override ?? null,
        plan: inv.plan ?? "gratuito", created_at: inv.created_at,
        referidos: (map.get(inv.id) ?? []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }));
      result.sort((a, b) => b.referidos.length - a.referidos.length);
      setRepresentantes(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar indicações"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleCodeSaved = (id: string, code: string) => setRepresentantes(prev => prev.map(r => r.id === id ? { ...r, referral_code: code } : r));
  const handleCommissionSaved = (id: string, v: number | null) => setRepresentantes(prev => prev.map(r => r.id === id ? { ...r, commission_override: v } : r));

  const totalIndicados = representantes.reduce((s, r) => s + r.referidos.length, 0);
  const totalAtivos    = representantes.reduce((s, r) => s + r.referidos.filter(isPlanActive).length, 0);
  const totalPagantes  = representantes.reduce((s, r) => s + r.referidos.filter(f => f.plan !== "gratuito" && f.plan !== "free" && !!f.plan).length, 0);

  const filtered = representantes.filter(rep => {
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!(rep.full_name ?? "").toLowerCase().includes(s) && !(rep.email ?? "").toLowerCase().includes(s) && !(rep.username ?? "").toLowerCase().includes(s) && !(rep.referral_code ?? "").toLowerCase().includes(s)) return false;
    }
    if (filterPlan === "paid") return rep.referidos.some(isPlanActive);
    if (filterPlan === "free") return !rep.referidos.some(isPlanActive);
    return true;
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Representantes", value: representantes.length, icon: "👤", color: NAVY },
          { label: "Total Indicados",  value: totalIndicados, icon: "🔗", color: "#1d4ed8" },
          { label: "Plano Ativo",      value: totalAtivos,    icon: "✅", color: "#16a34a" },
          { label: "Plano Pago",       value: totalPagantes,  icon: "💳", color: GOLD },
        ].map(c => (
          <div key={c.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color, lineHeight: 1 }}>{loading ? "…" : c.value}</div>
            <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
        <div style={{ backgroundColor: "#fff", border: `2px dashed ${GOLD}60`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 6 }} onClick={() => setShowAdd(true)}>
          <div style={{ fontSize: 24 }}>＋</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>Novo Representante</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou código..."
            style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        {(["all","paid","free"] as const).map(v => (
          <button key={v} onClick={() => setFilterPlan(v)} style={{ padding: "10px 16px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", backgroundColor: filterPlan === v ? NAVY : "#fff", color: filterPlan === v ? "#fff" : "#555" }}>
            {v === "all" ? "Todos" : v === "paid" ? "Com ativos" : "Sem ativos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80 }}><div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div><p style={{ color: "#aaa" }}>Carregando...</p></div>
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
            const pagantes = rep.referidos.filter(f => f.plan !== "gratuito" && f.plan !== "free" && !!f.plan).length;
            const convRate = total > 0 ? Math.round((pagantes / total) * 100) : 0;
            const tier     = getTier(total);
            const effPct   = effectivePct(total, rep.commission_override);
            const isManual = rep.commission_override !== null;
            const comPaises= rep.referidos.filter(r => r.socio_name).length;

            return (
              <div key={rep.id}>
                <div onClick={() => setExpanded(isOpen ? null : rep.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", cursor: "pointer", borderBottom: !isOpen && idx < filtered.length - 1 ? "1px solid #e8eaed" : "none", backgroundColor: isOpen ? `${GOLD}08` : "transparent" }}>
                  <Avatar name={rep.full_name} email={rep.email} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 3 }}>{rep.full_name ?? rep.username ?? "—"}</div>
                    <div style={{ fontSize: 12, color: "#8a93a2", marginBottom: 6 }}>{rep.email ?? `@${rep.username ?? "—"}`}</div>
                    <CodeEditor repId={rep.id} currentCode={rep.referral_code} onSaved={handleCodeSaved} />
                    <CommissionEditor repId={rep.id} currentOverride={rep.commission_override} tierPct={tier.pct} onSaved={handleCommissionSaved} />
                    {!isManual && tier.nextAt && <TierProgress total={total} tier={tier} />}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
                    {[
                      { value: total,         label: "indicados", color: NAVY },
                      { value: ativos,        label: "ativos",    color: "#16a34a" },
                      { value: `${convRate}%`,label: "conversão", color: GOLD },
                      { value: comPaises,     label: "c/ sócio",  color: "#1d4ed8" },
                      { value: `${effPct}%`,  label: isManual ? "com. ✏" : "comissão", color: isManual ? GOLD : tier.color },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "center", minWidth: 48 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                    <span style={{ color: "#aaa", fontSize: 18, marginLeft: 2 }}>{isOpen ? "▾" : "›"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #e8eaed" : "none", backgroundColor: "#fafbfc" }}>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid #e8eaed", backgroundColor: `${NAVY}05` }}>
                      {[
                        { label: "Total indicados", value: total,         color: NAVY },
                        { label: "Ativos",           value: ativos,        color: "#16a34a" },
                        { label: "Pagantes",         value: pagantes,      color: GOLD },
                        { label: "Conversão",        value: `${convRate}%`,color: convRate >= 50 ? "#16a34a" : convRate >= 20 ? GOLD : "#6b7280" },
                        { label: "Indicados c/ sócio",value: comPaises,   color: "#1d4ed8" },
                        { label: isManual ? "Comissão (manual)" : "Comissão (auto)", value: `${effPct}%`, color: isManual ? GOLD : tier.color },
                      ].map(s => (
                        <div key={s.label} style={{ fontSize: 12 }}><span style={{ color: "#8a93a2" }}>{s.label}: </span><span style={{ fontWeight: 800, color: s.color }}>{s.value}</span></div>
                      ))}
                    </div>
                    {/* Table header */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1fr", padding: "8px 20px", fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "1px solid #e8eaed" }}>
                      <span>Usuário</span><span>País</span><span>Sócio do País</span><span>Plano</span><span>Status</span><span>Cadastro</span>
                    </div>
                    {rep.referidos.length === 0
                      ? <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>Nenhum indicado ainda.</div>
                      : rep.referidos.map((r, i) => {
                        const badge = statusBadge(r);
                        const isPaid = r.plan !== "gratuito" && r.plan !== "free" && !!r.plan;
                        const repPct = effectivePct(rep.referidos.length, rep.commission_override);
                        const socioNet = r.socio_gross_pct !== null ? Math.max(0, r.socio_gross_pct - repPct) : null;
                        return (
                          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1fr", padding: "11px 20px", alignItems: "center", borderBottom: i === rep.referidos.length - 1 ? "none" : "1px solid #f0f2f4", backgroundColor: "#fff" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <Avatar name={r.full_name} email={r.email} size={28} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.full_name ?? r.username ?? "—"}</div>
                                <div style={{ fontSize: 11, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email ?? `@${r.username ?? ""}`}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 13 }}>
                              {r.country_flag && <span title={r.country_name ?? ""}>{r.country_flag} </span>}
                              <span style={{ fontSize: 11, color: "#555" }}>{r.country_name ?? "—"}</span>
                            </div>
                            <div>
                              {r.socio_name
                                ? <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>🌍 {r.socio_name}</div>
                                    {socioNet !== null && (
                                      <div style={{ fontSize: 10, color: "#8a93a2", marginTop: 2 }}>
                                        {r.socio_gross_pct}% − {repPct}% rep = <strong style={{ color: socioNet > 0 ? "#16a34a" : "#dc2626" }}>{socioNet}% líq.</strong>
                                      </div>
                                    )}
                                  </div>
                                : <span style={{ fontSize: 11, color: "#aaa" }}>—</span>
                              }
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: isPaid ? planColor(r.plan) : "#6b7280", backgroundColor: isPaid ? `${planColor(r.plan)}15` : "#f3f4f6", padding: "3px 8px", borderRadius: 5 }}>{planLabel(r.plan)}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.border}`, padding: "2px 7px", borderRadius: 5 }}>{badge.label}</span>
                            <span style={{ fontSize: 12, color: "#8a93a2" }}>{fmt(r.created_at)}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddRepresentanteModal open={showAdd} onClose={() => setShowAdd(false)}
        existingIds={representantes.map(r => r.id)}
        onAdded={rep => setRepresentantes(prev => [rep, ...prev])} />
    </div>
  );
}

// ── Cruzamento Tab ────────────────────────────────────────────
function CruzamentoTab() {
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterSocio,   setFilterSocio]   = useState("all");
  const [filterRep,     setFilterRep]     = useState("all");
  const [filterStatus,  setFilterStatus]  = useState<"all"|"active"|"inactive">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true); setError(null);
    try {
      // Load territories + partners
      const { data: terrs } = await supabase.from("partner_territories")
        .select("country_code, partner_id, commission_pct");
      const terrPartnerIds = [...new Set((terrs ?? []).map(t => t.partner_id as string))];
      const { data: terrPartners } = terrPartnerIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", terrPartnerIds)
        : { data: [] };
      const terrPartnerMap = new Map((terrPartners ?? []).map(p => [p.id, p]));

      // Only fetch user counts for territories without a fixed commission_pct (auto-tier)
      const terrCounts = new Map<string, number>();
      const terrsNeedingCount = (terrs ?? []).filter(t => t.commission_pct == null);
      if (terrsNeedingCount.length > 0) {
        const countResults = await Promise.all(
          terrsNeedingCount.map(t => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("country", t.country_code))
        );
        terrsNeedingCount.forEach((t, i) => { terrCounts.set(t.country_code, countResults[i]?.count ?? 0); });
      }

      // territory country → socio info
      const socioByCountry = new Map<string, { partner_id: string; partner_name: string | null; gross_pct: number }>();
      (terrs ?? []).forEach(t => {
        const p = terrPartnerMap.get(t.partner_id);
        const cnt = terrCounts.get(t.country_code) ?? 0;
        const gross_pct = t.commission_pct != null ? Number(t.commission_pct) : effectivePct(cnt, null);
        socioByCountry.set(t.country_code, {
          partner_id: t.partner_id,
          partner_name: p?.full_name ?? null,
          gross_pct,
        });
      });

      // Load designated representantes + their counts
      const { data: reps } = await supabase.from("profiles")
        .select("id, full_name, commission_override")
        .not("commission_override", "is", null);
      const repCountResults = reps && reps.length > 0
        ? await Promise.all(reps.map(r => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("invited_by_id", r.id)))
        : [];
      const repMap = new Map((reps ?? []).map((r, i) => [r.id, { name: r.full_name, commission_override: r.commission_override ?? null, count: repCountResults[i]?.count ?? 0 }]));

      // Load users of interest
      const countryCodes = [...socioByCountry.keys()];
      const repIds = (reps ?? []).map(r => r.id);

      let query = supabase.from("profiles")
        .select("id, full_name, email, plan, stripe_subscription_status, courtesy_until, created_at, country, invited_by_id")
        .order("created_at", { ascending: false })
        .limit(500);

      if (countryCodes.length > 0 && repIds.length > 0) {
        query = query.or(`country.in.(${countryCodes.join(",")}),invited_by_id.in.(${repIds.join(",")})`);
      } else if (countryCodes.length > 0) {
        query = query.in("country", countryCodes);
      } else if (repIds.length > 0) {
        query = query.in("invited_by_id", repIds);
      } else {
        setRecords([]); setLoading(false); return;
      }

      const { data: users, error: err1 } = await query;
      if (err1) throw err1;

      const recs: CommissionRecord[] = (users ?? []).map(u => {
        const socio = u.country ? socioByCountry.get(u.country) ?? null : null;
        const rep   = u.invited_by_id ? repMap.get(u.invited_by_id) ?? null : null;
        const repPct = rep ? effectivePct(rep.count, rep.commission_override) : null;
        const socioNet = socio !== null ? Math.max(0, socio.gross_pct - (repPct ?? 0)) : null;
        return {
          user_id:       u.id,
          user_name:     u.full_name,
          user_email:    u.email,
          user_plan:     u.plan ?? "gratuito",
          is_active:     isPlanActive({ plan: u.plan ?? "gratuito", stripe_subscription_status: u.stripe_subscription_status, courtesy_until: u.courtesy_until }),
          created_at:    u.created_at,
          country_code:  u.country ?? null,
          country_flag:  u.country ? (COUNTRY_MAP.get(u.country)?.flag ?? null) : null,
          country_name:  u.country ? (COUNTRY_MAP.get(u.country)?.name ?? u.country) : null,
          socio_id:      socio?.partner_id ?? null,
          socio_name:    socio?.partner_name ?? null,
          socio_gross_pct: socio?.gross_pct ?? null,
          socio_net_pct: socioNet,
          rep_id:   rep ? u.invited_by_id : null,
          rep_name: rep?.name ?? null,
          rep_pct:  repPct,
        };
      });
      setRecords(recs);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar cruzamento"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  // Filter options
  const countries   = [...new Set(records.filter(r => r.country_code).map(r => r.country_code!))];
  const socios      = [...new Set(records.filter(r => r.socio_name).map(r => r.socio_name!))];
  const representantes = [...new Set(records.filter(r => r.rep_name).map(r => r.rep_name!))];

  const filtered = records.filter(r => {
    if (filterCountry !== "all" && r.country_code !== filterCountry) return false;
    if (filterSocio   !== "all" && r.socio_name   !== filterSocio)   return false;
    if (filterRep     !== "all" && r.rep_name      !== filterRep)     return false;
    if (filterStatus  === "active"   && !r.is_active)  return false;
    if (filterStatus  === "inactive" &&  r.is_active)  return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!(r.user_name ?? "").toLowerCase().includes(s) && !(r.user_email ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // Totals
  const totalGrossSocio = filtered.reduce((s, r) => s + (r.socio_gross_pct ?? 0), 0);
  const totalNetSocio   = filtered.reduce((s, r) => s + (r.socio_net_pct ?? 0), 0);
  const totalRep        = filtered.reduce((s, r) => s + (r.rep_pct ?? 0), 0);
  const withBoth        = filtered.filter(r => r.socio_id && r.rep_id).length;
  const soloSocio       = filtered.filter(r => r.socio_id && !r.rep_id).length;
  const soloRep         = filtered.filter(r => !r.socio_id && r.rep_id).length;

  const sel = (v: string, set: (x: string) => void, current: string) => (
    <select value={current} onChange={e => set(e.target.value)}
      style={{ padding: "8px 10px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 12, outline: "none", backgroundColor: "#fff", color: NAVY }}>
      {v === "country" && <>
        <option value="all">Todos os países</option>
        {countries.map(c => <option key={c} value={c}>{COUNTRY_MAP.get(c)?.flag} {COUNTRY_MAP.get(c)?.name ?? c}</option>)}
      </>}
      {v === "socio" && <>
        <option value="all">Todos os sócios</option>
        {socios.map(s => <option key={s} value={s}>{s}</option>)}
      </>}
      {v === "rep" && <>
        <option value="all">Todos os representantes</option>
        {representantes.map(r => <option key={r} value={r}>{r}</option>)}
      </>}
    </select>
  );

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total atribuídos",   value: loading ? "…" : records.length,   icon: "📋", color: NAVY },
          { label: "Sócio + Rep",        value: loading ? "…" : withBoth,          icon: "🔀", color: "#7c3aed" },
          { label: "Só sócio",           value: loading ? "…" : soloSocio,         icon: "🌍", color: "#1d4ed8" },
          { label: "Só representante",   value: loading ? "…" : soloRep,           icon: "🔗", color: "#16a34a" },
        ].map(c => (
          <div key={c.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#8a93a2", marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "#555" }}>
        <strong style={{ color: NAVY }}>Lógica de comissões: </strong>
        Sócio recebe a comissão bruta do território. Quando o usuário também veio por indicação de um representante,
        o sócio recebe o <strong>valor líquido</strong> (bruto − % do representante) e o representante recebe a <strong>sua % integral</strong>.
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário..."
            style={{ padding: "8px 10px 8px 32px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 12, outline: "none", width: 180 }} />
        </div>
        {sel("country", setFilterCountry, filterCountry)}
        {sel("socio",   setFilterSocio,   filterSocio)}
        {sel("rep",     setFilterRep,     filterRep)}
        {(["all","active","inactive"] as const).map(v => (
          <button key={v} onClick={() => setFilterStatus(v)} style={{ padding: "8px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", backgroundColor: filterStatus === v ? NAVY : "#fff", color: filterStatus === v ? "#fff" : "#555" }}>
            {v === "all" ? "Todos" : v === "active" ? "✅ Ativos" : "Inativos"}
          </button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#8a93a2" }}>
          {filtered.length} registros
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div><p style={{ color: "#aaa" }}>Calculando atribuições...</p></div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
          <p style={{ color: "#dc2626" }}>{error}</p>
          <button onClick={() => { void load(); }} style={{ marginTop: 12, padding: "8px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Tentar novamente</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔀</div>
          <p style={{ color: "#aaa" }}>Nenhum dado encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <>
          {/* Totals bar */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "10px 16px", backgroundColor: `${NAVY}07`, border: "1px solid #e8eaed", borderRadius: 10, marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: "#8a93a2" }}>Selecionados: <strong style={{ color: NAVY }}>{filtered.length}</strong></span>
            <span style={{ color: "#8a93a2" }}>Soma % sócio bruta: <strong style={{ color: "#1d4ed8" }}>{totalGrossSocio.toFixed(1)}%</strong></span>
            <span style={{ color: "#8a93a2" }}>Soma % sócio líquida: <strong style={{ color: "#16a34a" }}>{totalNetSocio.toFixed(1)}%</strong></span>
            <span style={{ color: "#8a93a2" }}>Soma % representantes: <strong style={{ color: "#7c3aed" }}>{totalRep.toFixed(1)}%</strong></span>
            <span style={{ fontSize: 10, color: "#aaa", marginLeft: "auto" }}>* somatório dos percentuais por usuário (pré-base de cálculo)</span>
          </div>

          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1.8fr 1fr 1fr", padding: "10px 20px", fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "2px solid #e8eaed", backgroundColor: "#f9fafb" }}>
              <span>Usuário</span><span>País</span><span>Sócio do País</span><span>Representante</span><span>Plano</span><span>Cadastro</span>
            </div>

            {filtered.map((r, i) => {
              const badge  = statusBadge({ plan: r.user_plan, stripe_subscription_status: null, courtesy_until: null });
              const isPaid = r.user_plan !== "gratuito" && r.user_plan !== "free" && !!r.user_plan;
              const hasBoth = r.socio_id && r.rep_id;
              return (
                <div key={r.user_id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1.8fr 1fr 1fr", padding: "11px 20px", alignItems: "center", borderBottom: i === filtered.length - 1 ? "none" : "1px solid #f0f2f4", backgroundColor: hasBoth ? `${GOLD}05` : "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar name={r.user_name} email={r.user_email} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.user_name ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.user_email ?? "—"}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14 }}>
                    {r.country_flag && <span title={r.country_name ?? ""}>{r.country_flag}</span>}
                    {!r.country_flag && <span style={{ fontSize: 11, color: "#aaa" }}>—</span>}
                  </div>
                  <div>
                    {r.socio_name
                      ? <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 2 }}>🌍 {r.socio_name}</div>
                          {r.rep_pct !== null && r.socio_gross_pct !== null
                            ? <CommissionSplit grossPct={r.socio_gross_pct} repPct={r.rep_pct} />
                            : r.socio_gross_pct !== null && <PctPill pct={r.socio_gross_pct} label="íntegro" color="#16a34a" bg="#dcfce7" border="#86efac" />
                          }
                        </div>
                      : <span style={{ fontSize: 11, color: "#aaa" }}>—</span>
                    }
                  </div>
                  <div>
                    {r.rep_name
                      ? <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginBottom: 2 }}>🔗 {r.rep_name}</div>
                          {r.rep_pct !== null && <PctPill pct={r.rep_pct} label="integral" color="#7c3aed" bg="#f5f3ff" border="#c4b5fd" />}
                        </div>
                      : <span style={{ fontSize: 11, color: "#aaa" }}>—</span>
                    }
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isPaid ? planColor(r.user_plan) : "#6b7280", backgroundColor: isPaid ? `${planColor(r.user_plan)}15` : "#f3f4f6", padding: "2px 7px", borderRadius: 4 }}>{planLabel(r.user_plan)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, backgroundColor: badge.bg, padding: "1px 5px", borderRadius: 4 }}>{badge.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#8a93a2" }}>{fmt(r.created_at)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminIndicacoes() {
  const [tab, setTab] = useState<"representantes" | "parceiros" | "cruzamento">("representantes");

  return (
    <AdminShell>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 16px" }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>CRM de Indicações</h1>
          <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Representantes nacionais · Parceiros internacionais · Cruzamento de comissões</p>
        </div>

        {/* Tier legend */}
        <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "12px 18px", marginBottom: 20, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap" }}>Tiers automáticos:</span>
          {[{ pct: "10%", range: "0–49", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" }, { pct: "15%", range: "50–199", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" }, { pct: "20%", range: "200+", color: WINE, bg: "#f9f0f1", border: "#e4b5ba" }].map((t, i, arr) => (
            <React.Fragment key={t.pct}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: t.color, backgroundColor: t.bg, border: `1px solid ${t.border}`, padding: "3px 10px", borderRadius: 6 }}>{t.pct}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{t.range} indicados</span>
              </div>
              {i < arr.length - 1 && <span style={{ color: "#d1d5db" }}>→</span>}
            </React.Fragment>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, backgroundColor: `${GOLD}12`, border: `1px solid ${GOLD}40`, borderRadius: 8, padding: "5px 10px" }}>
            <span style={{ fontSize: 10, fontWeight: 800, backgroundColor: GOLD, color: "#fff", padding: "1px 5px", borderRadius: 3 }}>MANUAL</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Sobrescreve o tier</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {([
            { key: "representantes", label: "🔗 Representantes Nacionais" },
            { key: "parceiros",      label: "🌍 Parceiros Internacionais" },
            { key: "cruzamento",     label: "🔀 Cruzamento de Comissões" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: "8px 18px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 400, backgroundColor: tab === t.key ? NAVY : "transparent", color: tab === t.key ? "#fff" : "#555", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "representantes" && <RepresentantesTab />}
        {tab === "parceiros"      && <ParceirosTab />}
        {tab === "cruzamento"     && <CruzamentoTab />}
      </div>
    </AdminShell>
  );
}
