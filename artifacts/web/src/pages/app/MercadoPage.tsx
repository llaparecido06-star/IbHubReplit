import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { supabase, getCachedSession } from "@/lib/supabase";
import {
  MARKET_FALLBACK, MarketOverview, Period, fetchMarketOverview,
  fetchMarketPresentations, fetchAllMarketPresentations,
  upsertMarketPresentation, deleteMarketPresentation, triggerPresentationAccess,
  fetchPresentationSlides, PresentationSlide, MarketPresentation,
  MarketPost, MarketComment, MarketPollOption, MarketReactionType,
  fetchMarketPosts, createMarketPost, toggleMarketPostLike, changeMarketReaction,
  fetchMarketComments, addMarketComment, uploadMarketPostImage,
  uploadMarketPostVideo, voteOnMarketPoll, toggleMarketCommentLike,
  deleteMarketPost, updateMarketPost,
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const unlockedSlides = viewSlides.filter(s => !s.locked);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setLightboxIndex(null); }
      if (e.key === "ArrowRight") { setLightboxIndex(i => i !== null ? Math.min(i + 1, unlockedSlides.length - 1) : null); }
      if (e.key === "ArrowLeft")  { setLightboxIndex(i => i !== null ? Math.max(i - 1, 0) : null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, unlockedSlides.length]);

  const reload = () => {
    const fetch = isAdmin ? fetchAllMarketPresentations : fetchMarketPresentations;
    fetch()
      .then(data => { setPresentations(data); })
      .catch(() => {})
      .finally(() => { setLoading(false); });
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
                  {viewSlides.map((slide) => {
                    const unlockedIdx = unlockedSlides.findIndex(s => s.slide_id === slide.slide_id);
                    return (
                      <div key={slide.slide_id} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${BORDER}`, position: "relative", cursor: slide.locked || !slide.url ? "default" : "pointer" }}
                        onClick={() => { if (!slide.locked && slide.url && unlockedIdx >= 0) setLightboxIndex(unlockedIdx); }}
                      >
                        {slide.locked ? (
                          <div style={{ width: "100%", aspectRatio: "16/9", backgroundColor: "#f3f4f6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <span style={{ fontSize: 28 }}>🔒</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>Slide {slide.sequence_order}</span>
                            <span style={{ fontSize: 10, color: "#b0b8c4" }}>Desbloqueado em breve</span>
                          </div>
                        ) : slide.url ? (
                          <div style={{ position: "relative" }}>
                            <img src={slide.url} alt={`Slide ${slide.sequence_order}`} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block", transition: "filter 0.15s" }}
                              onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.88)")}
                              onMouseLeave={e => (e.currentTarget.style.filter = "none")}
                            />
                            <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: NAVY, backgroundColor: WHITE, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span>Slide {slide.sequence_order}</span>
                              <span style={{ color: GOLD, fontSize: 13 }}>⛶</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ width: "100%", aspectRatio: "16/9", backgroundColor: `${GOLD}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: MUTED }}>
                            Slide {slide.sequence_order}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox fullscreen viewer ── */}
      {lightboxIndex !== null && unlockedSlides[lightboxIndex] && (
        <div
          onClick={() => setLightboxIndex(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 3000,
            backgroundColor: "rgba(0,0,0,0.95)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* Top bar */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, left: 0, right: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px", zIndex: 1,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>{viewingPresentation?.title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                Slide {unlockedSlides[lightboxIndex].sequence_order} · {lightboxIndex + 1} de {unlockedSlides.length}
              </div>
            </div>
            <button
              onClick={() => setLightboxIndex(null)}
              style={{
                background: "rgba(255,255,255,0.12)", border: "none", color: WHITE,
                width: 36, height: 36, borderRadius: "50%", cursor: "pointer",
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            >×</button>
          </div>

          {/* Main image */}
          <img
            src={unlockedSlides[lightboxIndex].url!}
            alt={`Slide ${unlockedSlides[lightboxIndex].sequence_order}`}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "92vw", maxHeight: "82vh",
              objectFit: "contain", borderRadius: 8,
              boxShadow: "0 8px 60px rgba(0,0,0,0.5)",
              userSelect: "none",
            }}
          />

          {/* Prev button */}
          {lightboxIndex > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i ?? 1) - 1); }}
              style={{
                position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.12)", border: "none", color: WHITE,
                width: 44, height: 44, borderRadius: "50%", cursor: "pointer",
                fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            >‹</button>
          )}

          {/* Next button */}
          {lightboxIndex < unlockedSlides.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i ?? 0) + 1); }}
              style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.12)", border: "none", color: WHITE,
                width: 44, height: 44, borderRadius: "50%", cursor: "pointer",
                fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            >›</button>
          )}

          {/* Bottom thumbnails strip */}
          {unlockedSlides.length > 1 && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                display: "flex", gap: 8, padding: "12px 20px", overflowX: "auto",
                scrollbarWidth: "none", justifyContent: "center",
                background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
              }}
            >
              {unlockedSlides.map((s, idx) => (
                <div
                  key={s.slide_id}
                  onClick={() => setLightboxIndex(idx)}
                  style={{
                    flexShrink: 0, width: 72, height: 45, borderRadius: 6, overflow: "hidden",
                    cursor: "pointer", border: idx === lightboxIndex ? `2px solid ${GOLD}` : "2px solid transparent",
                    opacity: idx === lightboxIndex ? 1 : 0.55,
                    transition: "opacity 0.15s, border 0.15s",
                  }}
                  onMouseEnter={e => { if (idx !== lightboxIndex) (e.currentTarget as HTMLDivElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { if (idx !== lightboxIndex) (e.currentTarget as HTMLDivElement).style.opacity = "0.55"; }}
                >
                  <img src={s.url!} alt={`Slide ${s.sequence_order}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Ideal.BI Feed ──────────────────────────────────────────────────────── */


function MarketFeedVideo({ src }: { src: string }) {
  const [aspect, setAspect] = React.useState<number | null>(null);
  const isPortrait = aspect !== null && aspect < 1;
  return (
    <div style={{ background: "#000", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <video
        src={src}
        controls
        playsInline
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
        }}
        style={{
          display: "block",
          width: isPortrait ? "auto" : "100%",
          height: isPortrait ? "min(560px, 80vh)" : "auto",
          maxWidth: "100%",
          maxHeight: isPortrait ? "min(560px, 80vh)" : 380,
          objectFit: "contain",
        }}
      />
    </div>
  );
}

function MarketPostAvatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: NAVY, flexShrink: 0 }}>
      {(name?.[0] ?? "I").toUpperCase()}
    </div>
  );
}

const REACTIONS: { type: MarketReactionType; emoji: string; label: string }[] = [
  { type: "saude",    emoji: "🥂", label: "Saúde!" },
  { type: "bravo",    emoji: "👏", label: "Bravo!" },
  { type: "destaque", emoji: "🌟", label: "Destaque" },
  { type: "incrivel", emoji: "🍷", label: "Incrível" },
];

function reactionEmoji(r?: MarketReactionType | null): string {
  return REACTIONS.find(x => x.type === r)?.emoji ?? "🤍";
}
function reactionLabel(r?: MarketReactionType | null): string {
  return REACTIONS.find(x => x.type === r)?.label ?? "Reagir";
}
function reactionColor(_r?: MarketReactionType | null): string {
  return GOLD;
}
const LikeIcon = ({ filled, color }: { filled: boolean; color?: string }) => {
  const c = color ?? (filled ? GOLD : MUTED);
  return (
    <svg width="18" height="18" fill={filled ? c : "none"} stroke={c} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </svg>
  );
};
const CommentIcon = ({ color }: { color?: string }) => (
  <svg width="18" height="18" fill="none" stroke={color ?? MUTED} strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

function ReactionPicker({ onSelect, onMouseEnter, onMouseLeave }: { onSelect: (r: MarketReactionType) => void; onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "absolute", bottom: "calc(100% + 4px)", left: 0,
        backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 30,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        display: "flex", gap: 4, padding: "6px 10px", zIndex: 99,
      }}>
      {REACTIONS.map(r => (
        <button
          key={r.type}
          onClick={(e) => { e.stopPropagation(); onSelect(r.type); }}
          title={r.label}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 22, padding: "4px 6px", borderRadius: 20,
            transition: "transform 0.12s",
            lineHeight: 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}

function MarketCommentItem({ comment, userId }: { comment: MarketComment; userId: string }) {
  const [, setLocation] = useLocation();
  const [liked, setLiked] = useState((comment as any).is_liked ?? false);
  const [likesCount, setLikesCount] = useState((comment as any).likes_count ?? 0);
  const [toggling, setToggling] = useState(false);
  const goToCommentAuthor = () => {
    if (!comment.author?.id) return;
    comment.author.id === userId ? setLocation("/app/perfil") : setLocation(`/app/usuario/${comment.author.id}`);
  };

  const handleCommentLike = async () => {
    if (toggling || !userId) return;
    setToggling(true);
    const newLiked = await toggleMarketCommentLike(comment.id, userId, liked);
    setLiked(newLiked);
    setLikesCount((c: number) => c + (newLiked ? 1 : -1));
    setToggling(false);
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div onClick={goToCommentAuthor} style={{ cursor: comment.author?.id ? "pointer" : "default", flexShrink: 0 }}>
        <MarketPostAvatar src={comment.author?.avatar_url} name={comment.author?.full_name ?? "U"} size={28} />
      </div>
      <div style={{ flex: 1, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 6px", marginBottom: 3 }}>
          <span onClick={goToCommentAuthor} style={{ fontSize: 12, fontWeight: 700, color: NAVY, cursor: comment.author?.id ? "pointer" : "default" }}>{comment.author?.full_name ?? "Usuário"}</span>
          {comment.author?.position && <span style={{ fontSize: 11, color: MUTED }}>· {comment.author.position}</span>}
          {comment.author?.company && <span style={{ fontSize: 11, color: MUTED }}>· {comment.author.company}</span>}
        </div>
        <span style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>{comment.content}</span>
        <div style={{ marginTop: 6, display: "flex", alignItems: "center" }}>
          <button
            onClick={handleCommentLike}
            style={{
              background: "none", border: "none", cursor: userId ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 4, padding: "2px 6px",
              fontSize: 12, color: liked ? GOLD : MUTED, fontWeight: liked ? 700 : 400, fontFamily: "inherit",
            }}
          >
            {liked ? "❤️" : "🤍"} {likesCount > 0 ? likesCount : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketPostComments({ postId, userId }: { postId: string; userId: string }) {
  const [comments, setComments] = useState<MarketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMarketComments(postId, userId || undefined)
      .then(c => { setComments(c); })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [postId, userId]);

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
            <MarketCommentItem key={c.id} comment={c} userId={userId} />
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

function PollDisplay({ post, userId, onPollVote }: { post: MarketPost; userId: string; onPollVote: (id: string, opts: MarketPollOption[], votes: string[]) => void }) {
  const opts         = post.poll_options ?? [];
  const total        = opts.reduce((s, o) => s + o.votes_count, 0);
  const allowMultiple = post.poll_allow_multiple ?? false;
  const currentVotes  = post.user_poll_votes ?? [];
  const hasVoted      = currentVotes.length > 0;
  const [voting, setVoting] = useState(false);

  const handleVote = async (optId: string) => {
    if (voting) return;
    setVoting(true);
    const result = await voteOnMarketPoll(post.id, userId, optId);
    if (result) onPollVote(post.id, result.poll_options, result.user_poll_votes);
    setVoting(false);
  };

  return (
    <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {allowMultiple && (
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>Múltipla escolha — clique para selecionar/desselecionar</div>
      )}
      {opts.map(opt => {
        const pct   = total > 0 ? Math.round((opt.votes_count / total) * 100) : 0;
        const voted = currentVotes.includes(opt.id);
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
            <span style={{ position: "relative", fontSize: 13, fontWeight: voted ? 700 : 500, color: voted ? NAVY : "#444", display: "flex", alignItems: "center", gap: 9 }}>
              {allowMultiple ? (
                <span style={{
                  flexShrink: 0, width: 17, height: 17, borderRadius: 3,
                  border: `2px solid ${voted ? GOLD : "#b0b8c4"}`,
                  backgroundColor: voted ? GOLD : "transparent",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.18s",
                }}>
                  {voted && <span style={{ color: "#fff", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </span>
              ) : (
                <span style={{
                  flexShrink: 0, width: 17, height: 17, borderRadius: "50%",
                  border: `2px solid ${voted ? GOLD : "#b0b8c4"}`,
                  backgroundColor: voted ? GOLD : "transparent",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.18s",
                }}>
                  {voted && <span style={{ color: "#fff", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </span>
              )}
              {opt.text}
            </span>
            {hasVoted && (
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

function MarketPostCard({ post: initialPost, userId, isAdmin, onLikeToggle, idealbiCompany, onDelete, onUpdated }: { post: MarketPost; userId: string; isAdmin: boolean; onLikeToggle: (id: string, liked: boolean, count: number) => void; idealbiCompany?: IdealBICompany | null; onDelete?: (id: string) => void; onUpdated?: (id: string, content: string) => void }) {
  const [post, setPost] = useState<MarketPost>(initialPost);
  const [showComments, setShowComments] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(initialPost.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const reactionRef = useRef<HTMLDivElement>(null);
  const pickerHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPicker = () => {
    if (pickerHideTimer.current) clearTimeout(pickerHideTimer.current);
    setShowPicker(true);
  };
  const schedulePicker = () => {
    pickerHideTimer.current = setTimeout(() => setShowPicker(false), 200);
  };

  useEffect(() => { setPost(initialPost); }, [initialPost]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close picker when tapping/clicking outside (needed on touch devices)
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (reactionRef.current && !reactionRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler as EventListener);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler as EventListener);
    };
  }, [showPicker]);

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm("Excluir esta publicação? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    const ok = await deleteMarketPost(post.id);
    setDeleting(false);
    if (ok) onDelete?.(post.id);
  };

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const ok = await updateMarketPost(post.id, trimmed);
    setSaving(false);
    if (ok) {
      setPost(p => ({ ...p, content: trimmed }));
      onUpdated?.(post.id, trimmed);
      setEditMode(false);
    }
  };

  const handleReaction = async (reaction: MarketReactionType) => {
    setShowPicker(false);
    // Optimistic update
    const wasLiked = post.user_liked;
    const sameReaction = wasLiked && post.user_reaction === reaction;
    const optimisticLiked = !sameReaction;
    const optimisticReaction = sameReaction ? null : reaction;
    const optimisticCount = sameReaction ? post.likes_count - 1 : (wasLiked ? post.likes_count : post.likes_count + 1);
    setPost(p => ({ ...p, user_liked: optimisticLiked, user_reaction: optimisticReaction, likes_count: Math.max(0, optimisticCount) }));
    onLikeToggle(post.id, optimisticLiked, Math.max(0, optimisticCount));
    // Always call the single API endpoint — it handles toggle / swap / insert correctly
    const ok = await changeMarketReaction(post.id, userId, reaction);
    if (!ok) {
      // Revert optimistic update on failure
      setPost(p => ({ ...p, user_liked: wasLiked, user_reaction: post.user_reaction, likes_count: post.likes_count }));
      onLikeToggle(post.id, wasLiked, post.likes_count);
    }
  };

  const handleLikeBtn = async () => {
    const wasLiked = post.user_liked;
    const optimisticLiked = !wasLiked;
    const optimisticCount = wasLiked ? post.likes_count - 1 : post.likes_count + 1;
    setPost(p => ({ ...p, user_liked: optimisticLiked, user_reaction: optimisticLiked ? "saude" : null, likes_count: Math.max(0, optimisticCount) }));
    onLikeToggle(post.id, optimisticLiked, Math.max(0, optimisticCount));
    // When unliking, send the current reaction so the API knows to remove it (same reaction → unlike)
    const reactionToSend = (wasLiked ? (post.user_reaction as MarketReactionType | null) : null) ?? "saude";
    const newLiked = await toggleMarketPostLike(post.id, userId, wasLiked, reactionToSend);
    if (newLiked !== optimisticLiked) {
      // Revert optimistic on mismatch
      setPost(p => ({ ...p, user_liked: wasLiked, user_reaction: wasLiked ? (post.user_reaction as MarketReactionType | null) : null, likes_count: post.likes_count }));
      onLikeToggle(post.id, wasLiked, post.likes_count);
    }
  };

  const handlePollVote = (id: string, opts: MarketPollOption[], votes: string[]) => {
    setPost(p => ({ ...p, poll_options: opts, user_poll_votes: votes.length ? votes : null }));
  };

  if (deleting) return null;

  return (
    <div className="mercado-post-card" style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
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

        {/* Admin 3-dot menu */}
        {isAdmin && (
          <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              title="Opções"
              style={{
                background: menuOpen ? `${GOLD}15` : "none", border: "none", cursor: "pointer",
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center",
                justifyContent: "center", color: MUTED, fontSize: 18, lineHeight: 1, transition: "background 0.12s",
              }}
              onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = BG; }}
              onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = "none"; }}
            >
              ···
            </button>
            {menuOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
                backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 160, overflow: "hidden",
              }}>
                <button
                  onClick={() => { setMenuOpen(false); setEditContent(post.content); setEditMode(true); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, color: NAVY, textAlign: "left", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = BG)}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: 15 }}>✏️</span> Editar publicação
                </button>
                <div style={{ height: 1, backgroundColor: BORDER, margin: "0 10px" }} />
                <button
                  onClick={handleDelete}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, color: "#e53e3e", textAlign: "left", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fff5f5")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: 15 }}>🗑️</span> Excluir publicação
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content — display or inline-edit */}
      <div style={{ padding: "0 16px 14px" }}>
        {editMode ? (
          <div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={6}
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px",
                border: `1px solid ${GOLD}80`, borderRadius: 10, fontSize: 14,
                fontFamily: "inherit", lineHeight: 1.6, resize: "vertical", outline: "none",
                backgroundColor: `${GOLD}06`,
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditMode(false)}
                style={{ padding: "7px 16px", border: `1px solid ${BORDER}`, borderRadius: 8, background: WHITE, fontSize: 13, color: MUTED, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || saving}
                style={{ padding: "7px 20px", border: "none", borderRadius: 8, backgroundColor: GOLD, fontSize: 13, fontWeight: 700, color: NAVY, cursor: editContent.trim() && !saving ? "pointer" : "not-allowed", opacity: editContent.trim() ? 1 : 0.5, fontFamily: "inherit" }}
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: "#222", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{post.content}</p>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <img
          src={post.image_url}
          alt="conteúdo"
          style={{
            display: "block",
            width: "100%",
            maxHeight: "min(560px, 80vh)",
            objectFit: "contain",
            backgroundColor: "#0d1b2a08",
          }}
        />
      )}

      {/* Video */}
      {post.video_url && <MarketFeedVideo src={post.video_url} />}

      {/* Poll */}
      {post.poll_options && post.poll_options.length > 0 && (
        <PollDisplay post={post} userId={userId} onPollVote={handlePollVote} />
      )}

      {/* Actions */}
      <div style={{ display: "flex", borderTop: `1px solid ${BORDER}`, overflow: "visible", position: "relative" }}>
        {/* Reaction button with hover picker */}
        <div
          ref={reactionRef}
          style={{ flex: 1, position: "relative" }}
          onMouseEnter={openPicker}
          onMouseLeave={schedulePicker}
        >
          {showPicker && <ReactionPicker onSelect={handleReaction} onMouseEnter={openPicker} onMouseLeave={schedulePicker} />}
          <button
            onClick={() => {
              // On touch devices hover doesn't work — tap opens the picker instead of quick-like
              if (window.matchMedia("(pointer: coarse)").matches && !showPicker) {
                openPicker();
              } else {
                handleLikeBtn();
              }
            }}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, padding: "10px 8px",
              borderRadius: 8, border: "none",
              backgroundColor: "transparent",
              color: post.user_liked ? reactionColor(post.user_reaction) : MUTED,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", transition: "background 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            {post.user_liked
              ? <span style={{ fontSize: 15, lineHeight: 1 }}>{reactionEmoji(post.user_reaction)}</span>
              : <LikeIcon filled={false} color={MUTED} />
            }
            <span>{post.user_liked ? reactionLabel(post.user_reaction) : (post.likes_count > 0 ? `${post.likes_count} Reagiu` : "Reagir")}</span>
          </button>
        </div>

        <button
          onClick={() => setShowComments(v => !v)}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "10px 8px",
            borderRadius: 8, border: "none",
            backgroundColor: "transparent",
            color: showComments ? GOLD : MUTED,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${GOLD}0d`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          <CommentIcon color={showComments ? GOLD : MUTED} />
          <span>{post.comments_count > 0 ? `${post.comments_count} Comentário${post.comments_count !== 1 ? "s" : ""}` : "Comentar"}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && <MarketPostComments postId={post.id} userId={userId} />}
    </div>
  );
}

function LockedBlock({ title }: { title: string }) {
  return (
    <div style={{
      backgroundColor: WHITE, border: "1px solid #e8eaed", borderRadius: 14,
      padding: "32px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13, color: MUTED, maxWidth: 380, margin: "0 auto 20px", lineHeight: 1.6 }}>
        Esta seção não está incluída no seu plano atual. Faça upgrade para acessar dados e análises completos.
      </p>
      <a
        href="/assinar"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "11px 28px", backgroundColor: GOLD, borderRadius: 10,
          fontSize: 14, fontWeight: 800, color: NAVY, textDecoration: "none",
        }}
      >
        ⚡ Ver Planos e Assinar
      </a>
    </div>
  );
}

/* ─── Ideal.BI Busca com IA ─────────────────────────────────── */
function IdealBISearch({ userId }: { userId: string }) {
  const [query, setQuery] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsTotal, setCreditsTotal] = useState(3);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  type WineDistribuidor = { name: string; company_page_id: string | null };
  type WineResult = {
    marcaCompleta: string;
    marcaRelatorio?: string;
    paisDeOrigem?: string;
    distribuidor: string;
    distribuidores: WineDistribuidor[];
  };
  const [result, setResult] = useState<WineResult | null | "not_found" | "out_of_scope">(null);
  const [brandExtracted, setBrandExtracted] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const exhausted = credits === 0;
  const creditColor = (credits ?? 3) >= 2 ? "#16a34a" : (credits ?? 3) === 1 ? "#d97706" : "#dc2626";
  const creditBg    = (credits ?? 3) >= 2 ? "#dcfce7" : (credits ?? 3) === 1 ? "#fef3c7" : "#fef2f2";

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)
    ?? `${window.location.origin.replace(/:\d+$/, "")}/api`;

  const getAuthHeader = async (): Promise<HeadersInit> => {
    const session = await getCachedSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeader();
        const res = await fetch(`${apiBase}/wine-imports/credits`, { headers });
        if (!res.ok) return;
        const json = await res.json() as { credits_remaining: number; credits_total: number };
        setCredits(json.credits_remaining);
        setCreditsTotal(json.credits_total);
      } catch { } finally { setCreditsLoading(false); }
    })();
  }, [userId]);

  /* Fetch autocomplete suggestions as user types */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try {
        const headers = await getAuthHeader();
        const res = await fetch(`${apiBase}/wine-imports/suggestions?q=${encodeURIComponent(q)}`, { headers });
        if (!res.ok) return;
        const json = await res.json() as { suggestions: string[] };
        const list = json.suggestions ?? [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {}
    }, 300);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [query]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = async (overrideQ?: string) => {
    const q = (overrideQ ?? query).trim();
    if (!q || searching || exhausted) return;
    setShowSuggestions(false);
    setSearching(true);
    setResult(null);
    setBrandExtracted(null);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${apiBase}/wine-imports/search?q=${encodeURIComponent(q)}`, { headers });
      if (res.status === 402) { setCredits(0); setResult("not_found"); setSearching(false); return; }
      if (res.status === 422) { setResult("out_of_scope"); setSearching(false); return; }
      if (!res.ok) throw new Error("server error");
      const json = await res.json() as {
        data: { marca_completa: string; marca_relatorio: string | null; pais_de_origem: string | null; distribuidor: string | null }[];
        distribuidores?: { name: string; company_page_id: string | null }[];
        brand_extracted: string | null;
        credits_remaining: number;
        credits_total: number;
      };
      setCredits(json.credits_remaining);
      setCreditsTotal(json.credits_total);
      if (json.brand_extracted) setBrandExtracted(json.brand_extracted);
      const rows = json.data ?? [];
      if (rows.length > 0) {
        const f = rows[0];
        let distribuidores: WineDistribuidor[] = (json.distribuidores ?? []).map(d => ({
          name: d.name,
          company_page_id: d.company_page_id ?? null,
        }));
        if (distribuidores.length === 0) {
          const seen = new Set<string>();
          for (const r of rows) {
            const n = (r.distribuidor ?? "").trim();
            if (!n) continue;
            const k = n.toLowerCase();
            if (!seen.has(k)) { seen.add(k); distribuidores.push({ name: n, company_page_id: null }); }
          }
        }
        setResult({
          marcaCompleta: f.marca_completa,
          marcaRelatorio: f.marca_relatorio ?? undefined,
          paisDeOrigem: f.pais_de_origem ?? undefined,
          distribuidor: distribuidores[0]?.name ?? (f.distribuidor ?? "—"),
          distribuidores,
        });
      } else {
        setResult("not_found");
      }
    } catch { setResult("not_found"); }
    setSearching(false);
  };

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 80 }}>

      {/* Credits card */}
      <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: `${GOLD}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {creditsLoading ? (
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${GOLD}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
          ) : "🤖"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, marginBottom: 2 }}>Consultas de IA</div>
          {creditsLoading ? (
            <div style={{ fontSize: 14, color: MUTED }}>Carregando...</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>{credits}</span>
              <span style={{ fontSize: 13, color: MUTED }}>de {creditsTotal} restantes</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, backgroundColor: creditBg, color: creditColor }}>
                {(credits ?? 0) >= 2 ? "OK" : (credits ?? 0) === 1 ? "Última" : "Esgotado"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Search bar with label autocomplete */}
      <div ref={containerRef} style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", backgroundColor: WHITE, border: `1.5px solid ${showSuggestions ? GOLD : BORDER}`, borderRadius: 12, padding: "4px 4px 4px 14px", transition: "border-color 0.15s" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🔍</span>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setResult(null); }}
            onKeyDown={e => {
              if (e.key === "Escape") setShowSuggestions(false);
              if (e.key === "ArrowDown" && showSuggestions && suggestions.length > 0) {
                const first = document.getElementById("suggest-0");
                first?.focus();
              }
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder={exhausted ? "Limite de consultas esgotado" : "Digite o nome de um rótulo de vinho…"}
            disabled={exhausted}
            style={{
              flex: 1, padding: "10px 0", border: "none", outline: "none",
              fontSize: 14, fontFamily: "inherit",
              backgroundColor: "transparent", color: NAVY,
            }}
          />
          {searching && (
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${GOLD}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite", flexShrink: 0, marginRight: 8 }} />
          )}
        </div>

        {/* Dropdown suggestions */}
        {showSuggestions && suggestions.length > 0 && !exhausted && (
          <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 200, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.10)", overflow: "hidden" }}>
            {suggestions.map((s, i) => (
              <button
                key={s}
                id={`suggest-${i}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setQuery(s); setShowSuggestions(false); handleSearch(s); }}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { document.getElementById(`suggest-${i + 1}`)?.focus(); e.preventDefault(); }
                  if (e.key === "ArrowUp")   { i === 0 ? (document.querySelector("input") as HTMLInputElement)?.focus() : document.getElementById(`suggest-${i - 1}`)?.focus(); e.preventDefault(); }
                  if (e.key === "Enter")     { setQuery(s); setShowSuggestions(false); handleSearch(s); }
                  if (e.key === "Escape")    { setShowSuggestions(false); }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "11px 16px", textAlign: "left", background: "none", border: "none",
                  borderBottom: i < suggestions.length - 1 ? `1px solid ${BORDER}` : "none",
                  cursor: "pointer", fontSize: 14, color: NAVY, fontFamily: "inherit",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${GOLD}12`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>🍷</span>
                <span style={{ flex: 1 }}>{s}</span>
                <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>1 crédito</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info hint */}
      {!result && !searching && (
        <div style={{ backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}30`, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, color: NAVY, fontWeight: 600, marginBottom: 4 }}>🍷 Como funciona</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            Digite o nome de um rótulo para ver sugestões da base de dados. Selecione um rótulo para consultar o importador — cada consulta consome 1 crédito.
          </div>
        </div>
      )}

      {/* Loading */}
      {searching && (
        <div style={{ textAlign: "center", padding: "40px 0", color: MUTED }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Consultando base de dados…</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>A IA está identificando a marca e buscando distribuidores</div>
        </div>
      )}

      {/* Out of scope */}
      {!searching && result === "out_of_scope" && (
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Consulta fora do escopo</div>
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>Por favor, pesquise pelo nome de uma marca específica de vinho.</div>
        </div>
      )}

      {/* Not found */}
      {!searching && result === "not_found" && (
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Marca não encontrada</div>
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
            {brandExtracted
              ? `A IA identificou a marca "${brandExtracted}", mas ela ainda não está na base de dados.`
              : "Não encontramos esse vinho. Tente outro nome ou variação."}
          </div>
        </div>
      )}

      {/* No credits */}
      {exhausted && !searching && result === null && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#991b1b", marginBottom: 8 }}>Créditos esgotados</div>
          <div style={{ fontSize: 14, color: "#dc2626", lineHeight: 1.6 }}>Você usou todas as consultas disponíveis. Novos créditos são liberados mensalmente.</div>
        </div>
      )}

      {/* Result */}
      {!searching && result && result !== "not_found" && result !== "out_of_scope" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Brand header card (gold) */}
          <div style={{ backgroundColor: GOLD, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 }}>
              {brandExtracted && brandExtracted.toLowerCase() !== result.marcaCompleta.toLowerCase()
                ? `IA identificou: ${brandExtracted}`
                : "Resultado encontrado"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: WHITE, lineHeight: 1.3, marginBottom: 8 }}>{result.marcaCompleta}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
              ✓ 1 consulta utilizada · {credits} restante{credits !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Data KPI cards */}
          {([
            ...(result.marcaRelatorio && result.marcaRelatorio !== result.marcaCompleta
              ? [{ icon: "🏷️", label: "Marca no Relatório", value: result.marcaRelatorio }]
              : []),
            ...(result.paisDeOrigem
              ? [{ icon: "🌍", label: "País de Origem", value: result.paisDeOrigem }]
              : []),
          ] as { icon: string; label: string; value: string }[]).map(row => (
            <div key={row.label} style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: `${GOLD}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                {row.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{row.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginTop: 2 }}>{row.value}</div>
              </div>
            </div>
          ))}

          {/* Distribuidores BR — pode ter 2+ */}
          {result.distribuidores.length > 0 && (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: `${GOLD}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                📦
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
                  {result.distribuidores.length > 1
                    ? `Distribuído no Brasil por (${result.distribuidores.length})`
                    : "Distribuidor BR"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {result.distribuidores.map((d, idx) => (
                    d.company_page_id ? (
                      <Link
                        key={`${d.name}-${idx}`}
                        href={`/app/empresa/${d.company_page_id}`}
                        style={{ fontSize: 15, fontWeight: 800, color: GOLD, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        {d.name}
                        <span style={{ fontSize: 11 }}>↗</span>
                      </Link>
                    ) : (
                      <span key={`${d.name}-${idx}`} style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{d.name}</span>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IdealBIFeed({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { hasFeature } = usePermissions();
  const [subTab, setSubTab] = useState<"feed" | "search">("feed");
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
    setLoading(true);
    fetchMarketPosts(userId)
      .then(p => { setPosts(p); })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [userId, hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`market_feed_realtime_${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_posts" }, () => {
        fetchMarketPosts(userId).then(p => { setPosts(p); }).catch(() => {});
      })
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
  }, [hasAccess, userId]);

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

  const handleDelete = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdated = (id: string, content: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, content } : p));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Sub-tabs: Feed | Busca IA — always visible */}
      <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
        {([
          { key: "feed",   label: "Feed",     icon: "📡" },
          { key: "search", label: "Busca IA", icon: "🤖" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 20,
              border: subTab === t.key ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
              backgroundColor: subTab === t.key ? `${GOLD}12` : WHITE,
              color: subTab === t.key ? GOLD : MUTED,
              fontWeight: subTab === t.key ? 700 : 500,
              fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Busca IA — always accessible (uses credits, not plan) */}
      {subTab === "search" && <IdealBISearch userId={userId} />}

      {/* Feed — paywall if no plan access */}
      {subTab === "feed" && (!hasAccess ? (
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
          <a
            href="/assinar"
            style={{ display: "inline-block", padding: "12px 32px", backgroundColor: GOLD, borderRadius: 10, fontSize: 15, fontWeight: 800, color: NAVY, textDecoration: "none" }}
          >
            Ver planos e assinar →
          </a>
        </div>
      ) : (
      <>

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
            onDelete={handleDelete}
            onUpdated={handleUpdated}
            idealbiCompany={idealbiCompany}
          />
        ))
      )}
      </>
      ))}
    </div>
  );
}

