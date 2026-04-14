import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MARKET_FALLBACK, MarketOverview, Period, fetchMarketOverview, fetchMarketPresentations, MarketPresentation } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const MUTED = "#7a8494";
const BORDER = "#e8e8e3";

type MercadoTab = "visao" | "top" | "apresentacoes";

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
  const maxV = 100;

  const xAt = (i: number) => PL + i * gap + (gap - barW) / 2;
  const yTop = (v: number) => PT + (1 - v / maxV) * CH;
  const yH = (v: number) => (v / maxV) * CH;

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
        <div key={p.id} style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
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

export default function MercadoPage() {
  const [period, setPeriod] = useState<Period>("ano");
  const [mainTab, setMainTab] = useState<MercadoTab>("visao");
  const [data, setData] = useState<MarketOverview>(MARKET_FALLBACK.ano);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mainTab === "apresentacoes") return;
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
    { key: "visao",          label: "📊 Visão Geral" },
    { key: "top",            label: "🏆 Rankings" },
    { key: "apresentacoes",  label: "📋 Apresentações" },
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
          {/* Period selector (hidden on Apresentações) */}
          {mainTab !== "apresentacoes" && (
            <div style={{ display: "flex", gap: 6 }}>
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 20,
                    border: `1px solid ${period === p.key ? GOLD : "#e8eaed"}`,
                    backgroundColor: period === p.key ? GOLD : "#fff",
                    color: period === p.key ? "#fff" : "#555",
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

        {mainTab === "apresentacoes" ? (
          <ApresentacoesPanel />
        ) : loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>⏳ Carregando dados...</div>
        ) : mainTab === "visao" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
              {data.kpis.map((kpi) => (
                <div key={kpi.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
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
            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ color: GOLD }}>📈</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Exportações × Importações</h3>
              </div>
              <AreaChart data={data.chart_area} />
            </div>

            {/* Bar Chart */}
            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ color: GOLD }}>📊</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Produção Nacional (Índice)</h3>
              </div>
              <BarChart data={data.chart_bar} />
            </div>

            {/* Tendências */}
            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
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
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18,
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
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Rankings de Regiões */}
            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span>🗺️</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Ranking por Região Produtora</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.regioes.map((r) => (
                  <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: GOLD, width: 24, textAlign: "center" }}>#{r.rank}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{r.name}</span>
                        <span style={{ fontSize: 13, color: GOLD, fontWeight: 700 }}>{r.volume}</span>
                      </div>
                      <div style={{ height: 6, backgroundColor: "#e8eaed", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${r.pct}%`, backgroundColor: GOLD, borderRadius: 3 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: "#aaa", width: 36, textAlign: "right" }}>{r.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Variedades */}
            <div style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span>🍇</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Top Variedades</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.variedades.map((v, idx) => (
                  <div key={v.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#f9fafb", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>#{idx + 1}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{v.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, color: "#8a93a2" }}>{v.volume}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: v.change >= 0 ? "#16a34a" : "#dc2626" }}>
                        {v.change >= 0 ? "+" : ""}{v.change}%
                      </span>
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
