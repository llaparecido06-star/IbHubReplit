import React, { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  MARKET_FALLBACK, MarketOverview, Period, fetchMarketOverview,
  fetchMarketPresentations, MarketPresentation,
  MarketPost, MarketComment, MarketPollOption,
  fetchMarketPosts, createMarketPost, toggleMarketPostLike,
  fetchMarketComments, addMarketComment, uploadMarketPostImage,
  uploadMarketPostVideo, voteOnMarketPoll, fetchPlanFeatures,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const MUTED  = "#7a8494";
const BORDER = "#e8e8e3";
const WHITE  = "#fff";
const BG     = "#f5f4ef";

type MercadoTab = "visao" | "idealbi" | "apresentacoes";

// ─── Simple SVG charts ────────────────────────────────────────────────────────

function AreaChart({ data }: { data: MarketOverview["chart_area"] }) {
  const W = 520, H = 160;
  const PL = 40, PR = 16, PT = 12, PB = 28;
  const CW = W - PL - PR;
  const CH = H - PT - PB;
  const n = data.labels.length;

  const toX = (i: number) => PL + (i / Math.max(n - 1, 1)) * CW;
  const toY = (v: number) => PT + (1 - v / 100) * CH;

  const expPath = data.exports.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(v)}`).join(" ");
  const impPath = data.imports.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(v)}`).join(" ");
  const impArea = `${impPath} L${toX(n - 1)},${PT + CH} L${PL},${PT + CH} Z`;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        {data.yLabels.map((lbl, i) => {
          const y = PT + (i / (data.yLabels.length - 1)) * CH;
          return (
            <g key={lbl}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e8eaed" strokeWidth={1} />
              <text x={PL - 4} y={y + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{lbl}</text>
            </g>
          );
        })}
        <path d={impArea} fill="rgba(239,68,68,0.12)" />
        <path d={impPath} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
        <path d={expPath} fill="none" stroke={GOLD} strokeWidth={2} strokeLinecap="round" />
        {data.labels.map((lbl, i) => (
          <text key={lbl} x={toX(i)} y={H - 4} fontSize={10} fill="#9ca3af" textAnchor="middle">{lbl}</text>
        ))}
        {data.exports.map((v, i) => (
          <circle key={`exp-${i}`} cx={toX(i)} cy={toY(v)} r={4} fill={GOLD} />
        ))}
        {data.imports.map((v, i) => (
          <circle key={`imp-${i}`} cx={toX(i)} cy={toY(v)} r={4} fill="#ef4444" />
        ))}
      </svg>
      <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}>
          <span style={{ width: 16, height: 3, backgroundColor: GOLD, display: "inline-block", borderRadius: 2 }} />
          Exportações
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}>
          <span style={{ width: 16, height: 3, backgroundColor: "#ef4444", display: "inline-block", borderRadius: 2 }} />
          Importações
        </div>
      </div>
    </div>
  );
}