/* ─── Window width hook ──────────────────── */
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function MercadoPage() {
  const { profile, user } = useAuth();
  const { hasFeature, isLoading: permLoading } = usePermissions();
  const [period, setPeriod] = useState<Period>("ano");
  const [mainTab, setMainTab] = useState<MercadoTab>("visao");
  const isMobile = useWindowWidth() < 768;
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

  const isAdmin = profile?.is_admin ?? false;
  const canMarket = (key: string) => isAdmin || hasFeature(`mercado:${key}`);

  /* ── Tab / Period definitions ── */
  const PERIODS: { key: Period; label: string }[] = [
    { key: "mes", label: "Mês" },
    { key: "trimestre", label: "Trimestre" },
    { key: "ano", label: "Ano" },
  ];
  const TABS: { key: MercadoTab; label: string; icon: string }[] = [
    { key: "visao",         label: "Visão Geral", icon: "📊" },
    { key: "idealbi",       label: "Ideal.BI",    icon: "📡" },
    { key: "apresentacoes", label: "Relatórios",  icon: "📋" },
  ];

  /* ── Shared content renderer ── */
  const renderContent = () => {
    if (mainTab === "apresentacoes") {
      if (permLoading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #c9a84c", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        </div>
      );
      if (!hasFeature("mercado:apresentacoes") && !(profile?.is_admin)) return (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Apresentações de Mercado</h3>
          <p style={{ fontSize: 14, color: MUTED, maxWidth: 400, margin: "0 auto 20px" }}>
            Acesse relatórios e apresentações exclusivos do mercado vitivinícola. Disponível nos planos com acesso ao mercado de dados.
          </p>
          <a href="/assinar" style={{ display: "inline-block", padding: "10px 24px", backgroundColor: GOLD, color: NAVY, borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Ver Planos
          </a>
        </div>
      );
      return <ApresentacoesPanel isAdmin={profile?.is_admin ?? false} />;
    }
    if (mainTab === "idealbi") return (
      <IdealBIFeed userId={user?.id ?? ""} isAdmin={profile?.is_admin ?? false} />
    );
    if (loading) return (
      <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando dados...</div>
    );
    const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
      backgroundColor: WHITE,
      border: "1px solid #e8eaed",
      borderRadius: 16,
      padding: isMobile ? "16px" : 20,
      ...extra,
    });

    return (
      <div style={{
        display: "flex", flexDirection: "column", gap: 12,
        padding: isMobile ? "14px 14px 80px" : 0,
      }}>
        {/* KPI Cards */}
        {canMarket("kpis") ? (
          <div style={isMobile ? {
            display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10,
          } : {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 10,
          }}>
            {data.kpis.map((kpi) => {
              const isPos = kpi.change >= 0;
              const icon = kpi.icon === "Globe" ? "🌍" : kpi.icon === "TrendingUp" ? "📈" : "📊";
              return (
                <div key={kpi.label} className="mercado-card" style={cardStyle({ padding: isMobile ? "14px 14px 16px" : 20, ...(isMobile ? { flex: "0 0 calc(50% - 5px)" } : {}) })}>
                  {/* top row: icon + badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{
                      width: 36, height: 36,
                      backgroundColor: `${GOLD}1a`, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                    }}>
                      {icon}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: isPos ? "#15803d" : "#dc2626",
                      backgroundColor: isPos ? "#dcfce7" : "#fef2f2",
                      padding: "3px 8px", borderRadius: 20,
                    }}>
                      {isPos ? "▲" : "▼"} {Math.abs(kpi.change)}%
                    </span>
                  </div>
                  {/* label */}
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                    {kpi.label}
                  </div>
                  {/* value */}
                  <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 900, color: NAVY, lineHeight: 1.1, marginBottom: 4 }}>
                    {kpi.value}
                  </div>
                  {/* period */}
                  <div style={{ fontSize: 11, color: "#b0b8c4" }}>{kpi.period}</div>
                  {kpi.source && !isMobile && (
                    <div style={{ fontSize: 11, color: "#c0c8d4", marginTop: 6 }}>Fonte: {kpi.source}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <LockedBlock title="KPIs de Mercado" />
        )}

        {/* Charts */}
        {canMarket("graficos") ? (
          <>
            <div className="mercado-card" style={cardStyle()}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 15 }}>📈</span>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Exportações × Importações</h3>
              </div>
              <AreaChart data={data.chart_area} />
            </div>
            <div className="mercado-card" style={cardStyle()}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 15 }}>📊</span>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Produção Nacional (Índice)</h3>
              </div>
              <BarChart data={data.chart_bar} />
            </div>
          </>
        ) : (
          <LockedBlock title="Gráficos de Mercado" />
        )}

        {/* Tendências */}
        {canMarket("tendencias") ? (
          <div className="mercado-card" style={cardStyle()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>🔥</span>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Tendências do Período</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.tendencias.map((t) => (
                <div key={t.title} style={{
                  display: "flex", gap: 12, padding: "12px 14px",
                  backgroundColor: "#f8f9fb", borderRadius: 12,
                  border: "1px solid #eef0f3",
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    backgroundColor: t.pos ? "#dcfce7" : "#fef2f2",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                  }}>
                    {t.pos ? "📈" : "📉"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{t.title}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: t.pos ? "#15803d" : "#dc2626",
                        backgroundColor: t.pos ? "#dcfce7" : "#fef2f2",
                        padding: "2px 7px", borderRadius: 20,
                      }}>
                        {t.pos ? "+" : ""}{t.change}%
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#8a93a2", margin: 0, lineHeight: 1.55 }}>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <LockedBlock title="Tendências do Período" />
        )}
      </div>
    );
  };

  return (
    <AppShell>
      <style>{`
        @media (max-width: 767px) {
          .mercado-post-card {
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            margin-bottom: 8px;
          }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {isMobile ? (
        /* ══ MOBILE LAYOUT ══════════════════════════════ */
        <div style={{ backgroundColor: "#f2f3f5", minHeight: "100vh" }}>
          {/* Sticky header */}
          <div style={{ backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`, padding: "14px 16px 12px", position: "sticky", top: 56, zIndex: 100 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: 0 }}>Mercado</h1>
            <p style={{ fontSize: 12, color: MUTED, margin: "2px 0 0" }}>Dados e indicadores do setor vitivinícola</p>
          </div>

          {/* Sticky tabs row */}
          <div style={{ position: "sticky", top: 113, zIndex: 99, backgroundColor: WHITE, borderBottom: `1px solid ${BORDER}`, display: "flex", padding: "8px 10px", gap: 4 }}>
            {TABS.map(t => {
              const active = mainTab === t.key;
              return (
                <button key={t.key} onClick={() => setMainTab(t.key)} style={{
                  flex: 1, padding: "8px 6px", borderRadius: 8,
                  border: active ? `1px solid ${BORDER}` : "1px solid transparent",
                  background: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  color: active ? GOLD : MUTED,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  transition: "color 0.15s",
                }}>
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Period row — only for Visão Geral */}
          {mainTab === "visao" && (
            <div style={{ backgroundColor: WHITE, display: "flex", gap: 6, padding: "10px 16px 10px", borderBottom: `1px solid ${BORDER}` }}>
              {PERIODS.map(p => {
                const active = period === p.key;
                return (
                  <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 20,
                    border: `1px solid ${active ? GOLD : BORDER}`,
                    backgroundColor: active ? GOLD : WHITE,
                    color: active ? WHITE : "#555",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Content */}
          {renderContent()}
        </div>
      ) : (
        /* ══ DESKTOP LAYOUT ═════════════════════════════ */
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
                  <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                    padding: "7px 16px", borderRadius: 20,
                    border: `1px solid ${period === p.key ? GOLD : "#e8eaed"}`,
                    backgroundColor: period === p.key ? GOLD : WHITE,
                    color: period === p.key ? WHITE : "#555",
                    fontSize: 13, fontWeight: period === p.key ? 700 : 500,
                    cursor: "pointer",
                  }}>{p.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Underline tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "2px solid #e8eaed" }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setMainTab(t.key)} style={{
                background: "none", border: "none", padding: "10px 16px",
                borderBottom: mainTab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
                color: mainTab === t.key ? GOLD : "#8a93a2",
                fontWeight: mainTab === t.key ? 700 : 500,
                fontSize: 14, cursor: "pointer", marginBottom: -2, transition: "all 0.15s",
              }}>{t.icon} {t.label}</button>
            ))}
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      )}
    </AppShell>
  );
}
