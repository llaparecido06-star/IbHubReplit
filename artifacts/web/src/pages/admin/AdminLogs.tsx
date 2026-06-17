import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  fetchActivityLogs,
  computeActivityCounts,
  relativeTime,
  ActivityLog,
  ActivityType,
} from "@/services/adminApi";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

const PERIOD_OPTIONS: { label: string; days: number }[] = [
  { label: "7 dias",  days: 7  },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "Total",   days: 0  },
];

const CATEGORY_FILTERS: { label: string; value: string }[] = [
  { label: "Todas atividades", value: "" },
  { label: "Cadastro",         value: "Cadastro"   },
  { label: "Curtida",          value: "Curtida"    },
  { label: "Comentário",       value: "Comentário" },
  { label: "Publicação",       value: "Publicação" },
  { label: "Conexão",          value: "Conexão"    },
  { label: "Seguiu",           value: "Seguiu"     },
  { label: "Chat / Grupos",    value: "Chat"       },
  { label: "Mercado",          value: "Mercado"    },
];

const KPI_ITEMS: { icon: string; iconBg: string; label: string; key: keyof ReturnType<typeof computeActivityCounts>; filterValue: ActivityType | "" }[] = [
  { icon: "👤", iconBg: "#d1fae5", label: "Cadastros",   key: "cadastros",   filterValue: "Cadastro"   },
  { icon: "❤️", iconBg: "#ffe4e6", label: "Curtidas",    key: "curtidas",    filterValue: "Curtida"    },
  { icon: "💬", iconBg: "#e0f2fe", label: "Comentários", key: "comentarios", filterValue: "Comentário" },
  { icon: "📝", iconBg: "#fef3c7", label: "Publicações", key: "publicacoes", filterValue: "Publicação" },
  { icon: "🔗", iconBg: "#ede9fe", label: "Conexões",    key: "conexoes",    filterValue: "Conexão"    },
  { icon: "✓",  iconBg: "#d1fae5", label: "Seguiu",      key: "seguiu",      filterValue: "Seguiu"     },
  { icon: "💬", iconBg: "#e0e7ff", label: "Chat",        key: "chat",        filterValue: "Chat"       },
  { icon: "🛒", iconBg: "#fef9ec", label: "Mercado",     key: "mercado",     filterValue: "Mercado"    },
];

const TYPE_ICON_COLOR: Record<ActivityType, string> = {
  "Cadastro":   "#059669",
  "Curtida":    "#e11d48",
  "Comentário": "#0ea5e9",
  "Publicação": "#f59e0b",
  "Conexão":    "#7c3aed",
  "Seguiu":     "#059669",
  "Chat":       "#6366f1",
  "Mercado":    "#c9a84c",
};

