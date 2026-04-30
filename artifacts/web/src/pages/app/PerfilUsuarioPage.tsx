import React, { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import PlanBadge from "@/components/PlanBadge";
import {
  fetchPublicUserProfile,
  fetchUserPosts,
  fetchProfileStats,
  sendWebConnectionRequest,
  checkWebConnectionStatus,
  checkWebFollowStatus,
  toggleWebFollow,
  getOrCreateWebConversation,
  fetchPublicWineCellar,
  fetchConnectionsList,
  fetchFollowersList,
  fetchFollowingList,
  toggleLikePost,
  changeReactionPost,
  toggleBookmarkPost,
  deletePost,
  updatePost,
  blockUser,
  reportPost,
  fetchUserOpportunities,
  UserProfile,
  Post,
  WineEntry,
  ReactionType,
  ProfilePerson,
  CompanyAdminOpportunity,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WINE   = "#722f37";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f2f3f5";

/* ── helpers ── */
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
function fmtN(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

/* ── sub-components ── */
function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: WINE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0 }}>
      {(name?.[0] ?? "U").toUpperCase()}
    </div>
  );
}

function Tag({ label, color = GOLD }: { label: string; color?: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color, backgroundColor: color + "18", border: `1px solid ${color}30`, padding: "3px 10px", borderRadius: 100 }}>
      {label}
    </span>
  );
}

/* ── Network modal (Conexões / Seguidores / Seguindo) ── */
type NetworkModalType = "conexoes" | "seguidores" | "seguindo";

