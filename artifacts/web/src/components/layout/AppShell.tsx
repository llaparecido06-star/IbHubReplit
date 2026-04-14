import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/app", label: "Feed", icon: "🏠" },
  { path: "/app/oportunidades", label: "Oportunidades", icon: "💼" },
  { path: "/app/adega", label: "Adega", icon: "🍷" },
  { path: "/app/mercado", label: "Mercado", icon: "📊" },
];

function isActive(current: string, path: string): boolean {
  if (path === "/app") return current === "/app" || current === "/app/";
  return current.startsWith(path);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = profile?.full_name ?? user?.email ?? "Usuário";
  const initial = displayName[0]?.toUpperCase() ?? "U";

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f2f3f5", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top Navigation */}
      <nav style={{
        backgroundColor: NAVY,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <span
            style={{ fontSize: 20, fontWeight: 900, color: GOLD, cursor: "pointer" }}
            onClick={() => setLocation("/app")}
          >ibhub</span>
          {/* Desktop nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                style={{
                  background: isActive(location, item.path) ? "rgba(201,168,76,0.15)" : "none",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  color: isActive(location, item.path) ? GOLD : "rgba(255,255,255,0.65)",
                  fontSize: 13,
                  fontWeight: isActive(location, item.path) ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {profile?.is_admin && (
            <button
              onClick={() => setLocation("/admin")}
              style={{
                background: location.startsWith("/admin") ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.08)",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: 8,
                padding: "6px 12px",
                color: GOLD,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⚙️ Admin
            </button>
          )}
          <button
            onClick={() => setLocation("/assinar")}
            style={{
              background: "none",
              border: "1px solid rgba(201,168,76,0.4)",
              borderRadius: 8,
              padding: "6px 12px",
              color: GOLD,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Planos
          </button>
          <div
            onClick={() => setLocation("/minha-conta")}
            style={{
              width: 34, height: 34, borderRadius: "50%",
              backgroundColor: "#722f37",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#fff",
              cursor: "pointer",
              title: displayName,
            }}
          >{initial}</div>
          <button
            onClick={handleSignOut}
            style={{
              fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)",
              background: "none", border: "none", cursor: "pointer",
            }}
          >Sair</button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
