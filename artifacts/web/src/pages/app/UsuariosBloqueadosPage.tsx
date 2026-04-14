import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { fetchBlockedUsers, unblockUser, BlockedUser } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

export default function UsuariosBloqueadosPage() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id) return;
    fetchBlockedUsers(profile.id).then(setBlocked).finally(() => setLoading(false));
  }, [profile?.id]);

  const handleUnblock = async (user: BlockedUser) => {
    if (!profile?.id) return;
    setUnblocking(prev => new Set(prev).add(user.id));
    const ok = await unblockUser(profile.id, user.id);
    if (ok) {
      setBlocked(prev => prev.filter(u => u.id !== user.id));
    }
    setUnblocking(prev => { const s = new Set(prev); s.delete(user.id); return s; });
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>🚫 Usuários Bloqueados</h1>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>
          Usuários bloqueados não podem ver seu perfil, suas publicações, ou entrar em contato com você.
        </p>

        <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "#fafaf8" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
              {blocked.length} usuário{blocked.length !== 1 ? "s" : ""} bloqueado{blocked.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
          ) : blocked.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <p style={{ color: MUTED, fontWeight: 600 }}>Nenhum usuário bloqueado</p>
              <p style={{ color: MUTED, fontSize: 13 }}>Sua lista de bloqueados está vazia.</p>
            </div>
          ) : (
            <div>
              {blocked.map((user, idx) => (
                <div
                  key={user.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                    borderBottom: idx < blocked.length - 1 ? `1px solid ${BORDER}` : "none",
                  }}
                >
                  <div
                    onClick={() => setLocation(`/app/usuario/${user.id}`)}
                    style={{ width: 46, height: 46, borderRadius: "50%", overflow: "hidden", backgroundColor: BORDER, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 20 }}>🍷</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>
                      {user.full_name ?? "Usuário"}
                    </div>
                    {user.username && <div style={{ color: MUTED, fontSize: 12 }}>@{user.username}</div>}
                  </div>
                  <button
                    onClick={() => handleUnblock(user)}
                    disabled={unblocking.has(user.id)}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
                      backgroundColor: "#fff", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13,
                      opacity: unblocking.has(user.id) ? 0.6 : 1,
                    }}
                  >
                    {unblocking.has(user.id) ? "Desbloqueando..." : "Desbloquear"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, padding: 16, backgroundColor: "#fff8e7", borderRadius: 12, border: "1px solid #f0d080" }}>
          <p style={{ fontSize: 13, color: "#7a5c00", margin: 0 }}>
            <strong>ℹ️ Ao desbloquear</strong>, o usuário poderá ver seu perfil e interagir com você novamente. Você pode bloquear qualquer usuário novamente a partir do perfil dele.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
