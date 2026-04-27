import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { GruposContent } from "./GruposPage";
import { supabase } from "@/lib/supabase";

import {
  fetchWebConversations,
  fetchWebMessages,
  sendWebMessage,
  uploadChatAttachment,
  getOrCreateWebConversation,
  WebConversation,
  WebMessage,
} from "@/services/api";

interface UserSearchResult { id: string; full_name: string; headline?: string | null; avatar_url?: string | null; }

type ChatTab = "mensagens" | "grupos";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

function useIsMobile() {
  const [mobile, setMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

const IMG_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"];
function isImageUrl(url: string) {
  try {
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    return IMG_EXTS.includes(ext);
  } catch { return false; }
}

function isAttachmentMsg(content: string) {
  return content.startsWith("[attachment]:") || content.startsWith("http");
}

function parseAttachment(content: string): { url: string; label?: string } | null {
  if (content.startsWith("[attachment]:")) {
    const rest = content.slice("[attachment]:".length).trim();
    const [url, ...labelParts] = rest.split("|");
    return { url: url.trim(), label: labelParts.join("|").trim() || undefined };
  }
  if (content.startsWith("http")) return { url: content };
  return null;
}

function AttachmentBubble({ url, label, isMe }: { url: string; label?: string; isMe: boolean }) {
  if (isImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
        <img src={url} alt={label ?? "imagem"} style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10, display: "block", cursor: "zoom-in" }} />
        {label && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{label}</div>}
      </a>
    );
  }
  const filename = label ?? url.split("/").pop() ?? "arquivo";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", backgroundColor: isMe ? "rgba(255,255,255,0.15)" : BG, borderRadius: 10, textDecoration: "none", border: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 20 }}>📎</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: isMe ? NAVY : NAVY }}>{filename}</div>
        <div style={{ fontSize: 11, color: MUTED }}>Clique para baixar</div>
      </div>
    </a>
  );
}

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

