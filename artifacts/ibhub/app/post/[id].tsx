import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { WineTastingCard, canParseWine } from "@/components/feed/PostRichContent";
import { PollBlock } from "@/components/feed/PollBlock";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth, supabase } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import type { AppComment } from "@/services/api";
import { sendMentionNotifications, normalizePollIndices } from "@/services/api";
import { MentionInput } from "@/components/ui/MentionInput";
import { friendlyErrorMessage } from "@/hooks/useAsyncAction";
import { Post, AdaptiveImage, REPORT_REASONS } from "@/components/feed/PostCard";
import { PostActionsBar, buildPostShareUrl, type ReactionType } from "@/components/feed/PostActionsBar";
import { FeedVideo } from "@/components/feed/FeedVideo";
import { LikesModal } from "@/components/feed/LikesModal";
import { formatRelativeDate } from "@/utils/dateUtils";

const { width: SCREEN_W } = Dimensions.get("window");

type MentionMap = Record<string, { id: string; isCompany: boolean }>;

async function buildMentionMap(texts: string[]): Promise<MentionMap> {
  const handles = [...new Set((texts.join(" ").match(/@([\w.]+)/g) ?? []).map(m => m.slice(1).toLowerCase()))];
  if (!handles.length) return {};
  const [{ data: profiles }, { data: companies }] = await Promise.all([
    supabase.from("profiles").select("id, username").in("username", handles),
    supabase.from("company_pages").select("id, slug").in("slug", handles),
  ]);
  const map: MentionMap = {};
  for (const p of (profiles ?? [])) if ((p as any).username) map[(p as any).username.toLowerCase()] = { id: (p as any).id, isCompany: false };
  for (const c of (companies ?? [])) if ((c as any).slug) map[(c as any).slug.toLowerCase()] = { id: (c as any).id, isCompany: true };
  return map;
}

