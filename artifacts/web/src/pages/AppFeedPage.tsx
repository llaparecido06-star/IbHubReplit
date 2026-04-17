import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { AppShell } from "@/components/layout/AppShell";
import StoriesBar from "@/components/stories/StoriesBar";
import { supabase } from "@/lib/supabase";
import {
  Post,
  ReactionType,
  SuggestedProfile,
  WineCommunityRating,
  fetchFeedPosts,
  fetchCompanyFeedPosts,
  fetchPostById,
  toggleLikePost,
  changeReactionPost,
  toggleBookmarkPost,
  fetchWebSuggestedConnections,
  sendWebConnectionRequest,
  fetchWineCommunityRankings,
} from "@/services/api";
import { formatRelativeDate } from "@/utils/dateUtils";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

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

/* ─── Reaction config ────────────────────── */
const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: "curtir",   emoji: "👍", label: "Curtir",  color: "#1a56db" },
  { type: "saude",    emoji: "🍷", label: "Saúde!",  color: "#c9a84c" },
  { type: "destaque", emoji: "⭐", label: "Destaque!", color: "#f59e0b" },
  { type: "incrivel", emoji: "🔥", label: "Incrível!", color: "#ef4444" },
];

function reactionLabel(r?: ReactionType | null): string {
  if (!r) return "Curtir";
  return REACTIONS.find(x => x.type === r)?.label ?? "Curtir";
}
function reactionEmoji(r?: ReactionType | null): string {
  if (!r) return "";
  return REACTIONS.find(x => x.type === r)?.emoji ?? "👍";
}
function reactionColor(r?: ReactionType | null): string {
  if (!r) return MUTED;
  return REACTIONS.find(x => x.type === r)?.color ?? MUTED;
}

