import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}
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
  const { profile, user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const width = useWindowWidth();
  const isMobile = width < 768;

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
    if (authLoading) return;
    if (!userId) { setLoadingPosts(false); return; }
    fetchProfileStats(userId).then(setStats).catch(() => {});
    fetchUserPosts(userId)
      .then(data => { setPosts(data); setLoadingPosts(false); })
      .catch(() => setLoadingPosts(false));
  }, [userId, authLoading]);

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

  const completion = (() => {
    if (!profile) return 0;
    const fields = [
      !!profile.full_name,
      !!profile.username,
      !!(profile as any).headline,
      !!(profile as any).bio,
      !!(profile as any).avatar_url,
      !!((profile as any).areas_of_expertise ?? []).length,
      !!(((profile as any).certifications ?? []) as string[]).length,
      !!(profile as any).company || !!(profile as any).position,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  })();

  if (isMobile) {
    const COVER_H = 120;
    return (
      <AppShell>
        <div style={{ backgroundColor: "#f2f3f5", minHeight: "100vh", paddingBottom: 80 }}>

          {/* Cover */}
          <div style={{ height: COVER_H, background: "linear-gradient(135deg, #722f37 0%, #9b3a4a 60%, #c9a84c 100%)", position: "relative" }}>
            <button
              onClick={() => setLocation("/minha-conta")}
              style={{ position: "absolute", top: 14, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.28)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <span style={{ fontSize: 18 }}>⚙️</span>
            </button>
          </div>

          {/* Profile card */}
          <div style={{ backgroundColor: "#fff", padding: "0 16px 20px", marginBottom: 10, position: "relative", zIndex: 1 }}>
            {/* Avatar + edit */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -(COVER_H * 0.38) }}>
              <div style={{ border: "3px solid #fff", borderRadius: "50%", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                <Avatar src={(profile as any)?.avatar_url} name={displayName} size={80} />
              </div>
              <button
                onClick={() => setLocation("/minha-conta")}
                style={{ marginBottom: 4, padding: "8px 16px", backgroundColor: "#fff", color: NAVY, border: `1px solid ${BORDER}`, borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Editar perfil
              </button>
            </div>

            {/* Name + plan */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 19, fontWeight: 900, color: NAVY }}>{displayName}</span>
                <PlanBadge plan={(profile as any)?.plan} />
              </div>
              {username && <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{username}</div>}
              {headline && <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{headline}</div>}
              {(position || company) && (
                <div style={{ fontSize: 13, color: NAVY, marginTop: 3 }}>
                  {[position, company].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>

            {/* Stats row — 4 stats with dividers */}
            <div style={{ display: "flex", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
              {[
                { label: "Posts", value: posts.length, onClick: undefined as (() => void) | undefined },
                { label: "Seguidores", value: stats.followers, onClick: openFollowers },
                { label: "Seguindo", value: stats.following, onClick: openFollowing },
                { label: "Conexões", value: stats.connections, onClick: openConnections },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <div
                    onClick={s.onClick}
                    style={{ flex: 1, textAlign: "center", cursor: s.onClick ? "pointer" : "default" }}
                  >
                    <div style={{ fontSize: 17, fontWeight: 900, color: GOLD }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.label}</div>
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 1, backgroundColor: BORDER, margin: "0 2px" }} />}
                </React.Fragment>
              ))}
            </div>

            {/* Bio */}
            {bio && (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.65, margin: "14px 0 0", whiteSpace: "pre-wrap" }}>{bio}</p>
            )}

            {/* Completion bar */}
            {completion < 100 && (
              <div
                onClick={() => setLocation("/minha-conta")}
                style={{ marginTop: 14, backgroundColor: "#f8fafc", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Completar perfil — {completion}%</span>
                  <span style={{ color: GOLD, fontSize: 14 }}>›</span>
                </div>
                <div style={{ height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${completion}%`, backgroundColor: GOLD, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
                  {completion < 50 ? "Adicione bio, foto e áreas de atuação." :
                   completion < 80 ? "Quase lá! Adicione certificações ou cargo." :
                   "Adicione uma certificação para completar 100%."}
                </div>
              </div>
            )}

            {/* Areas of expertise tags */}
            {((profile as any)?.areas_of_expertise ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {((profile as any).areas_of_expertise as string[]).map(tag => (
                  <span key={tag} style={{ backgroundColor: "#f2f3f5", border: `1px solid ${BORDER}`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600, color: NAVY }}>{tag}</span>
                ))}
              </div>
            )}

            {/* Action cards */}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {[
                { icon: "🏢", label: "Empresa", sub: "Minha página", onClick: () => setLocation("/app/empresa") },
                { icon: "👥", label: "Conexões", sub: `${stats.connections} contatos`, onClick: openConnections },
                { icon: "⭐", label: "Plano", sub: (profile as any)?.plan ?? "Gratuito", onClick: () => setLocation("/minha-conta") },
              ].map(card => (
                <button
                  key={card.label}
                  onClick={card.onClick}
                  style={{ flex: 1, backgroundColor: "#f8fafc", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 8px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                >
                  <span style={{ fontSize: 20 }}>{card.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{card.label}</span>
                  <span style={{ fontSize: 11, color: MUTED }}>{card.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ backgroundColor: "#fff", display: "flex", borderBottom: `1px solid ${BORDER}`, marginBottom: 10 }}>
            {(["publicacoes", "sobre"] as ProfileTab[]).map(t => {
              const labels: Record<ProfileTab, string> = { publicacoes: "Publicações", sobre: "Sobre" };
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: "14px 8px", background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: active ? 800 : 500,
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
          <div style={{ padding: "0 0 12px" }}>
            {tab === "publicacoes" ? (
              loadingPosts ? (
                <div style={{ textAlign: "center", padding: 40, color: MUTED }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🍷</div>Carregando…
                </div>
              ) : posts.length === 0 ? (
                <div style={{ backgroundColor: "#fff", margin: "0 0 10px", padding: "40px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Nenhuma publicação ainda</div>
                  <div style={{ fontSize: 13, color: MUTED }}>Compartilhe seu conhecimento sobre vinho</div>
                </div>
              ) : (
                <div style={{ padding: "0 12px" }}>
                  {posts.map(post => <MiniPostCard key={post.id} post={post} />)}
                </div>
              )
            ) : (
              <div style={{ backgroundColor: "#fff", padding: "20px 16px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 12 }}>Sobre mim</div>
                {bio ? (
                  <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 14px" }}>{bio}</p>
                ) : (
                  <p style={{ fontSize: 14, color: MUTED, margin: "0 0 14px" }}>Nenhuma bio adicionada ainda.</p>
                )}
                {(position || company) && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 15 }}>🏢</span>
                    </div>
                    <div>
                      {position && <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{position}</div>}
                      {company && <div style={{ fontSize: 12, color: MUTED }}>{company}</div>}
                    </div>
                  </div>
                )}
                {Array.isArray((profile as any)?.certifications) && ((profile as any).certifications as string[]).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Certificações</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {((profile as any).certifications as string[]).map(cert => (
                        <span key={cert} style={{ backgroundColor: `${NAVY}12`, border: `1px solid ${NAVY}25`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600, color: NAVY }}>{cert}</span>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => setLocation("/minha-conta")} style={{ marginTop: 16, padding: "9px 20px", backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}50`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Editar informações
                </button>
              </div>
            )}
          </div>
        </div>

        {peopleModal && (
          <PeopleListModal title={peopleModal.title} list={peopleModal.list} onClose={() => setPeopleModal(null)} />
        )}
      </AppShell>
    );
  }

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

            {Array.isArray(profile?.certifications) && (profile.certifications ?? []).length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Certificações</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(profile.certifications ?? []).map((cert) => (
                    <span key={cert} style={{ backgroundColor: `${NAVY}12`, border: `1px solid ${NAVY}25`, borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: NAVY }}>
                      {cert}
                    </span>
                  ))}
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
