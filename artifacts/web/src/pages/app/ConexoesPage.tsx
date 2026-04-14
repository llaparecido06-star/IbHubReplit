import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { fetchConnectionsList, fetchFollowersList, fetchFollowingList, ProfilePerson } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BG = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

type Tab = "conexoes" | "seguidores" | "seguindo";

export default function ConexoesPage() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("conexoes");
  const [list, setList] = useState<ProfilePerson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    setLoading(true);
    const fns: Record<Tab, (id: string) => Promise<ProfilePerson[]>> = {
      conexoes: fetchConnectionsList,
      seguidores: fetchFollowersList,
      seguindo: fetchFollowingList,
    };
    fns[tab](profile.id).then(setList).finally(() => setLoading(false));
  }, [profile?.id, tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "conexoes", label: "Conexões" },
    { key: "seguidores", label: "Seguidores" },
    { key: "seguindo", label: "Seguindo" },
  ];

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 20 }}>Rede de Conexões</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 18px", borderRadius: 20, border: `1.5px solid ${tab === t.key ? GOLD : BORDER}`,
                backgroundColor: tab === t.key ? GOLD : "#fff", color: tab === t.key ? "#fff" : NAVY,
                fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ color: MUTED, fontWeight: 600 }}>Nenhum resultado</p>
            <p style={{ color: MUTED, fontSize: 13 }}>
              {tab === "conexoes" ? "Você ainda não tem conexões aceitas." : tab === "seguidores" ? "Ninguém te segue ainda." : "Você não segue ninguém ainda."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map(person => (
              <div
                key={person.id}
                onClick={() => setLocation(`/app/usuario/${person.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: 16,
                  backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`,
                  cursor: "pointer", transition: "box-shadow 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", overflow: "hidden",
                  backgroundColor: BORDER, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {person.avatar_url
                    ? <img src={person.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 22 }}>🍷</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{person.full_name}</div>
                  {person.username && <div style={{ color: MUTED, fontSize: 12 }}>@{person.username}</div>}
                  {person.headline && <div style={{ color: MUTED, fontSize: 13, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.headline}</div>}
                </div>
                <div style={{ color: GOLD, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>Ver perfil →</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
