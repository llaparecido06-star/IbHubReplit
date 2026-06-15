import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { AppShell } from "@/components/layout/AppShell";
import StoriesBar from "@/components/stories/StoriesBar";
import { supabase } from "@/lib/supabase";
import {
  Post,
  Poll,
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
  voteOnFeedPoll,
  closeFeedPoll,
  fetchPollVoters,
  deletePost,
  updatePost,
  blockUser,
  reportPost,
} from "@/services/api";
import { formatRelativeDate } from "@/utils/dateUtils";
import { LikesModal } from "@/components/feed/LikesModal";
import VideoPlayer from "@/components/feed/VideoPlayer";
import { PostActionsBar, reactionEmoji } from "@/components/feed/PostActionsBar";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

import { resolvePlanStyle, isFreePlan } from "@/components/PlanBadge";

function planBadgeStyle(plan?: string | null): { color: string; label: string } | null {
  if (isFreePlan(plan)) return null;
  const resolved = resolvePlanStyle(plan);
  return resolved ? { color: resolved.color, label: resolved.label } : null;
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

/* ─── Wine Tasting Card (web) ───────────── */
type WineField = { prefix: string; icon: string; label: string | null; isTitle?: boolean; isScore?: boolean };
const WINE_FIELDS: WineField[] = [
  { prefix: "🍷 Degustação:", icon: "🍷", label: null, isTitle: true },
  { prefix: "🏠 Produtor:",   icon: "🏠", label: "Produtor" },
  { prefix: "🌿 Uva/Casta:", icon: "🍃", label: "Uva/Casta" },
  { prefix: "📅 Safra:",      icon: "📅", label: "Safra" },
  { prefix: "📍 Região:",     icon: "📍", label: "Região" },
  { prefix: "🌍 País:",       icon: "🌍", label: "País" },
  { prefix: "🏷️ EAN:",        icon: "🏷", label: "EAN" },
  { prefix: "⭐ Pontuação:",   icon: "⭐", label: "Pontuação", isScore: true },
  { prefix: "👃 Aroma:",       icon: "💨", label: "Aroma" },
  { prefix: "👅 Sabor:",       icon: "⚡", label: "Sabor" },
  { prefix: "🍽️ Harmonização:", icon: "❤️", label: "Harmonização" },
  { prefix: "📝 Notas:",       icon: "📄", label: "Notas" },
];

function normalizeLegacyWineContent(content: string): string {
  if (/^🍷 Degustação:/m.test(content)) return content;
  const lines = content.split("\n");
  if (lines.length === 0 || !/^⭐+\s+/.test(lines[0])) return content;
  const out: string[] = [];
  const firstLine = lines[0].replace(/^⭐+\s+/, "").trim();
  if (firstLine) out.push(`🍷 Degustação: ${firstLine}`);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/·/.test(line) && /^[🍇📅🏭📍🌍]\s/.test(line)) {
      for (const tok of line.split("·").map(t => t.trim())) {
        if (/^🍇\s/.test(tok))      out.push(`🌿 Uva/Casta: ${tok.replace(/^🍇\s+/, "")}`);
        else if (/^📅\s/.test(tok)) out.push(`📅 Safra: ${tok.replace(/^📅\s+/, "")}`);
        else if (/^🏭\s/.test(tok)) out.push(`🏠 Produtor: ${tok.replace(/^🏭\s+/, "")}`);
        else if (/^📍\s/.test(tok)) out.push(`📍 Região: ${tok.replace(/^📍\s+/, "")}`);
        else if (/^🌍\s/.test(tok)) out.push(`🌍 País: ${tok.replace(/^🌍\s+/, "")}`);
      }
      continue;
    }
    if (/^📊 Pontuação:/.test(line))      out.push(line.replace(/^📊/, "⭐"));
    else if (/^🍷 Notas:/.test(line))     out.push(line.replace(/^🍷 Notas:/, "📝 Notas:"));
    else                                   out.push(line);
  }
  return out.join("\n");
}

function parseWineContent(content: string): { field: WineField; value: string }[] {
  return normalizeLegacyWineContent(content).split("\n").map(l => l.trim()).filter(Boolean).flatMap(line => {
    for (const field of WINE_FIELDS) {
      if (line.startsWith(field.prefix)) {
        const value = line.slice(field.prefix.length).trim();
        return value ? [{ field, value }] : [];
      }
    }
    return [];
  });
}