function BarChart({ data }: { data: MarketOverview["chart_bar"] }) {
  const W = 520, H = 130;
  const PL = 36, PR = 12, PT = 10, PB = 30;
  const CW = W - PL - PR;
  const CH = H - PT - PB;
  const n = data.values.length;
  const barW = Math.min(60, (CW / n) * 0.6);
  const gap = CW / n;

  const xAt = (i: number) => PL + i * gap + (gap - barW) / 2;
  const yTop = (v: number) => PT + (1 - v / 100) * CH;
  const yH   = (v: number) => (v / 100) * CH;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PL} y1={yTop(v)} x2={W - PR} y2={yTop(v)} stroke="#e8eaed" strokeWidth={1} />
            <text x={PL - 4} y={yTop(v) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{v}</text>
          </g>
        ))}
        {data.values.map((v, i) => (
          <g key={i}>
            <rect x={xAt(i)} y={yTop(v)} width={barW} height={Math.max(yH(v), 2)} fill={GOLD} rx={4} />
            <text x={xAt(i) + barW / 2} y={H - 6} fontSize={10} fill="#9ca3af" textAnchor="middle">{data.labels[i]}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─── Apresentações Panel ─────────────────── */
function ApresentacoesPanel() {
  const [presentations, setPresentations] = useState<MarketPresentation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketPresentations().then(data => {
      setPresentations(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60, color: MUTED }}>⏳ Carregando apresentações…</div>;
  }

  if (presentations.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Nenhuma apresentação disponível</h3>
        <p style={{ fontSize: 14, color: MUTED }}>As apresentações publicadas aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {presentations.map(p => (
        <div key={p.id} style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
          {p.cover_url ? (
            <img src={p.cover_url} alt={p.title} style={{ width: "100%", height: 140, objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: 140, backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📊</div>
          )}
          <div style={{ padding: "14px 16px 16px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: "0 0 6px", lineHeight: 1.4 }}>{p.title}</h3>
            {p.description && <p style={{ fontSize: 12, color: MUTED, margin: "0 0 12px", lineHeight: 1.5 }}>{p.description.slice(0, 80)}{p.description.length > 80 ? "…" : ""}</p>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: MUTED }}>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
              <a
                href={p.content_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, color: GOLD, textDecoration: "none", padding: "6px 14px", border: `1px solid ${GOLD}50`, borderRadius: 8 }}
              >
                Ver apresentação →
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Ideal.BI Feed ──────────────────────────────────────────────────────── */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function MarketPostAvatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: NAVY, flexShrink: 0 }}>
      {(name?.[0] ?? "I").toUpperCase()}
    </div>
  );
}

function MarketPostComments({ postId, userId }: { postId: string; userId: string }) {
  const [comments, setComments] = useState<MarketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMarketComments(postId).then(c => { setComments(c); setLoading(false); });
  }, [postId]);

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    const c = await addMarketComment(postId, userId, text.trim());
    if (c) setComments(prev => [...prev, c]);
    setText("");
    setSubmitting(false);
  };

  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 16px", background: "#fafaf8" }}>
      {loading ? (
        <div style={{ fontSize: 12, color: MUTED, padding: "4px 0" }}>Carregando comentários…</div>
      ) : comments.length === 0 ? (
        <div style={{ fontSize: 12, color: MUTED, padding: "4px 0" }}>Nenhum comentário ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 8 }}>
              <MarketPostAvatar src={c.author?.avatar_url} name={c.author?.full_name ?? "U"} size={28} />
              <div style={{ flex: 1, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{c.author?.full_name ?? "Usuário"} </span>
                <span style={{ fontSize: 12, color: "#555" }}>{c.content}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
          placeholder="Escreva um comentário…"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, fontSize: 13, outline: "none", fontFamily: "inherit" }}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || submitting}
          style={{ padding: "8px 16px", borderRadius: 20, backgroundColor: GOLD, border: "none", color: NAVY, fontWeight: 700, fontSize: 13, cursor: text.trim() ? "pointer" : "not-allowed", opacity: text.trim() ? 1 : 0.5, fontFamily: "inherit" }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function PollDisplay({ post, userId, onPollVote }: { post: MarketPost; userId: string; onPollVote: (id: string, opts: MarketPollOption[], voteId: string) => void }) {
  const opts = post.poll_options ?? [];
  const total = opts.reduce((s, o) => s + o.votes_count, 0);
  const [voting, setVoting] = useState(false);

  const handleVote = async (optId: string) => {
    if (voting || post.user_poll_vote === optId) return;
    setVoting(true);
    const updated = await voteOnMarketPoll(post.id, userId, optId);
    if (updated) onPollVote(post.id, updated, optId);
    setVoting(false);
  };

  return (
    <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {opts.map(opt => {
        const pct = total > 0 ? Math.round((opt.votes_count / total) * 100) : 0;
        const voted = post.user_poll_vote === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => handleVote(opt.id)}
            disabled={voting}
            style={{
              position: "relative", overflow: "hidden", width: "100%", textAlign: "left",
              padding: "10px 14px", border: `1.5px solid ${voted ? GOLD : BORDER}`,
              borderRadius: 10, cursor: voting ? "not-allowed" : "pointer",
              background: "transparent", fontFamily: "inherit",
            }}
          >
            <div style={{
              position: "absolute", top: 0, left: 0, height: "100%", width: `${pct}%`,
              backgroundColor: voted ? `${GOLD}28` : "#f0f0ec", borderRadius: 10, transition: "width 0.4s",
            }} />
            <span style={{ position: "relative", fontSize: 13, fontWeight: voted ? 700 : 500, color: voted ? NAVY : "#444" }}>
              {voted ? "✓ " : ""}{opt.text}
            </span>
            {post.user_poll_vote && (
              <span style={{ position: "relative", float: "right", fontSize: 12, fontWeight: 700, color: voted ? GOLD : MUTED }}>
                {pct}%
              </span>
            )}
          </button>
        );
      })}
      <div style={{ fontSize: 11, color: "#aaa" }}>{total} voto{total !== 1 ? "s" : ""}</div>
    </div>
  );
}

function MarketPostCard({ post: initialPost, userId, isAdmin, onLikeToggle }: { post: MarketPost; userId: string; isAdmin: boolean; onLikeToggle: (id: string, liked: boolean, count: number) => void }) {
  const [post, setPost] = useState<MarketPost>(initialPost);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => { setPost(initialPost); }, [initialPost]);

  const handleLike = async () => {
    const newLiked = await toggleMarketPostLike(post.id, userId, post.user_liked);
    const delta = newLiked ? 1 : -1;
    onLikeToggle(post.id, newLiked, post.likes_count + delta);
  };

  const handlePollVote = (id: string, opts: MarketPollOption[], voteId: string) => {
    setPost(p => ({ ...p, poll_options: opts, user_poll_vote: voteId }));
  };

  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
      {/* Author header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 10px" }}>
        <MarketPostAvatar src={post.author?.avatar_url} name={post.author?.full_name ?? "Ideal.BI"} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{post.author?.full_name ?? "Ideal.BI"}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: WHITE, backgroundColor: GOLD, borderRadius: 4, padding: "1px 6px", letterSpacing: 0.3 }}>IDEAL.BI</span>
          </div>
          {post.author?.headline && (
            <div style={{ fontSize: 12, color: MUTED }}>{post.author.headline}</div>
          )}
          <div style={{ fontSize: 11, color: "#aaa" }}>{timeAgo(post.created_at)}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 16px 14px" }}>
        <p style={{ fontSize: 14, color: "#222", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{post.content}</p>
      </div>

      {/* Image */}
      {post.image_url && (
        <img src={post.image_url} alt="conteúdo" style={{ width: "100%", maxHeight: 400, objectFit: "cover" }} />
      )}

      {/* Video */}
      {post.video_url && (
        <video
          src={post.video_url}
          controls
          style={{ width: "100%", maxHeight: 400, backgroundColor: "#000", display: "block" }}
        />
      )}

      {/* Poll */}
      {post.poll_options && post.poll_options.length > 0 && (
        <PollDisplay post={post} userId={userId} onPollVote={handlePollVote} />
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, padding: "10px 12px", borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={handleLike}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
            borderRadius: 20, border: `1px solid ${post.user_liked ? GOLD : BORDER}`,
            backgroundColor: post.user_liked ? `${GOLD}18` : "transparent",
            color: post.user_liked ? GOLD : MUTED,
            fontSize: 13, fontWeight: post.user_liked ? 700 : 500, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
        >
          {post.user_liked ? "🥂" : "🤍"} {post.likes_count > 0 ? post.likes_count : ""} Curtir
        </button>

        <button
          onClick={() => setShowComments(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
            borderRadius: 20, border: `1px solid ${showComments ? GOLD + "60" : BORDER}`,
            backgroundColor: showComments ? `${GOLD}10` : "transparent",
            color: showComments ? GOLD : MUTED,
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
        >
          💬 {post.comments_count > 0 ? post.comments_count : ""} Comentar
        </button>
      </div>

      {/* Comments section */}
      {showComments && <MarketPostComments postId={post.id} userId={userId} />}
    </div>
  );
}

function IdealBIFeed({ userId, isAdmin, planFeatures }: { userId: string; isAdmin: boolean; planFeatures: string[] }) {
  const [posts, setPosts] = useState<MarketPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string | null>(null);
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const hasAccess = planFeatures.includes("mercado:idealbi") || isAdmin;

  useEffect(() => {
    fetchMarketPosts(userId).then(p => { setPosts(p); setLoading(false); });
  }, [userId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImageFile(file);
    setNewVideoFile(null);
    setNewVideoPreview(null);
    const reader = new FileReader();
    reader.onload = ev => setNewImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewVideoFile(file);
    setNewImageFile(null);
    setNewImagePreview(null);
    const url = URL.createObjectURL(file);
    setNewVideoPreview(url);
  };

  const resetForm = () => {
    setCreating(false); setNewContent(""); setNewImageFile(null);
    setNewImagePreview(null); setNewVideoFile(null); setNewVideoPreview(null);
    setPollMode(false); setPollOptions(["", ""]);
  };

  const handleSubmit = async () => {
    if (!newContent.trim() || submitting) return;
    setSubmitting(true);
    let imageUrl: string | null = null;
    let videoUrl: string | null = null;
    let finalPollOptions: MarketPollOption[] | null = null;

    if (newImageFile) imageUrl = await uploadMarketPostImage(newImageFile, userId);
    if (newVideoFile) videoUrl = await uploadMarketPostVideo(newVideoFile, userId);
    if (pollMode) {
      const valid = pollOptions.filter(o => o.trim());
      if (valid.length >= 2) {
        finalPollOptions = valid.map((text, i) => ({ id: `opt_${i}`, text, votes_count: 0 }));
      }
    }

    const post = await createMarketPost(userId, newContent.trim(), imageUrl, videoUrl, finalPollOptions);
    if (post) {
      setPosts(prev => [post, ...prev]);
      resetForm();
    }
    setSubmitting(false);
  };

  const handleLikeToggle = (id: string, liked: boolean, count: number) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, user_liked: liked, likes_count: count } : p));
  };

  if (!hasAccess) {
    return (
      <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
        <h3 style={{ fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 8 }}>Feed Exclusivo Ideal.BI</h3>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 24px" }}>
          Acesse análises exclusivas, informações privilegiadas de mercado e insights estratégicos do setor vitivinícola, publicados pela equipe Ideal.BI.
          Disponível para assinantes.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {[
            { icon: "📊", label: "Análises de mercado" },
            { icon: "🍷", label: "Tendências do setor" },
            { icon: "🌍", label: "Dados de importação/exportação" },
            { icon: "💡", label: "Insights estratégicos" },
          ].map(f => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", backgroundColor: `${GOLD}12`, borderRadius: 20, fontSize: 13, color: NAVY, fontWeight: 600 }}>
              {f.icon} {f.label}
            </div>
          ))}
        </div>
        <button
          onClick={() => window.location.href = "/planos"}
          style={{ padding: "12px 32px", backgroundColor: GOLD, border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, color: NAVY, cursor: "pointer", fontFamily: "inherit" }}
        >
          Ver planos de assinatura →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Admin create post */}
      {isAdmin && (
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              style={{ width: "100%", textAlign: "left", padding: "12px 16px", border: `1px dashed ${GOLD}60`, borderRadius: 10, backgroundColor: `${GOLD}08`, color: MUTED, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              ✏️ Publicar informação de mercado (admin)…
            </button>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 0.5 }}>📡 Publicação Ideal.BI</span>
              </div>
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Escreva a análise ou informação de mercado…"
                rows={4}
                style={{ width: "100%", padding: "12px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />

              {/* Image preview */}
              {newImagePreview && (
                <div style={{ position: "relative", marginTop: 8 }}>
                  <img src={newImagePreview} alt="preview" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 10 }} />
                  <button onClick={() => { setNewImageFile(null); setNewImagePreview(null); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: WHITE, border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              )}

              {/* Video preview */}
              {newVideoPreview && (
                <div style={{ position: "relative", marginTop: 8 }}>
                  <video src={newVideoPreview} controls style={{ width: "100%", maxHeight: 240, borderRadius: 10, backgroundColor: "#000" }} />
                  <button onClick={() => { setNewVideoFile(null); setNewVideoPreview(null); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: WHITE, border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              )}

              {/* Poll builder */}
              {pollMode && (
                <div style={{ marginTop: 12, padding: 14, border: `1px solid ${BORDER}`, borderRadius: 10, background: "#fafaf8" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 10 }}>📊 Opções da enquete</div>
                  {pollOptions.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        value={opt}
                        onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                        placeholder={`Opção ${i + 1}`}
                        style={{ flex: 1, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                      />
                      {pollOptions.length > 2 && (
                        <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} style={{ padding: "0 8px", border: "none", background: "transparent", cursor: "pointer", color: MUTED, fontSize: 16 }}>×</button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 5 && (
                    <button onClick={() => setPollOptions(prev => [...prev, ""])} style={{ marginTop: 4, fontSize: 12, color: GOLD, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                      + Adicionar opção
                    </button>
                  )}
                </div>
              )}

              {/* Toolbar */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => imgRef.current?.click()} style={{ padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, backgroundColor: "transparent", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  🖼 Imagem
                </button>
                <input ref={imgRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
                <button onClick={() => vidRef.current?.click()} style={{ padding: "7px 14px", border: `1px solid ${BORDER}`, borderRadius: 8, backgroundColor: "transparent", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  🎬 Vídeo
                </button>
                <input ref={vidRef} type="file" accept="video/*" onChange={handleVideoChange} style={{ display: "none" }} />
                <button
                  onClick={() => setPollMode(v => !v)}
                  style={{ padding: "7px 14px", border: `1px solid ${pollMode ? GOLD : BORDER}`, borderRadius: 8, backgroundColor: pollMode ? `${GOLD}15` : "transparent", color: pollMode ? GOLD : MUTED, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: pollMode ? 700 : 400 }}
                >
                  📊 Enquete
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={resetForm} style={{ padding: "7px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, backgroundColor: "transparent", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!newContent.trim() || submitting}
                  style={{ padding: "7px 20px", backgroundColor: GOLD, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: NAVY, cursor: newContent.trim() ? "pointer" : "not-allowed", opacity: newContent.trim() ? 1 : 0.5, fontFamily: "inherit" }}
                >
                  {submitting ? "Publicando…" : "Publicar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: MUTED }}>⏳ Carregando feed…</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Nenhuma publicação ainda</h3>
          <p style={{ fontSize: 14, color: MUTED }}>As informações exclusivas de mercado aparecerão aqui.</p>
        </div>
      ) : (
        posts.map(post => (
          <MarketPostCard
            key={post.id}
            post={post}
            userId={userId}
            isAdmin={isAdmin}
            onLikeToggle={handleLikeToggle}
          />
        ))
      )}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function MercadoPage() {
  const { profile, user } = useAuth();
  const [period, setPeriod] = useState<Period>("ano");
  const [mainTab, setMainTab] = useState<MercadoTab>("visao");
  const [data, setData] = useState<MarketOverview>(MARKET_FALLBACK.ano);
  const [loading, setLoading] = useState(false);
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.plan) return;
    fetchPlanFeatures(profile.plan).then(f => setPlanFeatures(f));
  }, [profile?.plan]);

  useEffect(() => {
    if (mainTab !== "visao") return;
    setLoading(true);
    fetchMarketOverview(period).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [period, mainTab]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: "mes", label: "Mês" },
    { key: "trimestre", label: "Trimestre" },
    { key: "ano", label: "Ano" },
  ];

  const TABS: { key: MercadoTab; label: string }[] = [
    { key: "visao",         label: "📊 Visão Geral" },
    { key: "idealbi",       label: "📡 Ideal.BI" },
    { key: "apresentacoes", label: "📋 Apresentações" },
  ];

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: 0 }}>Mercado</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: "4px 0 0" }}>Dados e indicadores do setor vitivinícola brasileiro</p>
          </div>
          {mainTab === "visao" && (
            <div style={{ display: "flex", gap: 6 }}>
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 20,
                    border: `1px solid ${period === p.key ? GOLD : "#e8eaed"}`,
                    backgroundColor: period === p.key ? GOLD : WHITE,
                    color: period === p.key ? WHITE : "#555",
                    fontSize: 13,
                    fontWeight: period === p.key ? 700 : 500,
                    cursor: "pointer",
                  }}
                >{p.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "2px solid #e8eaed", paddingBottom: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setMainTab(t.key)}
              style={{
                background: "none", border: "none",
                padding: "10px 16px",
                borderBottom: mainTab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
                color: mainTab === t.key ? GOLD : "#8a93a2",
                fontWeight: mainTab === t.key ? 700 : 500,
                fontSize: 14, cursor: "pointer",
                marginBottom: -2, transition: "all 0.15s",
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Content */}
        {mainTab === "apresentacoes" ? (
          <ApresentacoesPanel />
        ) : mainTab === "idealbi" ? (
          <IdealBIFeed
            userId={user?.id ?? ""}
            isAdmin={profile?.is_admin ?? false}
            planFeatures={planFeatures}
          />
        ) : loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando dados...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
              {data.kpis.map((kpi) => (
                <div key={kpi.label} style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ width: 42, height: 42, backgroundColor: `${GOLD}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                      {kpi.icon === "Globe" ? "🌍" : kpi.icon === "TrendingUp" ? "📈" : "📊"}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: kpi.change >= 0 ? "#16a34a" : "#dc2626" }}>
                      {kpi.change >= 0 ? "↑" : "↓"} {Math.abs(kpi.change)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#8a93a2" }}>{kpi.label}</div>
                  <div style={{ fontSize: 12, color: "#aaa" }}>{kpi.period}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginTop: 4 }}>{kpi.value}</div>
                  {kpi.source && (
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>Fonte: {kpi.source}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Area Chart */}
            <div style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ color: GOLD }}>📈</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Exportações × Importações</h3>
              </div>
              <AreaChart data={data.chart_area} />
            </div>

            {/* Bar Chart */}
            <div style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ color: GOLD }}>📊</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Produção Nacional (Índice)</h3>
              </div>
              <BarChart data={data.chart_bar} />
            </div>

            {/* Tendências */}
            <div style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span>🔥</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Tendências do Período</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.tendencias.map((t) => (
                  <div key={t.title} style={{ display: "flex", gap: 14, padding: 14, backgroundColor: "#f9fafb", borderRadius: 10 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                      backgroundColor: t.pos ? "#dcfce7" : "#fef2f2",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                    }}>
                      {t.pos ? "📈" : "📉"}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{t.title}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: t.pos ? "#16a34a" : "#dc2626" }}>
                          {t.pos ? "+" : ""}{t.change}%
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "#8a93a2", margin: 0, lineHeight: 1.5 }}>{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
