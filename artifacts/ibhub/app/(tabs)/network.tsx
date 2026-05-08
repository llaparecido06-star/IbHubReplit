import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
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
  type ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { FeedVideo } from "@/components/feed/FeedVideo";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AntDesign, Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
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
import { AdaptiveImage, ReactionPicker, REACTIONS, type ReactionType } from "@/components/feed/PostCard";
import * as API from "@/services/api";
import { compressPostImage } from "@/utils/compressImage";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period    = "mes" | "trimestre" | "ano";
type MercadoTab = "visao" | "apresentacoes" | "idealbi";
type IdealBISubTab = "feed" | "search";

// ─── Ideal.BI Search Mock Data ─────────────────────────────────────────────────
interface WineDistribuidor {
  name: string;
  company_page_id: string | null;
}

interface WineRecord {
  id?: number;
  marcaCompleta: string;
  marcaRelatorio?: string;
  paisDeOrigem?: string;
  distribuidor: string;
  distribuidores: WineDistribuidor[];
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  value: string;
}

type BiSearchMode = "exportador" | "marca" | "importadores" | "produtores";
interface BiExpItem  { id: string; name: string; origem_exportador?: string | null; }
interface BiImpItem  { id: string; name: string; segmentos?: string | null; exportadores: { exportador: string; pais: string }[]; }
interface BiProdItem { id: string; name: string; name_fantasia?: string | null; regiao?: string | null; estado?: string | null; }

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

const SCREEN_W_NET = Dimensions.get("window").width;
const IDEAL_CARD_W = SCREEN_W_NET - 32;

function NetworkPostVideo({ uri, isVisible, onUserPlay, onSwipeNext, onSwipeBack, playToken }: {
  uri: string;
  isVisible: boolean;
  onUserPlay: () => void;
  onSwipeNext?: () => void;
  onSwipeBack?: () => void;
  playToken: number;
}) {
  return (
    <FeedVideo
      uri={uri}
      width={IDEAL_CARD_W}
      isVisible={isVisible}
      onUserPlay={onUserPlay}
      onSwipeNext={onSwipeNext}
      onSwipeBack={onSwipeBack}
      playToken={playToken}
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
  const { t } = useTranslation();
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
          <TouchableOpacity onPress={() => setModal({ visible: true, kpi })} accessibilityRole="button" accessibilityLabel={t("mercado_screen.kpi_info_label")}>
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
                {t("mercado_screen.kpi_fonte", { source: modal.kpi?.source ?? "IBRAVIN" })}
              </Text>
            </View>
            {modal.kpi?.updatedAt ? (
              <View style={styles.kpiModalMeta}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.kpiModalMetaText, { color: colors.mutedForeground }]}>
                  {t("mercado_screen.kpi_updated", { date: new Date(modal.kpi.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) })}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.kpiModalCloseBtn, { backgroundColor: colors.navy }]}
              onPress={() => setModal({ visible: false, kpi: null })}
            >
              <Text style={styles.kpiModalCloseBtnText}>{t("mercado_screen.kpi_close")}</Text>
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
            <Text style={[sliderStyles.lockedTitle, { color: colors.navy }]}>{t("mercado_screen.slide_locked_title")}</Text>
            <Text style={[sliderStyles.lockedSub, { color: colors.mutedForeground }]}>
              {t("mercado_screen.slide_locked_sub")}
            </Text>
            <View style={[sliderStyles.lockedBadge, { backgroundColor: colors.gold + "15" }]}>
              <Feather name="clock" size={13} color={colors.gold} />
              <Text style={[sliderStyles.lockedBadgeText, { color: colors.gold }]}>{t("mercado_screen.slide_locked_badge")}</Text>
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
        {/* Header — paddingTop uses real safe area so X is always tappable on iPhone */}
        <View style={[sliderStyles.modalHeader, { backgroundColor: "rgba(0,0,0,0.7)", paddingTop: (insets.top || (Platform.OS === "ios" ? 52 : 20)) + 10 }]}>
          <TouchableOpacity onPress={onClose} style={sliderStyles.closeBtn} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel={t("mercado_screen.kpi_close")}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={sliderStyles.modalTitle} numberOfLines={1}>{presentation?.title}</Text>
            {total > 0 && (
              <Text style={sliderStyles.slideCounter}>
                {t("mercado_screen.slides_available", { unlocked, total })}
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
            <Text style={{ color: "#fff", marginTop: 12, fontSize: 13 }}>{t("mercado_screen.slides_loading")}</Text>
          </View>
        ) : slides.length === 0 ? (
          <View style={sliderStyles.loadingBox}>
            <Feather name="image" size={48} color="#4b5563" />
            <Text style={{ color: "#9ca3af", marginTop: 12, fontSize: 14, textAlign: "center" }}>
              {t("mercado_screen.slides_empty")}
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
  modalHeader:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
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
  const { t } = useTranslation();
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
        featureName={t("mercado_screen.tab_apresentacoes")}
        description={t("mercado_screen.apresentacoes_paywall_desc")}
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
          {t("mercado_screen.apresentacoes_empty_title")}
        </Text>
        <Text style={[styles.apresentacoesSub, { color: colors.mutedForeground }]}>
          {t("mercado_screen.apresentacoes_empty_sub")}
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
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.navy }}>{t("mercado_screen.manage_apresentacoes")}</Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{t("mercado_screen.manage_apresentacoes_sub")}</Text>
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
                        {t("mercado_screen.slides_available", { unlocked: counts.unlocked, total: counts.total })}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                      <Feather name="monitor" size={13} color={colors.gold} />
                      <Text style={[styles.presentLink, { color: colors.gold }]}>{t("mercado_screen.ver_apresentacao")}</Text>
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

