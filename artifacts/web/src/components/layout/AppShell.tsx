import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  fetchProfileStats,
  fetchWebCompanyPages,
  fetchConnectionsList,
  fetchFollowersList,
  fetchFollowingList,
  WebCompanyPage,
  ProfilePerson,
  createWebPost,
  uploadWebPostVideo,
  addWineEntry,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const BG     = "#f5f5f0";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

/* ─── Icons ──────────────────────────────── */
const I = {
  home:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  market:    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  brief:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  msg:       <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  group:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  wine:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 22H5a2 2 0 0 1-2-2V6l3-3h14a2 2 0 0 1 2 2v5"/><circle cx="16" cy="16" r="6"/></svg>,
  save:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  settings:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  bell:      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  search:    <svg width="16" height="16" fill="none" stroke={MUTED} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  chevDown:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>,
  image:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  video:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  poll:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  star:      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  x:         <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  company:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>,
  chevRight: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>,
};

const NAV_ITEMS = [
  { path: "/app",               label: "Feed",           icon: I.home },
  { path: "/app/mercado",       label: "Mercado",        icon: I.market },
  { path: "/app/oportunidades", label: "Oportunidades",  icon: I.brief },
  { path: "/app/mensagens",     label: "Mensagens",      icon: I.msg },
  { path: "/app/grupos",        label: "Grupos",         icon: I.group },
  { path: "/app/adega",         label: "Adega",          icon: I.wine },
  { path: "/app/notificacoes",  label: "Notificações",   icon: I.bell },
];

function isActive(current: string, path: string) {
  if (path === "/app") return current === "/app" || current === "/app/";
  return current.startsWith(path);
}

function Avatar({ src, name, size = 36, bg = "#722f37" }: { src?: string | null; name: string; size?: number; bg?: string }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", backgroundColor: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0,
    }}>
      {(name?.[0] ?? "U").toUpperCase()}
    </div>
  );
}

/* ─── CreatePost Modal ───────────────────── */
type PostTab = "texto" | "foto" | "video" | "enquete" | "vinho";

