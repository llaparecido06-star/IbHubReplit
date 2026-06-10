import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import PlanBadge from "@/components/PlanBadge";
import {
  fetchPublicUserProfile,
  fetchProfileStats,
  UserProfile,
} from "@/services/api";

const GOLD  = "#c9a84c";
const NAVY  = "#0d1b2a";
const WHITE = "#ffffff";
const BG    = "#f5f0e8";

function Avatar({ src, name, size = 88 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", border: `3px solid ${GOLD}`,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: NAVY, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.38, fontWeight: 800,
      color: GOLD, border: `3px solid ${GOLD}`, flexShrink: 0,
    }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{value}</div>
      <div style={{ fontSize: 12, color: "#7a8494", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CadastroModal({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(13,27,42,0.75)",
      zIndex: 1000, display: "flex", alignItems: "flex-end",
      justifyContent: "center", padding: "0 0 0 0",
    }} onClick={onClose}>
      <div
        style={{
          background: WHITE, borderRadius: "20px 20px 0 0",
          padding: "32px 24px 40px", width: "100%", maxWidth: 480,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            IBHUB - A Rede do Vinho
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>
            Conecte-se ao mercado do vinho
          </h2>
          <p style={{ fontSize: 14, color: "#7a8494", margin: 0, lineHeight: 1.5 }}>
            Junte-se à maior rede profissional do vinho do Brasil. Conecte-se com produtores, importadores e sommeliers.
          </p>
        </div>
        <button
          onClick={() => setLocation("/cadastro")}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 12,
            background: GOLD, color: WHITE, fontWeight: 700,
            fontSize: 16, border: "none", cursor: "pointer",
            marginBottom: 10,
          }}
        >
          Criar conta grátis
        </button>
        <button
          onClick={() => setLocation("/login")}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 12,
            background: "transparent", color: NAVY, fontWeight: 600,
            fontSize: 15, border: `1.5px solid #ddd`, cursor: "pointer",
            marginBottom: 14,
          }}
        >
          Já tenho conta
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%", background: "none", border: "none",
            color: "#7a8494", fontSize: 13, cursor: "pointer",
          }}
        >
          Continuar visitando
        </button>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats]     = useState({ connections: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [appAttempted, setAppAttempted] = useState(false);

  // Fetch profile data
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchPublicUserProfile(id),
      fetchProfileStats(id),
    ]).then(([p, s]) => {
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p);
      setStats(s);
      setLoading(false);
    }).catch(() => {
      setNotFound(true);
      setLoading(false);
    });
  }, [id]);

  // After auth loads: if not logged in, show signup modal after 4 seconds
  useEffect(() => {
    if (authLoading || loading) return;
    if (session) return;
    const t = setTimeout(() => setShowModal(true), 4000);
    return () => clearTimeout(t);
  }, [authLoading, loading, session]);

  // Try to open app on mobile (once)
  useEffect(() => {
    if (!id || appAttempted) return;
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (!isMobile) return;
    setAppAttempted(true);
    const deepLink = `ibhub://profile/${id}`;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = deepLink;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, [id, appAttempted]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: `3px solid rgba(201,168,76,0.2)`, borderTopColor: GOLD,
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>🍷</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: 0 }}>Perfil não encontrado</h2>
        <p style={{ color: "#7a8494", fontSize: 14, margin: 0 }}>Esse usuário pode ter encerrado sua conta.</p>
        <button
          onClick={() => setLocation("/cadastro")}
          style={{ marginTop: 8, padding: "12px 28px", borderRadius: 10, background: GOLD, color: WHITE, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
        >
          Criar minha conta
        </button>
      </div>
    );
  }

  const name     = profile.full_name ?? "Usuário";
  const username = profile.username;
  const headline = profile.headline ?? profile.position ?? "";
  const company  = profile.company ?? "";
  const bio      = profile.bio ?? "";

  return (
    <>
      {showModal && <CadastroModal onClose={() => setShowModal(false)} />}

      <div style={{ minHeight: "100vh", background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {/* Top bar */}
        <div style={{ background: NAVY, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: GOLD, letterSpacing: 1.5, textTransform: "uppercase" }}>ibhub</span>
          {!session && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setLocation("/login")}
                style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", color: WHITE, fontWeight: 600, fontSize: 13, border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}
              >
                Entrar
              </button>
              <button
                onClick={() => setLocation("/cadastro")}
                style={{ padding: "7px 14px", borderRadius: 8, background: GOLD, color: WHITE, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
              >
                Cadastrar
              </button>
            </div>
          )}
        </div>

        {/* Profile card */}
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 80px" }}>
          <div style={{ background: WHITE, borderRadius: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            {/* Cover */}
            <div style={{ height: 90, background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a5f 100%)`, borderRadius: "18px 18px 0 0" }} />

            {/* Avatar + name row */}
            <div style={{ padding: "0 20px 20px", position: "relative" }}>
              <div style={{ marginTop: -44, marginBottom: 10 }}>
                <Avatar src={profile.avatar_url} name={name} size={88} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: 0 }}>{name}</h1>
                    <PlanBadge plan={profile.plan} hideFree />
                  </div>
                  {username && (
                    <div style={{ fontSize: 13, color: "#7a8494", marginTop: 2 }}>@{username}</div>
                  )}
                </div>
              </div>

              {(headline || company) && (
                <div style={{ fontSize: 14, color: "#374151", marginTop: 10, lineHeight: 1.4 }}>
                  {headline}{headline && company ? " · " : ""}{company}
                </div>
              )}

              {bio && (
                <p style={{ fontSize: 14, color: "#555", marginTop: 10, lineHeight: 1.6, margin: "10px 0 0" }}>
                  {bio}
                </p>
              )}

              {/* Stats */}
              <div style={{ display: "flex", borderTop: "1px solid #f0ece4", marginTop: 16, paddingTop: 16, gap: 4 }}>
                <StatBox value={stats.connections} label="Conexões" />
                <div style={{ width: 1, background: "#e8e8e3", margin: "0 4px" }} />
                <StatBox value={stats.followers} label="Seguidores" />
                <div style={{ width: 1, background: "#e8e8e3", margin: "0 4px" }} />
                <StatBox value={stats.following} label="Seguindo" />
              </div>
            </div>
          </div>

          {/* Open in app CTA */}
          <div style={{ marginTop: 16, background: WHITE, borderRadius: 14, padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#374151", marginBottom: 14, lineHeight: 1.5 }}>
              Conecte-se com <strong>{name}</strong> e outros profissionais do vinho na ibhub
            </div>
            <a
              href={`ibhub://profile/${id}`}
              style={{
                display: "block", padding: "13px 20px", borderRadius: 11,
                background: GOLD, color: WHITE, fontWeight: 700, fontSize: 15,
                textDecoration: "none", marginBottom: 10,
              }}
            >
              Abrir no app ibhub
            </a>
            {!session && (
              <button
                onClick={() => setLocation("/cadastro")}
                style={{
                  width: "100%", padding: "12px 20px", borderRadius: 11,
                  background: "transparent", color: NAVY, fontWeight: 600,
                  fontSize: 14, border: `1.5px solid #ddd`, cursor: "pointer",
                }}
              >
                Criar conta grátis
              </button>
            )}
            {session && (
              <button
                onClick={() => setLocation(`/app/usuario/${id}`)}
                style={{
                  width: "100%", padding: "12px 20px", borderRadius: 11,
                  background: "transparent", color: NAVY, fontWeight: 600,
                  fontSize: 14, border: `1.5px solid #ddd`, cursor: "pointer",
                }}
              >
                Ver perfil completo
              </button>
            )}
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 28, color: "#aaa", fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: GOLD }}>IBHUB</span> - A Rede do Vinho · Brasil
          </div>
        </div>
      </div>
    </>
  );
}