// ── Icons ──────────────────────────────────────────────────────────────────────
function SendIcon({ size = 18, color = WHITE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function ClipIcon({ size = 18, color = MUTED }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}
function XIcon({ size = 14, color = MUTED }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export default function MensagensPage() {
  const { profile, user, activeCompany, loading: authLoading } = useAuth();
  const userId = profile?.id ?? user?.id ?? "";
  const isMobile = useIsMobile();
  const searchStr = useSearch();
  const [, setLocation] = useLocation();

  const [chatTab, setChatTab]             = useState<ChatTab>("mensagens");
  const [conversations, setConversations] = useState<WebConversation[]>([]);
  const [selected, setSelected]           = useState<WebConversation | null>(null);
  const [messages, setMessages]           = useState<WebMessage[]>([]);
  const [newMsg, setNewMsg]               = useState("");
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const [search, setSearch]               = useState("");
  const [showNewConvo, setShowNewConvo]   = useState(false);

  // Nova conversa - user search
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchUsers = async (q: string) => {
    if (q.trim().length < 2) { setUserSearchResults([]); return; }
    setUserSearchLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, headline, avatar_url")
        .ilike("full_name", `%${q.trim()}%`)
        .neq("id", userId)
        .limit(10);
      setUserSearchResults((data as UserSearchResult[]) ?? []);
    } catch { setUserSearchResults([]); }
    finally { setUserSearchLoading(false); }
  };

  const handleUserSearchChange = (q: string) => {
    setUserSearchQuery(q);
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current);
    userSearchTimer.current = setTimeout(() => searchUsers(q), 300);
  };

  const startConversation = async (targetUser: UserSearchResult) => {
    if (!userId) return;
    const convId = await getOrCreateWebConversation(userId, targetUser.id);
    if (!convId) return;
    setShowNewConvo(false);
    setUserSearchQuery("");
    setUserSearchResults([]);
    const freshConvos = await fetchWebConversations(userId);
    setConversations(freshConvos);
    const target = freshConvos.find(c => c.id === convId);
    if (target) { loadMessages(target); }
    else { setLocation(`/app/mensagens?conv=${convId}`); }
  };

  // Attachment state
  const [attachFile, setAttachFile]       = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse ?conv=<id> from URL to auto-open a specific conversation
  const convIdFromUrl = new URLSearchParams(searchStr).get("conv");

  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setLoading(false); return; }
    fetchWebConversations(userId)
      .then(data => {
        setConversations(data);
        setLoading(false);
        if (convIdFromUrl) {
          const target = data.find(c => c.id === convIdFromUrl);
          if (target) {
            setSelected(target);
            fetchWebMessages(target.id).then(setMessages);
          }
        }
      })
      .catch(() => setLoading(false));
  }, [userId, authLoading]);

  const loadMessages = useCallback(async (convo: WebConversation) => {
    setSelected(convo);
    const msgs = await fetchWebMessages(convo.id);
    setMessages(msgs);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = ev => setAttachPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachPreview(null);
    }
    e.target.value = "";
  };

  const clearAttach = () => {
    setAttachFile(null);
    setAttachPreview(null);
  };

  const handleSend = async () => {
    if ((!newMsg.trim() && !attachFile) || !selected || !userId || sending || uploading) return;
    setSending(true);

    let content = newMsg.trim();

    if (attachFile) {
      setUploading(true);
      const url = await uploadChatAttachment(attachFile, userId);
      setUploading(false);
      if (url) {
        const label = attachFile.name;
        const attachContent = `[attachment]:${url}|${label}`;
        if (content) {
          await sendWebMessage(selected.id, userId, content);
          content = attachContent;
        } else {
          content = attachContent;
        }
      }
      clearAttach();
    }

    if (content) {
      const ok = await sendWebMessage(selected.id, userId, content);
      if (ok) {
        setMessages(prev => [...prev, {
          id: `tmp-${Date.now()}`,
          conversation_id: selected.id,
          sender_id: userId,
          content,
          created_at: new Date().toISOString(),
          sender: { id: userId, full_name: profile?.full_name ?? "Eu", avatar_url: profile?.avatar_url },
        }]);
        setNewMsg("");
      }
    }
    setSending(false);
  };

  const filteredConvos = conversations.filter(c => {
    const name = c.name ?? c.participant?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getConvoName   = (c: WebConversation) => c.name ?? c.participant?.full_name ?? "Conversa";
  const getConvoAvatar = (c: WebConversation) => c.participant?.avatar_url ?? null;

  const busy = sending || uploading;
  const canSend = (newMsg.trim().length > 0 || attachFile !== null) && !busy;

  // ── Shared thread JSX ──────────────────────────────────────────────────────
  const threadJSX = selected ? (
    <>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10, backgroundColor: "#f9f9f7" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: MUTED, fontSize: 13, marginTop: 24 }}>Nenhuma mensagem ainda. Diga olá! 👋</div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === userId;
          // Resolve attachment: mobile sends media_url + message_type; web sends [attachment]: in content
          const mobileMediaUrl = msg.media_url && msg.message_type && msg.message_type !== "text"
            ? msg.media_url : null;
          const attach = mobileMediaUrl
            ? { url: mobileMediaUrl, label: msg.content || undefined }
            : parseAttachment(msg.content ?? "");
          const isMedia = !!attach;
          const isImageMsg = msg.message_type === "image" ||
            (isMedia && attach && isImageUrl(attach.url));
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: 8 }}>
              {!isMe && <div onClick={() => msg.sender_id && setLocation(`/app/usuario/${msg.sender_id}`)} style={{ cursor: "pointer", flexShrink: 0, alignSelf: "flex-end" }}><Avatar src={msg.sender?.avatar_url} name={msg.sender?.full_name ?? "?"} size={30} /></div>}
              <div style={{ maxWidth: "76%" }}>
                {!isMe && (
                  <div onClick={() => msg.sender_id && setLocation(`/app/usuario/${msg.sender_id}`)} style={{ fontSize: 11, color: MUTED, marginBottom: 2, cursor: "pointer" }}>{msg.sender?.full_name}</div>
                )}
                <div style={{
                  backgroundColor: isMe ? GOLD : WHITE,
                  color: NAVY,
                  borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: isMedia ? (isImageMsg ? "4px" : "8px") : "10px 14px",
                  fontSize: 14, lineHeight: 1.55,
                  border: isMe ? "none" : `1px solid ${BORDER}`,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}>
                  {attach
                    ? <AttachmentBubble url={attach.url} label={attach.label} isMe={isMe} />
                    : (msg.content || "")
                  }
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

      {/* Attachment preview */}
      {attachFile && (
        <div style={{ padding: "8px 16px 0", flexShrink: 0, backgroundColor: WHITE }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px" }}>
            {attachPreview ? (
              <img src={attachPreview} alt="preview" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 22 }}>📎</span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachFile.name}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{(attachFile.size / 1024).toFixed(0)} KB</div>
            </div>
            <button onClick={clearAttach} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
              <XIcon size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, backgroundColor: WHITE }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ flexShrink: 0, width: 38, height: 38, border: `1px solid ${BORDER}`, borderRadius: 19, backgroundColor: WHITE, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}
        >
          <ClipIcon size={18} color={attachFile ? GOLD : MUTED} />
        </button>
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Escreva uma mensagem…"
          style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 24, padding: "10px 16px", fontSize: 14, outline: "none", fontFamily: "inherit", backgroundColor: "#f9f9f7" }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{ flexShrink: 0, width: 38, height: 38, border: "none", borderRadius: 19, backgroundColor: canSend ? GOLD : `${GOLD}40`, cursor: canSend ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}
        >
          {busy ? <span style={{ fontSize: 13 }}>⏳</span> : <SendIcon size={16} color={canSend ? NAVY : "#999"} />}
        </button>
      </div>
    </>
  ) : null;

  // ── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    // Thread view (conversation open)
    if (selected) {
      return (
        <AppShell>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" style={{ display: "none" }} onChange={handleFileChange} />
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
            {/* Thread header */}
            <div style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, position: "sticky", top: 56, zIndex: 20 }}>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: GOLD, lineHeight: 1, padding: "0 8px 0 0", flexShrink: 0 }}>‹</button>
              <Avatar src={getConvoAvatar(selected)} name={getConvoName(selected)} size={40} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{getConvoName(selected)}</div>
                {selected.participant && <div style={{ fontSize: 12, color: MUTED }}>Profissional do vinho</div>}
              </div>
            </div>
            {threadJSX}
          </div>
        </AppShell>
      );
    }

    // Conversation list view
    return (
      <AppShell>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" style={{ display: "none" }} onChange={handleFileChange} />
        <div style={{ backgroundColor: "#f2f3f5", minHeight: "100vh", paddingBottom: 80 }}>

          {/* Sticky header */}
          <div style={{ position: "sticky", top: 56, zIndex: 20, backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>
                {chatTab === "grupos" ? "Grupos" : (activeCompany ? `Chat – ${activeCompany.name}` : "Chat")}
              </span>
              {chatTab === "mensagens" && (
                <button
                  onClick={() => setShowNewConvo(v => !v)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: showNewConvo ? `${GOLD}20` : GOLD, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
                >
                  ✏️
                </button>
              )}
            </div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, padding: "10px 16px 0" }}>
              {(["mensagens", "grupos"] as ChatTab[]).map(t => (
                <button key={t} onClick={() => setChatTab(t)} style={{
                  flex: 1, padding: "9px 4px", border: "none", background: "none", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: chatTab === t ? 800 : 500,
                  color: chatTab === t ? NAVY : MUTED,
                  borderBottom: chatTab === t ? `2px solid ${GOLD}` : "2px solid transparent",
                  transition: "all 0.15s",
                }}>
                  {t === "mensagens" ? "💬 Mensagens" : "👥 Grupos"}
                </button>
              ))}
            </div>
          </div>

          {/* Grupos tab content */}
          {chatTab === "grupos" && (
            <div style={{ padding: "16px 14px 80px" }}>
              <GruposContent />
            </div>
          )}

          {chatTab === "mensagens" && <>
          {/* Company mode banner */}
          {activeCompany && (
            <div style={{ backgroundColor: `${GOLD}12`, borderBottom: `1px solid ${GOLD}30`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              {activeCompany.avatar_url
                ? <img src={activeCompany.avatar_url} alt={activeCompany.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: WHITE }}>{activeCompany.name[0]}</div>
              }
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Modo Empresa ativo</div>
            </div>
          )}

          {/* Nova conversa panel */}
          {showNewConvo && (
            <div style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Nova conversa</div>
                <button onClick={() => { setShowNewConvo(false); setUserSearchQuery(""); setUserSearchResults([]); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
                  <XIcon size={16} color={MUTED} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#f2f3f5", borderRadius: 20, padding: "9px 14px", marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: MUTED, lineHeight: 1 }}>🔍</span>
                <input
                  value={userSearchQuery}
                  onChange={e => handleUserSearchChange(e.target.value)}
                  placeholder="Buscar por nome..."
                  autoFocus
                  style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: 14, fontFamily: "inherit", color: NAVY }}
                />
              </div>
              {userSearchLoading && <div style={{ fontSize: 12, color: MUTED, padding: "4px 0" }}>Buscando…</div>}
              {userSearchResults.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 240, overflowY: "auto" }}>
                  {userSearchResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => startConversation(u)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "none", background: "none", borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "background 0.12s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = BG; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                    >
                      <Avatar src={u.avatar_url} name={u.full_name} size={38} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{u.full_name}</div>
                        {u.headline && <div style={{ fontSize: 11, color: MUTED }}>{u.headline}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {userSearchQuery.length >= 2 && !userSearchLoading && userSearchResults.length === 0 && (
                <div style={{ fontSize: 12, color: MUTED, padding: "4px 0" }}>Nenhum usuário encontrado.</div>
              )}
            </div>
          )}

          {/* Search bar */}
          <div style={{ backgroundColor: WHITE, padding: "10px 16px 10px", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#f2f3f5", borderRadius: 20, padding: "9px 14px" }}>
              <span style={{ fontSize: 14, color: MUTED, lineHeight: 1 }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar conversas..."
                style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: 14, fontFamily: "inherit", color: NAVY }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                  <XIcon size={14} color={MUTED} />
                </button>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ backgroundColor: WHITE }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: MUTED, fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>Carregando…
              </div>
            ) : filteredConvos.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>O brinde começa com um "Olá"</div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Inicie uma conversa com alguém da sua rede</div>
                <button
                  onClick={() => setShowNewConvo(true)}
                  style={{ padding: "11px 22px", backgroundColor: GOLD, color: NAVY, border: "none", borderRadius: 20, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  ✏️ Nova conversa
                </button>
              </div>
            ) : (
              filteredConvos.map((convo, i) => (
                <button
                  key={convo.id}
                  onClick={() => loadMessages(convo)}
                  style={{
                    display: "flex", alignItems: "center", width: "100%", padding: "14px 16px", gap: 14,
                    border: "none", borderBottom: i < filteredConvos.length - 1 ? `1px solid ${BORDER}` : "none",
                    backgroundColor: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                >
                  <Avatar src={getConvoAvatar(convo)} name={getConvoName(convo)} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: convo.unread_count > 0 ? 800 : 600, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
                        {getConvoName(convo)}
                      </span>
                      {convo.last_message_at && (
                        <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{timeAgo(convo.last_message_at)}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontWeight: convo.unread_count > 0 ? 600 : 400, color: convo.unread_count > 0 ? NAVY : MUTED }}>
                        {convo.last_message ?? "Iniciar conversa"}
                      </span>
                      {convo.unread_count > 0 && (
                        <div style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: GOLD, color: WHITE, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 8 }}>
                          {convo.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          </>}
        </div>
      </AppShell>
    );
  }

  // ── Desktop layout ──────────────────────────────────────────────────────────
  return (
    <AppShell>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Company mode banner */}
        {activeCompany && (
          <div style={{ marginBottom: 14, backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}30`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            {activeCompany.avatar_url
              ? <img src={activeCompany.avatar_url} alt={activeCompany.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: WHITE }}>{activeCompany.name[0]}</div>
            }
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase" }}>Modo Empresa</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Chat de {activeCompany.name}</div>
            </div>
          </div>
        )}

        {/* Desktop tab switcher */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: 0 }}>
            {chatTab === "grupos" ? "Grupos" : (activeCompany ? "Chat da Empresa" : "Mensagens")}
          </h1>
          <div style={{ display: "flex", gap: 4, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 4 }}>
            {(["mensagens", "grupos"] as ChatTab[]).map(t => (
              <button key={t} onClick={() => setChatTab(t)} style={{
                padding: "7px 18px", borderRadius: 9, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: chatTab === t ? 700 : 500,
                backgroundColor: chatTab === t ? GOLD : "transparent",
                color: chatTab === t ? "#fff" : MUTED,
                transition: "all 0.15s",
              }}>
                {t === "mensagens" ? "💬 Mensagens" : "👥 Grupos"}
              </button>
            ))}
          </div>
        </div>

        {chatTab === "grupos" && (
          <GruposContent />
        )}

        {chatTab === "mensagens" && <div style={{ display: "flex", height: "calc(100vh - 200px)", backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>

          {/* ── Sidebar ── */}
          <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar conversas..."
                  style={{ flex: 1, minWidth: 0, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "8px 14px", fontSize: 13, outline: "none", backgroundColor: BG, fontFamily: "inherit" }}
                />
                <button
                  onClick={() => setShowNewConvo(v => !v)}
                  title="Nova conversa"
                  style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 18, backgroundColor: showNewConvo ? `${GOLD}20` : GOLD, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
                >✏️</button>
              </div>
              {/* Desktop nova conversa search */}
              {showNewConvo && (
                <div style={{ backgroundColor: BG, borderRadius: 10, padding: "10px 10px 8px", border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Nova conversa</div>
                  <input
                    value={userSearchQuery}
                    onChange={e => handleUserSearchChange(e.target.value)}
                    placeholder="Buscar por nome..."
                    autoFocus
                    style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "7px 12px", fontSize: 13, outline: "none", backgroundColor: WHITE, fontFamily: "inherit" }}
                  />
                  {userSearchLoading && <div style={{ fontSize: 11, color: MUTED, padding: "4px 2px" }}>Buscando…</div>}
                  {userSearchResults.length > 0 && (
                    <div style={{ marginTop: 6, maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                      {userSearchResults.map(u => (
                        <button
                          key={u.id}
                          onClick={() => startConversation(u)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "none", background: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = WHITE; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                        >
                          <Avatar src={u.avatar_url} name={u.full_name} size={30} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name}</div>
                            {u.headline && <div style={{ fontSize: 11, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.headline}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {userSearchQuery.length >= 2 && !userSearchLoading && userSearchResults.length === 0 && (
                    <div style={{ fontSize: 11, color: MUTED, padding: "4px 2px" }}>Nenhum usuário encontrado.</div>
                  )}
                </div>
              )}
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
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: MUTED }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Selecione uma conversa</p>
                <p style={{ fontSize: 13 }}>Escolha à esquerda para visualizar as mensagens</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <Avatar src={getConvoAvatar(selected)} name={getConvoName(selected)} size={38} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{getConvoName(selected)}</div>
                    {selected.participant && <div style={{ fontSize: 12, color: MUTED }}>Profissional do vinho</div>}
                  </div>
                </div>
                {threadJSX}
              </>
            )}
          </div>
        </div>}
      </div>
    </AppShell>
  );
}
