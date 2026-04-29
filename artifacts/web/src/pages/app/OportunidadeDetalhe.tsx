import React, { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  AppOpportunity,
  fetchOpportunityById,
  applyToJob,
  uploadCV,
  getCvSignedUrl,
  expressInterest,
  trackOpportunityView,
} from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

export default function OportunidadeDetalhe() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/app/oportunidades/:id");
  const id = params?.id ?? "";

  const [opp, setOpp] = useState<AppOpportunity | null>(null);
  const [loading, setLoading] = useState(true);

  const [showApply, setShowApply] = useState(false);
  const [message, setMessage] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvUrl, setCvUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isInterested, setIsInterested] = useState(false);
  const [myCvSignedUrl, setMyCvSignedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id || !user?.id) return;
    fetchOpportunityById(id, user.id).then((data) => {
      setOpp(data);
      if (data?.is_interested) setIsInterested(true);
      setLoading(false);
      if (data && data.created_by !== user.id) {
        trackOpportunityView(id);
      }
    });
  }, [id, user?.id]);

  const handleApply = async () => {
    if (!opp || !user?.id) return;
    setSubmitting(true);

    let finalCvUrl = cvUrl.trim() || null;

    if (cvFile && !finalCvUrl) {
      setUploading(true);
      const uploaded = await uploadCV(cvFile, user.id);
      setUploading(false);
      if (!uploaded) {
        alert("Falha no envio do arquivo. Tente novamente ou use um link.");
        setSubmitting(false);
        return;
      }
      finalCvUrl = uploaded;
    }

    const ok = await applyToJob(opp.id, user.id, finalCvUrl, message.trim() || null);
    setSubmitting(false);
    if (ok) {
      setShowApply(false);
      setOpp((prev) => prev ? { ...prev, is_applied: true, applications_count: (prev.applications_count ?? 0) + 1 } : prev);
      setMessage("");
      setCvUrl("");
      setCvFile(null);
      if (finalCvUrl) {
        getCvSignedUrl(finalCvUrl).then((url) => setMyCvSignedUrl(url));
      }
    } else {
      alert("Não foi possível enviar a candidatura. Você já se candidatou?");
    }
  };

  const handleInterest = async () => {
    if (!opp || !user?.id || isInterested) return;
    setSubmitting(true);
    const ok = await expressInterest(opp.id, user.id);
    setSubmitting(false);
    if (ok) {
      setIsInterested(true);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <p style={{ color: "#aaa" }}>Carregando...</p>
        </div>
      </AppShell>
    );
  }

  if (!opp) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 48 }}>😕</div>
          <h2 style={{ color: NAVY }}>Oportunidade não encontrada</h2>
          <button
            onClick={() => setLocation("/app/oportunidades")}
            style={{ color: GOLD, background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700 }}
          >← Voltar</button>
        </div>
      </AppShell>
    );
  }

  const isOwner = user?.id === opp.created_by;
  const isVaga = opp.type === "vaga";

  return (
    <AppShell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
        {/* Back */}
        <button
          onClick={() => setLocation("/app/oportunidades")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#8a93a2", fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}
        >← Voltar para Oportunidades</button>

        {/* Main card */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed", padding: 28, marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 8px" }}>{opp.title}</h1>

          {isVaga && opp.company ? (
            <p style={{ fontSize: 15, color: "#8a93a2", margin: "0 0 16px" }}>{opp.company}</p>
          ) : opp.creator?.full_name ? (
            <p style={{ fontSize: 15, color: GOLD, margin: "0 0 16px" }}>
              por <span onClick={() => opp.creator?.id && setLocation(`/app/usuario/${opp.creator.id}`)} style={{ cursor: opp.creator?.id ? "pointer" : "default", textDecoration: opp.creator?.id ? "underline" : "none" }}>{opp.creator.full_name}</span>
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {opp.category && (
              <span style={{ backgroundColor: `${NAVY}18`, color: NAVY, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 8 }}>
                {opp.category}
              </span>
            )}
            {opp.contract_type && (
              <span style={{ backgroundColor: "#f0fdf4", color: "#16a34a", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 8 }}>
                {opp.contract_type}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            {opp.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#555" }}>
                <span>📍</span> {opp.location}
              </div>
            )}
            {isVaga && opp.salary && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: GOLD, fontWeight: 700 }}>
                <span>💰</span> {opp.salary}
              </div>
            )}
            {!isVaga && opp.price && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: GOLD, fontWeight: 700 }}>
                <span>🏷️</span> {opp.price}
              </div>
            )}
            {opp.contact_email && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <span>✉️</span>
                <a href={`mailto:${opp.contact_email}`} style={{ color: GOLD }}>
                  {opp.contact_email}
                </a>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#aaa" }}>
              <span>📅</span> Publicada em {new Date(opp.created_at).toLocaleDateString("pt-BR")}
            </div>
            {isVaga && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#aaa" }}>
                <span>👥</span> {opp.applications_count ?? 0} candidatura{opp.applications_count !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {opp.description && (
            <>
              <hr style={{ border: "none", borderTop: "1px solid #e8eaed", margin: "20px 0" }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Descrição</h3>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{opp.description}</p>
            </>
          )}

          {opp.expires_at && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: "#fff7ed", borderRadius: 10, border: "1px solid #fed7aa", display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span>
              <span style={{ fontSize: 13, color: "#92400e" }}>Expira em {new Date(opp.expires_at).toLocaleDateString("pt-BR")}</span>
            </div>
          )}
        </div>

        {/* Action area */}
        {!isOwner && (
          <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed", padding: 24 }}>
            {isVaga ? (
              opp.is_applied ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>Candidatura enviada</span>
                  </div>
                  {myCvSignedUrl && (
                    <a
                      href={myCvSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, color: GOLD, fontWeight: 600, textDecoration: "none" }}
                    >📄 Ver meu currículo enviado</a>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowApply(true)}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    backgroundColor: GOLD,
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >📤 Candidatar-se</button>
              )
            ) : (
              isInterested ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: 16 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>Interesse registrado</span>
                </div>
              ) : (
                <button
                  onClick={handleInterest}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    backgroundColor: NAVY,
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: "pointer",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >{submitting ? "Enviando..." : "💬 Tenho interesse"}</button>
              )
            )}
          </div>
        )}

        {/* Apply modal */}
        {showApply && (
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setShowApply(false)}
          >
            <div
              style={{ backgroundColor: "#fff", borderRadius: "22px 22px 0 0", padding: "28px 28px 40px", width: "100%", maxWidth: 600 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: "0 0 4px" }}>Enviar candidatura</h2>
              <p style={{ fontSize: 13, color: "#8a93a2", margin: "0 0 20px" }}>{opp.title}</p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>
                  Currículo (arquivo PDF/DOC)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setCvFile(f);
                    if (f) setCvUrl("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: `1px dashed ${cvFile ? GOLD : "#d1d5db"}`,
                    borderRadius: 12,
                    backgroundColor: cvFile ? `${GOLD}0d` : "#f9fafb",
                    color: cvFile ? GOLD : "#8a93a2",
                    fontSize: 13,
                    fontWeight: cvFile ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    boxSizing: "border-box",
                  }}
                >
                  {cvFile ? `📄 ${cvFile.name}` : "📎 Selecionar arquivo (PDF, DOC)"}
                </button>
                {cvFile && (
                  <button
                    type="button"
                    onClick={() => { setCvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    style={{ background: "none", border: "none", color: "#dc2626", fontSize: 12, cursor: "pointer", marginTop: 4 }}
                  >✕ Remover arquivo</button>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>
                  Ou link do LinkedIn / Portifólio <span style={{ color: "#aaa", fontWeight: 400 }}>(alternativa)</span>
                </label>
                <input
                  value={cvUrl}
                  onChange={(e) => { setCvUrl(e.target.value); if (e.target.value) setCvFile(null); }}
                  placeholder="https://linkedin.com/in/seu-perfil"
                  disabled={!!cvFile}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid #e8eaed",
                    borderRadius: 12,
                    fontSize: 14,
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    backgroundColor: cvFile ? "#f3f4f6" : "#fff",
                    color: cvFile ? "#aaa" : "#111",
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>
                  Mensagem para o recrutador <span style={{ color: "#aaa", fontWeight: 400 }}>(opcional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Apresente-se brevemente e explique por que é o candidato ideal..."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: 14,
                    border: "1px solid #e8eaed",
                    borderRadius: 12,
                    fontSize: 14,
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                onClick={handleApply}
                disabled={submitting || uploading}
                style={{
                  width: "100%",
                  padding: 15,
                  backgroundColor: submitting || uploading ? "#ccc" : GOLD,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >{uploading ? "Enviando CV..." : submitting ? "Enviando candidatura..." : "Enviar candidatura"}</button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
