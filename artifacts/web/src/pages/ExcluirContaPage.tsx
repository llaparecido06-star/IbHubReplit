import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

const navy = "#0d1b2a";
const gold = "#c9a84c";
const danger = "#dc2626";

export default function ExcluirContaPage() {
  const { session, signIn, signOut } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    const { error } = await signIn(email, password);
    setLoginLoading(false);
    if (error) setLoginError(error);
  };

  const handleDelete = async () => {
    if (!session?.access_token) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao excluir conta.");
      }
      setDeleted(true);
      await signOut();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f2f3f5", fontFamily: "'Inter', sans-serif" }}>
      <header style={{
        backgroundColor: navy,
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Link href="/">
          <img src="/logo-ibhub-branco.png" alt="ibhub" style={{ height: 32, display: "block" }} />
        </Link>
        <Link href="/" style={{
          fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none",
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
        }}>
          ← Voltar
        </Link>
      </header>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px 80px" }}>

        {deleted ? (
          <div style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 style={{ color: navy, margin: "0 0 12px", fontSize: 22 }}>Conta excluída</h2>
            <p style={{ color: "#555", lineHeight: 1.6, margin: "0 0 24px" }}>
              Sua conta e todos os seus dados foram removidos permanentemente do ibhub.
            </p>
            <Link href="/" style={{
              display: "inline-block",
              backgroundColor: navy,
              color: "#fff",
              padding: "10px 24px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}>
              Voltar ao início
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ color: navy, fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>
                Excluir minha conta
              </h1>
              <p style={{ color: "#666", lineHeight: 1.6, margin: 0 }}>
                Esta ação é <strong>permanente e irreversível</strong>. Todos os seus dados serão
                apagados definitivamente do ibhub.
              </p>
            </div>

            <div style={{
              backgroundColor: "#fff5f5",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: "16px 20px",
              marginBottom: 28,
            }}>
              <p style={{ color: "#7f1d1d", margin: 0, fontSize: 14, lineHeight: 1.7 }}>
                Ao excluir sua conta, serão removidos permanentemente:
              </p>
              <ul style={{ color: "#7f1d1d", margin: "8px 0 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
                <li>Seu perfil, foto e informações pessoais</li>
                <li>Suas publicações, comentários e curtidas</li>
                <li>Suas conexões e mensagens</li>
                <li>Suas inscrições em eventos e cursos</li>
              </ul>
            </div>

            {!session ? (
              <div style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 28,
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }}>
                <h2 style={{ color: navy, fontSize: 17, fontWeight: 600, margin: "0 0 20px" }}>
                  Entre na sua conta para continuar
                </h2>
                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 13, color: "#555", marginBottom: 6, fontWeight: 500 }}>
                      E-mail
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "10px 14px", borderRadius: 8,
                        border: "1px solid #d1d5db", fontSize: 15,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 13, color: "#555", marginBottom: 6, fontWeight: 500 }}>
                      Senha
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "10px 14px", borderRadius: 8,
                        border: "1px solid #d1d5db", fontSize: 15,
                        outline: "none",
                      }}
                    />
                  </div>
                  {loginError && (
                    <p style={{ color: danger, fontSize: 13, margin: "0 0 16px" }}>{loginError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loginLoading}
                    style={{
                      width: "100%", padding: "11px 0",
                      backgroundColor: navy, color: "#fff",
                      border: "none", borderRadius: 8,
                      fontSize: 15, fontWeight: 600,
                      cursor: loginLoading ? "not-allowed" : "pointer",
                      opacity: loginLoading ? 0.7 : 1,
                    }}
                  >
                    {loginLoading ? "Entrando…" : "Entrar"}
                  </button>
                </form>
              </div>
            ) : (
              <div style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 28,
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }}>
                <p style={{ color: "#555", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
                  Você está conectado como <strong>{session.user?.email}</strong>.
                </p>

                {!confirmed ? (
                  <>
                    <p style={{ color: "#555", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
                      Para confirmar a exclusão permanente da sua conta, marque a opção abaixo:
                    </p>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", marginBottom: 24 }}>
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={e => setConfirmed(e.target.checked)}
                        style={{ marginTop: 2, width: 16, height: 16, accentColor: danger, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 14, color: "#333", lineHeight: 1.6 }}>
                        Entendo que esta ação é <strong>permanente e irreversível</strong> e que todos os
                        meus dados serão excluídos definitivamente.
                      </span>
                    </label>
                    <button
                      disabled
                      style={{
                        width: "100%", padding: "11px 0",
                        backgroundColor: "#e5e7eb", color: "#9ca3af",
                        border: "none", borderRadius: 8,
                        fontSize: 15, fontWeight: 600,
                        cursor: "not-allowed",
                      }}
                    >
                      Excluir minha conta permanentemente
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ color: "#555", fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
                      Confirme abaixo para excluir permanentemente a conta <strong>{session.user?.email}</strong>.
                    </p>
                    {deleteError && (
                      <p style={{ color: danger, fontSize: 13, margin: "0 0 16px" }}>{deleteError}</p>
                    )}
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        width: "100%", padding: "11px 0",
                        backgroundColor: danger, color: "#fff",
                        border: "none", borderRadius: 8,
                        fontSize: 15, fontWeight: 600,
                        cursor: deleting ? "not-allowed" : "pointer",
                        opacity: deleting ? 0.7 : 1,
                        marginBottom: 12,
                      }}
                    >
                      {deleting ? "Excluindo…" : "Excluir minha conta permanentemente"}
                    </button>
                    <button
                      onClick={() => setConfirmed(false)}
                      disabled={deleting}
                      style={{
                        width: "100%", padding: "11px 0",
                        backgroundColor: "transparent", color: "#666",
                        border: "1px solid #d1d5db", borderRadius: 8,
                        fontSize: 15, fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            )}

            <p style={{ color: "#999", fontSize: 12, textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
              Tem dúvidas? Entre em contato:{" "}
              <a href="mailto:atendimento@idealbi.com.br" style={{ color: gold }}>
                atendimento@idealbi.com.br
              </a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
