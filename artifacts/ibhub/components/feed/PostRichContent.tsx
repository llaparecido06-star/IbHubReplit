import React, { useState } from "react";
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

function InlineVideoPlayer({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer({ uri: videoUrl }, (p) => {
    p.loop = true;
    p.muted = true;
  });

  return (
    <TouchableOpacity
      onPress={() => { if (player.playing) player.pause(); else player.play(); }}
      style={{ width: "100%", height: Math.round(SCREEN_WIDTH * (16 / 9)), borderRadius: 10, overflow: "hidden", backgroundColor: "#000", marginTop: 8 }}
      activeOpacity={0.9}
    >
      <VideoView
        player={player}
        contentFit="cover"
        style={{ width: "100%", height: "100%" }}
        allowsFullscreen={false}
      />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingLeft: 3 }}>
          <Feather name="play" size={24} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
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
          <Text style={{ fontSize: 16 }} allowFontScaling={false}>🍷</Text>
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
                  if (!hasVoted && !post.poll!.closed) onVote?.(post.id, i);
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
              {post.poll.user_voted_index == null && !post.poll.closed
                ? "  ·  Toque para votar"
                : ""}
            </Text>
            {post.poll.closed && (
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