export function WineTastingCardWeb({ content }: { content: string }) {
  const parsed = parseWineContent(content);
  if (parsed.length === 0) return null;
  const titleEntry = parsed.find(p => p.field.isTitle);
  const scoreEntry = parsed.find(p => p.field.isScore);
  const rows = parsed.filter(p => !p.field.isTitle && !p.field.isScore);
  return (
    <div style={{
      backgroundColor: `${GOLD}10`,
      border: `1px solid ${GOLD}35`,
      borderRadius: 10,
      padding: "12px 14px",
      marginTop: 4,
    }}>
      {titleEntry && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: rows.length > 0 ? 10 : 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            backgroundColor: `${GOLD}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>
            🍷
          </div>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: NAVY }}>{titleEntry.value}</span>
          {scoreEntry && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              backgroundColor: GOLD, borderRadius: 8,
              padding: "3px 8px",
            }}>
              <span style={{ fontSize: 13 }}>⭐</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: WHITE }}>{scoreEntry.value}</span>
            </div>
          )}
        </div>
      )}
      {!titleEntry && scoreEntry && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span>⭐</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{scoreEntry.value}</span>
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ borderTop: `1px solid ${GOLD}25`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          {rows.map(({ field, value }) => (
            <div key={field.prefix} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
              <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>{field.icon}</span>
              {field.label && (
                <span style={{ fontWeight: 600, color: MUTED, minWidth: 100, flexShrink: 0 }}>{field.label}:</span>
              )}
              <span style={{ color: NAVY, lineHeight: 1.5 }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ─── PollDisplay ───────────────────────── */
export function PollDisplay({ poll, postId, currentUserId, postAuthorId, onVote, onClosePoll }: {
  poll: Poll;
  postId: string;
  currentUserId: string;
  postAuthorId?: string;
  onVote: (postId: string, updatedPoll: Poll) => void;
  onClosePoll?: (postId: string, updatedPoll: Poll) => void;
}) {
  const [, setLocation] = useLocation();
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const [focusedOption, setFocusedOption] = useState<number | null>(null);
  const [voters, setVoters] = useState<{ id: string; full_name: string | null; avatar_url: string | null; username: string | null; optionIndex: number }[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);

  const votedIndices = poll.user_voted_indices ?? (poll.user_voted_index != null ? [poll.user_voted_index] : []);
  const hasVoted = votedIndices.length > 0;
  const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
  const isClosed = poll.closed || isExpired;
  const lockedFromVoting = isClosed;
  const total = poll.total_votes;

  const fmtExpiry = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    if (diffMs < 0) return "Encerrada";
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 24) return `Encerra em ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `Encerra em ${diffD} dia${diffD !== 1 ? "s" : ""}`;
  };

  const isAuthor = !!postAuthorId && postAuthorId === currentUserId;

  const handleVote = async (i: number) => {
    if (voting || lockedFromVoting) return;
    setVoting(true);
    const updated = await voteOnFeedPoll(postId, currentUserId, i);
    if (updated) onVote(postId, updated);
    setVoting(false);
  };

  const handleClosePoll = async () => {
    if (closing) return;
    setClosing(true);
    setConfirmClose(false);
    const updated = await closeFeedPoll(postId);
    if (updated) onClosePoll?.(postId, updated);
    setClosing(false);
  };

  // Refetch voters reactively while the modal is open. Keyed on a stable
  // serialised user_votes string so unrelated parent re-renders don't refire.
  const userVotesKey = poll.user_votes ? JSON.stringify(poll.user_votes) : "";
  useEffect(() => {
    if (!showVoters) return;
    let cancelled = false;
    const votesMap = userVotesKey ? (JSON.parse(userVotesKey) as Record<string, number | number[]>) : {};
    const ids = Object.keys(votesMap);
    if (ids.length === 0) {
      setVoters([]);
      setLoadingVoters(false);
      return;
    }
    setLoadingVoters(true);
    fetchPollVoters(ids)
      .then(profiles => {
        if (cancelled) return;
        const expanded: { id: string; full_name: string | null; avatar_url: string | null; username: string | null; optionIndex: number }[] = [];
        for (const p of profiles) {
          const raw = votesMap[p.id];
          const indices = Array.isArray(raw) ? raw : (typeof raw === "number" ? [raw] : []);
          for (const idx of indices) expanded.push({ ...p, optionIndex: idx });
        }
        setVoters(expanded);
      })
      .catch(err => { if (!cancelled) console.warn("fetchPollVoters failed:", err); })
      .finally(() => { if (!cancelled) setLoadingVoters(false); });
    return () => { cancelled = true; };
  }, [showVoters, userVotesKey]);

  const handleShowVoters = (optionIndex: number | null) => {
    setFocusedOption(optionIndex);
    setShowVoters(true);
  };

  const handleOptionClick = (i: number) => {
    if (lockedFromVoting) {
      void handleShowVoters(i);
    } else {
      void handleVote(i);
    }
  };

  return (
    <div style={{ padding: "0 16px 12px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {poll.options.map((opt, i) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          const isMyVote = votedIndices.includes(i);
          const showBar = hasVoted || isClosed;
          return (
            <div key={i}
              onClick={() => handleOptionClick(i)}
              onContextMenu={(e) => {
                if (opt.votes > 0) {
                  e.preventDefault();
                  void handleShowVoters(i);
                }
              }}
              style={{
                position: "relative", borderRadius: 10, overflow: "hidden",
                border: `2px solid ${isMyVote ? GOLD : BORDER}`,
                cursor: (lockedFromVoting && opt.votes > 0) || (!lockedFromVoting && !voting) ? "pointer" : "default",
                background: WHITE,
              }}
            >
              {showBar && (
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`,
                  background: isMyVote ? `${GOLD}25` : "#f0f0f0",
                  transition: "width 0.4s ease", borderRadius: 8,
                }} />
              )}
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                <span style={{ fontSize: 14, color: NAVY, fontWeight: isMyVote ? 700 : 400, display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Radio / checkbox indicator */}
                  <span style={{
                    flexShrink: 0,
                    width: 18, height: 18,
                    borderRadius: poll.allow_multiple ? 4 : "50%",
                    border: `2px solid ${isMyVote ? GOLD : "#b0b8c4"}`,
                    backgroundColor: isMyVote ? GOLD : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.18s",
                  }}>
                    {isMyVote && (
                      <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>
                    )}
                  </span>
                  {opt.text}
                </span>
                {showBar && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: isMyVote ? GOLD : MUTED, marginLeft: 8 }}>{pct}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 12, color: MUTED }}>
        <span>{total} voto{total !== 1 ? "s" : ""}</span>
        {poll.expires_at && (
          <span>· {fmtExpiry(poll.expires_at)}</span>
        )}
        {isClosed && <span style={{ color: "#dc2626", fontWeight: 700 }}>· Encerrada</span>}
        {total > 0 && (
          <button
            onClick={() => handleShowVoters(null)}
            style={{ background: "none", border: "none", color: GOLD, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, marginLeft: "auto" }}
          >
            Ver todos os votos
          </button>
        )}
        {isAuthor && !isClosed && (
          <button
            onClick={() => setConfirmClose(true)}
            style={{ background: "none", border: "none", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, marginLeft: total > 0 ? 0 : "auto" }}
          >
            Encerrar enquete
          </button>
        )}
      </div>

      {confirmClose && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 2100, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmClose(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, width: "90%", maxWidth: 360, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: NAVY }}>Encerrar enquete?</h3>
            <p style={{ margin: "0 0 22px", fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
              A enquete será encerrada imediatamente e ninguém poderá mais votar. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmClose(false)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", color: NAVY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleClosePoll()}
                disabled={closing}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 14, cursor: closing ? "default" : "pointer", opacity: closing ? 0.7 : 1 }}
              >
                {closing ? "Encerrando…" : "Encerrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVoters && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowVoters(false)}>
          <div style={{ background: WHITE, borderRadius: 16, width: "90%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto", padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: NAVY }}>
                {focusedOption != null
                  ? `Votos · ${poll.options[focusedOption]?.text ?? ""}`
                  : `Todos os votos (${total})`}
              </h3>
              <button onClick={() => setShowVoters(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: MUTED }}>×</button>
            </div>
            {poll.options.map((opt, i) => {
              if (focusedOption != null && i !== focusedOption) return null;
              const optVoters = voters.filter(v => v.optionIndex === i);
              const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
              if (opt.votes === 0 && !loadingVoters) return null;
              return (
                <div key={i} style={{ marginBottom: 16 }}>
                  {focusedOption == null && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{opt.text}</span>
                      <span style={{ fontSize: 12, color: MUTED }}>{opt.votes} voto{opt.votes !== 1 ? "s" : ""} · {pct}%</span>
                    </div>
                  )}
                  {loadingVoters ? (
                    <div style={{ fontSize: 12, color: MUTED }}>Carregando...</div>
                  ) : optVoters.map(v => (
                    <div
                      key={v.id}
                      onClick={() => { setShowVoters(false); setLocation(v.id === currentUserId ? "/app/perfil" : `/app/usuario/${v.id}`); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer", borderRadius: 8, padding: "4px 6px", margin: "0 -6px 6px", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {v.avatar_url
                        ? <img src={v.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        : <div style={{ width: 32, height: 32, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: WHITE, flexShrink: 0 }}>{(v.full_name?.[0] ?? "?").toUpperCase()}</div>
                      }
                      <span style={{ fontSize: 13, color: NAVY, fontWeight: 500 }}>{v.full_name ?? v.username ?? "Usuário"}</span>
                    </div>
                  ))}
                </div>
              );
            })}
            {!loadingVoters && voters.length === 0 && (
              <div style={{ fontSize: 13, color: MUTED, textAlign: "center", padding: "20px 0" }}>Detalhes dos votantes não disponíveis</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── PostCard ───────────────────────────── */
function PostCard({
  post,
  currentUserId,
  onLike,
  onBookmark,
  onPollVote,
  onClosePoll,
  onOpenLikes,
  onDelete,
  onEdit,
  onReport,
  onBlock,
}: {
  post: Post;
  currentUserId: string;
  onLike: (id: string, isLiked: boolean, reaction: ReactionType) => void;
  onBookmark: (id: string, isBookmarked: boolean) => void;
  onPollVote: (postId: string, updatedPoll: Poll) => void;
  onClosePoll?: (postId: string, updatedPoll: Poll) => void;
  onOpenLikes?: (id: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (postId: string, newContent: string) => void;
  onReport?: (postId: string) => void;
  onBlock?: (authorId: string, authorName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContent, setEditContent] = useState(post.content ?? "");
  const [editSaving, setEditSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const CUTOFF = 280;
  const content = post.content ?? "";
  const isLong = content.length > CUTOFF;
  const displayContent = isLong && !expanded ? content.slice(0, CUTOFF).trimEnd() + "…" : content;

  const [, setLocation] = useLocation();
  const isWinePost = /^🍷 Degustação:/m.test(content) || (/^⭐/.test(content) && /Pontuação/.test(content));
  const companyPage = post.company_page ?? null;
  const authorName = companyPage ? companyPage.name : (post.author?.full_name ?? "Usuário");
  const authorAvatar = companyPage ? companyPage.avatar_url : post.author?.avatar_url;
  const authorBadge = companyPage ? null : planBadgeStyle(post.author?.plan);
  const badgeColor = companyPage ? GOLD : (authorBadge?.color ?? null);
  const badgeLabel = companyPage ? "Empresa" : (authorBadge?.label ?? null);
  const goToAuthor = () => {
    if (companyPage) { setLocation(`/app/empresa/${companyPage.id}`); return; }
    if (post.author?.id && post.author.id !== currentUserId) setLocation(`/app/usuario/${post.author.id}`);
    else if (post.author?.id === currentUserId) setLocation("/app/perfil");
  };

  return (
    <div className="post-card" style={{
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

        {/* ⋮ menu */}
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setShowMenu(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20, lineHeight: 1, padding: "2px 6px", borderRadius: 6 }}
            title="Opções"
          >⋮</button>
          {showMenu && (
            <div
              style={{ position: "absolute", top: "100%", right: 0, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 8px 28px rgba(0,0,0,0.14)", zIndex: 600, minWidth: 180, overflow: "hidden" }}
              onMouseLeave={() => setShowMenu(false)}
            >
              {post.author?.id === currentUserId ? (
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

      {/* Content */}
      <div style={{ padding: "0 16px 12px" }}>
        {isWinePost ? (
          <WineTastingCardWeb content={content} />
        ) : (
          <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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
        <img src={post.image_url} alt="" style={{ width: "100%", height: "auto", maxHeight: 640, objectFit: "contain", display: "block", backgroundColor: "#f2f3f5" }} />
      )}
      {post.image_urls && post.image_urls.length > 0 && !post.image_url && (
        post.image_urls.length === 1 ? (
          <img src={post.image_urls[0]} alt="" style={{ width: "100%", height: "auto", maxHeight: 640, objectFit: "contain", display: "block", backgroundColor: "#f2f3f5" }} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {post.image_urls.slice(0, 4).map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: "100%", height: 220, objectFit: "cover" }} />
            ))}
          </div>
        )
      )}

      {/* Video */}
      {post.video_url && <VideoPlayer src={post.video_url} />}

      {/* Poll */}
      {post.poll && post.poll.options && post.poll.options.length > 0 && (
        <PollDisplay
          poll={post.poll}
          postId={post.id}
          currentUserId={currentUserId}
          postAuthorId={post.user_id}
          onVote={onPollVote}
          onClosePoll={onClosePoll}
        />
      )}

      {/* Stats */}
      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div style={{ display: "flex", gap: 12, padding: "8px 16px", fontSize: 12, color: MUTED, borderTop: `1px solid ${BORDER}` }}>
          {post.likes_count > 0 && (
            <button
              onClick={() => onOpenLikes?.(post.id)}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 12, padding: 0 }}
            >
              <span>{post.is_liked ? reactionEmoji(post.reaction_type ?? "saude") : "👍"}</span>
              {post.likes_count}
            </button>
          )}
          {post.comments_count > 0 && <span style={{ marginLeft: "auto" }}>{post.comments_count} comentário{post.comments_count !== 1 ? "s" : ""}</span>}
        </div>
      )}

      <PostActionsBar
        post={post}
        onReact={(reaction) => onLike(post.id, !!post.is_liked, reaction)}
        onComment={() => setLocation(`/app/posts/${post.id}`)}
        onBookmark={() => onBookmark(post.id, !!post.is_bookmarked)}
      />
    </div>
  );
}

/* ─── WelcomeCard (empty feed) ───────────── */
function WelcomeCard({ suggestions, onConnect, onFollow, viewingAsCompany }: {
  suggestions: SuggestedProfile[];
  onConnect: (id: string) => void;
  onFollow?: (id: string, isCurrentlyFollowing: boolean) => void;
  viewingAsCompany?: boolean;
}) {
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "32px 24px", textAlign: "center", marginBottom: 14 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Bem-vindo ao Ibhub!</h2>
      <p style={{ fontSize: 14, color: MUTED, marginBottom: 24 }}>Siga vinícolas e profissionais para personalizar seu feed</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {suggestions.slice(0, 3).map((s) => (
          <SuggestionCard key={s.id} profile={s} onConnect={onConnect} onFollow={onFollow} viewingAsCompany={viewingAsCompany} compact />
        ))}
      </div>
    </div>
  );
}

/* ─── SuggestionCard ─────────────────────── */
function SuggestionCard({
  profile,
  onConnect,
  onFollow,
  viewingAsCompany = false,
  compact = false,
}: {
  profile: SuggestedProfile;
  onConnect: (id: string) => void;
  onFollow?: (id: string, isCurrentlyFollowing: boolean) => void;
  viewingAsCompany?: boolean;
  compact?: boolean;
}) {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState(profile.connection_status);
  const [following, setFollowing] = useState(profile.is_following);
  const useFollowMode = viewingAsCompany || profile.is_company;
  const goToProfile = () => setLocation(profile.is_company ? `/app/empresa/${profile.id}` : `/app/usuario/${profile.id}`);

  const handleConnect = () => {
    if (status !== "none") return;
    setStatus("pending");
    onConnect(profile.id);
  };

  const handleFollow = () => {
    const wasFollowing = following;
    setFollowing(prev => !prev);
    onFollow?.(profile.id, wasFollowing);
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
      <div onClick={goToProfile} style={{ cursor: "pointer" }}>
        <Avatar src={profile.avatar_url} name={profile.full_name} size={compact ? 44 : 52} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div onClick={goToProfile} style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: NAVY, cursor: "pointer" }}>{profile.full_name}</div>
        {profile.headline && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>
            {profile.headline.length > 40 ? profile.headline.slice(0, 40) + "…" : profile.headline}
          </div>
        )}
        {profile.company_match ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#1a56db", background: "#1a56db15", borderRadius: 6, padding: "1px 6px", marginTop: 4 }}>
            💼 Mesma empresa
          </span>
        ) : profile.match_score > 0 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: GOLD, background: `${GOLD}18`, borderRadius: 6, padding: "1px 6px", marginTop: 4 }}>
            ⚡ {profile.match_score} área{profile.match_score > 1 ? "s" : ""} em comum
          </span>
        ) : null}
      </div>
      {useFollowMode ? (
        <button
          onClick={handleFollow}
          style={{
            width: "100%", padding: "7px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: "pointer",
            backgroundColor: following ? "transparent" : `${GOLD}15`,
            color: following ? MUTED : GOLD,
            border: `1px solid ${following ? BORDER : GOLD + "50"}`,
          }}
        >
          {following ? "Seguindo" : "Seguir"}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={status !== "none"}
          style={{
            width: "100%", padding: "7px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: status === "none" ? "pointer" : "default",
            backgroundColor: status === "none" ? NAVY : "#f5f5f0",
            color: status === "none" ? WHITE : MUTED,
            border: `1px solid ${status === "none" ? NAVY : BORDER}`,
          }}
        >
          {status === "pending" ? "Pendente" : status === "connected" ? "Conectado" : "Conectar"}
        </button>
      )}
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
    <div className="feed-post-trigger" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
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
function SuggestionsPanel({ suggestions, onConnect, onFollow, viewingAsCompany }: {
  suggestions: SuggestedProfile[];
  onConnect: (id: string) => void;
  onFollow?: (id: string, isCurrentlyFollowing: boolean) => void;
  viewingAsCompany?: boolean;
}) {
  const [, setLocation] = useLocation();
  if (!suggestions.length) return null;
  const goTo = (s: SuggestedProfile) => setLocation(s.is_company ? `/app/empresa/${s.id}` : `/app/usuario/${s.id}`);
  return (
    <div style={{
      backgroundColor: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      padding: "16px",
      marginBottom: 14,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 14, margin: "0 0 14px" }}>
        Pessoas que você pode conhecer
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {suggestions.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div onClick={() => goTo(s)} style={{ cursor: "pointer", flexShrink: 0 }}>
              <Avatar src={s.avatar_url} name={s.full_name} size={40} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div onClick={() => goTo(s)} style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>{s.full_name}</div>
              {s.headline && <div style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.headline}</div>}
              {s.company_match ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "#1a56db", background: "#1a56db15", borderRadius: 6, padding: "1px 6px", marginTop: 2 }}>
                  💼 Mesma empresa
                </span>
              ) : s.match_score > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: GOLD, background: `${GOLD}18`, borderRadius: 6, padding: "1px 6px", marginTop: 2 }}>
                  ⚡ {s.match_score} área{s.match_score > 1 ? "s" : ""} em comum
                </span>
              ) : null}
            </div>
            <ConnectBtn profile={s} onConnect={onConnect} onFollow={onFollow} viewingAsCompany={viewingAsCompany} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectBtn({ profile, onConnect, onFollow, viewingAsCompany }: {
  profile: SuggestedProfile;
  onConnect: (id: string) => void;
  onFollow?: (id: string, isCurrentlyFollowing: boolean) => void;
  viewingAsCompany?: boolean;
}) {
  const [status, setStatus] = useState(profile.connection_status);
  const [following, setFollowing] = useState(profile.is_following);
  const useFollowMode = viewingAsCompany || profile.is_company;

  const handleClick = () => {
    if (status !== "none") return;
    setStatus("pending");
    onConnect(profile.id);
  };

  const handleFollow = () => {
    const wasFollowing = following;
    setFollowing(prev => !prev);
    onFollow?.(profile.id, wasFollowing);
  };

  if (useFollowMode) {
    return (
      <button
        onClick={handleFollow}
        style={{
          flexShrink: 0,
          fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 8,
          cursor: "pointer",
          backgroundColor: following ? "transparent" : `${GOLD}15`,
          color: following ? MUTED : GOLD,
          border: `1px solid ${following ? BORDER : GOLD + "50"}`,
        }}
      >
        {following ? "Seguindo" : "Seguir"}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={status !== "none"}
      style={{
        flexShrink: 0,
        fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 8,
        cursor: status === "none" ? "pointer" : "default",
        backgroundColor: status === "none" ? NAVY : "#f5f5f0",
        color: status === "none" ? WHITE : MUTED,
        border: `1px solid ${status === "none" ? NAVY : BORDER}`,
      }}
    >
      {status === "pending" ? "Pendente" : status === "connected" ? "Conectado" : "Conectar"}
    </button>
  );
}

/* ─── WineRankingTeaser ──────────────────── */
function WineRankingTeaser({ wines }: { wines: WineCommunityRating[] }) {
  const [, setLocation] = useLocation();
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
        <button
          onClick={() => setLocation("/app/ranking-vinho")}
          style={{ background: "none", border: "none", color: GOLD, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Ver ranking completo →
        </button>
      </div>
    </div>
  );
}

/* ─── Trending Topics ────────────────────── */
function TrendingTopics() {
  const [, setLocation] = useLocation();
  const topics = ["#SustentabilidadeVinícola", "#Chardonnay2024", "#EnoturismoBrasil", "#TerroirSerrano", "#VinosNaturaes"];
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: "0 0 12px" }}>📈 Em Alta</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {topics.map(t => (
          <button
            key={t}
            onClick={() => setLocation(`/app/busca?q=${encodeURIComponent(t)}`)}
            style={{ background: "none", border: "none", textAlign: "left", color: "#1a56db", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
          >
            {t}
          </button>
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
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toast, setToast]             = useState<string | null>(null);
  const [blockConfirm, setBlockConfirm] = useState<{ authorId: string; authorName: string } | null>(null);
  const [likesModalPost, setLikesModalPost] = useState<{ id: string; count: number } | null>(null);

  const userId    = profile?.id ?? user?.id ?? "";
  const firstName = profile?.full_name?.split(" ")[0] ?? "Usuário";
  const companyId = activeCompany?.id ?? null;

  // Stable string keys so array identity changes don't trigger spurious reloads
  const areasKey   = JSON.stringify(Array.isArray(profile?.areas_of_expertise) ? profile.areas_of_expertise : []);
  const companyKey = profile?.company ?? null;

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Always load the full community feed regardless of company mode.
      // Company mode only changes how interactions (likes, etc.) are attributed.
      const userAreas: string[] = JSON.parse(areasKey) as string[];
      const userCompany: string | null = companyKey;
      const [postsData, suggsData] = await Promise.all([
        fetchFeedPosts(userId),
        companyId ? Promise.resolve([]) : fetchWebSuggestedConnections(userId, userAreas, userCompany, 5),
      ]);
      setPosts(postsData);
      setHasMoreFeed(postsData.length >= 30);
      if (!companyId) setSuggestions(suggsData);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, companyId, areasKey, companyKey]);

  const loadMoreFeed = async () => {
    if (!userId || loadingMore || !hasMoreFeed) return;
    setLoadingMore(true);
    try {
      const more = await fetchFeedPosts(userId, posts.length);
      setPosts(prev => [...prev, ...more]);
      setHasMoreFeed(more.length >= 30);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!authLoading) load();
  }, [load, authLoading]);

  useEffect(() => { fetchWineCommunityRankings().then(setWineRankings); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!userId) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`feed_realtime_web_${userId}_${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const raw = payload.new as any;
        if (raw.user_id === userId) return;
        // In personal mode: skip posts from company pages (not part of personal feed)
        if (!companyId && raw.company_page_id) return;
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

  const handleLike = useCallback(async (postId: string, isLiked: boolean, reaction: ReactionType = "saude") => {
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
      await toggleLikePost(postId, userId, false, reaction, companyId, profile?.full_name ?? undefined);
    }
  }, [userId, posts, companyId, profile]);

  const handleBookmark = useCallback(async (postId: string, isBookmarked: boolean) => {
    if (!userId) return;
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, is_bookmarked: !isBookmarked } : p
    ));
    await toggleBookmarkPost(postId, userId, isBookmarked);
  }, [userId]);

  const handlePollVote = useCallback((postId: string, updatedPoll: Poll) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, poll: updatedPoll } : p));
  }, []);

  const handleClosePoll = useCallback((postId: string, updatedPoll: Poll) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, poll: updatedPoll } : p));
  }, []);

  const handleConnect = useCallback(async (targetId: string) => {
    if (!userId) return;
    await sendWebConnectionRequest(targetId, userId);
  }, [userId]);

  const handleFollowSuggestion = useCallback(async (targetId: string, isCurrentlyFollowing: boolean) => {
    if (!userId) return;
    if (isCurrentlyFollowing) {
      await supabase.from("follows").delete()
        .eq("follower_id", userId)
        .eq("following_id", targetId);
    } else {
      await supabase.from("follows").upsert(
        { follower_id: userId, following_id: targetId },
        { onConflict: "follower_id,following_id" },
      );
    }
  }, [userId]);

  const handleDeletePost = useCallback(async (postId: string) => {
    if (!userId) return;
    const ok = await deletePost(postId, userId);
    if (ok) setPosts(prev => prev.filter(p => p.id !== postId));
  }, [userId]);

  const handleEditPost = useCallback(async (postId: string, newContent: string) => {
    if (!userId) return;
    const ok = await updatePost(postId, userId, newContent);
    if (ok) setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent } : p));
  }, [userId]);

  const handleReportPost = useCallback(async (postId: string) => {
    if (!userId) return;
    await reportPost(userId, postId, "conteudo_inapropriado");
    setToast("Denúncia enviada. Obrigado por contribuir com a comunidade.");
  }, [userId]);

  const handleBlockUser = useCallback((authorId: string, authorName: string) => {
    if (!userId) return;
    setBlockConfirm({ authorId, authorName });
  }, [userId]);

  const confirmBlock = async () => {
    if (!blockConfirm || !userId) return;
    await blockUser(userId, blockConfirm.authorId);
    setPosts(prev => prev.filter(p => p.author?.id !== blockConfirm.authorId));
    setBlockConfirm(null);
  };

  return (
    <AppShell onPostCreated={load}>
      <style>{`
        @media (max-width: 767px) {
          .post-card {
            border: none !important;
            border-radius: 0 !important;
            margin-bottom: 8px !important;
            box-shadow: none !important;
          }
          .feed-greeting {
            padding: 14px 16px 0;
          }
          .feed-post-trigger {
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
          }
        }
      `}</style>
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
        <div className="feed-greeting" style={{ marginBottom: 14 }}>
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

          {loading && posts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🍷</div>
              Carregando feed…
            </div>
          ) : posts.length === 0 && !loading ? (
            activeCompany ? (
              <div style={{ textAlign: "center", padding: 48, color: MUTED, backgroundColor: WHITE, borderRadius: 14, border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Nenhuma publicação ainda</div>
                <div style={{ fontSize: 13 }}>Publique o primeiro post como <strong>{activeCompany.name}</strong>!</div>
              </div>
            ) : (
              <WelcomeCard suggestions={suggestions} onConnect={handleConnect} onFollow={handleFollowSuggestion} viewingAsCompany={!!activeCompany} />
            )
          ) : (
            <>
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={userId}
                  onLike={handleLike}
                  onBookmark={handleBookmark}
                  onPollVote={handlePollVote}
                  onClosePoll={handleClosePoll}
                  onOpenLikes={(id) => setLikesModalPost({ id, count: posts.find(p => p.id === id)?.likes_count ?? 0 })}
                  onDelete={handleDeletePost}
                  onEdit={handleEditPost}
                  onReport={handleReportPost}
                  onBlock={handleBlockUser}
                />
              ))}
              {hasMoreFeed ? (
                <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
                  <button
                    onClick={loadMoreFeed}
                    disabled={loadingMore}
                    style={{
                      padding: "10px 32px", borderRadius: 22,
                      border: `1.5px solid ${GOLD}`,
                      backgroundColor: loadingMore ? `${GOLD}15` : WHITE,
                      color: GOLD, fontWeight: 700, fontSize: 14,
                      cursor: loadingMore ? "default" : "pointer",
                      fontFamily: "inherit", transition: "all 0.15s",
                    }}
                  >
                    {loadingMore ? "Carregando…" : "Carregar mais"}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 0 8px", color: MUTED, fontSize: 13 }}>
                  Você está em dia com o feed. 🍷
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right panel ─── (only in personal mode) */}
        {!activeCompany && (
          <div style={{ width: 260, flexShrink: 0, display: "none" }} className="feed-right-panel">
            {suggestions.length > 0 && <SuggestionsPanel suggestions={suggestions.slice(0, 4)} onConnect={handleConnect} onFollow={handleFollowSuggestion} viewingAsCompany={!!activeCompany} />}
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .feed-right-panel { display: block !important; }
        }
      `}</style>

      {/* Likes modal (quem curtiu) */}
      <LikesModal
        postId={likesModalPost?.id ?? null}
        likesCount={likesModalPost?.count ?? 0}
        visible={!!likesModalPost}
        onClose={() => setLikesModalPost(null)}
      />

      {/* Toast de denúncia */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)",
          backgroundColor: NAVY, color: WHITE, padding: "12px 20px", borderRadius: 10,
          fontSize: 14, fontWeight: 500, zIndex: 9999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          maxWidth: 380, textAlign: "center", pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          ✅ {toast}
        </div>
      )}

      {/* Modal de confirmação de bloqueio */}
      {blockConfirm && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.48)",
            zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={() => setBlockConfirm(null)}
        >
          <div
            style={{
              backgroundColor: WHITE, borderRadius: 14, padding: "28px 24px",
              maxWidth: 360, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 10 }}>Bloquear usuário</div>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, margin: "0 0 22px" }}>
              Bloquear <strong style={{ color: NAVY }}>{blockConfirm.authorName}</strong>?{" "}
              Você não verá mais as publicações desta pessoa.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setBlockConfirm(null)}
                style={{
                  padding: "9px 20px", borderRadius: 9,
                  border: `1.5px solid ${BORDER}`, backgroundColor: WHITE,
                  color: NAVY, fontWeight: 600, fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmBlock}
                style={{
                  padding: "9px 20px", borderRadius: 9, border: "none",
                  backgroundColor: "#dc2626", color: WHITE,
                  fontWeight: 700, fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
