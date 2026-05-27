import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { fetchPollVoters } from "@/services/api";
import type { Post } from "./PostCard";

interface Props {
  post: Post;
  onVote?: (postId: string, optionIndex: number) => void;
}

export function PollBlock({ post, onVote }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [showPollVoters, setShowPollVoters] = useState(false);
  const [focusedOption, setFocusedOption] = useState<number | null>(null);
  const [pollVoters, setPollVoters] = useState<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    optionIndex: number;
  }[]>([]);
  const [loadingPollVoters, setLoadingPollVoters] = useState(false);

  // One Animated.Value per option for the progress bar width (0 → 1 fraction)
  const optionCount = post.poll?.options.length ?? 0;
  const barAnims = useRef(
    Array.from({ length: optionCount }, () => new Animated.Value(0)),
  ).current;

  const userVotesKey = post.poll?.user_votes ? JSON.stringify(post.poll.user_votes) : "";
  const postId = post.id;

  // Animate bars when the user has voted or when vote counts update
  const votedIndices =
    post.poll?.user_voted_indices ??
    (post.poll?.user_voted_index != null ? [post.poll.user_voted_index] : []);
  const hasVoted = votedIndices.length > 0;

  useEffect(() => {
    if (!post.poll || !hasVoted) return;
    const total = post.poll.total_votes;
    const anims = post.poll.options.map((opt, i) => {
      const fraction = total > 0 ? opt.votes / total : 0;
      return Animated.timing(barAnims[i] ?? new Animated.Value(0), {
        toValue: fraction,
        duration: 600,
        useNativeDriver: false, // width % animation requires JS driver
      });
    });
    Animated.parallel(anims).start();
  }, [hasVoted, post.poll?.total_votes, userVotesKey]);

  useEffect(() => {
    if (!showPollVoters) return;
    let cancelled = false;
    setLoadingPollVoters(true);
    fetchPollVoters(postId)
      .then(v => { if (!cancelled) setPollVoters(v); })
      .catch(err => { if (!cancelled) console.warn("fetchPollVoters failed:", err); })
      .finally(() => { if (!cancelled) setLoadingPollVoters(false); });
    return () => { cancelled = true; };
  }, [showPollVoters, userVotesKey, postId]);

  if (!post.poll) return null;

  const isExpired = post.poll.expires_at ? new Date(post.poll.expires_at) < new Date() : false;
  const isClosed = post.poll.closed || isExpired;
  const lockedFromVoting = isClosed;

  const openVoters = (optionIndex: number | null) => {
    setFocusedOption(optionIndex);
    setShowPollVoters(true);
  };

  const goToProfile = (voterId: string) => {
    setShowPollVoters(false);
    if (voterId === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push({ pathname: "/profile/[id]", params: { id: voterId } });
    }
  };

  const handleVote = (optionIndex: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onVote?.(post.id, optionIndex);
  };

  return (
    <>
      <View style={{ marginTop: 8, gap: 8 }}>
        {post.poll.options.map((opt, i) => {
          const total = post.poll!.total_votes;
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          const isMyVote = votedIndices.includes(i);
          const isWinner =
            hasVoted &&
            opt.votes === Math.max(...post.poll!.options.map((o) => o.votes)) &&
            opt.votes > 0;

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.72}
              onPress={() => {
                if (lockedFromVoting) {
                  openVoters(i);
                } else {
                  handleVote(i);
                }
              }}
              onLongPress={() => {
                if (post.poll && post.poll.total_votes > 0) openVoters(i);
              }}
              style={[
                styles.option,
                {
                  borderColor: isMyVote
                    ? colors.gold
                    : isWinner
                    ? colors.navy + "80"
                    : colors.border,
                  borderWidth: isMyVote || isWinner ? 1.5 : 1,
                  backgroundColor: colors.background,
                },
              ]}
            >
              {/* Animated progress bar background */}
              {hasVoted && (
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: (barAnims[i] ?? new Animated.Value(0)).interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                      backgroundColor: isMyVote
                        ? colors.gold + "28"
                        : colors.border,
                    },
                  ]}
                />
              )}

              <View style={styles.optionContent}>
                {/* Winner crown or voted checkmark — only shown when voted */}
                {hasVoted && (
                  isMyVote ? (
                    <Feather
                      name={post.poll!.allow_multiple ? "check-square" : "check-circle"}
                      size={15}
                      color={colors.gold}
                    />
                  ) : isWinner ? (
                    <MaterialCommunityIcons name="crown-outline" size={15} color={colors.navy} />
                  ) : null
                )}

                <Text
                  style={[
                    styles.optionText,
                    {
                      color: colors.foreground,
                      fontWeight: isMyVote ? "700" : "500",
                      flex: 1,
                    },
                  ]}
                >
                  {opt.text}
                </Text>

                {hasVoted && (
                  <Text
                    style={[
                      styles.pctText,
                      { color: isMyVote ? colors.gold : colors.mutedForeground,
                        fontWeight: isMyVote ? "700" : "500" },
                    ]}
                  >
                    {pct}%
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.footer}>
          <MaterialCommunityIcons name="poll" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {post.poll.total_votes}{" "}
            {post.poll.total_votes === 1 ? "voto" : "votos"}
            {!hasVoted && !isClosed
              ? post.poll.allow_multiple
                ? "  ·  Selecione as opções"
                : "  ·  Toque para votar"
              : ""}
          </Text>

          {post.poll.expires_at && !post.poll.closed && (() => {
            const d = new Date(post.poll.expires_at);
            const diffMs = d.getTime() - Date.now();
            if (diffMs <= 0) return null;
            const diffH = Math.floor(diffMs / 3600000);
            const label = diffH < 24 ? `${diffH}h` : `${Math.floor(diffH / 24)}d`;
            return (
              <Text style={[styles.footerText, { color: colors.mutedForeground, marginLeft: 4 }]}>
                · Encerra em {label}
              </Text>
            );
          })()}

          <View style={{ flex: 1 }} />

          {post.poll.total_votes > 0 && (
            <TouchableOpacity onPress={() => openVoters(null)} style={{ marginRight: 8 }}>
              <Text style={{ fontSize: 11, color: colors.primary }}>Ver votos</Text>
            </TouchableOpacity>
          )}

          {isClosed && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Feather name="lock" size={10} color={colors.mutedForeground} />
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Encerrada</Text>
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={showPollVoters}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPollVoters(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
          onPress={() => setShowPollVoters(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "70%",
              paddingBottom: 24,
            }}
            onPress={() => {}}
          >
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.foreground,
                paddingHorizontal: 20,
                marginBottom: 4,
              }}
            >
              {focusedOption != null
                ? `Votos · ${post.poll?.options[focusedOption]?.text ?? ""}`
                : `Todos os votos · ${post.poll?.total_votes ?? 0}`}
            </Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}>
              {loadingPollVoters ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Carregando…</Text>
              ) : pollVoters.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  Nenhum voto ainda.
                </Text>
              ) : (
                post.poll?.options
                  .map((opt, optIdx) => ({ opt, optIdx }))
                  .filter(({ optIdx }) => focusedOption == null || optIdx === focusedOption)
                  .map(({ opt, optIdx }) => {
                    const optVoters = pollVoters.filter((v) => v.optionIndex === optIdx);
                    if (optVoters.length === 0) return null;
                    return (
                      <View key={optIdx} style={{ marginBottom: 16 }}>
                        {focusedOption == null && (
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: colors.mutedForeground,
                              marginBottom: 8,
                            }}
                          >
                            {opt.text} · {optVoters.length}
                          </Text>
                        )}
                        {optVoters.map((v) => (
                          <TouchableOpacity
                            key={v.id}
                            onPress={() => goToProfile(v.id)}
                            activeOpacity={0.7}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 10,
                              paddingVertical: 4,
                            }}
                          >
                            <Avatar
                              uri={v.avatar_url}
                              name={v.full_name ?? v.username ?? "?"}
                              size={34}
                            />
                            <Text
                              style={{
                                fontSize: 14,
                                color: colors.foreground,
                                fontWeight: "500",
                              }}
                            >
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

const styles = StyleSheet.create({
  option: {
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 46,
    justifyContent: "center",
    position: "relative",
  },
  progressBar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  optionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  pctText: {
    fontSize: 13,
    minWidth: 36,
    textAlign: "right",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  footerText: {
    fontSize: 12,
  },
});
