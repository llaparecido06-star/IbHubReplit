import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchProfileStats,
  fetchUserPosts,
  fetchConnectionsList,
  fetchFollowersList,
  fetchFollowingList,
  Post,
  ProfilePerson,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f5f5f0";

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

function PlanBadge({ plan }: { plan?: string }) {
  const colors: Record<string, string> = {
    exclusive: "#7B2FBE",
    executivo: "#7B2FBE",
    business: "#1a56db",
    empresa: "#1a56db",
    premium: GOLD,
    profissional: GOLD,
  };
  const labels: Record<string, string> = {
    exclusive: "Executivo",
    executivo: "Executivo",
    business: "Business",
    empresa: "Business",
    premium: "Premium",
    profissional: "Premium",
    free: "Gratuito",
  };
  const color = plan ? (colors[plan] ?? "#6b7280") : "#6b7280";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: WHITE, backgroundColor: color, padding: "2px 8px", borderRadius: 100 }}>
      {labels[plan ?? ""] ?? "Gratuito"}
    </span>
  );
}

function PeopleListModal({ title, list, onClose }: { title: string; list: ProfilePerson[]; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: WHITE, borderRadius: 16, padding: 24, minWidth: 340, maxWidth: 440, maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20 }}>×</button>
        </div>
        {list.length === 0 ? (
          <div style={{ textAlign: "center", color: MUTED, fontSize: 14, padding: "24px 0" }}>Nenhuma pessoa encontrada.</div>
        ) : (
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar src={p.avatar_url} name={p.full_name} size={40} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{p.full_name}</div>
                  {p.headline && <div style={{ fontSize: 12, color: MUTED }}>{p.headline}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniPostCard({ post }: { post: Post }) {
  const content = post.content ?? "";
  const displayContent = content.length > 200 ? content.slice(0, 200).trimEnd() + "…" : content;
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{displayContent}</div>
      {post.image_url && <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 8, marginTop: 10 }} />}
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: MUTED }}>
        <span>👍 {post.likes_count}</span>
        <span>💬 {post.comments_count}</span>
        <span style={{ marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
      </div>
    </div>
  );
}

type ProfileTab = "publicacoes" | "sobre";

export default function MeuPerfilPage() {
  const { profile, user } = useAuth();
  const [, setLocation] = useLocation();

  const [stats, setStats] = useState({ connections: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<ProfileTab>("publicacoes");
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [peopleModal, setPeopleModal] = useState<{ title: string; list: ProfilePerson[] } | null>(null);

  const userId = profile?.id ?? user?.id ?? "";
  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Usuário";
  const username = profile?.username ? `@${profile.username}` : "";
  const bio = (profile as any)?.bio ?? null;
  const headline = (profile as any)?.headline ?? null;
  const position = (profile as any)?.position ?? null;
  const company = (profile as any)?.company ?? null;
  const memberSince = (profile as any)?.created_at ? new Date((profile as any).created_at).getFullYear() : null;

  useEffect(() => {
    if (!userId) { setLoadingPosts(false); return; }
    fetchProfileStats(userId).then(setStats);
    fetchUserPosts(userId).then(data => { setPosts(data); setLoadingPosts(false); });
  }, [userId]);

  const openConnections = async () => {
    const list = await fetchConnectionsList(userId);
    setPeopleModal({ title: "Conexões", list });
  };
  const openFollowers = async () => {
    const list = await fetchFollowersList(userId);
    setPeopleModal({ title: "Seguidores", list });
  };
  const openFollowing = async () => {
    const list = await fetchFollowingList(userId);
    setPeopleModal({ title: "Seguindo", list });
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header / Cover */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
          {/* Cover */}
          <div style={{ height: 100, background: `linear-gradient(135deg, #722f37 0%, #9b3a4a 60%, ${GOLD} 100%)` }} />

          {/* Avatar + actions */}
          <div style={{ padding: "0 20px 20px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -28 }}>
              <div style={{ border: "3px solid white", borderRadius: "50%" }}>
                <Avatar src={(profile as any)?.avatar_url} name={displayName} size={80} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setLocation("/minha-conta")} style={{ padding: "8px 16px", backgroundColor: WHITE, color: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Editar perfil
                </button>
              </div>
            </div>

            {/* Name + plan */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: 0 }}>{displayName}</h1>
                <PlanBadge plan={(profile as any)?.plan} />
              </div>
              {username && <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{username}</div>}
              {headline && <div style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>{headline}</div>}
              {(position || company) && (
                <div style={{ fontSize: 13, color: NAVY, marginTop: 4 }}>
                  {[position, company].filter(Boolean).join(" · ")}
                </div>
              )}
              {memberSince && (
                <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
                  Membro desde {memberSince}
                </div>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              {[
                { label: "Conexões", value: stats.connections, onClick: openConnections },
                { label: "Seguidores", value: stats.followers, onClick: openFollowers },
                { label: "Seguindo",  value: stats.following,  onClick: openFollowing  },
              ].map(s => (
                <div key={s.label} onClick={s.onClick} style={{ cursor: "pointer", textAlign: "center" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0 4px", marginBottom: 16, display: "flex" }}>
          {(["publicacoes", "sobre"] as ProfileTab[]).map(t => {
            const labels: Record<ProfileTab, string> = { publicacoes: "Publicações", sobre: "Sobre" };
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
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Compartilhe seu conhecimento sobre vinho com a comunidade</p>
            </div>
          ) : (
            posts.map(post => <MiniPostCard key={post.id} post={post} />)
          )
        ) : (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: "0 0 16px" }}>Sobre mim</h3>
            {bio ? (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 16px" }}>{bio}</p>
            ) : (
              <p style={{ fontSize: 14, color: MUTED, margin: "0 0 16px" }}>Nenhuma bio adicionada ainda.</p>
            )}

            {(position || company) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>Experiência</div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>🏢</span>
                  </div>
                  <div>
                    {position && <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{position}</div>}
                    {company && <div style={{ fontSize: 13, color: MUTED }}>{company}</div>}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <button onClick={() => setLocation("/minha-conta")} style={{ padding: "9px 20px", backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}50`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Editar informações
              </button>
            </div>
          </div>
        )}
      </div>

      {peopleModal && (
        <PeopleListModal title={peopleModal.title} list={peopleModal.list} onClose={() => setPeopleModal(null)} />
      )}
    </AppShell>
  );
}
