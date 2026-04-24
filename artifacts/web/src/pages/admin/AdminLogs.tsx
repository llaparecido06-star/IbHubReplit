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
const FILTERS = ["Todas atividades", "Cadastro", "Curtida", "Conexão", "Seguiu"];

const KPI_ITEMS = [
  { icon: "👤", iconBg: "#d1fae5", label: "Cadastro",   key: "cadastros" as const },
  { icon: "❤️", iconBg: "#ffe4e6", label: "Curtida",    key: "curtidas" as const },
  { icon: "🔗", iconBg: "#ede9fe", label: "Conexão",    key: "conexoes" as const },
  { icon: "✓",  iconBg: "#d1fae5", label: "Seguiu",     key: "seguiu" as const },
];

export default function AdminLogs() {
  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [filterOpen, setFilterOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const logs = await fetchActivityLogs();
      setAllLogs(logs);
    } catch (e) {
      console.error("AdminLogs loadData:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const counts = computeActivityCounts(allLogs);

  const filteredLogs = allLogs.filter((log) => {
    const matchesFilter = filter === FILTERS[0] || log.type === (filter as ActivityType);
    const matchesSearch = !search.trim() || log.text.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Logs de Atividade</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Atividades dos últimos 7 dias em tempo real</p>
          </div>
          <button
            onClick={loadData}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >↻ Atualizar</button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando atividades...</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              {KPI_ITEMS.map((k) => (
                <div key={k.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18 }}>
                  <div style={{ width: 42, height: 42, backgroundColor: k.iconBg, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>
                    {k.icon}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{counts[k.key]}</div>
                  <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por..."
                  style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: "#fff", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  style={{ padding: "10px 14px", border: "1px solid #e8eaed", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}
                >
                  {filter} <span>▾</span>
                </button>
                {filterOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 10, minWidth: 160, zIndex: 99, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
                    {FILTERS.map((f) => (
                      <div
                        key={f}
                        onClick={() => { setFilter(f); setFilterOpen(false); }}
                        style={{ padding: "11px 14px", cursor: "pointer", fontSize: 13, backgroundColor: f === filter ? `${GOLD}12` : "transparent", color: f === filter ? GOLD : "#333", fontWeight: f === filter ? 700 : 400, borderBottom: "1px solid #e8eaed" }}
                      >{f}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
              {filteredLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                  Nenhuma atividade encontrada
                </div>
              ) : (
                filteredLogs.map((log, i) => (
                  <div
                    key={log.id}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i < filteredLogs.length - 1 ? "1px solid #e8eaed" : "none" }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: GOLD, fontSize: 13, fontWeight: 800 }}>
                      {log.initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#333", lineHeight: 1.4 }}>
                      {log.text}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: log.iconColor, marginLeft: "auto", marginBottom: 4 }} />
                      <div style={{ fontSize: 11, color: "#aaa" }}>{relativeTime(log.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
