import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { AntDesign, Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { fetchPollVoters } from "@/services/api";
import type { Post } from "./PostCard";

/* ─── Wine Tasting Card ─────────────────────────────────────────────────── */

type WineField = {
  prefix: string;
  iconLib: "feather" | "mci";
  icon: string;
  label: string | null;
  isTitle?: boolean;
  isScore?: boolean;
};

const WINE_FIELDS: WineField[] = [
  { prefix: "🍷 Degustação:", iconLib: "mci",     icon: "glass-wine", label: null,            isTitle: true },
  { prefix: "🏠 Produtor:",   iconLib: "feather",  icon: "home",       label: "Produtor" },
  { prefix: "🌿 Uva/Casta:", iconLib: "feather",  icon: "layers",     label: "Uva/Casta" },
  { prefix: "📅 Safra:",      iconLib: "feather",  icon: "calendar",   label: "Safra" },
  { prefix: "📍 Região:",     iconLib: "feather",  icon: "map-pin",    label: "Região" },
  { prefix: "🌍 País:",       iconLib: "feather",  icon: "globe",      label: "País" },
  { prefix: "🏷️ EAN:",        iconLib: "feather",  icon: "tag",        label: "EAN" },
  { prefix: "⭐ Pontuação:",   iconLib: "mci",      icon: "star",       label: "Pontuação",    isScore: true },
  { prefix: "👃 Aroma:",       iconLib: "feather",  icon: "wind",       label: "Aroma" },
  { prefix: "👅 Sabor:",       iconLib: "feather",  icon: "zap",        label: "Sabor" },
  { prefix: "🍽️ Harmonização:", iconLib: "feather", icon: "heart",      label: "Harmonização" },
  { prefix: "📝 Notas:",       iconLib: "feather",  icon: "file-text",  label: "Notas" },
];

// Strip Unicode variation selectors (e.g. U+FE0F) so emoji matching works
// regardless of how the content was stored (iOS, Android, web may differ).
function normalizeEmoji(s: string): string {
  return s.replace(/\uFE0F/g, "");
}

function normalizeLegacyWineContent(content: string): string {
  if (/^🍷 Degustação:/m.test(content)) return content;
  const lines = content.split("\n");
  if (lines.length === 0 || !/^⭐+\s+/.test(lines[0])) return content;
  const out: string[] = [];
  const firstLine = lines[0].replace(/^⭐+\s+/, "").trim();
  if (firstLine) out.push(`🍷 Degustação: ${firstLine}`);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/·/.test(line) && /^[🍇📅🏭📍🌍]\s/.test(line)) {
      for (const tok of line.split("·").map((t) => t.trim())) {
        if (/^🍇\s/.test(tok))      out.push(`🌿 Uva/Casta: ${tok.replace(/^🍇\s+/, "")}`);
        else if (/^📅\s/.test(tok)) out.push(`📅 Safra: ${tok.replace(/^📅\s+/, "")}`);
        else if (/^🏭\s/.test(tok)) out.push(`🏠 Produtor: ${tok.replace(/^🏭\s+/, "")}`);
        else if (/^📍\s/.test(tok)) out.push(`📍 Região: ${tok.replace(/^📍\s+/, "")}`);
        else if (/^🌍\s/.test(tok)) out.push(`🌍 País: ${tok.replace(/^🌍\s+/, "")}`);
      }
      continue;
    }
    if (/^📊 Pontuação:/.test(line))      out.push(line.replace(/^📊/, "⭐"));
    else if (/^🍷 Notas:/.test(line))     out.push(line.replace(/^🍷 Notas:/, "📝 Notas:"));
    else                                   out.push(line);
  }
  return out.join("\n");
}

function parseWineContent(content: string): { field: WineField; value: string }[] {
  const lines = normalizeLegacyWineContent(content).split("\n").map((l) => l.trim()).filter(Boolean);
  const result: { field: WineField; value: string }[] = [];
  for (const line of lines) {
    const normLine = normalizeEmoji(line);
    for (const field of WINE_FIELDS) {
      const normPrefix = normalizeEmoji(field.prefix);
      if (normLine.startsWith(normPrefix)) {
        const value = normLine.slice(normPrefix.length).trim();
        if (value) result.push({ field, value });
        break;
      }
    }
  }
  return result;
}

function WineFieldIcon({
  field,
  size,
  color,
}: {
  field: WineField;
  size: number;
  color: string;
}) {
  if (field.iconLib === "mci") {
    return <MaterialCommunityIcons name={field.icon as any} size={size} color={color} />;
  }
  return <Feather name={field.icon as any} size={size} color={color} />;
}

