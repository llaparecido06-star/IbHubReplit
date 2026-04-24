import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  AppReport,
  fetchPendingReports,
  updateReportStatus,
  deletePost,
  banUser,
  shadowbanUser,
} from "@/services/adminApi";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function AdminModeracao() {
  const [reports, setReports] = useState<AppReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchPendingReports();
    setReports(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleReject = async (report: AppReport) => {
    setActionLoading(report.id);
    const ok = await updateReportStatus(report.id, "rejected");
    if (ok) setReports((prev) => prev.filter((r) => r.id !== report.id));
    else alert("Erro ao rejeitar denúncia.");
    setActionLoading(null);
  };

  const handleApprove = async (report: AppReport) => {
    if (!confirm("Remover esta publicação? Esta ação é irreversível.")) return;
    setActionLoading(report.id);
    const statusOk = await updateReportStatus(report.id, "approved");
    if (!statusOk) {
      alert("Erro ao atualizar status da denúncia.");
      setActionLoading(null);
      return;
    }
    if (report.post_id) {
      const deleted = await deletePost(report.post_id);
      if (!deleted) alert("Status atualizado, mas não foi possível remover o post. Verifique permissões.");
    }
    setReports((prev) => prev.filter((r) => r.id !== report.id));
    setActionLoading(null);
  };

  const handleBanUser = async (report: AppReport) => {
    if (!report.reported_user_id) return;
    const name = report.reported_user?.full_name ?? report.reported_user_id.slice(0, 8);
    if (!confirm(`Banir "${name}"? O usuário perderá acesso imediatamente.`)) return;
    setActionLoading(report.id);
    const banned = await banUser(report.reported_user_id, true);
    if (!banned) { alert("Erro ao banir usuário."); setActionLoading(null); return; }
    const statusOk = await updateReportStatus(report.id, "approved");
    if (statusOk) {
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      alert(`${name} foi banido com sucesso.`);
    } else {
      alert(`${name} foi banido, mas o status da denúncia não pôde ser atualizado.`);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    }
    setActionLoading(null);
  };

  const handleShadowbanUser = async (report: AppReport) => {
    if (!report.reported_user_id) return;
    const name = report.reported_user?.full_name ?? report.reported_user_id.slice(0, 8);
    if (!confirm(`Aplicar shadowban em "${name}"? Seus posts ficarão invisíveis para outros usuários.`)) return;
    setActionLoading(report.id);
    const ok = await shadowbanUser(report.reported_user_id, true);
    if (!ok) { alert("Erro ao aplicar shadowban."); setActionLoading(null); return; }
    const statusOk = await updateReportStatus(report.id, "approved");
    if (statusOk) {
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      alert(`Shadowban aplicado em ${name}.`);
    } else {
      alert(`Shadowban aplicado em ${name}, mas o status da denúncia não pôde ser atualizado.`);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    }
    setActionLoading(null);
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Moderação</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Denúncias e conteúdo inapropriado</p>
          </div>
          <button
            onClick={() => void load()}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >↻ Atualizar</button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando denúncias...</p>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e8eaed" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Nenhuma denúncia pendente</div>
            <div style={{ fontSize: 14, color: "#8a93a2" }}>Tudo limpo por aqui!</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: "#8a93a2" }}>
              {reports.length} denúncia{reports.length !== 1 ? "s" : ""} pendente{reports.length !== 1 ? "s" : ""}
            </div>

            {reports.map((report) => {
              const isUserReport = !!report.reported_user_id && !report.post_id;
              const isLoading = actionLoading === report.id;

              return (
                <div
                  key={report.id}
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e8eaed",
                    borderRadius: 16,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    opacity: isLoading ? 0.6 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: isUserReport ? "#fffbeb" : "#fef2f2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 16,
                    }}>
                      {isUserReport ? "👤" : "🚩"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{report.reason}</div>
                      <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>
                        {isUserReport ? "Denúncia de usuário" : "Denúncia de post"} · {timeAgo(report.created_at)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      backgroundColor: "#fef9ee",
                      color: GOLD,
                      padding: "3px 8px",
                      borderRadius: 6,
                      letterSpacing: 0.5,
                    }}>PENDENTE</span>
                  </div>

                  {/* Reported user preview */}
                  {isUserReport && report.reported_user && (
                    <div style={{
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                        Usuário denunciado: {report.reported_user.full_name ?? "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#8a93a2", fontFamily: "monospace" }}>
                        ID: {report.reported_user_id?.slice(0, 8)}…
                      </div>
                    </div>
                  )}

                  {/* Post content preview */}
                  {!isUserReport && report.post && (
                    <div style={{
                      backgroundColor: "#f9fafb",
                      border: "1px solid #e8eaed",
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, marginBottom: 6 }}>
                        {report.post.content ?? "(sem conteúdo de texto)"}
                      </div>
                      <div style={{ fontSize: 11, color: "#8a93a2", fontFamily: "monospace" }}>
                        Post ID: {report.post_id?.slice(0, 8)}…
                      </div>
                    </div>
                  )}

                  {/* Reporter info */}
                  <div style={{ fontSize: 13, color: "#8a93a2" }}>
                    Denunciado por:{" "}
                    <span style={{ fontWeight: 700, color: "#374151" }}>
                      {report.reporter?.full_name ?? report.reported_by.slice(0, 8)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleReject(report)}
                      disabled={isLoading}
                      style={{
                        flex: 1,
                        minWidth: 120,
                        padding: "10px 14px",
                        backgroundColor: "#fff",
                        border: "1.5px solid #e8eaed",
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#6b7280",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      ✕ Ignorar
                    </button>

                    {isUserReport ? (
                      <>
                        <button
                          onClick={() => handleShadowbanUser(report)}
                          disabled={isLoading}
                          style={{
                            flex: 1,
                            minWidth: 120,
                            padding: "10px 14px",
                            backgroundColor: "#d97706",
                            border: "none",
                            borderRadius: 10,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          👁 Shadowban
                        </button>
                        <button
                          onClick={() => handleBanUser(report)}
                          disabled={isLoading}
                          style={{
                            flex: 1,
                            minWidth: 120,
                            padding: "10px 14px",
                            backgroundColor: "#dc2626",
                            border: "none",
                            borderRadius: 10,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          ⊘ Banir usuário
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleApprove(report)}
                        disabled={isLoading}
                        style={{
                          flex: 1,
                          minWidth: 120,
                          padding: "10px 14px",
                          backgroundColor: "#dc2626",
                          border: "none",
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        🗑 Remover post
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
