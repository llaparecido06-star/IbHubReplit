import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { supabase } from "@/lib/supabase";
import {
  MARKET_FALLBACK, MarketOverview, Period, fetchMarketOverview,
  fetchMarketPresentations, fetchAllMarketPresentations,
  upsertMarketPresentation, deleteMarketPresentation, triggerPresentationAccess,
  fetchPresentationSlides, PresentationSlide, MarketPresentation,
  MarketPost, MarketComment, MarketPollOption,
  fetchMarketPosts, createMarketPost, toggleMarketPostLike,
  fetchMarketComments, addMarketComment, uploadMarketPostImage,
  uploadMarketPostVideo, voteOnMarketPoll,
} from "@/services/api";
import { formatRelativeDate as timeAgo } from "@/utils/dateUtils";

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

const BLANK_PRES = { title: "", description: "", cover_url: "", content_url: "", published: true };

function ApresentacoesPanel({ isAdmin }: { isAdmin: boolean }) {
  const [presentations, setPresentations] = useState<MarketPresentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partial<MarketPresentation> | null>(null);
  const [form, setForm] = useState(BLANK_PRES);
  const [saving, setSaving] = useState(false);
  const [accessingId, setAccessingId] = useState<string | null>(null);
  const [blockedId, setBlockedId] = useState<string | null>(null);
  const [viewingPresentation, setViewingPresentation] = useState<MarketPresentation | null>(null);
  const [viewSlides, setViewSlides] = useState<PresentationSlide[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const reload = () => {
    const fetch = isAdmin ? fetchAllMarketPresentations : fetchMarketPresentations;
    fetch().then(data => { setPresentations(data); setLoading(false); });
  };

  useEffect(() => { reload(); }, [isAdmin]);

  const openNew = () => { setEditing(null); setForm(BLANK_PRES); setShowForm(true); };
  const openEdit = (p: MarketPresentation) => {
    setEditing(p);
    setForm({ title: p.title, description: p.description ?? "", cover_url: p.cover_url ?? "", content_url: p.content_url, published: p.published });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content_url.trim()) return;
    setSaving(true);
    await upsertMarketPresentation({ ...(editing?.id ? { id: editing.id } : {}), ...form });
    setSaving(false);
    setShowForm(false);
    setLoading(true);
    reload();
  };

  const handleDelete = async (p: MarketPresentation) => {
    if (!window.confirm(`Excluir "${p.title}"?`)) return;
    await deleteMarketPresentation(p.id);
    setPresentations(prev => prev.filter(x => x.id !== p.id));
  };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: MUTED }}>⏳ Carregando apresentações…</div>;

  return (
    <div>
      {/* Admin toolbar */}
      {isAdmin && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: MUTED }}>
            {presentations.length} apresentação{presentations.length !== 1 ? "ões" : ""} (publicadas + rascunhos)
          </div>
          <button
            onClick={openNew}
            style={{ padding: "9px 20px", borderRadius: 10, backgroundColor: GOLD, border: "none", color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}
          >
            ＋ Nova apresentação
          </button>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ backgroundColor: WHITE, borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: "0 0 20px" }}>{editing ? "Editar apresentação" : "Nova apresentação"}</h3>
            {(["title", "description", "cover_url", "content_url"] as const).map((field) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 4 }}>
                  {field === "title" ? "Título *" : field === "description" ? "Descrição" : field === "cover_url" ? "URL da capa" : "URL do conteúdo *"}
                </label>
                {field === "description" ? (
                  <textarea
                    value={(form as any)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    rows={3}
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                    placeholder="Descrição da apresentação…"
                  />
                ) : (
                  <input
                    value={(form as any)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                    placeholder={field === "content_url" ? "https://…" : field === "cover_url" ? "https://…" : "Título da apresentação"}
                  />
                )}
              </div>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NAVY, marginBottom: 20, cursor: "pointer" }}>
              <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} />
              Publicada (visível para usuários)
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "9px 20px", borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title.trim() || !form.content_url.trim() || saving}
                style={{ padding: "9px 20px", borderRadius: 8, backgroundColor: GOLD, border: "none", color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: (!form.title.trim() || !form.content_url.trim() || saving) ? 0.6 : 1, fontFamily: "inherit" }}
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {presentations.length === 0 && (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Nenhuma apresentação disponível</h3>
          <p style={{ fontSize: 14, color: MUTED }}>As apresentações publicadas aparecerão aqui</p>
        </div>
      )}

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {presentations.map(p => (
          <div key={p.id} style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", opacity: !p.published ? 0.65 : 1 }}>
            {p.cover_url ? (
              <img src={p.cover_url} alt={p.title} style={{ width: "100%", height: 140, objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: 140, backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📊</div>
            )}
            <div style={{ padding: "14px 16px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: 0, lineHeight: 1.4, flex: 1 }}>{p.title}</h3>
                {isAdmin && !p.published && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, backgroundColor: "#f3f4f6", borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}>Rascunho</span>
                )}
              </div>
              {p.description && <p style={{ fontSize: 12, color: MUTED, margin: "0 0 12px", lineHeight: 1.5 }}>{p.description.slice(0, 80)}{p.description.length > 80 ? "…" : ""}</p>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: MUTED }}>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {isAdmin && (
                    <>
                      <button onClick={() => openEdit(p)} style={{ fontSize: 12, fontWeight: 600, color: GOLD, background: "none", border: `1px solid ${GOLD}40`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                        ✏️ Editar
                      </button>
                      <button onClick={() => handleDelete(p)} style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", background: "none", border: "1px solid #fca5a540", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                        🗑️
                      </button>
                    </>
                  )}
                  {p.content_url && (
                    blockedId === p.id ? (
                      <span
                        onClick={() => setBlockedId(null)}
                        style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 7, padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                        title="Clique para fechar"
                      >
                        🔒 Plano necessário
                      </span>
                    ) : (
                      <button
                        disabled={accessingId === p.id}
                        onClick={async () => {
                          setBlockedId(null);
                          setAccessingId(p.id);
                          try {
                            const result = await triggerPresentationAccess(p.id);
                            if (!result.ok) {
                              setBlockedId(p.id);
                              return;
                            }
                            setViewingPresentation(p);
                            setViewSlides([]);
                            setViewLoading(true);
                            const data = await fetchPresentationSlides(p.id);
                            setViewSlides(data?.slides ?? []);
                            setViewLoading(false);
                          } finally {
                            setAccessingId(null);
                          }
                        }}
                        style={{ fontSize: 12, fontWeight: 700, color: GOLD, background: "none", border: `1px solid ${GOLD}50`, borderRadius: 7, padding: "5px 12px", cursor: accessingId === p.id ? "default" : "pointer", fontFamily: "inherit", opacity: accessingId === p.id ? 0.6 : 1 }}
                      >
                        {accessingId === p.id ? "…" : "Ver →"}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Slide Viewer Modal */}
      {viewingPresentation && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setViewingPresentation(null); } }}
        >
          <div style={{ backgroundColor: WHITE, borderRadius: 18, width: "100%", maxWidth: 720, boxShadow: "0 12px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${BORDER}` }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: NAVY }}>{viewingPresentation.title}</h2>
                {!viewLoading && <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>{viewSlides.filter(s => !s.locked).length} de {viewSlides.length} slides desbloqueados</p>}
              </div>
              <button onClick={() => setViewingPresentation(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: MUTED, lineHeight: 1 }}>×</button>
            </div>
            {/* Content */}
            <div style={{ padding: 24 }}>
              {viewLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #c9a84c", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : viewSlides.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <p style={{ fontSize: 14 }}>Nenhum slide disponível nesta apresentação.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                  {viewSlides.map((slide) => (
                    <div key={slide.slide_id} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDER}`, position: "relative" }}>
                      {slide.locked ? (
                        <div style={{ width: "100%", aspectRatio: "16/9", backgroundColor: "#f3f4f6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <span style={{ fontSize: 28 }}>🔒</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>Slide {slide.sequence_order}</span>
                          <span style={{ fontSize: 10, color: "#b0b8c4" }}>Desbloqueado em breve</span>
                        </div>
                      ) : slide.url ? (
                        <a href={slide.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
                          <img src={slide.url} alt={`Slide ${slide.sequence_order}`} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                          <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: NAVY, backgroundColor: WHITE }}>Slide {slide.sequence_order} ↗</div>
                        </a>
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "16/9", backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: MUTED }}>
                          Slide {slide.sequence_order}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Ideal.BI Feed ──────────────────────────────────────────────────────── */


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

interface IdealBICompany { id: string; name: string; avatar_url: string | null; }

function MarketPostCard({ post: initialPost, userId, isAdmin, onLikeToggle, idealbiCompany }: { post: MarketPost; userId: string; isAdmin: boolean; onLikeToggle: (id: string, liked: boolean, count: number) => void; idealbiCompany?: IdealBICompany | null }) {
  const [post, setPost] = useState<MarketPost>(initialPost);
  const [showComments, setShowComments] = useState(false);
  const [, setLocation] = useLocation();

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
        <div
          onClick={() => idealbiCompany && setLocation(`/app/empresa/${idealbiCompany.id}`)}
          style={{ cursor: idealbiCompany ? "pointer" : "default", display: "flex", alignItems: "center" }}
        >
          <MarketPostAvatar src={idealbiCompany?.avatar_url ?? post.author?.avatar_url} name={idealbiCompany?.name ?? post.author?.full_name ?? "Ideal.BI"} size={40} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              onClick={() => idealbiCompany && setLocation(`/app/empresa/${idealbiCompany.id}`)}
              style={{ fontSize: 14, fontWeight: 800, color: NAVY, cursor: idealbiCompany ? "pointer" : "default" }}
            >
              {idealbiCompany?.name ?? post.author?.full_name ?? "Ideal.BI"}
            </span>
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

function IdealBIFeed({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { hasFeature } = usePermissions();
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
  const [idealbiCompany, setIdealbiCompany] = useState<IdealBICompany | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const hasAccess = hasFeature("mercado:idealbi") || isAdmin;

  useEffect(() => {
    supabase
      .from("company_pages")
      .select("id, name, avatar_url")
      .eq("name", "Ideal.BI")
      .maybeSingle()
      .then(({ data }) => { if (data) setIdealbiCompany(data as IdealBICompany); });
  }, []);

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    fetchMarketPosts(userId).then(p => { setPosts(p); setLoading(false); });
  }, [userId, hasAccess]);

  useEffect(() => {
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`market_feed_realtime_${uid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "market_posts" }, (payload) => {
        const updated = payload.new as any;
        setPosts(prev => prev.map(p =>
          p.id === updated.id
            ? { ...p, likes_count: updated.likes_count ?? p.likes_count, comments_count: updated.comments_count ?? p.comments_count }
            : p
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

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
            idealbiCompany={idealbiCompany}
          />
        ))
      )}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function MercadoPage() {
  const { profile, user } = useAuth();
  const { hasFeature, isLoading: permLoading } = usePermissions();
  const [period, setPeriod] = useState<Period>("ano");
  const [mainTab, setMainTab] = useState<MercadoTab>("visao");
  const [data, setData] = useState<MarketOverview>(MARKET_FALLBACK.ano);
  const [loading, setLoading] = useState(false);
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

  const isAdmin = profile?.is_admin ?? false;
  const canMarket = (key: string) => isAdmin || hasFeature(`mercado:${key}`);

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
          permLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #c9a84c", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : !hasFeature("mercado:apresentacoes") && !(profile?.is_admin) ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0d1b2a", marginBottom: 8 }}>Apresentações de Mercado</h3>
              <p style={{ fontSize: 14, color: "#7a8494", maxWidth: 400, margin: "0 auto 20px" }}>
                Acesse relatórios e apresentações exclusivos do mercado vitivinícola. Disponível nos planos com acesso ao mercado de dados.
              </p>
              <a href="/assinar" style={{ display: "inline-block", padding: "10px 24px", backgroundColor: "#c9a84c", color: "#0d1b2a", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                Ver Planos
              </a>
            </div>
          ) : (
            <ApresentacoesPanel isAdmin={profile?.is_admin ?? false} />
          )
        ) : mainTab === "idealbi" ? (
          <IdealBIFeed
            userId={user?.id ?? ""}
            isAdmin={profile?.is_admin ?? false}
          />
        ) : loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando dados...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI Cards */}
            {canMarket("kpis") ? (
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
            ) : (
              <div style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 28, textAlign: "center", color: MUTED }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 4 }}>KPIs de Mercado</div>
                <div style={{ fontSize: 13 }}>Disponível em planos com acesso ao mercado de dados.</div>
              </div>
            )}

            {/* Charts */}
            {canMarket("graficos") ? (
              <>
                <div style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ color: GOLD }}>📈</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Exportações × Importações</h3>
                  </div>
                  <AreaChart data={data.chart_area} />
                </div>
                <div style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ color: GOLD }}>📊</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Produção Nacional (Índice)</h3>
                  </div>
                  <BarChart data={data.chart_bar} />
                </div>
              </>
            ) : (
              <div style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 28, textAlign: "center", color: MUTED }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Gráficos</div>
                <div style={{ fontSize: 13 }}>Disponível em planos com acesso ao mercado de dados.</div>
              </div>
            )}

            {/* Tendências */}
            {canMarket("tendencias") ? (
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
            ) : (
              <div style={{ backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14, padding: 28, textAlign: "center", color: MUTED }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Tendências do Período</div>
                <div style={{ fontSize: 13 }}>Disponível em planos com acesso ao mercado de dados.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
