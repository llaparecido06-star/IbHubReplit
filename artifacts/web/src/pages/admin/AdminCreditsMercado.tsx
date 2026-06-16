import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  fetchCreditDailyStats,
  fetchCreditTopUsers,
  CreditDailyPoint,
  CreditUserStat,
} from "@/services/adminApi";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const WINE = "#722f37";
const PURPLE = "#6366f1";
const MUTED = "#9ca3af";
const BORDER = "#e8eaed";

const PLAN_LABELS: Record<string, string> = {
  comunidade_ideal_bi: "Comunidade",
  gratuito: "Gratuito",
  premium: "Premium",
  exclusive: "Exclusive",
  business: "Business",
};

const DAYS_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
];

function fmt(n: number) { return n.toLocaleString("pt-BR"); }

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function DualLineChart({ data, width = 560 }: { data: CreditDailyPoint[]; width?: number }) {
  const PL = 44, PR = 12, PT = 14, PB = 44;
  const CW = width - PL - PR;
  const CH = 130;
  const H = CH + PT + PB;
  const today = new Date().toISOString().slice(0, 10);

  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>
        Sem uso de créditos no período
      </div>
    );
  }

  const aiVals = data.map((d) => d.ai_search);
  const rvVals = data.map((d) => d.bi_reveal);
  const yMax = Math.max(...aiVals, ...rvVals, 1);
  const step = yMax <= 4 ? 1 : yMax <= 10 ? 2 : Math.ceil(yMax / 5);
  const yGrid = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);

  const xAt = (i: number) => data.length === 1 ? PL + CW / 2 : PL + (i / (data.length - 1)) * CW;
  const yAt = (v: number) => PT + (1 - v / yMax) * CH;

  const aiPts = aiVals.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const rvPts = rvVals.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");

  const labelStep = Math.max(1, Math.ceil(data.length / Math.floor(CW / 44)));

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={H} style={{ display: "block" }}>
        <defs>
          <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.2" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PURPLE} stopOpacity="0.15" />
            <stop offset="100%" stopColor={PURPLE} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yGrid.map((v) => (
          <g key={v}>
            <line x1={PL} y1={yAt(v)} x2={width - PR} y2={yAt(v)} stroke={BORDER} strokeWidth={1} strokeDasharray="3,3" />
            <text x={PL - 5} y={yAt(v) + 4} textAnchor="end" fontSize={9} fill={MUTED}>{v}</text>
          </g>
        ))}
        <polygon points={`${xAt(0)},${PT + CH} ${aiPts} ${xAt(data.length - 1)},${PT + CH}`} fill="url(#aiGrad)" />
        <polygon points={`${xAt(0)},${PT + CH} ${rvPts} ${xAt(data.length - 1)},${PT + CH}`} fill="url(#rvGrad)" />
        <polyline points={aiPts} fill="none" stroke={GOLD} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={rvPts} fill="none" stroke={PURPLE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => {
          const isToday = d.date === today;
          return (
            <g key={d.date}>
              <circle cx={xAt(i)} cy={yAt(d.ai_search)} r={isToday ? 4 : 2.5} fill={GOLD} stroke="#fff" strokeWidth={1}>
                <title>{`${d.date} — Busca IA: ${d.ai_search}`}</title>
              </circle>
              <circle cx={xAt(i)} cy={yAt(d.bi_reveal)} r={isToday ? 4 : 2.5} fill={PURPLE} stroke="#fff" strokeWidth={1}>
                <title>{`${d.date} — BI Reveal: ${d.bi_reveal}`}</title>
              </circle>
            </g>
          );
        })}
        {data.map((d, i) =>
          i % labelStep === 0 ? (
            <text key={d.date + "_l"} x={xAt(i)} y={H - 4} textAnchor="middle" fontSize={8} fill={MUTED}>
              {fmtDate(d.date)}
            </text>
          ) : null
        )}
        <text x={xAt(data.length - 1)} y={H - 4} textAnchor="middle" fontSize={8} fill={WINE} fontWeight="700">hoje</text>
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" }}>
          <div style={{ width: 14, height: 3, backgroundColor: GOLD, borderRadius: 2 }} />
          Busca IA
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" }}>
          <div style={{ width: 14, height: 3, backgroundColor: PURPLE, borderRadius: 2 }} />
          BI Reveal
        </div>
      </div>
    </div>
  );
}

