import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  sendBroadcastPush,
  fetchNotificationLogs,
  NotificationLog,
} from "@/services/adminApi";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

interface PlanOption { id: string; name: string; }

interface ReferralEntry {
  id: string;
  full_name: string | null;
  referral_code: string | null;
  invite_count: number;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminComunicacao() {
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [segmento, setSegmento] = useState("all");
  const [deepLink, setDeepLink] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [tracking, setTracking] = useState<ReferralEntry[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(true);

  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);

  const segments = [
    { id: "all", label: "Todos os usuários" },
    ...planOptions.map((p) => ({ id: p.id, label: p.name })),
  ];

  const canSend = titulo.trim().length > 0 && mensagem.trim().length > 0;

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const data = await fetchNotificationLogs();
    setLogs(data);
    setLoadingLogs(false);
  };

  const fetchTracking = async () => {
    setLoadingTracking(true);
    try {
      const { data: inviters } = await supabase
        .from("profiles")
        .select("id, full_name, referral_code")
        .not("referral_code", "is", null);

      if (!inviters || inviters.length === 0) {
        setTracking([]);
        setLoadingTracking(false);
        return;
      }

      const { data: invited } = await supabase
        .from("profiles")
        .select("invited_by_id")
        .not("invited_by_id", "is", null);

      const countMap: Record<string, number> = {};
      for (const row of (invited ?? []) as Array<{ invited_by_id: string }>) {
        countMap[row.invited_by_id] = (countMap[row.invited_by_id] ?? 0) + 1;
      }

      const entries: ReferralEntry[] = (inviters as Array<{ id: string; full_name: string | null; referral_code: string | null }>).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        referral_code: p.referral_code,
        invite_count: countMap[p.id] ?? 0,
      })).sort((a, b) => b.invite_count - a.invite_count);

      setTracking(entries);
    } catch {
      setTracking([]);
    } finally {
      setLoadingTracking(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
    void fetchTracking();
    supabase.from("plans").select("id, name").eq("is_active", true).order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setPlanOptions(data as PlanOption[]); });
  }, []);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSendMsg(null);
    const result = await sendBroadcastPush({
      title: titulo,
      body: mensagem,
      segment: segmento as "all",
      deepLink: deepLink.trim() || undefined,
    });
    setSending(false);
    setSendMsg({ type: result.success ? "success" : "error", text: result.message ?? (result.success ? "Enviado!" : "Erro ao enviar.") });
    if (result.success) {
      setTitulo("");
      setMensagem("");
      setDeepLink("");
      void fetchLogs();
    }
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Comunicação</h1>
        <p style={{ fontSize: 14, color: "#8a93a2", margin: "0 0 28px" }}>Envie push notifications e acompanhe indicações</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 16 }}>📢 Enviar Push Notification</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Título *</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Nova atualização disponível"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Mensagem *</label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Ex: Confira as novidades do ibhub..."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Segmento</label>
              <select
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none", cursor: "pointer" }}
              >
                {segments.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Deep Link (opcional)</label>
              <input
                value={deepLink}
                onChange={(e) => setDeepLink(e.target.value)}
                placeholder="Ex: ibhub://eventos"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {sendMsg && (
              <div style={{ marginBottom: 12, padding: "10px 14px", backgroundColor: sendMsg.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${sendMsg.type === "success" ? "#86efac" : "#fca5a5"}`, borderRadius: 8, fontSize: 13, color: sendMsg.type === "success" ? "#16a34a" : "#dc2626" }}>
                {sendMsg.text}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              style={{ width: "100%", padding: "11px", backgroundColor: canSend && !sending ? GOLD : "#e8eaed", color: canSend && !sending ? "#fff" : "#aaa", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: canSend && !sending ? "pointer" : "not-allowed" }}
            >{sending ? "Enviando..." : "📤 Enviar Notificação"}</button>
          </div>

          <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>📋 Histórico de Envios</div>
              <button onClick={() => fetchLogs()} style={{ fontSize: 12, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>↻</button>
            </div>
            {loadingLogs ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>Carregando...</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>Nenhum envio registrado.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
                {logs.map((log) => (
                  <div key={log.id} style={{ padding: "12px 14px", backgroundColor: "#fafbfc", border: "1px solid #e8eaed", borderRadius: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 2 }}>{log.title}</div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>{log.body}</div>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#aaa" }}>
                      <span>📍 {log.segment}</span>
                      {log.sent_count != null && <span>👥 {log.sent_count}</span>}
                      <span>🕐 {formatDate(log.sent_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>🎁 Rastreamento de Indicações</div>
            <button onClick={() => fetchTracking()} style={{ fontSize: 12, color: GOLD, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>↻</button>
          </div>
          {loadingTracking ? (
            <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>Carregando...</div>
          ) : tracking.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>Nenhum convite registrado ainda.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e8eaed" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", color: "#8a93a2", fontWeight: 600 }}>Usuário</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", color: "#8a93a2", fontWeight: 600 }}>Código de Convite</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", color: "#8a93a2", fontWeight: 600 }}>Indicações</th>
                  </tr>
                </thead>
                <tbody>
                  {tracking.map((entry, i) => (
                    <tr key={entry.id} style={{ borderBottom: i < tracking.length - 1 ? "1px solid #e8eaed" : "none" }}>
                      <td style={{ padding: "10px 14px", color: NAVY, fontWeight: 600 }}>{entry.full_name ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, backgroundColor: "#f3f4f6", padding: "3px 8px", borderRadius: 5 }}>{entry.referral_code ?? "—"}</span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <span style={{ fontWeight: 800, color: entry.invite_count > 0 ? "#059669" : "#aaa" }}>{entry.invite_count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
