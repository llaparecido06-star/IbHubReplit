import { useRef, useState } from "react";
import { useLocation } from "wouter";
import type { Post, ReactionType } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const WHITE = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

export const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: "saude",    emoji: "🍷", label: "Saúde!",   color: "#7C3AED" },
  { type: "bravo",    emoji: "👏", label: "Bravo!",   color: "#F59E0B" },
  { type: "destaque", emoji: "⭐", label: "Destaque!", color: "#EAB308" },
  { type: "incrivel", emoji: "🔥", label: "Incrível!", color: "#EF4444" },
];

const REACTION_LEGACY: Record<string, { emoji: string; label: string; color: string }> = {
  curtir: { emoji: "❤️", label: "Curtir", color: "#1a56db" },
};

export function reactionLabel(r?: ReactionType | null): string {
  if (!r) return "Curtir";
  return REACTIONS.find(x => x.type === r)?.label ?? REACTION_LEGACY[r as string]?.label ?? "Curtir";
}
export function reactionEmoji(r?: ReactionType | null): string {
  if (!r) return "";
  return REACTIONS.find(x => x.type === r)?.emoji ?? REACTION_LEGACY[r as string]?.emoji ?? "👍";
}
export function reactionColor(r?: ReactionType | null): string {
  if (!r) return MUTED;
  return REACTIONS.find(x => x.type === r)?.color ?? REACTION_LEGACY[r as string]?.color ?? MUTED;
}

export function buildPostShareUrl(postId: string): string {
  return `https://www.ibhub.com.br/post/${postId}`;
}

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

export interface PostActionsBarProps {
  post: Pick<Post, "id" | "is_liked" | "reaction_type" | "is_bookmarked">;
  onReact: (reaction: ReactionType) => void;
  onComment: () => void;
  onBookmark: () => void;
}

export function PostActionsBar({ post, onReact, onComment, onBookmark }: PostActionsBarProps) {
  const [, setLocation] = useLocation();
  const [showPicker, setShowPicker] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const pickerOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPicker = () => {
    if (pickerHideTimer.current) clearTimeout(pickerHideTimer.current);
    pickerOpenTimer.current = setTimeout(() => setShowPicker(true), 400);
  };
  const hidePicker = () => {
    if (pickerOpenTimer.current) clearTimeout(pickerOpenTimer.current);
    pickerHideTimer.current = setTimeout(() => setShowPicker(false), 250);
  };
  const keepPicker = () => {
    if (pickerHideTimer.current) clearTimeout(pickerHideTimer.current);
  };

  const handleReact = (r: ReactionType) => {
    if (pickerHideTimer.current) clearTimeout(pickerHideTimer.current);
    setShowPicker(false);
    onReact(r);
  };

  const handleShareClick = async () => {
    const shareUrl = buildPostShareUrl(post.id);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ url: shareUrl, title: "ibhub" });
        return;
      } catch {
        // user cancelled / unsupported → fall through to popover
      }
    }
    setShowShare(v => !v);
  };

  return (
    <div style={{ display: "flex", borderTop: `1px solid ${BORDER}`, overflow: "visible", position: "relative" }}>

      <div style={{ position: "relative", flex: 1 }} onMouseLeave={hidePicker}>
        {showPicker && (
          <div
            onMouseEnter={keepPicker}
            onMouseLeave={hidePicker}
            style={{
              position: "absolute", bottom: "100%", left: 0,
              background: WHITE, border: `1px solid ${BORDER}`,
              borderRadius: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
              display: "flex", gap: 2, padding: "8px 10px 10px", zIndex: 300,
              whiteSpace: "nowrap",
            }}>
            {REACTIONS.map(r => (
              <button
                key={r.type}
                onClick={() => handleReact(r.type)}
                title={r.label}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 24, lineHeight: 1, padding: "2px 6px",
                  borderRadius: 8, transition: "transform 0.12s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.4)"; }}
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
          onMouseLeave={hidePicker}
          onClick={() => onReact(post.reaction_type ?? "saude")}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            background: "none", border: "none", cursor: "pointer", padding: "10px 8px",
            fontSize: 13, fontWeight: 600, color: post.is_liked ? reactionColor(post.reaction_type) : MUTED,
          }}
        >
          {post.is_liked ? (
            <span style={{ fontSize: 15 }}>{reactionEmoji(post.reaction_type)}</span>
          ) : (
            <LikeIcon filled={false} />
          )}
          <span>{reactionLabel(post.reaction_type ?? (post.is_liked ? "curtir" : null))}</span>
        </button>
      </div>

      <button
        onClick={onComment}
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "10px 8px", fontSize: 13, fontWeight: 600, color: MUTED }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
      >
        <CommentIcon /><span>Comentar</span>
      </button>

      <div ref={shareRef} style={{ flex: 1, position: "relative" }}>
        <button
          onClick={handleShareClick}
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
            {(() => {
              const shareUrl = buildPostShareUrl(post.id);
              return [
                { label: "Copiar link", icon: "🔗", action: () => { navigator.clipboard.writeText(shareUrl); setShowShare(false); } },
                { label: "WhatsApp", icon: "💬", action: () => { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareUrl)}`); setShowShare(false); } },
                { label: "Instagram DM", icon: "📸", action: () => { window.open("https://instagram.com/direct/inbox/"); setShowShare(false); } },
                { label: "Enviar no chat", icon: "✉️", action: () => { setLocation(`/app/mensagens?share=${post.id}`); setShowShare(false); } },
              ];
            })().map(item => (
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

      <button
        onClick={onBookmark}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: "10px 12px", color: post.is_bookmarked ? GOLD : MUTED }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
      >
        <BookmarkIcon filled={!!post.is_bookmarked} />
      </button>
    </div>
  );
}
