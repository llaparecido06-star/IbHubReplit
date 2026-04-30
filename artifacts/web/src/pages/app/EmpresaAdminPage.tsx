import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import {
  fetchCompanyOpportunities,
  fetchOpportunityApplicants,
  updateApplicantStatus,
  updateOpportunity,
  getCvSignedUrl,
  CompanyAdminOpportunity,
  CompanyAdminApplicant,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const BORDER = "#e8eaed";
const MUTED  = "#8a93a2";
const WHITE  = "#fff";
const BG     = "#f2f3f5";

const JOB_CATS       = ["Sommelier", "Enólogo", "Gerência", "Marketing", "Vendas", "Exportação", "Produção", "Outros"];
const MARKET_CATS    = ["Vinho", "Insumo", "Equipamento", "Serviço", "Outros"];
const CONTRACT_TYPES = ["CLT", "PJ", "Freelancer", "Estágio"];

const STATUS_LABELS: Record<CompanyAdminApplicant["status"], { label: string; color: string }> = {
  pending:     { label: "Pendente",     color: "#f39c12" },
  reviewed:    { label: "Visualizado",  color: "#3498db" },
  shortlisted: { label: "Selecionado",  color: "#8b5cf6" },
  hired:       { label: "Contratado",   color: "#2ecc71" },
  rejected:    { label: "Rejeitado",    color: "#e74c3c" },
};
const STATUS_CYCLE: CompanyAdminApplicant["status"][] = [
  "pending", "reviewed", "shortlisted", "hired", "rejected",
];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("pt-BR");
}

function isoToInputDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

interface CompanyHead {
  id: string;
  name: string;
  owner_id: string;
  avatar_url: string | null;
}