function NetworkModal({
  type,
  list,
  loading,
  onClose,
  onNavigate,
}: {
  type: NetworkModalType;
  list: ProfilePerson[];
  loading: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const titles: Record<NetworkModalType, string> = {
    conexoes: "Conexões",
    seguidores: "Seguidores",
    seguindo: "Seguindo",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: WHITE, borderRadius: 18, width: "min(480px, 100%)", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: NAVY }}>{titles[type]}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: MUTED }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${GOLD}30`, borderTopColor: GOLD, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 10px" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontSize: 13 }}>Carregando...</div>
            </div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: MUTED }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🍷</div>
              <div style={{ fontSize: 14 }}>Nenhum usuário ainda.</div>
            </div>
          ) : (
            list.map(person => (
              <div
                key={person.id}
                onClick={() => { onClose(); onNavigate(person.id); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", cursor: "pointer", transition: "background .12s" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Avatar src={person.avatar_url} name={person.full_name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.full_name}</div>
                  {person.username && <div style={{ fontSize: 12, color: MUTED }}>@{person.username}</div>}
                  {person.headline && <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.headline}</div>}
                </div>
                <svg width="14" height="14" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Feed-style icons ── */
const LikeIcon = ({ filled, color }: { filled: boolean; color?: string }) => (
  <svg width="17" height="17" fill={filled ? (color ?? GOLD) : "none"} stroke={filled ? (color ?? GOLD) : MUTED} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);
const CommentIcon = () => (
  <svg width="17" height="17" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const ShareIcon = () => (
  <svg width="17" height="17" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);
const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg width="17" height="17" fill={filled ? NAVY : "none"} stroke={NAVY} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: "curtir",   emoji: "👍", label: "Curtir",   color: GOLD },
  { type: "saude",    emoji: "🥂", label: "Saúde!",   color: "#c0392b" },
  { type: "destaque", emoji: "⭐", label: "Destaque", color: "#f39c12" },
  { type: "incrivel", emoji: "🍷", label: "Incrível", color: WINE },
];

type PostCardProps = {
  post: Post;
  currentUserId?: string | null;
  onLike: (postId: string) => void;
  onReact: (postId: string, reaction: ReactionType) => void;
  onBookmark: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string, content: string) => void;
  onReport?: (postId: string) => void;
  onBlock?: (authorId: string, authorName: string) => void;
};

function PostCard({ post, currentUserId, onLike, onReact, onBookmark, onDelete, onEdit, onReport, onBlock }: PostCardProps) {
  const [, setLocation] = useLocation();
  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContent, setEditContent] = useState(post.content ?? "");
  const [editSaving, setEditSaving] = useState(false);
  const pickerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const content = post.content ?? "";
  const displayContent = content.length > 300 ? content.slice(0, 300).trimEnd() + "…" : content;
  const images: string[] = post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : []);

  const reactionInfo = post.reaction_type
    ? REACTIONS.find(r => r.type === post.reaction_type)
    : null;
  const likeLabel = reactionInfo ? reactionInfo.label : post.is_liked ? "Curtido" : "Curtir";
  const likeColor = reactionInfo ? reactionInfo.color : post.is_liked ? GOLD : MUTED;

  const openPicker = () => {
    if (pickerTimeout.current) clearTimeout(pickerTimeout.current);
    setShowPicker(true);
  };
  const closePicker = () => {
    pickerTimeout.current = setTimeout(() => setShowPicker(false), 150);
  };

  const authorName = post.author?.full_name ?? "Usuário";
  const authorAvatar = post.author?.avatar_url;
  const authorHeadline = (post.author as any)?.headline ?? (post.author as any)?.position ?? "";

  const isOwn = !!(currentUserId && post.author?.id === currentUserId);

  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, marginBottom: 12, overflow: "visible", position: "relative" }}>
      {/* Edit modal */}
      {showEditModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowEditModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ backgroundColor: WHITE, borderRadius: 16, width: "min(540px,100%)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>Editar publicação</span>
              <button onClick={() => setShowEditModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              style={{ margin: 16, padding: 12, borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 14, color: NAVY, lineHeight: 1.6, resize: "vertical", minHeight: 120, fontFamily: "inherit", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "0 16px 16px" }}>
              <button onClick={() => setShowEditModal(false)}
                style={{ padding: "9px 18px", borderRadius: 10, border: `1.5px solid ${BORDER}`, background: "transparent", fontSize: 13, fontWeight: 600, cursor: "pointer", color: MUTED }}>
                Cancelar
              </button>
              <button
                disabled={editSaving || !editContent.trim()}
                onClick={async () => {
                  setEditSaving(true);
                  await onEdit?.(post.id, editContent.trim());
                  setEditSaving(false);
                  setShowEditModal(false);
                }}
                style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: GOLD, fontSize: 13, fontWeight: 700, cursor: "pointer", color: WHITE, opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Author header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 10px" }}>
        <div
          onClick={() => setLocation(`/app/usuario/${post.author?.id}`)}
          style={{ cursor: "pointer", flexShrink: 0 }}
        >
          <Avatar src={authorAvatar} name={authorName} size={40} />
        </div>
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setLocation(`/app/usuario/${post.author?.id}`)}>
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{authorName}</div>
          {authorHeadline && <div style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{authorHeadline}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: MUTED }}>{timeAgo(post.created_at)}</div>
          {/* ⋮ menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMenu(v => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20, lineHeight: 1, padding: "2px 5px", borderRadius: 6 }}
            >⋮</button>
            {showMenu && (
              <div
                style={{ position: "absolute", top: "100%", right: 0, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 8px 28px rgba(0,0,0,0.14)", zIndex: 600, minWidth: 190, overflow: "hidden" }}
                onMouseLeave={() => setShowMenu(false)}
              >
                {isOwn ? (
                  <>
                    <button
                      onClick={() => { setShowMenu(false); setEditContent(post.content ?? ""); setShowEditModal(true); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY, textAlign: "left" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}12`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                    >
                      <span>✏️</span> Editar publicação
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); if (window.confirm("Tem certeza que deseja apagar esta publicação?")) onDelete?.(post.id); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#dc2626", textAlign: "left" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fef2f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                    >
                      <span>🗑️</span> Apagar publicação
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setShowMenu(false); onReport?.(post.id); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY, textAlign: "left" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}12`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                    >
                      <span>🚩</span> Denunciar
                    </button>
                    {post.author?.id && (
                      <button
                        onClick={() => { setShowMenu(false); onBlock?.(post.author!.id!, authorName); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#dc2626", textAlign: "left" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fef2f2"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                      >
                        <span>🚫</span> Bloquear {authorName.split(" ")[0]}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div onClick={() => setLocation(`/app/posts/${post.id}`)} style={{ cursor: "pointer", padding: "0 16px" }}>
        {content && (
          <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: images.length ? 10 : 14 }}>
            {displayContent}
          </div>
        )}
        {images.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 0, flexWrap: images.length > 2 ? "wrap" : "nowrap", borderRadius: 10, overflow: "hidden" }}>
            {images.slice(0, 4).map((img, i) =>
              images.length === 1 ? (
                <img key={i} src={img} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "contain", backgroundColor: "#f2f3f5", display: "block" }} />
              ) : (
                <img key={i} src={img} alt="" style={{ flex: 1, minWidth: 0, height: 190, objectFit: "cover" }} />
              )
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px 0", fontSize: 12, color: MUTED }}>
          {post.likes_count > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 14 }}>{reactionInfo?.emoji ?? "👍"}</span> {post.likes_count}
            </span>
          )}
          {post.comments_count > 0 && (
            <span style={{ marginLeft: "auto" }}>{post.comments_count} {post.comments_count === 1 ? "comentário" : "comentários"}</span>
          )}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: BORDER, margin: "8px 0 0" }} />

      {/* Action bar */}
      <div style={{ display: "flex", padding: "2px 0" }}>
        {/* Curtir + reaction picker */}
        <div style={{ flex: 1, position: "relative" }}>
          {showPicker && (
            <div
              onMouseEnter={openPicker}
              onMouseLeave={closePicker}
              style={{
                position: "absolute", bottom: "100%", left: 0,
                backgroundColor: WHITE, border: `1px solid ${BORDER}`,
                borderRadius: 40, padding: "6px 10px",
                display: "flex", gap: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                zIndex: 10, marginBottom: 4,
              }}
            >
              {REACTIONS.map(r => (
                <button
                  key={r.type}
                  title={r.label}
                  onClick={() => { onReact(post.id, r.type); setShowPicker(false); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 22, padding: "2px 4px", borderRadius: 8,
                    transition: "transform .12s",
                    lineHeight: 1,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.3)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => onLike(post.id)}
            onMouseEnter={openPicker}
            onMouseLeave={closePicker}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, padding: "10px 8px", background: "none", border: "none",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              color: likeColor, borderRadius: 8, transition: "background 0.15s",
            }}
          >
            {reactionInfo ? (
              <span style={{ fontSize: 16, lineHeight: 1 }}>{reactionInfo.emoji}</span>
            ) : (
              <LikeIcon filled={!!(post.is_liked)} color={likeColor} />
            )}
            {likeLabel}
          </button>
        </div>

        {/* Comentar */}
        <button
          onClick={() => setLocation(`/app/posts/${post.id}`)}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "10px 8px", background: "none", border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: 600, color: MUTED, borderRadius: 8, transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          <CommentIcon /> Comentar
        </button>

        {/* Compartilhar */}
        <button
          onClick={() => {
            const url = `${window.location.origin}/post/${post.id}`;
            navigator.clipboard?.writeText(url).catch(() => {});
          }}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "10px 8px", background: "none", border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: 600, color: MUTED, borderRadius: 8, transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          <ShareIcon /> Compartilhar
        </button>

        {/* Salvar */}
        <button
          onClick={() => onBookmark(post.id)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 14px", background: "none", border: "none",
            cursor: "pointer", borderRadius: 8, transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          <BookmarkIcon filled={!!(post.is_bookmarked)} />
        </button>
      </div>
    </div>
  );
}

function WineCard({ wine, onClick }: { wine: WineEntry; onClick: () => void }) {
  const statusLabel: Record<string, string> = { adega: "Na Adega", consumido: "Consumido", presenteado: "Presenteado", wishlist: "Wishlist" };
  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "box-shadow .15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{wine.name}</div>
          {(wine.producer || wine.vintage) && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{[wine.producer, wine.vintage].filter(Boolean).join(" · ")}</div>
          )}
          {wine.region && <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{wine.region}{wine.country ? `, ${wine.country}` : ""}</div>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", border: `1px solid ${GOLD}30`, padding: "3px 10px", borderRadius: 100, whiteSpace: "nowrap", flexShrink: 0 }}>
          {statusLabel[wine.status] ?? wine.status}
        </span>
      </div>
      {wine.rating > 0 && (
        <div style={{ fontSize: 14, color: GOLD, marginTop: 8 }}>{"★".repeat(wine.rating)}{"☆".repeat(5 - wine.rating)}</div>
      )}
      {wine.notes && (
        <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic", marginTop: 6 }}>"{wine.notes.slice(0, 100)}{wine.notes.length > 100 ? "…" : ""}"</div>
      )}
    </div>
  );
}

/* ── Wine detail modal ── */
function WineModal({ wine, onClose }: { wine: WineEntry; onClose: () => void }) {
  const statusLabel: Record<string, string> = { adega: "Na Adega", consumido: "Consumido", presenteado: "Presenteado", wishlist: "Wishlist" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: WHITE, borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>🍷 Detalhes do Vinho</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>{wine.name}</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", border: `1px solid ${GOLD}30`, padding: "4px 12px", borderRadius: 100, marginBottom: 16, display: "inline-block" }}>
          {statusLabel[wine.status] ?? wine.status}
        </span>
        <div style={{ marginTop: 8 }}>
          {[
            { label: "Produtor", value: wine.producer },
            { label: "Uva/Casta", value: wine.grape },
            { label: "Safra", value: wine.vintage },
            { label: "Região", value: wine.region },
            { label: "País", value: wine.country },
            { label: "Quantidade", value: wine.qty ? String(wine.qty) : null },
            { label: "Preço", value: wine.price != null ? `R$ ${Number(wine.price).toFixed(2)}` : null },
            { label: "Local de Armazenamento", value: wine.storage },
          ].filter(r => !!r.value).map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 13, color: MUTED }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{r.value}</span>
            </div>
          ))}
        </div>
        {wine.rating > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Avaliação</div>
            <div style={{ fontSize: 22, color: GOLD }}>{"★".repeat(wine.rating)}{"☆".repeat(5 - wine.rating)}</div>
          </div>
        )}
        {(wine.aroma || wine.sabor || wine.harmonizacao) && (
          <div style={{ backgroundColor: BG, borderRadius: 12, padding: 14, marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 2 }}>Avaliação Sensorial</div>
            {wine.aroma && <div style={{ fontSize: 13, color: MUTED }}>👃 <strong>Aroma:</strong> {wine.aroma}</div>}
            {wine.sabor && <div style={{ fontSize: 13, color: MUTED }}>👅 <strong>Sabor:</strong> {wine.sabor}</div>}
            {wine.harmonizacao && <div style={{ fontSize: 13, color: MUTED }}>🍽️ <strong>Harmonização:</strong> {wine.harmonizacao}</div>}
          </div>
        )}
        {wine.notes && (
          <div style={{ backgroundColor: BG, borderRadius: 12, padding: 14, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 4 }}>Notas</div>
            <div style={{ fontSize: 13, color: NAVY, fontStyle: "italic", lineHeight: 1.6 }}>"{wine.notes}"</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════ */
export default function PerfilUsuarioPage() {
  const { id: targetId } = useParams<{ id: string }>();
  const { profile: currentProfile, user, activeCompany } = useAuth();
  const [, setLocation] = useLocation();
  const currentUserId = currentProfile?.id ?? user?.id ?? "";

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ connections: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [wines, setWines] = useState<WineEntry[]>([]);
  const [anuncios, setAnuncios] = useState<CompanyAdminOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"publicacoes" | "anuncios" | "adega" | "sobre">("publicacoes");

  /* Connection / follow state */
  const [connectionStatus, setConnectionStatus] = useState<"none" | "pending" | "connected">("none");
  const [isFollowing, setIsFollowing] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);

  const [selectedWine, setSelectedWine] = useState<WineEntry | null>(null);

  /* Network modal state */
  const [networkModal, setNetworkModal] = useState<{ type: NetworkModalType; list: ProfilePerson[]; loading: boolean } | null>(null);

  const openNetworkModal = async (type: NetworkModalType) => {
    if (!targetId) return;
    setNetworkModal({ type, list: [], loading: true });
    let list: ProfilePerson[] = [];
    if (type === "conexoes")   list = await fetchConnectionsList(targetId);
    if (type === "seguidores") list = await fetchFollowersList(targetId);
    if (type === "seguindo")   list = await fetchFollowingList(targetId);
    setNetworkModal({ type, list, loading: false });
  };

  useEffect(() => {
    if (!targetId) return;
    if (targetId === currentUserId) { setLocation("/app/perfil"); return; }

    setLoading(true);
    Promise.all([
      fetchPublicUserProfile(targetId),
      fetchProfileStats(targetId),
      fetchUserPosts(targetId, currentUserId || undefined),
      fetchPublicWineCellar(targetId),
      currentUserId ? checkWebConnectionStatus(targetId, currentUserId) : Promise.resolve("none" as const),
      currentUserId ? checkWebFollowStatus(targetId, currentUserId) : Promise.resolve(false),
      fetchUserOpportunities(targetId, "marketplace"),
    ]).then(([prof, s, p, w, connStatus, following, ann]) => {
      setUserProfile(prof);
      setStats(s);
      setPosts(p);
      setWines(w);
      setConnectionStatus(connStatus);
      setIsFollowing(following);
      setAnuncios(ann.filter(a => a.is_active));
      setLoading(false);
    });
  }, [targetId, currentUserId]);

  const handleConnect = async () => {
    if (!currentUserId || connectLoading || connectionStatus !== "none") return;
    setConnectLoading(true);
    setConnectionStatus("pending");
    if (!isFollowing) setIsFollowing(true);
    await sendWebConnectionRequest(targetId!, currentUserId);
    setConnectLoading(false);
  };

  const handleFollow = async () => {
    if (!currentUserId || followLoading) return;
    setFollowLoading(true);
    const next = !isFollowing;
    setIsFollowing(next);
    setStats(s => ({ ...s, followers: s.followers + (next ? 1 : -1) }));
    await toggleWebFollow(targetId!, currentUserId, !next);
    setFollowLoading(false);
  };

  const handleMessage = async () => {
    if (!currentUserId || msgLoading || !targetId) return;
    setMsgLoading(true);
    const convId = await getOrCreateWebConversation(currentUserId, targetId);
    setMsgLoading(false);
    if (convId) {
      setLocation(`/app/mensagens?conv=${convId}`);
    }
  };

  /* Post like / react / bookmark */
  const handleLikePost = (postId: string) => {
    if (!currentUserId) return;
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const wasLiked = p.is_liked ?? false;
      const newLiked = !wasLiked;
      toggleLikePost(postId, currentUserId, wasLiked);
      return { ...p, is_liked: newLiked, likes_count: wasLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1 };
    }));
  };

  const handleReactPost = (postId: string, reaction: ReactionType) => {
    if (!currentUserId) return;
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const sameReaction = p.reaction_type === reaction;
      const wasLiked = p.is_liked ?? false;
      changeReactionPost(postId, currentUserId, reaction);
      return {
        ...p,
        reaction_type: sameReaction ? null : reaction,
        is_liked: !sameReaction,
        likes_count: sameReaction ? Math.max(0, p.likes_count - 1) : (wasLiked ? p.likes_count : p.likes_count + 1),
      };
    }));
  };

  const handleBookmarkPost = (postId: string) => {
    if (!currentUserId) return;
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const wasBookmarked = p.is_bookmarked ?? false;
      toggleBookmarkPost(postId, currentUserId, wasBookmarked);
      return { ...p, is_bookmarked: !wasBookmarked };
    }));
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUserId) return;
    const ok = await deletePost(postId, currentUserId);
    if (ok) setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleEditPost = async (postId: string, content: string) => {
    if (!currentUserId) return;
    const ok = await updatePost(postId, currentUserId, content);
    if (ok) setPosts(prev => prev.map(p => p.id === postId ? { ...p, content } : p));
  };

  const handleReportPost = async (postId: string) => {
    if (!currentUserId) return;
    await reportPost(currentUserId, postId, "conteudo_inapropriado");
    alert("Denúncia enviada. Obrigado por contribuir com a comunidade.");
  };

  const handleBlockUserPost = async (authorId: string, authorName: string) => {
    if (!currentUserId) return;
    if (!window.confirm(`Bloquear ${authorName}? Você não verá mais as publicações desta pessoa.`)) return;
    await blockUser(currentUserId, authorId);
    setPosts(prev => prev.filter(p => p.author?.id !== authorId));
    setLocation("/app");
  };

  /* Mensagem button is available when following OR connected */
  const canMessage = isFollowing || connectionStatus === "connected";

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${GOLD}30`, borderTopColor: GOLD, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
  const isCompany = userProfile.profile_type === "empresa";
  const tab2 = isCompany ? "portifólio" : "adega";
  const tab2Label = isCompany ? "Portifólio" : "Adega";

  /* Connect button state */
  const connectBtnLabel = connectionStatus === "connected" ? "✓ Conectado" : connectionStatus === "pending" ? "Solicitado" : "Conectar";
  const connectBtnDisabled = connectionStatus !== "none" || connectLoading;
  const connectBtnBg = connectionStatus === "connected" ? "#e8f5e9" : connectionStatus === "pending" ? BG : GOLD;
  const connectBtnColor = connectionStatus === "connected" ? "#16a34a" : connectionStatus === "pending" ? MUTED : WHITE;

  return (
    <AppShell>
      {/* Network modal */}
      {networkModal && (
        <NetworkModal
          type={networkModal.type}
          list={networkModal.list}
          loading={networkModal.loading}
          onClose={() => setNetworkModal(null)}
          onNavigate={(id) => setLocation(`/app/usuario/${id}`)}
        />
      )}

      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Back */}
        <button onClick={() => history.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Voltar
        </button>

        {/* Profile card */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, marginBottom: 14, position: "relative" }}>

          {/* Cover */}
          <div style={{ height: 120, background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a5f 60%, #2a4a6b 100%)`, position: "relative", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", top: -90, right: -50, backgroundColor: "rgba(201,168,76,0.12)" }} />
            <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", bottom: -50, left: -30, backgroundColor: "rgba(201,168,76,0.07)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: GOLD, opacity: 0.6 }} />
          </div>

          {/* Avatar — absolutely positioned to straddle the cover/content boundary */}
          <div style={{ position: "absolute", left: 24, top: 72, zIndex: 2, width: 104, height: 104, borderRadius: "50%", backgroundColor: WHITE, padding: 4, boxSizing: "border-box" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", backgroundColor: WINE }}>
              <Avatar src={userProfile.avatar_url} name={userProfile.full_name} size={96} />
            </div>
          </div>

          <div style={{ padding: "0 24px 24px" }}>
            {/* Action buttons row — avatar-space on left, buttons on right */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 12, paddingBottom: 8 }}>
              <div style={{ width: 104, flexShrink: 0 }} />{/* spacer matching avatar width so buttons stay clear */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* 1. Seguir */}
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  style={{
                    padding: "9px 18px", border: `1.5px solid ${isFollowing ? BORDER : NAVY}`, borderRadius: 10,
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    backgroundColor: isFollowing ? "transparent" : NAVY,
                    color: isFollowing ? NAVY : WHITE,
                    opacity: followLoading ? 0.7 : 1,
                  }}
                >
                  {isFollowing ? "Seguindo" : "Seguir"}
                </button>

                {/* 2. Conectar (hidden when already connected, or viewer/profile is a company) */}
                {!activeCompany && !isCompany && connectionStatus !== "connected" && (
                  <button
                    onClick={handleConnect}
                    disabled={connectBtnDisabled}
                    style={{
                      padding: "9px 18px", border: "none", borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: connectBtnDisabled ? "default" : "pointer",
                      backgroundColor: connectBtnBg, color: connectBtnColor,
                    }}
                  >
                    {connectLoading ? "…" : connectBtnLabel}
                  </button>
                )}
                {connectionStatus === "connected" && (
                  <div style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, backgroundColor: "#e8f5e9", color: "#16a34a" }}>
                    ✓ Conectado
                  </div>
                )}

              </div>
            </div>

            {/* Name + plan */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: 0 }}>{userProfile.full_name}</h1>
                <PlanBadge plan={userProfile.plan} hideFree />
              </div>
              {userProfile.username && <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>@{userProfile.username}</div>}
              {headline && <div style={{ fontSize: 14, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>{headline}</div>}
              {userProfile.location && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 13, color: MUTED }}>
                  <span>📍</span> {userProfile.location}
                </div>
              )}
              {userProfile.bio && (
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, margin: "10px 0 0" }}>{userProfile.bio}</p>
              )}
            </div>

            {/* Tags */}
            {(userProfile.areas_of_expertise ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {(userProfile.areas_of_expertise ?? []).map(a => <Tag key={a} label={a} color={GOLD} />)}
              </div>
            )}
            {(userProfile.certifications ?? []).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Certificações</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(userProfile.certifications ?? []).map(c => <Tag key={c} label={c} color={NAVY} />)}
                </div>
              </div>
            )}

            {/* Stats — clickable */}
            <div style={{ display: "flex", gap: 0, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              {[
                { label: "Conexões",   value: stats.connections, modal: "conexoes" as NetworkModalType },
                { label: "Seguidores", value: stats.followers,   modal: "seguidores" as NetworkModalType },
                { label: "Seguindo",   value: stats.following,   modal: "seguindo" as NetworkModalType },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <button
                    onClick={() => openNetworkModal(s.modal)}
                    style={{ flex: 1, textAlign: "center", background: "none", border: "none", cursor: "pointer", padding: "8px 0", borderRadius: 10, transition: "background .12s" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ fontSize: 22, fontWeight: 900, color: GOLD }}>{fmtN(s.value)}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
                  </button>
                  {i < arr.length - 1 && <div style={{ width: 1, backgroundColor: BORDER }} />}
                </React.Fragment>
              ))}
            </div>

            {/* Mensagem — below the stats row, full width, only when following or connected */}
            {canMessage && (
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={handleMessage}
                  disabled={msgLoading}
                  style={{
                    width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: msgLoading ? "default" : "pointer", border: "none",
                    backgroundColor: GOLD, color: WHITE, opacity: msgLoading ? 0.7 : 1,
                  }}
                >
                  {msgLoading ? "Abrindo conversa…" : "✉ Mensagem"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0 4px", marginBottom: 16, display: "flex" }}>
          {(["publicacoes", "anuncios", tab2, "sobre"] as const).map(t => {
            const labels: Record<string, string> = { publicacoes: "Publicações", anuncios: "Anúncios", [tab2]: tab2Label, sobre: "Sobre" };
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t as any)} style={{
                flex: 1, padding: "14px 8px", background: "none", border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: active ? 800 : 500,
                color: active ? GOLD : MUTED,
                borderBottom: active ? `2.5px solid ${GOLD}` : "2.5px solid transparent",
                fontFamily: "inherit", transition: "color .15s",
              }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "publicacoes" && (
          posts.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Nenhuma publicação ainda</h3>
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Este usuário ainda não publicou nada.</p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onLike={handleLikePost}
                onReact={handleReactPost}
                onBookmark={handleBookmarkPost}
                onDelete={handleDeletePost}
                onEdit={handleEditPost}
                onReport={handleReportPost}
                onBlock={handleBlockUserPost}
              />
            ))
          )
        )}

        {tab === "anuncios" && (
          anuncios.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Nenhum anúncio</h3>
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Este usuário ainda não publicou anúncios no Mercado.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {anuncios.map(a => (
                <div
                  key={a.id}
                  onClick={() => setLocation("/app/mercado")}
                  style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, cursor: "pointer" }}
                >
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt={a.title} style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: BORDER, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>🖼️</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}>{a.title}</div>
                    {a.price ? <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginTop: 2 }}>{a.price}</div> : null}
                    {a.category ? <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{a.category}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === tab2 && (
          wines.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>
                {isCompany ? "Portifólio ainda vazio" : "Adega ainda vazia"}
              </h3>
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>
                {isCompany ? "Esta empresa ainda não compartilhou seu portifólio." : "Este usuário ainda não compartilhou nada na adega."}
              </p>
            </div>
          ) : (
            wines.map(wine => <WineCard key={wine.id} wine={wine} onClick={() => setSelectedWine(wine)} />)
          )
        )}

        {tab === "sobre" && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: "0 0 16px" }}>Sobre</h3>
            {userProfile.bio ? (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 16px" }}>{userProfile.bio}</p>
            ) : (
              <p style={{ fontSize: 14, color: MUTED, margin: "0 0 16px" }}>Nenhuma bio adicionada.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(userProfile.position || userProfile.company) && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>🏢</span>
                  </div>
                  <div>
                    {userProfile.position && <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{userProfile.position}</div>}
                    {userProfile.company && <div style={{ fontSize: 13, color: MUTED }}>{userProfile.company}</div>}
                  </div>
                </div>
              )}
              {userProfile.location && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>📍</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{userProfile.location}</div>
                </div>
              )}
            </div>
            {(userProfile.certifications ?? []).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Certificações</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(userProfile.certifications ?? []).map(c => <Tag key={c} label={c} color={NAVY} />)}
                </div>
              </div>
            )}
            {(userProfile.areas_of_expertise ?? []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Áreas de Expertise</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(userProfile.areas_of_expertise ?? []).map(a => <Tag key={a} label={a} color={GOLD} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wine detail modal */}
        {selectedWine && <WineModal wine={selectedWine} onClose={() => setSelectedWine(null)} />}
      </div>
    </AppShell>
  );
}
