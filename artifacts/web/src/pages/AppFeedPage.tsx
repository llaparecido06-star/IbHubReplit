import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

export default function AppFeedPage() {
  const { profile, user, signOut } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const displayName = profile?.full_name ?? user?.email ?? "Usuário";
  const initial = displayName[0]?.toUpperCase() ?? "U";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f2f3f5", fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <nav style={{
        backgroundColor: "#0d1b2a",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: "#c9a84c" }}>ibhub</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{displayName}</span>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            backgroundColor: "#722f37",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#ffffff",
          }}>{initial}</div>
          <button
            onClick={handleSignOut}
            style={{
              fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)",
              background: "none", border: "none", cursor: "pointer",
            }}
          >Sair</button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(13,27,42,0.07)",
          border: "1px solid #eef0f3",
        }}>
          <div style={{
            width: 72, height: 72,
            borderRadius: "50%",
            backgroundColor: "#722f37",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 900,
            color: "#ffffff",
            margin: "0 auto 20px",
          }}>{initial}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0d1b2a", marginBottom: 8 }}>
            Bem-vindo(a), {profile?.full_name?.split(" ")[0] ?? "Usuário"}! 🍷
          </h1>
          <p style={{ fontSize: 15, color: "#8a93a2", lineHeight: 1.7, marginBottom: 24 }}>
            Sua conta foi criada com sucesso. O feed completo está chegando em breve —
            nossa próxima versão trará todas as funcionalidades sociais.
          </p>
          {profile?.plan && (
            <div style={{
              display: "inline-block",
              backgroundColor: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.3)",
              borderRadius: 100,
              padding: "6px 16px",
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c" }}>
                Plano {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}
              </span>
            </div>
          )}
          {profile?.areas_of_expertise && profile.areas_of_expertise.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {profile.areas_of_expertise.map((area) => (
                <span key={area} style={{
                  backgroundColor: "#f2f3f5",
                  border: "1px solid #e8eaed",
                  borderRadius: 100,
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#0d1b2a",
                }}>{area}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
