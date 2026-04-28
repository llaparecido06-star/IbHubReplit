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
  uploadWebPostImage,
  uploadWebPostVideo,
  addWineEntry,
  fetchWebNotifications,
  markWebNotificationRead,
  markAllWebNotificationsRead,
  WebNotification,
  Poll,
  sendMentionNotifications,
} from "@/services/api";
import { MentionTextArea } from "@/components/MentionTextArea";

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
  calendar:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  award:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
  block:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  gift:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  trending:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  bell:      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  search:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
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

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return width;
}

function isActive(current: string, path: string) {
  if (path === "/app") return current === "/app" || current === "/app/";
  return current.startsWith(path);
}

function Avatar({ src, name, size = 36, bg = "#722f37" }: { src?: string | null; name: string; size?: number; bg?: string }) {
  const [imgError, setImgError] = React.useState(false);
  const fallback = (
    <div style={{
      width: size, height: size, borderRadius: "50%", backgroundColor: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0,
    }}>
      {(name?.[0] ?? "U").toUpperCase()}
    </div>
  );
  if (src && !imgError) {
    return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={() => setImgError(true)} />;
  }
  return fallback;
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
  const isMobile = useWindowWidth() < 768;
  const [tab, setTab]           = useState<PostTab>("texto");
  const [content, setContent]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Foto (shared between foto tab and vinho tab)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Wine photo (separate picker for vinho tab)
  const [wineImageFile, setWineImageFile] = useState<File | null>(null);
  const [wineImagePreview, setWineImagePreview] = useState<string | null>(null);
  const wineImgInputRef = useRef<HTMLInputElement>(null);

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
  const POLL_DURATIONS = ["1 dia", "3 dias", "7 dias", "2 semanas"];
  const [pollDuration, setPollDuration] = useState("3 dias");
  const [pollDurationOpen, setPollDurationOpen] = useState(false);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);

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

  const handleWineImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWineImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setWineImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const buildContent = (): string => {
    if (tab === "texto") return content;
    if (tab === "foto")  return content;
    if (tab === "video") return content;
    if (tab === "enquete") return content;

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
    let image_url: string | null = null;
    let video_url: string | null = null;
    if (tab === "foto" && imageFile) {
      image_url = await uploadWebPostImage(imageFile, userId);
      if (!image_url) {
        setSubmitting(false);
        alert("Erro ao enviar imagem. Tente novamente.");
        return;
      }
    }
    if (tab === "vinho" && wineImageFile) {
      image_url = await uploadWebPostImage(wineImageFile, userId);
      if (!image_url) {
        setSubmitting(false);
        alert("Erro ao enviar foto do vinho. Tente novamente.");
        return;
      }
    }
    if (tab === "video" && videoFile) {
      video_url = await uploadWebPostVideo(videoFile, userId);
      if (!video_url) {
        setSubmitting(false);
        alert("Erro ao enviar vídeo. Tente novamente.");
        return;
      }
    }
    let poll: Poll | null = null;
    if (tab === "enquete") {
      const opts = pollOptions.filter(o => o.trim());
      const daysMap: Record<string, number> = { "1 dia": 1, "3 dias": 3, "7 dias": 7, "2 semanas": 14 };
      const days = daysMap[pollDuration] ?? 3;
      const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
      poll = { options: opts.map(t => ({ text: t, votes: 0 })), total_votes: 0, closed: false, expires_at: expiresAt, allow_multiple: pollAllowMultiple };
    }
    const finalContent = buildContent();
    const newPost = await createWebPost({
      user_id: userId,
      content: finalContent,
      image_url: image_url ?? null,
      video_url: video_url ?? null,
      company_page_id: companyPageId ?? null,
      poll,
    });
    if (finalContent.includes("@") && userId) {
      const actorName = companyPageId ? (companyName ?? "Empresa") : (profile.full_name ?? "Usuário");
      sendMentionNotifications(finalContent, userId, actorName, (newPost as any)?.id);
    }
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
      backgroundColor: isMobile ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: isMobile ? "flex-end" : "center",
      justifyContent: "center",
      padding: isMobile ? 0 : "16px",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        backgroundColor: WHITE,
        borderRadius: isMobile ? "16px 16px 0 0" : 16,
        width: "100%",
        maxWidth: isMobile ? "100%" : 560,
        maxHeight: isMobile ? "92vh" : "90vh",
        overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER }} />
          </div>
        )}
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "10px 16px" : "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>Criar publicação</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}>
            {I.x}
          </button>
        </div>

        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "12px 16px 0" : "14px 20px 0" }}>
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
        {(() => {
          const visibleTabs = isMobile ? TABS.filter(t => t.key !== "texto") : TABS;
          return (
            <div style={{
              display: "flex", gap: isMobile ? 6 : 4,
              padding: isMobile ? "12px 16px 0" : "12px 20px 0",
              overflowX: isMobile ? "visible" : "auto",
              scrollbarWidth: "none",
              justifyContent: isMobile ? "center" : "flex-start",
            }}>
              {visibleTabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: isMobile ? "8px 16px" : "6px 14px",
                  borderRadius: 20, fontSize: isMobile ? 13 : 13, fontWeight: tab === t.key ? 700 : 500,
                  border: `1px solid ${tab === t.key ? GOLD : BORDER}`,
                  backgroundColor: tab === t.key ? `${GOLD}15` : WHITE,
                  color: tab === t.key ? GOLD : MUTED, cursor: "pointer", whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                  {t.icon && <span style={{ color: tab === t.key ? GOLD : MUTED }}>{t.icon}</span>}
                  {t.label}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Body */}
        <div style={{ padding: isMobile ? "12px 16px" : "14px 20px" }}>
          {/* Always show text area for texto/foto/video/enquete */}
          {tab !== "vinho" && (
            <>
              <MentionTextArea
                autoFocus={tab === "texto"}
                value={content}
                onChange={setContent}
                placeholder={
                  tab === "texto"   ? "O que está acontecendo no mundo do vinho?" :
                  tab === "foto"    ? "Descreva a foto..." :
                  tab === "video"   ? "Sobre o vídeo..." :
                  "Pergunta da enquete..."
                }
                rows={isMobile ? 5 : 4}
                style={{ fontSize: isMobile ? 16 : 14 }}
              />
              {/* Quick action bar — desktop only (tabs already visible on mobile) */}
              {tab === "texto" && !isMobile && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => setTab("foto")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: WHITE, color: MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {I.image} Foto
                  </button>
                  <button onClick={() => setTab("video")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: WHITE, color: MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {I.video} Vídeo
                  </button>
                  <button onClick={() => setTab("enquete")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: WHITE, color: MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {I.poll} Enquete
                  </button>
                  <button onClick={() => setTab("vinho")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: WHITE, color: MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    🍷 Vinho
                  </button>
                </div>
              )}
            </>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>📊 Opções da enquete</div>
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
              {/* Duration picker */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: MUTED }}>⏱ Duração:</span>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setPollDurationOpen(o => !o)}
                    style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, background: "white", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {pollDuration} <span style={{ fontSize: 10 }}>▾</span>
                  </button>
                  {pollDurationOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, backgroundColor: "white", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 120, marginTop: 2 }}>
                      {POLL_DURATIONS.map(d => (
                        <button key={d} onClick={() => { setPollDuration(d); setPollDurationOpen(false); }}
                          style={{ display: "block", width: "100%", padding: "9px 14px", background: d === pollDuration ? `${GOLD}15` : "none", border: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: d === pollDuration ? GOLD : NAVY, fontWeight: d === pollDuration ? 700 : 400, fontFamily: "inherit" }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Allow multiple toggle */}
              <div
                onClick={() => setPollAllowMultiple(v => !v)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, padding: "10px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, cursor: "pointer", userSelect: "none" }}
              >
                <span style={{ fontSize: 13, color: NAVY }}>Permitir várias respostas</span>
                <div style={{
                  width: 44, height: 24, borderRadius: 12, transition: "background 0.2s",
                  background: pollAllowMultiple ? GOLD : "#d1d5db", position: "relative", flexShrink: 0,
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: pollAllowMultiple ? 22 : 2,
                    width: 20, height: 20, borderRadius: "50%", background: "white",
                    transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Avaliação de Vinho */}
          {tab === "vinho" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Wine photo */}
              <input ref={wineImgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleWineImageChange} />
              {wineImagePreview ? (
                <div style={{ position: "relative" }}>
                  <img src={wineImagePreview} alt="" style={{ width: "100%", borderRadius: 10, maxHeight: 200, objectFit: "cover" }} />
                  <button onClick={() => { setWineImageFile(null); setWineImagePreview(null); }} style={{
                    position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", border: "none",
                    borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: WHITE, fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>×</button>
                </div>
              ) : (
                <button onClick={() => wineImgInputRef.current?.click()} style={{
                  width: "100%", padding: "18px 0", backgroundColor: BG, border: `2px dashed ${BORDER}`,
                  borderRadius: 10, cursor: "pointer", fontSize: 13, color: MUTED, fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  📸 Adicionar foto do rótulo (opcional)
                </button>
              )}
              {/* Nome do vinho */}
              <input value={wineName} onChange={e => setWineName(e.target.value)} placeholder="Nome do vinho *" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: isMobile ? 16 : 14, outline: "none", fontFamily: "inherit" }} />
              {/* Uva e Safra */}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={wineGrape} onChange={e => setWineGrape(e.target.value)} placeholder="Uva/Casta" style={{ flex: 3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: isMobile ? 16 : 14, outline: "none", fontFamily: "inherit", minWidth: 0 }} />
                <input value={wineSafra} onChange={e => setWineSafra(e.target.value)} placeholder="Safra" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: isMobile ? 16 : 14, outline: "none", fontFamily: "inherit", minWidth: 0 }} maxLength={4} />
              </div>
              {/* Produtor e País */}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={wineProducer} onChange={e => setWineProducer(e.target.value)} placeholder="Produtor" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: isMobile ? 16 : 14, outline: "none", fontFamily: "inherit", minWidth: 0 }} />
                <input value={wineCountry} onChange={e => setWineCountry(e.target.value)} placeholder="País" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: isMobile ? 16 : 14, outline: "none", fontFamily: "inherit", minWidth: 0 }} />
              </div>
              {/* Região */}
              <input value={wineRegion} onChange={e => setWineRegion(e.target.value)} placeholder="Região (ex: Serra Gaúcha, Douro)" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: isMobile ? 16 : 14, outline: "none", fontFamily: "inherit" }} />
              {/* EAN */}
              <input value={wineEan} onChange={e => setWineEan(e.target.value)} placeholder="🏷️ EAN (opcional — ranking comunitário)" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: isMobile ? 15 : 14, outline: "none", fontFamily: "inherit" }} />
              {/* Pontuação */}
              <div style={{ background: BG, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Pontuação</label>
                  <span style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>{wineScore}/100</span>
                </div>
                <input type="range" min={0} max={100} value={wineScore} onChange={e => setWineScore(Number(e.target.value))}
                  style={{ width: "100%", accentColor: GOLD, height: isMobile ? 6 : 4 }} />
                <div style={{ display: "flex", gap: 4, marginTop: 8, alignItems: "center" }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize: isMobile ? 24 : 20, color: s <= Math.round(wineScore / 20) ? GOLD : "#ddd", lineHeight: 1 }}>⭐</span>
                  ))}
                  <span style={{ fontSize: 12, color: MUTED, marginLeft: 6 }}>
                    {wineScore >= 95 ? "🏆 Lendário" : wineScore >= 90 ? "✨ Excelente" : wineScore >= 85 ? "👍 Muito bom" : wineScore >= 80 ? "🙂 Bom" : "Regular"}
                  </span>
                </div>
              </div>
              {/* Notas */}
              <textarea value={wineNotes} onChange={e => setWineNotes(e.target.value)} placeholder="Notas de degustação, aromas, sabores, harmonização..." rows={3} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: isMobile ? 15 : 14, outline: "none", resize: "none", fontFamily: "inherit" }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: isMobile ? "12px 16px 20px" : "12px 20px", borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: isMobile ? "11px 20px" : "9px 20px", fontSize: 14, fontWeight: 600, color: MUTED, cursor: "pointer" }}>Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || submitting}
            style={{
              backgroundColor: canSubmit() ? GOLD : `${GOLD}55`,
              color: NAVY, fontWeight: 800, fontSize: 14, border: "none",
              borderRadius: 8, padding: isMobile ? "11px 32px" : "9px 28px",
              cursor: canSubmit() ? "pointer" : "default", flex: isMobile ? 1 : undefined,
              fontFamily: "inherit",
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
  const isMobile = useWindowWidth() < 768;
  const [userMenuOpen, setUserMenuOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const [peopleModal, setPeopleModal] = useState<{ title: string; list: ProfilePerson[] } | null>(null);

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Usuário";
  const username    = profile?.username ? `@${profile.username}` : "";
  const userId      = profile?.id ?? user?.id ?? "";

  const [notifItems, setNotifItems] = useState<WebNotification[]>([]);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifItems.filter(n => !n.read).length;

  const loadNotifs = useCallback(async () => {
    if (!userId) return;
    setNotifLoading(true);
    const data = await fetchWebNotifications(userId);
    setNotifItems(data);
    setNotifLoading(false);
  }, [userId]);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  useEffect(() => {
    if (!notifOpen) return;
    const handle = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [notifOpen]);

  const handleMarkAllRead = async () => {
    if (!userId) return;
    setNotifItems(prev => prev.map(n => ({ ...n, read: true })));
    await markAllWebNotificationsRead(userId);
  };

  const handleNotifRead = async (notif: WebNotification) => {
    if (!notif.read) {
      setNotifItems(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      await markWebNotificationRead(notif.id);
    }
    if (notif.post_id) setLocation("/app");
    else if (notif.type === "connection" && notif.actor?.id) setLocation(`/app/usuario/${notif.actor.id}`);
    else setLocation("/app/notificacoes");
    setNotifOpen(false);
  };

  useEffect(() => {
    if (!userId) return;
    fetchProfileStats(userId).then(setStats);
    fetchWebCompanyPages(userId).then(setCompanyPages);
  }, [userId]);

  const handleSignOut = async () => {
    await signOut();
    // Navigation is handled by PrivateRoute's useEffect after session clears in React state
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
    <div style={{ minHeight: "100vh", backgroundColor: isMobile ? "#f2f3f5" : BG, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* ── Top bar ────────────────────────── */}
      <header style={{
        backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`,
        position: "sticky", top: 0, zIndex: 200, height: 56,
        display: "flex", alignItems: "center",
        padding: isMobile ? "0 12px" : "0 24px",
        gap: isMobile ? 8 : 16,
      }}>
        <img src={`${import.meta.env.BASE_URL}logo-ibhub.png`} alt="ibhub" onClick={() => setLocation("/app")} style={{ height: 28, cursor: "pointer", flexShrink: 0, objectFit: "contain" }} />

        {!isMobile && (
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
        )}

        <div style={{ flex: 1 }} />

        {isMobile && (
          <button onClick={() => setLocation("/app/busca")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", alignItems: "center", padding: 6 }} title="Buscar">{I.search}</button>
        )}

        {!isMobile && profile?.is_admin && (
          <button onClick={() => setLocation("/admin")} style={{ background: "none", border: `1px solid ${GOLD}55`, borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 700, color: GOLD, cursor: "pointer" }}>⚙ Admin</button>
        )}

        {/* ── Notification Bell ── */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setNotifOpen(o => !o); if (!notifOpen) loadNotifs(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: notifOpen ? GOLD : MUTED, display: "flex", alignItems: "center", padding: 4, position: "relative" }}
            title="Notificações"
          >
            {I.bell}
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -1, right: -1,
                background: "#e74c3c", color: WHITE,
                borderRadius: "50%", minWidth: 16, height: 16,
                fontSize: 10, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${WHITE}`, lineHeight: 1,
                padding: unreadCount > 9 ? "0 3px" : "0",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {notifOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 10px)",
              width: 360, maxWidth: "calc(100vw - 24px)",
              backgroundColor: WHITE, border: `1px solid ${BORDER}`,
              borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
              zIndex: 400, overflow: "hidden",
            }}>
              {/* Panel header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>
                  Notificações
                  {unreadCount > 0 && (
                    <span style={{ marginLeft: 8, background: GOLD, color: WHITE, borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "2px 7px" }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                    Marcar lidas
                  </button>
                )}
              </div>

              {/* List */}
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {notifLoading ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: MUTED, fontSize: 13 }}>Carregando…</div>
                ) : notifItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                    <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Tudo em dia!</p>
                  </div>
                ) : notifItems.slice(0, 8).map(n => {
                  const typeColors: Record<string, string> = {
                    like: "#e74c3c", comment: "#3498db", comment_reply: "#8b5cf6",
                    follow: "#2ecc71", connection: GOLD, mention: "#9b59b6",
                  };
                  const typeEmojis: Record<string, string> = {
                    like: "❤️", comment: "💬", comment_reply: "↩️",
                    follow: "➕", connection: "🤝", mention: "@",
                  };
                  const typeLabels: Record<string, string> = {
                    like: "curtiu sua publicação",
                    comment: "comentou na sua publicação",
                    comment_reply: "respondeu seu comentário",
                    follow: "começou a seguir você",
                    connection: "enviou pedido de conexão",
                    mention: "mencionou você",
                  };
                  const actorName = n.actor?.full_name ?? "Alguém";
                  const emoji = typeEmojis[n.type] ?? "🔔";
                  const label = n.message ?? typeLabels[n.type] ?? "nova notificação";
                  const bgColor = typeColors[n.type] ?? GOLD;
                  const timeDiff = () => {
                    const mins = Math.floor((Date.now() - new Date(n.created_at).getTime()) / 60000);
                    if (mins < 1) return "agora";
                    if (mins < 60) return `${mins}m`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `${hrs}h`;
                    return `${Math.floor(hrs / 24)}d`;
                  };
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotifRead(n)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
                        background: n.read ? WHITE : `${GOLD}0d`,
                        borderBottom: `1px solid ${BORDER}`,
                        cursor: "pointer", transition: "background 0.12s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8f7f3")}
                      onMouseLeave={e => (e.currentTarget.style.background = n.read ? WHITE : `${GOLD}0d`)}
                    >
                      {/* Avatar + emoji badge */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        {n.actor?.avatar_url ? (
                          <img src={n.actor.avatar_url} alt={actorName} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: NAVY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>
                            {actorName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ position: "absolute", bottom: -2, right: -2, background: bgColor, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: `2px solid ${WHITE}` }}>
                          {emoji}
                        </span>
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: NAVY, lineHeight: 1.4 }}>
                          <strong>{actorName}</strong> {label}
                        </p>
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: MUTED }}>{timeDiff()}</p>
                      </div>

                      {/* Unread dot */}
                      {!n.read && (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer link */}
              <div style={{ borderTop: `1px solid ${BORDER}`, padding: "10px 16px", textAlign: "center" }}>
                <button
                  onClick={() => { setNotifOpen(false); setLocation("/app/notificacoes"); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}
                >
                  Ver todas as notificações →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Create post (mobile gold + button) ── */}
        {isMobile && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              width: 34, height: 34, borderRadius: "50%",
              backgroundColor: GOLD, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(201,168,76,0.4)",
            }}
            title="Criar publicação"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}

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
      <div style={{ display: "flex", maxWidth: 1180, margin: "0 auto", padding: isMobile ? "12px 0 0" : "20px 16px", gap: 20, alignItems: "flex-start" }}>

        {/* ── Sidebar ──────────────────────── */}
        {!isMobile && (
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
          {(() => {
            const navBg: Record<string, string> = {
              "/app":               "#c9a84c20",
              "/app/mercado":       "#26a69a20",
              "/app/oportunidades": "#4a90d920",
              "/app/mensagens":     "#7c4dff20",
              "/app/grupos":        "#00bcd420",
              "/app/adega":         "#72293720",
              "/app/notificacoes":  "#e67e2220",
            };
            return (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ padding: "10px 14px 2px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    {activeCompany ? "Empresa" : "Navegar"}
                  </span>
                </div>
                <div style={{ padding: "2px 0 4px" }}>
                  {currentNavItems.map((item) => {
                    const active = isActive(location, item.path);
                    const iconBg = navBg[item.path] ?? "#c9a84c20";
                    return (
                      <button key={item.path} onClick={() => setLocation(item.path)} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", padding: "6px 14px",
                        background: active ? `${GOLD}10` : "none",
                        border: "none", cursor: "pointer", textAlign: "left",
                        transition: "background 0.12s",
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = BG; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "none"; }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          backgroundColor: active ? `${GOLD}25` : iconBg,
                          color: active ? GOLD : NAVY,
                          transition: "background 0.12s",
                        }}>
                          {item.icon}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? GOLD : NAVY, flex: 1, lineHeight: 1.2 }}>
                          {item.label}
                        </span>
                        {active && <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: GOLD, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding: "4px 10px 10px" }}>
                  <button onClick={() => setShowCreateModal(true)} style={{
                    width: "100%", padding: "10px 0", backgroundColor: GOLD, color: NAVY,
                    fontWeight: 800, fontSize: 13, border: "none", borderRadius: 9, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "opacity 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    <span style={{ fontSize: 16, fontWeight: 900 }}>+</span>
                    {activeCompany ? "Publicar como Empresa" : "Criar publicação"}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Bottom links - only in personal mode */}
          {!activeCompany && (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
              {([
                {
                  section: "Descobrir",
                  color: "#4a90d9",
                  items: [
                    { label: "Itens salvos",     icon: I.save,     path: "/app/salvos",        iconBg: "#4a90d920" },
                    { label: "Ranking de Vinho", icon: I.trending, path: "/app/ranking-vinho", iconBg: "#c9a84c20" },
                    { label: "Buscar pessoas",   icon: I.search,   path: "/app/busca",          iconBg: "#7c4dff20" },
                    { label: "Conexões",         icon: I.group,    path: "/app/conexoes",       iconBg: "#26a69a20" },
                  ],
                },
                {
                  section: "Minha atividade",
                  color: "#e67e22",
                  items: [
                    { label: "Analytics",    icon: I.market,   path: "/app/analytics",    iconBg: "#e67e2220" },
                    { label: "Indicações",   icon: I.gift,     path: "/app/indicacoes",   iconBg: "#e91e6320" },
                    { label: "Meus Eventos", icon: I.calendar, path: "/app/meus-eventos", iconBg: "#00bcd420" },
                    { label: "Certificações",icon: I.award,    path: "/app/certificacoes",iconBg: "#c9a84c20" },
                  ],
                },
                {
                  section: "Conta",
                  color: MUTED,
                  items: [
                    { label: "Usuários Bloqueados", icon: I.block,    path: "/app/bloqueados", iconBg: "#e53e3e20" },
                    { label: "Configurações",       icon: I.settings, path: "/minha-conta",    iconBg: `${NAVY}10`  },
                  ],
                },
              ] as { section: string; color: string; items: { label: string; icon: React.ReactNode; path: string; iconBg: string }[] }[]).map(({ section, color, items }, sIdx) => (
                <div key={section}>
                  {sIdx > 0 && <div style={{ height: 1, backgroundColor: BORDER, margin: "0 14px" }} />}
                  <div style={{ padding: "10px 14px 2px", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 0.8, textTransform: "uppercase" }}>{section}</span>
                  </div>
                  <div style={{ padding: "2px 0 6px" }}>
                    {items.map(({ label, icon, path, iconBg }) => {
                      const active = isActive(location, path);
                      return (
                        <button
                          key={label}
                          onClick={() => setLocation(path)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            width: "100%", padding: "6px 14px",
                            background: active ? `${GOLD}10` : "none",
                            border: "none", cursor: "pointer", textAlign: "left",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.background = BG; }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.background = "none"; }}
                        >
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            backgroundColor: active ? `${GOLD}25` : iconBg,
                            color: active ? GOLD : NAVY,
                            transition: "background 0.12s",
                          }}>
                            {icon}
                          </div>
                          <span style={{
                            fontSize: 13, fontWeight: active ? 700 : 500,
                            color: active ? GOLD : NAVY, flex: 1, lineHeight: 1.2,
                          }}>
                            {label}
                          </span>
                          {active && <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: GOLD, flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
        )}

        {/* ── Main ─────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0, padding: isMobile ? "0 0 70px" : undefined }}>{children}</main>
      </div>

      {/* ── Mobile Bottom Tab Bar ─────────── */}
      {isMobile && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 300,
          height: 62, backgroundColor: WHITE, borderTop: `1px solid ${BORDER}`,
          display: "flex", alignItems: "stretch",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {(activeCompany ? [
            { path: "/app",               label: "Início",        icon: I.home },
            { path: "/app/mensagens",     label: "Chat",          icon: I.msg },
            { path: "/app/oportunidades", label: "Oportunidades", icon: I.brief },
            { path: `/app/empresa/${activeCompany.id}`, label: "Empresa", icon: I.company },
          ] : [
            { path: "/app",               label: "Início",     icon: I.home },
            { path: "/app/mercado",       label: "Mercado",    icon: I.market },
            { path: "/app/mensagens",     label: "Chat",       icon: I.msg },
            { path: "/app/oportunidades", label: "Opor.",      icon: I.brief },
            { path: "/app/perfil",        label: "Perfil",     icon: I.company },
          ]).map(item => {
            const active = isActive(location, item.path);
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 3, paddingTop: 6,
                  background: "none", border: "none", cursor: "pointer",
                  color: active ? GOLD : "#9ca3af",
                  fontSize: 10, fontWeight: 600,
                  transition: "color 0.15s",
                }}
              >
                <span style={{ display: "flex", color: active ? GOLD : "#9ca3af", transition: "color 0.15s" }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

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
