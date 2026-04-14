import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  Post,
  SuggestedProfile,
  fetchFeedPosts,
  toggleLikePost,
  fetchWebSuggestedConnections,
  sendWebConnectionRequest,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

/* ─── Utils ──────────────────────────────── */
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

function planBadgeColor(plan?: string) {
  if (plan === "exclusive" || plan === "executivo") return "#7B2FBE";
  if (plan === "business"  || plan === "empresa")   return "#1a56db";
  if (plan === "premium"   || plan === "profissional") return GOLD;
  return null;
}

/* ─── Avatar ─────────────────────────────── */
function Avatar({ src, name, size = 40, bg = "#722f37" }: { src?: string | null; name: string; size?: number; bg?: string }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
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

/* ─── Icons ──────────────────────────────── */
const LikeIcon = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" fill={filled ? GOLD : "none"} stroke={filled ? GOLD : MUTED} strokeWidth="2" viewBox="0 0 24 24">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);
const CommentIcon = () => (
  <svg width="18" height="18" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const ShareIcon = () => (
  <svg width="18" height="18" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);
const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" fill={filled ? NAVY : "none"} stroke={NAVY} strokeWidth="2" viewBox="0 0 24 24">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);
const ImageIcon = () => (
  <svg width="18" height="18" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);
const WineGlassIcon = () => (
  <svg width="18" height="18" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24">
    <path d="M8 22H5a2 2 0 0 1-2-2V6l3-3h14a2 2 0 0 1 2 2v5"/>
    <circle cx="16" cy="16" r="6"/><polyline points="16 13 16 16 18 16"/>
  </svg>
);

/* ─── PostCard ───────────────────────────── */
function PostCard({
  post,
  currentUserId,
  onLike,
}: {
  post: Post;
  currentUserId: string;
  onLike: (id: string, liked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const CUTOFF = 280;
  const content = post.content ?? "";
  const isLong = content.length > CUTOFF;
  const displayContent = isLong && !expanded ? content.slice(0, CUTOFF).trimEnd() + "…" : content;

  const isWinePost = /^⭐/.test(content) && /Pontuação/.test(content);
  const authorName = post.author?.full_name ?? "Usuário";
  const badgeColor = planBadgeColor(post.author?.plan);

  return (
    <div style={{
      backgroundColor: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      marginBottom: 14,
      overflow: "hidden",
    }}>
      {/* Wine badge */}
      {isWinePost && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          backgroundColor: `${GOLD}14`,
          borderBottom: `1px solid ${GOLD}30`,
          padding: "7px 16px",
        }}>
          <span style={{ fontSize: 14 }}>🍷</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>Avaliação de Vinho</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px 10px" }}>
        <Avatar src={post.author?.avatar_url} name={authorName} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{authorName}</span>
            {badgeColor && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: WHITE,
                backgroundColor: badgeColor, padding: "1px 6px", borderRadius: 100,
              }}>
                {(post.author?.plan ?? "").charAt(0).toUpperCase() + (post.author?.plan ?? "").slice(1)}
              </span>
            )}
          </div>
          {post.author?.headline && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }} title={post.author.headline}>
              {post.author.headline}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#b0b7c3", marginTop: 2 }}>{timeAgo(post.created_at)}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 16px 12px", fontSize: 14, color: NAVY, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {displayContent}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", color: GOLD, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginLeft: 4 }}
          >
            {expanded ? "Ver menos" : "Ver mais"}
          </button>
        )}
      </div>

      {/* Hashtags */}
      {post.hashtags && post.hashtags.length > 0 && (
        <div style={{ padding: "0 16px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {post.hashtags.slice(0, 5).map((tag) => (
            <span key={tag} style={{ fontSize: 12, color: "#1a56db", fontWeight: 600 }}>#{tag}</span>
          ))}
        </div>
      )}

      {/* Image */}
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          style={{ width: "100%", maxHeight: 480, objectFit: "cover", display: "block" }}
        />
      )}
      {post.image_urls && post.image_urls.length > 0 && !post.image_url && (
        <div style={{ display: "grid", gridTemplateColumns: post.image_urls.length === 1 ? "1fr" : "1fr 1fr", gap: 2 }}>
          {post.image_urls.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: "100%", height: 200, objectFit: "cover" }} />
          ))}
        </div>
      )}

      {/* Stats */}
      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div style={{
          display: "flex", gap: 12, padding: "8px 16px",
          fontSize: 12, color: MUTED, borderTop: `1px solid ${BORDER}`,
        }}>
          {post.likes_count > 0 && <span>👍 {post.likes_count}</span>}
          {post.comments_count > 0 && <span style={{ marginLeft: "auto" }}>{post.comments_count} comentário{post.comments_count !== 1 ? "s" : ""}</span>}
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: "flex", borderTop: `1px solid ${BORDER}`,
      }}>
        {[
          {
            icon: <LikeIcon filled={!!post.is_liked} />,
            label: post.is_liked ? "Curtido" : "Curtir",
            color: post.is_liked ? GOLD : MUTED,
            onClick: () => onLike(post.id, !!post.is_liked),
          },
          { icon: <CommentIcon />, label: "Comentar", color: MUTED, onClick: () => {} },
          { icon: <ShareIcon />, label: "Compartilhar", color: MUTED, onClick: () => {} },
          { icon: <BookmarkIcon filled={!!post.is_bookmarked} />, label: "", color: MUTED, onClick: () => {}, ml: true },
        ].map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            style={{
              flex: action.ml ? "0 0 auto" : 1,
              marginLeft: action.ml ? "auto" : 0,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 8px",
              fontSize: 13, fontWeight: 600, color: action.color,
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${GOLD}0d`; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {action.icon}
            {action.label && <span>{action.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── WelcomeCard (empty feed) ───────────── */
function WelcomeCard({ suggestions, onConnect }: { suggestions: SuggestedProfile[]; onConnect: (id: string) => void }) {
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "32px 24px", textAlign: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Bem-vindo ao Ibhub!</h2>
      <p style={{ fontSize: 14, color: MUTED, marginBottom: 24 }}>Siga vinícolas e profissionais para personalizar seu feed</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {suggestions.slice(0, 3).map((s) => (
          <SuggestionCard key={s.id} profile={s} onConnect={onConnect} compact />
        ))}
      </div>
    </div>
  );
}

/* ─── SuggestionCard ─────────────────────── */
function SuggestionCard({
  profile,
  onConnect,
  compact = false,
}: {
  profile: SuggestedProfile;
  onConnect: (id: string) => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState(profile.connection_status);

  const handleConnect = () => {
    if (status !== "none") return;
    setStatus("pending");
    onConnect(profile.id);
  };

  return (
    <div style={{
      backgroundColor: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: compact ? "16px 14px" : "20px 16px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      width: compact ? 130 : "100%",
    }}>
      <Avatar src={profile.avatar_url} name={profile.full_name} size={compact ? 44 : 52} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: NAVY }}>{profile.full_name}</div>
        {profile.headline && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>
            {profile.headline.length > 40 ? profile.headline.slice(0, 40) + "…" : profile.headline}
          </div>
        )}
      </div>
      <button
        onClick={handleConnect}
        disabled={status !== "none"}
        style={{
          width: "100%", padding: "7px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: status === "none" ? "pointer" : "default",
          backgroundColor: status === "none" ? `${GOLD}15` : "#f5f5f0",
          color: status === "none" ? GOLD : MUTED,
          border: `1px solid ${status === "none" ? GOLD + "50" : BORDER}`,
        }}
      >
        {status === "pending" ? "⏱ Pendente" : status === "connected" ? "✓ Conectado" : "Conectar"}
      </button>
    </div>
  );
}

/* ─── PostTrigger (opens global modal) ─── */
function PostTrigger({ profile }: { profile: { avatar_url?: string | null; full_name?: string | null } | null }) {
  const openModal = () => window.dispatchEvent(new CustomEvent("ibhub:openCreatePost"));
  const name = profile?.full_name ?? "Usuário";
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar src={profile?.avatar_url} name={name} size={40} />
        <button onClick={openModal} style={{
          flex: 1, textAlign: "left", padding: "10px 16px",
          backgroundColor: BG, border: `1px solid ${BORDER}`,
          borderRadius: 24, fontSize: 14, color: MUTED,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          O que está acontecendo no mundo do vinho?
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
        {[
          { label: "Foto",     icon: <ImageIcon />,    tab: "foto" },
          { label: "Vídeo",    icon: <WineGlassIcon />, tab: "video" },
          { label: "Enquete",  icon: null,              tab: "enquete" },
          { label: "🍷 Vinho", icon: null,              tab: "vinho" },
        ].map(item => (
          <button key={item.label} onClick={openModal} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
            background: "none", border: `1px solid ${BORDER}`, borderRadius: 20,
            fontSize: 12, color: MUTED, cursor: "pointer", fontFamily: "inherit",
          }}>
            {item.icon}{item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── SuggestionsPanel ───────────────────── */
function SuggestionsPanel({ suggestions, onConnect }: { suggestions: SuggestedProfile[]; onConnect: (id: string) => void }) {
  if (!suggestions.length) return null;
  return (
    <div style={{
      backgroundColor: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      padding: "16px",
      marginBottom: 14,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 14, margin: "0 0 14px" }}>
        Sugestões de Conexão
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {suggestions.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar src={s.avatar_url} name={s.full_name} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.full_name}</div>
              {s.headline && <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.headline}</div>}
            </div>
            <ConnectBtn profile={s} onConnect={onConnect} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectBtn({ profile, onConnect }: { profile: SuggestedProfile; onConnect: (id: string) => void }) {
  const [status, setStatus] = useState(profile.connection_status);
  const handleClick = () => {
    if (status !== "none") return;
    setStatus("pending");
    onConnect(profile.id);
  };
  return (
    <button
      onClick={handleClick}
      disabled={status !== "none"}
      style={{
        flexShrink: 0,
        fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 8,
        cursor: status === "none" ? "pointer" : "default",
        backgroundColor: status === "none" ? `${GOLD}15` : "#f5f5f0",
        color: status === "none" ? GOLD : MUTED,
        border: `1px solid ${status === "none" ? GOLD + "50" : BORDER}`,
      }}
    >
      {status === "pending" ? "Pendente" : status === "connected" ? "Conectado" : "Conectar"}
    </button>
  );
}

/* ─── WineRankingTeaser ──────────────────── */
function WineRankingTeaser() {
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🍷</span>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: 0 }}>Ranking da Comunidade</h3>
      </div>
      {[
        { pos: 1, name: "Barca Velha 2011", score: 97, region: "Douro" },
        { pos: 2, name: "Cartuxa Pêra-Manca", score: 95, region: "Alentejo" },
        { pos: 3, name: "Château Pichon 2019", score: 94, region: "Bordeaux" },
      ].map(w => (
        <div key={w.pos} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            backgroundColor: w.pos === 1 ? GOLD : w.pos === 2 ? "#9ca3af" : "#c97c42",
            color: "#fff", fontSize: 11, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>#{w.pos}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{w.region}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>{w.score}</div>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, textAlign: "center" }}>
        <button style={{ background: "none", border: "none", color: GOLD, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Ver ranking completo →
        </button>
      </div>
    </div>
  );
}

/* ─── Trending Topics ────────────────────── */
function TrendingTopics() {
  const topics = ["#SustentabilidadeVinícola", "#Chardonnay2024", "#EnoturismoBrasil", "#TerroirSerrano", "#VinosNaturaes"];
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: "0 0 12px" }}>📈 Em Alta</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {topics.map(t => (
          <button key={t} style={{ background: "none", border: "none", textAlign: "left", color: "#1a56db", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

/* ─── AppFeedPage ────────────────────────── */
export default function AppFeedPage() {
  const { profile, user } = useAuth();

  const [posts, setPosts]             = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedProfile[]>([]);
  const [loading, setLoading]         = useState(true);

  const userId    = profile?.id ?? user?.id ?? "";
  const firstName = profile?.full_name?.split(" ")[0] ?? "Usuário";

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [postsData, suggsData] = await Promise.all([
      fetchFeedPosts(userId),
      fetchWebSuggestedConnections(userId, 5),
    ]);
    setPosts(postsData);
    setSuggestions(suggsData);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleLike = useCallback(async (postId: string, isLiked: boolean) => {
    if (!userId) return;
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, is_liked: !isLiked, likes_count: isLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1 }
        : p
    ));
    await toggleLikePost(postId, userId, isLiked);
  }, [userId]);

  const handleConnect = useCallback(async (targetId: string) => {
    if (!userId) return;
    await sendWebConnectionRequest(targetId, userId);
  }, [userId]);

  return (
    <AppShell onPostCreated={load}>
      {/* Greeting */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: "0 0 2px" }}>Olá, {firstName} 👋</h1>
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Veja as últimas atualizações</p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Feed column ─────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <PostTrigger profile={profile} />

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🍷</div>
              Carregando feed…
            </div>
          ) : posts.length === 0 ? (
            <WelcomeCard suggestions={suggestions} onConnect={handleConnect} />
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={userId}
                onLike={handleLike}
              />
            ))
          )}
        </div>

        {/* ── Right panel ─── */}
        <div style={{ width: 260, flexShrink: 0, display: "none" }} className="feed-right-panel">
          {suggestions.length > 0 && <SuggestionsPanel suggestions={suggestions.slice(0, 4)} onConnect={handleConnect} />}
          <WineRankingTeaser />
          <TrendingTopics />
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .feed-right-panel { display: block !important; }
        }
      `}</style>
    </AppShell>
  );
}
