import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import {
  fetchWebMessages,
  sendWebMessage,
  sendWebAudioMessage,
  fetchWebGroupInfo,
  fetchGroupByIdPublic,
  joinGroup,
  requestGroupJoinWeb,
  WebMessage,
  WebGroupInfo,
  Group,
} from "@/services/api";
import { AudioRecorder } from "@/components/chat/AudioRecorder";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: NAVY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(10, size * 0.4), fontWeight: 700, flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

function BackIcon() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>;
}
function SendIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
}
function UsersIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function LinkIcon() {
  return <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
function CheckIcon() {
  return <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>;
}

export default function GrupoChatPage() {
  const [, params] = useRoute("/app/grupos/:id");
  const [, setLocation] = useLocation();
  const groupId = params?.id ?? "";
  const { user, activeCompany } = useAuth();

  const [groupInfo, setGroupInfo]     = useState<WebGroupInfo | null>(null);
  const [publicGroup, setPublicGroup] = useState<Group | null>(null);
  const [joinState, setJoinState]     = useState<"idle" | "loading" | "done" | "pending">("idle");
  const [isPending, setIsPending]     = useState(false);
  const [messages, setMessages]       = useState<WebMessage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [linkCopied, setLinkCopied]   = useState(false);

  const groupLink = `https://ibhub.com.br/grupo/${groupId}`;
  const handleCopyLink = () => {
    navigator.clipboard.writeText(groupLink).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2200);
  };

  const listRef    = useRef<HTMLDivElement>(null);
  const seenIds    = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollBottom = useCallback(() => {
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 80);
  }, []);

  const load = useCallback(async () => {
    if (!groupId || !user?.id) { setLoading(false); return; }

    // Check for pending membership first — pending users must not access the chat.
    const { data: memberRow } = await supabase
      .from("group_members")
      .select("role, company_page_id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if ((memberRow as any)?.role === "pending") {
      const { data: gr } = await supabase
        .from("groups")
        .select("name, avatar_url")
        .eq("id", groupId)
        .maybeSingle();
      if (gr) setPublicGroup(prev => ({ ...(prev ?? {} as any), name: (gr as any).name, avatar_url: (gr as any).avatar_url }));
      setIsPending(true);
      setLoading(false);
      return;
    }

    const [info, msgs, clearRow] = await Promise.all([
      fetchWebGroupInfo(groupId),
      fetchWebMessages(groupId),
      supabase.from("group_message_clears").select("cleared_at").eq("user_id", user.id).eq("conversation_id", groupId).maybeSingle(),
    ]);
    if (!info) {
      // If the user has a valid membership but no conversation_participants row
      // (old data / invite bug), self-heal by inserting the missing row and retry.
      const isMember = memberRow && (memberRow as any).role !== "pending";
      if (isMember) {
        const cpId = (memberRow as any).company_page_id ?? null;
        await supabase.from("conversation_participants").upsert(
          { conversation_id: groupId, user_id: user.id, company_page_id: cpId },
          { onConflict: "conversation_id,user_id,company_page_id", ignoreDuplicates: true },
        );
        const retryInfo = await fetchWebGroupInfo(groupId);
        if (retryInfo) {
          setGroupInfo(retryInfo);
          const clearedAt: string | null = (clearRow.data as any)?.cleared_at ?? null;
          const filtered = clearedAt ? msgs.filter(m => m.created_at > clearedAt) : msgs;
          setMessages(filtered);
          filtered.forEach(m => seenIds.current.add(m.id));
          setLoading(false);
          scrollBottom();
          return;
        }
      }
      // User is not a member (RLS blocks conversations table). Try public group info.
      const pub = await fetchGroupByIdPublic(groupId);
      setPublicGroup(pub);
      setLoading(false);
      return;
    }
    setGroupInfo(info);
    const clearedAt: string | null = (clearRow.data as any)?.cleared_at ?? null;
    const filtered = clearedAt ? msgs.filter(m => m.created_at > clearedAt) : msgs;
    setMessages(filtered);
    filtered.forEach(m => seenIds.current.add(m.id));
    setLoading(false);
    scrollBottom();

    // Mark conversation read
    await supabase.from("conversation_participants")
      .update({ last_read_at: new Date().toISOString(), unread_count: 0 })
      .eq("conversation_id", groupId)
      .eq("user_id", user.id);
  }, [groupId, user?.id, scrollBottom]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId || !user?.id || channelRef.current) return;
    channelRef.current = supabase
      .channel(`web-group-chat:${groupId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${groupId}` },
        async (payload) => {
          const raw = payload.new as any;
          if (seenIds.current.has(raw.id)) return;
          seenIds.current.add(raw.id);
          // Fetch sender profile
          const { data: profile } = await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", raw.sender_id).maybeSingle();
          const msg: WebMessage = {
            id: raw.id,
            conversation_id: raw.conversation_id,
            sender_id: raw.sender_id,
            content: raw.content,
            message_type: raw.message_type ?? null,
            media_url: raw.media_url ?? null,
            created_at: raw.created_at,
            sender: profile ? { id: (profile as any).id, full_name: (profile as any).full_name, avatar_url: (profile as any).avatar_url } : undefined,
          };
          setMessages(prev => [...prev, msg]);
          scrollBottom();
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [groupId, user?.id, scrollBottom]);

  const handleSend = async () => {
    if (!input.trim() || sending || !user?.id) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    await sendWebMessage(groupId, user.id, text, { companyPageId: activeCompany?.id ?? null });
    setSending(false);
  };

  const handleAudioSend = async (blob: Blob, mimeType: string) => {
    if (!user?.id) return;
    const result = await sendWebAudioMessage(groupId, user.id, blob, mimeType, {
      companyPageId: activeCompany?.id ?? null,
    });
    if (!result.success) throw new Error("Não foi possível enviar o áudio.");
    scrollBottom();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleJoinGroup = async () => {
    if (!user?.id || !groupId || !publicGroup) return;
    setJoinState("loading");
    if (publicGroup.access === "aberto") {
      const ok = await joinGroup(groupId, user.id, activeCompany?.id ?? null);
      if (ok) { setJoinState("done"); load(); }
      else setJoinState("idle");
    } else {
      const result = await requestGroupJoinWeb(groupId, user.id, activeCompany?.id ?? null);
      if (result === "ok" || result === "already_pending") setJoinState("pending");
      else if (result === "already_member") { setJoinState("idle"); load(); }
      else setJoinState("idle");
    }
  };

  // ── Pending-approval gate ───────────────────────────────────────────────────
  if (!loading && isPending && groupId) {
    const groupName = (publicGroup as any)?.name ?? "Grupo";
    return (
      <AppShell>
        <div style={{ display: "flex", height: "calc(100vh - 0px)", overflow: "hidden", background: BG }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 800, margin: "0 auto", width: "100%", background: WHITE, borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, background: WHITE }}>
              <button onClick={() => setLocation("/app/grupos")} style={{ background: "none", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4 }}>
                <BackIcon />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{groupName}</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16, textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: GOLD + "20", border: `2px solid ${GOLD}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>⏳</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>Aguardando aprovação</div>
              <div style={{ fontSize: 14, color: MUTED, maxWidth: 340, lineHeight: 1.6 }}>
                Sua solicitação foi enviada para o admin do grupo <strong>{groupName}</strong>. Você receberá acesso assim que for aprovado.
              </div>
              <button onClick={() => setLocation("/app/grupos")} style={{ marginTop: 8, padding: "10px 24px", borderRadius: 10, background: "transparent", border: `1.5px solid ${GOLD}`, color: GOLD, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Voltar para grupos
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Non-member view ─────────────────────────────────────────────────────────
  if (!loading && !groupInfo && groupId) {
    const pg = publicGroup;
    const notFound = !pg;
    const accessIcon = pg?.access === "aberto" ? "🌐" : pg?.access === "fechado" ? "🔒" : "⛔";
    const accessLabel = pg?.access === "aberto" ? "Grupo público" : pg?.access === "fechado" ? "Grupo fechado" : "Grupo restrito";
    const btnLabel = joinState === "loading" ? "Aguarde…"
      : joinState === "done"    ? "✓ Entrou!"
      : joinState === "pending" ? "✓ Solicitado"
      : pg?.access === "aberto" ? "Entrar no grupo"
      : pg?.access === "fechado" ? "Solicitar entrada"
      : null;

    return (
      <AppShell>
        <div style={{ display: "flex", height: "calc(100vh - 0px)", overflow: "hidden", background: BG }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 800, margin: "0 auto", width: "100%", background: WHITE, borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, background: WHITE }}>
              <button onClick={() => setLocation("/app/grupos")} style={{ background: "none", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4 }}>
                <BackIcon />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{pg?.name ?? "Grupo"}</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16, textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: GOLD + "20", border: `2px solid ${GOLD}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>👥</div>
              {notFound ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>Grupo não encontrado</div>
                  <div style={{ fontSize: 14, color: MUTED, maxWidth: 300 }}>Este link pode ter expirado ou o grupo foi removido.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{pg.name}</div>
                  {pg.description && <div style={{ fontSize: 14, color: MUTED, maxWidth: 360, lineHeight: 1.5 }}>{pg.description}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: MUTED }}>
                    <span>{accessIcon} {accessLabel}</span>
                    <span>👥 {pg.member_count ?? 0} {(pg.member_count ?? 0) === 1 ? "membro" : "membros"}</span>
                  </div>
                  {pg.access === "restrito" ? (
                    <div style={{ marginTop: 8, padding: "12px 20px", borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontSize: 14 }}>
                      Este grupo é privado — você precisa ser convidado.
                    </div>
                  ) : btnLabel && (
                    <button
                      disabled={joinState !== "idle"}
                      onClick={handleJoinGroup}
                      style={{ marginTop: 8, padding: "12px 28px", borderRadius: 10, background: joinState !== "idle" ? GOLD + "80" : GOLD, color: NAVY, border: "none", cursor: joinState !== "idle" ? "default" : "pointer", fontWeight: 700, fontSize: 15 }}
                    >
                      {btnLabel}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const groupName = groupInfo?.name ?? "Grupo";
  const memberCount = groupInfo?.member_count ?? 0;

  return (
    <AppShell>
      <div style={{ display: "flex", height: "calc(100vh - 0px)", overflow: "hidden", background: BG }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 800, margin: "0 auto", width: "100%", background: WHITE, borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, background: WHITE, flexShrink: 0 }}>
            <button onClick={() => setLocation("/app/grupos")} style={{ background: "none", border: "none", cursor: "pointer", color: NAVY, display: "flex", padding: 4 }}>
              <BackIcon />
            </button>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: GOLD + "20", border: `2px solid ${GOLD}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              👥
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{groupName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <UsersIcon />
                <span style={{ fontSize: 12, color: MUTED }}>{memberCount} {memberCount === 1 ? "membro" : "membros"}</span>
              </div>
            </div>
            <button
              onClick={handleCopyLink}
              title={linkCopied ? "Link copiado!" : "Copiar link do grupo"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: linkCopied ? "#16a34a" : MUTED, transition: "color 0.2s" }}
              onMouseEnter={e => { if (!linkCopied) (e.currentTarget as HTMLButtonElement).style.color = NAVY; }}
              onMouseLeave={e => { if (!linkCopied) (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}
            >
              {linkCopied ? <CheckIcon /> : <LinkIcon />}
            </button>
            <button
              onClick={() => setLocation(`/app/grupos/${groupId}/configuracoes`)}
              title="Configurações do grupo"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 20, lineHeight: 1 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = NAVY; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}
            >⚙️</button>
          </div>

          {/* Messages */}
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: MUTED }}>⏳ Carregando mensagens…</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: MUTED }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
                <div style={{ fontSize: 14 }}>Nenhuma mensagem ainda. Diga olá!</div>
              </div>
            ) : messages.map(msg => {
              const isMe = msg.sender_id === user?.id;
              const senderName = msg.sender?.full_name ?? "Membro";
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                  {!isMe && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, marginLeft: 44 }}>
                      <span onClick={() => setLocation(`/app/usuario/${msg.sender_id}`)} style={{ fontSize: 11, fontWeight: 700, color: GOLD, cursor: "pointer" }}>{senderName}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: isMe ? "row-reverse" : "row" }}>
                    {!isMe && <div onClick={() => setLocation(`/app/usuario/${msg.sender_id}`)} style={{ cursor: "pointer", flexShrink: 0 }}><Avatar src={msg.sender?.avatar_url} name={senderName} size={34} /></div>}
                    <div style={{
                      maxWidth: "72%",
                      background: isMe ? NAVY : WHITE,
                      color: isMe ? WHITE : NAVY,
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: msg.media_url ? "8px 10px 10px" : "10px 14px",
                      border: isMe ? "none" : `1px solid ${BORDER}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}>
                      {msg.media_url && msg.message_type === "audio" && (
                        <audio
                          controls
                          src={msg.media_url}
                          style={{ display: "block", width: 240, maxWidth: "100%", marginBottom: msg.content ? 6 : 0 }}
                        />
                      )}
                      {msg.media_url && msg.message_type === "image" && (
                        <img src={msg.media_url} alt="" style={{ display: "block", maxWidth: 280, maxHeight: 280, borderRadius: 8, marginBottom: msg.content ? 6 : 0 }} />
                      )}
                      {msg.media_url && msg.message_type === "video" && (
                        <video controls src={msg.media_url} style={{ display: "block", maxWidth: 320, maxHeight: 320, borderRadius: 8, marginBottom: msg.content ? 6 : 0 }} />
                      )}
                      {msg.media_url && (msg.message_type === "file" || (msg.message_type !== "audio" && msg.message_type !== "image" && msg.message_type !== "video" && msg.message_type !== "text" && msg.message_type)) && (
                        <a
                          href={msg.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: isMe ? "rgba(255,255,255,0.12)" : BG, color: isMe ? WHITE : NAVY, textDecoration: "none", fontSize: 13, marginBottom: msg.content ? 6 : 0 }}
                        >
                          📎 <span>Abrir anexo</span>
                        </a>
                      )}
                      {msg.content && (
                        <div style={{ fontSize: 14, lineHeight: 1.45, wordBreak: "break-word" }}>{msg.content}</div>
                      )}
                      <div style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.55)" : MUTED, marginTop: 4, textAlign: "right" }}>{timeStr(msg.created_at)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input — WhatsApp style */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, background: WHITE, display: "flex", gap: 8, alignItems: "center" }}>
            {/* Text area — hidden while recording */}
            {!isRecording && (
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Mensagem no grupo…"
                rows={1}
                style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 22, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", outline: "none", resize: "none", maxHeight: 100, background: BG, color: NAVY }}
              />
            )}

            {/* AudioRecorder: mic when empty, recording UI when active, nothing when typing */}
            <AudioRecorder
              onSend={handleAudioSend}
              disabled={sending}
              hasText={!!input.trim()}
              onRecordingChange={setIsRecording}
            />

            {/* Send button — only when text is typed and not recording */}
            {!isRecording && input.trim() && (
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                style={{ width: 42, height: 42, borderRadius: 21, background: NAVY, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: WHITE, flexShrink: 0 }}
              >
                <SendIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
