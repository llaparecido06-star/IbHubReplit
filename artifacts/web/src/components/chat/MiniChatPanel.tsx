import React, { useState } from "react";
import { WebConversation } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const RED    = "#e74c3c";

type PanelTab = "dm" | "grupos";

function MiniAvatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [err, setErr] = React.useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      backgroundColor: "#4a5568", color: WHITE,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, flexShrink: 0,
    }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

function convDisplayName(conv: WebConversation): string {
  if (conv.is_group) return conv.name ?? "Grupo";
  if (conv.company_page_id && conv.company_page) return conv.company_page.name;
  return conv.participant?.full_name ?? "Usuário";
}

function convAvatarUrl(conv: WebConversation): string | null | undefined {
  if (conv.is_group) return conv.avatar_url;
  if (conv.company_page_id && conv.company_page) return conv.company_page.avatar_url;
  return conv.participant?.avatar_url;
}

function shortTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  if (diffMin < 1440) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function previewText(msg: string | null): string {
  if (!msg) return "";
  if (msg.startsWith("[attachment]:")) return "📎 Arquivo";
  if (msg.startsWith("http") && msg.includes("audio")) return "🎤 Áudio";
  return msg.slice(0, 38) + (msg.length > 38 ? "…" : "");
}

const MsgIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
    style={{ transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
  >
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

const GroupBadgeIcon = () => (
  <svg width="8" height="8" fill="none" stroke={NAVY} strokeWidth="2.2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

interface MiniChatPanelProps {
  convs: WebConversation[];
  pulseConvId: string | null;
  totalUnread: number;
  onConversationClick: (id: string) => void;
  onViewAll: () => void;
}

export function MiniChatPanel({
  convs, pulseConvId, totalUnread, onConversationClick, onViewAll,
}: MiniChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab,  setTab]  = useState<PanelTab>("dm");

  const dmConvs    = convs.filter(c => !c.is_group);
  const groupConvs = convs.filter(c => c.is_group);
  const dmUnread    = dmConvs.reduce((s, c) => s + (c.unread_count ?? 0), 0);
  const groupUnread = groupConvs.reduce((s, c) => s + (c.unread_count ?? 0), 0);
  const currentList = tab === "dm" ? dmConvs : groupConvs;

  return (
    <>
      <style>{`
        @keyframes minichat-pulse {
          0%  { transform: scale(1);    }
          30% { transform: scale(1.4);  }
          60% { transform: scale(0.88); }
          100%{ transform: scale(1);    }
        }
        .minichat-badge-pulse { animation: minichat-pulse 0.6s ease; }
        .minichat-row         { transition: background 0.12s; }
        .minichat-row:hover   { background: #f5f4f0 !important; }
        .minichat-header:hover { background: #b8943d !important; }
      `}</style>

      {/*
       * Layout: position fixed at bottom-right.
       * DOM order = [header][content].
       * Since bottom:0 pins the element's bottom to the viewport,
       * growing height means the header floats up as the title —
       * exactly what the user sees when they open the panel.
       */}
      <div style={{
        position: "fixed", bottom: 0, right: 24,
        width: 340,
        zIndex: 400,
        fontFamily: "'Inter', -apple-system, sans-serif",
        borderRadius: "14px 14px 0 0",
        overflow: "hidden",
        boxShadow: open ? "0 -4px 24px rgba(0,0,0,0.16)" : "0 -2px 10px rgba(0,0,0,0.12)",
        transition: "box-shadow 0.2s",
      }}>

        {/* ── Header (always visible; acts as title when panel is open) ── */}
        <div
          onClick={() => setOpen(o => !o)}
          className="minichat-header"
          style={{
            backgroundColor: GOLD,
            color: "#1a1a1a",
            padding: "11px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
            userSelect: "none",
            transition: "background 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#1a1a1a", display: "flex", alignItems: "center" }}><MsgIcon /></span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.01em" }}>Mensagens</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {totalUnread > 0 && (
              <span style={{
                backgroundColor: NAVY, color: WHITE,
                borderRadius: 10, minWidth: 18, height: 18,
                fontSize: 10, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: totalUnread > 9 ? "0 4px" : "0", lineHeight: 1,
              }}>
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
            <span style={{ color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center" }}>
              <ChevronIcon open={open} />
            </span>
          </div>
        </div>

        {/* ── Expandable content (slides in below header) ── */}
        <div style={{
          backgroundColor: WHITE,
          maxHeight: open ? 420 : 0,
          overflow: "hidden",
          transition: "max-height 0.26s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
        }}>

          {/* Tab bar */}
          <div style={{
            display: "flex",
            borderBottom: `1px solid ${BORDER}`,
            flexShrink: 0,
          }}>
            {(["dm", "grupos"] as PanelTab[]).map(t => {
              const label    = t === "dm" ? "DM" : "Grupos";
              const unread   = t === "dm" ? dmUnread : groupUnread;
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: "9px 0 8px",
                    border: "none",
                    borderBottom: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
                    background: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? NAVY : MUTED,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 5,
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                >
                  {label}
                  {unread > 0 && (
                    <span style={{
                      backgroundColor: RED, color: WHITE,
                      borderRadius: 8, minWidth: 15, height: 15,
                      fontSize: 9, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 3px", lineHeight: 1,
                    }}>
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 330 }}>
            {currentList.length === 0 ? (
              <div style={{
                padding: "24px 16px", textAlign: "center",
                color: MUTED, fontSize: 12, lineHeight: 1.5,
              }}>
                {tab === "dm"
                  ? "Nenhuma conversa ainda"
                  : "Você não participa de nenhum grupo ainda"}
              </div>
            ) : currentList.map(conv => {
              const hasUnread  = (conv.unread_count ?? 0) > 0;
              const isPulsing  = conv.id === pulseConvId;
              const name       = convDisplayName(conv);
              const avatarSrc  = convAvatarUrl(conv);
              const msgText    = previewText(conv.last_message);
              const badgeCount = conv.unread_count > 9 ? "9+" : String(conv.unread_count);
              const timeStr    = shortTime(conv.last_message_at);

              const preview = conv.is_group && conv.last_message_sender_name && msgText
                ? `${conv.last_message_sender_name.split(" ")[0]}: ${msgText}`
                : msgText;

              return (
                <button
                  key={conv.id}
                  onClick={() => { onConversationClick(conv.id); setOpen(false); }}
                  className="minichat-row"
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "9px 14px",
                    background: hasUnread ? "#fffbf0" : WHITE,
                    border: "none", borderBottom: `1px solid ${BORDER}`,
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                >
                  {/* Avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <MiniAvatar src={avatarSrc} name={name} size={38} />
                    {conv.is_group && (
                      <div style={{
                        position: "absolute", bottom: -1, right: -1,
                        width: 16, height: 16, borderRadius: "50%",
                        backgroundColor: GOLD,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: `1.5px solid ${WHITE}`,
                      }}>
                        <GroupBadgeIcon />
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "baseline", gap: 4,
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: hasUnread ? 700 : 500,
                        color: NAVY, overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", flex: 1, minWidth: 0, lineHeight: 1.3,
                      }}>
                        {name}
                      </span>
                      {timeStr && (
                        <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>
                          {timeStr}
                        </span>
                      )}
                    </div>
                    {preview && (
                      <div style={{
                        fontSize: 11,
                        color: hasUnread ? "#374151" : MUTED,
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", marginTop: 2, lineHeight: 1.3,
                      }}>
                        {preview}
                      </div>
                    )}
                  </div>

                  {/* Unread badge */}
                  {hasUnread && (
                    <span
                      className={isPulsing ? "minichat-badge-pulse" : undefined}
                      style={{
                        backgroundColor: RED, color: WHITE,
                        borderRadius: 10, minWidth: 18, height: 18,
                        fontSize: 10, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: conv.unread_count > 9 ? "0 4px" : "0",
                        flexShrink: 0, lineHeight: 1,
                      }}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: "9px 14px", textAlign: "center",
            borderTop: `1px solid ${BORDER}`, flexShrink: 0,
          }}>
            <button
              onClick={() => { onViewAll(); setOpen(false); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: GOLD, fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              }}
            >
              Ver todas →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