export default function AdminLogs() {
  const [loading, setLoading]     = useState(true);
  const [allLogs, setAllLogs]     = useState<ActivityLog[]>([]);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [days, setDays]           = useState(7);

  const loadData = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const logs = await fetchActivityLogs(d);
      setAllLogs(logs);
    } catch (e) {
      console.error("AdminLogs loadData:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(days); }, [loadData, days]);

  const counts = computeActivityCounts(allLogs);

  const filteredLogs = allLogs.filter((log) => {
    const matchesFilter = !filter || log.type === (filter as ActivityType);
    const matchesSearch = !search.trim() || log.text.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const periodLabel = PERIOD_OPTIONS.find(p => p.days === days)?.label ?? "7 dias";
  const activeFilterLabel = CATEGORY_FILTERS.find(f => f.value === filter)?.label ?? "Todas atividades";

  return (
    <AdminShell>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Logs de Atividade</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>
              {days === 0 ? "Todos os registros" : `Últimos ${days} dias`} · {allLogs.length} eventos
            </p>
          </div>
          <button
            onClick={() => loadData(days)}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >↻ Atualizar</button>
        </div>

        {/* ── Period pills ───────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              style={{
                padding: "7px 16px",
                borderRadius: 100,
                border: "1.5px solid",
                borderColor: days === p.days ? GOLD : "#e8eaed",
                backgroundColor: days === p.days ? `${GOLD}18` : "#fff",
                color: days === p.days ? GOLD : "#555",
                fontWeight: days === p.days ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >{p.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando atividades...</p>
          </div>
        ) : (
          <>
            {/* ── KPI grid (4 × 2) ──────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {KPI_ITEMS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setFilter(filter === k.filterValue ? "" : k.filterValue)}
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e8eaed",
                    borderRadius: 14,
                    padding: 16,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >
                  <div style={{ width: 38, height: 38, backgroundColor: k.iconBg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginBottom: 10 }}>
                    {k.icon}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>{counts[k.key]}</div>
                  <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>{k.label}</div>
                </button>
              ))}
            </div>

            {/* ── Search + filter ───────────────────────────────── */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome..."
                  style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: "#fff", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  style={{
                    padding: "10px 14px",
                    border: "1px solid",
                    borderColor: filter ? GOLD : "#e8eaed",
                    borderRadius: 10,
                    background: filter ? `${GOLD}12` : "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: filter ? 700 : 400,
                    color: filter ? GOLD : "#333",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeFilterLabel} <span>▾</span>
                </button>
                {filterOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 10, minWidth: 180, zIndex: 99, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                    {CATEGORY_FILTERS.map((f) => (
                      <div
                        key={f.value}
                        onClick={() => { setFilter(f.value); setFilterOpen(false); }}
                        style={{
                          padding: "11px 14px",
                          cursor: "pointer",
                          fontSize: 13,
                          backgroundColor: f.value === filter ? `${GOLD}12` : "transparent",
                          color: f.value === filter ? GOLD : "#333",
                          fontWeight: f.value === filter ? 700 : 400,
                          borderBottom: "1px solid #e8eaed",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {f.value && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: TYPE_ICON_COLOR[f.value as ActivityType] ?? "#ccc", display: "inline-block", flexShrink: 0 }} />
                        )}
                        {f.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Log list ──────────────────────────────────────── */}
            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 120px 80px", gap: 0, padding: "10px 18px", borderBottom: "1px solid #e8eaed", backgroundColor: "#f9fafb" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase", letterSpacing: "0.05em" }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase", letterSpacing: "0.05em" }}>Atividade</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase", letterSpacing: "0.05em" }}>Categoria</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8a93a2", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Quando</div>
              </div>

              {filteredLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                  Nenhuma atividade encontrada
                </div>
              ) : (
                filteredLogs.map((log, i) => (
                  <div
                    key={log.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 120px 80px",
                      alignItems: "center",
                      gap: 0,
                      padding: "12px 18px",
                      borderBottom: i < filteredLogs.length - 1 ? "1px solid #e8eaed" : "none",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 34, height: 34, borderRadius: "50%", backgroundColor: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: 13, fontWeight: 800 }}>
                      {log.initial}
                    </div>

                    {/* Text */}
                    <div style={{ fontSize: 13, color: "#333", lineHeight: 1.4, paddingRight: 12 }}>
                      {log.text}
                    </div>

                    {/* Category badge */}
                    <div>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 100,
                        backgroundColor: `${TYPE_ICON_COLOR[log.type]}18`,
                        color: TYPE_ICON_COLOR[log.type],
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: TYPE_ICON_COLOR[log.type], display: "inline-block" }} />
                        {log.type}
                      </span>
                    </div>

                    {/* Time */}
                    <div style={{ fontSize: 11, color: "#aaa", textAlign: "right" }}>
                      {relativeTime(log.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {filteredLogs.length > 0 && (
              <div style={{ textAlign: "center", padding: "14px 0 0", fontSize: 12, color: "#aaa" }}>
                Exibindo {filteredLogs.length} de {allLogs.length} eventos · período: {periodLabel}
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