function MentionText({ text, mentionMap, style }: { text: string; mentionMap: MentionMap; style?: object }) {
  const colors = useColors();
  const router = useRouter();
  const parts = text.split(/(@[\w.]+)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (/^@[\w.]+$/.test(part)) {
          const entry = mentionMap[part.slice(1).toLowerCase()];
          if (entry) {
            const path = entry.isCompany ? `/empresa/${entry.id}` : `/profile/${entry.id}`;
            return (
              <Text
                key={i}
                style={{ color: colors.gold, fontWeight: "700" }}
                onPress={() => router.push(path as any)}
              >
                {part}
              </Text>
            );
          }
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

type FlatItem = AppComment & { isReply: boolean; depth: number };

function flattenComments(roots: AppComment[]): FlatItem[] {
  const result: FlatItem[] = [];
  for (const root of roots) {
    result.push({ ...root, isReply: false, depth: 0 });
    if (root.replies && root.replies.length > 0) {
      for (const reply of root.replies) {
        result.push({ ...reply, isReply: true, depth: 1 });
      }
    }
  }
  return result;
}

function countAll(roots: AppComment[]): number {
  return roots.reduce((s, c) => s + 1 + (c.replies?.length ?? 0), 0);
}

/** Stable serialisation of poll fields that affect display, used to compare
 *  two poll snapshots and ignore unrelated row updates. */
function pollContentKey(p: Post["poll"] | undefined): string {
  if (!p) return "";
  return JSON.stringify([p.options, p.total_votes, p.closed, p.expires_at, p.allow_multiple, p.user_votes]);
}

export default function PostDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, profile, activeCompany } = useAuth();
  const { id, commentId: highlightCommentId } = useLocalSearchParams<{ id: string; commentId?: string }>();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]); // threaded roots
  const [mentionMap, setMentionMap] = useState<MentionMap>({});
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; commentId: string } | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [sendingComment, setSendingComment] = useState(false);
  const [showLikesModal, setShowLikesModal]     = useState(false);
  const [showPostOptions, setShowPostOptions]   = useState(false);
  const [showReportModal, setShowReportModal]   = useState(false);
  const [selectedReason, setSelectedReason]     = useState<string | null>(null);
  const [reportSending, setReportSending]       = useState(false);

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  // Flat array for FlatList rendering
  const flatItems = useMemo(() => flattenComments(comments), [comments]);
  const totalComments = useMemo(() => countAll(comments), [comments]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadingPost(true);
    const [realPost, realComments] = await Promise.all([
      API.fetchPostById(id, user?.id),
      API.fetchComments(id, user?.id),
    ]);
    if (realPost) setPost(realPost);
    setComments(realComments);
    setLoadingPost(false);
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const texts = comments.flatMap(c => [c.content, ...(c.replies ?? []).map(r => r.content)]);
    buildMentionMap(texts).then(setMentionMap);
  }, [comments]);

  // Realtime: new comments from other users appear instantly
  useEffect(() => {
    if (!id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`post_comments_${id}_${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${id}` },
        async (payload) => {
          const row = payload.new as any;
          if (row.user_id === user?.id) return; // already added optimistically
          const fresh = await API.fetchCommentById(row.id, user?.id);
          if (!fresh) return;
          setComments(prev => {
            if (row.parent_comment_id) {
              // It's a reply — attach to parent
              return prev.map(c =>
                c.id === row.parent_comment_id
                  ? { ...c, replies: [...(c.replies ?? []), { ...fresh, replies: [] }] }
                  : c
              );
            }
            if (prev.some(c => c.id === fresh.id)) return prev;
            return [...prev, { ...fresh, replies: [] }];
          });
          setPost(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user?.id]);

  // Realtime: subscribe to UPDATE on this post and patch only the poll field.
  useEffect(() => {
    if (!id) return;
    const uid = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`post_poll_${id}_${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as { poll?: Post["poll"] };
          const nextPoll = next?.poll;
          if (!nextPoll) return;
          setPost(prev => {
            if (!prev) return prev;
            // Skip if poll content unchanged (e.g. UPDATE was for likes_count).
            if (pollContentKey(prev.poll) === pollContentKey(nextPoll)) return prev;
            const indices = user?.id ? normalizePollIndices(nextPoll.user_votes, user.id) : [];
            return {
              ...prev,
              poll: { ...nextPoll, user_voted_indices: indices, user_voted_index: indices[0] ?? null },
            };
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user?.id]);

  // Scroll to highlighted comment
  useEffect(() => {
    if (highlightCommentId && flatItems.length > 0) {
      const idx = flatItems.findIndex(c => c.id === highlightCommentId);
      if (idx >= 0) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
        }, 400);
      }
    }
  }, [highlightCommentId, flatItems]);

  const handleReply = (authorId: string, authorName: string, commentId: string) => {
    setReplyTo({ id: authorId, name: authorName, commentId });
    setComment("");
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
    setComment("");
  };

  const sendComment = async () => {
    if (!comment.trim() || !user?.id || !id) return;
    setSendingComment(true);
    const text = comment.trim();
    setComment("");
    const currentReplyTo = replyTo;
    setReplyTo(null);

    const tempId = `tmp_${Date.now()}`;
    const tempComment: AppComment = {
      id: tempId,
      post_id: id,
      parent_comment_id: currentReplyTo?.commentId ?? null,
      user_id: user.id,
      company_page_id: activeCompany?.id ?? null,
      content: text,
      created_at: new Date().toISOString(),
      likes_count: 0,
      is_liked: false,
      replies: [],
      author: {
        id: user.id,
        full_name: profile?.full_name ?? t("post_screen.you_fallback"),
        avatar_url: profile?.avatar_url ?? null,
        headline: null,
      },
      company_page: activeCompany
        ? { id: activeCompany.id, name: activeCompany.name, avatar_url: activeCompany.avatar_url ?? null }
        : null,
    };

    // Optimistic update
    if (currentReplyTo?.commentId) {
      setComments(prev => prev.map(c =>
        c.id === currentReplyTo.commentId
          ? { ...c, replies: [...(c.replies ?? []), tempComment] }
          : c
      ));
    } else {
      setComments(prev => [...prev, tempComment]);
    }
    setPost(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const saved = await API.addComment(id, user.id, text, activeCompany?.id ?? null, currentReplyTo?.commentId ?? null);

      if (saved) {
        const savedWithReplies = { ...saved, replies: [] };
        if (currentReplyTo?.commentId) {
          setComments(prev => prev.map(c =>
            c.id === currentReplyTo.commentId
              ? { ...c, replies: (c.replies ?? []).map(r => r.id === tempId ? savedWithReplies : r) }
              : c
          ));
        } else {
          setComments(prev => prev.map(c => c.id === tempId ? savedWithReplies : c));
        }
        // Fire mention notifications (best-effort, non-blocking)
        if (text.includes("@") && user?.id) {
          const actorName = activeCompany?.name ?? profile?.full_name ?? t("common.user_fallback");
          sendMentionNotifications(text, user.id, actorName, id, saved.id);
        }
      } else {
        // API returned null — remove optimistic comment
        if (currentReplyTo?.commentId) {
          setComments(prev => prev.map(c =>
            c.id === currentReplyTo.commentId
              ? { ...c, replies: (c.replies ?? []).filter(r => r.id !== tempId) }
              : c
          ));
        } else {
          setComments(prev => prev.filter(c => c.id !== tempId));
        }
        setPost(prev => prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) } : prev);
        Alert.alert(t("common.error"), t("post_screen.error_comment_failed"));
      }
    } catch (e: unknown) {
      // Remove optimistic comment on network failure
      if (currentReplyTo?.commentId) {
        setComments(prev => prev.map(c =>
          c.id === currentReplyTo.commentId
            ? { ...c, replies: (c.replies ?? []).filter(r => r.id !== tempId) }
            : c
        ));
      } else {
        setComments(prev => prev.filter(c => c.id !== tempId));
      }
      setPost(prev => prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) } : prev);
      Alert.alert(t("common.conn_error"), friendlyErrorMessage(e));
    } finally {
      setSendingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string, isReply: boolean, parentId?: string, isCurrentlyLiked?: boolean) => {
    if (!user?.id) return;
    const wasLiked = isCurrentlyLiked ?? false;

    const applyToggle = (list: AppComment[]): AppComment[] =>
      list.map(c => {
        if (c.id !== commentId) return c;
        return { ...c, is_liked: !wasLiked, likes_count: (c.likes_count ?? 0) + (wasLiked ? -1 : 1) };
      });
    const revert = (list: AppComment[]): AppComment[] =>
      list.map(c => c.id !== commentId ? c : { ...c, is_liked: wasLiked, likes_count: (c.likes_count ?? 0) + (wasLiked ? 1 : -1) });

    const applyToComments = (fn: (l: AppComment[]) => AppComment[]) => {
      if (isReply && parentId) {
        setComments(prev => prev.map(c => c.id === parentId ? { ...c, replies: fn(c.replies ?? []) } : c));
      } else {
        setComments(prev => fn(prev));
      }
    };

    // Optimistic update
    applyToComments(applyToggle);

    try {
      const ok = await API.toggleCommentLike(commentId, user.id, wasLiked);
      if (!ok) {
        applyToComments(revert);
        Alert.alert(t("common.error"), t("post_screen.error_like_comment"));
      }
    } catch (e: unknown) {
      applyToComments(revert);
      Alert.alert(t("common.conn_error"), friendlyErrorMessage(e));
    }
  };

  const handleReactPost = async (_postId: string, reaction: ReactionType) => {
    if (!post || !user?.id) return;
    const prevReaction = post.reaction_type ?? null;
    const prevLiked    = post.is_liked ?? false;
    const prevCount    = post.likes_count;
    const isSame       = prevReaction === reaction;
    const nextReaction = isSame ? null : reaction;
    const nextLiked    = !isSame;
    const nextCount    = isSame
      ? Math.max(0, prevCount - 1)
      : (prevReaction ? prevCount : prevCount + 1);
    setPost(p => p ? { ...p, reaction_type: nextReaction, is_liked: nextLiked, likes_count: nextCount } : p);
    try {
      const ok = await API.toggleReaction(post.id, user.id, reaction, prevReaction, activeCompany?.id);
      if (!ok) {
        setPost(p => p ? { ...p, reaction_type: prevReaction, is_liked: prevLiked, likes_count: prevCount } : p);
        Alert.alert(t("common.error"), t("post_screen.error_react"));
      }
    } catch (e: unknown) {
      setPost(p => p ? { ...p, reaction_type: prevReaction, is_liked: prevLiked, likes_count: prevCount } : p);
      Alert.alert(t("common.conn_error"), friendlyErrorMessage(e));
    }
  };

  const handleBookmarkPost = () => {
    if (!post || !user?.id) return;
    setPost(p => p ? { ...p, is_bookmarked: !p.is_bookmarked } : p);
    API.toggleBookmark(post.id, user.id, post.is_bookmarked ?? false);
  };

  const handleSharePost = async () => {
    if (!post) return;
    const postUrl = buildPostShareUrl(post.id);
    const shareText = `Veja esta publicação no ibhub:\n\n${post.content?.slice(0, 120) ?? ""}\n\n${postUrl}`;
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title: t("post_screen.share_title"), text: shareText, url: postUrl });
          return;
        } catch {}
      }
      try {
        await nav?.clipboard.writeText(postUrl);
        Alert.alert(t("post_screen.link_copied_title"), t("post_screen.link_copied_msg"));
      } catch {
        Alert.alert(t("common.error"), t("post_screen.error_copy") + " " + postUrl);
      }
      return;
    }
    try {
      await Share.share({ message: shareText, url: postUrl, title: t("post_screen.share_title") });
    } catch {}
  };

  const handleSubmitReport = async () => {
    if (!selectedReason || !user?.id || !post?.id) return;
    setReportSending(true);
    const ok = await API.createReport({ post_id: post.id, reported_by: user.id, reason: selectedReason });
    setReportSending(false);
    setShowReportModal(false);
    setSelectedReason(null);
    if (ok) {
      Alert.alert("Denúncia enviada", "Obrigado pelo seu feedback. Nossa equipe irá analisar.");
    } else {
      Alert.alert("Erro", "Não foi possível enviar a denúncia. Tente novamente.");
    }
  };

  const handleVotePoll = async (postId: string, optionIndex: number) => {
    if (!user?.id) return;
    const result = await API.voteOnPoll(postId, user.id, optionIndex);
    if (!result) return;
    setPost(prev => {
      if (!prev || !prev.poll) return prev;
      return {
        ...prev,
        poll: {
          ...prev.poll,
          options: result.options,
          total_votes: result.total_votes,
          user_voted_indices: result.indices,
          user_voted_index: result.indices[0] ?? null,
          user_votes: result.user_votes,
        },
      };
    });
  };

  const renderItem = ({ item, index }: { item: FlatItem; index: number }) => {
    const isHighlighted = item.id === highlightCommentId;
    const isTemp = item.id.startsWith("tmp_");

    return (
      <View
        style={[
          styles.comment,
          { borderBottomColor: colors.border },
          item.isReply && { paddingLeft: 52, backgroundColor: colors.secondary + "60" },
          isHighlighted && { backgroundColor: colors.gold + "14" },
          isTemp && { opacity: 0.7 },
        ]}
      >
        {/* Reply indicator line */}
        {item.isReply && (
          <View style={[styles.replyLine, { borderColor: colors.border }]} />
        )}

        <TouchableOpacity onPress={() => {
          if (item.company_page) router.push(`/empresa/${item.company_page.id}` as any);
          else if (item.author?.id) router.push(`/profile/${item.author.id}` as any);
        }}>
          <Avatar
            uri={item.company_page ? item.company_page.avatar_url : item.author?.avatar_url}
            name={item.company_page ? item.company_page.name : (item.author?.full_name ?? "?")}
            size={item.isReply ? 30 : 36}
          />
        </TouchableOpacity>

        <View style={styles.commentBody}>
          <View style={[styles.commentBubble, { backgroundColor: colors.secondary }]}>
            <TouchableOpacity onPress={() => {
              if (item.company_page) router.push(`/empresa/${item.company_page.id}` as any);
              else if (item.author?.id) router.push(`/profile/${item.author.id}` as any);
            }}>
              <Text style={[styles.commentAuthor, { color: colors.foreground }]}>
                {item.company_page ? item.company_page.name : (item.author?.full_name ?? t("post_screen.user_fallback"))}
              </Text>
            </TouchableOpacity>
            <MentionText text={item.content} mentionMap={mentionMap} style={[styles.commentContent, { color: colors.foreground }]} />
          </View>

          <View style={styles.commentActions}>
            <Text style={[styles.commentTime, { color: colors.mutedForeground }]}>{formatRelativeDate(item.created_at)}</Text>

            {/* Like comment */}
            <TouchableOpacity
              style={styles.commentAction}
              onPress={() => handleLikeComment(item.id, item.isReply, item.parent_comment_id ?? undefined, item.is_liked)}
            >
              <Feather
                name="heart"
                size={13}
                color={(item.is_liked) ? "#e74c3c" : colors.mutedForeground}
              />
              {(item.likes_count ?? 0) > 0 && (
                <Text style={[styles.commentLikes, { color: item.is_liked ? "#e74c3c" : colors.mutedForeground }]}>
                  {item.likes_count}
                </Text>
              )}
            </TouchableOpacity>

            {/* Reply button — only on top-level comments */}
            {!item.isReply && (
              <TouchableOpacity
                style={styles.commentAction}
                onPress={() => handleReply(
                  item.author?.id ?? item.company_page?.id ?? "",
                  item.company_page?.name ?? item.author?.full_name ?? t("post_screen.user_fallback"),
                  item.id,
                )}
              >
                <Feather name="corner-down-right" size={13} color={colors.gold} />
                <Text style={[styles.commentReply, { color: colors.gold }]}>{t("post_screen.reply_action")}</Text>
              </TouchableOpacity>
            )}

            {/* Reply count badge */}
            {!item.isReply && (item.replies?.length ?? 0) > 0 && (
              <Text style={[styles.replyCount, { color: colors.mutedForeground }]}>
                {t(item.replies!.length === 1 ? "post_screen.reply_count_one" : "post_screen.reply_count_other", { count: item.replies!.length })}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loadingPost) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("post_screen.header_title")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={handleSharePost} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="share-2" size={22} color={colors.foreground} />
          </TouchableOpacity>
          {post && post.author?.id !== user?.id && (
            <TouchableOpacity onPress={() => setShowPostOptions(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="more-horizontal" size={22} color={colors.foreground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={flatItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={() => (
          <View style={[styles.postPreview, { borderBottomColor: colors.border }]}>
            {post && (
              <>
                {/* Author */}
                {(() => {
                  const cp = post.company_page ?? null;
                  const displayAvatar = cp ? cp.avatar_url : post.author?.avatar_url;
                  const displayName   = cp ? cp.name : (post.author?.full_name ?? t("post_screen.user_fallback"));
                  const handlePress   = cp
                    ? () => router.push(`/empresa/${cp.id}` as any)
                    : () => post.author?.id && router.push(`/profile/${post.author.id}` as any);
                  return (
                    <TouchableOpacity style={styles.authorRow} onPress={handlePress}>
                      <Avatar uri={displayAvatar} name={displayName} size={42} />
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.authorName, { color: colors.foreground }]}>{displayName}</Text>
                          {cp && (
                            <View style={{ backgroundColor: colors.gold + "22", borderWidth: 1, borderColor: colors.gold + "55", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.gold }}>{t("post_screen.company_badge")}</Text>
                            </View>
                          )}
                        </View>
                        {!cp && !!post.author?.headline && (
                          <Text style={[styles.authorHeadline, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {post.author.headline}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {/* Content */}
                {post.content && canParseWine(post.content) ? (
                  <WineTastingCard content={post.content} />
                ) : (
                  <Text style={[styles.postContentPreview, { color: colors.foreground }]}>{post.content}</Text>
                )}

                {/* Poll */}
                {post.poll && (
                  <PollBlock post={post} onVote={handleVotePoll} />
                )}

                {/* Images */}
                {(() => {
                  const rawUrls = post.image_urls;
                  const imageUrls: string[] = Array.isArray(rawUrls) && rawUrls.length > 0
                    ? rawUrls
                    : post.image_url ? [post.image_url] : [];
                  if (imageUrls.length === 0) return null;
                  if (imageUrls.length === 1) {
                    return (
                      <AdaptiveImage
                        uri={imageUrls[0]}
                        width={SCREEN_W - 32}
                        priority="high"
                        style={{ borderRadius: 12, marginTop: 8 }}
                      />
                    );
                  }
                  return (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
                      {imageUrls.map((uri, i) => (
                        <AdaptiveImage key={i} uri={uri} width={SCREEN_W - 80} style={{ borderRadius: 12 }} />
                      ))}
                    </ScrollView>
                  );
                })()}

                {post.video_url && (
                  <View style={{ marginTop: 8, marginHorizontal: -16 }}>
                    <FeedVideo uri={post.video_url} width={SCREEN_W} />
                  </View>
                )}


                <PostActionsBar
                  post={post}
                  onReact={handleReactPost}
                  onComment={() => inputRef.current?.focus()}
                  onBookmark={handleBookmarkPost}
                />

                {/* Ver curtidas: separate detail-page affordance */}
                {post.likes_count > 0 && (
                  <View style={styles.postActions}>
                    <TouchableOpacity
                      style={[styles.postAction, styles.likesCountBtn, { backgroundColor: colors.secondary }]}
                      onPress={() => setShowLikesModal(true)}
                    >
                      <Feather name="users" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.likesCountText, { color: colors.mutedForeground }]}>
                        {t("post_screen.see_likes", { count: post.likes_count })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <Text style={[styles.commentsHeader, { color: colors.foreground }]}>
              {t(totalComments === 1 ? "post_screen.comments_one" : "post_screen.comments_other", { count: totalComments })}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {/* Reply indicator bar */}
      {replyTo && (
        <View style={[styles.replyBar, { backgroundColor: colors.gold + "18", borderTopColor: colors.gold + "40" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="corner-down-right" size={14} color={colors.gold} />
            <Text style={[styles.replyText, { color: colors.gold }]}>
              {t("post_screen.reply_to")} <Text style={{ fontWeight: "800" }}>{replyTo.name}</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={cancelReply}>
            <Feather name="x" size={16} color={colors.gold} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
        <Avatar
          uri={activeCompany ? activeCompany.avatar_url : profile?.avatar_url}
          name={activeCompany ? activeCompany.name : (profile?.full_name ?? t("post_screen.you_fallback"))}
          size={34}
        />
        <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderRadius: 24 }]}>
          <MentionInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder={replyTo ? t("post_screen.reply_placeholder", { name: replyTo.name }) : t("post_screen.add_comment_placeholder")}
            placeholderTextColor={colors.mutedForeground}
            value={comment}
            onChangeText={setComment}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendComment}
            suggestionsPlacement="above"
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: comment.trim() ? colors.gold : colors.border }]}
          onPress={sendComment}
          disabled={!comment.trim() || sendingComment}
        >
          {sendingComment
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="send" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      {/* Likes modal */}
      <LikesModal
        postId={post?.id ?? null}
        likesCount={post?.likes_count ?? 0}
        visible={showLikesModal}
        onClose={() => setShowLikesModal(false)}
      />

      {/* ── Post Options Menu ── */}
      <Modal visible={showPostOptions} transparent animationType="fade" onRequestClose={() => setShowPostOptions(false)}>
        <Pressable style={reportStyles.overlay} onPress={() => setShowPostOptions(false)}>
          <View style={[reportStyles.menu, { backgroundColor: "#fff" }]}>
            <TouchableOpacity
              style={reportStyles.menuItem}
              onPress={() => { setShowPostOptions(false); setSelectedReason(null); setShowReportModal(true); }}
            >
              <Feather name="flag" size={16} color="#374151" />
              <Text style={[reportStyles.menuText, { color: "#374151" }]}>Denunciar publicação</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Report Reason Modal ── */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <Pressable style={reportStyles.overlay} onPress={() => setShowReportModal(false)}>
          <Pressable style={[reportStyles.sheet, { backgroundColor: "#fff" }]}>
            <View style={reportStyles.sheetHeader}>
              <Text style={[reportStyles.sheetTitle, { color: "#0d1b2a" }]}>Denunciar publicação</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Feather name="x" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={[reportStyles.sheetSubtitle, { color: "#6b7280" }]}>Selecione o motivo da denúncia:</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  reportStyles.reasonItem,
                  { borderColor: selectedReason === reason ? "#c9a84c" : "#e5e7eb" },
                  selectedReason === reason && { backgroundColor: "#fdf6e3" },
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <View style={[reportStyles.radio, { borderColor: selectedReason === reason ? "#c9a84c" : "#d1d5db" }]}>
                  {selectedReason === reason && <View style={[reportStyles.radioInner, { backgroundColor: "#c9a84c" }]} />}
                </View>
                <Text style={[reportStyles.reasonText, { color: "#111827" }]}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[reportStyles.submitBtn, { backgroundColor: selectedReason ? "#c9a84c" : "#e5e7eb" }]}
              onPress={handleSubmitReport}
              disabled={!selectedReason || reportSending}
            >
              <Text style={[reportStyles.submitText, { color: selectedReason ? "#fff" : "#9ca3af" }]}>
                {reportSending ? "Enviando…" : "Enviar denúncia"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle:        { fontSize: 17, fontWeight: "700" },
  postPreview:        { padding: 16, borderBottomWidth: 1, gap: 12 },
  authorRow:          { flexDirection: "row", alignItems: "center", gap: 10 },
  authorName:         { fontSize: 15, fontWeight: "700" },
  authorHeadline:     { fontSize: 12, maxWidth: 220 },
  postContentPreview: { fontSize: 15, lineHeight: 22 },
  postActions:        { flexDirection: "row", gap: 12, paddingTop: 4, flexWrap: "wrap", alignItems: "center" },
  postAction:         { flexDirection: "row", alignItems: "center", gap: 5 },
  postActionCount:    { fontSize: 13, fontWeight: "600" },
  likesCountBtn:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  likesCountText:     { fontSize: 12, fontWeight: "600" },
  commentsHeader:     { fontSize: 15, fontWeight: "700", paddingTop: 4 },
  comment:            { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 10, alignItems: "flex-start" },
  replyLine:          { position: "absolute", left: 38, top: 0, bottom: 0, width: 1, borderLeftWidth: 1 },
  commentBody:        { flex: 1, gap: 4 },
  commentBubble:      { padding: 10, gap: 2, borderRadius: 14 },
  commentAuthor:      { fontSize: 13, fontWeight: "700" },
  commentContent:     { fontSize: 14, lineHeight: 19 },
  commentActions:     { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 4, flexWrap: "wrap" },
  commentTime:        { fontSize: 12 },
  commentAction:      { flexDirection: "row", alignItems: "center", gap: 4 },
  commentLikes:       { fontSize: 12 },
  commentReply:       { fontSize: 12, fontWeight: "700" },
  replyCount:         { fontSize: 11 },
  replyBar:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
  replyText:          { fontSize: 13 },
  inputBar:           { flexDirection: "row", alignItems: "flex-end", padding: 10, gap: 8, borderTopWidth: 1 },
  inputWrap:          { flex: 1, paddingHorizontal: 14, paddingVertical: 8 },
  input:              { fontSize: 14, maxHeight: 100 },
  sendBtn:            { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});

const reportStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  menu: {
    margin: 16,
    marginBottom: 40,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10,
  },
  menuItem:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 16 },
  menuText:    { fontSize: 15, fontWeight: "600" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
  },
  sheetHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  sheetTitle:    { fontSize: 16, fontWeight: "700" },
  sheetSubtitle: { fontSize: 13, marginBottom: 4 },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  radio:       { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner:  { width: 8, height: 8, borderRadius: 4 },
  reasonText:  { fontSize: 14, fontWeight: "500", flex: 1 },
  submitBtn:   { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitText:  { fontSize: 15, fontWeight: "700" },
});
