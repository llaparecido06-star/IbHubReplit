import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { signIn, signInWithGoogle, suspensionMsg, clearSuspensionMsg } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show suspension message when redirected here after forced sign-out
  useEffect(() => {
    if (suspensionMsg) {
      setError(suspensionMsg);
      clearSuspensionMsg();
    }
  }, [suspensionMsg, clearSuspensionMsg]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Preencha todos os campos"); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) {
      const isSuspension = err.toLowerCase().includes("suspensa") || err.toLowerCase().includes("suspen");
      setError(isSuspension ? err : "E-mail ou senha incorretos");
      setLoading(false);
    } else {
      const redirect = sessionStorage.getItem("redirect_after_login");
      sessionStorage.removeItem("redirect_after_login");
      setLocation(redirect ?? "/app");
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) { setError(err); setGoogleLoading(false); }
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
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: "#c9a84c" }} />

      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#0d1b2a", letterSpacing: -0.5, marginBottom: 6 }}>ibhub</div>
          <div style={{
            display: "inline-block",
            backgroundColor: "#0d1b2a",
            padding: "3px 10px",
            borderRadius: 4,
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: "#c9a84c", letterSpacing: 2.5 }}>REDE DO VINHO</span>
          </div>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 4px 24px rgba(13,27,42,0.08)",
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0d1b2a", marginBottom: 24 }}>Entrar na sua conta</h1>

          {error && (
            <div style={{
              backgroundColor: "#fdecea",
              border: "1px solid #f5c6cb",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 20,
              fontSize: 14,
              color: "#c0392b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#0d1b2a" }}>Senha</label>
                <Link href="/recuperar-senha" style={{ fontSize: 13, color: "#c9a84c", fontWeight: 600, textDecoration: "none" }}>Esqueceu?</Link>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "12px 44px 12px 14px",
                    borderRadius: 10,
                    border: "1px solid #e8eaed",
                    backgroundColor: "#f4f5f7",
                    fontSize: 15,
                    color: "#0d1b2a",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    color: "#8fa3b8",
                  }}
                >{showPassword ? "🙈" : "👁"}</button>
              </div>
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
                marginTop: 4,
              }}
            >{loading ? "Entrando..." : "Acessar"}</button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, backgroundColor: "#e8eaed" }} />
            <span style={{ fontSize: 12, color: "#8fa3b8", fontWeight: 500 }}>ou continue com</span>
            <div style={{ flex: 1, height: 1, backgroundColor: "#e8eaed" }} />
          </div>

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "12px",
              borderRadius: 10,
              border: "1px solid #e8eaed",
              backgroundColor: "#f4f5f7",
              cursor: googleLoading ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: "#0d1b2a",
              opacity: googleLoading ? 0.7 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? "Conectando..." : "Continuar com Google"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 14 }}>
          <span style={{ color: "#8fa3b8" }}>Não tem conta? </span>
          <Link href="/cadastro" style={{ color: "#0d1b2a", fontWeight: 800, textDecoration: "none" }}>Criar conta grátis</Link>
        </div>
      </div>
    </div>
  );
}
