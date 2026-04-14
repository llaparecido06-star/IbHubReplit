import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  Post,
  ReactionType,
  fetchSavedPosts,
  toggleLikePost,
  toggleBookmarkPost,
  changeReactionPost,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
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

const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: "curtir",   emoji: "👍", label: "Curtir",    color: "#1a56db" },
  { type: "saude",    emoji: "🍷", label: "Saúde!",    color: "#c9a84c" },
  { type: "destaque", emoji: "⭐", label: "Destaque!",  color: "#f59e0b" },
  { type: "incrivel", emoji: "🔥", label: "Incrível!", color: "#ef4444" },
];
const reactionLabel = (r?: ReactionType | null) => r ? (REACTIONS.find(x => x.type === r)?.label ?? "Curtir") : "Curtir";
const reactionEmoji = (r?: ReactionType | null) => r ? (REACTIONS.find(x => x.type === r)?.emoji ?? "👍") : "";
const reactionColor = (r?: ReactionType | null) => r ? (REACTIONS.find(x => x.type === r)?.color ?? MUTED) : MUTED;

function BookmarkFilledIcon() {
  return (
    <svg width="18" height="18" fill={GOLD} stroke={GOLD} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function SavedPostCard({ post, onRemove, onLike }: {
  post: Post;
  onRemove: (id: string) => void;
  onLike: (id: string, isLiked: boolean, reaction: ReactionType) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const content = post.content ?? "";
  const isLong = content.length > 280;
  const displayContent = isLong && !expanded ? content.slice(0, 280).trimEnd() + "…" : content;
  const authorName = post.author?.full_name ?? "Usuário";

  const startPicker = () => { timer.current = setTimeout(() => setShowPicker(true), 350); };
  const cancelPicker = () => { if (timer.current) clearTimeout(timer.current); };
  const hidePicker = () => { cancelPicker(); setShowPicker(false); };
  const handleReact = (r: ReactionType) => { hidePicker(); onLike(post.id, !!post.is_liked, r); };

  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, marginBottom: 14, overflow: "visible", position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px 10px" }}>
        <Avatar src={post.author?.avatar_url} name={authorName} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{authorName}</div>
          {post.author?.headline && <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{post.author.headline}</div>}
          <div style={{ fontSize: 11, color: "#b0b7c3", marginTop: 2 }}>{timeAgo(post.created_at)}</div>
        </div>
        <button onClick={() => onRemove(post.id)} title="Remover dos salvos" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <BookmarkFilledIcon />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "0 16px 12px", fontSize: 14, color: NAVY, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {displayContent}
        {isLong && (
          <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: GOLD, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginLeft: 4 }}>
            {expanded ? "Ver menos" : "Ver mais"}
          </button>
        )}
      </div>

      {/* Hashtags */}
      {post.hashtags && post.hashtags.length > 0 && (
        <div style={{ padding: "0 16px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {post.hashtags.slice(0, 5).map(tag => (
            <span key={tag} style={{ fontSize: 12, color: "#1a56db", fontWeight: 600 }}>#{tag}</span>
          ))}
        </div>
      )}

      {/* Image */}
      {post.image_url && <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 400, objectFit: "cover", display: "block" }} />}

      {/* Stats */}
      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div style={{ display: "flex", gap: 12, padding: "8px 16px", fontSize: 12, color: MUTED, borderTop: `1px solid ${BORDER}` }}>
          {post.likes_count > 0 && <span>👍 {post.likes_count}</span>}
          {post.comments_count > 0 && <span style={{ marginLeft: "auto" }}>{post.comments_count} comentário{post.comments_count !== 1 ? "s" : ""}</span>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", borderTop: `1px solid ${BORDER}`, overflow: "visible", position: "relative" }}>
        <div style={{ position: "relative", flex: 1 }} onMouseLeave={hidePicker}>
          {showPicker && (
            <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 4, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.14)", display: "flex", gap: 2, padding: "6px 8px", zIndex: 300 }}>
              {REACTIONS.map(r => (
                <button key={r.type} onClick={() => handleReact(r.type)} title={r.label} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, padding: "2px 4px", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.35)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}>
                  <span>{r.emoji}</span>
                  <span style={{ fontSize: 9, color: r.color, fontWeight: 700 }}>{r.label}</span>
                </button>
              ))}
            </div>
          )}
          <button onMouseEnter={startPicker} onMouseLeave={cancelPicker} onClick={() => handleReact(post.reaction_type ?? "curtir")}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 8px", fontSize: 13, fontWeight: 600, color: post.is_liked ? reactionColor(post.reaction_type) : MUTED }}>
            {post.is_liked ? <span style={{ fontSize: 15 }}>{reactionEmoji(post.reaction_type)}</span> : <span style={{ fontSize: 15 }}>👍</span>}
            <span>{reactionLabel(post.reaction_type ?? (post.is_liked ? "curtir" : null))}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ItensSalvosPage() {
  const { profile, user } = useAuth();
  const [, setLocation] = useLocation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = profile?.id ?? user?.id ?? "";

  useEffect(() => {
    if (!userId) return;
    fetchSavedPosts(userId).then(data => {
      setPosts(data);
      setLoading(false);
    });
  }, [userId]);

  const handleRemove = useCallback(async (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    await toggleBookmarkPost(postId, userId, true);
  }, [userId]);

  const handleLike = useCallback(async (postId: string, isLiked: boolean, reaction: ReactionType = "curtir") => {
    if (!userId) return;
    if (isLiked) {
      const currentPost = posts.find(p => p.id === postId);
      if (currentPost?.reaction_type === reaction) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: false, reaction_type: null, likes_count: Math.max(0, p.likes_count - 1) } : p));
        await toggleLikePost(postId, userId, true);
      } else {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reaction_type: reaction } : p));
        await changeReactionPost(postId, userId, reaction);
      }
    } else {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: true, reaction_type: reaction, likes_count: p.likes_count + 1 } : p));
      await toggleLikePost(postId, userId, false, reaction);
    }
  }, [userId, posts]);

  return (
    <AppShell>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <button onClick={() => setLocation("/app")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: 0 }}>Itens Salvos</h1>
        </div>
        <p style={{ fontSize: 13, color: MUTED, margin: 0, marginLeft: 36 }}>Publicações que você guardou para ver depois</p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: MUTED }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔖</div>
          Carregando itens salvos…
        </div>
      ) : posts.length === 0 ? (
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔖</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Nenhum item salvo</h2>
          <p style={{ fontSize: 14, color: MUTED, marginBottom: 20 }}>Salve publicações clicando no ícone de marcador nos posts do feed</p>
          <button onClick={() => setLocation("/app")} style={{ padding: "10px 24px", backgroundColor: GOLD, color: WHITE, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Explorar feed
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>{posts.length} item{posts.length !== 1 ? "s" : ""} salvo{posts.length !== 1 ? "s" : ""}</div>
          {posts.map(post => (
            <SavedPostCard key={post.id} post={post} onRemove={handleRemove} onLike={handleLike} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
