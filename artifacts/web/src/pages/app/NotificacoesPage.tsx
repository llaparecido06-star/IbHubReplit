import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Heart, MessageCircle, CornerDownRight, UserPlus, Users,
  AtSign, UserCheck, BarChart2, Bell as BellIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchWebNotifications,
  markWebNotificationRead,
  markAllWebNotificationsRead,
  acceptWebConnectionRequest,
  rejectWebConnectionRequest,
  WebNotification,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const TYPE_META: Record<string, { Icon: React.ElementType; color: string; label: string }> = {
  like:           { Icon: Heart,           color: "#e74c3c", label: "curtiu sua publicação" },
  comment:        { Icon: MessageCircle,   color: "#3498db", label: "comentou na sua publicação" },
  comment_reply:  { Icon: CornerDownRight, color: "#8b5cf6", label: "respondeu seu comentário" },
  comment_like:   { Icon: Heart,           color: "#e74c3c", label: "curtiu seu comentário" },
  follow:         { Icon: UserPlus,        color: "#2ecc71", label: "começou a seguir você" },
  company_follow: { Icon: UserPlus,        color: "#2ecc71", label: "começou a seguir sua empresa" },
  connection:     { Icon: Users,           color: GOLD,      label: "enviou pedido de conexão" },
  mention:        { Icon: AtSign,          color: "#9b59b6", label: "mencionou você" },
  group_request:  { Icon: UserCheck,       color: "#7c3aed", label: "solicitou entrar no seu grupo" },
  group_approved: { Icon: UserCheck,       color: "#16a34a", label: "aprovou sua entrada no grupo" },
  poll_vote:      { Icon: BarChart2,       color: "#0ea5e9", label: "votou na sua enquete" },
};

function buildNotifMessage(notif: WebNotification, fallbackLabel: string): string {
  const wine = notif.wine_name?.trim();
  if (wine) {
    const isCompany = !!notif.target_company_id;
    if (notif.type === "like")
      return isCompany ? `curtiu a avaliação do ${wine}` : `curtiu sua avaliação do ${wine}`;
    if (notif.type === "comment")
      return isCompany ? `comentou a avaliação do ${wine}` : `comentou sua avaliação do ${wine}`;
  }
  return notif.message ?? fallbackLabel;
}

function Avatar({ src, name, size = 46 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: NAVY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

function NotifRow({ notif, onRead, onAccept, onReject }: {
  notif: WebNotification;
  onRead: (id: string) => void;
  onAccept: (notif: WebNotification) => void;
  onReject: (notif: WebNotification) => void;
}) {
  const [, setLocation] = useLocation();
  const meta = TYPE_META[notif.type] ?? { Icon: BellIcon, color: GOLD, label: "nova notificação" };
  const { Icon: NotifIcon, color: iconColor, label: typeLabel } = meta;
  const isPending  = notif.type === "connection" && notif.connection_status === "pending"  && notif.connection_id;
  const isAccepted = notif.type === "connection" && notif.connection_status === "accepted";
  const isRejected = notif.type === "connection" && notif.connection_status === "rejected";
  const actorName  = notif.actor?.full_name ?? "Alguém";

  const handleClick = () => {
    if (!notif.read) onRead(notif.id);
    if (notif.post_id) {
      const commentParam = notif.comment_id ? `?commentId=${notif.comment_id}` : "";
      setLocation(`/app/posts/${notif.post_id}${commentParam}`);
    } else if (notif.type === "connection" && notif.actor?.id) setLocation(`/app/usuario/${notif.actor.id}`);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 20px",
        background: notif.read ? WHITE : GOLD + "0e",
        borderBottom: `1px solid ${BORDER}`,
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = BG)}
      onMouseLeave={e => (e.currentTarget.style.background = notif.read ? WHITE : GOLD + "0e")}
    >
      {/* Avatar + icon badge */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar src={notif.actor?.avatar_url} name={actorName} size={46} />
        <span style={{
          position: "absolute", bottom: -2, right: -2,
          background: iconColor, borderRadius: "50%",
          width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
          border: `1.5px solid ${WHITE}`,
        }}>
          <NotifIcon size={11} color="#fff" strokeWidth={2.5} />
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, color: NAVY, lineHeight: 1.45 }}>
          <strong>{actorName}</strong>{" "}
          {buildNotifMessage(notif, typeLabel)}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>{timeAgo(notif.created_at)}</p>

        {/* Connection actions */}
        {isPending && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onAccept(notif)}
              style={{ padding: "6px 18px", background: GOLD, color: WHITE, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Aceitar
            </button>
            <button
              onClick={() => onReject(notif)}
              style={{ padding: "6px 18px", background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Recusar
            </button>
          </div>
        )}
        {isAccepted && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ Conexão aceita</span>
        )}
        {isRejected && (
          <span style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: MUTED }}>Recusado</span>
        )}
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: GOLD, marginTop: 5, flexShrink: 0 }} />
      )}
    </div>
  );
}

export default function NotificacoesPage() {
  const { user, activeCompany } = useAuth();
  const [notifs, setNotifs] = useState<WebNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const data = await fetchWebNotifications(user.id, activeCompany?.id ?? null);
    setNotifs(data);
    setLoading(false);
  }, [user?.id, activeCompany?.id]);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await markWebNotificationRead(id);
  };

  const handleMarkAll = async () => {
    if (!user?.id) return;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await markAllWebNotificationsRead(user.id, activeCompany?.id ?? null);
  };

  const handleAccept = async (notif: WebNotification) => {
    if (!notif.connection_id) return;
    const ok = await acceptWebConnectionRequest(notif.connection_id);
    if (ok) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, connection_status: "accepted", read: true } : n));
    }
  };

  const handleReject = async (notif: WebNotification) => {
    if (!notif.connection_id) return;
    const ok = await rejectWebConnectionRequest(notif.connection_id);
    if (ok) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, connection_status: "rejected", read: true } : n));
    }
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <AppShell>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 60px" }}>
        {/* Header */}
        <div style={{ padding: "24px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${BORDER}`, background: WHITE, position: "sticky", top: 0, zIndex: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: NAVY }}>
              Notificações
              {unreadCount > 0 && (
                <span style={{ marginLeft: 10, background: GOLD, color: WHITE, borderRadius: 12, fontSize: 12, fontWeight: 700, padding: "2px 8px" }}>
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* List */}
        <div style={{ background: WHITE }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: MUTED }}>Carregando notificações…</div>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: GOLD + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BellIcon size={36} color={GOLD} />
                </div>
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 6px" }}>Tudo tranquilo por aqui</p>
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Suas notificações de curtidas, comentários e conexões aparecerão aqui.</p>
            </div>
          ) : notifs.map(n => (
            <NotifRow key={n.id} notif={n} onRead={handleRead} onAccept={handleAccept} onReject={handleReject} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
