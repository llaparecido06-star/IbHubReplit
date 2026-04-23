import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

export default function RedefinirSenhaPage() {
  const { updatePassword, mustChangePassword } = useAuth();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) { setError("Preencha todos os campos"); return; }
    if (password.length < 6) { setError("A senha deve ter ao menos 6 caracteres"); return; }
    if (password !== confirm) { setError("As senhas não coincidem"); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await updatePassword(password);
    if (err) { setError(err); setLoading(false); } else { setSuccess(true); setTimeout(() => setLocation("/app"), 2000); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f2f3f5",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: "#c9a84c" }} />
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#0d1b2a" }}>ibhub</div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
            <div style={{ backgroundColor: "#0d1b2a", padding: "3px 10px", borderRadius: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#c9a84c", letterSpacing: 2.5 }}>REDE DO VINHO</span>
            </div>
          </div>
        </div>

        {mustChangePassword && !success && (
          <div style={{
            backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12,
            padding: "14px 18px", marginBottom: 16,
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>🔐</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>Troca de senha obrigatória</div>
              <div style={{ fontSize: 12, color: "#78350f", marginTop: 2, lineHeight: 1.5 }}>
                O administrador definiu uma senha temporária para sua conta. Crie uma nova senha para continuar.
              </div>
            </div>
          </div>
        )}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(13,27,42,0.08)" }}>
          {success ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0d1b2a", marginBottom: 12 }}>Senha atualizada!</h2>
              <p style={{ fontSize: 15, color: "#8a93a2" }}>Redirecionando...</p>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0d1b2a", marginBottom: 24 }}>Redefinir senha</h1>

              {error && (
                <div style={{
                  backgroundColor: "#fdecea", border: "1px solid #f5c6cb",
                  borderRadius: 10, padding: "12px 14px", marginBottom: 20,
                  fontSize: 14, color: "#c0392b",
                }}>⚠️ {error}</div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#0d1b2a", display: "block", marginBottom: 6 }}>Nova senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: 10,
                      border: "1px solid #e8eaed", backgroundColor: "#f4f5f7",
                      fontSize: 15, color: "#0d1b2a", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#0d1b2a", display: "block", marginBottom: 6 }}>Confirmar nova senha</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: 10,
                      border: "1px solid #e8eaed", backgroundColor: "#f4f5f7",
                      fontSize: 15, color: "#0d1b2a", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: "#c9a84c", color: "#0d1b2a", fontWeight: 800,
                    fontSize: 15, padding: "14px", borderRadius: 10, border: "none",
                    cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                  }}
                >{loading ? "Salvando..." : "Salvar nova senha"}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
