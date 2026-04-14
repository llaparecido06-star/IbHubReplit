import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { fetchWebConversations, fetchWebMessages, sendWebMessage, WebConversation, WebMessage } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", backgroundColor: "#722f37",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0,
    }}>
      {(name?.[0] ?? "U").toUpperCase()}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function MensagensPage() {
  const { profile, user } = useAuth();
  const userId = profile?.id ?? user?.id ?? "";

  const [conversations, setConversations] = useState<WebConversation[]>([]);
  const [selected, setSelected]           = useState<WebConversation | null>(null);
  const [messages, setMessages]           = useState<WebMessage[]>([]);
  const [newMsg, setNewMsg]               = useState("");
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const [search, setSearch]               = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    fetchWebConversations(userId).then(data => {
      setConversations(data);
      setLoading(false);
    });
  }, [userId]);

  const loadMessages = useCallback(async (convo: WebConversation) => {
    setSelected(convo);
    const msgs = await fetchWebMessages(convo.id);
    setMessages(msgs);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim() || !selected || !userId || sending) return;
    setSending(true);
    const ok = await sendWebMessage(selected.id, userId, newMsg.trim());
    if (ok) {
      setMessages(prev => [...prev, {
        id: `tmp-${Date.now()}`,
        conversation_id: selected.id,
        sender_id: userId,
        content: newMsg.trim(),
        created_at: new Date().toISOString(),
        sender: { id: userId, full_name: profile?.full_name ?? "Eu", avatar_url: profile?.avatar_url },
      }]);
      setNewMsg("");
    }
    setSending(false);
  };

  const filteredConvos = conversations.filter(c => {
    const name = c.name ?? c.participant?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getConvoName = (c: WebConversation) => c.name ?? c.participant?.full_name ?? "Conversa";
  const getConvoAvatar = (c: WebConversation) => c.participant?.avatar_url ?? null;

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginBottom: 16 }}>Mensagens</h1>

        <div style={{ display: "flex", height: "calc(100vh - 180px)", backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
          {/* ── Sidebar: conversation list ── */}
          <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 12px 8px" }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar conversas..."
                style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 20, padding: "8px 14px", fontSize: 13, outline: "none", backgroundColor: BG, fontFamily: "inherit" }}
              />
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 32, color: MUTED, fontSize: 13 }}>Carregando…</div>
              ) : filteredConvos.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                  <p style={{ fontSize: 13, color: MUTED }}>Nenhuma conversa ainda</p>
                  <p style={{ fontSize: 12, color: MUTED }}>Conecte-se com outros profissionais para iniciar uma conversa</p>
                </div>
              ) : (
                filteredConvos.map(convo => (
                  <button
                    key={convo.id}
                    onClick={() => loadMessages(convo)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "12px 14px", border: "none", textAlign: "left",
                      backgroundColor: selected?.id === convo.id ? `${GOLD}12` : "transparent",
                      borderLeft: selected?.id === convo.id ? `3px solid ${GOLD}` : "3px solid transparent",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <Avatar src={getConvoAvatar(convo)} name={getConvoName(convo)} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                          {getConvoName(convo)}
                        </span>
                        {convo.last_message_at && (
                          <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{timeAgo(convo.last_message_at)}</span>
                        )}
                      </div>
                      {convo.last_message && (
                        <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                          {convo.last_message}
                        </div>
                      )}
                    </div>
                    {convo.unread_count > 0 && (
                      <div style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: GOLD, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {convo.unread_count}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Message thread ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: MUTED }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Selecione uma conversa</p>
                <p style={{ fontSize: 13 }}>Escolha à esquerda para visualizar as mensagens</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar src={getConvoAvatar(selected)} name={getConvoName(selected)} size={38} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{getConvoName(selected)}</div>
                    {selected.participant && <div style={{ fontSize: 12, color: MUTED }}>Profissional do vinho</div>}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {messages.length === 0 && (
                    <div style={{ textAlign: "center", color: MUTED, fontSize: 13, marginTop: 24 }}>Nenhuma mensagem ainda. Diga olá! 👋</div>
                  )}
                  {messages.map(msg => {
                    const isMe = msg.sender_id === userId;
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: 8 }}>
                        {!isMe && <Avatar src={msg.sender?.avatar_url} name={msg.sender?.full_name ?? "?"} size={30} />}
                        <div style={{ maxWidth: "72%" }}>
                          {!isMe && (
                            <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>{msg.sender?.full_name}</div>
                          )}
                          <div style={{
                            backgroundColor: isMe ? GOLD : BG,
                            color: isMe ? NAVY : NAVY,
                            borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            padding: "10px 14px", fontSize: 13, lineHeight: 1.55,
                            border: isMe ? "none" : `1px solid ${BORDER}`,
                          }}>
                            {msg.content}
                          </div>
                          <div style={{ fontSize: 10, color: MUTED, marginTop: 3, textAlign: isMe ? "right" : "left" }}>
                            {timeAgo(msg.created_at)}
                          </div>
                        </div>
                        {isMe && <Avatar src={profile?.avatar_url} name={profile?.full_name ?? "Eu"} size={30} />}
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div style={{ padding: "12px 18px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10 }}>
                  <input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Escreva uma mensagem..."
                    style={{
                      flex: 1, border: `1px solid ${BORDER}`, borderRadius: 24, padding: "10px 16px",
                      fontSize: 14, outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMsg.trim() || sending}
                    style={{
                      backgroundColor: newMsg.trim() ? GOLD : `${GOLD}55`,
                      border: "none", borderRadius: 24, padding: "10px 20px",
                      color: NAVY, fontWeight: 800, fontSize: 14, cursor: newMsg.trim() ? "pointer" : "default",
                    }}
                  >
                    Enviar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
