import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const SIDEBAR_W = 228;

const SECTIONS = [
  {
    title: "VISÃO GERAL",
    items: [
      { path: "/admin",                     label: "Dashboard",         icon: "⊞" },
      { path: "/admin/logs",                label: "Logs de Atividade", icon: "◎" },
    ],
  },
  {
    title: "GESTÃO DE CONTEÚDO",
    items: [
      { path: "/admin/momentos",            label: "Momentos",          icon: "▶" },
      { path: "/admin/eventos",             label: "Eventos",           icon: "📅" },
      { path: "/admin/marketplace",         label: "Marketplace",       icon: "🛍" },
      { path: "/admin/slides-mercado",      label: "Mercado",           icon: "📊" },
      { path: "/admin/presentation-slides", label: "Slides de Apres.",  icon: "⧉" },
      { path: "/admin/moderacao",           label: "Moderação",         icon: "🛡" },
    ],
  },
  {
    title: "USUÁRIOS & RECEITA",
    items: [
      { path: "/admin/crm",                 label: "CRM Usuários",      icon: "👥" },
      { path: "/admin/financeiro",          label: "Financeiro",        icon: "💳" },
      { path: "/admin/plan-builder",        label: "Plan Builder",      icon: "📦" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { path: "/admin/comunicacao",         label: "Comunicação",       icon: "📢" },
      { path: "/admin/admins",              label: "Admins",            icon: "🔐" },
      { path: "/admin/configuracoes",       label: "Configurações",     icon: "⚙" },
    ],
  },
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

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.09)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: GOLD }}>ibhub</span>
          <span style={{ fontSize: 9, fontWeight: 800, backgroundColor: GOLD, color: "#fff", padding: "2px 7px", borderRadius: 4, letterSpacing: 1 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#722f37", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Administrador</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 2 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: "rgba(255,255,255,0.28)", padding: "10px 16px 4px", textTransform: "uppercase" }}>
              {section.title}
            </div>
            {section.items.map((item) => {
              const active = isActive(location, item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "8px 16px 8px 13px",
                    background: active ? "rgba(201,168,76,0.13)" : "none",
                    border: "none",
                    borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    color: active ? GOLD : "rgba(255,255,255,0.6)",
                    fontSize: 13,
                    fontWeight: active ? 700 : 400,
                    transition: "all 0.12s",
                  }}
                >
                  <span style={{ fontSize: 13, width: 18, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.09)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          onClick={() => setLocation("/app")}
          style={{ width: "100%", padding: "7px 12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
        >← Voltar ao App</button>
        <button
          onClick={handleSignOut}
          style={{ width: "100%", padding: "7px 12px", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "left" }}
        >Sair</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f2f3f5", fontFamily: "'Inter', sans-serif", display: "flex" }}>
      <div style={{ width: SIDEBAR_W, backgroundColor: NAVY, flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <SidebarContent />
      </div>
      <main style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
        {children}
      </main>
    </div>
  );
}
