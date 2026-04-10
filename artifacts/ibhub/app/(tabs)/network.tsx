import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import {
  Defs,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Svg,
  Text as SvgText,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import * as API from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period    = "mes" | "trimestre" | "ano";
type MercadoTab = "visao" | "apresentacoes" | "top";

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  value: string;
}

// ─── Fallback data ─────────────────────────────────────────────────────────────

const FALLBACK: Record<Period, API.MarketOverview> = {
  mes: {
    period: "mes",
    kpis: [
      { label: "Exportações BR",       value: "US$ 3.8M",   period: "Mar/2026",  change: 9.2,  icon: "globe",       description: "Total exportado pelo Brasil em vinhos e derivados. Fonte: IBRAVIN / UVIBRA.",   source: "IBRAVIN",   updatedAt: "2026-04-01" },
      { label: "Importações de Vinho", value: "R$ 185M",    period: "Mar/2026",  change: 6.1,  icon: "trending-up", description: "Total importado pelo Brasil em vinhos de mesa e espumantes. Fonte: SECEX/MDIC.", source: "SECEX/MDIC", updatedAt: "2026-04-01" },
      { label: "Produção Nacional",    value: "29M litros", period: "Mar/2026",  change: 3.5,  icon: "bar-chart-2", description: "Volume total de uvas processadas no Brasil para vinhos. Fonte: IBRAVIN.",         source: "IBRAVIN",   updatedAt: "2026-04-01" },
    ],
    chart_area: {
      exports: [28, 30, 34, 38],
      imports: [68, 71, 77, 82],
      labels:  ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      yLabels: ["0", "50", "100", "150", "200"],
    },
    chart_bar: { values: [78, 75, 83, 81], labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"] },
    tendencias: [
      { title: "Espumantes brasileiros em alta",       desc: "Crescimento de 22% nas vendas de espumantes nacionais no mês de março.",          change: 22,   pos: true  },
      { title: "Vinhos naturais ganham espaço",        desc: "Segmento de vinhos naturais e orgânicos cresce 15% ao mês.",                       change: 15,   pos: true  },
      { title: "Importação de tintos chilenos recua",  desc: "Queda de 3.2% nas importações de tintos do Chile em relação à semana passada.",    change: -3.2, pos: false },
    ],
    regioes: [
      { rank: 1, name: "Serra Gaúcha",          volume: "15M litros", pct: 51 },
      { rank: 2, name: "Campanha Gaúcha",       volume: "4M litros",  pct: 13 },
      { rank: 3, name: "Vale do São Francisco", volume: "3M litros",  pct: 11 },
      { rank: 4, name: "Planalto Catarinense",  volume: "2M litros",  pct: 6  },
    ],
    variedades: [
      { name: "Merlot",             volume: "3.5M litros", change: 5.1 },
      { name: "Cabernet Sauvignon", volume: "3.2M litros", change: 3.8 },
      { name: "Chardonnay",         volume: "2.3M litros", change: 9.2 },
      { name: "Pinot Noir",         volume: "1.5M litros", change: 2.1 },
    ],
    updated_at: "",
  },
  trimestre: {
    period: "trimestre",
    kpis: [
      { label: "Exportações BR",       value: "US$ 11.2M", period: "Q1 2026",  change: 10.8, icon: "globe",       description: "Total exportado pelo Brasil em vinhos e derivados. Fonte: IBRAVIN / UVIBRA.",   source: "IBRAVIN",   updatedAt: "2026-04-01" },
      { label: "Importações de Vinho", value: "R$ 540M",   period: "Q1 2026",  change: 7.4,  icon: "trending-up", description: "Total importado pelo Brasil em vinhos de mesa e espumantes. Fonte: SECEX/MDIC.", source: "SECEX/MDIC", updatedAt: "2026-04-01" },
      { label: "Produção Nacional",    value: "88M litros",period: "Q1 2026",  change: 4.1,  icon: "bar-chart-2", description: "Volume total de uvas processadas no Brasil para vinhos. Fonte: IBRAVIN.",         source: "IBRAVIN",   updatedAt: "2026-04-01" },
    ],
    chart_area: {
      exports: [30, 34, 38],
      imports: [70, 76, 84],
      labels:  ["Jan", "Fev", "Mar"],
      yLabels: ["0", "150", "300", "450", "600"],
    },
    chart_bar: { values: [78, 82, 85], labels: ["Jan", "Fev", "Mar"] },
    tendencias: [
      { title: "Espumantes brasileiros em alta",       desc: "Crescimento de 18% nas vendas de espumantes nacionais no Q1 2026.",                change: 18,   pos: true  },
      { title: "Vinhos naturais ganham espaço",        desc: "Segmento de vinhos naturais e orgânicos cresce 12% no trimestre.",                  change: 12,   pos: true  },
      { title: "Importação de tintos chilenos recua",  desc: "Queda de 4.1% nas importações de tintos do Chile no Q1 em relação a Q1 anterior.", change: -4.1, pos: false },
    ],
    regioes: [
      { rank: 1, name: "Serra Gaúcha",          volume: "45M litros", pct: 51 },
      { rank: 2, name: "Campanha Gaúcha",       volume: "12M litros", pct: 13 },
      { rank: 3, name: "Vale do São Francisco", volume: "10M litros", pct: 11 },
      { rank: 4, name: "Planalto Catarinense",  volume: "5M litros",  pct: 6  },
    ],
    variedades: [
      { name: "Merlot",             volume: "10.5M litros", change: 4.8 },
      { name: "Cabernet Sauvignon", volume: "9.5M litros",  change: 3.5 },
      { name: "Chardonnay",         volume: "7M litros",    change: 8.9 },
      { name: "Pinot Noir",         volume: "4.5M litros",  change: 1.9 },
    ],
    updated_at: "",
  },
  ano: {
    period: "ano",
    kpis: [
      { label: "Exportações BR",       value: "US$ 42M",     period: "2025",  change: 12.5, icon: "globe",       description: "Total exportado pelo Brasil em vinhos e derivados. Fonte: IBRAVIN / UVIBRA.",   source: "IBRAVIN",   updatedAt: "2026-04-01" },
      { label: "Importações de Vinho", value: "R$ 2.1B",     period: "2025",  change: 8.3,  icon: "trending-up", description: "Total importado pelo Brasil em vinhos de mesa e espumantes. Fonte: SECEX/MDIC.", source: "SECEX/MDIC", updatedAt: "2026-04-01" },
      { label: "Produção Nacional",    value: "350M litros", period: "2025",  change: 4.7,  icon: "bar-chart-2", description: "Volume total de uvas processadas no Brasil para vinhos. Fonte: IBRAVIN.",         source: "IBRAVIN",   updatedAt: "2026-04-01" },
    ],
    chart_area: {
      exports: [32, 35, 38, 44],
      imports: [72, 79, 86, 91],
      labels:  ["Q1", "Q2", "Q3", "Q4"],
      yLabels: ["0", "150", "300", "450", "600"],
    },
    chart_bar: { values: [75, 80, 85, 87], labels: ["Q1", "Q2", "Q3", "Q4"] },
    tendencias: [
      { title: "Espumantes brasileiros em alta",       desc: "Crescimento de 22% nas vendas de espumantes nacionais em 2025, com destaque para a Serra Gaúcha.",  change: 22,   pos: true  },
      { title: "Vinhos naturais ganham espaço",        desc: "Segmento de vinhos naturais e orgânicos cresceu 15% ao ano, impulsionado por consumidores jovens.", change: 15,   pos: true  },
      { title: "Importação de tintos chilenos recua",  desc: "Queda de 3.2% nas importações de tintos do Chile em 2025 em relação ao ano anterior.",              change: -3.2, pos: false },
    ],
    regioes: [
      { rank: 1, name: "Serra Gaúcha",          volume: "180M litros", pct: 51 },
      { rank: 2, name: "Campanha Gaúcha",       volume: "45M litros",  pct: 13 },
      { rank: 3, name: "Vale do São Francisco", volume: "38M litros",  pct: 11 },
      { rank: 4, name: "Planalto Catarinense",  volume: "22M litros",  pct: 6  },
    ],
    variedades: [
      { name: "Merlot",             volume: "42M litros", change: 5.1 },
      { name: "Cabernet Sauvignon", volume: "38M litros", change: 3.8 },
      { name: "Chardonnay",         volume: "28M litros", change: 9.2 },
      { name: "Pinot Noir",         volume: "18M litros", change: 2.1 },
    ],
    updated_at: "",
  },
};

// ─── Area Chart with Tooltips ─────────────────────────────────────────────────

function AreaChart({ data }: { data: API.MarketChartArea }) {
  const W = 310, H = 140;
  const padL = 36, padR = 12, padT = 12, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = data.labels.length;
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, label: "", value: "" });

  const toX = (i: number) => padL + (i / (n - 1)) * chartW;
  const toY = (v: number) => padT + (1 - v / 100) * chartH;

  const exportsPath = data.exports.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(v)}`).join(" ");
  const importsPath = data.imports.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(v)}`).join(" ");
  const importsArea = `${importsPath} L${toX(n - 1)},${padT + chartH} L${padL},${padT + chartH} Z`;

  const handlePointPress = (series: "exports" | "imports", index: number) => {
    const val = series === "exports" ? data.exports[index] : data.imports[index];
    const seriesLabel = series === "exports" ? "Export." : "Import.";
    const px = toX(index);
    const py = toY(val);
    setTooltip({ visible: true, x: px, y: py, label: `${seriesLabel} · ${data.labels[index]}`, value: `${val}M` });
    setTimeout(() => setTooltip(t => ({ ...t, visible: false })), 2500);
  };

  return (
    <Svg width={W} height={H} style={{ overflow: "visible" }}>
      <Defs>
        <LinearGradient id="importGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ef4444" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#ef4444" stopOpacity="0.03" />
        </LinearGradient>
      </Defs>
      {data.yLabels.map((lbl, i) => {
        const y = padT + (i / (data.yLabels.length - 1)) * chartH;
        return (
          <React.Fragment key={lbl}>
            <Line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <SvgText x={padL - 4} y={y + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{lbl}</SvgText>
          </React.Fragment>
        );
      })}
      <Path d={importsArea} fill="url(#importGrad)" />
      <Path d={importsPath} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={exportsPath} fill="none" stroke="#c9a84c" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {data.labels.map((lbl, i) => (
        <SvgText key={lbl} x={toX(i)} y={H - 4} fontSize={10} fill="#9ca3af" textAnchor="middle">{lbl}</SvgText>
      ))}
      {data.exports.map((_, i) => (
        <Rect
          key={`exp-${i}`}
          x={toX(i) - 10} y={toY(data.exports[i]) - 10}
          width={20} height={20}
          fill="transparent"
          onPress={() => handlePointPress("exports", i)}
        />
      ))}
      {data.imports.map((_, i) => (
        <Rect
          key={`imp-${i}`}
          x={toX(i) - 10} y={toY(data.imports[i]) - 10}
          width={20} height={20}
          fill="transparent"
          onPress={() => handlePointPress("imports", i)}
        />
      ))}
      {data.exports.map((v, i) => (
        <React.Fragment key={`dot-exp-${i}`}>
          <Rect x={toX(i) - 5} y={toY(v) - 5} width={10} height={10} rx={5} fill="#c9a84c" />
        </React.Fragment>
      ))}
      {data.imports.map((v, i) => (
        <React.Fragment key={`dot-imp-${i}`}>
          <Rect x={toX(i) - 5} y={toY(v) - 5} width={10} height={10} rx={5} fill="#ef4444" />
        </React.Fragment>
      ))}
      {tooltip.visible && (
        <React.Fragment>
          <Rect
            x={Math.min(tooltip.x - 40, W - 92)}
            y={tooltip.y - 38}
            width={88} height={32}
            rx={6}
            fill="#1f2937"
            opacity={0.92}
          />
          <SvgText
            x={Math.min(tooltip.x - 40, W - 92) + 44}
            y={tooltip.y - 22}
            fontSize={10} fill="#fff" textAnchor="middle" fontWeight="600"
          >{tooltip.label}</SvgText>
          <SvgText
            x={Math.min(tooltip.x - 40, W - 92) + 44}
            y={tooltip.y - 10}
            fontSize={11} fill="#f9fafb" textAnchor="middle" fontWeight="700"
          >{tooltip.value}</SvgText>
        </React.Fragment>
      )}
    </Svg>
  );
}

