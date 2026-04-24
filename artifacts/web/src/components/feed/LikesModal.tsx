import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Heart, X, Briefcase } from "lucide-react";
import { fetchPostLikes, type LikeUser } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BORDER = "#e5e7eb";
const MUTED = "#6b7280";
const BG = "#f2f3f5";

const REACTION_EMOJI: Record<string, string> = {
  saude: "🍷",
  bravo: "👏",
  destaque: "⭐",
  incrivel: "🔥",
  curtir: "❤️",
};

function reactionEmoji(type: string | null | undefined) {
  if (!type) return "❤️";
  return REACTION_EMOJI[type] ?? "❤️";
}

function WebAvatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const initials = name ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?";
  return src ? (
    <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#722f37", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

interface Props {
  postId: string | null;
  likesCount: number;
  visible: boolean;
  onClose: () => void;
}

export function LikesModal({ postId, likesCount, visible, onClose }: Props) {
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !postId) return;
    setLoading(true);
    fetchPostLikes(postId).then(data => {
      setUsers(data);
      setLoading(false);
    });
  }, [visible, postId]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const handleUserClick = (user: LikeUser) => {
    onClose();
    if (user.company_page_id) {
      setLocation(`/app/empresa/${user.company_page_id}`);
    } else {
      setLocation(`/app/usuario/${user.id}`);
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440,
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        margin: "0 16px",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Heart size={18} color="#e74c3c" fill="#e74c3c" />
            <span style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>
              {likesCount} {likesCount === 1 ? "curtida" : "curtidas"}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: MUTED }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 48 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                border: `3px solid ${BG}`, borderTopColor: GOLD,
                animation: "spin 0.7s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : users.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, gap: 10, color: MUTED }}>
              <Heart size={32} color={BORDER} />
              <span style={{ fontSize: 14 }}>Nenhuma curtida ainda</span>
            </div>
          ) : (
            users.map((user, idx) => (
              <button
                key={`${user.id}_${user.company_page_id ?? "personal"}_${idx}`}
                onClick={() => handleUserClick(user)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "12px 20px",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = BG)}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                {/* Avatar with company badge */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <WebAvatar src={user.avatar_url} name={user.full_name} size={44} />
                  {user.company_page_id && (
                    <div style={{
                      position: "absolute", bottom: -2, right: -2,
                      width: 18, height: 18, borderRadius: "50%",
                      background: GOLD, border: "2px solid #fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Briefcase size={9} color="#fff" />
                    </div>
                  )}
                </div>

                {/* Name + headline */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.full_name}
                    </span>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>
                      {reactionEmoji(user.reaction_type)}
                    </span>
                  </div>
                  {user.headline && (
                    <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.headline}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
