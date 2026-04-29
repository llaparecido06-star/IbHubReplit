import React, { useState } from "react";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

const NAVY  = "#0d1b2a";
const GOLD  = "#c9a84c";
const WHITE = "#ffffff";
const MUTED = "#7a8494";
const BORDER = "#e8e8e3";
const BG    = "#f5f5f0";

const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV === true;

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleRestart = () => {
    try {
      resetError();
      if (typeof window !== "undefined") window.location.reload();
    } catch {
      resetError();
    }
  };

  const handleHome = () => {
    try {
      resetError();
      if (typeof window !== "undefined") window.location.href = "/";
    } catch {
      resetError();
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        minHeight: "100vh",
        backgroundColor: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          backgroundColor: WHITE,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden>⚠️</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: "0 0 12px" }}>
          Algo deu errado
        </h1>
        <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: "0 0 24px" }}>
          Encontramos um problema inesperado. Tente recarregar a página ou voltar para a tela inicial.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={handleRestart}
            style={{
              backgroundColor: NAVY,
              color: GOLD,
              border: "none",
              borderRadius: 10,
              padding: "14px 24px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={handleHome}
            style={{
              backgroundColor: "transparent",
              color: NAVY,
              border: `1.5px solid ${BORDER}`,
              borderRadius: 10,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Voltar ao início
          </button>
        </div>

        {isDev && (
          <div style={{ marginTop: 24, textAlign: "left" }}>
            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              style={{
                background: "none",
                border: "none",
                color: MUTED,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showDetails ? "Ocultar detalhes técnicos" : "Mostrar detalhes técnicos"}
            </button>
            {showDetails && (
              <pre
                style={{
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: "#0d1b2a08",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  fontSize: 11,
                  color: NAVY,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 220,
                  overflowY: "auto",
                  fontFamily: "Menlo, monospace",
                }}
              >
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