// ── BiMobileExportadorSearch ───────────────────────────────────────────────────
function BiMobileExportadorSearch({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
  const authH = (): HeadersInit => session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  const [q, setQ]                   = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching]   = useState(false);
  const [items, setItems]           = useState<BiExpItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [searched, setSearched]     = useState(false);
  const [credits, setCredits]       = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importadoresMap, setImportadoresMap] = useState<Record<string, { name: string; company_page_id: string | null }[]>>({});
  const [impLoadingSet, setImpLoadingSet]     = useState<Set<string>>(new Set());
  type RevealDistExp = { distribuidor: string | null; fob_usd: string | null; cx9l: string | null; usd_por_cx9l: string | null };
  type RevealedExpData = { totals: { fob_usd: string | null; cx9l: string | null; usd_por_cx9l: string | null }; distribuidores: RevealDistExp[] };
  const [revealedMap, setRevealedMap]         = useState<Record<string, RevealedExpData>>({});
  const [revealCredits, setRevealCredits]     = useState<number | null>(null);
  const [revealCreditsTotal, setRevealCreditsTotal] = useState(0);
  const [revealingId, setRevealingId]         = useState<string | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const exhausted = credits !== null && credits <= 0;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/wine-imports/bi/reveal-credits`, { headers: authH() });
        if (!res.ok) return;
        const data = await res.json() as { credits_remaining: number; credits_total: number };
        setRevealCredits(data.credits_remaining);
        setRevealCreditsTotal(data.credits_total);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const val = q.trim();
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (val.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/wine-imports/bi-suggestions/exportadores?q=${encodeURIComponent(val)}`, { headers: authH() });
        if (!res.ok) return;
        const json = await res.json() as { suggestions: string[] };
        setSuggestions(json.suggestions ?? []);
      } catch {}
    }, 300);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [q]);

  const spellCheck = async (sq: string) => {
    try {
      const res = await fetch(`${API_URL}/wine-imports/spell-correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({ query: sq, context: "exportador" }),
      });
      if (!res.ok) return;
      const data = await res.json() as { corrected: string | null };
      if (data.corrected && data.corrected.toLowerCase() !== sq.toLowerCase()) setSuggestion(data.corrected);
    } catch {}
  };

  const doSearch = async (sq: string) => {
    if (!sq.trim() || searchingRef.current) return;
    searchingRef.current = true;
    setSuggestion(null);
    setSuggestions([]); setSearching(true); setItems([]); setSearched(false); setError(null);
    void spellCheck(sq);
    try {
      const params = new URLSearchParams({ q: sq, limit: "20", offset: "0" });
      const res = await fetch(`${API_URL}/wine-imports/bi-search/exportadores?${params}`, { headers: authH() });
      if (res.status === 402) { setCredits(0); setError(t("mercado_screen.bi_error_exhausted")); }
      else if (!res.ok) { setError(t("mercado_screen.bi_error_search")); }
      else {
        const data = await res.json() as { items: BiExpItem[]; total: number; credits_remaining: number; credits_total: number };
        setItems(data.items); setTotal(data.total); setSearched(true);
        if (data.credits_remaining !== undefined) setCredits(data.credits_remaining);
      }
    } catch { setError(t("mercado_screen.bi_error_connection")); }
    finally { setSearching(false); searchingRef.current = false; }
  };

  const loadImps = async (name: string, id: string) => {
    if (importadoresMap[id]) return;
    setImpLoadingSet(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`${API_URL}/wine-imports/exportador-importadores?nome=${encodeURIComponent(name)}`, { headers: authH() });
      if (res.ok) {
        const data = await res.json() as { importadores: { name: string; company_page_id: string | null }[] };
        setImportadoresMap(prev => ({ ...prev, [id]: data.importadores }));
      }
    } catch {}
    setImpLoadingSet(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const revealData = async (name: string) => {
    setRevealingId(name);
    try {
      const res = await fetch(`${API_URL}/wine-imports/bi/exportadores/reveal`, {
        method: "POST",
        headers: { ...(authH() as Record<string, string>), "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.status === 402) { setRevealCredits(0); }
      else if (res.ok) {
        const data = await res.json() as { totals: { fob_usd: string | null; cx9l: string | null; usd_por_cx9l: string | null }; distribuidores: RevealDistExp[]; credits_remaining: number | null; credits_total: number };
        setRevealedMap(prev => ({ ...prev, [name]: { totals: data.totals, distribuidores: data.distribuidores ?? [] } }));
        if (data.credits_remaining !== null) setRevealCredits(data.credits_remaining);
        if (data.credits_total) setRevealCreditsTotal(data.credits_total);
      }
    } catch {}
    setRevealingId(null);
  };

  return (
    <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: exhausted ? "#fca5a5" : colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 4, paddingVertical: 4 }}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>🌐</Text>
          <TextInput value={q} onChangeText={setQ}
            placeholder={exhausted ? t("mercado_screen.bi_credits_exhausted") : t("mercado_screen.bi_exp_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: 12 }}
            editable={!exhausted} onSubmitEditing={() => doSearch(q)} returnKeyType="search" />
          {!!q && <TouchableOpacity onPress={() => { setQ(""); setItems([]); setSearched(false); setSuggestions([]); setSuggestion(null); }} style={{ padding: 8 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>}
        </View>
        <TouchableOpacity onPress={() => doSearch(q)} disabled={!q.trim() || searching || exhausted}
          style={{ paddingHorizontal: 16, borderRadius: 14, justifyContent: "center", backgroundColor: !q.trim() || searching || exhausted ? colors.border : colors.navy }}>
          {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{t("mercado_screen.bi_search_btn")}</Text>}
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && !searching && (
        <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={s} onPress={() => { setQ(s); setSuggestions([]); void doSearch(s); }} activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: i < suggestions.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 15 }}>🌐</Text>
              <Text style={{ flex: 1, fontSize: 14, color: colors.navy, fontWeight: "500" }} numberOfLines={1}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!suggestion && (
        <TouchableOpacity
          onPress={() => { setQ(suggestion); setSuggestion(null); void doSearch(suggestion); }}
          activeOpacity={0.8}
          style={{ backgroundColor: "#f0f4ff", borderWidth: 1, borderColor: colors.navy + "30", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Feather name="edit-2" size={14} color={colors.navy} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.navy }}>
            {t("mercado_screen.bi_did_you_mean", { suggestion })}
          </Text>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
      {!!error && (
        <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Feather name="alert-circle" size={16} color="#dc2626" />
          <Text style={{ flex: 1, fontSize: 13, color: "#dc2626" }}>{error}</Text>
        </View>
      )}
      {!searched && !searching && suggestions.length === 0 && !error && (
        <View style={{ backgroundColor: colors.gold + "10", borderWidth: 1, borderColor: colors.gold + "30", borderRadius: 12, padding: 14, gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.navy }}>{t("mercado_screen.bi_exp_how_title")}</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
            {t("mercado_screen.bi_exp_how_text")}
          </Text>
        </View>
      )}

      {searching && (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 13 }}>{t("mercado_screen.bi_exp_searching")}</Text>
        </View>
      )}

      {searched && !searching && (<>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t("mercado_screen.bi_exp_count", { count: total })}</Text>
          {revealCredits !== null && (
            <View style={{ backgroundColor: colors.gold + "10", borderWidth: 1, borderColor: colors.gold + "25", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                {"🔓 "}
                <Text style={{ color: revealCredits === 0 ? "#dc2626" : colors.navy, fontWeight: "700" }}>{revealCredits}/{revealCreditsTotal}</Text>
              </Text>
            </View>
          )}
        </View>

        {items.length === 0 && (
          <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🌐</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.navy, marginBottom: 4 }}>{t("mercado_screen.bi_no_results_title")}</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>{t("mercado_screen.bi_exp_no_result_sub")}</Text>
          </View>
        )}

        {items.map(m => {
          const isOpen    = expandedId === m.id;
          const imps      = importadoresMap[m.id];
          const impLoading = impLoadingSet.has(m.id);
          const revealed  = revealedMap[m.name];
          return (
            <View key={m.id} style={{ backgroundColor: "#fff", borderWidth: 1.5, borderColor: isOpen ? colors.gold : colors.border, borderRadius: 16, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16 }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.gold + "14", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 22 }}>🌐</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: colors.navy }}>{m.name}</Text>
                    <View style={{ backgroundColor: colors.gold + "15", borderWidth: 1, borderColor: colors.gold + "35", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.gold }}>EXPORTADOR</Text>
                    </View>
                  </View>
                  {!!m.origem_exportador && <Text style={{ fontSize: 12, color: colors.mutedForeground }}>🌍 {m.origem_exportador}</Text>}
                </View>
                <TouchableOpacity
                  onPress={() => { const next = isOpen ? null : m.id; setExpandedId(next); if (next) void loadImps(m.name, m.id); }}
                  style={{ borderWidth: 1.5, borderColor: isOpen ? colors.gold : colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: isOpen ? colors.gold + "15" : "transparent" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: isOpen ? colors.gold : colors.mutedForeground }}>{isOpen ? t("mercado_screen.bi_exp_close") : t("mercado_screen.bi_exp_see")}</Text>
                </TouchableOpacity>
              </View>

              {isOpen && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.gold + "40", padding: 14, backgroundColor: colors.gold + "06" }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold, letterSpacing: 0.7, marginBottom: 8 }}>{t("mercado_screen.bi_exp_who_imports")}</Text>
                  {impLoading
                    ? <ActivityIndicator size="small" color={colors.gold} />
                    : !imps || imps.length === 0
                      ? <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t("mercado_screen.bi_exp_no_importers")}</Text>
                      : <View style={{ gap: 6 }}>
                          {imps.map((d, i) => (
                            <TouchableOpacity key={i} disabled={!d.company_page_id}
                              onPress={() => d.company_page_id && router.push(`/empresa/${d.company_page_id}` as any)}
                              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={{ fontSize: 16 }}>📦</Text>
                              <Text style={{ fontSize: 14, fontWeight: "700", color: d.company_page_id ? colors.gold : colors.navy, textDecorationLine: d.company_page_id ? "underline" : "none" }}>{d.name}</Text>
                              {!!d.company_page_id && <Feather name="external-link" size={12} color={colors.gold} />}
                            </TouchableOpacity>
                          ))}
                        </View>
                  }
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 14 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold, letterSpacing: 0.7, marginBottom: 10 }}>{t("mercado_screen.bi_exp_financial")}</Text>
                    {revealed ? (
                      revealed.distribuidores.length > 0 ? (
                        <View style={{ gap: 0 }}>
                          {/* Header row */}
                          <View style={{ flexDirection: "row", backgroundColor: colors.navy + "0A", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 2 }}>
                            <Text style={{ flex: 2, fontSize: 9, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Distribuidor</Text>
                            <Text style={{ flex: 1, fontSize: 9, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" as const, letterSpacing: 0.5, textAlign: "right" }}>FOB US$</Text>
                            <Text style={{ flex: 1, fontSize: 9, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" as const, letterSpacing: 0.5, textAlign: "right" }}>CX9L</Text>
                            <Text style={{ flex: 1, fontSize: 9, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase" as const, letterSpacing: 0.5, textAlign: "right" }}>US$/CX9L</Text>
                          </View>
                          {/* Distribuidor rows */}
                          {revealed.distribuidores.map((d, i) => (
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                              <Text style={{ flex: 2, fontSize: 11, color: colors.navy, fontWeight: "600" }} numberOfLines={1}>{d.distribuidor ?? "—"}</Text>
                              <Text style={{ flex: 1, fontSize: 11, color: colors.navy, fontWeight: "700", textAlign: "right" }}>{d.fob_usd ? (parseFloat(d.fob_usd) >= 1e6 ? `${(parseFloat(d.fob_usd)/1e6).toFixed(2)}M` : parseFloat(d.fob_usd).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })) : "–"}</Text>
                              <Text style={{ flex: 1, fontSize: 11, color: colors.navy, textAlign: "right" }}>{d.cx9l ? parseFloat(d.cx9l).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "–"}</Text>
                              <Text style={{ flex: 1, fontSize: 11, color: colors.navy, textAlign: "right" }}>{d.usd_por_cx9l ? parseFloat(d.usd_por_cx9l).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–"}</Text>
                            </View>
                          ))}
                          {/* Total row (only when multiple distribuidores) */}
                          {revealed.distribuidores.length > 1 && (
                            <View style={{ flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, backgroundColor: colors.navy + "06", borderRadius: 6, marginTop: 2 }}>
                              <Text style={{ flex: 2, fontSize: 11, color: colors.navy, fontWeight: "800" }}>Total</Text>
                              <Text style={{ flex: 1, fontSize: 11, color: colors.navy, fontWeight: "800", textAlign: "right" }}>{revealed.totals.fob_usd ? (parseFloat(revealed.totals.fob_usd) >= 1e6 ? `${(parseFloat(revealed.totals.fob_usd)/1e6).toFixed(2)}M` : parseFloat(revealed.totals.fob_usd).toLocaleString("pt-BR", { maximumFractionDigits: 0 })) : "–"}</Text>
                              <Text style={{ flex: 1, fontSize: 11, color: colors.navy, fontWeight: "800", textAlign: "right" }}>{revealed.totals.cx9l ? parseFloat(revealed.totals.cx9l).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "–"}</Text>
                              <Text style={{ flex: 1, fontSize: 10, color: colors.mutedForeground, fontWeight: "700", textAlign: "right" }}>{revealed.totals.usd_por_cx9l ? parseFloat(revealed.totals.usd_por_cx9l).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–"} ⓘ</Text>
                            </View>
                          )}
                          {revealed.distribuidores.length > 1 && (
                            <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 4 }}>ⓘ US$/CX9L total = média ponderada (FOB ÷ CX9L)</Text>
                          )}
                        </View>
                      ) : (
                        /* Fallback: 3 KPI boxes if no distribuidores data */
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {([
                            { label: "FOB US$",   value: revealed.totals.fob_usd },
                            { label: "Vol. CX9L", value: revealed.totals.cx9l },
                            { label: "US$/CX9L",  value: revealed.totals.usd_por_cx9l },
                          ]).map(kpi => (
                            <View key={kpi.label} style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, alignItems: "center" }}>
                              <Text style={{ fontSize: 12, fontWeight: "900", color: colors.navy }}>{kpi.value ?? "–"}</Text>
                              <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 2, textAlign: "center" }}>{kpi.label}</Text>
                            </View>
                          ))}
                        </View>
                      )
                    ) : (
                      <>
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                          {(["FOB US$", "Vol. CX9L", "US$/CX9L"]).map(label => (
                            <View key={label} style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, alignItems: "center" }}>
                              <Text style={{ fontSize: 16, fontWeight: "900", color: colors.mutedForeground, letterSpacing: 2 }}>••••</Text>
                              <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 2, textAlign: "center" }}>{label}</Text>
                            </View>
                          ))}
                        </View>
                        <TouchableOpacity
                          onPress={() => void revealData(m.name)}
                          disabled={revealingId === m.name || revealCredits === 0}
                          style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, alignItems: "center", backgroundColor: revealCredits === 0 ? "#e5e7eb" : colors.navy, opacity: revealingId === m.name ? 0.7 : 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: revealCredits === 0 ? colors.mutedForeground : "#fff" }}>
                            {revealingId === m.name ? t("mercado_screen.bi_exp_revealing") : revealCredits === 0 ? t("mercado_screen.bi_exp_no_credits") : t("mercado_screen.bi_exp_reveal_btn")}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </>)}
    </View>
  );
}

// ── BiMobileImportadoresSearch ─────────────────────────────────────────────────
function BiMobileImportadoresSearch({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
  const authH = (): HeadersInit => session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  const [q, setQ]                   = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching]   = useState(false);
  const [items, setItems]           = useState<BiImpItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [searched, setSearched]     = useState(false);
  const [credits, setCredits]       = useState<number | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const exhausted = credits !== null && credits <= 0;

  useEffect(() => {
    const val = q.trim();
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (val.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/wine-imports/bi-suggestions/importadores?q=${encodeURIComponent(val)}`, { headers: authH() });
        if (!res.ok) return;
        const json = await res.json() as { suggestions: string[] };
        setSuggestions(json.suggestions ?? []);
      } catch {}
    }, 300);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [q]);

  const spellCheck = async (sq: string) => {
    try {
      const res = await fetch(`${API_URL}/wine-imports/spell-correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({ query: sq, context: "importador" }),
      });
      if (!res.ok) return;
      const data = await res.json() as { corrected: string | null };
      if (data.corrected && data.corrected.toLowerCase() !== sq.toLowerCase()) setSuggestion(data.corrected);
    } catch {}
  };

  const doSearch = async (sq: string) => {
    if (!sq.trim() || searchingRef.current) return;
    searchingRef.current = true;
    setSuggestion(null);
    setSuggestions([]); setSearching(true); setItems([]); setSearched(false); setError(null);
    void spellCheck(sq);
    try {
      const params = new URLSearchParams({ q: sq, limit: "20", offset: "0" });
      const res = await fetch(`${API_URL}/wine-imports/bi-search/importadores?${params}`, { headers: authH() });
      if (res.status === 402) { setCredits(0); setError(t("mercado_screen.bi_error_exhausted")); }
      else if (!res.ok) { setError(t("mercado_screen.bi_error_search")); }
      else {
        const data = await res.json() as { items: BiImpItem[]; total: number; credits_remaining: number; credits_total: number };
        setItems(data.items); setTotal(data.total); setSearched(true);
        if (data.credits_remaining !== undefined) setCredits(data.credits_remaining);
      }
    } catch { setError(t("mercado_screen.bi_error_connection")); }
    finally { setSearching(false); searchingRef.current = false; }
  };

  return (
    <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: exhausted ? "#fca5a5" : colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 4, paddingVertical: 4 }}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>📦</Text>
          <TextInput value={q} onChangeText={setQ}
            placeholder={exhausted ? t("mercado_screen.bi_credits_exhausted") : t("mercado_screen.bi_imp_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: 12 }}
            editable={!exhausted} onSubmitEditing={() => doSearch(q)} returnKeyType="search" />
          {!!q && <TouchableOpacity onPress={() => { setQ(""); setItems([]); setSearched(false); setSuggestions([]); setSuggestion(null); }} style={{ padding: 8 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>}
        </View>
        <TouchableOpacity onPress={() => doSearch(q)} disabled={!q.trim() || searching || exhausted}
          style={{ paddingHorizontal: 16, borderRadius: 14, justifyContent: "center", backgroundColor: !q.trim() || searching || exhausted ? colors.border : colors.navy }}>
          {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{t("mercado_screen.bi_search_btn")}</Text>}
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && !searching && (
        <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={s} onPress={() => { setQ(s); setSuggestions([]); void doSearch(s); }} activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: i < suggestions.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 15 }}>📦</Text>
              <Text style={{ flex: 1, fontSize: 14, color: colors.navy, fontWeight: "500" }} numberOfLines={1}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!suggestion && (
        <TouchableOpacity
          onPress={() => { setQ(suggestion); setSuggestion(null); void doSearch(suggestion); }}
          activeOpacity={0.8}
          style={{ backgroundColor: "#f0f4ff", borderWidth: 1, borderColor: colors.navy + "30", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Feather name="edit-2" size={14} color={colors.navy} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.navy }}>
            {t("mercado_screen.bi_did_you_mean", { suggestion })}
          </Text>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
      {!!error && (
        <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Feather name="alert-circle" size={16} color="#dc2626" />
          <Text style={{ flex: 1, fontSize: 13, color: "#dc2626" }}>{error}</Text>
        </View>
      )}
      {!searched && !searching && suggestions.length === 0 && !error && (
        <View style={{ backgroundColor: colors.gold + "10", borderWidth: 1, borderColor: colors.gold + "30", borderRadius: 12, padding: 14, gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.navy }}>{t("mercado_screen.bi_imp_how_title")}</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
            {t("mercado_screen.bi_imp_how_text")}
          </Text>
        </View>
      )}

      {searching && (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 13 }}>{t("mercado_screen.bi_imp_searching")}</Text>
        </View>
      )}

      {searched && !searching && (<>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t("mercado_screen.bi_imp_count", { count: total })}</Text>
        {items.length === 0 && (
          <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.navy, marginBottom: 4 }}>{t("mercado_screen.bi_no_results_title")}</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>{t("mercado_screen.bi_imp_no_result_sub")}</Text>
          </View>
        )}
        {items.map(m => (
          <View key={m.id} style={{ backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.gold + "14", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>📦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.navy, marginBottom: 6 }}>{m.name}</Text>
              {!!m.segmentos && (
                <View style={{ backgroundColor: colors.gold + "12", borderWidth: 1, borderColor: colors.gold + "35", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.navy }}>{m.segmentos}</Text>
                </View>
              )}
              {m.exportadores.length > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.6 }}>{t("mercado_screen.bi_imp_imports_from")}</Text>
                  {m.exportadores.map((e, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 14 }}>🌍</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.navy }}>{e.exportador}</Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{e.pais}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={{ backgroundColor: colors.gold + "15", borderWidth: 1, borderColor: colors.gold + "35", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.gold }}>IMPORTADOR</Text>
            </View>
          </View>
        ))}
      </>)}
    </View>
  );
}

// ── BiMobileProdutoresSearch ───────────────────────────────────────────────────
function BiMobileProdutoresSearch({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
  const authH = (): HeadersInit => session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  const [q, setQ]                   = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching]   = useState(false);
  const [items, setItems]           = useState<BiProdItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [searched, setSearched]     = useState(false);
  const [credits, setCredits]       = useState<number | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const exhausted = credits !== null && credits <= 0;

  useEffect(() => {
    const val = q.trim();
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (val.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/wine-imports/bi-suggestions/produtores?q=${encodeURIComponent(val)}`, { headers: authH() });
        if (!res.ok) return;
        const json = await res.json() as { suggestions: string[] };
        setSuggestions(json.suggestions ?? []);
      } catch {}
    }, 300);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [q]);

  const spellCheck = async (sq: string) => {
    try {
      const res = await fetch(`${API_URL}/wine-imports/spell-correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({ query: sq, context: "produtor" }),
      });
      if (!res.ok) return;
      const data = await res.json() as { corrected: string | null };
      if (data.corrected && data.corrected.toLowerCase() !== sq.toLowerCase()) setSuggestion(data.corrected);
    } catch {}
  };

  const doSearch = async (sq: string) => {
    if (!sq.trim() || searchingRef.current) return;
    searchingRef.current = true;
    setSuggestion(null);
    setSuggestions([]); setSearching(true); setItems([]); setSearched(false); setError(null);
    void spellCheck(sq);
    try {
      const params = new URLSearchParams({ q: sq, limit: "20", offset: "0" });
      const res = await fetch(`${API_URL}/wine-imports/bi-search/produtores?${params}`, { headers: authH() });
      if (res.status === 402) { setCredits(0); setError(t("mercado_screen.bi_error_exhausted")); }
      else if (!res.ok) { setError(t("mercado_screen.bi_error_search")); }
      else {
        const data = await res.json() as { items: BiProdItem[]; total: number; credits_remaining: number; credits_total: number };
        setItems(data.items); setTotal(data.total); setSearched(true);
        if (data.credits_remaining !== undefined) setCredits(data.credits_remaining);
      }
    } catch { setError(t("mercado_screen.bi_error_connection")); }
    finally { setSearching(false); searchingRef.current = false; }
  };

  return (
    <View style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: exhausted ? "#fca5a5" : colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 4, paddingVertical: 4 }}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>🍇</Text>
          <TextInput value={q} onChangeText={setQ}
            placeholder={exhausted ? t("mercado_screen.bi_credits_exhausted") : t("mercado_screen.bi_prod_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: 12 }}
            editable={!exhausted} onSubmitEditing={() => doSearch(q)} returnKeyType="search" />
          {!!q && <TouchableOpacity onPress={() => { setQ(""); setItems([]); setSearched(false); setSuggestions([]); setSuggestion(null); }} style={{ padding: 8 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>}
        </View>
        <TouchableOpacity onPress={() => doSearch(q)} disabled={!q.trim() || searching || exhausted}
          style={{ paddingHorizontal: 16, borderRadius: 14, justifyContent: "center", backgroundColor: !q.trim() || searching || exhausted ? colors.border : colors.navy }}>
          {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{t("mercado_screen.bi_search_btn")}</Text>}
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && !searching && (
        <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={s} onPress={() => { setQ(s); setSuggestions([]); void doSearch(s); }} activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: i < suggestions.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 15 }}>🍇</Text>
              <Text style={{ flex: 1, fontSize: 14, color: colors.navy, fontWeight: "500" }} numberOfLines={1}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!suggestion && (
        <TouchableOpacity
          onPress={() => { setQ(suggestion); setSuggestion(null); void doSearch(suggestion); }}
          activeOpacity={0.8}
          style={{ backgroundColor: "#f0f4ff", borderWidth: 1, borderColor: colors.navy + "30", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Feather name="edit-2" size={14} color={colors.navy} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.navy }}>
            {t("mercado_screen.bi_did_you_mean", { suggestion })}
          </Text>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
      {!!error && (
        <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Feather name="alert-circle" size={16} color="#dc2626" />
          <Text style={{ flex: 1, fontSize: 13, color: "#dc2626" }}>{error}</Text>
        </View>
      )}
      {!searched && !searching && suggestions.length === 0 && !error && (
        <View style={{ backgroundColor: colors.gold + "10", borderWidth: 1, borderColor: colors.gold + "30", borderRadius: 12, padding: 14, gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.navy }}>{t("mercado_screen.bi_prod_how_title")}</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
            {t("mercado_screen.bi_prod_how_text")}
          </Text>
        </View>
      )}

      {searching && (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 13 }}>{t("mercado_screen.bi_prod_searching")}</Text>
        </View>
      )}

      {searched && !searching && (<>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t("mercado_screen.bi_prod_count", { count: total })}</Text>
        {items.length === 0 && (
          <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🍇</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.navy, marginBottom: 4 }}>{t("mercado_screen.bi_no_results_title")}</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>{t("mercado_screen.bi_prod_no_result_sub")}</Text>
          </View>
        )}
        {items.map(m => (
          <View key={m.id} style={{ backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "#72203712", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>🍇</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.navy, marginBottom: 2 }}>{m.name}</Text>
              {!!m.name_fantasia && <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>{m.name_fantasia}</Text>}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {!!m.regiao && (
                  <View style={{ backgroundColor: colors.gold + "12", borderWidth: 1, borderColor: colors.gold + "35", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.navy }}>📍 {m.regiao}</Text>
                  </View>
                )}
                {!!m.estado && (
                  <View style={{ backgroundColor: "#f5f4ef", borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{m.estado}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ backgroundColor: "#72203712", borderWidth: 1, borderColor: "#72203735", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#722f37" }}>PRODUTOR</Text>
            </View>
          </View>
        ))}
      </>)}
    </View>
  );
}

// ── IdealBISearchView (main) ───────────────────────────────────────────────────
function IdealBISearchView({ colors, bottomPad }: { colors: ReturnType<typeof useColors>; bottomPad: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();

  const [searchMode, setSearchMode]     = useState<BiSearchMode>("exportador");

  const [query, setQuery]               = useState("");
  const [credits, setCredits]           = useState<number | null>(null);
  const [creditsTotal, setCreditsTotal] = useState(3);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [searching, setSearching]       = useState(false);
  const [result, setResult]             = useState<WineRecord | null | "not_found" | "out_of_scope">(null);
  const [brandExtracted, setBrandExtracted] = useState<string | null>(null);
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

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

  /* Fetch label autocomplete suggestions from DB as user types */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/wine-imports/suggestions?q=${encodeURIComponent(q)}`,
          { headers: authHeader() },
        );
        if (!res.ok) return;
        const json = await res.json() as { suggestions: string[] };
        setSuggestions(json.suggestions ?? []);
      } catch {}
    }, 300);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [query]);

  const spellCheck = async (sq: string) => {
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/wine-imports/spell-correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ query: sq, context: "marca" }),
      });
      if (!res.ok) return;
      const data = await res.json() as { corrected: string | null };
      if (data.corrected && data.corrected.toLowerCase() !== sq.toLowerCase()) setSuggestion(data.corrected);
    } catch {}
  };

  const handleSearch = async (overrideQ?: string, opts?: { direct?: boolean }) => {
    const q = (overrideQ ?? query).trim();
    if (!q || searching || exhausted) return;
    setSuggestion(null);
    setSuggestions([]);
    setSearching(true);
    setResult(null);
    setBrandExtracted(null);
    void spellCheck(q);
    try {
      const directParam = opts?.direct ? "&direct=true" : "";
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/wine-imports/search?q=${encodeURIComponent(q)}${directParam}`,
        { headers: authHeader() }
      );
      if (res.status === 402) {
        setCredits(0);
        setResult("not_found");
        setSearching(false);
        return;
      }
      if (res.status === 422) {
        setResult("out_of_scope");
        setSearching(false);
        return;
      }
      if (!res.ok) throw new Error("server error");
      const json = await res.json() as {
        data: { id: number; marca_completa: string; marca_relatorio: string | null; pais_de_origem: string | null; distribuidor: string | null }[];
        distribuidores?: { name: string; company_page_id: string | null }[];
        brand_extracted: string | null;
        credits_remaining: number;
        credits_total: number;
      };
      setCredits(json.credits_remaining);
      setCreditsTotal(json.credits_total);
      if (json.brand_extracted) setBrandExtracted(json.brand_extracted);
      const rows = json.data ?? [];
      if (rows.length > 0) {
        const first = rows[0];
        // Prefer server-deduped distribuidores; fall back to deriving from rows.
        let distribuidores: WineDistribuidor[] = (json.distribuidores ?? []).map((d) => ({
          name: d.name,
          company_page_id: d.company_page_id ?? null,
        }));
        if (distribuidores.length === 0) {
          const seen = new Set<string>();
          for (const r of rows) {
            const n = (r.distribuidor ?? "").trim();
            if (!n) continue;
            const k = n.toLowerCase();
            if (!seen.has(k)) { seen.add(k); distribuidores.push({ name: n, company_page_id: null }); }
          }
        }
        setResult({
          id: first.id,
          marcaCompleta: first.marca_completa,
          marcaRelatorio: first.marca_relatorio ?? undefined,
          paisDeOrigem: first.pais_de_origem ?? undefined,
          distribuidor: distribuidores[0]?.name ?? (first.distribuidor ?? "—"),
          distribuidores,
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
      {/* ── Search Mode Selector ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        {([
          { key: "exportador",   icon: "🌐", label: t("mercado_screen.bi_search_exportadores") },
          { key: "marca",        icon: "🔍", label: t("mercado_screen.bi_search_rotulo") },
          { key: "importadores", icon: "📦", label: t("mercado_screen.bi_search_importadores") },
          { key: "produtores",   icon: "🍇", label: t("mercado_screen.bi_search_produtores") },
        ] as { key: BiSearchMode; icon: string; label: string }[]).map(m => {
          const active = searchMode === m.key;
          return (
            <TouchableOpacity key={m.key} onPress={() => setSearchMode(m.key)}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: active ? colors.navy : colors.border, backgroundColor: active ? colors.navy : "#fff" }}>
              <Text style={{ fontSize: 13 }}>{m.icon}</Text>
              <Text style={{ fontSize: 13, fontWeight: active ? "700" : "500", color: active ? "#fff" : colors.mutedForeground }}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {searchMode === "exportador"   && <BiMobileExportadorSearch   colors={colors} />}
      {searchMode === "importadores" && <BiMobileImportadoresSearch colors={colors} />}
      {searchMode === "produtores"   && <BiMobileProdutoresSearch   colors={colors} />}

      {searchMode === "marca" && (<>
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
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{t("mercado_screen.bi_marca_credits_label")}</Text>
              <Text style={[styles.kpiPeriod, { color: colors.mutedForeground }]}>
                {t("mercado_screen.bi_marca_credits_period", { total: creditsTotal })}
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
                  {exhausted ? t("mercado_screen.bi_marca_exhausted_badge") : credits === 1 ? t("mercado_screen.bi_marca_critical_badge") : t("mercado_screen.bi_marca_active_badge")}
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
          <Text style={[styles.lockedTitle, { color: colors.navy }]}>{t("mercado_screen.bi_marca_limit_title")}</Text>
          <Text style={[styles.lockedSub, { color: colors.mutedForeground }]}>
            {t("mercado_screen.bi_marca_limit_sub")}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.gold, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 }}
            onPress={() => router.push("/subscription")}
            activeOpacity={0.8}
          >
            <Feather name="zap" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{t("mercado_screen.bi_marca_upgrade_btn")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Search section ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        {/* Section label */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {t("mercado_screen.bi_marca_search_label")}
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
            placeholder={exhausted ? t("mercado_screen.bi_marca_placeholder_exhausted") : t("mercado_screen.bi_marca_placeholder_active")}
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: colors.foreground, paddingVertical: 13 }}
            editable={!exhausted && !searching}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          <TouchableOpacity
            onPress={() => handleSearch()}
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

        {/* Autocomplete suggestions from DB */}
        {suggestions.length > 0 && !exhausted && !searching && (
          <View style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginTop: 2 }}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={s}
                onPress={() => { setQuery(s); handleSearch(s, { direct: true }); }}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: i < suggestions.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
              >
                <Text style={{ fontSize: 16 }}>🍷</Text>
                <Text style={{ flex: 1, fontSize: 14, color: colors.navy, fontWeight: "500" }} numberOfLines={1}>{s}</Text>
                <View style={{ backgroundColor: colors.gold + "22", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>{t("mercado_screen.bi_marca_credit_chip")}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Você quis dizer? */}
        {!!suggestion && (
          <TouchableOpacity
            onPress={() => { setQuery(suggestion); setSuggestion(null); handleSearch(suggestion); }}
            activeOpacity={0.8}
            style={{ backgroundColor: "#f0f4ff", borderWidth: 1, borderColor: colors.navy + "30", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Feather name="edit-2" size={14} color={colors.navy} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.navy }}>
              {t("mercado_screen.bi_did_you_mean", { suggestion })}
            </Text>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        {/* Info hint when idle */}
        {!result && !searching && suggestions.length === 0 && (
          <View style={{ backgroundColor: colors.gold + "10", borderWidth: 1, borderColor: colors.gold + "30", borderRadius: 12, padding: 14, gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.navy }}>{t("mercado_screen.bi_marca_how_title")}</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
              {t("mercado_screen.bi_marca_how_text")}
            </Text>
          </View>
        )}
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
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{t("mercado_screen.bi_marca_ai_label")}</Text>
                <Text style={[styles.kpiValue, { fontSize: 16, color: colors.navy }]}>{t("mercado_screen.bi_marca_ai_searching")}</Text>
                <Text style={[styles.kpiPeriod, { color: colors.mutedForeground }]}>
                  {t("mercado_screen.bi_marca_ai_subtitle")}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── Out of scope ── */}
      {!searching && result === "out_of_scope" && (
        <View style={[styles.lockedCard, { backgroundColor: "#fff", borderColor: "#fbbf24" }]}>
          <View style={[styles.lockedIconBox, { backgroundColor: colors.gold + "15" }]}>
            <Feather name="alert-circle" size={22} color={colors.gold} />
          </View>
          <Text style={[styles.lockedTitle, { color: colors.navy }]}>{t("mercado_screen.bi_marca_scope_title")}</Text>
          <Text style={[styles.lockedSub, { color: colors.mutedForeground }]}>
            {t("mercado_screen.bi_marca_scope_sub")}
          </Text>
        </View>
      )}

      {/* ── Not found ── */}
      {!searching && result === "not_found" && (
        <View style={[styles.lockedCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={[styles.lockedIconBox, { backgroundColor: colors.gold + "15" }]}>
            <Feather name="search" size={22} color={colors.gold} />
          </View>
          <Text style={[styles.lockedTitle, { color: colors.navy }]}>
            {brandExtracted ? t("mercado_screen.bi_marca_not_found_brand", { brand: brandExtracted }) : t("mercado_screen.bi_marca_not_found_generic")}
          </Text>
          <Text style={[styles.lockedSub, { color: colors.mutedForeground }]}>
            {brandExtracted
              ? t("mercado_screen.bi_marca_not_found_sub_brand", { brand: brandExtracted })
              : t("mercado_screen.bi_marca_not_found_sub_generic")}
          </Text>
        </View>
      )}

      {/* ── Result — KPI cards matching Visão Geral ── */}
      {!searching && result && result !== "not_found" && result !== "out_of_scope" && (
        <View style={[styles.kpiList, { paddingTop: 12 }]}>

          {/* Brand header card */}
          <View style={[styles.kpiCard, { backgroundColor: colors.gold, borderColor: colors.gold, flexDirection: "column", alignItems: "flex-start", gap: 2 }]}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.75)", letterSpacing: 0.8, textTransform: "uppercase" }}>
              {brandExtracted && !result.marcaCompleta.toLowerCase().includes(brandExtracted.toLowerCase())
                ? t("mercado_screen.bi_marca_ai_identified", { brand: brandExtracted })
                : t("mercado_screen.bi_marca_result_found")}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff", lineHeight: 24 }}>
              {result.marcaCompleta}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Feather name="check-circle" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
                {t("mercado_screen.bi_marca_credits_used", { count: credits ?? 0, remaining: credits ?? 0 })}
              </Text>
            </View>
          </View>

          {/* Data KPI cards */}
          {([
            ...(result.marcaRelatorio && result.marcaRelatorio !== result.marcaCompleta
              ? [{ icon: "tag",     label: t("mercado_screen.bi_marca_report_label"), value: result.marcaRelatorio }]
              : []),
            ...(result.paisDeOrigem
              ? [{ icon: "globe",   label: t("mercado_screen.bi_marca_origin_label"), value: result.paisDeOrigem  }]
              : []),
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

          {/* Distribuidores BR — pode ter 2+ */}
          {result.distribuidores.length > 0 && (
            <View style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border, alignItems: "flex-start" }]}>
              <View style={[styles.kpiLeft, { alignItems: "flex-start" }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: colors.gold + "18" }]}>
                  <Feather name="package" size={20} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>
                    {result.distribuidores.length > 1
                      ? t("mercado_screen.bi_marca_distributor_multi", { count: result.distribuidores.length })
                      : t("mercado_screen.bi_marca_distributor_single")}
                  </Text>
                  <View style={{ marginTop: 4, gap: 4 }}>
                    {result.distribuidores.map((d, idx) => (
                      <TouchableOpacity
                        key={`${d.name}-${idx}`}
                        disabled={!d.company_page_id}
                        onPress={() => d.company_page_id && router.push(`/empresa/${d.company_page_id}` as any)}
                        activeOpacity={d.company_page_id ? 0.6 : 1}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: d.company_page_id ? colors.gold : colors.navy, textDecorationLine: d.company_page_id ? "underline" : "none" }}>
                          {d.name}
                        </Text>
                        {d.company_page_id ? (
                          <Feather name="external-link" size={12} color={colors.gold} />
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}
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
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{t("mercado_screen.bi_marca_how_empty")}</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.navy, marginTop: 2, lineHeight: 18 }}>
                  {t("mercado_screen.bi_marca_how_empty_text")}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
      </>)}
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
  const { t } = useTranslation();
  const isReply = depth > 0;
  const authorName  = comment.author?.full_name ?? "Usuário";
  const authorPos   = comment.author?.position;
  const authorComp  = comment.author?.company;
  const subtitle    = [authorPos, authorComp].filter(Boolean).join(" · ");
  const timeStr     = new Date(comment.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const [liked,      setLiked]      = useState(comment.is_liked ?? false);
  const [likeCount,  setLikeCount]  = useState(comment.likes_count ?? 0);
  const [liking,     setLiking]     = useState(false);

  const handleLikeComment = async () => {
    if (liking) return;
    setLiking(true);
    const prev = liked;
    setLiked(!prev);
    setLikeCount(c => prev ? Math.max(0, c - 1) : c + 1);
    const result = await API.toggleMarketCommentLike(comment.id, userId, prev);
    if (result) {
      setLiked(result.is_liked);
      setLikeCount(result.likes_count);
    }
    setLiking(false);
  };

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
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>{t("mercado_screen.comment_reply_btn")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLikeComment}
              disabled={liking}
              style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
            >
              <Feather name="heart" size={12} color={liked ? "#dc2626" : colors.mutedForeground} />
              {likeCount > 0 && (
                <Text style={{ fontSize: 11, color: liked ? "#dc2626" : colors.mutedForeground }}>{likeCount}</Text>
              )}
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
  const { t } = useTranslation();
  const [comments,    setComments]    = useState<API.MarketComment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [text,        setText]        = useState("");
  const [sending,     setSending]     = useState(false);
  const [replyTo,     setReplyTo]     = useState<API.MarketComment | null>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    API.fetchMarketComments(postId, userId).then(c => { setComments(c); setLoading(false); });
  }, [postId]);

  const handleReply = (comment: API.MarketComment) => {
    setReplyTo(comment);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const cancelReply = () => { setReplyTo(null); };

  const send = async () => {
    const txt = text.trim();
    if (!txt || !userId) return;
    setSending(true);
    const c = await API.addMarketComment(postId, userId, txt, replyTo?.id ?? null);
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
          {loading ? t("mercado_screen.comments_loading") : t("mercado_screen.comments_count", { count: comments.reduce((a, c) => a + 1 + (c.replies?.length ?? 0), 0) })}
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
              {t("mercado_screen.comment_reply_to", { name: replyTo.author?.full_name ?? "Usuário" })}
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={cancelReply}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          >
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
          placeholder={replyTo ? t("mercado_screen.comments_reply_placeholder", { name: replyTo.author?.full_name ?? "Usuário" }) : t("mercado_screen.comments_forum_placeholder")}
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
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
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
  const { t } = useTranslation();
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
              {t("mercado_screen.likers_title")} {likers.length > 0 ? `(${likers.length})` : ""}
            </Text>
            <TouchableOpacity onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("mercado_screen.kpi_close")}
          >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginVertical: 24 }} />
          ) : likers.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, textAlign: "center", marginVertical: 24 }}>
              {t("mercado_screen.likers_empty")}
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
                    <Text style={{ fontSize: 18 }}>
                      {REACTIONS.find(r => r.type === l.reaction_type)?.emoji ?? "🍷"}
                    </Text>
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
  onPollVote: (opts: API.MarketPollOption[], votes: string[]) => void;
}) {
  const { t } = useTranslation();
  const [post, setPost]             = useState(initialPost);
  const [voting, setVoting]         = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const [voters, setVoters]         = useState<{ id: string; full_name: string | null; avatar_url: string | null; username: string | null; optionId: string }[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const opts         = post.poll_options ?? [];
  const total        = opts.reduce((s, o) => s + o.votes_count, 0);
  const allowMultiple = post.poll_allow_multiple ?? false;
  const currentVotes  = post.user_poll_votes ?? [];
  const hasVoted      = currentVotes.length > 0;

  useEffect(() => { setPost(initialPost); }, [initialPost]);

  const handleVote = async (optId: string) => {
    if (voting) return;
    setVoting(true);
    const result = await API.voteOnMarketPoll(post.id, userId, optId);
    if (result) {
      const { poll_options: updatedOpts, user_poll_votes: updatedVotes } = result;
      onPollVote(updatedOpts, updatedVotes);
      setPost(p => ({ ...p, poll_options: updatedOpts, user_poll_votes: updatedVotes.length ? updatedVotes : null }));
    }
    setVoting(false);
  };

  const handleShowVoters = async () => {
    setShowVoters(true);
    if (voters.length === 0 && !loadingVoters) {
      setLoadingVoters(true);
      const v = await API.fetchMarketPollVoters(post.id);
      setVoters(v);
      setLoadingVoters(false);
    }
  };

  return (
    <>
      <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
        {allowMultiple ? (
          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 2 }}>{t("mercado_screen.poll_multiple_hint")}</Text>
        ) : null}
        {opts.map(opt => {
          const pct   = total > 0 ? Math.round((opt.votes_count / total) * 100) : 0;
          const voted = currentVotes.includes(opt.id);
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => handleVote(opt.id)}
              disabled={voting}
              style={{ borderRadius: 10, borderWidth: 1.5, borderColor: voted ? colors.gold : colors.border, overflow: "hidden" }}
            >
              <View style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${pct}%`, backgroundColor: voted ? colors.gold + "28" : "#f0f0ec" }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  {allowMultiple ? (
                    voted
                      ? <AntDesign name={"checksquare" as any} size={18} color={colors.gold} />
                      : <AntDesign name={"checksquareo" as any} size={18} color={colors.mutedForeground} />
                  ) : (
                    voted
                      ? <AntDesign name={"checkcircle" as any} size={18} color={colors.gold} />
                      : <AntDesign name={"circleo" as any} size={18} color={colors.mutedForeground} />
                  )}
                  <Text style={{ fontSize: 13, fontWeight: voted ? "700" : "400", color: voted ? colors.navy : colors.foreground, flex: 1 }}>
                    {opt.text}
                  </Text>
                </View>
                {hasVoted ? (
                  <Text style={{ fontSize: 12, fontWeight: "700", color: voted ? colors.gold : colors.mutedForeground }}>{pct}%</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{t("mercado_screen.poll_votes", { count: total })}</Text>
          {total > 0 && hasVoted && (
            <TouchableOpacity onPress={handleShowVoters}>
              <Text style={{ fontSize: 11, color: colors.navy, fontWeight: "600" }}>{t("mercado_screen.poll_see_votes")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Voter list modal ── */}
      <Modal visible={showVoters} transparent animationType="fade" onRequestClose={() => setShowVoters(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
          onPress={() => setShowVoters(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingBottom: 24 }}>
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.navy, paddingHorizontal: 20, marginBottom: 4 }}>
              {t("mercado_screen.poll_votes_modal_title", { count: total, total })}
            </Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}>
              {loadingVoters ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t("mercado_screen.poll_votes_loading")}</Text>
              ) : voters.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t("mercado_screen.poll_votes_empty")}</Text>
              ) : (
                opts.map(opt => {
                  const optVoters = voters.filter(v => v.optionId === opt.id);
                  if (optVoters.length === 0) return null;
                  return (
                    <View key={opt.id} style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.mutedForeground, marginBottom: 8 }}>
                        {opt.text} · {optVoters.length}
                      </Text>
                      {optVoters.map((v, vi) => (
                        <View key={`${v.id}-${vi}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <IdealBIAvatar src={v.avatar_url} name={v.full_name ?? v.username ?? "?"} size={34} />
                          <Text style={{ fontSize: 14, color: colors.navy, fontWeight: "500" }}>
                            {v.full_name ?? v.username ?? "Usuário"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function MarketPostCardMobile({ post: initialPost, userId, onLikeToggle, colors, isVisible, onUserPlayVideo, onSwipeNextVideo, onSwipeBackVideo, canSwipeNextVideo, canSwipeBackVideo, playToken }: {
  post: API.MarketPost; userId: string;
  onLikeToggle: (id: string, liked: boolean, reactionType: string | null, count: number) => void;
  colors: ReturnType<typeof useColors>;
  isVisible: boolean;
  onUserPlayVideo: (postId: string) => void;
  onSwipeNextVideo: (postId: string) => void;
  onSwipeBackVideo: (postId: string) => void;
  canSwipeNextVideo: boolean;
  canSwipeBackVideo: boolean;
  playToken: number;
}) {
  const { t } = useTranslation();
  const [post,           setPost]           = useState<API.MarketPost>(initialPost);
  const [showComments,   setShowComments]   = useState(false);
  const [showLikers,     setShowLikers]     = useState(false);
  const [liking,         setLiking]         = useState(false);
  const [showReactions,  setShowReactions]  = useState(false);
  const dateStr = new Date(post.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  useEffect(() => { setPost(initialPost); }, [initialPost]);

  const handleReact = async (reactionType: ReactionType) => {
    if (liking) return;
    setLiking(true);
    const currentReaction = post.reaction_type ?? null;
    if (currentReaction === reactionType) {
      setPost(p => ({ ...p, user_liked: false, reaction_type: null, likes_count: Math.max(0, p.likes_count - 1) }));
    } else {
      setPost(p => ({ ...p, user_liked: true, reaction_type: reactionType, likes_count: currentReaction ? p.likes_count : p.likes_count + 1 }));
    }
    const result = await API.toggleMarketPostReaction(post.id, userId, reactionType, currentReaction, post.likes_count);
    setPost(p => ({ ...p, user_liked: result.user_liked, reaction_type: result.reaction_type, likes_count: result.likes_count }));
    onLikeToggle(post.id, result.user_liked, result.reaction_type, result.likes_count);
    setLiking(false);
  };

  const handleLikeTap = () => {
    const defaultReaction: ReactionType = (post.reaction_type as ReactionType) ?? "saude";
    handleReact(defaultReaction);
  };

  const handlePollVote = (opts: API.MarketPollOption[], votes: string[]) => {
    setPost(p => ({ ...p, poll_options: opts, user_poll_votes: votes.length ? votes : null }));
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
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.gold }}>{t("mercado_screen.idealbi_post_badge")}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>{t("mercado_screen.idealbi_post_subtitle")}</Text>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>{dateStr}</Text>
        </View>
      </View>

      {/* Content */}
      <Text style={{ fontSize: 14, lineHeight: 22, color: colors.foreground, paddingHorizontal: 14, paddingBottom: hasMedia || hasPoll ? 10 : 14 }}>
        {post.content}
      </Text>

      {post.image_url ? (
        <AdaptiveImage uri={post.image_url} width={IDEAL_CARD_W} style={{ borderRadius: 0 }} />
      ) : null}
      {post.video_url ? (
        <NetworkPostVideo
          uri={post.video_url}
          isVisible={isVisible}
          onUserPlay={() => onUserPlayVideo(post.id)}
          onSwipeNext={canSwipeNextVideo ? () => onSwipeNextVideo(post.id) : undefined}
          onSwipeBack={canSwipeBackVideo ? () => onSwipeBackVideo(post.id) : undefined}
          playToken={playToken}
        />
      ) : null}
      {hasPoll ? (
        <MarketPollMobile post={post} userId={userId} colors={colors} onPollVote={handlePollVote} />
      ) : null}

      {/* Stats bar (reaction emoji summary) */}
      {post.likes_count > 0 && (
        <TouchableOpacity
          onPress={() => setShowLikers(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingTop: 8 }}
        >
          <View style={{ flexDirection: "row", gap: -4 }}>
            {REACTIONS.slice(0, 3).map(r => (
              <View key={r.type} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 9 }}>{r.emoji}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            {t("mercado_screen.post_react", { count: post.likes_count })} · {t("mercado_screen.post_see_reactions")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Reaction picker modal */}
      <ReactionPicker
        visible={showReactions}
        onSelect={r => { setShowReactions(false); handleReact(r); }}
        onClose={() => setShowReactions(false)}
      />

      {/* Action bar */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 8 }}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8 }}
          onPress={handleLikeTap}
          onLongPress={() => setShowReactions(true)}
          delayLongPress={400}
          disabled={liking}
          activeOpacity={0.7}
        >
          {post.user_liked && post.reaction_type
            ? (() => {
                const r = REACTIONS.find(x => x.type === post.reaction_type);
                return r ? (
                  <>
                    <Text style={{ fontSize: 20 }}>{r.emoji}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#dc2626" }}>{r.label}</Text>
                  </>
                ) : <AntDesign name="heart" size={22} color="#dc2626" />;
              })()
            : (
              <>
                <AntDesign name="heart" size={22} color={post.user_liked ? "#dc2626" : colors.mutedForeground} />
                <Text style={{ fontSize: 13, fontWeight: "500", color: colors.mutedForeground }}>{t("mercado_screen.post_react_btn")}</Text>
              </>
            )
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8 }}
          onPress={() => setShowComments(v => !v)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="comment-outline" size={22} color={showComments ? colors.navy : colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: "500", color: showComments ? colors.navy : colors.mutedForeground }}>
            {totalComments > 0 ? t("mercado_screen.post_comment", { count: totalComments }) : t("mercado_screen.post_comment_btn")}
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
  const { t } = useTranslation();
  const router = useRouter();
  const { hasFeature: permHasFeature } = usePermissions();
  const [idealbiSubTab, setIdealbiSubTab] = useState<IdealBISubTab>("feed");
  const [newContent, setNewContent] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [posting, setPosting] = useState(false);

  // Keyboard-aware composer: track the focused input and the FlatList's scroll
  // offset so we can scroll the focused input above the keyboard line.
  // KeyboardAvoidingView shrinks the viewport but does not auto-scroll
  // FlatList contents on focus changes.
  const flatListRef = useRef<FlatList<API.MarketPost> | null>(null);
  const scrollOffset = useRef(0);
  const focusedInputRef = useRef<TextInput | null>(null);
  const keyboardHeight = useRef(0);
  const ensureFocusedInputVisible = useCallback(() => {
    if (Platform.OS === "web") return;
    const input = focusedInputRef.current;
    if (!input || keyboardHeight.current <= 0) return;
    const screenH = Dimensions.get("window").height;
    const visibleBottom = screenH - keyboardHeight.current;
    input.measureInWindow((_x, y, _w, h) => {
      const inputBottom = y + h;
      const overlap = inputBottom - (visibleBottom - 16);
      if (overlap > 0) {
        flatListRef.current?.scrollToOffset({
          offset: scrollOffset.current + overlap,
          animated: true,
        });
      }
    });
  }, []);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const showSub = Keyboard.addListener("keyboardDidShow", e => {
      keyboardHeight.current = e.endCoordinates.height;
      ensureFocusedInputVisible();
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardHeight.current = 0;
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [ensureFocusedInputVisible]);
  const handleInputFocus = useCallback((ref: React.RefObject<TextInput | null>) => () => {
    focusedInputRef.current = ref.current;
    // Re-run scroll-into-view in case the keyboard is already open and focus
    // moved from one input to another (no new keyboardDidShow fires then).
    setTimeout(ensureFocusedInputVisible, 50);
  }, [ensureFocusedInputVisible]);
  const postInputRef = useRef<TextInput>(null);
  const pollOptionRefs = useRef<(TextInput | null)[]>([]);

  // Single-active video: only the most-centered visible video post plays.
  const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const videoItems = viewableItems.filter(v => {
      if (!v.isViewable || !v.item) return false;
      return !!(v.item as API.MarketPost).video_url;
    });
    if (videoItems.length === 0) {
      setActiveVideoPostId(null);
      return;
    }
    const mid = videoItems[Math.floor(videoItems.length / 2)];
    setActiveVideoPostId((mid.item as API.MarketPost).id);
  }, []);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const hasAccess = permHasFeature("mercado:idealbi") || isAdmin;

  const fetcher = useCallback(
    (offset: number, limit: number) =>
      hasAccess ? API.fetchMarketPosts(userId, offset, limit) : Promise.resolve([]),
    [hasAccess, userId],
  );

  const { items: posts, loading, loadingMore, loadMore, refresh, setItems: setPosts } =
    usePaginatedQuery<API.MarketPost>(fetcher);

  useEffect(() => { refresh(); }, [hasAccess]);

  const handleLikeToggle = (id: string, liked: boolean, reactionType: string | null, count: number) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, user_liked: liked, reaction_type: reactionType, likes_count: count } : p));
  };

  // Reels-style swipe navigation between video posts. Skips non-video posts;
  // the viewability callback above promotes the new active video on landing.
  // We remember the swipe target with a bumping nonce so the FeedVideo for
  // *that specific post* can force play even if it was previously user-paused
  // — ordinary scrolling never bumps the nonce so paused videos stay paused.
  const [swipeTarget, setSwipeTarget] = useState<{ id: string; nonce: number } | null>(null);
  const jumpToVideo = useCallback((currentId: string, direction: 1 | -1) => {
    const videoIdxList: number[] = [];
    posts.forEach((p, i) => { if (p.video_url) videoIdxList.push(i); });
    const here = videoIdxList.findIndex(i => posts[i].id === currentId);
    if (here < 0) return;
    const targetIdxInAll = videoIdxList[here + direction];
    if (targetIdxInAll == null) return;
    const targetId = posts[targetIdxInAll].id;
    setActiveVideoPostId(targetId);
    setSwipeTarget(prev => ({ id: targetId, nonce: (prev?.nonce ?? 0) + 1 }));
    flatListRef.current?.scrollToIndex({ index: targetIdxInAll, animated: true, viewPosition: 0 });
  }, [posts]);

  // Boundary guards used to disable the swipe gesture on the first/last
  // video so the FlatList can keep ownership of the fling.
  const videoPostIds = useMemo(() => posts.filter(p => p.video_url).map(p => p.id), [posts]);
  const canSwipeNext = useCallback((id: string) => {
    const i = videoPostIds.indexOf(id);
    return i >= 0 && i < videoPostIds.length - 1;
  }, [videoPostIds]);
  const canSwipeBack = useCallback((id: string) => {
    const i = videoPostIds.indexOf(id);
    return i > 0;
  }, [videoPostIds]);

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
    setPollMode(false); setPollOptions(["", ""]); setPollAllowMultiple(false);
  };

  const handlePost = async () => {
    const txt = newContent.trim();
    if (!txt || !isAdmin || posting) return;
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

    const post = await API.createMarketPost(userId, txt, imageUrl, videoUrl, finalPollOptions, pollAllowMultiple);
    if (post) { setPosts(prev => [post, ...prev]); resetForm(); }
    setPosting(false);
  };

  if (!hasAccess) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: "#c9a84c18", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 36 }}>📡</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.navy, textAlign: "center" }}>{t("mercado_screen.idealbi_paywall_title")}</Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 21 }}>
          {t("mercado_screen.idealbi_paywall_desc")}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.gold, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 }}
          onPress={() => router.push("/subscription")}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("mercado_screen.locked_see_plans")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const AdminHeader = isAdmin ? (
    <View style={{ marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", padding: 14, gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.navy }}>{t("mercado_screen.admin_post_title")}</Text>
      <TextInput
        ref={postInputRef}
        value={newContent}
        onChangeText={setNewContent}
        onFocus={handleInputFocus(postInputRef)}
        placeholder={t("mercado_screen.admin_post_placeholder")}
        placeholderTextColor={colors.mutedForeground}
        multiline
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.foreground, minHeight: 80, textAlignVertical: "top" }}
      />

      {/* Media preview */}
      {mediaUri && mediaType === "image" ? (
        <View style={{ position: "relative" }}>
          <Image source={{ uri: mediaUri }} style={{ width: "100%", height: 180, borderRadius: 10 } as any} contentFit="cover" />
          <TouchableOpacity onPress={() => { setMediaUri(null); setMediaType(null); }} style={{ position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 4 }} accessibilityRole="button" accessibilityLabel="Fechar">
            <Feather name="x" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
      {mediaUri && mediaType === "video" ? (
        <View style={{ position: "relative" }}>
          <NetworkMediaPreview uri={mediaUri} />
          <TouchableOpacity onPress={() => { setMediaUri(null); setMediaType(null); }} style={{ position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 4 }} accessibilityRole="button" accessibilityLabel="Fechar">
            <Feather name="x" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Poll builder */}
      {pollMode ? (
        <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, backgroundColor: "#fafaf8", gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.gold }}>{t("mercado_screen.admin_poll_options_title")}</Text>
          {pollOptions.map((opt, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <TextInput
                ref={el => { pollOptionRefs.current[i] = el; }}
                value={opt}
                onChangeText={v => setPollOptions(prev => prev.map((o, j) => j === i ? v : o))}
                onFocus={() => {
                  focusedInputRef.current = pollOptionRefs.current[i];
                  setTimeout(ensureFocusedInputVisible, 50);
                }}
                placeholder={t("mercado_screen.admin_poll_option_placeholder", { n: i + 1 })}
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: colors.foreground }}
              />
              {pollOptions.length > 2 ? (
                <TouchableOpacity onPress={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel="Fechar">
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {pollOptions.length < 5 ? (
            <TouchableOpacity onPress={() => setPollOptions(prev => [...prev, ""])}>
              <Text style={{ fontSize: 12, color: colors.gold, fontWeight: "600" }}>{t("mercado_screen.admin_poll_add_option")}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setPollAllowMultiple(v => !v)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}
          >
            <AntDesign name={pollAllowMultiple ? ("checksquare" as any) : ("checksquareo" as any)} size={18} color={pollAllowMultiple ? colors.gold : colors.mutedForeground} />
            <Text style={{ fontSize: 12, color: pollAllowMultiple ? colors.gold : colors.mutedForeground, fontWeight: pollAllowMultiple ? "700" : "400" }}>
              {t("mercado_screen.admin_poll_allow_multiple")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Toolbar */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <TouchableOpacity onPress={() => pickMedia("image")} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <Feather name="image" size={14} color={colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t("mercado_screen.admin_media_image")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => pickMedia("video")} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <Feather name="video" size={14} color={colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{t("mercado_screen.admin_media_video")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPollMode(v => !v)}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: pollMode ? colors.gold : colors.border, backgroundColor: pollMode ? colors.gold + "15" : "transparent" }}
        >
          <Feather name="bar-chart-2" size={14} color={pollMode ? colors.gold : colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: pollMode ? colors.gold : colors.mutedForeground, fontWeight: pollMode ? "700" : "400" }}>{t("mercado_screen.admin_media_poll")}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ backgroundColor: newContent.trim() ? colors.gold : colors.gold + "55", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
        onPress={handlePost}
        disabled={posting || !newContent.trim()}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{posting ? t("mercado_screen.admin_posting") : t("mercado_screen.admin_publish_btn")}</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tab bar: Feed | 🔍 IA — same pill style as Visão Geral period filter */}
      <View style={[styles.periodRow, { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        {([
          { key: "feed",   label: "Feed"  },
          { key: "search", label: "🔍 IA" },
        ] as { key: IdealBISubTab; label: string }[]).map(tab => {
          const active = idealbiSubTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.periodBtn, active && [styles.periodBtnActive, { backgroundColor: colors.gold }]]}
              onPress={() => setIdealbiSubTab(tab.key)}
            >
              <Text style={[styles.periodBtnText, { color: active ? "#fff" : colors.mutedForeground }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {idealbiSubTab === "search" ? (
        <IdealBISearchView colors={colors} bottomPad={bottomPad} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
          keyboardVerticalOffset={0}
        >
        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: bottomPad, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={e => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={32}
          ListHeaderComponent={AdminHeader}
          ListEmptyComponent={loading ? (
            <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 60 }} />
          ) : (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <Text style={{ fontSize: 36 }}>📡</Text>
              <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: "center" }}>
                {t("mercado_screen.idealbi_empty")}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <MarketPostCardMobile
              post={item}
              userId={userId}
              onLikeToggle={handleLikeToggle}
              colors={colors}
              isVisible={item.id === activeVideoPostId}
              onUserPlayVideo={setActiveVideoPostId}
              onSwipeNextVideo={(id) => jumpToVideo(id, 1)}
              onSwipeBackVideo={(id) => jumpToVideo(id, -1)}
              canSwipeNextVideo={canSwipeNext(item.id)}
              canSwipeBackVideo={canSwipeBack(item.id)}
              playToken={swipeTarget && swipeTarget.id === item.id ? swipeTarget.nonce : 0}
            />
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          // Item heights are dynamic, so a swipe-driven `scrollToIndex` to an
          // unmeasured row can fail. Fall back to an offset estimate and retry.
          onScrollToIndexFailed={(info) => {
            const offset = info.averageItemLength * info.index;
            flatListRef.current?.scrollToOffset({ offset, animated: true });
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0 });
            }, 200);
          }}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={colors.gold} size="small" />
              </View>
            ) : null
          }
        />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function LockedSection({ title, icon, colors }: { title: string; icon: string; colors: any }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={[styles.lockedCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
      <View style={[styles.lockedIconBox, { backgroundColor: colors.gold + "15" }]}>
        <Feather name={icon as any} size={22} color={colors.gold} />
      </View>
      <Text style={[styles.lockedTitle, { color: colors.navy }]}>{title}</Text>
      <Text style={[styles.lockedSub, { color: colors.mutedForeground }]}>
        {t("mercado_screen.locked_not_in_plan")}
      </Text>
      <View style={[styles.lockedBadge, { backgroundColor: colors.gold + "18" }]}>
        <Feather name="lock" size={12} color={colors.gold} />
        <Text style={[styles.lockedBadgeText, { color: colors.gold }]}>{t("mercado_screen.locked_paid_feature")}</Text>
      </View>
      <TouchableOpacity
        style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.gold, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 }}
        onPress={() => router.push("/subscription")}
        activeOpacity={0.8}
      >
        <Feather name="zap" size={14} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{t("mercado_screen.locked_see_plans")}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MercadoScreen() {
  const { t } = useTranslation();
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
    { key: "mes",       label: t("mercado_screen.period_mes")       },
    { key: "trimestre", label: t("mercado_screen.period_trimestre") },
    { key: "ano",       label: t("mercado_screen.period_ano")       },
  ];

  const handleShare = async (tend: API.MarketTendencia) => {
    try {
      await Share.share({
        title: tend.title,
        message: `${tend.title}\n\n${tend.pos ? "+" : ""}${tend.change}% — ${tend.desc}`,
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
          <Text style={[styles.headerTitle,    { color: colors.navy }]}>{t("mercado_screen.header_title")}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t("mercado_screen.header_subtitle")}</Text>
        </View>
      </View>

      {/* Main Tabs */}
      <View style={[styles.mainTabRow, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {([
          { key: "visao",         label: t("mercado_screen.tab_visao"),         icon: "bar-chart-2" },
          { key: "apresentacoes", label: t("mercado_screen.tab_apresentacoes"), icon: "monitor"     },
          { key: "idealbi",       label: t("mercado_screen.tab_idealbi"),       icon: "radio"       },
        ] as { key: MercadoTab; label: string; icon: any }[]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.mainTabBtn, mainTab === tab.key && [styles.mainTabBtnActive, { backgroundColor: "#fff", borderColor: colors.border }]]}
            onPress={() => setMainTab(tab.key)}
          >
            <Feather name={tab.icon} size={14} color={mainTab === tab.key ? colors.navy : colors.mutedForeground} />
            <Text style={[styles.mainTabText, { color: mainTab === tab.key ? colors.navy : colors.mutedForeground, fontWeight: mainTab === tab.key ? "700" : "500" }]}>
              {tab.label}
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
                <LockedSection title={t("mercado_screen.section_kpis")} icon="activity" colors={colors} />
              )}

              {/* Área: Exportações vs Importações */}
              {can("graficos") ? (
                <>
                  <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    <View style={styles.chartHeader}>
                      <Text style={[styles.chartTitle, { color: colors.navy }]}>{t("mercado_screen.chart_area_title")}</Text>
                    </View>
                    <AreaChart data={data.chart_area} />
                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.gold }]} />
                        <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{t("mercado_screen.legend_exportacoes")}</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                        <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{t("mercado_screen.legend_importacoes")}</Text>
                      </View>
                      <TouchableOpacity style={styles.fonteBtn}>
                        <Feather name="info" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>{t("mercado_screen.fonte_label")}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.chartHint, { color: colors.mutedForeground }]}>
                      {t("mercado_screen.chart_area_hint")}
                    </Text>
                  </View>

                  {/* Barras: Produção Nacional */}
                  <View style={[styles.chartCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    <View style={styles.chartHeader}>
                      <Text style={[styles.chartTitle, { color: colors.navy }]}>{t("mercado_screen.chart_bar_title")}</Text>
                    </View>
                    <BarChart data={data.chart_bar} />
                    <TouchableOpacity style={[styles.fonteBtn, { alignSelf: "flex-end" }]}>
                      <Feather name="info" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>{t("mercado_screen.fonte_label")}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.chartHint, { color: colors.mutedForeground }]}>
                      {t("mercado_screen.chart_bar_hint")}
                    </Text>
                  </View>
                </>
              ) : (
                <LockedSection title={t("mercado_screen.section_graficos")} icon="bar-chart-2" colors={colors} />
              )}

              {/* Tendências */}
              {can("tendencias") ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>{t("mercado_screen.section_tendencias")}</Text>
                  {data.tendencias.map(tend => (
                    <View key={tend.title} style={[styles.tendCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                      <View style={styles.tendHeader}>
                        <Text style={[styles.tendTitle, { color: colors.navy }]}>{tend.title}</Text>
                        <Text style={[styles.tendChange, { color: tend.pos ? "#16a34a" : "#dc2626" }]}>
                          {tend.pos ? "+" : ""}{tend.change}%
                        </Text>
                      </View>
                      <Text style={[styles.tendDesc, { color: colors.mutedForeground }]}>{tend.desc}</Text>
                      <View style={styles.tendFooter}>
                        <TouchableOpacity style={styles.fonteBtn}>
                          <Feather name="info" size={11} color={colors.mutedForeground} />
                          <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>{t("mercado_screen.fonte_label")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.shareBtn, { backgroundColor: colors.gold + "15" }]}
                          onPress={() => handleShare(tend)}
                        >
                          <Feather name="share-2" size={13} color={colors.gold} />
                          <Text style={[styles.shareText, { color: colors.gold }]}>{t("mercado_screen.share_btn")}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <LockedSection title={t("mercado_screen.section_tendencias")} icon="trending-up" colors={colors} />
              )}

              {/* Regiões Produtoras */}
              {can("regioes") ? (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={{ fontSize: 18, marginRight: 6 }}>🍇</Text>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>{t("mercado_screen.section_regioes")}</Text>
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
                    <Text style={[styles.fonteText, { color: colors.mutedForeground }]}>{t("mercado_screen.fonte_label")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              ) : (
                <LockedSection title={t("mercado_screen.section_regioes")} icon="map-pin" colors={colors} />
              )}

              {/* Variedades em Destaque */}
              {can("variedades") ? (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons name="glass-wine" size={18} color={colors.navy} style={{ marginRight: 6 }} />
                    <Text style={[styles.sectionTitle, { color: colors.navy }]}>{t("mercado_screen.section_variedades")}</Text>
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
                <LockedSection title={t("mercado_screen.section_variedades")} icon="git-merge" colors={colors} />
              )}

              {/* Última atualização */}
              {data.updated_at ? (
                <Text style={[styles.updatedAt, { color: colors.mutedForeground }]}>
                  {t("mercado_screen.updated_at", { date: new Date(data.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) })}
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
