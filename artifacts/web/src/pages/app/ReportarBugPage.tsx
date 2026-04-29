import React, { useState } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const PURPLE = "#7c3aed";

type Severity = "Baixa" | "Média" | "Alta" | "Crítica";

const SEVERITIES: { value: Severity; color: string; emoji: string }[] = [
  { value: "Baixa",    color: "#22c55e", emoji: "🔽" },
  { value: "Média",    color: "#f59e0b", emoji: "➖" },
  { value: "Alta",     color: "#ef4444", emoji: "🔼" },
  { value: "Crítica",  color: PURPLE,    emoji: "⚠️" },
];

export default function ReportarBugPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [title,    setTitle]    = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [description, setDesc]  = useState("");
  const [steps,    setSteps]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!user)                  { setError("Você precisa estar autenticado para reportar um bug."); return; }
    if (!title.trim())          { setError("Informe o título do bug."); return; }
    if (!severity)              { setError("Selecione a severidade do bug."); return; }
    if (!description.trim())    { setError("Descreva o bug detalhadamente."); return; }

    setLoading(true);
    const { error: dbError } = await supabase.from("bug_reports").insert({
      user_id:     user.id,
      title:       title.trim(),
      severity,
      description: description.trim(),
      steps:       steps.trim() || null,
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível enviar o relatório. Tente novamente.");
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <AppShell>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
          <div style={{
            width: 100, height: 100, borderRadius: 50, backgroundColor: `${PURPLE}20`,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            fontSize: 48,
          }} aria-hidden>✅</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: "0 0 12px" }}>Bug reportado!</h1>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.55, margin: "0 0 24px" }}>
            Obrigado por nos ajudar a melhorar o ibhub! Nossa equipe técnica vai investigar o problema em breve.
          </p>
          <button
            type="button"
            onClick={() => setLocation("/app/configuracoes")}
            style={{
              padding: "14px 32px", borderRadius: 12, border: "none",
              backgroundColor: NAVY, color: WHITE, fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}
          >
            Voltar às configurações
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 2px" }}>
          <button
            type="button"
            onClick={() => setLocation("/app/configuracoes")}
            aria-label="Voltar"
            style={{ background: "none", border: "none", cursor: "pointer", color: NAVY, fontSize: 22, padding: 4 }}
          >‹</button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: 0 }}>Reportar Bug</h1>
        </div>

        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: 14,
          backgroundColor: `${PURPLE}15`, border: `1px solid ${PURPLE}35`, borderRadius: 12,
        }}>
          <span aria-hidden style={{ fontSize: 16 }}>⚠️</span>
          <div style={{ fontSize: 13, color: NAVY, lineHeight: 1.5 }}>
            Quanto mais detalhes você fornecer, mais rápido conseguiremos corrigir o problema. Obrigado!
          </div>
        </div>

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: 12,
            backgroundColor: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10,
            color: "#dc2626", fontSize: 13,
          }}>
            <span aria-hidden>⚠️</span>{error}
          </div>
        )}

        <div style={{ backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Título do bug">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Tela de perfil não carrega imagem"
              maxLength={120}
              style={inputStyle}
            />
          </Field>

          <Field label="Severidade">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SEVERITIES.map((sev) => {
                const active = severity === sev.value;
                return (
                  <button
                    key={sev.value}
                    type="button"
                    onClick={() => setSeverity(sev.value)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "9px 14px", borderRadius: 10,
                      border: `1.5px solid ${active ? sev.color : BORDER}`,
                      backgroundColor: active ? `${sev.color}18` : WHITE,
                      color: active ? sev.color : MUTED,
                      fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <span aria-hidden>{sev.emoji}</span>{sev.value}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Descrição do bug">
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="O que aconteceu? Qual era o comportamento esperado?"
              rows={5}
              maxLength={2000}
              style={textareaStyle}
            />
            <div style={{ fontSize: 12, color: MUTED, textAlign: "right", marginTop: 4 }}>
              {description.length}/2000
            </div>
          </Field>

          <Field label="Passos para reproduzir (opcional)">
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={"1. Abrir o app\n2. Navegar para Perfil\n3. Tocar em..."}
              rows={4}
              maxLength={1000}
              style={textareaStyle}
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "16px 0", borderRadius: 12, border: "none",
            backgroundColor: PURPLE, color: WHITE, fontSize: 16, fontWeight: 700,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.65 : 1,
          }}
        >
          {loading ? "Enviando…" : <><span aria-hidden>📤</span>Enviar relatório</>}
        </button>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6, letterSpacing: 0.3 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 14px",
  fontSize: 15, fontFamily: "inherit", outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle, minHeight: 110, resize: "vertical",
};
