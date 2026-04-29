import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { fetchMyReports, type MyReport } from "@/services/api";

const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Em análise",  color: "#d97706", bg: "#fffbeb" },
  approved: { label: "Aprovada",    color: "#059669", bg: "#f0fdf4" },
  rejected: { label: "Descartada",  color: "#6b7280", bg: "#f9fafb" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MeusReportsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const data = await fetchMyReports(user.id);
    setReports(data);
  }, [user?.id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 2px" }}>
          <button
            type="button"
            onClick={() => setLocation("/app/configuracoes/privacidade")}
            aria-label="Voltar"
            style={{ background: "none", border: "none", cursor: "pointer", color: NAVY, fontSize: 22, padding: 4 }}
          >‹</button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: 0 }}>Minhas Denúncias</h1>
        </div>

        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, padding: "0 4px 4px" }}>
          Histórico das denúncias que você enviou. Nossa equipe analisa cada uma delas.
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: MUTED }}>Carregando…</div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }} aria-hidden>🚩</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: MUTED, marginBottom: 4 }}>
              Você ainda não fez nenhuma denúncia.
            </div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, maxWidth: 320, margin: "0 auto" }}>
              Use o menu "⋯" em posts ou perfis para denunciar conteúdo inadequado.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reports.map((r) => {
              const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
              return (
                <div
                  key={r.id}
                  style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 15, backgroundColor: "#fef2f2",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      color: "#dc2626", fontSize: 14,
                    }} aria-hidden>🚩</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.reason}
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>
                        {r.post_id ? "Post" : "Usuário"} · {timeAgo(r.created_at)}
                      </div>
                    </div>
                    <span style={{
                      borderRadius: 8, padding: "3px 8px", backgroundColor: st.bg,
                      color: st.color, fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
