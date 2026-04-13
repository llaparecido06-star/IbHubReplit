import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";

export default function RecuperarSenhaPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError("Informe seu e-mail"); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await resetPassword(email);
    if (err) { setError(err); } else { setSent(true); }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f2f3f5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: "#c9a84c" }} />

      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Link href="/login" style={{ fontSize: 32, fontWeight: 900, color: "#0d1b2a", textDecoration: "none", letterSpacing: -0.5, display: "inline-block" }}>ibhub</Link>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
            <div style={{ backgroundColor: "#0d1b2a", padding: "3px 10px", borderRadius: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#c9a84c", letterSpacing: 2.5 }}>REDE DO VINHO</span>
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 4px 24px rgba(13,27,42,0.08)",
        }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0d1b2a", marginBottom: 12 }}>E-mail enviado!</h2>
              <p style={{ fontSize: 15, color: "#8a93a2", lineHeight: 1.6, marginBottom: 24 }}>
                Verifique sua caixa de entrada e clique no link para redefinir sua senha.
              </p>
              <Link href="/login" style={{
                  display: "inline-block", backgroundColor: "#c9a84c", color: "#0d1b2a",
                  fontWeight: 800, fontSize: 14, padding: "12px 28px", borderRadius: 10, textDecoration: "none",
                }}>Voltar ao login</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0d1b2a", marginBottom: 8 }}>Recuperar senha</h1>
              <p style={{ fontSize: 14, color: "#8a93a2", marginBottom: 24, lineHeight: 1.6 }}>
                Informe seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              {error && (
                <div style={{
                  backgroundColor: "#fdecea",
                  border: "1px solid #f5c6cb",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 20,
                  fontSize: 14,
                  color: "#c0392b",
                }}>⚠️ {error}</div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#0d1b2a", display: "block", marginBottom: 6 }}>E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid #e8eaed",
                      backgroundColor: "#f4f5f7",
                      fontSize: 15,
                      color: "#0d1b2a",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: "#c9a84c",
                    color: "#0d1b2a",
                    fontWeight: 800,
                    fontSize: 15,
                    padding: "14px",
                    borderRadius: 10,
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >{loading ? "Enviando..." : "Enviar link de recuperação"}</button>
              </form>

              <div style={{ textAlign: "center", marginTop: 20 }}>
                <Link href="/login" style={{ fontSize: 14, color: "#0d1b2a", fontWeight: 700, textDecoration: "none" }}>← Voltar ao login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