/** Returns true if the content can be parsed as a structured wine tasting post. */
export function canParseWine(content: string): boolean {
  return parseWineContent(content).length > 0;
}

export function WineTastingCard({ content }: { content: string }) {
  const colors = useColors();
  const parsed = parseWineContent(content);
  if (parsed.length === 0) return null;

  const titleEntry = parsed.find((p) => p.field.isTitle);
  const scoreEntry = parsed.find((p) => p.field.isScore);
  const rows = parsed.filter((p) => !p.field.isTitle && !p.field.isScore);

  const gold = colors.gold ?? "#B8860B";
  const navy = colors.navy ?? "#0B1F3A";

  return (
    <View
      style={{
        backgroundColor: gold + "12",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: gold + "40",
        padding: 12,
        marginTop: 4,
        gap: 8,
      }}
    >
      {/* Wine name header */}
      {titleEntry && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: gold + "25",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WineFieldIcon field={titleEntry.field} size={18} color={gold} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: "700",
              color: navy,
            }}
            numberOfLines={2}
          >
            {titleEntry.value}
          </Text>
          {/* Score badge */}
          {scoreEntry && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                backgroundColor: gold,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <MaterialCommunityIcons name="star" size={12} color="#fff" />
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>
                {scoreEntry.value}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* If no title but has score, show score standalone */}
      {!titleEntry && scoreEntry && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons name="star" size={14} color={gold} />
          <Text style={{ fontSize: 14, fontWeight: "700", color: gold }}>
            {scoreEntry.value}
          </Text>
        </View>
      )}

      {/* Other fields */}
      {rows.length > 0 && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: gold + "25",
            paddingTop: 8,
            gap: 5,
          }}
        >
          {rows.map(({ field, value }) => (
            <View
              key={field.prefix}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}
            >
              <View style={{ marginTop: 1 }}>
                <WineFieldIcon field={field} size={13} color={gold} />
              </View>
              {field.label && (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.mutedForeground ?? "#888",
                    minWidth: 90,
                  }}
                >
                  {field.label}:
                </Text>
              )}
              <Text
                style={{ flex: 1, fontSize: 13, color: colors.foreground }}
                numberOfLines={3}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const SCREEN_WIDTH = Dimensions.get("window").width;

function detectPostType(content: string): "wine" | "text" {
  if (/^⭐/.test(content) && /Pontuação/.test(content)) return "wine";
  return "text";
}

function extractEan(content: string): string | null {
  const m = content.match(/🏷️ EAN: (\d+)/);
  return m ? m[1] : null;
}

function getImageUrls(post: Post): string[] {
  const urls: string[] = [];
  const raw = post.image_urls;
  if (Array.isArray(raw) && raw.length > 0) {
    urls.push(...(raw as string[]));
  } else if (typeof raw === "string" && (raw as string).trim().startsWith("[")) {
    try {
      const p = JSON.parse(raw as string);
      if (Array.isArray(p)) urls.push(...p);
    } catch {}
  }
  if (urls.length === 0 && post.image_url) urls.push(post.image_url);
  return urls;
}

const SCREEN_WIDTH_SMART = Dimensions.get("window").width;

function SmartImage({ url }: { url: string }) {
  const [portrait, setPortrait] = useState<boolean | null>(null);

  // Reset orientation state when the URL changes (recycled cells in FlatList).
  useEffect(() => {
    setPortrait(null);
  }, [url]);

  const imgHeight = portrait === null ? 220 : portrait ? Math.round(SCREEN_WIDTH_SMART * (5 / 4)) : 220;
  return (
    <Image
      source={{ uri: url }}
      style={{ width: "100%", height: imgHeight, borderRadius: 10, backgroundColor: "#f0f0f0" }}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={url}
      priority="high"
      onLoad={(e) => {
        const { width: w, height: h } = e.source;
        if (w > 0 && h > 0) setPortrait(h > w);
      }}
    />
  );
}

const { width: SCREEN_WIDTH_RC } = Dimensions.get("window");
const REEL_W = SCREEN_WIDTH_RC;
const REEL_H = Math.round(REEL_W * (16 / 9));

