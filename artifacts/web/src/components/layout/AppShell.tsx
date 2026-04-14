import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { fetchProfileStats } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const BG     = "#f5f5f0";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

interface NavItem { path: string; label: string; icon: React.ReactNode }

const NAV_ITEMS: NavItem[] = [
  { path: "/app",                label: "Feed",         icon: <HomeIcon /> },
  { path: "/app/mercado",        label: "Mercado",      icon: <BarChartIcon /> },
  { path: "/app/oportunidades",  label: "Oportunidades", icon: <BriefcaseIcon /> },
  { path: "/app/mensagens",      label: "Mensagens",    icon: <MessageIcon /> },
  { path: "/app/grupos",         label: "Grupos",       icon: <GroupIcon /> },
  { path: "/app/adega",          label: "Adega",        icon: <WineIcon /> },
];

function isActive(current: string, path: string): boolean {
  if (path === "/app") return current === "/app" || current === "/app/";
  return current.startsWith(path);
}

/* ─── SVG Icons ──────────────────────────── */
function HomeIcon()      { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function BarChartIcon()  { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function BriefcaseIcon() { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>; }
function MessageIcon()   { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function GroupIcon()     { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function WineIcon()      { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 22H5a2 2 0 0 1-2-2V6l3-3h14a2 2 0 0 1 2 2v5"/><circle cx="16" cy="16" r="6"/></svg>; }
function SaveIcon()      { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>; }
function SettingsIcon()  { return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function BellIcon()      { return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function SearchIcon()    { return <svg width="16" height="16" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function ChevronDown()   { return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>; }

/* ─── Avatar ─────────────────────────────── */
function Avatar({ src, name, size = 36, bg = "#722f37" }: { src?: string | null; name: string; size?: number; bg?: string }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", backgroundColor: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0,
    }}>
      {(name?.[0] ?? "U").toUpperCase()}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const [location, setLocation] = useLocation();
  const [stats, setStats] = useState({ connections: 0, followers: 0, visits: 0 });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Usuário";
  const username = profile?.username ? `@${profile.username}` : "";

  useEffect(() => {
    if (profile?.id) {
      fetchProfileStats(profile.id).then(setStats);
    }
  }, [profile?.id]);

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG, fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ── Top bar ────────────────────────── */}
      <header style={{
        backgroundColor: WHITE,
        borderBottom: `1px solid ${BORDER}`,
        position: "sticky", top: 0, zIndex: 200,
        height: 56,
        display: "flex", alignItems: "center",
        padding: "0 24px", gap: 16,
      }}>
        {/* Logo */}
        <span
          style={{ fontSize: 18, fontWeight: 900, color: GOLD, cursor: "pointer", flexShrink: 0, letterSpacing: -0.3 }}
          onClick={() => setLocation("/app")}
        >ibhub</span>

        {/* Search */}
        <div style={{
          flex: 1, maxWidth: 400,
          display: "flex", alignItems: "center", gap: 8,
          backgroundColor: "#f2f2ed", borderRadius: 24, padding: "7px 14px",
        }}>
          <SearchIcon />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pessoas, empresas, hashtags..."
            style={{
              border: "none", background: "none", outline: "none",
              fontSize: 13, color: NAVY, width: "100%",
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Admin */}
        {profile?.is_admin && (
          <button
            onClick={() => setLocation("/admin")}
            style={{ background: "none", border: `1px solid ${GOLD}55`, borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: GOLD, cursor: "pointer" }}
          >⚙ Admin</button>
        )}

        {/* Bell */}
        <button style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", padding: 4 }}>
          <BellIcon />
        </button>

        {/* User menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Avatar src={profile?.avatar_url} name={displayName} size={32} />
            <ChevronDown />
          </button>

          {userMenuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)",
              backgroundColor: WHITE, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: 8, minWidth: 180,
              boxShadow: "0 4px 24px rgba(0,0,0,0.1)", zIndex: 300,
            }}>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{displayName}</div>
                {username && <div style={{ fontSize: 12, color: MUTED }}>{username}</div>}
              </div>
              {[
                { label: "Minha conta", path: "/minha-conta" },
                { label: "Planos & Assinatura", path: "/assinar" },
              ].map(({ label, path }) => (
                <button key={path} onClick={() => { setUserMenuOpen(false); setLocation(path); }} style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "none", border: "none", padding: "8px 12px",
                  fontSize: 13, color: NAVY, cursor: "pointer", borderRadius: 6,
                }}>
                  {label}
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 4, paddingTop: 4 }}>
                <button onClick={handleSignOut} style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "none", border: "none", padding: "8px 12px",
                  fontSize: 13, color: "#e53e3e", cursor: "pointer", borderRadius: 6,
                }}>
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Body (sidebar + main) ───────────── */}
      <div style={{ display: "flex", maxWidth: 1180, margin: "0 auto", padding: "20px 16px", gap: 20, alignItems: "flex-start" }}>

        {/* ── Sidebar ──────────────────────── */}
        <aside style={{
          width: 250, flexShrink: 0,
          position: "sticky", top: 76, maxHeight: "calc(100vh - 96px)", overflowY: "auto",
        }}>
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            {/* Cover gradient */}
            <div style={{
              height: 64,
              background: "linear-gradient(135deg, #e8e0d0 0%, #d4c9a8 100%)",
            }} />

            {/* Avatar */}
            <div style={{ padding: "0 16px 16px", marginTop: -24 }}>
              <div style={{ marginBottom: 10 }}>
                <Avatar src={profile?.avatar_url} name={displayName} size={48} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 2 }}>{displayName}</div>
              {username && <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>{username}</div>}

              {/* Stats */}
              <div style={{
                display: "flex", borderTop: `1px solid ${BORDER}`, paddingTop: 12,
                gap: 0,
              }}>
                {[
                  { label: "Conexões", value: stats.connections },
                  { label: "Seguidores", value: stats.followers },
                  { label: "Visitas", value: stats.visits },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    flex: 1, textAlign: "center",
                    borderRight: i < 2 ? `1px solid ${BORDER}` : "none",
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Nav card */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "8px 0", marginBottom: 12 }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(location, item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "10px 16px",
                    background: active ? `${GOLD}12` : "none",
                    border: "none", cursor: "pointer", textAlign: "left",
                    color: active ? GOLD : NAVY,
                    fontSize: 14, fontWeight: active ? 700 : 500,
                    borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
                    transition: "all 0.12s",
                  }}
                >
                  <span style={{ opacity: active ? 1 : 0.55, flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                  {active && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", backgroundColor: GOLD }} />}
                </button>
              );
            })}

            {/* Criar publicação */}
            <div style={{ padding: "12px 12px 8px" }}>
              <button
                onClick={() => setLocation("/app")}
                style={{
                  width: "100%", padding: "11px 0",
                  backgroundColor: GOLD, color: NAVY,
                  fontWeight: 800, fontSize: 14, border: "none", borderRadius: 10,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>+</span> Criar publicação
              </button>
            </div>
          </div>

          {/* Bottom links */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "4px 0" }}>
            {[
              { label: "Itens salvos", icon: <SaveIcon />, path: "/app/salvos" },
              { label: "Configurações", icon: <SettingsIcon />, path: "/minha-conta" },
            ].map(({ label, icon, path }) => (
              <button key={label} onClick={() => setLocation(path)} style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 16px",
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 500, color: MUTED, textAlign: "left",
              }}>
                {icon}{label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main content ─────────────────── */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>

      {/* Click-outside to close menu */}
      {userMenuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 199 }}
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </div>
  );
}