interface CreatePostModalProps {
  profile: { id: string; full_name?: string | null; avatar_url?: string | null; username?: string | null };
  userId: string;
  companyPageId?: string | null;
  companyName?: string | null;
  companyAvatar?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

function CreatePostModal({ profile, userId, companyPageId, companyName, companyAvatar, onClose, onCreated }: CreatePostModalProps) {
  const [tab, setTab]           = useState<PostTab>("texto");
  const [content, setContent]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Foto
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Vídeo
  const [videoFile, setVideoFile]       = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      alert("Por favor selecione um arquivo de vídeo válido.");
      return;
    }
    const MAX_SIZE_BYTES = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      alert("O vídeo deve ter no máximo 500 MB.");
      return;
    }
    const MAX_SECONDS = 120;
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(vid.src);
      if (vid.duration > MAX_SECONDS) {
        alert("O vídeo deve ter no máximo 2 minutos.");
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    };
    vid.src = URL.createObjectURL(file);
  };

  // Enquete
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Avaliação de Vinho
  const [wineName, setWineName]       = useState("");
  const [wineGrape, setWineGrape]     = useState("");
  const [wineSafra, setWineSafra]     = useState("");
  const [wineEan, setWineEan]         = useState("");
  const [wineProducer, setWineProducer] = useState("");
  const [wineCountry, setWineCountry] = useState("");
  const [wineRegion, setWineRegion]   = useState("");
  const [wineScore, setWineScore]     = useState(85);
  const [wineNotes, setWineNotes]     = useState("");

  const name = companyPageId ? (companyName ?? "Empresa") : (profile.full_name ?? "Usuário");
  const avatarSrc = companyPageId ? companyAvatar : profile.avatar_url;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const buildContent = (): string => {
    if (tab === "texto") return content;
    if (tab === "foto")  return content;
    if (tab === "video") return content;
    if (tab === "enquete") {
      const opts = pollOptions.filter(o => o.trim());
      return [content, ...opts.map((o, i) => `${["🔵","🟡","🔴","🟢"][i] ?? "▸"} ${o}`)].filter(Boolean).join("\n");
    }
    if (tab === "vinho") {
      const stars = Math.max(1, Math.min(5, Math.round(wineScore / 20)));
      const starsStr = "⭐".repeat(stars);
      const metaLine = [
        wineGrape.trim()    ? `🍇 ${wineGrape.trim()}`    : "",
        wineSafra.trim()    ? `📅 ${wineSafra.trim()}`     : "",
        wineProducer.trim() ? `🏭 ${wineProducer.trim()}`  : "",
        wineRegion.trim()   ? `📍 ${wineRegion.trim()}`    : "",
        wineCountry.trim()  ? `🌍 ${wineCountry.trim()}`   : "",
      ].filter(Boolean).join(" · ");
      return [
        `${starsStr} ${wineName || "Vinho"}`,
        metaLine,
        `📊 Pontuação: ${wineScore}/100`,
        wineEan.trim()   ? `🏷️ EAN: ${wineEan.trim()}`   : "",
        wineNotes.trim() ? `📝 ${wineNotes.trim()}`        : "",
      ].filter(Boolean).join("\n");
    }
    return content;
  };

  const canSubmit = () => {
    if (tab === "texto") return content.trim().length > 0;
    if (tab === "foto")  return imagePreview !== null;
    if (tab === "video") return videoFile !== null;
    if (tab === "enquete") return pollOptions.filter(o => o.trim()).length >= 2;
    if (tab === "vinho") return wineName.trim().length > 0;
    return false;
  };

  const handleSubmit = async () => {
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    let video_url: string | null = null;
    if (tab === "video" && videoFile) {
      video_url = await uploadWebPostVideo(videoFile, userId);
      if (!video_url) {
        setSubmitting(false);
        alert("Erro ao enviar vídeo. Tente novamente.");
        return;
      }
    }
    await createWebPost({
      user_id: userId,
      content: buildContent(),
      video_url: video_url ?? null,
      company_page_id: companyPageId ?? null,
    });
    if (tab === "vinho" && wineName.trim()) {
      addWineEntry({
        user_id: userId,
        name: wineName.trim(),
        vintage: wineSafra.trim() || null,
        ean: wineEan.trim() || null,
        grape: wineGrape.trim() || null,
        region: wineRegion.trim() || null,
        producer: wineProducer.trim() || null,
        country: wineCountry.trim() || null,
        rating: Math.max(1, Math.min(5, Math.round(wineScore / 20))),
        score_100: wineScore,
        notes: wineNotes.trim() || null,
        qty: 1,
        status: "consumido",
        is_private: false,
      }).catch(() => {});
    }
    setSubmitting(false);
    onCreated();
    onClose();
  };

  const TABS: { key: PostTab; label: string; icon: React.ReactNode }[] = [
    { key: "texto",   label: "Publicação", icon: null },
    { key: "foto",    label: "Foto",       icon: I.image },
    { key: "video",   label: "Vídeo",      icon: I.video },
    { key: "enquete", label: "Enquete",    icon: I.poll },
    { key: "vinho",   label: "Vinho 🍷",   icon: I.star },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      backgroundColor: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        backgroundColor: WHITE, borderRadius: 16, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>Criar publicação</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}>
            {I.x}
          </button>
        </div>

        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px 0" }}>
          <Avatar src={avatarSrc} name={name} size={44} bg={companyPageId ? "#c9a84c" : "#722f37"} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{name}</div>
            {companyPageId
              ? <div style={{ fontSize: 12, color: "#c9a84c", fontWeight: 600 }}>Publicando como empresa ✦</div>
              : profile.username && <div style={{ fontSize: 12, color: MUTED }}>@{profile.username}</div>
            }
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "12px 20px 0", overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              border: `1px solid ${tab === t.key ? GOLD : BORDER}`,
              backgroundColor: tab === t.key ? `${GOLD}15` : WHITE,
              color: tab === t.key ? GOLD : MUTED, cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {t.icon && <span style={{ color: tab === t.key ? GOLD : MUTED }}>{t.icon}</span>}
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "14px 20px" }}>
          {/* Always show text area for texto/foto/video/enquete */}
          {tab !== "vinho" && (
            <textarea
              autoFocus={tab === "texto"}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={
                tab === "texto"   ? "O que está acontecendo no mundo do vinho?" :
                tab === "foto"    ? "Descreva a foto..." :
                tab === "video"   ? "Sobre o vídeo..." :
                "Pergunta da enquete..."
              }
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px",
                fontSize: 14, color: NAVY, lineHeight: 1.65,
                resize: "none", outline: "none", fontFamily: "inherit",
              }}
            />
          )}

          {/* Foto */}
          {tab === "foto" && (
            <div style={{ marginTop: 12 }}>
              <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
              {imagePreview ? (
                <div style={{ position: "relative" }}>
                  <img src={imagePreview} alt="" style={{ width: "100%", borderRadius: 10, maxHeight: 300, objectFit: "cover" }} />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{
                    position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", border: "none",
                    borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: WHITE, fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>×</button>
                </div>
              ) : (
                <button onClick={() => imgInputRef.current?.click()} style={{
                  width: "100%", padding: "32px 0", backgroundColor: BG, border: `2px dashed ${BORDER}`,
                  borderRadius: 10, cursor: "pointer", fontSize: 14, color: MUTED, fontFamily: "inherit",
                }}>
                  📸 Clique para selecionar uma foto
                </button>
              )}
            </div>
          )}

          {/* Vídeo */}
          {tab === "video" && (
            <div style={{ marginTop: 12 }}>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                style={{ display: "none" }}
                onChange={handleVideoChange}
              />
              {videoPreview ? (
                <div style={{ position: "relative" }}>
                  <video
                    src={videoPreview}
                    controls
                    style={{ width: "100%", maxHeight: 280, borderRadius: 10, display: "block", background: "#000" }}
                  />
                  <button
                    onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      backgroundColor: "rgba(0,0,0,0.6)", border: "none",
                      borderRadius: "50%", width: 28, height: 28,
                      cursor: "pointer", color: WHITE, fontSize: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >×</button>
                </div>
              ) : (
                <button
                  onClick={() => videoInputRef.current?.click()}
                  style={{
                    width: "100%", padding: "32px 0",
                    backgroundColor: BG, border: `2px dashed ${BORDER}`,
                    borderRadius: 10, cursor: "pointer", fontSize: 14,
                    color: MUTED, fontFamily: "inherit",
                  }}
                >
                  🎬 Clique para selecionar um vídeo (máx. 2 min)
                </button>
              )}
            </div>
          )}

          {/* Enquete */}
          {tab === "enquete" && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {pollOptions.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: GOLD, flexShrink: 0 }}>{i + 1}</div>
                  <input
                    value={opt}
                    onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                    placeholder={`Opção ${i + 1}`}
                    style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 16 }}>×</button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button onClick={() => setPollOptions(prev => [...prev, ""])} style={{
                  background: "none", border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "8px 12px",
                  fontSize: 13, color: MUTED, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                }}>+ Adicionar opção</button>
              )}
            </div>
          )}

          {/* Avaliação de Vinho */}
          {tab === "vinho" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Nome do vinho */}
              <input value={wineName} onChange={e => setWineName(e.target.value)} placeholder="Nome do vinho *" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              {/* Uva e Safra */}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={wineGrape} onChange={e => setWineGrape(e.target.value)} placeholder="Uva/Casta (ex: Cabernet Sauvignon)" style={{ flex: 3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", minWidth: 0 }} />
                <input value={wineSafra} onChange={e => setWineSafra(e.target.value)} placeholder="Safra" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", minWidth: 0 }} maxLength={4} />
              </div>
              {/* Produtor e País */}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={wineProducer} onChange={e => setWineProducer(e.target.value)} placeholder="Produtor (ex: Concha y Toro)" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", minWidth: 0 }} />
                <input value={wineCountry} onChange={e => setWineCountry(e.target.value)} placeholder="País" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", minWidth: 0 }} />
              </div>
              {/* Região */}
              <input value={wineRegion} onChange={e => setWineRegion(e.target.value)} placeholder="Região" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              {/* EAN */}
              <input value={wineEan} onChange={e => setWineEan(e.target.value)} placeholder="Código EAN (opcional — usado no ranking comunitário)" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              {/* Pontuação */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Pontuação</label>
                  <span style={{ fontSize: 16, fontWeight: 900, color: GOLD }}>{wineScore}/100</span>
                </div>
                <input type="range" min={0} max={100} value={wineScore} onChange={e => setWineScore(Number(e.target.value))}
                  style={{ width: "100%", accentColor: GOLD }} />
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize: 20, color: s <= Math.round(wineScore / 20) ? GOLD : "#ddd" }}>⭐</span>
                  ))}
                </div>
              </div>
              {/* Notas */}
              <textarea value={wineNotes} onChange={e => setWineNotes(e.target.value)} placeholder="Notas de degustação, aromas, sabores..." rows={3} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit" }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 20px", fontSize: 14, fontWeight: 600, color: MUTED, cursor: "pointer" }}>Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || submitting}
            style={{
              backgroundColor: canSubmit() ? GOLD : `${GOLD}55`,
              color: NAVY, fontWeight: 800, fontSize: 14, border: "none",
              borderRadius: 8, padding: "9px 28px", cursor: canSubmit() ? "pointer" : "default",
            }}
          >
            {submitting ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── AppShell ───────────────────────────── */
export function AppShell({ children, onPostCreated }: { children: React.ReactNode; onPostCreated?: () => void }) {
  const { profile, user, signOut, activeCompany, setActiveCompany } = useAuth();
  const [location, setLocation] = useLocation();
  const [stats, setStats]           = useState({ connections: 0, followers: 0, following: 0 });
  const [companyPages, setCompanyPages] = useState<WebCompanyPage[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userMenuOpen, setUserMenuOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const [peopleModal, setPeopleModal] = useState<{ title: string; list: ProfilePerson[] } | null>(null);

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Usuário";
  const username    = profile?.username ? `@${profile.username}` : "";
  const userId      = profile?.id ?? user?.id ?? "";

  useEffect(() => {
    if (!userId) return;
    fetchProfileStats(userId).then(setStats);
    fetchWebCompanyPages(userId).then(setCompanyPages);
  }, [userId]);

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const openConnections = async () => {
    const list = await fetchConnectionsList(userId);
    setPeopleModal({ title: "Conexões", list });
  };
  const openFollowers = async () => {
    const list = await fetchFollowersList(userId);
    setPeopleModal({ title: "Seguidores", list });
  };
  const openFollowing = async () => {
    const list = await fetchFollowingList(userId);
    setPeopleModal({ title: "Seguindo", list });
  };

  const handlePostCreated = useCallback(() => {
    onPostCreated?.();
  }, [onPostCreated]);

  // Allow any page to open the create post modal via custom event
  useEffect(() => {
    const handler = () => setShowCreateModal(true);
    window.addEventListener("ibhub:openCreatePost", handler);
    return () => window.removeEventListener("ibhub:openCreatePost", handler);
  }, []);

  const activeName   = activeCompany ? activeCompany.name : displayName;
  const activeAvatar = activeCompany ? activeCompany.avatar_url : profile?.avatar_url;

  const currentNavItems = activeCompany ? [
    { path: "/app",               label: "Início",            icon: I.home },
    { path: "/app/mensagens",     label: "Chat",              icon: I.msg },
    { path: "/app/oportunidades", label: "Oportunidades",     icon: I.brief },
    { path: `/app/empresa/${activeCompany.id}`, label: "Perfil da Empresa", icon: I.company },
  ] : NAV_ITEMS;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* ── Top bar ────────────────────────── */}
      <header style={{
        backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`,
        position: "sticky", top: 0, zIndex: 200, height: 56,
        display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
      }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: GOLD, cursor: "pointer", flexShrink: 0, letterSpacing: -0.3 }} onClick={() => setLocation("/app")}>ibhub</span>

        <div
          style={{ flex: 1, maxWidth: 400, display: "flex", alignItems: "center", gap: 8, backgroundColor: "#f2f2ed", borderRadius: 24, padding: "7px 14px", cursor: "text" }}
          onClick={() => setLocation("/app/busca")}
        >
          {I.search}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && search.trim()) setLocation("/app/busca"); }}
            onClick={e => { e.stopPropagation(); setLocation("/app/busca"); }}
            placeholder="Buscar pessoas, empresas, hashtags..."
            readOnly
            style={{ border: "none", background: "none", outline: "none", fontSize: 13, color: NAVY, width: "100%", cursor: "pointer" }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {profile?.is_admin && (
          <button onClick={() => setLocation("/admin")} style={{ background: "none", border: `1px solid ${GOLD}55`, borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: GOLD, cursor: "pointer" }}>⚙ Admin</button>
        )}

        <button onClick={() => setLocation("/app/notificacoes")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", padding: 4 }} title="Notificações">{I.bell}</button>

        {/* ── Profile / Company dropdown ── */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "2px 4px", borderRadius: 8 }}
          >
            <Avatar src={activeAvatar} name={activeName} size={34} />
            {I.chevDown}
          </button>

          {userMenuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)",
              backgroundColor: WHITE, border: `1px solid ${BORDER}`,
              borderRadius: 12, minWidth: 230,
              boxShadow: "0 8px 32px rgba(0,0,0,0.13)", zIndex: 300,
              overflow: "hidden",
            }}>
              {/* ── Perfil Pessoal ── */}
              <div style={{ padding: "4px 4px 0" }}>
                <button
                  onClick={() => { setActiveCompany(null); setUserMenuOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "10px 12px", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
                    backgroundColor: !activeCompany ? `${GOLD}12` : "transparent",
                    fontFamily: "inherit",
                  }}
                >
                  <Avatar src={profile?.avatar_url} name={displayName} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: !activeCompany ? GOLD : NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>Perfil pessoal</div>
                  </div>
                  {!activeCompany && <span style={{ color: GOLD, fontSize: 14 }}>✓</span>}
                </button>
              </div>

              {/* ── Perfil Empresarial ── */}
              {companyPages.length > 0 && (
                <div style={{ padding: "0 4px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: 0.8, padding: "8px 12px 4px", textTransform: "uppercase" }}>
                    Perfil Empresarial
                  </div>
                  {companyPages.map(cp => (
                    <button
                      key={cp.id}
                      onClick={() => { setActiveCompany(cp); setUserMenuOpen(false); setLocation(`/app/empresa/${cp.id}`); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
                        backgroundColor: activeCompany?.id === cp.id ? `${GOLD}12` : "transparent",
                        fontFamily: "inherit",
                      }}
                    >
                      <Avatar src={cp.avatar_url} name={cp.name} size={32} bg={GOLD} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: activeCompany?.id === cp.id ? GOLD : NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.name}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>Página empresarial</div>
                      </div>
                      {activeCompany?.id === cp.id && <span style={{ color: GOLD, fontSize: 14 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Links ── */}
              <div style={{ borderTop: `1px solid ${BORDER}`, margin: "4px 0", padding: "4px 4px 0" }}>
                {[
                  { label: "Meu Perfil",           path: "/app/perfil",   emoji: "👤" },
                  { label: "Configurações",         path: "/minha-conta",  emoji: "⚙️" },
                  { label: "Planos e assinaturas",  path: "/assinar",      emoji: "💎" },
                ].map(({ label, path, emoji }) => (
                  <button
                    key={path}
                    onClick={() => { setUserMenuOpen(false); setLocation(path); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "9px 12px", border: "none", borderRadius: 8, cursor: "pointer",
                      fontSize: 13, color: NAVY, textAlign: "left", fontFamily: "inherit",
                      backgroundColor: "transparent",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{emoji}</span>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Sair ── */}
              <div style={{ borderTop: `1px solid ${BORDER}`, padding: "4px 4px 4px" }}>
                <button
                  onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "9px 12px", border: "none", borderRadius: 8, cursor: "pointer",
                    fontSize: 13, color: "#e53e3e", textAlign: "left", fontFamily: "inherit",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#fff5f5")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>🚪</span>
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ───────────────────────────── */}
      <div style={{ display: "flex", maxWidth: 1180, margin: "0 auto", padding: "20px 16px", gap: 20, alignItems: "flex-start" }}>

        {/* ── Sidebar ──────────────────────── */}
        <aside style={{ width: 250, flexShrink: 0, position: "sticky", top: 76, maxHeight: "calc(100vh - 96px)", overflowY: "auto" }}>

          {/* ── Company mode banner ── */}
          {activeCompany && (
            <div style={{ backgroundColor: `${GOLD}15`, border: `1px solid ${GOLD}40`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar src={activeCompany.avatar_url} name={activeCompany.name} size={36} bg={GOLD} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 1 }}>Modo Empresa</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeCompany.name}</div>
              </div>
              <button onClick={() => setActiveCompany(null)} title="Voltar ao perfil pessoal" style={{ background: "none", border: `1px solid ${GOLD}60`, borderRadius: 6, padding: "3px 7px", fontSize: 11, color: GOLD, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>Sair</button>
            </div>
          )}

          {/* Profile card */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: 56, background: activeCompany ? `linear-gradient(135deg, ${GOLD}30 0%, ${GOLD}10 100%)` : "linear-gradient(135deg, #e8e0d0 0%, #d4c9a8 100%)" }} />
            <div style={{ padding: "0 16px 16px", marginTop: -22 }}>
              <div style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => activeCompany ? setLocation(`/app/empresa/${activeCompany.id}`) : setLocation("/app/perfil")}>
                <Avatar src={activeAvatar} name={activeName} size={44} bg={activeCompany ? GOLD : "#722f37"} />
              </div>
              <div onClick={() => activeCompany ? setLocation(`/app/empresa/${activeCompany.id}`) : setLocation("/app/perfil")} style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 1, cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}>
                {activeName}
              </div>
              {username && !activeCompany && <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{username}</div>}
              {activeCompany && <div style={{ fontSize: 12, color: GOLD, fontWeight: 600, marginBottom: 10 }}>Página empresarial ✦</div>}

              {/* Stats */}
              {!activeCompany && (
                <div style={{ display: "flex", borderTop: `1px solid ${BORDER}`, paddingTop: 10, gap: 0 }}>
                  {[
                    { label: "Conexões", value: stats.connections, onClick: openConnections },
                    { label: "Seguidores", value: stats.followers, onClick: openFollowers },
                    { label: "Seguindo", value: stats.following, onClick: openFollowing },
                  ].map((s, i) => (
                    <div key={s.label} onClick={s.onClick} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? `1px solid ${BORDER}` : "none", cursor: "pointer", padding: "4px 0", borderRadius: 6, transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = `${GOLD}15`)}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {activeCompany && (
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
                  <button onClick={() => setLocation(`/app/empresa/${activeCompany.id}`)} style={{ width: "100%", padding: "7px 0", border: `1px solid ${GOLD}60`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: GOLD, background: `${GOLD}10`, cursor: "pointer", fontFamily: "inherit" }}>
                    Ver Perfil da Empresa
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Nav + Criar publicação */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "8px 0", marginBottom: 12 }}>
            {currentNavItems.map((item) => {
              const active = isActive(location, item.path);
              return (
                <button key={item.path} onClick={() => setLocation(item.path)} style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px",
                  background: active ? `${GOLD}12` : "none", border: "none", cursor: "pointer",
                  color: active ? GOLD : NAVY, fontSize: 14, fontWeight: active ? 700 : 500,
                  borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
                  textAlign: "left", transition: "all 0.12s",
                }}>
                  <span style={{ opacity: active ? 1 : 0.55, flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                  {active && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", backgroundColor: GOLD }} />}
                </button>
              );
            })}
            <div style={{ padding: "10px 12px 8px" }}>
              <button onClick={() => setShowCreateModal(true)} style={{
                width: "100%", padding: "11px 0", backgroundColor: GOLD, color: NAVY,
                fontWeight: 800, fontSize: 14, border: "none", borderRadius: 10, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <span style={{ fontSize: 16 }}>+</span> {activeCompany ? "Publicar como Empresa" : "Criar publicação"}
              </button>
            </div>
          </div>

          {/* Bottom links - only in personal mode */}
          {!activeCompany && (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "4px 0" }}>
              {[
                { label: "Itens salvos",        icon: I.save,     path: "/app/salvos" },
                { label: "Ranking de Vinho",    icon: I.star,     path: "/app/ranking-vinho" },
                { label: "Buscar pessoas",      icon: I.search,   path: "/app/busca" },
                { label: "Conexões",            icon: I.group,    path: "/app/conexoes" },
                { label: "Analytics",           icon: "📊",       path: "/app/analytics" },
                { label: "Indicações",          icon: "🎁",       path: "/app/indicacoes" },
                { label: "Meus Eventos",        icon: "📅",       path: "/app/meus-eventos" },
                { label: "Certificações",       icon: "🏅",       path: "/app/certificacoes" },
                { label: "Usuários Bloqueados", icon: "🚫",       path: "/app/bloqueados" },
                { label: "Configurações",       icon: I.settings,  path: "/minha-conta" },
              ].map(({ label, icon, path }) => (
                <button key={label} onClick={() => setLocation(path)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: MUTED, textAlign: "left" }}>
                  {icon}{label}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── Main ─────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>

      {/* Global CreatePost Modal */}
      {showCreateModal && profile && (
        <CreatePostModal
          profile={profile}
          userId={userId}
          companyPageId={activeCompany?.id ?? null}
          companyName={activeCompany?.name ?? null}
          companyAvatar={activeCompany?.avatar_url ?? null}
          onClose={() => setShowCreateModal(false)}
          onCreated={handlePostCreated}
        />
      )}

      {/* People List Modal */}
      {peopleModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPeopleModal(null)}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, minWidth: 340, maxWidth: 440, maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{peopleModal.title}</span>
              <button onClick={() => setPeopleModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20 }}>×</button>
            </div>
            {peopleModal.list.length === 0 ? (
              <div style={{ textAlign: "center", color: MUTED, fontSize: 14, padding: "24px 0" }}>Nenhuma pessoa encontrada.</div>
            ) : (
              <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                {peopleModal.list.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar src={p.avatar_url} name={p.full_name} size={40} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{p.full_name}</div>
                      {p.headline && <div style={{ fontSize: 12, color: MUTED }}>{p.headline}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click-away overlay */}
      {userMenuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setUserMenuOpen(false)} />
      )}
    </div>
  );
}
