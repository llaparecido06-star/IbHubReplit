import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
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
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallScreen } from "@/components/ui/PaywallScreen";
import * as API from "@/services/api";
import { compressPostImage } from "@/utils/compressImage";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period    = "mes" | "trimestre" | "ano";
type MercadoTab = "visao" | "apresentacoes" | "idealbi";
type IdealBISubTab = "feed" | "search";

// ─── Ideal.BI Search Mock Data ─────────────────────────────────────────────────
interface WineRecord {
  id?: number;
  marcaCompleta: string;
  marcaRelatorio?: string;
  distribuidor: string;
}

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

// ─── Inline video players (hooks must live at component level) ────────────────

function NetworkPostVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: "100%", height: 220, backgroundColor: "#000" } as any}
    />
  );
}

function NetworkMediaPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: "100%", height: 180, borderRadius: 10, backgroundColor: "#000" } as any}
    />
  );
}

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

// ─── Slide Viewer Modal ────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get("window").width;

function SlideViewerModal({
  visible,
  presentation,
  onClose,
  colors,
  session,
}: {
  visible: boolean;
  presentation: API.MarketPresentation | null;
  onClose: () => void;
  colors: any;
  session: any;
}) {
  const [slides, setSlides]   = useState<API.PresentationSlide[]>([]);
  const [total, setTotal]     = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (!visible || !presentation || !session?.access_token) return;
    setLoading(true);
    setCurrentIdx(0);
    const token = session.access_token;
    API.triggerPresentationAccess(presentation.id, token).then(() =>
      API.fetchPresentationSlides(presentation.id, token)
    ).then(result => {
      setSlides(result.slides);
      setTotal(result.total);
      setUnlocked(result.unlocked);
      setLoading(false);
    });
  }, [visible, presentation, session]);

  const renderSlide = ({ item, index }: { item: API.PresentationSlide; index: number }) => {
    if (item.locked || !item.url) {
      return (
        <View style={[sliderStyles.slide, { width: SCREEN_W }]}>
          <View style={[sliderStyles.lockedSlide, { backgroundColor: colors.background }]}>
            <View style={[sliderStyles.lockIconBox, { backgroundColor: colors.gold + "15" }]}>
              <Feather name="lock" size={36} color={colors.gold} />
            </View>
            <Text style={[sliderStyles.lockedTitle, { color: colors.navy }]}>Conteúdo em breve</Text>
            <Text style={[sliderStyles.lockedSub, { color: colors.mutedForeground }]}>
              Este slide ainda não foi desbloqueado para o seu plano.
            </Text>
            <View style={[sliderStyles.lockedBadge, { backgroundColor: colors.gold + "15" }]}>
              <Feather name="clock" size={13} color={colors.gold} />
              <Text style={[sliderStyles.lockedBadgeText, { color: colors.gold }]}>Aguarde o desbloqueio</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[sliderStyles.slide, { width: SCREEN_W }]}>
        <Image
          source={{ uri: item.url }}
          style={sliderStyles.slideImage}
          resizeMode="contain"
        />
        <TouchableOpacity
          style={sliderStyles.slideOverlay}
          activeOpacity={1}
          onPress={() => {}}
          onLongPress={() => {}}
          delayLongPress={50}
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[sliderStyles.container, { backgroundColor: "#000" }]}>
        {/* Header */}
        <View style={[sliderStyles.modalHeader, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
          <TouchableOpacity onPress={onClose} style={sliderStyles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={sliderStyles.modalTitle} numberOfLines={1}>{presentation?.title}</Text>
            {total > 0 && (
              <Text style={sliderStyles.slideCounter}>
                {unlocked} de {total} slides disponíveis
              </Text>
            )}
          </View>
          <Text style={sliderStyles.pageIndicator}>
            {slides.length > 0 ? `${currentIdx + 1}/${slides.length}` : ""}
          </Text>
        </View>

        {loading ? (
          <View style={sliderStyles.loadingBox}>
            <ActivityIndicator size="large" color="#c9a84c" />
            <Text style={{ color: "#fff", marginTop: 12, fontSize: 13 }}>Carregando slides...</Text>
          </View>
        ) : slides.length === 0 ? (
          <View style={sliderStyles.loadingBox}>
            <Feather name="image" size={48} color="#4b5563" />
            <Text style={{ color: "#9ca3af", marginTop: 12, fontSize: 14, textAlign: "center" }}>
              Nenhum slide disponível para esta apresentação.
            </Text>
          </View>
        ) : (
          <FlatList
            data={slides}
            keyExtractor={(item) => item.slide_id}
            renderItem={renderSlide}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              setCurrentIdx(idx);
            }}
            getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
            bounces={false}
          />
        )}
      </View>
    </Modal>
  );
}

