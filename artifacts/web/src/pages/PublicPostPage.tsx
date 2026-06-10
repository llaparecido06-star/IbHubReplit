import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { fetchPostById, Post } from "@/services/api";
import { WineTastingCardWeb } from "@/pages/AppFeedPage";

function looksLikeWine(content: string): boolean {
  return /^🍷 Degustação:/m.test(content) || (/^⭐/.test(content) && /Pontuação/.test(content));
}

const GOLD  = "#c9a84c";
const NAVY  = "#0d1b2a";
const WHITE = "#ffffff";
const BG    = "#f5f0e8";

function Avatar({ src, name, size = 48 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${GOLD}`, flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: NAVY, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.42, fontWeight: 800,
      color: GOLD, border: `2px solid ${GOLD}`, flexShrink: 0,
    }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

function CadastroModal({ onClose }: { onClose: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: WHITE, borderRadius: "20px 20px 0 0", padding: "32px 24px 40px", width: "100%", maxWidth: 480, boxShadow: "0 -8px 32px rgba(0,0,0,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            IBHUB - A Rede do Vinho
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>
            Conecte-se ao mercado do vinho
          </h2>
          <p style={{ fontSize: 14, color: "#7a8494", margin: 0, lineHeight: 1.5 }}>
            Junte-se à maior rede profissional do vinho do Brasil.
          </p>
        </div>
        <button onClick={() => setLocation("/cadastro")} style={{ width: "100%", padding: "14px 20px", borderRadius: 12, background: GOLD, color: WHITE, fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", marginBottom: 10 }}>
          Criar conta grátis
        </button>
        <button
          onClick={() => {
            sessionStorage.setItem("redirect_after_login", window.location.pathname);
            setLocation("/login");
          }}
          style={{ width: "100%", padding: "14px 20px", borderRadius: 12, background: "transparent", color: NAVY, fontWeight: 600, fontSize: 15, border: "1.5px solid #ddd", cursor: "pointer", marginBottom: 14 }}
        >
          Já tenho conta
        </button>
        <button onClick={onClose} style={{ width: "100%", background: "none", border: "none", color: "#7a8494", fontSize: 13, cursor: "pointer" }}>
          Continuar visitando
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default function PublicPostPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [post, setPost]           = useState<Post | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [appAttempted, setAppAttempted] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPostById(id)
      .then((p) => {
        if (!p) { setNotFound(true); }
        else { setPost(p); }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  // If already logged in, redirect straight to the in-app post view
  useEffect(() => {
    if (authLoading || !id) return;
    if (session) setLocation(`/app/posts/${id}`);
  }, [authLoading, session, id, setLocation]);

  useEffect(() => {
    if (authLoading || loading) return;
    if (session) return;
    const t = setTimeout(() => setShowModal(true), 4000);
    return () => clearTimeout(t);
  }, [authLoading, loading, session]);

  // Try deep link on mobile (once)
  useEffect(() => {
    if (!id || appAttempted) return;
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    if (!isAndroid && !isIOS) return;
    setAppAttempted(true);
    if (isAndroid) {
      // Android Intent URL — opens the app if installed, stays in browser otherwise
      window.location.href = `intent://post/${id}#Intent;scheme=ibhub;package=br.com.ibhub;end`;
    } else {
      // iOS: hidden iframe trick
      const deepLink = `ibhub://post/${id}`;
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = deepLink;
      document.body.appendChild(iframe);
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }
  }, [id, appAttempted]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid rgba(201,168,76,0.2)`, borderTopColor: GOLD, animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>🍷</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: 0 }}>Publicação não encontrada</h2>
        <p style={{ color: "#7a8494", fontSize: 14, margin: 0 }}>Esse post pode ter sido removido.</p>
        <button
          onClick={() => setLocation("/cadastro")}
          style={{ marginTop: 8, padding: "12px 28px", borderRadius: 10, background: GOLD, color: WHITE, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
        >
          Criar minha conta
        </button>
      </div>
    );
  }

  const authorName = post.author?.full_name ?? "Usuário";

  return (
    <>
      {showModal && <CadastroModal onClose={() => setShowModal(false)} />}

      <div style={{ minHeight: "100vh", background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {/* Top bar */}
        <div style={{ background: NAVY, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img
            src={`${import.meta.env.BASE_URL}logo-ibhub.png`}
            alt="ibhub"
            style={{ height: 34, objectFit: "contain", display: "block" }}
          />
          {!session && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  sessionStorage.setItem("redirect_after_login", window.location.pathname);
                  setLocation("/login");
                }}
                style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", color: WHITE, fontWeight: 600, fontSize: 13, border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}
              >
                Entrar
              </button>
              <button onClick={() => setLocation("/cadastro")} style={{ padding: "7px 14px", borderRadius: 8, background: GOLD, color: WHITE, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
                Cadastrar
              </button>
            </div>
          )}
        </div>

        <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 80px" }}>
          {/* Post card */}
          <div style={{ background: WHITE, borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            {/* Author header */}
            <div style={{ padding: "16px 20px", display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid #f0ece4" }}>
              <Avatar src={post.author?.avatar_url} name={authorName} size={48} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>{authorName}</div>
                {post.author?.headline && (
                  <div style={{ fontSize: 12, color: "#7a8494", marginTop: 2 }}>{post.author.headline}</div>
                )}
                {post.created_at && (
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{formatDate(post.created_at)}</div>
                )}
              </div>
            </div>

            {/* Post content */}
            <div style={{ padding: "16px 20px" }}>
              {looksLikeWine(post.content) ? (
                <WineTastingCardWeb content={post.content} />
              ) : (
                <p style={{ fontSize: 15, color: NAVY, lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {post.content}
                </p>
              )}
            </div>

            {/* Image */}
            {post.image_url && (
              <div style={{ padding: "0 20px 16px" }}>
                <img src={post.image_url} alt="" style={{ width: "100%", height: "auto", maxHeight: 640, objectFit: "contain", display: "block", backgroundColor: "#f2f3f5", borderRadius: 12 }} />
              </div>
            )}

            {/* Stats footer */}
            {(post.likes_count > 0 || post.comments_count > 0) && (
              <div style={{ padding: "12px 20px", borderTop: "1px solid #f0ece4", display: "flex", gap: 20 }}>
                {post.likes_count > 0 && (
                  <span style={{ fontSize: 13, color: "#7a8494" }}>❤️ {post.likes_count}</span>
                )}
                {post.comments_count > 0 && (
                  <span style={{ fontSize: 13, color: "#7a8494" }}>💬 {post.comments_count} comentário{post.comments_count !== 1 ? "s" : ""}</span>
                )}
              </div>
            )}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 16, background: WHITE, borderRadius: 14, padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#374151", marginBottom: 14, lineHeight: 1.5 }}>
              Veja mais publicações e conecte-se com profissionais do vinho na ibhub
            </div>
            <button
              onClick={() => {
                const isAndroid = /Android/i.test(navigator.userAgent);
                if (isAndroid) {
                  window.location.href = `intent://post/${id}#Intent;scheme=ibhub;package=br.com.ibhub;end`;
                } else {
                  window.location.href = `ibhub://post/${id}`;
                }
              }}
              style={{ display: "block", width: "100%", padding: "13px 20px", borderRadius: 11, background: GOLD, color: WHITE, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", marginBottom: 10 }}
            >
              Abrir no app ibhub
            </button>
            {!session ? (
              <button
                onClick={() => setLocation("/cadastro")}
                style={{ width: "100%", padding: "12px 20px", borderRadius: 11, background: "transparent", color: NAVY, fontWeight: 600, fontSize: 14, border: "1.5px solid #ddd", cursor: "pointer" }}
              >
                Criar conta grátis
              </button>
            ) : (
              <button
                onClick={() => setLocation(`/app/posts/${id}`)}
                style={{ width: "100%", padding: "12px 20px", borderRadius: 11, background: "transparent", color: NAVY, fontWeight: 600, fontSize: 14, border: "1.5px solid #ddd", cursor: "pointer" }}
              >
                Ver publicação completa
              </button>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 28, color: "#aaa", fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: GOLD }}>ibhub</span> — Rede do Vinho · Brasil
          </div>
        </div>
      </div>
    </>
  );
}