/* ─── PostCard ───────────────────────────── */
function PostCard({
  post,
  currentUserId,
  onLike,
  onBookmark,
}: {
  post: Post;
  currentUserId: string;
  onLike: (id: string, isLiked: boolean, reaction: ReactionType) => void;
  onBookmark: (id: string, isBookmarked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const pickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CUTOFF = 280;
  const content = post.content ?? "";
  const isLong = content.length > CUTOFF;
  const displayContent = isLong && !expanded ? content.slice(0, CUTOFF).trimEnd() + "…" : content;

  const [, setLocation] = useLocation();
  const isWinePost = /^⭐/.test(content) && /Pontuação/.test(content);
  const companyPage = post.company_page ?? null;
  const authorName = companyPage ? companyPage.name : (post.author?.full_name ?? "Usuário");
  const authorAvatar = companyPage ? companyPage.avatar_url : post.author?.avatar_url;
  const badgeColor = companyPage ? GOLD : planBadgeColor(post.author?.plan);
  const badgeLabel = companyPage ? "Empresa" : (post.author?.plan ? post.author.plan.charAt(0).toUpperCase() + post.author.plan.slice(1) : null);
  const goToAuthor = () => {
    if (companyPage) { setLocation(`/app/empresa/${companyPage.id}`); return; }
    if (post.author?.id && post.author.id !== currentUserId) setLocation(`/app/usuario/${post.author.id}`);
    else if (post.author?.id === currentUserId) setLocation("/app/perfil");
  };

  const startPicker = () => { pickerTimer.current = setTimeout(() => setShowPicker(true), 350); };
  const cancelPicker = () => { if (pickerTimer.current) clearTimeout(pickerTimer.current); };
  const hidePicker = () => { cancelPicker(); setShowPicker(false); };

  const handleReact = (reaction: ReactionType) => {
    hidePicker();
    onLike(post.id, !!post.is_liked, reaction);
  };

  return (
    <div style={{
      backgroundColor: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      marginBottom: 14,
      overflow: "visible",
      position: "relative",
    }}>
      {/* Wine badge */}
      {isWinePost && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          backgroundColor: `${GOLD}14`,
          borderBottom: `1px solid ${GOLD}30`,
          borderRadius: "14px 14px 0 0",
          padding: "7px 16px",
        }}>
          <span style={{ fontSize: 14 }}>🍷</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>Avaliação de Vinho</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px 10px" }}>
        <div onClick={goToAuthor} style={{ cursor: "pointer" }}>
          <Avatar src={authorAvatar} name={authorName} size={42} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span onClick={goToAuthor} style={{ fontSize: 14, fontWeight: 800, color: NAVY, cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}>
              {authorName}
            </span>
            {badgeColor && badgeLabel && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: WHITE,
                backgroundColor: badgeColor, padding: "1px 6px", borderRadius: 100,
              }}>
                {badgeLabel}
              </span>
            )}
          </div>
          {!companyPage && post.author?.headline && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }} title={post.author.headline}>
              {post.author.headline}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#b0b7c3", marginTop: 2 }}>{formatRelativeDate(post.created_at)}</div>
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
        <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 480, objectFit: "cover", display: "block" }} />
      )}
      {post.image_urls && post.image_urls.length > 0 && !post.image_url && (
        <div style={{ display: "grid", gridTemplateColumns: post.image_urls.length === 1 ? "1fr" : "1fr 1fr", gap: 2 }}>
          {post.image_urls.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: "100%", height: 200, objectFit: "cover" }} />
          ))}
        </div>
      )}

      {/* Video */}
      {post.video_url && (
        <video
          src={post.video_url}
          controls
          style={{ width: "100%", maxHeight: 480, display: "block", background: "#000" }}
        />
      )}

      {/* Stats */}
      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div style={{ display: "flex", gap: 12, padding: "8px 16px", fontSize: 12, color: MUTED, borderTop: `1px solid ${BORDER}` }}>
          {post.likes_count > 0 && <span>❤️ {post.likes_count}</span>}
          {post.comments_count > 0 && <span style={{ marginLeft: "auto" }}>{post.comments_count} comentário{post.comments_count !== 1 ? "s" : ""}</span>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", borderTop: `1px solid ${BORDER}`, overflow: "visible", position: "relative" }}>

        {/* Curtir — with reaction picker */}
        <div style={{ position: "relative", flex: 1 }} onMouseLeave={hidePicker}>
          {/* Reaction Picker */}
          {showPicker && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", left: 4,
              background: WHITE, border: `1px solid ${BORDER}`,
              borderRadius: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
              display: "flex", gap: 2, padding: "6px 8px", zIndex: 300,
              whiteSpace: "nowrap",
            }}>
              {REACTIONS.map(r => (
                <button
                  key={r.type}
                  onClick={() => handleReact(r.type)}
                  title={r.label}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 22, lineHeight: 1, padding: "2px 4px",
                    borderRadius: 8, transition: "transform 0.1s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.35)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                >
                  <span>{r.emoji}</span>
                  <span style={{ fontSize: 9, color: r.color, fontWeight: 700 }}>{r.label}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onMouseEnter={startPicker}
            onMouseLeave={cancelPicker}
            onClick={() => handleReact(post.reaction_type ?? "curtir")}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "none", border: "none", cursor: "pointer", padding: "10px 8px",
              fontSize: 13, fontWeight: 600, color: post.is_liked ? reactionColor(post.reaction_type) : MUTED,
            }}
            onFocus={startPicker}
            onBlur={hidePicker}
          >
            {post.is_liked ? (
              <span style={{ fontSize: 15 }}>{reactionEmoji(post.reaction_type)}</span>
            ) : (
              <LikeIcon filled={false} />
            )}
            <span>{reactionLabel(post.reaction_type ?? (post.is_liked ? "curtir" : null))}</span>
          </button>
        </div>

        <button onClick={() => setLocation(`/app/posts/${post.id}`)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 8px", fontSize: 13, fontWeight: 600, color: MUTED }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
          <CommentIcon /><span>Comentar</span>
        </button>

        <div ref={shareRef} style={{ flex: 1, position: "relative" }}>
          <button
            onClick={() => setShowShare(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 8px", fontSize: 13, fontWeight: 600, color: showShare ? GOLD : MUTED }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <ShareIcon /><span>Compartilhar</span>
          </button>
          {showShare && (
            <div
              style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 400, minWidth: 200, overflow: "hidden",
              }}
              onMouseLeave={() => setShowShare(false)}
            >
              {[
                { label: "Copiar link", icon: "🔗", action: () => { navigator.clipboard.writeText(`https://ibhub.app/post/${post.id}`); setShowShare(false); } },
                { label: "WhatsApp", icon: "💬", action: () => { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent("https://ibhub.app/post/" + post.id)}`); setShowShare(false); } },
                { label: "Instagram DM", icon: "📸", action: () => { window.open("https://instagram.com/direct/inbox/"); setShowShare(false); } },
                { label: "Enviar no chat", icon: "✉️", action: () => { setLocation(`/app/mensagens?share=${post.id}`); setShowShare(false); } },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY, textAlign: "left" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}10`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => onBookmark(post.id, !!post.is_bookmarked)} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: "10px 12px", color: MUTED }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
          <BookmarkIcon filled={!!post.is_bookmarked} />
        </button>
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
function PostTrigger({
  profile,
  activeCompany,
}: {
  profile: { avatar_url?: string | null; full_name?: string | null } | null;
  activeCompany?: { name: string; avatar_url?: string | null } | null;
}) {
  const openModal = () => window.dispatchEvent(new CustomEvent("ibhub:openCreatePost"));
  const { isEnabled: isFlagEnabled } = useFeatureFlags();
  const name = activeCompany ? activeCompany.name : (profile?.full_name ?? "Usuário");
  const avatarSrc = activeCompany ? activeCompany.avatar_url : profile?.avatar_url;
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar src={avatarSrc} name={name} size={40} bg={activeCompany ? GOLD : "#722f37"} />
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
          ...(isFlagEnabled("enquetes") ? [{ label: "Enquete", icon: null as React.ReactNode, tab: "enquete" }] : []),
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
function WineRankingTeaser({ wines }: { wines: WineCommunityRating[] }) {
  const top = (wines ?? []).slice(0, 3);
  const medalColors = [GOLD, "#9ca3af", "#c97c42"];
  const stars = (avg: number) => {
    const s = Math.max(1, Math.min(5, Math.round(avg / 20)));
    return "★".repeat(s) + "☆".repeat(5 - s);
  };

  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🍷</span>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: 0 }}>Ranking da Comunidade</h3>
      </div>
      {top.length === 0 ? (
        <div style={{ fontSize: 13, color: MUTED, textAlign: "center", padding: "12px 0" }}>Sem avaliações ainda</div>
      ) : top.map((w, i) => (
        <div key={w.ean} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            backgroundColor: medalColors[i],
            color: "#fff", fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>#{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</div>
            <div style={{ fontSize: 10, color: GOLD, letterSpacing: 1 }}>{stars(w.avg_rating)}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: GOLD }}>{w.total_ratings}×</div>
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
  const { profile, user, loading: authLoading, activeCompany } = useAuth();
  const { isEnabled: isFlagEnabled } = useFeatureFlags();

  const [posts, setPosts]             = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedProfile[]>([]);
  const [wineRankings, setWineRankings] = useState<WineCommunityRating[]>([]);
  const [loading, setLoading]         = useState(true);

  const userId    = profile?.id ?? user?.id ?? "";
  const firstName = profile?.full_name?.split(" ")[0] ?? "Usuário";
  const companyId = activeCompany?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (companyId) {
        const postsData = await fetchCompanyFeedPosts(companyId, userId);
        setPosts(postsData);
      } else {
        const [postsData, suggsData] = await Promise.all([
          fetchFeedPosts(userId),
          fetchWebSuggestedConnections(userId, 5),
        ]);
        setPosts(postsData);
        setSuggestions(suggsData);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, companyId]);

  useEffect(() => {
    if (!authLoading) load();
  }, [load, authLoading]);

  useEffect(() => { fetchWineCommunityRankings().then(setWineRankings); }, []);

  useEffect(() => {
    if (!userId) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`feed_realtime_web_${userId}_${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const raw = payload.new as any;
        if (raw.user_id === userId) return;
        if (companyId) {
          if (raw.company_page_id !== companyId) return;
        } else {
          if (raw.company_page_id) return;
        }
        const full = await fetchPostById(raw.id, userId);
        if (!full) return;
        // Skip posts from shadowbanned users (server-side shadowban enforcement for realtime path)
        if (full.author?.is_shadowbanned) return;
        setPosts(prev => {
          if (prev.some(p => p.id === full.id)) return prev;
          return [full, ...prev];
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
        const raw = payload.new as any;
        setPosts(prev => prev.map(p =>
          p.id === raw.post_id ? { ...p, comments_count: p.comments_count + 1 } : p
        ));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes" }, (payload) => {
        const raw = payload.new as any;
        if (raw.user_id === userId) return;
        setPosts(prev => prev.map(p =>
          p.id === raw.post_id ? { ...p, likes_count: p.likes_count + 1 } : p
        ));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "likes" }, (payload) => {
        const raw = payload.old as any;
        if (raw.user_id === userId) return;
        setPosts(prev => prev.map(p =>
          p.id === raw.post_id ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, companyId]);

  const handleLike = useCallback(async (postId: string, isLiked: boolean, reaction: ReactionType = "curtir") => {
    if (!userId) return;
    if (isLiked) {
      const currentPost = posts.find(p => p.id === postId);
      if (currentPost?.reaction_type === reaction) {
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, is_liked: false, reaction_type: null, likes_count: Math.max(0, p.likes_count - 1) }
            : p
        ));
        await toggleLikePost(postId, userId, true, reaction, companyId);
      } else {
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, reaction_type: reaction } : p
        ));
        await changeReactionPost(postId, userId, reaction, companyId);
      }
    } else {
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, is_liked: true, reaction_type: reaction, likes_count: p.likes_count + 1 }
          : p
      ));
      await toggleLikePost(postId, userId, false, reaction, companyId);
    }
  }, [userId, posts, companyId]);

  const handleBookmark = useCallback(async (postId: string, isBookmarked: boolean) => {
    if (!userId) return;
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, is_bookmarked: !isBookmarked } : p
    ));
    await toggleBookmarkPost(postId, userId, isBookmarked);
  }, [userId]);

  const handleConnect = useCallback(async (targetId: string) => {
    if (!userId) return;
    await sendWebConnectionRequest(targetId, userId);
  }, [userId]);

  return (
    <AppShell onPostCreated={load}>
      {/* Greeting / Company Banner */}
      {activeCompany ? (
        <div style={{ marginBottom: 14, backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}30`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          {activeCompany.avatar_url
            ? <img src={activeCompany.avatar_url} alt={activeCompany.name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            : <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: WHITE, flexShrink: 0 }}>{activeCompany.name[0]}</div>
          }
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase" }}>Modo Empresa Ativo</div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: NAVY, margin: "2px 0 0" }}>{activeCompany.name}</h1>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Você está publicando, curtindo e interagindo como esta empresa</p>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: "0 0 2px" }}>Olá, {firstName} 👋</h1>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Veja as últimas atualizações</p>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Feed column ─────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!activeCompany && isFlagEnabled("stories") && <StoriesBar userId={userId} />}
          <PostTrigger profile={profile} activeCompany={activeCompany} />

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🍷</div>
              Carregando feed…
            </div>
          ) : posts.length === 0 ? (
            activeCompany ? (
              <div style={{ textAlign: "center", padding: 48, color: MUTED, backgroundColor: WHITE, borderRadius: 14, border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Nenhuma publicação ainda</div>
                <div style={{ fontSize: 13 }}>Publique o primeiro post como <strong>{activeCompany.name}</strong>!</div>
              </div>
            ) : (
              <WelcomeCard suggestions={suggestions} onConnect={handleConnect} />
            )
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={userId}
                onLike={handleLike}
                onBookmark={handleBookmark}
              />
            ))
          )}
        </div>

        {/* ── Right panel ─── (only in personal mode) */}
        {!activeCompany && (
          <div style={{ width: 260, flexShrink: 0, display: "none" }} className="feed-right-panel">
            {suggestions.length > 0 && <SuggestionsPanel suggestions={suggestions.slice(0, 4)} onConnect={handleConnect} />}
            <WineRankingTeaser wines={wineRankings} />
            <TrendingTopics />
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .feed-right-panel { display: block !important; }
        }
      `}</style>
    </AppShell>
  );
}
