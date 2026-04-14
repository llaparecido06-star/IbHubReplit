import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { fetchMyCertificationRequests, submitCertificationRequest, CertificationRequest } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Em análise", color: "#856404", bg: "#fff3cd" },
  approved: { label: "Aprovado", color: "#155724", bg: "#d4edda" },
  rejected: { label: "Recusado", color: "#721c24", bg: "#f8d7da" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: MUTED, bg: "#f5f5f0" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function CertificacoesPage() {
  const { profile } = useAuth();
  const [certs, setCerts] = useState<CertificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    certification_name: "",
    issuing_body: "",
    issue_date: "",
    expiry_date: "",
    proof_url: "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;
    fetchMyCertificationRequests(profile.id).then(setCerts).finally(() => setLoading(false));
  }, [profile?.id]);

  const handleSubmit = async () => {
    if (!profile?.id) return;
    if (!form.certification_name.trim()) { setFormError("Nome da certificação é obrigatório."); return; }
    setFormError("");
    setSubmitting(true);
    const cert = await submitCertificationRequest({
      user_id: profile.id,
      certification_name: form.certification_name.trim(),
      issuing_body: form.issuing_body.trim() || undefined,
      issue_date: form.issue_date || undefined,
      expiry_date: form.expiry_date || undefined,
      proof_url: form.proof_url.trim() || undefined,
    });
    if (cert) {
      setCerts(prev => [cert, ...prev]);
      setShowForm(false);
      setForm({ certification_name: "", issuing_body: "", issue_date: "", expiry_date: "", proof_url: "" });
    }
    setSubmitting(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
    fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 4 }}>🏅 Certificações</h1>
            <p style={{ color: MUTED, fontSize: 14 }}>Adicione e gerencie suas certificações profissionais na indústria do vinho.</p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
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
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Nome da Certificação *</label>
                <input value={form.certification_name} onChange={e => setForm(f => ({ ...f, certification_name: e.target.value }))} placeholder="Ex: WSET Level 2" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Organismo Emissor</label>
                <input value={form.issuing_body} onChange={e => setForm(f => ({ ...f, issuing_body: e.target.value }))} placeholder="Ex: WSET, Sommelier Brasil..." style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Data de emissão</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Validade</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Link do comprovante (URL)</label>
                <input value={form.proof_url} onChange={e => setForm(f => ({ ...f, proof_url: e.target.value }))} placeholder="https://..." style={inputStyle} />
              </div>
              {formError && <p style={{ color: "#dc3545", fontSize: 13, fontWeight: 600 }}>{formError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={{ padding: "10px 18px", borderRadius: 8, border: `1.5px solid ${BORDER}`, backgroundColor: "#fff", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                <button onClick={handleSubmit} disabled={submitting} style={{ padding: "10px 20px", borderRadius: 8, border: "none", backgroundColor: GOLD, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  {submitting ? "Enviando..." : "Enviar para análise"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "#fafaf8" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{certs.length} certificação{certs.length !== 1 ? "ões" : ""}</span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
          ) : certs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏅</div>
              <p style={{ color: MUTED, fontWeight: 600 }}>Nenhuma certificação</p>
              <p style={{ color: MUTED, fontSize: 13 }}>Adicione suas certificações para fortalecer seu perfil profissional.</p>
            </div>
          ) : (
            <div>
              {certs.map((cert, idx) => (
                <div key={cert.id} style={{ padding: "16px 20px", borderBottom: idx < certs.length - 1 ? `1px solid ${BORDER}` : "none", display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ fontSize: 28, marginTop: 2 }}>🏅</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>{cert.certification_name}</span>
                      <StatusBadge status={cert.status} />
                    </div>
                    {cert.issuing_body && <div style={{ fontSize: 13, color: MUTED }}>{cert.issuing_body}</div>}
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                      {cert.issue_date && `Emitido em ${new Date(cert.issue_date).toLocaleDateString("pt-BR")}`}
                      {cert.issue_date && cert.expiry_date && " · "}
                      {cert.expiry_date && `Válido até ${new Date(cert.expiry_date).toLocaleDateString("pt-BR")}`}
                    </div>
                    {cert.proof_url && (
                      <a href={cert.proof_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: GOLD, fontWeight: 600, marginTop: 4, display: "inline-block" }}>
                        Ver comprovante ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, padding: 16, backgroundColor: "#fff8e7", borderRadius: 12, border: `1px solid #f0d080` }}>
          <p style={{ fontSize: 13, color: "#7a5c00", margin: 0 }}>
            <strong>ℹ️ Processo de verificação:</strong> Após o envio, nossa equipe revisará seu comprovante em até 5 dias úteis. Certificações aprovadas aparecem com destaque no seu perfil.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