// ─── Bar Chart with Tooltips ──────────────────────────────────────────────────

function BarChart({ data }: { data: API.MarketChartBar }) {
  const W = 310, H = 110;
  const padL = 36, padR = 12, padT = 8, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = data.values.length;
  const barW = (chartW / n) * 0.55;
  const gap  = chartW / n;
  const maxV = 100;
  const yLabels = ["0", "25", "50", "75", "100"];
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, label: "", value: "" });

  const handleBarPress = (index: number) => {
    const v = data.values[index];
    const x = padL + index * gap + (gap - barW) / 2 + barW / 2;
    const y = padT + chartH - (v / maxV) * chartH;
    setTooltip({ visible: true, x, y, label: data.labels[index], value: `${v}` });
    setTimeout(() => setTooltip(t => ({ ...t, visible: false })), 2500);
  };

  return (
    <Svg width={W} height={H}>
      {yLabels.map((lbl, i) => {
        const y = padT + (1 - Number(lbl) / maxV) * chartH;
        return (
          <React.Fragment key={lbl}>
            <Line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <SvgText x={padL - 4} y={y + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{lbl}</SvgText>
          </React.Fragment>
        );
      })}
      {data.values.map((v, i) => {
        const barH = (v / maxV) * chartH;
        const x    = padL + i * gap + (gap - barW) / 2;
        const y    = padT + chartH - barH;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={4} fill="#c9a84c" onPress={() => handleBarPress(i)} />
            <SvgText x={x + barW / 2} y={H - 6} fontSize={10} fill="#9ca3af" textAnchor="middle">
              {data.labels[i]}
            </SvgText>
          </React.Fragment>
        );
      })}
      {tooltip.visible && (
        <React.Fragment>
          <Rect
            x={Math.min(tooltip.x - 30, W - 72)}
            y={tooltip.y - 36}
            width={64} height={30}
            rx={6}
            fill="#1f2937"
            opacity={0.92}
          />
          <SvgText
            x={Math.min(tooltip.x - 30, W - 72) + 32}
            y={tooltip.y - 22}
            fontSize={10} fill="#fff" textAnchor="middle" fontWeight="600"
          >{tooltip.label}</SvgText>
          <SvgText
            x={Math.min(tooltip.x - 30, W - 72) + 32}
            y={tooltip.y - 11}
            fontSize={11} fill="#f9fafb" textAnchor="middle" fontWeight="700"
          >{tooltip.value}</SvgText>
        </React.Fragment>
      )}
    </Svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPIInfoModal {
  visible: boolean;
  kpi: API.MarketKPI | null;
}

function KPICard({ kpi, colors }: { kpi: API.MarketKPI; colors: any }) {
  const isPos = kpi.change >= 0;
  const [modal, setModal] = useState<KPIInfoModal>({ visible: false, kpi: null });

  return (
    <>
      <View style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
        <View style={styles.kpiLeft}>
          <View style={[styles.kpiIconBox, { backgroundColor: colors.gold + "18" }]}>
            <Feather name={kpi.icon as any} size={20} color={colors.gold} />
          </View>
          <View>
            <Text style={[styles.kpiLabel,  { color: colors.mutedForeground }]}>{kpi.label}</Text>
            <Text style={[styles.kpiPeriod, { color: colors.mutedForeground }]}>{kpi.period}</Text>
            <Text style={[styles.kpiValue,  { color: colors.navy }]}>{kpi.value}</Text>
          </View>
        </View>
        <View style={styles.kpiRight}>
          <Text style={[styles.kpiChange, { color: isPos ? "#16a34a" : "#dc2626" }]}>
            {isPos ? "↑" : "↓"} {isPos ? "+" : ""}{kpi.change}%
          </Text>
          <TouchableOpacity onPress={() => setModal({ visible: true, kpi })}>
            <Feather name="info" size={13} color={colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={modal.visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.kpiModalOverlay}
          activeOpacity={1}
          onPress={() => setModal({ visible: false, kpi: null })}
        >
          <View style={[styles.kpiModal, { backgroundColor: "#fff" }]}>
            <View style={[styles.kpiModalIconBox, { backgroundColor: colors.gold + "15" }]}>
              <Feather name={(modal.kpi?.icon ?? "info") as any} size={24} color={colors.gold} />
            </View>
            <Text style={[styles.kpiModalTitle, { color: colors.navy }]}>{modal.kpi?.label}</Text>
            <Text style={[styles.kpiModalDesc, { color: colors.mutedForeground }]}>
              {modal.kpi?.description ?? "Indicador de mercado do setor vitivinícola."}
            </Text>
            <View style={[styles.kpiModalDivider, { backgroundColor: colors.border }]} />
            <View style={styles.kpiModalMeta}>
              <Feather name="database" size={12} color={colors.mutedForeground} />
              <Text style={[styles.kpiModalMetaText, { color: colors.mutedForeground }]}>
                Fonte: {modal.kpi?.source ?? "IBRAVIN"}
              </Text>
            </View>
            {modal.kpi?.updatedAt ? (
              <View style={styles.kpiModalMeta}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.kpiModalMetaText, { color: colors.mutedForeground }]}>
                  Atualizado em {new Date(modal.kpi.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.kpiModalCloseBtn, { backgroundColor: colors.navy }]}
              onPress={() => setModal({ visible: false, kpi: null })}
            >
              <Text style={styles.kpiModalCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Apresentações Tab ────────────────────────────────────────────────────────

function ApresentacoesView({ colors, bottomPad }: { colors: any; bottomPad: number }) {
  const [items, setItems] = useState<API.MarketPresentation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.fetchMarketPresentations().then(data => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  if (loading) {
    return (
      <View style={styles.apresentacoesEmpty}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.apresentacoesEmpty}>
        <View style={[styles.apresentacoesIcon, { backgroundColor: colors.background }]}>
          <Feather name="monitor" size={36} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.apresentacoesTitle, { color: colors.navy }]}>
          Nenhuma apresentação disponível
        </Text>
        <Text style={[styles.apresentacoesSub, { color: colors.mutedForeground }]}>
          As apresentações de mercado serão publicadas em breve.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, rowGap: 14 }} showsVerticalScrollIndicator={false}>
      {items.map(p => (
        <TouchableOpacity
          key={p.id}
          style={[styles.presentCard, { backgroundColor: "#fff", borderColor: colors.border }]}
          onPress={() => openLink(p.content_url)}
          activeOpacity={0.82}
        >
          {p.cover_url ? (
            <Image source={{ uri: p.cover_url }} style={styles.presentCover} resizeMode="cover" />
          ) : (
            <View style={[styles.presentCoverPlaceholder, { backgroundColor: colors.gold + "12" }]}>
              <Feather name="monitor" size={32} color={colors.gold} />
            </View>
          )}
          <View style={styles.presentBody}>
            <Text style={[styles.presentTitle, { color: colors.navy }]}>{p.title}</Text>
            {p.description ? (
              <Text style={[styles.presentDesc, { color: colors.mutedForeground }]} numberOfLines={3}>{p.description}</Text>
            ) : null}
            <View style={styles.presentFooter}>
              <Feather name="external-link" size={13} color={colors.gold} />
              <Text style={[styles.presentLink, { color: colors.gold }]}>Abrir apresentação</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function LockedSection({ title, icon, colors }: { title: string; icon: string; colors: any }) {
  return (
    <View style={[styles.lockedCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={[styles.lockedIconBox, { backgroundColor: colors.gold + "15" }]}>
        <Feather name={icon as any} size={22} color={colors.gold} />
      </View>
      <Text style={[styles.lockedTitle, { color: colors.navy }]}>{title}</Text>
      <Text style={[styles.lockedSub, { color: colors.mutedForeground }]}>
        Esta seção não está incluída no seu plano atual.
      </Text>
      <View style={[styles.lockedBadge, { backgroundColor: colors.gold + "18" }]}>
        <Feather name="lock" size={12} color={colors.gold} />
        <Text style={[styles.lockedBadgeText, { color: colors.gold }]}>Faça upgrade para desbloquear</Text>
      </View>
    </View>
  );
}

export default function MercadoScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [period,       setPeriod]       = useState<Period>("ano");
  const [mainTab,      setMainTab]      = useState<MercadoTab>("visao");
  const [data,         setData]         = useState<API.MarketOverview>(FALLBACK.ano);
  const [loading,      setLoading]      = useState(false);
  const [leaderboard,  setLeaderboard]  = useState<API.LeaderboardEntry[]>([]);
  const [planFeatures, setPlanFeatures] = useState<string[] | null>(null);
  const [loadingTop,  setLoadingTop]  = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : 84 + insets.bottom;

  const cache = useRef<Partial<Record<Period, API.MarketOverview>>>({});

  const loadPeriod = useCallback(async (p: Period) => {
    if (cache.current[p]) { setData(cache.current[p]!); return; }
    setLoading(true);
    const result = await API.fetchMarketOverview(p);
    const resolved = result ?? FALLBACK[p];
    cache.current[p] = resolved;
    setData(resolved);
    setLoading(false);
  }, []);

  useEffect(() => { loadPeriod(period); }, [period, loadPeriod]);

  useEffect(() => {
    const planId = profile?.plan ?? "gratuito";
    API.fetchPlanFeatures(planId).then(feats => {
      setPlanFeatures(feats);
    }).catch(() => setPlanFeatures([]));
  }, [profile?.plan]);

  const can = useCallback((key: string): boolean => {
    if (planFeatures === null) return true;
    return planFeatures.includes(`mercado:${key}`);
  }, [planFeatures]);

  const loadLeaderboard = useCallback(async () => {
    setLoadingTop(true);
    const result = await API.fetchLeaderboard();
    setLeaderboard(result);
    setLoadingTop(false);
  }, []);

  useEffect(() => {
    if (mainTab === "top") loadLeaderboard();
  }, [mainTab, loadLeaderboard]);

  const mainTabRef = useRef(mainTab);
  useEffect(() => { mainTabRef.current = mainTab; }, [mainTab]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`network-connections-${user.id}_${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
          filter: `requester_id=eq.${user.id}`,
        },
        () => {
          if (mainTabRef.current === "top") loadLeaderboard();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          if (mainTabRef.current === "top") loadLeaderboard();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadLeaderboard]);

  const periods: { key: Period; label: string }[] = [
    { key: "mes",       label: "Último Mês"      },
    { key: "trimestre", label: "Trimestre (YTD)" },
    { key: "ano",       label: "Último Ano"      },
  ];

  const handleShare = async (t: API.MarketTendencia) => {
    try {
      await Share.share({
        title: t.title,
        message: `${t.title}\n\n${t.pos ? "+" : ""}${t.change}% — ${t.desc}`,
      });
    } catch (_) {}
  };

  // Max pct for relative progress bars in regioes
  const maxPct = data.regioes.length > 0 ? Math.max(...data.regioes.map(r => r.pct)) : 1;
  // Max volume value (parse numeric part) for variedades
  const parseVol = (v: string) => parseFloat(v.replace(/[^\d.]/g, "")) || 0;
  const maxVol   = data.variedades.length > 0 ? Math.max(...data.variedades.map(v => parseVol(v.volume))) : 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle,    { color: colors.navy }]}>Mercado</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Inteligência de mercado do vinho</Text>
        </View>
      </View>

      {/* Main Tabs */}
      <View style={[styles.mainTabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "visao",         label: "Visão Geral",   icon: "bar-chart-2" },
          { key: "apresentacoes", label: "Apresentações", icon: "monitor"     },
          { key: "top",           label: "Top Perfis",    icon: "award"       },
        ] as { key: MercadoTab; label: string; icon: any }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.mainTabBtn, mainTab === t.key && [styles.mainTabBtnActive, { backgroundColor: "#fff", borderColor: colors.border }]]}
            onPress={() => setMainTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={mainTab === t.key ? colors.navy : colors.mutedForeground} />
            <Text style={[styles.mainTabText, { color: mainTab === t.key ? colors.navy : colors.mutedForeground, fontWeight: mainTab === t.key ? "700" : "500" }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mainTab === "top" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.topTitle, { color: colors.navy }]}>🏆 Ranking Regional</Text>
          <Text style={[styles.topSub, { color: colors.mutedForeground }]}>Perfis com mais seguidores na ibhub</Text>
          {loadingTop ? (
            <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
          ) : leaderboard.length === 0 ? (
            <View style={styles.topEmpty}>
              <Text style={{ fontSize: 36 }}>🥂</Text>
              <Text style={[styles.topEmptyText, { color: colors.mutedForeground }]}>Nenhum perfil encontrado ainda.</Text>
            </View>
          ) : (
            leaderboard.map((entry, idx) => (
              <View key={entry.id} style={[styles.leaderRow, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <View style={[styles.leaderRank, {
                  backgroundColor: idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : idx === 2 ? "#b87333" : colors.secondary,
                }]}>
                  <Text style={[styles.leaderRankText, { color: idx < 3 ? "#fff" : colors.navy }]}>
                    {idx < 3 ? ["🥇","🥈","🥉"][idx] : `${idx + 1}`}
                  </Text>
                </View>
                <View style={styles.leaderAvatar}>
                  <View style={[styles.leaderAvatarCircle, { backgroundColor: colors.navyLight }]}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                      {(entry.full_name ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.leaderName, { color: colors.navy }]} numberOfLines={1}>{entry.full_name ?? "Usuário"}</Text>
                  {entry.headline ? (
                    <Text style={[styles.leaderHeadline, { color: colors.mutedForeground }]} numberOfLines={1}>{entry.headline}</Text>
                  ) : null}
                  {entry.location ? (
                    <View style={styles.leaderLocRow}>
                      <Feather name="map-pin" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.leaderLoc, { color: colors.mutedForeground }]}>{entry.location}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.leaderStats}>
                  <Text style={[styles.leaderFollowers, { color: colors.gold }]}>{entry.followers_count}</Text>
                  <Text style={[styles.leaderFollowersLabel, { color: colors.mutedForeground }]}>seguidores</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : mainTab === "apresentacoes" ? (
        <ApresentacoesView colors={colors} bottomPad={bottomPad} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>

          {/* Period filter */}
          <View style={[styles.periodRow, { backgroundColor: "#fff" }]}>
            {periods.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodBtn, period === p.key && [styles.periodBtnActive, { backgroundColor: colors.gold }]]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.periodBtnText, { color: period === p.key ? "#fff" : colors.mutedForeground }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} size="large" />
          ) : (
            <>
              {/* KPIs */}
              {can("kpis") ? (
                <View style={styles.kpiList}>
                  {data.kpis.map(kpi => (
                    <KPICard key={kpi.label} kpi={kpi} colors={colors} />
                  ))}
                </View>
              ) : (
                <LockedSection title="KPIs de Mercado" icon="activity" colors={colors} />
              )}

              {/* Área: Exportações vs Importações */}
              {can("graficos") ? (
                <>
                  <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    <View style={styles.chartHeader}>
                      <Text style={[styles.chartTitle, { color: colors.navy }]}>Evolução de Exportações {"&"} Importações</Text>
                    </View>
                    <AreaChart data={data.chart_area} />
                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.gold }]} />
                        <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Exportações</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                        <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Importações</Text>
                      </View>
                      <TouchableOpacity style={styles.fonteBtn}>
                        <Feather name="info" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>Fonte</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.chartHint, { color: colors.mutedForeground }]}>
                      Toque num ponto para ver o valor exato
                    </Text>
                  </View>

                  {/* Barras: Produção Nacional */}
                  <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    <View style={styles.chartHeader}>
                      <Text style={[styles.chartTitle, { color: colors.navy }]}>Produção Nacional por Período</Text>
                    </View>
                    <BarChart data={data.chart_bar} />
                    <TouchableOpacity style={[styles.fonteBtn, { alignSelf: "flex-end" }]}>
                      <Feather name="info" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>Fonte</Text>
                    </TouchableOpacity>
                    <Text style={[styles.chartHint, { color: colors.mutedForeground }]}>
                      Toque numa barra para ver o valor
                    </Text>
                  </View>
                </>
              ) : (
                <LockedSection title="Gráficos" icon="bar-chart-2" colors={colors} />
              )}

              {/* Tendências */}
              {can("tendencias") ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>Tendências</Text>
                  {data.tendencias.map(t => (
                    <View key={t.title} style={[styles.tendCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                      <View style={styles.tendHeader}>
                        <Text style={[styles.tendTitle, { color: colors.navy }]}>{t.title}</Text>
                        <Text style={[styles.tendChange, { color: t.pos ? "#16a34a" : "#dc2626" }]}>
                          {t.pos ? "+" : ""}{t.change}%
                        </Text>
                      </View>
                      <Text style={[styles.tendDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
                      <View style={styles.tendFooter}>
                        <TouchableOpacity style={styles.fonteBtn}>
                          <Feather name="info" size={11} color={colors.mutedForeground} />
                          <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>Fonte</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.shareBtn, { backgroundColor: colors.gold + "15" }]}
                          onPress={() => handleShare(t)}
                        >
                          <Feather name="share-2" size={13} color={colors.gold} />
                          <Text style={[styles.shareText, { color: colors.gold }]}>Partilhar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <LockedSection title="Tendências" icon="trending-up" colors={colors} />
              )}

              {/* Regiões Produtoras */}
              {can("regioes") ? (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={{ fontSize: 18, marginRight: 6 }}>🍇</Text>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>Regiões Produtoras</Text>
                </View>
                <View style={[styles.tableCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {data.regioes.map((r, idx) => (
                    <View
                      key={r.name}
                      style={[styles.tableRow, { borderBottomColor: colors.border }, idx === data.regioes.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <Text style={[styles.tableRank, { color: colors.mutedForeground }]}>{r.rank}</Text>
                      <View style={styles.tableMain}>
                        <View style={styles.tableNameRow}>
                          <Text style={[styles.tableName, { color: colors.navy }]}>{r.name}</Text>
                          <Text style={[styles.tablePct, { color: colors.navy }]}>{r.pct}%</Text>
                        </View>
                        <Text style={[styles.tableVolume, { color: colors.mutedForeground }]}>{r.volume}</Text>
                        <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                          <View
                            style={[
                              styles.progressFill,
                              { backgroundColor: colors.gold, width: `${(r.pct / maxPct) * 100}%` },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={[styles.fonteBtn, { alignSelf: "flex-end", padding: 10 }]}>
                    <Feather name="info" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>Fonte</Text>
                  </TouchableOpacity>
                </View>
              </View>
              ) : (
                <LockedSection title="Regiões Produtoras" icon="map-pin" colors={colors} />
              )}

              {/* Variedades em Destaque */}
              {can("variedades") ? (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={{ fontSize: 18, marginRight: 6 }}>🍷</Text>
                    <Text style={[styles.sectionTitle, { color: colors.navy }]}>Variedades em Destaque</Text>
                  </View>
                  <View style={[styles.tableCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    {data.variedades.map((v, idx) => {
                      const vol = parseVol(v.volume);
                      const barPct = maxVol > 0 ? (vol / maxVol) * 100 : 0;
                      return (
                        <View
                          key={v.name}
                          style={[styles.tableRow, { borderBottomColor: colors.border }, idx === data.variedades.length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={styles.tableMain}>
                            <View style={styles.tableNameRow}>
                              <Text style={[styles.tableName, { color: colors.navy }]}>{v.name}</Text>
                              <Text style={[styles.tablePct, { color: v.change >= 0 ? "#16a34a" : "#dc2626" }]}>
                                {v.change >= 0 ? "+" : ""}{v.change}%
                              </Text>
                            </View>
                            <Text style={[styles.tableVolume, { color: colors.mutedForeground }]}>{v.volume}</Text>
                            <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                              <View
                                style={[
                                  styles.progressFill,
                                  { backgroundColor: v.change >= 0 ? "#16a34a" : "#dc2626", width: `${barPct}%` },
                                ]}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <LockedSection title="Variedades em Destaque" icon="git-merge" colors={colors} />
              )}

              {/* Última atualização */}
              {data.updated_at ? (
                <Text style={[styles.updatedAt, { color: colors.mutedForeground }]}>
                  Atualizado em {new Date(data.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle:    { fontSize: 26, fontWeight: "800" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },

  lockedCard:       { marginHorizontal: 16, marginTop: 4, marginBottom: 4, borderRadius: 12, borderWidth: 1, padding: 20, alignItems: "center", gap: 8 },
  lockedIconBox:    { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  lockedTitle:      { fontSize: 16, fontWeight: "700" },
  lockedSub:        { fontSize: 13, textAlign: "center", lineHeight: 18 },
  lockedBadge:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginTop: 4 },
  lockedBadgeText:  { fontSize: 12, fontWeight: "600" },

  mainTabRow:      { flexDirection: "row", padding: 8, gap: 6, borderBottomWidth: 1 },
  mainTabBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "transparent" },
  mainTabBtnActive:{},
  mainTabText:     { fontSize: 12 },
  // Leaderboard
  topTitle:         { fontSize: 20, fontWeight: "800", paddingHorizontal: 16, paddingTop: 12 },
  topSub:           { fontSize: 13, paddingHorizontal: 16, paddingBottom: 12 },
  topEmpty:         { alignItems: "center", gap: 10, paddingTop: 60 },
  topEmptyText:     { fontSize: 14 },
  leaderRow:        { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  leaderRank:       { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  leaderRankText:   { fontSize: 14, fontWeight: "800" },
  leaderAvatar:     {},
  leaderAvatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  leaderName:       { fontSize: 14, fontWeight: "700" },
  leaderHeadline:   { fontSize: 12, marginTop: 1 },
  leaderLocRow:     { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  leaderLoc:        { fontSize: 11 },
  leaderStats:      { alignItems: "flex-end" },
  leaderFollowers:  { fontSize: 18, fontWeight: "800" },
  leaderFollowersLabel: { fontSize: 10 },

  periodRow:       { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  periodBtn:       { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 20 },
  periodBtnActive: {},
  periodBtnText:   { fontSize: 12, fontWeight: "600" },

  kpiList:    { gap: 10, paddingHorizontal: 16, paddingTop: 4 },
  kpiCard:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 12, borderWidth: 1 },
  kpiLeft:    { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  kpiIconBox: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiLabel:   { fontSize: 12 },
  kpiPeriod:  { fontSize: 11 },
  kpiValue:   { fontSize: 22, fontWeight: "800", marginTop: 2 },
  kpiRight:   { alignItems: "flex-end", gap: 6 },
  kpiChange:  { fontSize: 14, fontWeight: "700" },

  kpiModalOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 28 },
  kpiModal:           { width: "100%", maxWidth: 340, borderRadius: 18, padding: 22, alignItems: "center", gap: 10, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 18, elevation: 8 },
  kpiModalIconBox:    { width: 54, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  kpiModalTitle:      { fontSize: 18, fontWeight: "800", textAlign: "center" },
  kpiModalDesc:       { fontSize: 13, lineHeight: 19, textAlign: "center" },
  kpiModalDivider:    { height: 1, width: "100%", marginVertical: 4 },
  kpiModalMeta:       { flexDirection: "row", alignItems: "center", gap: 6 },
  kpiModalMetaText:   { fontSize: 12 },
  kpiModalCloseBtn:   { marginTop: 8, paddingHorizontal: 36, paddingVertical: 12, borderRadius: 10 },
  kpiModalCloseBtnText:{ color: "#fff", fontSize: 14, fontWeight: "700" },

  chartCard:   { margin: 16, marginTop: 10, padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  chartHeader: {},
  chartTitle:  { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  chartHint:   { fontSize: 11, textAlign: "center", marginTop: -4 },
  legend:      { flexDirection: "row", alignItems: "center", gap: 14 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: 12 },
  fonteBtn:    { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" },
  fonteText:   { fontSize: 11 },

  section:         { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center" },
  sectionTitle:    { fontSize: 18, fontWeight: "800" },

  tendCard:    { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  tendHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tendTitle:   { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8, lineHeight: 20 },
  tendChange:  { fontSize: 14, fontWeight: "800" },
  tendDesc:    { fontSize: 13, lineHeight: 19 },
  tendFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  shareBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  shareText:   { fontSize: 12, fontWeight: "600" },

  tableCard:     { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tableRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1 },
  tableRank:     { width: 22, fontSize: 14, fontWeight: "600" },
  tableMain:     { flex: 1, gap: 4 },
  tableNameRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tableName:     { fontSize: 15, fontWeight: "600" },
  tableVolume:   { fontSize: 12 },
  tablePct:      { fontSize: 15, fontWeight: "700" },
  progressBg:    { height: 5, borderRadius: 3, overflow: "hidden", marginTop: 2 },
  progressFill:  { height: 5, borderRadius: 3 },

  updatedAt: { fontSize: 11, textAlign: "center", paddingVertical: 12 },

  apresentacoesEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 },
  apresentacoesIcon:  { width: 80, height: 80, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  apresentacoesTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  apresentacoesSub:   { fontSize: 14, textAlign: "center", lineHeight: 20 },

  presentCard:           { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  presentCover:          { width: "100%", height: 160 },
  presentCoverPlaceholder:{ width: "100%", height: 120, alignItems: "center", justifyContent: "center" },
  presentBody:           { padding: 14, rowGap: 6 },
  presentTitle:          { fontSize: 16, fontWeight: "700" },
  presentDesc:           { fontSize: 13, lineHeight: 19 },
  presentFooter:         { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  presentLink:           { fontSize: 13, fontWeight: "600" },
});