function InlineVideoPlayer({ videoUrl }: { videoUrl: string }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted]     = useState(false);
  const controlsAnim  = useRef(new Animated.Value(1)).current;
  const hideTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsVisible = useRef(true);

  const player = useVideoPlayer({ uri: videoUrl }, (p) => { p.loop = true; });

  useEffect(() => {
    const s1 = player.addListener("playingChange", (e) => setPlaying(e.isPlaying));
    const s2 = player.addListener("mutedChange",   (e) => setMuted(e.muted));
    return () => { s1.remove(); s2.remove(); };
  }, [player]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(controlsAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      controlsVisible.current = false;
    }, 2500);
  }, [controlsAnim]);

  const showControls = useCallback(() => {
    controlsVisible.current = true;
    Animated.timing(controlsAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    scheduleHide();
  }, [controlsAnim, scheduleHide]);

  const togglePlay = useCallback(() => {
    if (player.playing) player.pause(); else player.play();
    showControls();
  }, [player, showControls]);

  const toggleMute = useCallback(() => {
    player.muted = !player.muted;
    showControls();
  }, [player, showControls]);

  const handlePress = useCallback(() => {
    if (!controlsVisible.current) showControls();
    else togglePlay();
  }, [showControls, togglePlay]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      style={{ width: REEL_W, height: REEL_H, marginHorizontal: -14, marginTop: 8, backgroundColor: "#000", overflow: "hidden" }}
    >
      <VideoView
        player={player}
        contentFit="cover"
        style={{ width: "100%", height: "100%" }}
        nativeControls={false}
      />

      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: controlsAnim }]}>
        {/* Play / pause overlay */}
        {!playing && (
          <View style={reelStyles.playOverlay}>
            <View style={reelStyles.playBtn}>
              <Feather name="play" size={28} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
        )}

        {/* Mute button bottom-right */}
        <TouchableOpacity style={reelStyles.muteBtn} onPress={toggleMute}>
          <Feather name={muted ? "volume-x" : "volume-2"} size={18} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

const reelStyles = StyleSheet.create({
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.7)" },
  muteBtn: { position: "absolute", bottom: 14, right: 14, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 7 },
});

interface Props {
  post: Post;
  onVote?: (postId: string, optionIndex: number) => void;
}

