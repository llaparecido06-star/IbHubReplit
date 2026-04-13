import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

const QUICK_LINKS = [
  { path: "/app/oportunidades", icon: "💼", title: "Oportunidades", desc: "Marketplace, vagas e eventos do setor" },
  { path: "/app/adega", icon: "🍷", title: "Adega", desc: "Gerencie seu inventário de vinhos" },
  { path: "/app/mercado", icon: "📊", title: "Mercado", desc: "Dados e KPIs do setor vitivinícola" },
];

export default function AppFeedPage() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();

  const firstName = profile?.full_name?.split(" ")[0] ?? "Usuário";

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
        {/* Welcome */}
        <div style={{
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: "32px 40px",
          textAlign: "center",
          border: "1px solid #e8eaed",
          marginBottom: 28,
        }}>
          <div style={{
            width: 76, height: 76, borderRadius: "50%", backgroundColor: "#722f37",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 900, color: "#fff", margin: "0 auto 20px",
          }}>
            {(profile?.full_name ?? "U")?.[0]?.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, marginBottom: 10 }}>
            Bem-vindo(a), {firstName}! 🍷
          </h1>
          <p style={{ fontSize: 15, color: "#8a93a2", lineHeight: 1.7, marginBottom: 20 }}>
            Explore as funcionalidades do ibhub — a rede do mundo vitivinícola.
          </p>
          {profile?.plan && (
            <div style={{
              display: "inline-block",
              backgroundColor: `${GOLD}14`,
              border: `1px solid ${GOLD}40`,
              borderRadius: 100,
              padding: "6px 18px",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>
                Plano {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}
              </span>
            </div>
          )}
        </div>

        {/* Quick links */}
        <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 14px" }}>Explore o ibhub</h2>
        <div style={{ display: "grid", gap: 12, marginBottom: 28 }}>
          {QUICK_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => setLocation(link.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "20px 24px",
                backgroundColor: "#fff",
                border: "1px solid #e8eaed",
                borderRadius: 14,
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = GOLD;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${GOLD}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e8eaed";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, backgroundColor: `${GOLD}14`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, flexShrink: 0,
              }}>{link.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 3 }}>{link.title}</div>
                <div style={{ fontSize: 13, color: "#8a93a2" }}>{link.desc}</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 20, color: "#e8eaed" }}>›</div>
            </button>
          ))}
        </div>

        {profile?.areas_of_expertise && profile.areas_of_expertise.length > 0 && (
          <div style={{ backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed", padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: "0 0 12px" }}>Suas áreas de expertise</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {profile.areas_of_expertise.map((area) => (
                <span key={area} style={{
                  backgroundColor: "#f2f3f5",
                  border: "1px solid #e8eaed",
                  borderRadius: 100,
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: NAVY,
                }}>{area}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
