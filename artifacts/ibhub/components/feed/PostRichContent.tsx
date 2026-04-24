import React, { useState, useEffect } from "react";
import {
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { AntDesign, Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
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

function parseWineContent(content: string): { field: WineField; value: string }[] {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
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

function SmartImage({ url }: { url: string }) {
  const [portrait, setPortrait] = useState<boolean | null>(null);
  const imgHeight = portrait ? Math.round(SCREEN_WIDTH * (5 / 4)) : 220;
  return (
    <Image
      source={{ uri: url }}
      style={{ width: "100%", height: imgHeight, borderRadius: 10 }}
      resizeMode="cover"
      onLoad={(e: any) => {
        const src = e?.nativeEvent?.source ?? e?.source;
        if (src?.width && src?.height) setPortrait(src.height > src.width);
      }}
    />
  );
}

const { width: SCREEN_WIDTH_RC } = Dimensions.get("window");

function InlineVideoPlayer({ videoUrl }: { videoUrl: string }) {
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);

  const player = useVideoPlayer({ uri: videoUrl }, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    const sub = player.addListener("sourceLoad", ({ availableVideoTracks }) => {
      const track = (availableVideoTracks as any[])?.[0];
      if (track?.size?.width && track?.size?.height) {
        setAspectRatio(track.size.width / track.size.height);
      }
    });
    return () => sub.remove();
  }, [player]);

  const isPortrait = aspectRatio < 1;
  const videoW = SCREEN_WIDTH_RC - 32;
  const containerHeight = isPortrait
    ? Math.min(videoW / aspectRatio, 560)
    : Math.min(videoW / aspectRatio, 320);

  return (
    <View style={{ width: "100%", height: containerHeight, borderRadius: 10, overflow: "hidden", backgroundColor: "#000", marginTop: 8 }}>
      <VideoView
        player={player}
        contentFit="contain"
        style={{ width: "100%", height: "100%" }}
        allowsFullscreen
        nativeControls
      />
    </View>
  );
}

interface Props {
  post: Post;
  onVote?: (postId: string, optionIndex: number) => void;
}

export function PostRichContent({ post, onVote }: Props) {
  const colors = useColors();
  const router = useRouter();
  const postType = detectPostType(post.content ?? "");
  const wineEan = postType === "wine" ? extractEan(post.content ?? "") : null;
  const imageUrls = getImageUrls(post);

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
            const hasVoted = post.poll!.user_voted_index != null;
            const isMyVote = post.poll!.user_voted_index === i;
            const isWinner =
              hasVoted &&
              opt.votes === Math.max(...post.poll!.options.map((o) => o.votes)) &&
              opt.votes > 0;

            return (
              <TouchableOpacity
                key={i}
                activeOpacity={hasVoted || post.poll!.closed ? 1 : 0.75}
                onPress={() => {
                  const isExpired = post.poll!.expires_at ? new Date(post.poll!.expires_at) < new Date() : false;
                  if (!hasVoted && !post.poll!.closed && !isExpired) onVote?.(post.id, i);
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
                  {isMyVote ? (
                    <AntDesign
                      name={"checkcircle" as any}
                      size={14}
                      color={colors.gold}
                    />
                  ) : hasVoted && isWinner ? (
                    <AntDesign name="trophy" size={14} color={colors.navy} />
                  ) : null}
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
              {post.poll.user_voted_index == null && !post.poll.closed && !(post.poll.expires_at && new Date(post.poll.expires_at) < new Date())
                ? "  ·  Toque para votar"
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
            {(post.poll.closed || (post.poll.expires_at && new Date(post.poll.expires_at) < new Date())) && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  marginLeft: 8,
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
    </>
  );
}
