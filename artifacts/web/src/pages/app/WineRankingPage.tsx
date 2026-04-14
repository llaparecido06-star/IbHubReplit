import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { fetchWineCommunityRankings, WineCommunityRating } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

const FLAG_MAP: Record<string, string> = {
  "Brasil":     "🇧🇷",  "France":    "🇫🇷",  "França":    "🇫🇷",
  "Italy":      "🇮🇹",  "Itália":    "🇮🇹",  "Spain":     "🇪🇸",
  "Espanha":    "🇪🇸",  "Portugal":  "🇵🇹",  "Argentina": "🇦🇷",
  "Chile":      "🇨🇱",  "USA":       "🇺🇸",  "EUA":       "🇺🇸",
  "Germany":    "🇩🇪",  "Alemanha":  "🇩🇪",  "Australia": "🇦🇺",
  "Austrália":  "🇦🇺",  "New Zealand":"🇳🇿", "Nova Zelândia":"🇳🇿",
  "South Africa":"🇿🇦", "África do Sul":"🇿🇦",
};

function countryFlag(country?: string | null): string {
  if (!country) return "🍷";
  return FLAG_MAP[country] ?? "🍷";
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.4;
  const empty = max - full - (half ? 1 : 0);
  return (
    <span style={{ fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(full)}
      {half ? "½" : ""}
      {"☆".repeat(Math.max(0, empty))}
    </span>
  );
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 22 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 22 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 22 }}>🥉</span>;
  return <span style={{ fontSize: 15, fontWeight: 800, color: MUTED, minWidth: 24, textAlign: "center", display: "inline-block" }}>{rank}</span>;
}

type SortKey = "score" | "count" | "alpha";

export default function WineRankingPage() {
  const [wines, setWines]       = useState<WineCommunityRating[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"todos" | "tinto" | "branco" | "espumante" | "rosé">("todos");
  const [sortBy, setSortBy]     = useState<SortKey>("score");

  useEffect(() => {
    fetchWineCommunityRankings().then(data => {
      setWines(data);
      setLoading(false);
    });
  }, []);

  const filtered = wines
    .filter(w => {
      const q = search.toLowerCase();
      const matchSearch = !q || w.name?.toLowerCase().includes(q) || w.producer?.toLowerCase().includes(q) || w.country?.toLowerCase().includes(q);
      const matchFilter = filter === "todos" || w.wine_type?.toLowerCase().includes(filter);
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      if (sortBy === "alpha") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sortBy === "count") return (b.total_ratings ?? 0) - (a.total_ratings ?? 0);
      return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    });

  return (
    <AppShell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 60px" }}>
        {/* Header */}
        <div style={{ padding: "28px 24px 20px", background: WHITE, borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: NAVY }}>🏆 Ranking da Comunidade</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: MUTED }}>Vinhos avaliados e pontuados pelos membros da rede</p>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar vinho, produtor, país…"
              style={{ flex: "1 1 200px", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "9px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", background: BG, color: NAVY, minWidth: 180 }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["todos", "tinto", "branco", "espumante", "rosé"] as const).map(f => (
                <button key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    background: filter === f ? NAVY : WHITE,
                    color: filter === f ? WHITE : NAVY,
                    border: `1px solid ${filter === f ? NAVY : BORDER}`,
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {/* Sort options */}
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 12, color: MUTED, alignSelf: "center" }}>Ordenar:</span>
            {([["score", "🏆 Maior Pontuação"], ["count", "📊 Mais Avaliados"], ["alpha", "🔤 Alfabética"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSortBy(key)} style={{
                padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: sortBy === key ? GOLD : WHITE, color: sortBy === key ? WHITE : MUTED,
                border: `1px solid ${sortBy === key ? GOLD : BORDER}`,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: MUTED }}>⏳ Carregando ranking…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Nenhum vinho encontrado</p>
          </div>
        ) : (
          <div style={{ padding: "8px 0" }}>
            {/* Stats bar */}
            <div style={{ padding: "10px 24px 14px", display: "flex", gap: 24 }}>
              <div><span style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{filtered.length}</span><span style={{ fontSize: 13, color: MUTED, marginLeft: 4 }}>vinhos ranqueados</span></div>
              {filtered.length > 0 && <div><span style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{filtered[0]?.avg_rating?.toFixed(1)}</span><span style={{ fontSize: 13, color: MUTED, marginLeft: 4 }}>melhor nota</span></div>}
            </div>

            {/* Wine cards */}
            {filtered.map((wine, idx) => {
              const rank = idx + 1;
              const avgRating = wine.avg_rating ?? 0;
              const totalRatings = wine.total_ratings ?? 0;

              return (
                <div key={wine.ean ?? idx} style={{
                  display: "flex", alignItems: "flex-start", gap: 16,
                  padding: "16px 24px",
                  background: rank <= 3 ? (GOLD + "09") : WHITE,
                  borderBottom: `1px solid ${BORDER}`,
                  borderLeft: rank <= 3 ? `4px solid ${GOLD}` : "4px solid transparent",
                }}>
                  {/* Rank */}
                  <div style={{ width: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, paddingTop: 2 }}>
                    <MedalIcon rank={rank} />
                  </div>

                  {/* Wine thumbnail */}
                  <div style={{ width: 48, height: 64, borderRadius: 8, background: NAVY + "10", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, overflow: "hidden" }}>
                    {wine.image_url ? (
                      <img src={wine.image_url} alt={wine.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : "🍷"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{wine.name ?? "—"}</span>
                      {wine.vintage && <span style={{ fontSize: 12, color: MUTED }}>({wine.vintage})</span>}
                      {wine.wine_type && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, background: GOLD + "18", borderRadius: 6, padding: "2px 7px" }}>
                          {wine.wine_type}
                        </span>
                      )}
                    </div>

                    {wine.producer && (
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{wine.producer}</div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      {wine.country && (
                        <span style={{ fontSize: 13 }}>{countryFlag(wine.country)} <span style={{ fontSize: 12, color: MUTED }}>{wine.country}{wine.region ? ` · ${wine.region}` : ""}</span></span>
                      )}
                    </div>
                  </div>

                  {/* Rating */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: avgRating >= 4.5 ? GOLD : NAVY }}>
                      {avgRating.toFixed(1)}
                    </div>
                    <div style={{ color: GOLD }}>
                      <StarRating rating={avgRating} />
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {totalRatings} {totalRatings === 1 ? "avaliação" : "avaliações"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