export default function EmpresaAdminPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [company, setCompany] = useState<CompanyHead | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"vagas" | "anuncios">("vagas");
  const [items, setItems] = useState<CompanyAdminOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CompanyAdminOpportunity | null>(null);
  const [applicantsOf, setApplicantsOf] = useState<CompanyAdminOpportunity | null>(null);

  // ── Authorize + load company head ───────────────────────────────────────
  useEffect(() => {
    if (!companyId || !userId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("company_pages")
        .select("id, name, owner_id, avatar_url")
        .eq("id", companyId)
        .maybeSingle();
      if (!alive) return;
      const c = data as CompanyHead | null;
      setCompany(c);
      if (!c) { setAuthorized(false); return; }
      if (c.owner_id === userId) { setAuthorized(true); return; }
      const { data: adminRow } = await supabase
        .from("company_page_admins")
        .select("user_id")
        .eq("company_page_id", companyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!alive) return;
      setAuthorized(!!adminRow);
    })();
    return () => { alive = false; };
  }, [companyId, userId]);

  // ── Load opportunities ──────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    if (!company || !authorized) return;
    setLoading(true);
    const list = await fetchCompanyOpportunities(
      company.id,
      company.owner_id,
      tab === "vagas" ? "vaga" : "marketplace",
    );
    setItems(list);
    setLoading(false);
  }, [company, authorized, tab]);

  useEffect(() => { loadItems(); }, [loadItems]);

  if (authorized === false) {
    return (
      <AppShell>
        <div style={{ maxWidth: 720, margin: "60px auto", padding: 24, textAlign: "center" }}>
          <h2 style={{ color: NAVY }}>Acesso restrito</h2>
          <p style={{ color: MUTED }}>Você não tem permissão para gerenciar esta empresa.</p>
          <button onClick={() => setLocation(`/app/empresa/${companyId}`)}
            style={{ marginTop: 16, padding: "10px 22px", border: "none", borderRadius: 10, backgroundColor: GOLD, color: WHITE, fontWeight: 700, cursor: "pointer" }}>
            Voltar para a página
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px", backgroundColor: BG, minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => setLocation(`/app/empresa/${companyId}`)}
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: NAVY }}
            aria-label="Voltar"
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: 0 }}>Gerenciar vagas</h1>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{company?.name ?? ""}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `2px solid ${BORDER}` }}>
          {(["vagas", "anuncios"] as const).map(t => {
            const active = tab === t;
            const label = t === "vagas" ? "💼 Vagas" : "🛍️ Anúncios";
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: "none", border: "none", padding: "10px 16px", cursor: "pointer",
                  fontWeight: active ? 800 : 500, fontSize: 14,
                  color: active ? GOLD : MUTED,
                  borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
                  marginBottom: -2,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading || authorized === null ? (
          <div style={{ padding: 60, textAlign: "center", color: MUTED }}>Carregando...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, color: MUTED }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{tab === "vagas" ? "💼" : "🛍️"}</div>
            <p>Nenhum item por aqui.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map(opp => (
              <div key={opp.id} style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: NAVY }}>{opp.title}</h3>
                    {opp.description ? (
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>
                        {opp.description}
                      </p>
                    ) : null}
                    <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
                      {opp.category && <span>🏷️ {opp.category}</span>}
                      {opp.contract_type && <span>📄 {opp.contract_type}</span>}
                      {opp.location && <span>📍 {opp.location}</span>}
                      {(opp.salary || opp.price) && <span style={{ color: GOLD, fontWeight: 700 }}>{opp.salary ?? opp.price}</span>}
                      {opp.expires_at && <span>⏳ até {fmtDate(opp.expires_at)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch", minWidth: 140 }}>
                    {tab === "vagas" && (
                      <button
                        onClick={() => setApplicantsOf(opp)}
                        style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${GOLD}`, backgroundColor: `${GOLD}15`, color: GOLD, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                      >
                        👥 {opp.applications_count ?? 0} candidato{(opp.applications_count ?? 0) === 1 ? "" : "s"}
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(opp)}
                      style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                    >
                      ✏️ Editar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditOppModal
          opp={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...updated } as CompanyAdminOpportunity : i));
            setEditing(null);
          }}
        />
      )}

      {applicantsOf && (
        <ApplicantsModal
          opp={applicantsOf}
          onClose={() => setApplicantsOf(null)}
        />
      )}
    </AppShell>
  );
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditOppModal({
  opp, onClose, onSaved,
}: {
  opp: CompanyAdminOpportunity;
  onClose: () => void;
  onSaved: (updated: Partial<CompanyAdminOpportunity>) => void;
}) {
  const isMarket = opp.type === "marketplace";
  const catOptions = isMarket ? MARKET_CATS : JOB_CATS;

  const [title, setTitle] = useState(opp.title ?? "");
  const [description, setDescription] = useState(opp.description ?? "");
  const [category, setCategory] = useState(opp.category ?? "");
  const [contractType, setContractType] = useState(opp.contract_type ?? "");
  const [company, setCompany] = useState(opp.company ?? "");
  const [location, setLocationStr] = useState(opp.location ?? "");
  const [price, setPrice] = useState(opp.price ?? "");
  const [salary, setSalary] = useState(opp.salary ?? "");
  const [contactEmail, setContactEmail] = useState(opp.contact_email ?? "");
  const [expiresAt, setExpiresAt] = useState(isoToInputDate(opp.expires_at));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const fields: Parameters<typeof updateOpportunity>[1] = {
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      location: location.trim() || null,
      contact_email: contactEmail.trim() || null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };
    if (isMarket) {
      fields.price = price.trim() || null;
    } else {
      fields.salary = salary.trim() || null;
      fields.contract_type = contractType.trim() || null;
      fields.company = company.trim() || null;
    }
    const ok = await updateOpportunity(opp.id, fields);
    setSaving(false);
    if (ok) onSaved(fields);
    else alert("Não foi possível salvar.");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10,
    fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: WHITE, borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, backgroundColor: WHITE, zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: NAVY }}>
            Editar {isMarket ? "anúncio" : "vaga"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#999" }}>✕</button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Título *">
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} />
          </Field>

          <Field label="Categoria">
            <ChipsRow options={catOptions} value={category} onChange={setCategory} />
          </Field>

          <Field label="Descrição">
            <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              value={description} onChange={e => setDescription(e.target.value)} />
          </Field>

          {!isMarket ? (
            <>
              <Field label="Tipo de contrato">
                <ChipsRow options={CONTRACT_TYPES} value={contractType} onChange={setContractType} />
              </Field>
              <Field label="Empresa">
                <input style={inputStyle} value={company} onChange={e => setCompany(e.target.value)} />
              </Field>
            </>
          ) : null}

          <Field label={isMarket ? "Preço" : "Salário"}>
            <input
              style={inputStyle}
              value={isMarket ? price : salary}
              onChange={e => isMarket ? setPrice(e.target.value) : setSalary(e.target.value)}
              placeholder={isMarket ? "Ex: R$ 150,00" : "Ex: R$ 3.500 - 5.000"}
            />
          </Field>

          <Field label="Localização">
            <input style={inputStyle} value={location} onChange={e => setLocationStr(e.target.value)} />
          </Field>

          <Field label="Expira em">
            <input type="date" style={inputStyle} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </Field>

          <Field label="E-mail de contato">
            <input style={inputStyle} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
          </Field>

          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            style={{ marginTop: 6, padding: "12px", borderRadius: 10, border: "none",
              backgroundColor: !title.trim() || saving ? "#ccc" : GOLD,
              color: WHITE, fontWeight: 800, fontSize: 14,
              cursor: !title.trim() || saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ChipsRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? "" : opt)}
            style={{
              padding: "6px 14px", borderRadius: 20,
              border: `1px solid ${active ? GOLD : BORDER}`,
              backgroundColor: active ? `${GOLD}20` : WHITE,
              color: active ? GOLD : "#555",
              fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Applicants Modal ────────────────────────────────────────────────────────

function ApplicantsModal({ opp, onClose }: { opp: CompanyAdminOpportunity; onClose: () => void }) {
  const [list, setList] = useState<CompanyAdminApplicant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchOpportunityApplicants(opp.id).then(d => {
      setList(d);
      setLoading(false);
    });
  }, [opp.id]);

  const cycleStatus = async (a: CompanyAdminApplicant) => {
    const idx = STATUS_CYCLE.indexOf(a.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setList(prev => prev.map(x => x.id === a.id ? { ...x, status: next } : x));
    await updateApplicantStatus(a.id, next);
  };

  const openCv = async (a: CompanyAdminApplicant) => {
    if (!a.cv_url) return;
    const url = await getCvSignedUrl(a.cv_url, { applicationId: a.id });
    if (!url) { alert("Não foi possível abrir o CV."); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: WHITE, borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, backgroundColor: WHITE, zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: NAVY }}>{opp.title}</h2>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{list.length} candidato{list.length === 1 ? "" : "s"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#999" }}>✕</button>
        </div>
        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: MUTED }}>Carregando...</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: MUTED }}>Nenhum candidato ainda.</div>
          ) : list.map(a => {
            const meta = STATUS_LABELS[a.status];
            return (
              <div key={a.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: GOLD, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, overflow: "hidden", flexShrink: 0 }}>
                    {a.avatar_url
                      ? <img src={a.avatar_url} alt={a.full_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : (a.full_name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{a.full_name ?? "Usuário"}</div>
                    {a.headline ? <div style={{ fontSize: 13, color: MUTED }}>{a.headline}</div> : null}
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Candidatou-se em {fmtDate(a.created_at)}</div>
                  </div>
                </div>
                {a.message ? (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: "#f7f7f7", fontSize: 13, color: "#444" }}>
                    “{a.message}”
                  </div>
                ) : null}
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => cycleStatus(a)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 20, border: `1px solid ${meta.color}`, backgroundColor: `${meta.color}20`, color: meta.color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    {meta.label} ›
                  </button>
                  {a.cv_url ? (
                    <button
                      onClick={() => openCv(a)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none", backgroundColor: `${GOLD}20`, color: GOLD, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                      📄 Ver CV
                    </button>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, backgroundColor: "#f0f0f0", color: MUTED, fontSize: 12 }}>
                      📄 Sem CV
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
