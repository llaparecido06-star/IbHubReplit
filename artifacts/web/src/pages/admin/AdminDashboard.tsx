import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  fetchAdminStats,
  fetchUserGrowth,
  fetchPostsByType,
  fetchPlanBreakdown,
  AdminStats,
  UserGrowthPoint,
  PostsByTypePoint,
  PlanPoint,
} from "@/services/adminApi";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const WINE = "#722f37";
const MUTED = "#9ca3af";
const BORDER = "#e8eaed";

const PLAN_LABELS: Record<string, string> = {
  comunidade_ideal_bi: "Comunidade",
  gratuito: "Gratuito",
  premium: "Premium",
  exclusive: "Exclusive",
  business: "Business",
};

const PLAN_COLORS: Record<string, string> = {
  comunidade_ideal_bi: GOLD,
  gratuito: "#9ca3af",
  premium: "#6366f1",
  exclusive: WINE,
  business: "#059669",
};

function fmt(n: number) { return n.toLocaleString("pt-BR"); }

function deltaLabel(today: number, yesterday: number) {
  if (yesterday === 0) return today > 0 ? `+${today} vs ontem` : "= ontem";
  const diff = today - yesterday;
  if (diff === 0) return "= ontem";
  return diff > 0 ? `+${diff} vs ontem` : `${diff} vs ontem`;
}

function deltaColor(today: number, yesterday: number) {
  if (today > yesterday) return "#16a34a";
  if (today < yesterday) return "#dc2626";
  return MUTED;
}

function weekDayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function AreaLineChart({ data, width = 520 }: { data: UserGrowthPoint[]; width?: number }) {
  const PL = 44, PR = 12, PT = 14, PB = 32;
  const CW = width - PL - PR;
  const CH = 120;
  const H = CH + PT + PB;
  const today = new Date().toISOString().slice(0, 10);

  if (data.length === 0) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>
        Sem dados no período
      </div>
    );
  }

  const values = data.map((d) => d.count);
  const yMax = Math.max(...values, 1);
  const step = yMax <= 4 ? 1 : yMax <= 10 ? 2 : Math.ceil(yMax / 5);
  const yGrid = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const xAt = (i: number) => PL + (i / (data.length - 1)) * CW;
  const yAt = (v: number) => PT + (1 - v / yMax) * CH;

  const linePts = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const areaPts = `${xAt(0)},${PT + CH} ${linePts} ${xAt(data.length - 1)},${PT + CH}`;

  const maxLabels = Math.floor(CW / 44);
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={H} style={{ display: "block" }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.25" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yGrid.map((v) => (
          <g key={v}>
            <line x1={PL} y1={yAt(v)} x2={width - PR} y2={yAt(v)} stroke={BORDER} strokeWidth={1} strokeDasharray="3,3" />
            <text x={PL - 5} y={yAt(v) + 4} textAnchor="end" fontSize={9} fill={MUTED}>{v}</text>
          </g>
        ))}
        <polygon points={areaPts} fill="url(#areaGrad)" />
        <polyline points={linePts} fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => {
          const isToday = d.date === today;
          return (
            <g key={d.date}>
              <circle cx={xAt(i)} cy={yAt(d.count)} r={isToday ? 5 : 3} fill={isToday ? WINE : GOLD} stroke="#fff" strokeWidth={isToday ? 2 : 1} />
              <title>{`${d.date}: ${d.count} cadastro${d.count !== 1 ? "s" : ""}`}</title>
            </g>
          );
        })}
        {data.map((d, i) =>
          i % labelStep === 0 ? (
            <text key={d.date + "_l"} x={xAt(i)} y={H - 4} textAnchor="middle" fontSize={8} fill={MUTED}>
              {d.date.slice(5)}
            </text>
          ) : null
        )}
        <text x={xAt(data.length - 1)} y={H - 4} textAnchor="middle" fontSize={8} fill={WINE} fontWeight="700">
          hoje
        </text>
      </svg>
    </div>
  );
}