const sliderStyles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#000" },
  modalHeader:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 52 : 20, paddingBottom: 14 },
  closeBtn:        { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  modalTitle:      { fontSize: 15, fontWeight: "700", color: "#fff" },
  slideCounter:    { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  pageIndicator:   { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  loadingBox:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  slide:           { flex: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  slideImage:      { width: SCREEN_W, flex: 1 },
  slideOverlay:    { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "transparent" },
  lockedSlide:     { flex: 1, width: SCREEN_W, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  lockIconBox:     { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  lockedTitle:     { fontSize: 20, fontWeight: "800" },
  lockedSub:       { fontSize: 14, textAlign: "center", lineHeight: 20 },
  lockedBadge:     { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  lockedBadgeText: { fontSize: 13, fontWeight: "600" },
});

// ─── Apresentações Tab ────────────────────────────────────────────────────────

function ApresentacoesView({ colors, bottomPad, session, isAdmin }: { colors: any; bottomPad: number; session: any; isAdmin?: boolean }) {
  const router = useRouter();
  const { hasFeature, isLoading: permLoading } = usePermissions();
  const hasAccess = hasFeature("mercado:apresentacoes") || !!isAdmin;

  const [items, setItems]                   = useState<API.MarketPresentation[]>([]);
  const [loading, setLoading]               = useState(true);
  const [slideCounts, setSlideCounts]       = useState<Record<string, { total: number; unlocked: number }>>({});
  const [viewerPresentation, setViewerPresentation] = useState<API.MarketPresentation | null>(null);
  const [viewerVisible, setViewerVisible]   = useState(false);

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    API.fetchMarketPresentations().then(async data => {
      setItems(data);
      setLoading(false);
      if (session?.access_token && data.length > 0) {
        const counts: Record<string, { total: number; unlocked: number }> = {};
        await Promise.all(
          data.map(async p => {
            const result = await API.fetchPresentationSlides(p.id, session.access_token);
            counts[p.id] = { total: result.total, unlocked: result.unlocked };
          })
        );
        setSlideCounts(counts);
      }
    });
  }, [hasAccess, session]);

  const openPresentation = (p: API.MarketPresentation) => {
    setViewerPresentation(p);
    setViewerVisible(true);
  };

  if (permLoading) {
    return (
      <View style={styles.apresentacoesEmpty}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (!hasAccess) {
    return (
      <PaywallScreen
        featureName="Apresentações de Mercado"
        description="Acesse relatórios e apresentações exclusivos do mercado vitivinícola, com slides desbloqueados progressivamente conforme seu plano."
        requiredPlan="Profissional"
      />
    );
  }

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
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, rowGap: 14 }} showsVerticalScrollIndicator={false}>
        {/* Admin shortcut */}
        {isAdmin && (
          <TouchableOpacity
            onPress={() => router.push("/admin/slides-mercado" as any)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.gold + "14", borderWidth: 1, borderColor: colors.gold + "40", borderRadius: 12, padding: 14, marginBottom: 4 }}
            activeOpacity={0.8}
          >
            <Feather name="settings" size={18} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.navy }}>Gerenciar Apresentações</Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Criar, editar e fazer upload de slides</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        {items.map(p => {
          const counts = slideCounts[p.id];
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.presentCard, { backgroundColor: "#fff", borderColor: colors.border }]}
              onPress={() => openPresentation(p)}
              onLongPress={() => {}}
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
                  {counts && counts.total > 0 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <Feather name="layers" size={13} color={colors.gold} />
                      <Text style={[styles.presentLink, { color: colors.gold }]}>
                        {counts.unlocked} de {counts.total} slides disponíveis
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <Feather name="monitor" size={13} color={colors.gold} />
                      <Text style={[styles.presentLink, { color: colors.gold }]}>Ver apresentação</Text>
                    </View>
                  )}
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <SlideViewerModal
        visible={viewerVisible}
        presentation={viewerPresentation}
        onClose={() => setViewerVisible(false)}
        colors={colors}
        session={session}
      />
    </>
  );
}

// ─── Ideal.BI Busca com IA ────────────────────────────────────────────────────

function IdealBISearchView({ colors, bottomPad }: { colors: ReturnType<typeof useColors>; bottomPad: number }) {
  const router = useRouter();
  const { session } = useAuth();

  const [query, setQuery]               = useState("");
  const [credits, setCredits]           = useState<number | null>(null);
  const [creditsTotal, setCreditsTotal] = useState(3);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [searching, setSearching]       = useState(false);
  const [result, setResult]             = useState<WineRecord | null | "not_found">(null);

  const exhausted = credits === 0;
  const creditColor = (credits ?? 3) >= 2 ? "#16a34a" : (credits ?? 3) === 1 ? "#d97706" : "#dc2626";
  const creditBg    = (credits ?? 3) >= 2 ? "#dcfce7" : (credits ?? 3) === 1 ? "#fef3c7" : "#fef2f2";

  const authHeader = (): HeadersInit =>
    session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};

  const loadCredits = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/wine-imports/credits`, {
        headers: authHeader(),
      });
      if (!res.ok) return;
      const json = await res.json() as { credits_remaining: number; credits_total: number };
      setCredits(json.credits_remaining);
      setCreditsTotal(json.credits_total);
    } catch {
    } finally {
      setCreditsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { loadCredits(); }, [loadCredits]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || searching || exhausted) return;
    setSearching(true);
    setResult(null);
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/wine-imports/search?q=${encodeURIComponent(q)}`,
        { headers: authHeader() }
      );
      if (res.status === 402) {
        setCredits(0);
        setResult("not_found");
        setSearching(false);
        return;
      }
      if (!res.ok) throw new Error("server error");
      const json = await res.json() as {
        data: { id: number; marca_completa: string; marca_relatorio: string | null; distribuidor: string | null }[];
        credits_remaining: number;
        credits_total: number;
      };
      setCredits(json.credits_remaining);
      setCreditsTotal(json.credits_total);
      const rows = json.data ?? [];
      if (rows.length > 0) {
        const first = rows[0];
        setResult({
          id: first.id,
          marcaCompleta: first.marca_completa,
          marcaRelatorio: first.marca_relatorio ?? undefined,
          distribuidor: first.distribuidor ?? "—",
        });
      } else {
        setResult("not_found");
      }
    } catch {
      setResult("not_found");
    }
    setSearching(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Credits KPI card — same style as Visão Geral KPIs ── */}
      <View style={[styles.kpiList, { paddingTop: 12 }]}>
        <View style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.kpiLeft}>
            <View style={[styles.kpiIconBox, { backgroundColor: colors.gold + "18" }]}>
              {creditsLoading
                ? <ActivityIndicator size="small" color={colors.gold} />
                : <Feather name="zap" size={20} color={colors.gold} />
              }
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Consultas Restantes</Text>
              <Text style={[styles.kpiPeriod, { color: colors.mutedForeground }]}>
                Ideal.BI · Busca com IA · {creditsTotal}/mês
              </Text>
              <Text style={[styles.kpiValue, { color: exhausted ? "#dc2626" : colors.navy }]}>
                {creditsLoading ? "—" : String(credits ?? "—")}
              </Text>
            </View>
          </View>
          <View style={styles.kpiRight}>
            {!creditsLoading && (
              <View style={{ backgroundColor: creditBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: creditColor }}>
                  {exhausted ? "Esgotado" : credits === 1 ? "Crítico" : "Ativo"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Paywall (only visible when exhausted) ── */}
      {exhausted && (
        <View style={[styles.lockedCard, { backgroundColor: "#fff", borderColor: "#fca5a5" }]}>
          <View style={[styles.lockedIconBox, { backgroundColor: "#fef2f2" }]}>
            <Feather name="lock" size={22} color="#dc2626" />
          </View>
          <Text style={[styles.lockedTitle, { color: colors.navy }]}>Limite de consultas esgotado</Text>
          <Text style={[styles.lockedSub, { color: colors.mutedForeground }]}>
            Faça o upgrade de plano para continuar descobrindo quem importa e exporta vinhos no mercado.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.gold, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 }}
            onPress={() => router.push("/subscription")}
            activeOpacity={0.8}
          >
            <Feather name="zap" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Fazer Upgrade</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Search section ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        {/* Section label */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Pesquisar vinho
        </Text>

        {/* Search input — ChatGPT style */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: "#fff", borderWidth: 1.5,
          borderColor: exhausted ? "#fca5a5" : searching ? colors.gold : colors.border,
          borderRadius: 14, paddingLeft: 14, paddingRight: 8, paddingVertical: 4,
        }}>
          <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 2 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={exhausted ? "Limite de consultas esgotado" : "Ex: Casillero del Diablo Reserva…"}
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: 13 }}
            editable={!exhausted && !searching}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            onPress={handleSearch}
            disabled={!query.trim() || searching || exhausted}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
              backgroundColor: (!query.trim() || searching || exhausted) ? colors.border : colors.gold,
            }}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="search" size={13} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 0.5 }}>IA</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Suggestion chips — same style as period filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
            {["Casillero del Diablo", "Penfolds Bin 389", "Santa Julia", "Passo Fundo Malbec", "Sogrape"].map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.periodBtn, { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border }]}
                onPress={() => { if (!exhausted && !searching) { setQuery(s); } }}
                disabled={exhausted || searching}
              >
                <Text style={[styles.periodBtnText, { color: colors.mutedForeground }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── Loading state ── */}
      {searching && (
        <View style={[styles.kpiList, { paddingTop: 12 }]}>
          <View style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.gold + "40" }]}>
            <View style={styles.kpiLeft}>
              <View style={[styles.kpiIconBox, { backgroundColor: colors.gold + "18" }]}>
                <ActivityIndicator size="small" color={colors.gold} />
              </View>
              <View>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Inteligência Artificial</Text>
                <Text style={[styles.kpiValue, { fontSize: 16, color: colors.navy }]}>Analisando mercado…</Text>
                <Text style={[styles.kpiPeriod, { color: colors.mutedForeground }]}>
                  Consultando importadores e exportadores
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── Not found ── */}
      {!searching && result === "not_found" && (
        <View style={[styles.lockedCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={[styles.lockedIconBox, { backgroundColor: colors.gold + "15" }]}>
            <Feather name="search" size={22} color={colors.gold} />
          </View>
          <Text style={[styles.lockedTitle, { color: colors.navy }]}>Vinho não encontrado</Text>
          <Text style={[styles.lockedSub, { color: colors.mutedForeground }]}>
            Não encontramos esse vinho na base de dados. Tente outro nome ou variação.
          </Text>
        </View>
      )}

      {/* ── Result — KPI cards matching Visão Geral ── */}
      {!searching && result && result !== "not_found" && (
        <View style={[styles.kpiList, { paddingTop: 12 }]}>

          {/* Brand header card */}
          <View style={[styles.kpiCard, { backgroundColor: colors.gold, borderColor: colors.gold, flexDirection: "column", alignItems: "flex-start", gap: 2 }]}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.75)", letterSpacing: 0.8, textTransform: "uppercase" }}>
              Resultado encontrado
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff", lineHeight: 24 }}>
              {result.marcaCompleta}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Feather name="check-circle" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
                1 consulta utilizada · {credits} restante{credits !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {/* Data KPI cards */}
          {([
            ...(result.marcaRelatorio && result.marcaRelatorio !== result.marcaCompleta
              ? [{ icon: "tag",   label: "Marca no Relatório", value: result.marcaRelatorio }]
              : []),
            { icon: "package",  label: "Distribuidor BR",  value: result.distribuidor },
          ] as { icon: any; label: string; value: string }[]).map(row => (
            <View key={row.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={styles.kpiLeft}>
                <View style={[styles.kpiIconBox, { backgroundColor: colors.gold + "18" }]}>
                  <Feather name={row.icon} size={20} color={colors.gold} />
                </View>
                <View>
                  <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[styles.kpiValue, { fontSize: 16, color: colors.navy }]}>{row.value}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Empty state hint (no search yet) ── */}
      {!searching && result === null && !exhausted && (
        <View style={[styles.kpiList, { paddingTop: 12 }]}>
          <View style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.kpiLeft}>
              <View style={[styles.kpiIconBox, { backgroundColor: colors.gold + "18" }]}>
                <Feather name="info" size={20} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Como funciona</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.navy, marginTop: 2, lineHeight: 18 }}>
                  Digite o nome de um vinho para descobrir exportadores e distribuidores no Brasil.
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Ideal.BI Feed (Mobile) ───────────────────────────────────────────────────

function IdealBIAvatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const colors = useColors();
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2 } as any} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.navyLight, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.4 }}>{(name ?? "?").charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// ─── Forum Comment Item ───────────────────────────────────────────────────────

function MarketCommentItem({
  comment,
  postId,
  userId,
  colors,
  depth = 0,
  onReply,
}: {
  comment: API.MarketComment;
  postId: string;
  userId: string;
  colors: ReturnType<typeof useColors>;
  depth?: number;
  onReply: (comment: API.MarketComment) => void;
}) {
  const isReply = depth > 0;
  const authorName  = comment.author?.full_name ?? "Usuário";
  const authorPos   = comment.author?.position;
  const authorComp  = comment.author?.company;
  const subtitle    = [authorPos, authorComp].filter(Boolean).join(" · ");
  const timeStr     = new Date(comment.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <View style={{ marginLeft: isReply ? 36 : 0, marginBottom: 10 }}>
      {/* Reply thread line */}
      {isReply && (
        <View style={{ position: "absolute", left: -20, top: 0, bottom: 0, width: 2, backgroundColor: colors.border }} />
      )}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <IdealBIAvatar src={comment.author?.avatar_url} name={authorName} size={isReply ? 26 : 32} />
        <View style={{ flex: 1 }}>
          <View style={{
            backgroundColor: isReply ? "#f8f6f2" : colors.secondary,
            borderRadius: 12,
            borderTopLeftRadius: 4,
            padding: 10,
            borderWidth: isReply ? 1 : 0,
            borderColor: colors.border,
          }}>
            {/* Author info */}
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <Text style={{ fontWeight: "700", fontSize: 13, color: colors.navy }}>{authorName}</Text>
              {subtitle ? (
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{subtitle}</Text>
              ) : null}
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.foreground }}>{comment.content}</Text>
          </View>

          {/* Actions row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 5, marginLeft: 4 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{timeStr}</Text>
            <TouchableOpacity onPress={() => onReply(comment)}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>Responder</Text>
            </TouchableOpacity>
          </View>

          {/* Nested replies */}
          {(comment.replies ?? []).length > 0 && (
            <View style={{ marginTop: 8 }}>
              {(comment.replies ?? []).map(reply => (
                <MarketCommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  userId={userId}
                  colors={colors}
                  depth={depth + 1}
                  onReply={onReply}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Forum Comments List ──────────────────────────────────────────────────────

function MarketCommentsList({ postId, userId, colors, onCommentsCountChange }: {
  postId: string;
  userId: string;
  colors: ReturnType<typeof useColors>;
  onCommentsCountChange?: (delta: number) => void;
}) {
  const [comments,    setComments]    = useState<API.MarketComment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [text,        setText]        = useState("");
  const [sending,     setSending]     = useState(false);
  const [replyTo,     setReplyTo]     = useState<API.MarketComment | null>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    API.fetchMarketComments(postId).then(c => { setComments(c); setLoading(false); });
  }, [postId]);

  const handleReply = (comment: API.MarketComment) => {
    setReplyTo(comment);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const cancelReply = () => { setReplyTo(null); };

  const send = async () => {
    const t = text.trim();
    if (!t || !userId) return;
    setSending(true);
    const c = await API.addMarketComment(postId, userId, t, replyTo?.id ?? null);
    if (c) {
      if (replyTo) {
        // Append the reply to the correct parent
        setComments(prev => prev.map(parent =>
          parent.id === replyTo.id
            ? { ...parent, replies: [...(parent.replies ?? []), c] }
            : parent
        ));
      } else {
        setComments(prev => [...prev, c]);
        onCommentsCountChange?.(1);
      }
      setText("");
      setReplyTo(null);
    }
    setSending(false);
  };

  return (
    <View style={{ marginTop: 8 }}>
      {/* Thread divider */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: "600" }}>
          {loading ? "Carregando..." : `${comments.reduce((a, c) => a + 1 + (c.replies?.length ?? 0), 0)} comentários`}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={colors.gold} style={{ marginVertical: 16 }} />
      ) : (
        comments.map(comment => (
          <MarketCommentItem
            key={comment.id}
            comment={comment}
            postId={postId}
            userId={userId}
            colors={colors}
            depth={0}
            onReply={handleReply}
          />
        ))
      )}

      {/* Reply to context pill */}
      {replyTo && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.gold + "18", borderRadius: 10, padding: 8, marginBottom: 6 }}>
          <Feather name="corner-down-right" size={14} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.gold, fontWeight: "700" }}>
              Respondendo a {replyTo.author?.full_name ?? "Usuário"}
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={cancelReply}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4, alignItems: "flex-end" }}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder={replyTo ? `Responder a ${replyTo.author?.full_name ?? "Usuário"}...` : "Comentar no fórum..."}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: replyTo ? colors.gold : colors.border,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 13,
            color: colors.foreground,
            maxHeight: 80,
          }}
          returnKeyType="default"
          editable={!sending}
        />
        <TouchableOpacity
          onPress={send}
          disabled={sending || !text.trim()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: text.trim() ? colors.gold : colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="send" size={15} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Who Liked Modal ──────────────────────────────────────────────────────────

function LikersModal({
  postId,
  visible,
  onClose,
  colors,
}: {
  postId: string;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [likers,   setLikers]   = useState<API.MarketPostLiker[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    API.fetchMarketPostLikers(postId).then(l => { setLikers(l); setLoading(false); });
  }, [visible, postId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "60%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={{ fontWeight: "700", fontSize: 16, color: colors.navy }}>
              Curtido por {likers.length > 0 ? `(${likers.length})` : ""}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginVertical: 24 }} />
          ) : likers.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, textAlign: "center", marginVertical: 24 }}>
              Nenhuma curtida ainda.
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {likers.map(l => {
                const subtitle = [l.position, l.company].filter(Boolean).join(" · ");
                return (
                  <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <IdealBIAvatar src={l.avatar_url} name={l.full_name ?? "U"} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", fontSize: 14, color: colors.navy }}>{l.full_name ?? "Usuário"}</Text>
                      {subtitle ? <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{subtitle}</Text> : null}
                    </View>
                    <Feather name="heart" size={14} color="#dc2626" />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MarketPollMobile({ post: initialPost, userId, colors, onPollVote }: {
  post: API.MarketPost; userId: string; colors: any;
  onPollVote: (opts: API.MarketPollOption[], voteId: string) => void;
}) {
  const [post, setPost] = useState(initialPost);
  const [voting, setVoting] = useState(false);
  const opts = post.poll_options ?? [];
  const total = opts.reduce((s, o) => s + o.votes_count, 0);

  useEffect(() => { setPost(initialPost); }, [initialPost]);

  const handleVote = async (optId: string) => {
    if (voting || post.user_poll_vote === optId) return;
    setVoting(true);
    const updated = await API.voteOnMarketPoll(post.id, userId, optId);
    if (updated) {
      onPollVote(updated, optId);
      setPost(p => ({ ...p, poll_options: updated, user_poll_vote: optId }));
    }
    setVoting(false);
  };

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
      {opts.map(opt => {
        const pct = total > 0 ? Math.round((opt.votes_count / total) * 100) : 0;
        const voted = post.user_poll_vote === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => handleVote(opt.id)}
            disabled={voting}
            style={{ borderRadius: 10, borderWidth: 1.5, borderColor: voted ? colors.gold : colors.border, overflow: "hidden" }}
          >
            <View style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${pct}%`, backgroundColor: voted ? colors.gold + "28" : "#f0f0ec" }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9 }}>
              <Text style={{ fontSize: 13, fontWeight: voted ? "700" : "400", color: voted ? colors.navy : colors.foreground }}>
                {voted ? "✓ " : ""}{opt.text}
              </Text>
              {post.user_poll_vote ? (
                <Text style={{ fontSize: 12, fontWeight: "700", color: voted ? colors.gold : colors.mutedForeground }}>{pct}%</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{total} voto{total !== 1 ? "s" : ""}</Text>
    </View>
  );
}

function MarketPostCardMobile({ post: initialPost, userId, onLikeToggle, colors }: {
  post: API.MarketPost; userId: string;
  onLikeToggle: (id: string, liked: boolean, count: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [post,          setPost]          = useState<API.MarketPost>(initialPost);
  const [showComments,  setShowComments]  = useState(false);
  const [showLikers,    setShowLikers]    = useState(false);
  const [liking,        setLiking]        = useState(false);
  const dateStr = new Date(post.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  useEffect(() => { setPost(initialPost); }, [initialPost]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const newCount = post.user_liked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1;
    setPost(p => ({ ...p, user_liked: !p.user_liked, likes_count: newCount }));
    const newLiked = await API.toggleMarketPostLike(post.id, userId, post.user_liked);
    onLikeToggle(post.id, newLiked, newCount);
    setLiking(false);
  };

  const handlePollVote = (opts: API.MarketPollOption[], voteId: string) => {
    setPost(p => ({ ...p, poll_options: opts, user_poll_vote: voteId }));
  };

  const hasMedia = !!(post.image_url || post.video_url);
  const hasPoll  = !!(post.poll_options && post.poll_options.length > 0);
  const totalComments = post.comments_count;

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 10 }}>
        <IdealBIAvatar src={post.author?.avatar_url} name="Ideal.BI" size={42} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ fontWeight: "800", fontSize: 15, color: colors.navy }}>Ideal.BI</Text>
            <View style={{ backgroundColor: colors.gold + "20", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Feather name="radio" size={9} color={colors.gold} />
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.gold }}>Feed Exclusivo</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>Inteligência de Mercado do Vinho</Text>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>{dateStr}</Text>
        </View>
      </View>

      {/* Content */}
      <Text style={{ fontSize: 14, lineHeight: 22, color: colors.foreground, paddingHorizontal: 14, paddingBottom: hasMedia || hasPoll ? 10 : 14 }}>
        {post.content}
      </Text>

      {post.image_url ? (
        <Image source={{ uri: post.image_url }} style={{ width: "100%", height: 220 } as any} contentFit="cover" />
      ) : null}
      {post.video_url ? (
        <NetworkPostVideo uri={post.video_url} />
      ) : null}
      {hasPoll ? (
        <MarketPollMobile post={post} userId={userId} colors={colors} onPollVote={handlePollVote} />
      ) : null}

      {/* Stats bar (likes preview) */}
      {post.likes_count > 0 && (
        <TouchableOpacity
          onPress={() => setShowLikers(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingTop: 8 }}
        >
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center" }}>
            <Feather name="heart" size={9} color="#fff" />
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            {post.likes_count} {post.likes_count === 1 ? "pessoa curtiu" : "pessoas curtiram"} · ver quem curtiu
          </Text>
        </TouchableOpacity>
      )}

      {/* Action bar */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, gap: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 7, borderRadius: 10, backgroundColor: post.user_liked ? "#fef2f2" : colors.secondary }}
          onPress={handleLike}
          disabled={liking}
        >
          <Feather name="heart" size={16} color={post.user_liked ? "#dc2626" : colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: post.user_liked ? "#dc2626" : colors.mutedForeground }}>
            {post.user_liked ? "Curtido" : "Curtir"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 7, borderRadius: 10, backgroundColor: showComments ? colors.navy + "10" : colors.secondary }}
          onPress={() => setShowComments(v => !v)}
        >
          <Feather name="message-square" size={16} color={showComments ? colors.navy : colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: showComments ? colors.navy : colors.mutedForeground }}>
            {totalComments > 0 ? `${totalComments} ${totalComments === 1 ? "comentário" : "comentários"}` : "Comentar"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Forum comment thread */}
      {showComments && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 16, backgroundColor: "#fafaf8", borderTopWidth: 1, borderTopColor: colors.border }}>
          <MarketCommentsList
            postId={post.id}
            userId={userId}
            colors={colors}
            onCommentsCountChange={(delta) => setPost(p => ({ ...p, comments_count: p.comments_count + delta }))}
          />
        </View>
      )}

      {/* Likers modal */}
      <LikersModal
        postId={post.id}
        visible={showLikers}
        onClose={() => setShowLikers(false)}
        colors={colors}
      />
    </View>
  );
}

function IdealBIFeedMobile({ userId, isAdmin, colors, bottomPad }: {
  userId: string; isAdmin: boolean;
  colors: ReturnType<typeof useColors>; bottomPad: number;
}) {
  const router = useRouter();
  const { hasFeature: permHasFeature } = usePermissions();
  const [idealbiSubTab, setIdealbiSubTab] = useState<IdealBISubTab>("feed");
  const [newContent, setNewContent] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [posting, setPosting] = useState(false);

  const hasAccess = permHasFeature("mercado:idealbi") || isAdmin;

  const fetcher = useCallback(
    (offset: number, limit: number) =>
      hasAccess ? API.fetchMarketPosts(userId, offset, limit) : Promise.resolve([]),
    [hasAccess, userId],
  );

  const { items: posts, loading, loadingMore, loadMore, refresh, setItems: setPosts } =
    usePaginatedQuery<API.MarketPost>(fetcher);

  useEffect(() => { refresh(); }, [hasAccess]);

  const handleLikeToggle = (id: string, liked: boolean, count: number) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, user_liked: liked, likes_count: count } : p));
  };

  const pickMedia = async (type: "image" | "video") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === "image" ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setMediaUri(result.assets[0].uri);
    setMediaType(type);
  };

  const resetForm = () => {
    setNewContent(""); setMediaUri(null); setMediaType(null);
    setPollMode(false); setPollOptions(["", ""]);
  };

  const handlePost = async () => {
    const t = newContent.trim();
    if (!t || !isAdmin || posting) return;
    setPosting(true);

    let imageUrl: string | null = null;
    let videoUrl: string | null = null;
    let finalPollOptions: API.MarketPollOption[] | null = null;

    if (mediaUri && mediaType) {
      try {
        const isImg = mediaType === "image";
        const processedUri = isImg ? await compressPostImage(mediaUri) : mediaUri;
        const ext = isImg ? "jpg" : (mediaUri.split(".").pop()?.split("?")[0] ?? "mp4");
        const mimeType = isImg ? "image/jpeg" : `video/${ext}`;
        const fileName = `idealbi_${Date.now()}.${ext}`;
        const blob = await (await fetch(processedUri)).blob();
        const b64: string = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve((fr.result as string).split(",")[1]);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        const uploadUrl = await API.uploadMarketPostMediaBase64(b64, fileName, mimeType, userId);
        if (uploadUrl) {
          if (isImg) imageUrl = uploadUrl;
          else videoUrl = uploadUrl;
        }
      } catch (_) {}
    }

    if (pollMode) {
      const valid = pollOptions.filter(o => o.trim());
      if (valid.length >= 2) {
        finalPollOptions = valid.map((text, i) => ({ id: `opt_${i}`, text, votes_count: 0 }));
      }
    }

    const post = await API.createMarketPost(userId, t, imageUrl, videoUrl, finalPollOptions);
    if (post) { setPosts(prev => [post, ...prev]); resetForm(); }
    setPosting(false);
  };

  if (!hasAccess) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: "#c9a84c18", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 36 }}>📡</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.navy, textAlign: "center" }}>Ideal.BI Exclusivo</Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 21 }}>
          Análises e insights exclusivos do mercado do vinho publicados pela Ideal.BI. Disponível nos planos com acesso ao feed.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.gold, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 }}
          onPress={() => router.push("/subscription")}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Ver Planos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const AdminHeader = isAdmin ? (
    <View style={{ marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", padding: 14, gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.navy }}>📡 Nova publicação Ideal.BI</Text>
      <TextInput
        value={newContent}
        onChangeText={setNewContent}
        placeholder="Escreva um insight ou análise..."
        placeholderTextColor={colors.mutedForeground}
        multiline
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.foreground, minHeight: 80, textAlignVertical: "top" }}
      />

      {/* Media preview */}
      {mediaUri && mediaType === "image" ? (
        <View style={{ position: "relative" }}>
          <Image source={{ uri: mediaUri }} style={{ width: "100%", height: 180, borderRadius: 10 } as any} contentFit="cover" />
          <TouchableOpacity onPress={() => { setMediaUri(null); setMediaType(null); }} style={{ position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 4 }}>
            <Feather name="x" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
      {mediaUri && mediaType === "video" ? (
        <View style={{ position: "relative" }}>
          <NetworkMediaPreview uri={mediaUri} />
          <TouchableOpacity onPress={() => { setMediaUri(null); setMediaType(null); }} style={{ position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 4 }}>
            <Feather name="x" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Poll builder */}
      {pollMode ? (
        <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, backgroundColor: "#fafaf8", gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.gold }}>📊 Opções da enquete</Text>
          {pollOptions.map((opt, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <TextInput
                value={opt}
                onChangeText={v => setPollOptions(prev => prev.map((o, j) => j === i ? v : o))}
                placeholder={`Opção ${i + 1}`}
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: colors.foreground }}
              />
              {pollOptions.length > 2 ? (
                <TouchableOpacity onPress={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {pollOptions.length < 5 ? (
            <TouchableOpacity onPress={() => setPollOptions(prev => [...prev, ""])}>
              <Text style={{ fontSize: 12, color: colors.gold, fontWeight: "600" }}>+ Adicionar opção</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Toolbar */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <TouchableOpacity onPress={() => pickMedia("image")} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <Feather name="image" size={14} color={colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Imagem</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => pickMedia("video")} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <Feather name="video" size={14} color={colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Vídeo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPollMode(v => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: pollMode ? colors.gold : colors.border, backgroundColor: pollMode ? colors.gold + "15" : "transparent" }}
        >
          <Feather name="bar-chart-2" size={14} color={pollMode ? colors.gold : colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: pollMode ? colors.gold : colors.mutedForeground, fontWeight: pollMode ? "700" : "400" }}>Enquete</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ backgroundColor: newContent.trim() ? colors.gold : colors.gold + "55", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
        onPress={handlePost}
        disabled={posting || !newContent.trim()}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{posting ? "Publicando..." : "Publicar"}</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tab bar: Feed | Busca com IA — same style as main Mercado tabs */}
      <View style={[styles.mainTabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "feed",   label: "Feed", icon: "radio"  },
          { key: "search", label: "🔍 IA", icon: null   },
        ] as { key: IdealBISubTab; label: string; icon: any }[]).map(tab => {
          const active = idealbiSubTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.mainTabBtn,
                active && { backgroundColor: "#fff", borderColor: colors.border },
              ]}
              onPress={() => setIdealbiSubTab(tab.key)}
            >
              {tab.icon && (
                <Feather name={tab.icon} size={14} color={active ? colors.navy : colors.mutedForeground} />
              )}
              <Text style={[styles.mainTabText, {
                color: active ? colors.navy : colors.mutedForeground,
                fontWeight: active ? "700" : "500",
              }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {idealbiSubTab === "search" ? (
        <IdealBISearchView colors={colors} bottomPad={bottomPad} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={AdminHeader}
          ListEmptyComponent={loading ? (
            <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 60 }} />
          ) : (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <Text style={{ fontSize: 36 }}>📡</Text>
              <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: "center" }}>
                {"Nenhuma publicação ainda.\nFique ligado para novidades da Ideal.BI."}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <MarketPostCardMobile
              post={item}
              userId={userId}
              onLikeToggle={handleLikeToggle}
              colors={colors}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={colors.gold} size="small" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function LockedSection({ title, icon, colors }: { title: string; icon: string; colors: any }) {
  const router = useRouter();
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
        <Text style={[styles.lockedBadgeText, { color: colors.gold }]}>Recurso dos planos pagos</Text>
      </View>
      <TouchableOpacity
        style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.gold, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 }}
        onPress={() => router.push("/subscription")}
        activeOpacity={0.8}
      >
        <Feather name="zap" size={14} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Ver Planos e Assinar</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MercadoScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, profile, session } = useAuth();

  const [period,       setPeriod]       = useState<Period>("ano");
  const [mainTab,      setMainTab]      = useState<MercadoTab>("visao");
  const [data,         setData]         = useState<API.MarketOverview>(FALLBACK.ano);
  const [loading,      setLoading]      = useState(false);
  const { hasFeature } = usePermissions();

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

  const can = useCallback((key: string): boolean => {
    return hasFeature(`mercado:${key}`);
  }, [hasFeature]);

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
          { key: "idealbi",       label: "Ideal.BI",      icon: "radio"       },
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

      {mainTab === "idealbi" ? (
        <IdealBIFeedMobile
          userId={user?.id ?? ""}
          isAdmin={profile?.is_admin ?? false}
          colors={colors}
          bottomPad={bottomPad}
        />
      ) : mainTab === "apresentacoes" ? (
        <ApresentacoesView colors={colors} bottomPad={bottomPad} session={session} isAdmin={profile?.is_admin ?? false} />
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
                    <MaterialCommunityIcons name="glass-wine" size={18} color={colors.navy} style={{ marginRight: 6 }} />
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
