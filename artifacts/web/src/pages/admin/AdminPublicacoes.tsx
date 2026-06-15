import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  ModerationPost,
  fetchRecentPosts,
  deletePost,
  pinPost,
} from "@/services/adminApi";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f2f3f5";
const WINE   = "#722f37";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function truncate(text: string | null, max = 160): string {
  if (!text) return "(sem conteúdo)";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export default function AdminPublicacoes() {
  const [posts, setPosts]         = useState<ModerationPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [busy, setBusy]           = useState<string | null>(null);
  const [filterPin, setFilterPin] = useState<"all" | "pinned">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchRecentPosts(300);
    setPosts(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = posts.filter(p => {
    const q = search.toLowerCase();
    const matchText = !q ||
      (p.content ?? "").toLowerCase().includes(q) ||
      (p.author_name ?? "").toLowerCase().includes(q);
    const matchPin = filterPin === "all" || p.is_pinned;
    return matchText && matchPin;
  });

  const pinnedCount = posts.filter(p => p.is_pinned).length;

  const handleDelete = async (post: ModerationPost) => {
    if (!confirm(`Remover esta publicação de "${post.author_name ?? "?"}"? Esta ação é irreversível.`)) return;
    setBusy(post.id);
    const ok = await deletePost(post.id);
    if (ok) {
      setPosts(prev => prev.filter(p => p.id !== post.id));
    } else {
      alert("Erro ao remover publicação.");
    }
    setBusy(null);
  };

  const handlePin = async (post: ModerationPost) => {
    const newPin = !post.is_pinned;
    if (newPin && pinnedCount >= 5) {
      alert("Limite de 5 publicações fixadas atingido. Desafixe uma antes de fixar outra.");
      return;
    }
    setBusy(post.id);
    const ok = await pinPost(post.id, newPin);
    if (ok) {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_pinned: newPin } : p));
    } else {
      alert("Erro ao atualizar fixação.");
    }
    setBusy(null);
  };

  return (
    <AdminShell>
      <div style={{ padding: "28px 32px", maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>
            📌 Gestão de Publicações
          </h1>
          <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
            Apague publicações de teste ou fixe posts importantes no topo do feed principal.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Total carregados", value: posts.length },
            { label: "Fixados no feed", value: pinnedCount, highlight: pinnedCount > 0 },
            { label: "Exibindo", value: filtered.length },
          ].map(s => (
            <div key={s.label} style={{
              backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10,
              padding: "10px 18px", minWidth: 120,
            }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.highlight ? GOLD : NAVY }}>{s.value}</div>
              <div style={{ fontSize: 12, color: MUTED }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por conteúdo ou autor…"
            style={{
              flex: 1, minWidth: 220, padding: "9px 14px", borderRadius: 9,
              border: `1.5px solid ${BORDER}`, fontSize: 13, fontFamily: "inherit", outline: "none",
            }}
          />
          <button
            onClick={() => setFilterPin(filterPin === "all" ? "pinned" : "all")}
            style={{
              padding: "9px 16px", borderRadius: 9, border: `1.5px solid ${filterPin === "pinned" ? GOLD : BORDER}`,
              backgroundColor: filterPin === "pinned" ? GOLD + "18" : WHITE,
              color: filterPin === "pinned" ? NAVY : MUTED,
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            📌 Só fixados
          </button>
          <button
            onClick={load}
            style={{ padding: "9px 16px", borderRadius: 9, border: `1.5px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            ↺ Recarregar
          </button>
        </div>

        {/* Info banner about pinning */}
        <div style={{ backgroundColor: GOLD + "14", border: `1px solid ${GOLD}44`, borderRadius: 10, padding: "10px 16px", marginBottom: 18, fontSize: 13, color: NAVY }}>
          <strong>📌 Como funciona o fixar:</strong> Posts fixados aparecem no topo do feed principal para <em>todos</em> os usuários, acima dos demais. Máximo 5 fixados ao mesmo tempo.
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: MUTED }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${GOLD}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            Carregando publicações…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: MUTED }}>
            {search || filterPin === "pinned" ? "Nenhuma publicação encontrada com esses filtros." : "Nenhuma publicação encontrada."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(post => {
              const isPinned = !!post.is_pinned;
              const isBusy   = busy === post.id;
              return (
                <div
                  key={post.id}
                  style={{
                    backgroundColor: WHITE,
                    border: `1px solid ${isPinned ? GOLD : BORDER}`,
                    borderLeft: isPinned ? `4px solid ${GOLD}` : `4px solid transparent`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    opacity: isBusy ? 0.6 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  {/* Image thumbnail */}
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: BG, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: MUTED }}>
                      📝
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
                        {post.author_name ?? "Usuário desconhecido"}
                      </span>
                      {isPinned && (
                        <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: GOLD + "22", color: "#8a6e1e", padding: "2px 8px", borderRadius: 100 }}>
                          📌 Fixado
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#334", margin: "0 0 8px", lineHeight: 1.5, wordBreak: "break-word" }}>
                      {truncate(post.content)}
                    </p>
                    <div style={{ fontSize: 11, color: MUTED }}>
                      ID: <code style={{ fontSize: 10 }}>{post.id}</code>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handlePin(post)}
                      disabled={isBusy}
                      title={isPinned ? "Desafixar do feed" : "Fixar no topo do feed"}
                      style={{
                        padding: "7px 14px", borderRadius: 8, cursor: isBusy ? "default" : "pointer",
                        border: `1.5px solid ${isPinned ? GOLD : BORDER}`,
                        backgroundColor: isPinned ? GOLD : WHITE,
                        color: isPinned ? WHITE : NAVY,
                        fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
                      }}
                    >
                      {isBusy ? "…" : isPinned ? "📌 Desafixar" : "📌 Fixar"}
                    </button>
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={isBusy}
                      title="Apagar publicação permanentemente"
                      style={{
                        padding: "7px 14px", borderRadius: 8, cursor: isBusy ? "default" : "pointer",
                        border: `1.5px solid ${WINE}44`,
                        backgroundColor: WINE + "0e",
                        color: WINE,
                        fontWeight: 700, fontSize: 12,
                      }}
                    >
                      {isBusy ? "…" : "🗑 Apagar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </AdminShell>
  );
}
