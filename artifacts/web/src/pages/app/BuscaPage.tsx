import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { searchWebProfiles, sendWebConnectionRequest, WebSearchProfile } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  premium:   { label: "Premium",   color: "#8b5cf6" },
  exclusive: { label: "Exclusive", color: "#c9a84c" },
  business:  { label: "Business",  color: "#0d1b2a" },
};

function Avatar({ src, name, size = 48 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: NAVY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

function SearchIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}

function ProfileCard({ profile, currentUserId, onConnect }: {
  profile: WebSearchProfile;
  currentUserId: string;
  onConnect: (id: string) => void;
}) {
  const [, setLocation] = useLocation();
  const [sent, setSent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const plan = PLAN_LABELS[profile.plan ?? ""];

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (connecting || sent) return;
    setConnecting(true);
    await onConnect(profile.id);
    setSent(true);
    setConnecting(false);
  };

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", background: WHITE, borderBottom: `1px solid ${BORDER}`, cursor: "pointer", transition: "background 0.15s" }}
      onClick={() => setLocation(`/app/usuario/${profile.id}`)}
      onMouseEnter={e => (e.currentTarget.style.background = BG)}
      onMouseLeave={e => (e.currentTarget.style.background = WHITE)}
    >
      <Avatar src={profile.avatar_url} name={profile.full_name} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{profile.full_name}</span>
          {plan && (
            <span style={{ fontSize: 10, fontWeight: 700, color: plan.color, background: plan.color + "15", borderRadius: 6, padding: "2px 6px" }}>
              {plan.label}
            </span>
          )}
        </div>
        {profile.headline && (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile.headline}
          </div>
        )}
        {profile.username && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>@{profile.username}</div>
        )}
      </div>
      <button
        onClick={handleConnect}
        disabled={sent || connecting}
        style={{
          padding: "7px 16px",
          background: sent ? "#e8f5e9" : GOLD,
          color: sent ? "#16a34a" : WHITE,
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          cursor: sent ? "default" : "pointer",
          flexShrink: 0,
          fontFamily: "inherit",
          transition: "all 0.2s",
        }}
      >
        {sent ? "✓ Enviado" : connecting ? "…" : "Conectar"}
      </button>
    </div>
  );
}

export default function BuscaPage() {
  const { user } = useAuth();
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<WebSearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!user?.id) return;
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    const data = await searchWebProfiles(q, user.id, 30);
    setResults(data);
    setLoading(false);
  }, [user?.id]);

  const handleChange = (q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch(q), 350);
  };

  const handleConnect = async (targetId: string) => {
    if (!user?.id) return;
    await sendWebConnectionRequest(targetId, user.id);
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 60px" }}>
        {/* Search bar */}
        <div style={{ padding: "20px 20px 14px", background: WHITE, borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 10 }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 800, color: NAVY }}>Buscar Pessoas</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 16px" }}>
            <span style={{ color: MUTED, display: "flex" }}><SearchIcon /></span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleChange(e.target.value)}
              placeholder="Buscar por nome ou @usuário…"
              style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, color: NAVY, fontFamily: "inherit" }}
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>
        </div>

        {/* Results */}
        <div style={{ background: WHITE }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: MUTED }}>⏳ Buscando…</div>
          ) : results.length > 0 ? (
            <>
              <div style={{ padding: "10px 20px 4px", fontSize: 12, color: MUTED, fontWeight: 600 }}>
                {results.length} resultado{results.length !== 1 ? "s" : ""}
              </div>
              {results.map(p => (
                <ProfileCard key={p.id} profile={p} currentUserId={user?.id ?? ""} onConnect={handleConnect} />
              ))}
            </>
          ) : searched && !loading ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: "0 0 6px" }}>Nenhum resultado</p>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Tente outro nome ou @usuário</p>
            </div>
          ) : !searched ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🍷</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: NAVY, margin: "0 0 8px" }}>Encontre profissionais do vinho</p>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Pesquise por nome ou usuário para conectar com especialistas, produtores e importadores</p>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
