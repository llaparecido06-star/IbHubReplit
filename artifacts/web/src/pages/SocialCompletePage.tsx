import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { ensureReferralCode } from "@/services/api";

const AREAS = [
  "Sommelier", "Comprador", "Importador", "Produtor",
  "Enólogo", "Consultor", "Investidor", "Entusiasta", "Outros",
];

export default function SocialCompletePage() {
  const { user, loading: authLoading, profileChecked, needsProfileCompletion, refreshProfile } = useAuth();
  const [, setLocation] = useLocation();

  const [fullName,  setFullName]  = useState("");
  const [username,  setUsername]  = useState("");
  const [position,  setPosition]  = useState("");
  const [areas,     setAreas]     = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const oauthEmail  = user?.email ?? null;
  const oauthAvatar = (() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (meta.avatar_url ?? meta.picture ?? null) as string | null;
  })();

  // Only redirect away once the auth state is fully resolved (loading done + profile checked).
  // This prevents premature redirects during the initial loading window.
  useEffect(() => {
    if (!authLoading && profileChecked && !needsProfileCompletion) {
      setLocation("/app");
    }
  }, [authLoading, profileChecked, needsProfileCompletion, setLocation]);

  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name = ((meta.full_name ?? meta.name ?? "") as string).trim();
    if (name) setFullName(name);

    const suggestion = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20);
    if (suggestion) setUsername(suggestion);
  }, [user]);

  const toggleArea = (a: string) => {
    setAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!fullName.trim())   { setError("Insira seu nome completo"); return; }
    if (!username.trim())   { setError("Escolha um nome de usuário"); return; }
    if (areas.length === 0) { setError("Selecione pelo menos uma área de atuação"); return; }

    setLoading(true);
    setError(null);

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.trim().toLowerCase())
      .neq("id", user.id)
      .maybeSingle();
    if (taken) { setError("Esse nome de usuário já está em uso"); setLoading(false); return; }

    const { error: upsertErr } = await supabase.from("profiles").upsert({
      id: user.id,
      user_id: user.id,
      full_name: fullName.trim(),
      username: username.trim().toLowerCase(),
      position: position.trim() || null,
      areas_of_expertise: areas,
      areas,
      plan: "gratuito",
      created_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (upsertErr) {
      setError("Erro ao salvar perfil. Tente novamente.");
      setLoading(false);
      return;
    }

    await ensureReferralCode(user.id);

    if (oauthAvatar) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!existing?.avatar_url) {
        await supabase.from("profiles").update({ avatar_url: oauthAvatar }).eq("id", user.id);
      }
    }

    await refreshProfile();
    setLoading(false);
    setLocation("/app");
  }, [user, fullName, username, position, areas, oauthAvatar, refreshProfile, setLocation]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d1b2a 0%, #1a2e45 60%, #243b55 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          {oauthAvatar ? (
            <img
              src={oauthAvatar}
              alt="Foto de perfil"
              style={{
                width: 80, height: 80, borderRadius: "50%",
                border: "3px solid #c9a84c",
                marginBottom: 16, display: "block", margin: "0 auto 16px",
              }}
            />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(201,168,76,0.15)",
              border: "3px solid #c9a84c",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 32,
            }}>
              🍷
            </div>
          )}
          <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>
            Finalize seu cadastro
          </h1>
          <p style={{ color: "#8fa3b8", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Só mais algumas informações para completar seu perfil profissional.
          </p>
        </div>

        {/* Card */}
        <form onSubmit={handleSave} style={{
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          boxShadow: "0 8px 32px rgba(13,27,42,0.25)",
        }}>

          {error && (
            <div style={{
              background: "#fdecea", border: "1px solid #f5c6c3",
              borderRadius: 8, padding: "10px 14px",
              color: "#c0392b", fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Email — read-only */}
          {oauthEmail && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#0d1b2a" }}>E-mail</label>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#f0f3f7", border: "1px solid #e0e6ef",
                borderRadius: 10, padding: "0 12px", height: 44,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8fa3b8" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span style={{ flex: 1, fontSize: 14, color: "#5a7a99" }}>{oauthEmail}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b0bec9" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <span style={{ fontSize: 11, color: "#8fa3b8" }}>Importado da sua conta Google — não é possível alterar aqui.</span>
            </div>
          )}

          {/* Full name */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0d1b2a" }}>
              Nome completo <span style={{ color: "#c0392b" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Seu nome"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Username */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0d1b2a" }}>
              Nome de usuário <span style={{ color: "#c0392b" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: "#8fa3b8", fontSize: 15, pointerEvents: "none",
              }}>@</span>
              <input
                type="text"
                placeholder="seunome"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                style={{ ...inputStyle, paddingLeft: 28 }}
                autoComplete="off"
              />
            </div>
            <span style={{ fontSize: 11, color: "#8fa3b8" }}>Apenas letras minúsculas, números, _ e .</span>
          </div>

          {/* Position */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0d1b2a" }}>
              Cargo / função <span style={{ color: "#8fa3b8", fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Sommelier, Importador..."
              value={position}
              onChange={e => setPosition(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Areas */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#0d1b2a" }}>
              Área de atuação <span style={{ color: "#c0392b" }}>*</span>
            </label>
            <span style={{ fontSize: 11, color: "#8fa3b8" }}>Selecione uma ou mais áreas</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AREAS.map(a => {
                const sel = areas.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleArea(a)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 20,
                      border: `1.5px solid ${sel ? "#c9a84c" : "#dde4ed"}`,
                      background: sel ? "#fdf6e7" : "#f8f9fb",
                      color: sel ? "#b5862a" : "#5a7a99",
                      fontWeight: sel ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || areas.length === 0 || !fullName.trim() || !username.trim()}
            style={{
              height: 48,
              background: "#0d1b2a",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 4,
              opacity: (loading || areas.length === 0 || !fullName.trim() || !username.trim()) ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Salvando..." : "Entrar no ibhub"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  border: "1px solid #dde4ed",
  borderRadius: 10,
  background: "#f8f9fb",
  padding: "0 12px",
  fontSize: 14,
  color: "#0d1b2a",
  outline: "none",
  boxSizing: "border-box",
};
