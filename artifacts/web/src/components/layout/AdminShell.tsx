import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

interface AdminNavItem {
  path: string;
  label: string;
  icon: string;
}

const ADMIN_NAV: AdminNavItem[] = [
  { path: "/admin", label: "Dashboard", icon: "📊" },
  { path: "/admin/usuarios", label: "Usuários", icon: "👥" },
  { path: "/admin/moderacao", label: "Moderação", icon: "🛡️" },
  { path: "/admin/notificacoes", label: "Notificações", icon: "📢" },
];

function isActive(current: string, path: string): boolean {
  if (path === "/admin") return current === "/admin" || current === "/admin/";
  return current.startsWith(path);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const [location, setLocation] = useLocation();

  const displayName = profile?.full_name ?? user?.email ?? "Admin";
  const initial = displayName[0]?.toUpperCase() ?? "A";

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f2f3f5", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
      <nav style={{
        backgroundColor: "#1a0a1e",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        boxShadow: "0 2px 16px rgba(0,0,0,0.25)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>ibhub</span>
            <span style={{ fontSize: 10, fontWeight: 800, backgroundColor: GOLD, color: "#fff", padding: "2px 6px", borderRadius: 4, letterSpacing: 1 }}>ADMIN</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {ADMIN_NAV.map((item) => (
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
          <button
            onClick={() => setLocation("/app")}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              padding: "6px 12px",
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >← App</button>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            backgroundColor: "#722f37",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff",
          }}>{initial}</div>
          <button
            onClick={handleSignOut}
            style={{
              fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)",
              background: "none", border: "none", cursor: "pointer",
            }}
          >Sair</button>
        </div>
      </nav>

      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
