import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallPage } from "@/components/PaywallPage";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f5f5f0";

const CERT_OPTIONS = [
  "WSET Level 1",
  "WSET Level 2",
  "WSET Level 3",
  "WSET Level 4 – Diploma",
  "CMS Introductory Sommelier",
  "CMS Certified Sommelier",
  "CMS Advanced Sommelier",
  "Master Sommelier",
  "ABEV Sommelier",
  "ISA Sommelier",
  "Enólogo – Bacharelado",
  "Outro",
];

export default function CertificacoesPage() {
  const { profile, patchProfile } = useAuth();

  const [certs, setCerts] = useState<string[]>(
    Array.isArray(profile?.certifications) ? (profile.certifications as string[]) : []
  );

  useEffect(() => {
    setCerts(Array.isArray(profile?.certifications) ? (profile.certifications as string[]) : []);
  }, [profile?.certifications]);

  const [showForm, setShowForm]     = useState(false);
  const [selected, setSelected]     = useState("");
  const [customCert, setCustomCert] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const persist = async (updated: string[]): Promise<boolean> => {
    if (!profile?.id) return false;
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ certifications: updated })
      .or(`id.eq.${profile.id},user_id.eq.${profile.id}`);
    if (dbErr) { console.error("certifications update:", dbErr); return false; }
    return true;
  };

  const handleAdd = async () => {
    const cert = (selected === "Outro" ? customCert : selected).trim();
    if (!cert) { setError("Selecione ou digite uma certificação."); return; }
    if (certs.includes(cert)) { setError("Essa certificação já está na lista."); return; }
    setError("");
    setSaving(true);
    const updated = [...certs, cert];
    const ok = await persist(updated);
    setSaving(false);
    if (!ok) { setError("Não foi possível salvar. Tente novamente."); return; }
    setCerts(updated);
    patchProfile({ certifications: updated });
    setSelected(""); setCustomCert(""); setShowForm(false);
  };

  const handleRemove = async (cert: string) => {
    if (!window.confirm(`Remover "${cert}"?`)) return;
    const updated = certs.filter((c) => c !== cert);
    const ok = await persist(updated);
    if (ok) { setCerts(updated); patchProfile({ certifications: updated }); }
  };

  const { hasFeature, isLoading: permLoading } = usePermissions();

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
    fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
  };

  if (permLoading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #c9a84c", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        </div>
      </AppShell>
    );
  }

  if (!hasFeature("Upload Certificados")) {
    return (
      <AppShell>
        <PaywallPage
          featureName="Upload de Certificados"
          description="Exiba suas certificações profissionais de vinho no seu perfil ibhub."
          requiredPlan="Profissional"
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 4 }}>🏅 Certificações</h1>
            <p style={{ color: MUTED, fontSize: 14 }}>Adicione e gerencie suas certificações profissionais na indústria do vinho.</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setError(""); }}
            style={{ padding: "10px 20px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}
          >
            {showForm ? "Cancelar" : "+ Adicionar"}
          </button>
        </div>

        {showForm && (
          <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 18 }}>Nova Certificação</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Certificação *</label>
                <select
                  value={selected}
                  onChange={e => { setSelected(e.target.value); setError(""); }}
                  style={{ ...inputStyle, color: selected ? NAVY : MUTED }}
                >
                  <option value="">Selecione a certificação...</option>
                  {CERT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              {selected === "Outro" && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Nome da certificação *</label>
                  <input
                    value={customCert}
                    onChange={e => { setCustomCert(e.target.value); setError(""); }}
                    placeholder="Ex: WSET Level 3"
                    style={inputStyle}
                  />
                </div>
              )}
              {error && <p style={{ color: "#dc3545", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button onClick={() => { setShowForm(false); setSelected(""); setCustomCert(""); setError(""); }}
                  style={{ padding: "10px 18px", borderRadius: 8, border: `1.5px solid ${BORDER}`, backgroundColor: "#fff", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  Cancelar
                </button>
                <button onClick={handleAdd} disabled={saving}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", backgroundColor: saving ? `${GOLD}88` : GOLD, color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 13 }}>
                  {saving ? "Salvando..." : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "#fafaf8" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
              {certs.length} certificação{certs.length !== 1 ? "ões" : ""}
            </span>
          </div>

          {certs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏅</div>
              <p style={{ color: MUTED, fontWeight: 600 }}>Nenhuma certificação</p>
              <p style={{ color: MUTED, fontSize: 13 }}>Adicione suas certificações para fortalecer seu perfil profissional.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 20 }}>
              {certs.map((cert) => (
                <div
                  key={cert}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    backgroundColor: `${NAVY}14`, border: `1px solid ${NAVY}30`,
                    borderRadius: 20, paddingLeft: 14, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{cert}</span>
                  <button
                    onClick={() => handleRemove(cert)}
                    title={`Remover "${cert}"`}
                    style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 0, display: "flex", alignItems: "center", fontSize: 14, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
