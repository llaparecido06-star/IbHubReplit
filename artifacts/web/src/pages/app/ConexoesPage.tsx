import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchConnectionsList,
  fetchFollowersList,
  fetchFollowingList,
  fetchPendingConnectionsReceived,
  fetchPendingConnectionsSent,
  fetchConnectedUsersWeb,
  respondToConnectionWeb,
  ConnectionProfile,
  ProfilePerson,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

type Tab = "pendentes" | "conexoes" | "seguidores" | "seguindo";

function PersonCard({ person, onClick, actions }: { person: ProfilePerson | ConnectionProfile; onClick?: () => void; actions?: React.ReactNode }) {
  const p = person as any;
  const name = p.full_name ?? p.username ?? "Usuário";
  const sub = (p.headline ?? [p.position, p.company].filter(Boolean).join(" · ")) || null;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: 16,
        backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", backgroundColor: BORDER, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {p.avatar_url
          ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 22 }}>🍷</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{name}</div>
        {p.username && <div style={{ color: MUTED, fontSize: 12 }}>@{p.username}</div>}
        {sub && <div style={{ color: MUTED, fontSize: 13, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
      {actions}
    </div>
  );
}

export default function ConexoesPage() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("pendentes");

  const [received, setReceived] = useState<ConnectionProfile[]>([]);
  const [sent, setSent]         = useState<ConnectionProfile[]>([]);
  const [connected, setConnected] = useState<ConnectionProfile[]>([]);
  const [followers, setFollowers] = useState<ProfilePerson[]>([]);
  const [following, setFollowing] = useState<ProfilePerson[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [rec, snt, conn] = await Promise.all([
      fetchPendingConnectionsReceived(profile.id),
      fetchPendingConnectionsSent(profile.id),
      fetchConnectedUsersWeb(profile.id),
    ]);
    setReceived(rec);
    setSent(snt);
    setConnected(conn);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id || tab === "pendentes" || tab === "conexoes") return;
    setLoading(true);
    if (tab === "seguidores") {
      fetchFollowersList(profile.id).then(setFollowers).finally(() => setLoading(false));
    } else {
      fetchFollowingList(profile.id).then(setFollowing).finally(() => setLoading(false));
    }
  }, [profile?.id, tab]);

  useEffect(() => {
    if (!profile?.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`web-conns-${profile.id}_${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `requester_id=eq.${profile.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `receiver_id=eq.${profile.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load]);

  const handleAccept = async (connectionId: string, personId: string) => {
    const ok = await respondToConnectionWeb(connectionId, "accepted");
    if (ok) {
      const accepted = received.find(r => r.connectionId === connectionId);
      setReceived(prev => prev.filter(r => r.connectionId !== connectionId));
      if (accepted) setConnected(prev => [accepted, ...prev]);
    }
  };

  const handleReject = async (connectionId: string) => {
    const ok = await respondToConnectionWeb(connectionId, "rejected");
    if (ok) setReceived(prev => prev.filter(r => r.connectionId !== connectionId));
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "pendentes",  label: "Pendentes",  count: received.length },
    { key: "conexoes",   label: "Conectados", count: connected.length },
    { key: "seguidores", label: "Seguidores" },
    { key: "seguindo",   label: "Seguindo" },
  ];

  const emptyMsg: Record<Tab, string> = {
    pendentes:  "Nenhuma solicitação pendente",
    conexoes:   "Você ainda não tem conexões aceitas.",
    seguidores: "Ninguém te segue ainda.",
    seguindo:   "Você não segue ninguém ainda.",
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 20 }}>Rede de Conexões</h1>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 18px", borderRadius: 20, border: `1.5px solid ${tab === t.key ? GOLD : BORDER}`,
                backgroundColor: tab === t.key ? GOLD : "#fff", color: tab === t.key ? "#fff" : NAVY,
                fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{ backgroundColor: tab === t.key ? "rgba(255,255,255,0.3)" : GOLD, color: tab === t.key ? "#fff" : "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* ── Pendentes ── */}
            {tab === "pendentes" && (
              <>
                {received.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 4 }}>Recebidas</div>
                    {received.map(person => (
                      <PersonCard
                        key={person.connectionId}
                        person={person}
                        onClick={() => setLocation(`/app/usuario/${person.id}`)}
                        actions={
                          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAccept(person.connectionId, person.id); }}
                              style={{ padding: "7px 16px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                            >
                              Aceitar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReject(person.connectionId); }}
                              style={{ padding: "7px 16px", backgroundColor: "#fff", color: MUTED, border: `1.5px solid ${BORDER}`, borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                            >
                              Recusar
                            </button>
                          </div>
                        }
                      />
                    ))}
                  </>
                )}
                {sent.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: 0.8, textTransform: "uppercase", marginTop: received.length > 0 ? 12 : 4 }}>Enviadas</div>
                    {sent.map(person => (
                      <PersonCard
                        key={person.connectionId}
                        person={person}
                        onClick={() => setLocation(`/app/usuario/${person.id}`)}
                        actions={
                          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>⏳ Aguardando</span>
                        }
                      />
                    ))}
                  </>
                )}
                {received.length === 0 && sent.length === 0 && (
                  <div style={{ textAlign: "center", padding: 48, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
                    <p style={{ color: MUTED, fontWeight: 600 }}>{emptyMsg.pendentes}</p>
                  </div>
                )}
              </>
            )}

            {/* ── Conectados ── */}
            {tab === "conexoes" && (
              connected.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                  <p style={{ color: MUTED, fontWeight: 600 }}>{emptyMsg.conexoes}</p>
                </div>
              ) : (
                connected.map(person => (
                  <PersonCard key={person.connectionId} person={person} onClick={() => setLocation(`/app/usuario/${person.id}`)}
                    actions={<div style={{ color: GOLD, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>Ver perfil →</div>}
                  />
                ))
              )
            )}

            {/* ── Seguidores ── */}
            {tab === "seguidores" && (
              followers.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                  <p style={{ color: MUTED, fontWeight: 600 }}>{emptyMsg.seguidores}</p>
                </div>
              ) : (
                followers.map(person => (
                  <PersonCard key={person.id} person={person} onClick={() => setLocation(`/app/usuario/${person.id}`)}
                    actions={<div style={{ color: GOLD, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>Ver perfil →</div>}
                  />
                ))
              )
            )}

            {/* ── Seguindo ── */}
            {tab === "seguindo" && (
              following.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                  <p style={{ color: MUTED, fontWeight: 600 }}>{emptyMsg.seguindo}</p>
                </div>
              ) : (
                following.map(person => (
                  <PersonCard key={person.id} person={person} onClick={() => setLocation(`/app/usuario/${person.id}`)}
                    actions={<div style={{ color: GOLD, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>Ver perfil →</div>}
                  />
                ))
              )
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