export function PostRichContent({ post, onVote }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const postType = detectPostType(post.content ?? "");
  const wineEan = postType === "wine" ? extractEan(post.content ?? "") : null;
  const imageUrls = getImageUrls(post);
  const [showPollVoters, setShowPollVoters] = useState(false);
  const [pollVoters, setPollVoters] = useState<{ id: string; full_name: string | null; avatar_url: string | null; username: string | null; optionIndex: number }[]>([]);
  const [loadingPollVoters, setLoadingPollVoters] = useState(false);

  return (
    <>
      {postType === "wine" && (
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.gold + "18",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            marginTop: 6,
          }}
          onPress={() =>
            router.push({
              pathname: "/wine-ranking" as any,
              params: wineEan ? { ean: wineEan } : {},
            })
          }
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="glass-wine" size={16} color={colors.gold} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.gold }}>
            Avaliação de Vinho
          </Text>
          <Text style={{ fontSize: 12, color: colors.gold, opacity: 0.7 }}>
            · {wineEan ? "Ver ranking ↗" : "Ranking comunitário ↗"}
          </Text>
        </TouchableOpacity>
      )}

      {imageUrls.length > 0 && (
        <View style={{ gap: 4, marginTop: 8 }}>
          {imageUrls.slice(0, 4).map((url, i) => (
            <SmartImage key={`${url}-${i}`} url={url} />
          ))}
        </View>
      )}

      {post.video_url ? <InlineVideoPlayer videoUrl={post.video_url} /> : null}

      {post.poll && (
        <View style={{ marginTop: 8, gap: 6 }}>
          {post.poll.options.map((opt, i) => {
            const total = post.poll!.total_votes;
            const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
            const votedIndices = post.poll!.user_voted_indices ?? (post.poll!.user_voted_index != null ? [post.poll!.user_voted_index] : []);
            const hasVoted = votedIndices.length > 0;
            const isMyVote = votedIndices.includes(i);
            const isWinner =
              hasVoted &&
              opt.votes === Math.max(...post.poll!.options.map((o) => o.votes)) &&
              opt.votes > 0;

            return (
              <TouchableOpacity
                key={i}
                activeOpacity={post.poll!.closed ? 1 : 0.75}
                onPress={() => {
                  const isExpired = post.poll!.expires_at ? new Date(post.poll!.expires_at) < new Date() : false;
                  if (!post.poll!.closed && !isExpired) onVote?.(post.id, i);
                }}
                style={{
                  borderRadius: 8,
                  borderWidth: isMyVote || isWinner ? 1.5 : 1,
                  borderColor: isMyVote
                    ? colors.gold
                    : isWinner
                    ? colors.navy + "80"
                    : colors.border,
                  overflow: "hidden",
                  backgroundColor: colors.background,
                  minHeight: 42,
                  justifyContent: "center",
                }}
              >
                {hasVoted && pct > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${pct}%` as any,
                      backgroundColor: isMyVote
                        ? colors.gold + "30"
                        : colors.secondary ?? colors.border,
                    }}
                  />
                )}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 6,
                  }}
                >
                  {/* Radio / checkbox indicator — always visible */}
                  {isMyVote ? (
                    post.poll!.allow_multiple ? (
                      <AntDesign name={"checksquare" as any} size={18} color={colors.gold} />
                    ) : (
                      <AntDesign name={"checkcircle" as any} size={18} color={colors.gold} />
                    )
                  ) : (
                    post.poll!.allow_multiple ? (
                      <AntDesign name={"checksquareo" as any} size={18} color={colors.mutedForeground} />
                    ) : (
                      <AntDesign name={"circleo" as any} size={18} color={colors.mutedForeground} />
                    )
                  )}
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: isMyVote ? "700" : "400",
                      color: colors.foreground,
                    }}
                  >
                    {opt.text}
                  </Text>
                  {hasVoted && (
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isMyVote ? "700" : "400",
                        color: isMyVote ? colors.gold : colors.mutedForeground,
                      }}
                    >
                      {pct}%
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 2,
              paddingTop: 2,
            }}
          >
            <MaterialCommunityIcons
              name="poll"
              size={12}
              color={colors.mutedForeground}
            />
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {post.poll.total_votes}{" "}
              {post.poll.total_votes === 1 ? "voto" : "votos"}
              {(post.poll.user_voted_indices?.length ?? (post.poll.user_voted_index != null ? 1 : 0)) === 0 && !post.poll.closed && !(post.poll.expires_at && new Date(post.poll.expires_at) < new Date())
                ? (post.poll.allow_multiple ? "  ·  Selecione as opções" : "  ·  Toque para votar")
                : ""}
            </Text>
            {post.poll.expires_at && !post.poll.closed && (() => {
              const d = new Date(post.poll.expires_at);
              const diffMs = d.getTime() - Date.now();
              if (diffMs <= 0) return null;
              const diffH = Math.floor(diffMs / 3600000);
              const label = diffH < 24 ? `${diffH}h` : `${Math.floor(diffH / 24)}d`;
              return <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 4 }}>· Encerra em {label}</Text>;
            })()}
            <View style={{ flex: 1 }} />
            {post.poll.total_votes > 0 && (
              (post.poll.user_voted_indices?.length ?? (post.poll.user_voted_index != null ? 1 : 0)) > 0
              || post.poll.closed
              || !!(post.poll.expires_at && new Date(post.poll.expires_at) < new Date())
            ) && (
              <TouchableOpacity
                onPress={async () => {
                  setShowPollVoters(true);
                  if (pollVoters.length === 0 && !loadingPollVoters) {
                    setLoadingPollVoters(true);
                    const v = await fetchPollVoters(post.id);
                    setPollVoters(v);
                    setLoadingPollVoters(false);
                  }
                }}
                style={{ marginRight: 8 }}
              >
                <Text style={{ fontSize: 11, color: colors.primary }}>Ver votos</Text>
              </TouchableOpacity>
            )}
            {(post.poll.closed || (post.poll.expires_at && new Date(post.poll.expires_at) < new Date())) && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  Encerrada
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Poll Voters Modal ── */}
      <Modal visible={showPollVoters} transparent animationType="fade" onRequestClose={() => setShowPollVoters(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }} onPress={() => setShowPollVoters(false)}>
          <Pressable style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingBottom: 24 }} onPress={() => {}}>
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, paddingHorizontal: 20, marginBottom: 4 }}>
              Votos · {post.poll?.total_votes ?? 0} {(post.poll?.total_votes ?? 0) === 1 ? "voto" : "votos"}
            </Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}>
              {loadingPollVoters ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Carregando…</Text>
              ) : pollVoters.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Nenhum voto ainda.</Text>
              ) : (
                post.poll?.options.map((opt, optIdx) => {
                  const optVoters = pollVoters.filter(v => v.optionIndex === optIdx);
                  if (optVoters.length === 0) return null;
                  return (
                    <View key={optIdx} style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.mutedForeground, marginBottom: 8 }}>
                        {opt.text} · {optVoters.length}
                      </Text>
                      {optVoters.map(v => (
                        <TouchableOpacity
                          key={v.id}
                          onPress={() => { setShowPollVoters(false); v.id === user?.id ? router.push("/(tabs)/profile" as any) : router.push(`/profile/${v.id}` as any); }}
                          activeOpacity={0.7}
                          style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, paddingVertical: 4 }}
                        >
                          <Avatar uri={v.avatar_url} name={v.full_name ?? v.username ?? "?"} size={34} />
                          <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "500" }}>
                            {v.full_name ?? v.username ?? "Usuário"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