function BarChart({ data, width = 460 }: { data: PostsByTypePoint[]; width?: number }) {
  const PL = 32, PR = 10, PT = 10, PB = 40;
  const CW = width - PL - PR;
  const CH = 110;
  const H = CH + PT + PB;

  if (data.length === 0 || data.every((d) => d.v === 0)) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>
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
            <line x1={PL} y1={yTop(v)} x2={width - PR} y2={yTop(v)} stroke={BORDER} strokeWidth={1} strokeDasharray="3,3" />
            <text x={PL - 4} y={yTop(v) + 4} textAnchor="end" fontSize={9} fill={MUTED}>{v}</text>
          </g>
        ))}
        {data.map((b, i) => (
          <g key={b.label}>
            <rect x={xAt(i)} y={yTop(b.v)} width={barW} height={Math.max(yH(b.v), 2)} fill={GOLD} rx={3} opacity={0.85} />
            <text x={xAt(i) + barW / 2} y={yTop(b.v) - 4} textAnchor="middle" fontSize={10} fontWeight="700" fill={NAVY}>{b.v}</text>
            <text x={xAt(i) + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={MUTED}>{b.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PlanBreakdownChart({ data, width = 460 }: { data: PlanPoint[]; width?: number }) {
  if (data.length === 0) return null;
  const total = data.reduce((s, p) => s + p.count, 0);
  const BAR_H = 28;
  const GAP = 10;
  const H = data.length * (BAR_H + GAP);
  const LABEL_W = 120;
  const COUNT_W = 36;
  const BAR_W = width - LABEL_W - COUNT_W - 12;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((p) => {
        const pct = total > 0 ? (p.count / total) * 100 : 0;
        const color = PLAN_COLORS[p.plan] ?? GOLD;
        const label = PLAN_LABELS[p.plan] ?? p.plan;
        return (
          <div key={p.plan} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 100, fontSize: 12, color: NAVY, fontWeight: 600, textAlign: "right", flexShrink: 0 }}>
              {label}
            </div>
            <div style={{ flex: 1, height: 20, backgroundColor: "#f2f3f5", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 6, transition: "width 0.6s ease", minWidth: p.count > 0 ? 4 : 0 }} />
            </div>
            <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: NAVY, textAlign: "right", flexShrink: 0 }}>
              {p.count}
            </div>
            <div style={{ width: 36, fontSize: 11, color: MUTED, textAlign: "right", flexShrink: 0 }}>
              {pct.toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Last7DaysTable({ growth }: { growth: UserGrowthPoint[] }) {
  const last7 = growth.slice(-7).reverse();
  const today = new Date().toISOString().slice(0, 10);
  const maxCount = Math.max(...last7.map((d) => d.count), 1);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0 12px", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dia</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Cadastros</div>
        <div style={{ width: 80 }} />
      </div>
      {last7.map((d) => {
        const isToday = d.date === today;
        const barPct = (d.count / maxCount) * 100;
        return (
          <div
            key={d.date}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "0 12px",
              alignItems: "center",
              padding: "7px 0",
              borderTop: `1px solid ${BORDER}`,
              backgroundColor: isToday ? "#fffbeb" : "transparent",
              borderRadius: isToday ? 6 : 0,
            }}
          >
            <div style={{ fontSize: 13, color: NAVY, fontWeight: isToday ? 700 : 500, display: "flex", alignItems: "center", gap: 6 }}>
              {isToday && <span style={{ fontSize: 10, backgroundColor: GOLD, color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>hoje</span>}
              {weekDayLabel(d.date)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: isToday ? WINE : NAVY, textAlign: "right", minWidth: 32 }}>
              {fmt(d.count)}
            </div>
            <div style={{ width: 80, height: 10, backgroundColor: "#f2f3f5", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${barPct}%`, height: "100%", backgroundColor: isToday ? WINE : GOLD, borderRadius: 5, minWidth: d.count > 0 ? 4 : 0 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface KpiCardProps {
  icon: string;
  iconBg: string;
  label: string;
  value: number;
  sub: string;
  delta?: string;
  deltaColor?: string;
  highlight?: boolean;
}

function KpiCard({ icon, iconBg, label, value, sub, delta, deltaColor: dColor, highlight }: KpiCardProps) {
  return (
    <div style={{
      backgroundColor: highlight ? NAVY : "#fff",
      border: `1px solid ${highlight ? NAVY : BORDER}`,
      borderRadius: 14,
      padding: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, backgroundColor: iconBg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          {icon}
        </div>
        {delta && (
          <span style={{ fontSize: 12, color: dColor ?? MUTED, fontWeight: 600 }}>{delta}</span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: highlight ? GOLD : NAVY, lineHeight: 1 }}>{fmt(value)}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? "#fff" : "#555", marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: highlight ? "#9ca3af" : MUTED, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [growth, setGrowth] = useState<UserGrowthPoint[]>([]);
  const [postTypes, setPostTypes] = useState<PostsByTypePoint[]>([]);
  const [plans, setPlans] = useState<PlanPoint[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [s, g, p, pl] = await Promise.all([
        fetchAdminStats(),
        fetchUserGrowth(),
        fetchPostsByType(),
        fetchPlanBreakdown(),
      ]);
      setStats(s);
      setGrowth(g);
      setPostTypes(p);
      setPlans(pl);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <AdminShell>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: 0 }}>Dashboard</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: "4px 0 0" }}>Visão geral do ibhub em tempo real</p>
          </div>
          <button
            onClick={loadData}
            style={{ padding: "8px 16px", backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >
            ↻ Atualizar
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <p style={{ color: MUTED }}>Carregando dados...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: "#dc2626" }}>Erro ao carregar dados.</p>
            <button onClick={loadData} style={{ marginTop: 16, padding: "8px 24px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              Tentar novamente
            </button>
          </div>
        ) : stats ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Row 1 — Cadastros em destaque */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Cadastros
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                <KpiCard
                  icon="🟡"
                  iconBg="#fef3c7"
                  label="Hoje"
                  value={stats.todaySignups}
                  sub="cadastros nas últimas 24h"
                  delta={deltaLabel(stats.todaySignups, stats.yesterdaySignups)}
                  deltaColor={deltaColor(stats.todaySignups, stats.yesterdaySignups)}
                  highlight
                />
                <KpiCard
                  icon="📅"
                  iconBg="#fef3c7"
                  label="Ontem"
                  value={stats.yesterdaySignups}
                  sub="cadastros no dia anterior"
                />
                <KpiCard
                  icon="📆"
                  iconBg="#ede9fe"
                  label="Esta semana"
                  value={stats.weekSignups}
                  sub="últimos 7 dias"
                />
                <KpiCard
                  icon="👥"
                  iconBg="#dbeafe"
                  label="Total de usuários"
                  value={stats.totalUsers}
                  sub="total cadastrado"
                />
              </div>
            </div>

            {/* Row 2 — Outros KPIs */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Plataforma
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                <KpiCard icon="📝" iconBg="#fff7ed" label="Publicações" value={stats.totalPosts} sub="total de posts" />
                <KpiCard icon="👁️" iconBg="#f3e8ff" label="Stories Ativos" value={stats.activeStories} sub="últimas 24h" />
                <KpiCard icon="💳" iconBg="#d1fae5" label="Assinantes" value={stats.activeSubscribers} sub="plano não-básico" />
              </div>
            </div>

            {/* Row 3 — Crescimento + últimos 7 dias */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
              <div style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: GOLD }}>📈</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Cadastros por dia (30 dias)</h3>
                </div>
                <p style={{ fontSize: 12, color: MUTED, margin: "0 0 14px" }}>
                  Ponto <span style={{ color: WINE, fontWeight: 700 }}>●</span> = hoje
                </p>
                <AreaLineChart data={growth} />
              </div>

              <div style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ color: GOLD }}>🗓️</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Últimos 7 dias</h3>
                </div>
                <Last7DaysTable growth={growth} />
              </div>
            </div>

            {/* Row 4 — Posts por tipo + Breakdown de planos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ color: GOLD }}>📊</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Posts por Tipo</h3>
                </div>
                <BarChart data={postTypes} />
              </div>
              <div style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ color: GOLD }}>🧩</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Usuários por Plano</h3>
                </div>
                <PlanBreakdownChart data={plans} />
              </div>
            </div>

          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
