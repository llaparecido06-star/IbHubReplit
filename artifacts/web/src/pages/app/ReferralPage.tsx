import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { ensureReferralCode, fetchMyReferralCount, fetchReferralLeaderboard, ReferralRankEntry } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

export default function ReferralPage() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const [referralCode, setReferralCode] = useState<string>("");
  const [myCount, setMyCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<ReferralRankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    Promise.all([
      ensureReferralCode(profile.id),
      fetchMyReferralCount(profile.id),
      fetchReferralLeaderboard(20),
    ]).then(([code, count, board]) => {
      setReferralCode(code);
      setMyCount(count);
      setLeaderboard(board);
    }).finally(() => setLoading(false));
  }, [profile?.id]);

  const inviteLink = `${window.location.origin}${import.meta.env.BASE_URL}cadastro?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const myRank = leaderboard.findIndex(e => e.id === profile?.id) + 1;

  return (
    <AppShell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>🎁 Programa de Indicação</h1>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>
          Convide amigos e colegas para o ibhub e acompanhe seu ranking de indicações.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
        ) : (
          <>
            <div style={{ backgroundColor: NAVY, borderRadius: 16, padding: 28, marginBottom: 24, color: "#fff" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: `${GOLD}cc`, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                Seu código de convite
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{
                  fontFamily: "monospace", fontSize: 32, fontWeight: 800, letterSpacing: 4,
                  color: GOLD, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10,
                  padding: "12px 24px", flex: 1, textAlign: "center", minWidth: 140,
                }}>
                  {referralCode}
                </div>
                <button
                  onClick={copyCode}
                  style={{ padding: "14px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}
                >
                  {copied ? "✓ Copiado!" : "Copiar código"}
                </button>
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                  {inviteLink}
                </div>
                <button
                  onClick={copyLink}
                  style={{ padding: "8px 16px", backgroundColor: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}
                >
                  Copiar link
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
              <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: GOLD }}>{myCount}</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Pessoas indicadas</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: NAVY }}>{myRank > 0 ? `#${myRank}` : "—"}</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Seu ranking</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "#fafaf8" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>🏆 Ranking de Indicações</span>
              </div>

              {leaderboard.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🎁</div>
                  <p style={{ color: MUTED, fontWeight: 600 }}>Seja o primeiro a indicar!</p>
                  <p style={{ color: MUTED, fontSize: 13 }}>Compartilhe seu código e apareça no ranking.</p>
                </div>
              ) : (
                <div>
                  {leaderboard.map((entry, idx) => {
                    const isMe = entry.id === profile?.id;
                    const rankEmoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
                    return (
                      <div
                        key={entry.id}
                        onClick={() => setLocation(`/app/usuario/${entry.id}`)}
                        style={{
                          display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
                          borderBottom: idx < leaderboard.length - 1 ? `1px solid ${BORDER}` : "none",
                          backgroundColor: isMe ? `${GOLD}12` : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ width: 32, textAlign: "center", fontSize: idx < 3 ? 20 : 14, fontWeight: 800, color: MUTED, flexShrink: 0 }}>
                          {rankEmoji}
                        </div>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", backgroundColor: BORDER, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {entry.avatar_url
                            ? <img src={entry.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 18 }}>🍷</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? GOLD : NAVY }}>
                            {entry.full_name} {isMe && "(você)"}
                          </div>
                          {entry.username && <div style={{ fontSize: 12, color: MUTED }}>@{entry.username}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{entry.invite_count}</div>
                          <div style={{ fontSize: 11, color: MUTED }}>indicações</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, padding: 16, backgroundColor: "#fff8e7", borderRadius: 12, border: "1px solid #f0d080" }}>
              <p style={{ fontSize: 13, color: "#7a5c00", margin: 0 }}>
                <strong>🎯 Como funciona:</strong> Compartilhe seu código ou link único. Quando um novo usuário se cadastrar usando seu código, você recebe crédito no ranking. Futuramente, recompensas exclusivas serão dadas aos melhores indicadores!
              </p>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
