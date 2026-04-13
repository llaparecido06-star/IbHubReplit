import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Preencha todos os campos"); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError("E-mail ou senha incorretos");
      setLoading(false);
    } else {
      setLocation("/app");
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
            <span style={{ fontSize: 16, fontWeight: 800, color: "#4285F4" }}>G</span>
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
