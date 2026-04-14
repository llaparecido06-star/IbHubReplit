import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchPublicUserProfile,
  fetchUserPosts,
  fetchProfileStats,
  sendWebConnectionRequest,
  UserProfile,
  Post,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: "#722f37", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0 }}>
      {(name?.[0] ?? "U").toUpperCase()}
    </div>
  );
}

function PlanBadge({ plan }: { plan?: string | null }) {
  if (!plan || plan === "free") return null;
  const colors: Record<string, string> = {
    exclusive: "#7B2FBE", executivo: "#7B2FBE",
    business: "#1a56db", empresa: "#1a56db",
    premium: GOLD, profissional: GOLD,
  };
  const labels: Record<string, string> = {
    exclusive: "Executivo", executivo: "Executivo",
    business: "Business", empresa: "Business",
    premium: "Premium", profissional: "Premium",
  };
  const color = colors[plan] ?? "#6b7280";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: WHITE, backgroundColor: color, padding: "2px 8px", borderRadius: 100 }}>
      {labels[plan] ?? plan}
    </span>
  );
}

function MiniPostCard({ post }: { post: Post }) {
  const content = post.content ?? "";
  const displayContent = content.length > 200 ? content.slice(0, 200).trimEnd() + "…" : content;
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{displayContent}</div>
      {post.image_url && <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginTop: 10 }} />}
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: MUTED }}>
        <span>👍 {post.likes_count}</span>
        <span>💬 {post.comments_count}</span>
        <span style={{ marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
      </div>
    </div>
  );
}

export default function PerfilUsuarioPage() {
  const { id: targetId } = useParams<{ id: string }>();
  const { profile: currentProfile, user } = useAuth();
  const [, setLocation] = useLocation();

  const currentUserId = currentProfile?.id ?? user?.id ?? "";

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ connections: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [tab, setTab] = useState<"publicacoes" | "sobre">("publicacoes");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    // If viewing own profile, redirect to /app/perfil
    if (targetId === currentUserId) {
      setLocation("/app/perfil");
      return;
    }
    setLoadingProfile(true);
    setLoadingPosts(true);
    Promise.all([
      fetchPublicUserProfile(targetId),
      fetchProfileStats(targetId),
      fetchUserPosts(targetId),
    ]).then(([prof, s, p]) => {
      setUserProfile(prof);
      setStats(s);
      setPosts(p);
      setLoadingProfile(false);
      setLoadingPosts(false);
    });
  }, [targetId, currentUserId]);

  const handleConnect = async () => {
    if (!currentUserId || connecting || connected) return;
    setConnecting(true);
    await sendWebConnectionRequest(targetId!, currentUserId);
    setConnected(true);
    setConnecting(false);
  };

  if (loadingProfile) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍷</div>
          Carregando perfil…
        </div>
      </AppShell>
    );
  }

  if (!userProfile) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>Perfil não encontrado</h2>
          <p style={{ fontSize: 14, color: MUTED }}>Este usuário não existe ou foi removido.</p>
          <button onClick={() => setLocation("/app")} style={{ marginTop: 16, padding: "10px 24px", backgroundColor: GOLD, color: WHITE, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Voltar ao feed
          </button>
        </div>
      </AppShell>
    );
  }

  const headline = userProfile.headline ?? [userProfile.position, userProfile.company].filter(Boolean).join(" · ");

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Back */}
        <button onClick={() => history.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Voltar
        </button>

        {/* Profile card */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
          {/* Cover */}
          <div style={{ height: 100, background: `linear-gradient(135deg, #722f37 0%, #9b3a4a 60%, ${GOLD} 100%)` }} />

          <div style={{ padding: "0 20px 20px", position: "relative" }}>
            {/* Avatar + actions row */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -28 }}>
              <div style={{ border: "3px solid white", borderRadius: "50%" }}>
                <Avatar src={userProfile.avatar_url} name={userProfile.full_name} size={80} />
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
                <button
                  onClick={handleConnect}
                  disabled={connecting || connected}
                  style={{
                    padding: "8px 18px", border: "none", borderRadius: 10,
                    fontSize: 13, fontWeight: 700, cursor: connected || connecting ? "default" : "pointer",
                    backgroundColor: connected ? "#e8f5e9" : GOLD,
                    color: connected ? "#16a34a" : WHITE,
                  }}>
                  {connected ? "✓ Solicitado" : connecting ? "…" : "Conectar"}
                </button>
              </div>
            </div>

            {/* Name + plan */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: 0 }}>{userProfile.full_name}</h1>
                <PlanBadge plan={userProfile.plan} />
              </div>
              {userProfile.username && <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>@{userProfile.username}</div>}
              {headline && <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{headline}</div>}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              {[
                { label: "Conexões", value: stats.connections },
                { label: "Seguidores", value: stats.followers },
                { label: "Seguindo",  value: stats.following },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0 4px", marginBottom: 16, display: "flex" }}>
          {(["publicacoes", "sobre"] as const).map(t => {
            const labels = { publicacoes: "Publicações", sobre: "Sobre" };
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "14px 8px", background: "none", border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: active ? 800 : 500,
                color: active ? GOLD : MUTED,
                borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
                fontFamily: "inherit",
              }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "publicacoes" ? (
          loadingPosts ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🍷</div>Carregando publicações…
            </div>
          ) : posts.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Nenhuma publicação ainda</h3>
            </div>
          ) : (
            posts.map(post => <MiniPostCard key={post.id} post={post} />)
          )
        ) : (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: "0 0 16px" }}>Sobre</h3>
            {userProfile.bio ? (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 16px" }}>{userProfile.bio}</p>
            ) : (
              <p style={{ fontSize: 14, color: MUTED, margin: "0 0 16px" }}>Nenhuma bio adicionada.</p>
            )}
            {(userProfile.position || userProfile.company) && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16 }}>🏢</span>
                </div>
                <div>
                  {userProfile.position && <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{userProfile.position}</div>}
                  {userProfile.company && <div style={{ fontSize: 13, color: MUTED }}>{userProfile.company}</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
