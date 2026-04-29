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

const CATEGORIES = ["Suporte Técnico", "Dúvida", "Sugestão", "Outro"];

export default function ContatoPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [subject,  setSubject]  = useState("");
  const [category, setCategory] = useState("");
  const [message,  setMessage]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!user)              { setError("Você precisa estar autenticado para enviar uma mensagem."); return; }
    if (!subject.trim())    { setError("Informe o assunto da mensagem."); return; }
    if (!category)          { setError("Selecione uma categoria."); return; }
    if (!message.trim())    { setError("Escreva sua mensagem."); return; }

    setLoading(true);
    const { error: dbError } = await supabase.from("support_messages").insert({
      user_id: user.id,
      subject: subject.trim(),
      category,
      message: message.trim(),
    });
    setLoading(false);

    if (dbError) {
      setError("Não foi possível enviar sua mensagem. Tente novamente.");
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <AppShell>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
          <div style={{
            width: 100, height: 100, borderRadius: 50, backgroundColor: `${GOLD}25`,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            fontSize: 48,
          }} aria-hidden>✅</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: "0 0 12px" }}>Mensagem enviada!</h1>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.55, margin: "0 0 24px" }}>
            Recebemos sua mensagem e nossa equipe retornará em breve. Agradecemos o contato!
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
          <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: 0 }}>Fale Conosco</h1>
        </div>

        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: 14,
          backgroundColor: `${GOLD}12`, border: `1px solid ${GOLD}35`, borderRadius: 12,
        }}>
          <span aria-hidden style={{ fontSize: 16 }}>✉️</span>
          <div style={{ fontSize: 13, color: NAVY, lineHeight: 1.5 }}>
            Nossa equipe responde em até 2 dias úteis. Para emergências, use a opção "Reportar Bug".
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
          <Field label="Assunto">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Problema ao acessar o perfil"
              maxLength={120}
              style={inputStyle}
            />
          </Field>

          <Field label="Categoria">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
            >
              <option value="">Selecione uma categoria</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Mensagem">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva sua dúvida, sugestão ou problema em detalhes…"
              rows={6}
              maxLength={2000}
              style={textareaStyle}
            />
            <div style={{ fontSize: 12, color: MUTED, textAlign: "right", marginTop: 4 }}>
              {message.length}/2000
            </div>
          </Field>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "16px 0", borderRadius: 12, border: "none",
            backgroundColor: NAVY, color: WHITE, fontSize: 16, fontWeight: 700,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.65 : 1,
          }}
        >
          {loading ? "Enviando…" : <><span aria-hidden>📤</span>Enviar mensagem</>}
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
  ...inputStyle, minHeight: 130, resize: "vertical",
};
