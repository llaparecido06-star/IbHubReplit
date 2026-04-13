import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  fetchAdminStats,
  fetchUserGrowth,
  fetchPostsByType,
  AdminStats,
  UserGrowthPoint,
  PostsByTypePoint,
} from "@/services/adminApi";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

function LineChart({ data, width = 480 }: { data: UserGrowthPoint[]; width?: number }) {
  const PL = 42, PR = 10, PT = 10, PB = 30;
  const CW = width - PL - PR;
  const CH = 100;
  const H = CH + PT + PB;

  if (data.length === 0) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>
        Sem dados no período
      </div>
    );
  }

  const values = data.map((d) => d.count);
  const yMax = Math.max(...values, 1);
  const step = yMax <= 4 ? 1 : Math.ceil(yMax / 4);
  const yGrid = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const xAt = (i: number) =>
    data.length === 1 ? PL + CW / 2 : PL + (i / (data.length - 1)) * CW;
  const yAt = (v: number) => PT + (1 - v / yMax) * CH;

  const pts = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");

  const maxLabels = Math.floor(CW / 40);
  const step2 = Math.max(1, Math.ceil(data.length / maxLabels));

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={H} style={{ display: "block" }}>
        {yGrid.map((v) => (
          <g key={v}>
            <line x1={PL} y1={yAt(v)} x2={width - PR} y2={yAt(v)} stroke="#e8eaed" strokeWidth={1} strokeDasharray="3,3" />
            <text x={PL - 4} y={yAt(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>
          </g>
        ))}
        {data.map((d, i) =>
          i % step2 === 0 ? (
            <text key={d.date + i} x={xAt(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="#9ca3af">
              {d.date.slice(5)}
            </text>
          ) : null
        )}
        {data.length > 1 && (
          <polyline points={pts} fill="none" stroke={GOLD} strokeWidth={2} />
        )}
        {values.map((v, i) => (
          <circle key={i} cx={xAt(i)} cy={yAt(v)} r={3} fill={GOLD} />
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data, width = 480 }: { data: PostsByTypePoint[]; width?: number }) {
  const PL = 30, PR = 10, PT = 10, PB = 40;
  const CW = width - PL - PR;
  const CH = 110;
  const H = CH + PT + PB;

  if (data.length === 0 || data.every((d) => d.v === 0)) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>
        Sem publicações ainda
      </div>
    );
  }

  const yMax = Math.max(...data.map((d) => d.v), 1);
  const step = yMax <= 4 ? 1 : Math.ceil(yMax / 4);
  const yGrid = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);
  const barW = Math.min(60, CW / (data.length + 1));
  const gap = (CW - data.length * barW) / (data.length + 1);

  const xAt = (i: number) => PL + gap + i * (barW + gap);
  const yTop = (v: number) => PT + (1 - v / yMax) * CH;
  const yH = (v: number) => (v / yMax) * CH;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={H} style={{ display: "block" }}>
        {yGrid.map((v) => (
          <g key={v}>
            <line x1={PL} y1={yTop(v)} x2={width - PR} y2={yTop(v)} stroke="#e8eaed" strokeWidth={1} strokeDasharray="3,3" />
            <text x={PL - 4} y={yTop(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>
          </g>
        ))}
        {data.map((b, i) => (
          <g key={b.label}>
            <rect x={xAt(i)} y={yTop(b.v)} width={barW} height={Math.max(yH(b.v), 2)} fill={GOLD} rx={3} />
            <text x={xAt(i) + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">{b.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [growth, setGrowth] = useState<UserGrowthPoint[]>([]);
  const [postTypes, setPostTypes] = useState<PostsByTypePoint[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [s, g, p] = await Promise.all([
        fetchAdminStats(),
        fetchUserGrowth(),
        fetchPostsByType(),
      ]);
      setStats(s);
      setGrowth(g);
      setPostTypes(p);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const kpis = stats
    ? [
        { icon: "👥", iconBg: "#ede9fe", iconColor: "#6d28d9", label: "Usuários", value: stats.totalUsers, sub: "total cadastrado" },
        { icon: "📝", iconBg: "#fff7ed", iconColor: "#ea580c", label: "Publicações", value: stats.totalPosts, sub: "total de posts" },
        { icon: "👁️", iconBg: "#f3e8ff", iconColor: "#9333ea", label: "Stories Ativos", value: stats.activeStories, sub: "últimas 24h" },
        { icon: "💳", iconBg: "#d1fae5", iconColor: "#059669", label: "Assinantes", value: stats.activeSubscribers, sub: "plano não-básico" },
      ]
    : [];

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: 0 }}>Dashboard</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: "4px 0 0" }}>Visão geral do ibhub em tempo real</p>
          </div>
          <button
            onClick={loadData}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >↻ Atualizar</button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando dados...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: "#dc2626" }}>Erro ao carregar dados.</p>
            <button onClick={loadData} style={{ marginTop: 16, padding: "8px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              {kpis.map((k) => (
                <div key={k.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ width: 44, height: 44, backgroundColor: k.iconBg, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                      {k.icon}
                    </div>
                    <span style={{ fontSize: 13, color: "#22c55e" }}>↑</span>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: NAVY }}>{k.value.toLocaleString()}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>{k.label}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ color: GOLD }}>📈</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Crescimento de Usuários (30d)</h3>
                </div>
                <LineChart data={growth} />
              </div>
              <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ color: GOLD }}>📊</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Posts por Tipo</h3>
                </div>
                <BarChart data={postTypes} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