function Last7Table({ data }: { data: CreditDailyPoint[] }) {
  const last7 = data.slice(-7).reverse();
  const today = new Date().toISOString().slice(0, 10);
  const maxTotal = Math.max(...last7.map((d) => d.total), 1);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 70px 60px 80px", gap: "0 8px", marginBottom: 6 }}>
        {["Dia", "Busca IA", "BI Reveal", "Total", ""].map((h) => (
          <div key={h} style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h === "" ? "left" : "right" }}>{h}</div>
        ))}
      </div>
      {last7.map((d) => {
        const isToday = d.date === today;
        const pct = (d.total / maxTotal) * 100;
        return (
          <div
            key={d.date}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 60px 70px 60px 80px",
              gap: "0 8px",
              alignItems: "center",
              padding: "6px 0",
              borderTop: `1px solid ${BORDER}`,
              backgroundColor: isToday ? "#fffbeb" : "transparent",
            }}
          >
            <div style={{ fontSize: 12, color: NAVY, fontWeight: isToday ? 700 : 500, display: "flex", gap: 6, alignItems: "center" }}>
              {isToday && <span style={{ fontSize: 9, backgroundColor: GOLD, color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>hoje</span>}
              {new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, textAlign: "right" }}>{d.ai_search}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: PURPLE, textAlign: "right" }}>{d.bi_reveal}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: NAVY, textAlign: "right" }}>{d.total}</div>
            <div style={{ height: 10, backgroundColor: "#f2f3f5", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: isToday ? WINE : GOLD, borderRadius: 5, minWidth: d.total > 0 ? 4 : 0 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopUsersTable({ users }: { users: CreditUserStat[] }) {
  if (users.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 13 }}>
        Nenhum uso de créditos no período
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
            {["#", "Usuário", "Plano", "Busca IA", "BI Reveal", "Total", "Último uso"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: h === "#" || h === "Busca IA" || h === "BI Reveal" || h === "Total" ? "center" : "left", fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.user_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: "10px", textAlign: "center", fontSize: 12, color: MUTED, fontWeight: 700 }}>{i + 1}</td>
              <td style={{ padding: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                      {(u.full_name ?? u.username ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{u.full_name ?? u.username ?? "—"}</div>
                    {u.username && <div style={{ fontSize: 11, color: MUTED }}>@{u.username}</div>}
                  </div>
                </div>
              </td>
              <td style={{ padding: "10px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#f2f3f5", color: "#555", padding: "2px 8px", borderRadius: 5 }}>
                  {PLAN_LABELS[u.plan ?? ""] ?? (u.plan ?? "—")}
                </span>
              </td>
              <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: GOLD, fontSize: 14 }}>{fmt(u.ai_search)}</td>
              <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: PURPLE, fontSize: 14 }}>{fmt(u.bi_reveal)}</td>
              <td style={{ padding: "10px", textAlign: "center" }}>
                <span style={{ fontWeight: 900, color: NAVY, fontSize: 16 }}>{fmt(u.total)}</span>
              </td>
              <td style={{ padding: "10px", fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{fmtDatetime(u.last_used)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminCreditsMercado() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<CreditDailyPoint[]>([]);
  const [users, setUsers] = useState<CreditUserStat[]>([]);

  const load = async (d: number) => {
    setLoading(true);
    const [dl, us] = await Promise.all([
      fetchCreditDailyStats(d),
      fetchCreditTopUsers(d, 25),
    ]);
    setDaily(dl);
    setUsers(us);
    setLoading(false);
  };

  useEffect(() => { void load(days); }, [days]);

  const today = new Date().toISOString().slice(0, 10);
  const todayData = daily.find((d) => d.date === today);
  const totalToday = todayData?.total ?? 0;
  const totalAiToday = todayData?.ai_search ?? 0;
  const totalRevealToday = todayData?.bi_reveal ?? 0;

  const totalPeriod = daily.reduce((s, d) => s + d.total, 0);
  const totalAiPeriod = daily.reduce((s, d) => s + d.ai_search, 0);
  const totalRevealPeriod = daily.reduce((s, d) => s + d.bi_reveal, 0);
  const avgPerDay = daily.length > 0 ? (totalPeriod / daily.length) : 0;
  const activeUsers = users.length;

  const kpis = [
    { icon: "🟡", bg: "#fef3c7", label: "Créditos hoje", value: totalToday, sub: `IA: ${totalAiToday} · Reveal: ${totalRevealToday}`, highlight: true },
    { icon: "📊", bg: "#ede9fe", label: `Total (${days}d)`, value: totalPeriod, sub: `Média: ${avgPerDay.toFixed(1)}/dia`, highlight: false },
    { icon: "🔍", bg: "#fef3c7", label: "Busca IA", value: totalAiPeriod, sub: `${days} dias`, highlight: false },
    { icon: "🔓", bg: "#e0e7ff", label: "BI Reveal", value: totalRevealPeriod, sub: `${days} dias`, highlight: false },
    { icon: "👤", bg: "#d1fae5", label: "Usuários ativos", value: activeUsers, sub: `usaram créditos (${days}d)`, highlight: false },
  ];

  return (
    <AdminShell>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Créditos de Mercado IA</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Análise de uso de créditos de busca e revelação BI</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              {DAYS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  style={{
                    padding: "7px 14px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: days === opt.value ? 700 : 400,
                    backgroundColor: days === opt.value ? NAVY : "transparent",
                    color: days === opt.value ? "#fff" : "#555",
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => load(days)}
              style={{ padding: "8px 14px", backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
            >↻</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: MUTED }}>Carregando dados...</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 14 }}>
              {kpis.map((k) => (
                <div
                  key={k.label}
                  style={{
                    backgroundColor: k.highlight ? NAVY : "#fff",
                    border: `1px solid ${k.highlight ? NAVY : BORDER}`,
                    borderRadius: 14,
                    padding: 18,
                  }}
                >
                  <div style={{ width: 38, height: 38, backgroundColor: k.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, marginBottom: 10 }}>{k.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: k.highlight ? GOLD : NAVY, lineHeight: 1 }}>{fmt(k.value)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: k.highlight ? "#fff" : "#555", marginTop: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 11, color: k.highlight ? "rgba(255,255,255,0.5)" : MUTED, marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
              <div style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: GOLD }}>📈</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Créditos por dia ({days}d)</h3>
                </div>
                <p style={{ fontSize: 12, color: MUTED, margin: "0 0 14px" }}>Hover nos pontos para ver detalhes</p>
                <DualLineChart data={daily} />
              </div>

              <div style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ color: GOLD }}>🗓️</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Últimos 7 dias</h3>
                </div>
                <Last7Table data={daily} />
              </div>
            </div>

            {/* Top users */}
            <div style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: GOLD }}>🏆</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, margin: 0 }}>Top usuários por uso ({days}d)</h3>
                </div>
                {users.length > 0 && (
                  <span style={{ fontSize: 12, color: MUTED }}>{users.length} usuário{users.length !== 1 ? "s" : ""}</span>
                )}
              </div>
              <TopUsersTable users={users} />
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
