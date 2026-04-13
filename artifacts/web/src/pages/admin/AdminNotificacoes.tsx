import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  fetchNotificationLogs,
  sendBroadcastNotification,
  NotificationLog,
} from "@/services/adminApi";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

const SEGMENTS = [
  { key: "all", label: "Todos os usuários" },
  { key: "profissional", label: "Plano Profissional" },
  { key: "empresarial", label: "Plano Empresarial" },
  { key: "premium", label: "Plano Premium" },
  { key: "basico", label: "Plano Básico" },
];

export default function AdminNotificacoes() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<"all" | "profissional" | "empresarial" | "premium" | "basico">("all");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchNotificationLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSend = async () => {
    if (!title.trim()) { alert("Informe o título da notificação."); return; }
    if (!body.trim()) { alert("Informe o corpo da notificação."); return; }
    if (!confirm(`Enviar notificação para: ${SEGMENTS.find((s) => s.key === segment)?.label}?`)) return;

    setSending(true);
    setSendResult(null);
    const result = await sendBroadcastNotification({ title: title.trim(), body: body.trim(), segment });
    setSending(false);
    setSendResult(result);
    if (result.success) {
      setTitle("");
      setBody("");
      load();
    }
  };

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Notificações Broadcast</h1>
        <p style={{ fontSize: 14, color: "#8a93a2", margin: "0 0 24px" }}>Envie notificações em massa para segmentos de usuários</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Compose */}
          <div>
            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 20px" }}>📢 Nova Notificação</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Segmento de destinatários</label>
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value as "all" | "profissional" | "empresarial" | "premium" | "basico")}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none" }}
                  >
                    {SEGMENTS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Título *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Novidade no ibhub!"
                    maxLength={80}
                    style={inputSt}
                  />
                  <div style={{ fontSize: 11, color: "#aaa", textAlign: "right", marginTop: 3 }}>{title.length}/80</div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Mensagem *</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Escreva aqui a mensagem da notificação..."
                    maxLength={240}
                    rows={4}
                    style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }}
                  />
                  <div style={{ fontSize: 11, color: "#aaa", textAlign: "right", marginTop: 3 }}>{body.length}/240</div>
                </div>

                {sendResult && (
                  <div style={{
                    padding: 14,
                    backgroundColor: sendResult.success ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${sendResult.success ? "#86efac" : "#fca5a5"}`,
                    borderRadius: 10,
                    fontSize: 13,
                    color: sendResult.success ? "#16a34a" : "#dc2626",
                    fontWeight: 600,
                  }}>
                    {sendResult.success ? "✅" : "⚠️"} {sendResult.message ?? (sendResult.success ? "Notificação enviada com sucesso!" : "Erro ao enviar.")}
                  </div>
                )}

                <button
                  onClick={handleSend}
                  disabled={sending || !title.trim() || !body.trim()}
                  style={{
                    padding: "13px 0",
                    backgroundColor: sending || !title.trim() || !body.trim() ? "#e8eaed" : GOLD,
                    color: sending || !title.trim() || !body.trim() ? "#aaa" : "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >{sending ? "Enviando..." : "📤 Enviar Notificação"}</button>
              </div>
            </div>

            {/* Preview */}
            {(title || body) && (
              <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#8a93a2", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: 0.5 }}>Preview</h4>
                <div style={{ backgroundColor: "#1a0a1e", borderRadius: 12, padding: 16 }}>
                  <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, marginBottom: 4 }}>
                      {title || "Título da notificação"}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>
                      {body || "Corpo da notificação..."}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Logs */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>Histórico de Envios</h3>
              <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: GOLD, fontWeight: 600 }}>↻ Atualizar</button>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>⏳ Carregando...</div>
            ) : logs.length === 0 ? (
              <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                <p style={{ color: "#8a93a2", margin: 0, fontSize: 14 }}>Nenhuma notificação enviada ainda.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: 16 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{log.title}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>
                        {new Date(log.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#555", margin: "0 0 8px", lineHeight: 1.4 }}>{log.body}</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 11, backgroundColor: "#f2f3f5", color: "#555", padding: "2px 8px", borderRadius: 6 }}>
                        {SEGMENTS.find((s) => s.key === log.segment)?.label ?? log.segment}
                      </span>
                      {log.sent_count != null && (
                        <span style={{ fontSize: 11, backgroundColor: `${GOLD}18`, color: GOLD, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                          {log.sent_count} enviado{log.sent_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

const inputSt: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #e8eaed",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  backgroundColor: "#fff",
  boxSizing: "border-box",
};
