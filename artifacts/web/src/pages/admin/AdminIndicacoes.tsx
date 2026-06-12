import React, { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const WINE = "#722f37";

// ── Country list (ISO + flag) ─────────────────────────────────
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

// ── Commission tiers ──────────────────────────────────────────
interface Tier { pct: number; color: string; bg: string; border: string; nextAt?: number; nextPct?: number; }

function getTier(total: number): Tier {
  if (total >= 200) return { pct: 20, color: WINE,     bg: "#f9f0f1", border: "#e4b5ba" };
  if (total >= 50)  return { pct: 15, color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", nextAt: 200, nextPct: 20 };
                    return { pct: 10, color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", nextAt: 50,  nextPct: 15 };
}
function effectivePct(total: number, override: number | null) { return override !== null ? override : getTier(total).pct; }

// ── Representante types ───────────────────────────────────────
interface Referido {
  id: string; full_name: string | null; email: string | null; username: string | null;
  plan: string; stripe_subscription_status: string | null;
  stripe_current_period_end: string | null; courtesy_until: string | null; created_at: string;
}
interface Representante {
  id: string; full_name: string | null; email: string | null; username: string | null;
  referral_code: string | null; commission_override: number | null; plan: string; created_at: string;
  referidos: Referido[];
}

// ── Territory types ───────────────────────────────────────────
interface TerritoryUser extends Referido { invited_by_id: string | null; }
interface Territory {
  id: string;
  partner_id: string;
  country_code: string;
  country_name: string;
  country_flag: string | null;
  notes: string | null;
  created_at: string;
  commission_override: number | null;
  partner_name: string | null;
  partner_email: string | null;
  partner_username: string | null;
  partner_referral_code: string | null;
  users: TerritoryUser[];
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
function statusBadge(r: Referido) {
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

// ── Tier progress bar ─────────────────────────────────────────
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

// ── Commission badge ──────────────────────────────────────────
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

// ── Referido table row ────────────────────────────────────────
function ReferidoRow({ ref: r, isLast, showVia }: { ref: TerritoryUser | Referido; isLast: boolean; showVia?: boolean }) {
  const badge = statusBadge(r);
  const isPaid = r.plan !== "gratuito" && r.plan !== "free" && !!r.plan;
  return (
    <div style={{ display: "grid", gridTemplateColumns: showVia ? "2fr 1fr 1fr 1fr 1fr 1fr" : "2fr 1.2fr 1fr 1fr 1fr", padding: "11px 20px", alignItems: "center", borderBottom: isLast ? "none" : "1px solid #f0f2f4", backgroundColor: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar name={r.full_name} email={r.email} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.full_name ?? r.username ?? "—"}</div>
          <div style={{ fontSize: 11, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email ?? `@${r.username ?? (r.id?.slice(0, 8) ?? "")}`}</div>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: isPaid ? planColor(r.plan) : "#6b7280", backgroundColor: isPaid ? `${planColor(r.plan)}15` : "#f3f4f6", padding: "3px 8px", borderRadius: 5 }}>{planLabel(r.plan)}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.border}`, padding: "2px 7px", borderRadius: 5 }}>{badge.label}</span>
      <span style={{ fontSize: 12, color: "#555" }}>{planExpiry(r)}</span>
      <span style={{ fontSize: 12, color: "#8a93a2" }}>{fmt(r.created_at)}</span>
      {showVia && (
        <span style={{ fontSize: 11, color: "#8a93a2" }}>
          {"invited_by_id" in r && (r as TerritoryUser).invited_by_id ? (
            <span style={{ color: "#7c3aed", fontWeight: 600 }}>🔗 convite</span>
          ) : (
            <span style={{ color: "#1d4ed8", fontWeight: 600 }}>🌍 país</span>
          )}
        </span>
      )}
    </div>
  );
}

// ── Add Territory Modal ───────────────────────────────────────
function AddTerritoryModal({ open, onClose, onAdded, takenCodes }: {
  open: boolean; onClose: () => void;
  onAdded: (t: Territory) => void;
  takenCodes: string[];
}) {
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerResults, setPartnerResults] = useState<{ id: string; full_name: string | null; email: string | null; username: string | null; commission_override: number | null }[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<typeof partnerResults[0] | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<typeof ADMIN_COUNTRIES[0] | null>(null);
  const [notes, setNotes] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setPartnerSearch(""); setPartnerResults([]); setSelectedPartner(null); setSelectedCountry(null); setNotes(""); setError(null); }
  }, [open]);

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
    if (takenCodes.includes(selectedCountry.code)) { setError(`${selectedCountry.name} já tem um parceiro atribuído.`); return; }
    setSaving(true); setError(null);
    const row = {
      partner_id: selectedPartner.id,
      country_code: selectedCountry.code,
      country_name: selectedCountry.name,
      country_flag: selectedCountry.flag,
      notes: notes.trim() || null,
    };
    const { data, error: dbErr } = await supabase.from("partner_territories").insert(row).select().single();
    setSaving(false);
    if (dbErr) { setError(dbErr.code === "23505" ? "Esse país já tem parceiro." : dbErr.message); return; }
    onAdded({ ...data, commission_override: selectedPartner.commission_override, partner_name: selectedPartner.full_name, partner_email: selectedPartner.email, partner_username: selectedPartner.username, partner_referral_code: null, users: [] });
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

        {/* Partner search */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Parceiro (usuário existente)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={partnerSearch} onChange={e => setPartnerSearch(e.target.value)} placeholder="Buscar por nome ou email..."
              style={{ flex: 1, padding: "9px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none" }}
              onKeyDown={e => { if (e.key === "Enter") void searchPartners(); }} />
            <button onClick={() => { void searchPartners(); }} disabled={searching} style={{ padding: "9px 16px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {searching ? "..." : "Buscar"}
            </button>
          </div>
          {partnerResults.length > 0 && (
            <div style={{ border: "1px solid #e8eaed", borderRadius: 8, marginTop: 6, overflow: "hidden" }}>
              {partnerResults.map((p, i) => (
                <div key={p.id} onClick={() => { setSelectedPartner(p); setPartnerResults([]); setPartnerSearch(p.full_name ?? p.email ?? p.username ?? ""); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", backgroundColor: selectedPartner?.id === p.id ? `${GOLD}10` : "#fff", borderBottom: i < partnerResults.length - 1 ? "1px solid #e8eaed" : "none" }}>
                  <Avatar name={p.full_name} email={p.email} size={30} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{p.full_name ?? p.username ?? "—"}</div>
                    <div style={{ fontSize: 11, color: "#8a93a2" }}>{p.email}</div>
                  </div>
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

        {/* Country select */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Território (país)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6, maxHeight: 220, overflowY: "auto", border: "1px solid #e8eaed", borderRadius: 8, padding: 8 }}>
            {ADMIN_COUNTRIES.map((c) => {
              const taken = takenCodes.includes(c.code);
              const sel = selectedCountry?.code === c.code;
              return (
                <button key={c.code} onClick={() => !taken && setSelectedCountry(c)} disabled={taken}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", border: `1px solid ${sel ? GOLD : "#e8eaed"}`, borderRadius: 7, cursor: taken ? "not-allowed" : "pointer", backgroundColor: sel ? `${GOLD}15` : taken ? "#f9fafb" : "#fff", opacity: taken ? 0.5 : 1, textAlign: "left" }}>
                  <span style={{ fontSize: 18 }}>{c.flag}</span>
                  <span style={{ fontSize: 12, fontWeight: sel ? 700 : 400, color: taken ? "#aaa" : NAVY }}>{c.name}</span>
                  {taken && <span style={{ fontSize: 9, color: "#aaa", marginLeft: "auto" }}>ocupado</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Observações internas <span style={{ color: "#aaa", fontWeight: 400 }}>(opcional)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Acordo assinado em jan/2025, comissão negociada diretamente..."
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
        .select("id, partner_id, country_code, country_name, country_flag, notes, created_at")
        .order("created_at", { ascending: false });
      if (err1) throw err1;
      if (!terrs || terrs.length === 0) { setTerritories([]); setLoading(false); return; }

      // Fetch partner profiles
      const partnerIds = [...new Set(terrs.map(t => t.partner_id as string))];
      const { data: partners, error: err2 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, referral_code, commission_override")
        .in("id", partnerIds);
      if (err2) throw err2;

      const partnerMap = new Map((partners ?? []).map(p => [p.id, p]));

      // For each territory, fetch users from that country
      const result: Territory[] = await Promise.all(terrs.map(async (t) => {
        const p = partnerMap.get(t.partner_id);
        const { data: users } = await supabase
          .from("profiles")
          .select("id, full_name, email, username, plan, stripe_subscription_status, stripe_current_period_end, courtesy_until, created_at, invited_by_id")
          .eq("country", t.country_code)
          .order("created_at", { ascending: false });
        return {
          ...t,
          commission_override: p?.commission_override ?? null,
          partner_name: p?.full_name ?? null,
          partner_email: p?.email ?? null,
          partner_username: p?.username ?? null,
          partner_referral_code: p?.referral_code ?? null,
          users: (users ?? []).map(u => ({
            id: u.id, full_name: u.full_name, email: u.email, username: u.username,
            plan: u.plan ?? "gratuito", stripe_subscription_status: u.stripe_subscription_status,
            stripe_current_period_end: u.stripe_current_period_end, courtesy_until: u.courtesy_until,
            created_at: u.created_at, invited_by_id: u.invited_by_id,
          })),
        };
      }));

      setTerritories(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar parceiros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleRemove = async (id: string, countryName: string) => {
    if (!confirm(`Remover o território "${countryName}"? O parceiro perderá a atribuição desse país.`)) return;
    setRemovingId(id);
    await supabase.from("partner_territories").delete().eq("id", id);
    setTerritories(prev => prev.filter(t => t.id !== id));
    if (expanded === id) setExpanded(null);
    setRemovingId(null);
  };

  const takenCodes = territories.map(t => t.country_code);
  const totalUsers = territories.reduce((s, t) => s + t.users.length, 0);
  const totalAtivos = territories.reduce((s, t) => s + t.users.filter(isPlanActive).length, 0);

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Territórios",    value: territories.length, icon: "🌍", color: NAVY },
          { label: "Usuários no ext.", value: totalUsers,          icon: "👥", color: "#1d4ed8" },
          { label: "Plano Ativo",    value: totalAtivos,          icon: "✅", color: "#16a34a" },
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

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div><p style={{ color: "#aaa" }}>Carregando territórios...</p></div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
          <p style={{ color: "#dc2626" }}>{error}</p>
          <button onClick={() => { void load(); }} style={{ marginTop: 12, padding: "8px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Tentar novamente</button>
        </div>
      ) : territories.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌍</div>
          <p style={{ color: "#555", fontWeight: 600, marginBottom: 4 }}>Nenhum parceiro internacional cadastrado</p>
          <p style={{ color: "#aaa", fontSize: 13, marginBottom: 20 }}>Atribua um país a um representante para começar a rastrear usuários por território.</p>
          <button onClick={() => setShowAdd(true)} style={{ padding: "10px 28px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>+ Novo Parceiro</button>
        </div>
      ) : (
        <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
          {territories.map((t, idx) => {
            const isOpen  = expanded === t.id;
            const ativos  = t.users.filter(isPlanActive).length;
            const pagantes = t.users.filter(u => u.plan !== "gratuito" && u.plan !== "free" && !!u.plan).length;
            const convRate = t.users.length > 0 ? Math.round((pagantes / t.users.length) * 100) : 0;
            const tier    = getTier(t.users.length);
            const effPct  = effectivePct(t.users.length, t.commission_override);
            const isManual = t.commission_override !== null;

            // Separate: via country auto vs via referral code
            const viaCountry  = t.users.filter(u => !u.invited_by_id || true).length; // all from country query
            const viaConvite  = t.users.filter(u => !!u.invited_by_id).length;

            return (
              <div key={t.id}>
                <div
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px", cursor: "pointer", borderBottom: !isOpen && idx < territories.length - 1 ? "1px solid #e8eaed" : "none", backgroundColor: isOpen ? `${GOLD}08` : "transparent", transition: "background 0.15s" }}
                >
                  {/* Flag */}
                  <div style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: `${NAVY}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
                    {t.country_flag ?? "🌍"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{t.country_name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", backgroundColor: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>{t.country_code}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#8a93a2", marginBottom: 6 }}>
                      Parceiro: <span style={{ fontWeight: 600, color: NAVY }}>{t.partner_name ?? t.partner_username ?? "—"}</span>
                      {t.partner_email && <span style={{ color: "#aaa" }}> · {t.partner_email}</span>}
                    </div>
                    {t.partner_referral_code && (
                      <span style={{ fontSize: 11, fontWeight: 800, backgroundColor: `${GOLD}20`, color: GOLD, padding: "2px 8px", borderRadius: 5, fontFamily: "monospace", marginBottom: 6, display: "inline-block" }}>{t.partner_referral_code}</span>
                    )}
                    <CommissionBadge pct={effPct} isManual={isManual} />
                    {t.notes && <div style={{ fontSize: 11, color: "#8a93a2", marginTop: 6, fontStyle: "italic" }}>"{t.notes}"</div>}
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                    {[
                      { value: t.users.length, label: "usuários",  color: NAVY },
                      { value: ativos,          label: "ativos",   color: "#16a34a" },
                      { value: `${convRate}%`,  label: "conversão",color: GOLD },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "center", minWidth: 50 }}>
                        <div style={{ fontSize: 17, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                    <button
                      onClick={e => { e.stopPropagation(); void handleRemove(t.id, t.country_name); }}
                      disabled={removingId === t.id}
                      title="Remover território"
                      style={{ padding: "4px 8px", backgroundColor: "transparent", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#dc2626", marginLeft: 4 }}
                    >{removingId === t.id ? "..." : "✕"}</button>
                    <span style={{ color: "#aaa", fontSize: 18 }}>{isOpen ? "▾" : "›"}</span>
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ borderBottom: idx < territories.length - 1 ? "1px solid #e8eaed" : "none", backgroundColor: "#fafbfc" }}>
                    {/* Summary bar */}
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid #e8eaed", backgroundColor: `${NAVY}05`, alignItems: "center" }}>
                      {[
                        { label: "Total no território", value: t.users.length, color: NAVY },
                        { label: "Com plano ativo", value: ativos, color: "#16a34a" },
                        { label: "Plano pago", value: pagantes, color: GOLD },
                        { label: "Conversão", value: `${convRate}%`, color: convRate >= 50 ? "#16a34a" : convRate >= 20 ? GOLD : "#6b7280" },
                        { label: isManual ? "Comissão (manual)" : "Comissão (tier)", value: `${effPct}%`, color: isManual ? GOLD : tier.color },
                        { label: "Com convite", value: viaConvite, color: "#7c3aed" },
                      ].map(s => (
                        <div key={s.label} style={{ fontSize: 12 }}>
                          <span style={{ color: "#8a93a2" }}>{s.label}: </span>
                          <span style={{ fontWeight: 800, color: s.color }}>{s.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Table header */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "8px 20px", fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "1px solid #e8eaed" }}>
                      <span>Usuário</span><span>Plano</span><span>Status</span><span>Vence em</span><span>Cadastro</span><span>Via</span>
                    </div>

                    {t.users.length === 0 ? (
                      <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>
                        Nenhum usuário com país "{t.country_code}" cadastrado ainda.<br />
                        <span style={{ fontSize: 11 }}>Novos cadastros no app com esse país aparecerão aqui automaticamente.</span>
                      </div>
                    ) : t.users.map((u, i) => (
                      <ReferidoRow key={u.id} ref={u} isLast={i === t.users.length - 1} showVia />
                    ))}
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

// ── Add Representante Modal ───────────────────────────────────
function AddRepresentanteModal({ open, onClose, existingIds, onAdded }: {
  open: boolean;
  onClose: () => void;
  existingIds: string[];
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
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, username, referral_code")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(10);
    setResults((data ?? []).filter(p => !existingIds.includes(p.id)));
    setSearching(false);
  };

  // Generate a deterministic referral code from username + random suffix
  const genCode = (username: string | null): string => {
    const base = (username ?? "REP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${base}${suffix}`;
  };

  const handleAdd = async () => {
    if (!selected) return;
    if (existingIds.includes(selected.id)) { setError("Esse usuário já é representante."); return; }
    setSaving(true); setError(null);
    try {
      // Ensure referral code
      let code = selected.referral_code;
      if (!code) {
        code = genCode(selected.username);
        // Keep trying until unique
        let attempt = 0;
        while (attempt < 5) {
          const { error: checkErr, data: existing } = await supabase.from("profiles").select("id").eq("referral_code", code).maybeSingle();
          if (checkErr || !existing) break;
          code = genCode(selected.username);
          attempt++;
        }
        const { error: codeErr } = await supabase.from("profiles").update({ referral_code: code }).eq("id", selected.id);
        if (codeErr) throw codeErr;
      }
      // Mark as designated representante (commission_override = 10 = base tier)
      const { error: commErr } = await supabase.from("profiles").update({ commission_override: 10 }).eq("id", selected.id).is("commission_override", null);
      if (commErr) throw commErr;

      // Fetch final profile
      const { data: profile, error: fetchErr } = await supabase.from("profiles").select("id, full_name, email, username, referral_code, commission_override, plan, created_at").eq("id", selected.id).single();
      if (fetchErr) throw fetchErr;

      onAdded({ id: profile.id, full_name: profile.full_name, email: profile.email, username: profile.username, referral_code: profile.referral_code, commission_override: profile.commission_override ?? null, plan: profile.plan ?? "gratuito", created_at: profile.created_at, referidos: [] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar representante");
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ backgroundColor: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>Novo Representante</div>
            <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>Busque um perfil existente no IBHUB</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: "#aaa" }}>✕</button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>Buscar perfil</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 15 }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null); }}
                onKeyDown={e => { if (e.key === "Enter") void search(); }}
                placeholder="Nome, email ou @username..."
                style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={() => { void search(); }}
              disabled={searching || query.trim().length < 2}
              style={{ padding: "10px 18px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: query.trim().length < 2 ? 0.5 : 1 }}
            >{searching ? "..." : "Buscar"}</button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ border: "1px solid #e8eaed", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            {results.map((p, i) => {
              const isSel = selected?.id === p.id;
              return (
                <div key={p.id} onClick={() => setSelected(isSel ? null : p)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer", backgroundColor: isSel ? `${GOLD}12` : "#fff", borderBottom: i < results.length - 1 ? "1px solid #e8eaed" : "none", transition: "background 0.1s" }}>
                  <Avatar name={p.full_name} email={p.email} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name ?? p.username ?? "—"}</div>
                    <div style={{ fontSize: 12, color: "#8a93a2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email ?? `@${p.username ?? ""}`}</div>
                  </div>
                  {p.referral_code && (
                    <span style={{ fontSize: 10, fontWeight: 800, backgroundColor: `${GOLD}20`, color: GOLD, padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0 }}>{p.referral_code}</span>
                  )}
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isSel ? GOLD : "#d1d5db"}`, backgroundColor: isSel ? GOLD : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s" }}>
                    {isSel && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {results.length === 0 && query.trim().length >= 2 && !searching && (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#aaa", fontSize: 13, marginBottom: 16 }}>Nenhum perfil encontrado.</div>
        )}

        {/* Selected preview */}
        {selected && (
          <div style={{ padding: "10px 14px", backgroundColor: `${NAVY}06`, border: `1px solid ${NAVY}20`, borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={selected.full_name} email={selected.email} size={30} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{selected.full_name ?? selected.username}</div>
              <div style={{ fontSize: 11, color: "#8a93a2" }}>{selected.email}</div>
            </div>
            <div style={{ fontSize: 11, color: "#8a93a2", textAlign: "right" }}>
              {selected.referral_code
                ? <span>Código: <span style={{ fontFamily: "monospace", fontWeight: 700, color: GOLD }}>{selected.referral_code}</span></span>
                : <span style={{ color: "#f59e0b" }}>⚡ Código será gerado automaticamente</span>
              }
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "#8a93a2", marginBottom: 16, padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: 8 }}>
          💡 O usuário receberá comissão de <strong>10%</strong> (tier base). Você pode ajustar depois diretamente na lista.
        </div>

        {error && <div style={{ padding: "8px 12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", backgroundColor: "#f3f4f6", color: "#555", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { void handleAdd(); }} disabled={saving || !selected}
            style={{ padding: "10px 24px", backgroundColor: NAVY, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: !selected ? 0.5 : 1 }}>
            {saving ? "Adicionando..." : "Designar Representante"}
          </button>
        </div>
      </div>
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

  const load = async () => {
    setLoading(true); setError(null);
    try {
      // 1. Profiles that have been invited by someone
      const { data: referidos, error: err1 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, plan, stripe_subscription_status, stripe_current_period_end, courtesy_until, created_at, invited_by_id")
        .not("invited_by_id", "is", null);
      if (err1) throw err1;

      // 2. Profiles explicitly designated as representantes (commission_override IS NOT NULL)
      const { data: designated, error: err2 } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, referral_code, commission_override, plan, created_at")
        .not("commission_override", "is", null);
      if (err2) throw err2;

      // Build referidos map grouped by inviter
      const map = new Map<string, Referido[]>();
      for (const r of (referidos ?? [])) {
        const iid = r.invited_by_id as string;
        if (!map.has(iid)) map.set(iid, []);
        map.get(iid)!.push({ id: r.id, full_name: r.full_name, email: r.email, username: r.username, plan: r.plan ?? "gratuito", stripe_subscription_status: r.stripe_subscription_status, stripe_current_period_end: r.stripe_current_period_end, courtesy_until: r.courtesy_until, created_at: r.created_at });
      }

      // Union: inviters with referidos + explicitly designated
      const inviterIds = new Set([...map.keys()]);
      const allIds = new Set<string>([...inviterIds]);
      for (const d of (designated ?? [])) allIds.add(d.id);

      if (allIds.size === 0) { setRepresentantes([]); setLoading(false); return; }

      // Fetch full profiles for all representantes
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar indicações");
    } finally { setLoading(false); }
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
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
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

      {/* Search + filter */}
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

      {/* List */}
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
            return (
              <div key={rep.id}>
                <div onClick={() => setExpanded(isOpen ? null : rep.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", cursor: "pointer", borderBottom: !isOpen && idx < filtered.length - 1 ? "1px solid #e8eaed" : "none", backgroundColor: isOpen ? `${GOLD}08` : "transparent", transition: "background 0.15s" }}>
                  <Avatar name={rep.full_name} email={rep.email} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 3 }}>{rep.full_name ?? rep.username ?? "—"}</div>
                    <div style={{ fontSize: 12, color: "#8a93a2", marginBottom: 6 }}>{rep.email ?? `@${rep.username ?? "—"}`}</div>
                    <CodeEditor repId={rep.id} currentCode={rep.referral_code} onSaved={handleCodeSaved} />
                    <CommissionEditor repId={rep.id} currentOverride={rep.commission_override} tierPct={tier.pct} onSaved={handleCommissionSaved} />
                    {!isManual && tier.nextAt && <TierProgress total={total} tier={tier} />}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
                    {[{ value: total, label: "indicados", color: NAVY }, { value: ativos, label: "ativos", color: "#16a34a" }, { value: `${convRate}%`, label: "conversão", color: GOLD }, { value: `${effPct}%`, label: isManual ? "com. ✏" : "comissão", color: isManual ? GOLD : tier.color }].map(s => (
                      <div key={s.label} style={{ textAlign: "center", minWidth: 52 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                    <span style={{ color: "#aaa", fontSize: 18, marginLeft: 2 }}>{isOpen ? "▾" : "›"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #e8eaed" : "none", backgroundColor: "#fafbfc" }}>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid #e8eaed", backgroundColor: `${NAVY}05` }}>
                      {[{ label: "Total indicados", value: total, color: NAVY }, { label: "Com plano ativo", value: ativos, color: "#16a34a" }, { label: "Plano pago", value: pagantes, color: GOLD }, { label: "Conversão", value: `${convRate}%`, color: convRate >= 50 ? "#16a34a" : convRate >= 20 ? GOLD : "#6b7280" }, { label: isManual ? "Comissão (manual)" : "Comissão (auto)", value: `${effPct}%`, color: isManual ? GOLD : tier.color }].map(s => (
                        <div key={s.label} style={{ fontSize: 12 }}><span style={{ color: "#8a93a2" }}>{s.label}: </span><span style={{ fontWeight: 800, color: s.color }}>{s.value}</span></div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr", padding: "8px 20px", fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "1px solid #e8eaed" }}>
                      <span>Usuário</span><span>Plano</span><span>Status</span><span>Vence em</span><span>Cadastro</span>
                    </div>
                    {rep.referidos.length === 0
                      ? <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>Nenhum indicado ainda.</div>
                      : rep.referidos.map((ref, i) => <ReferidoRow key={ref.id} ref={ref} isLast={i === rep.referidos.length - 1} />)
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminIndicacoes() {
  const [tab, setTab] = useState<"representantes" | "parceiros">("representantes");

  return (
    <AdminShell>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>CRM de Indicações</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Representantes nacionais · Parceiros internacionais · Comissões</p>
          </div>
        </div>

        {/* Commission tier legend */}
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
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: "8px 20px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 400, backgroundColor: tab === t.key ? NAVY : "transparent", color: tab === t.key ? "#fff" : "#555", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "representantes" ? <RepresentantesTab /> : <ParceirosTab />}
      </div>
    </AdminShell>
  );
}
