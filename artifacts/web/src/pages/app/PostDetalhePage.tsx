import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import {
  fetchPostById, fetchPostComments, addPostComment, toggleLikePost, toggleBookmarkPost,
  Post, AppComment,
} from "@/services/api";
import { formatRelativeDate as relativeDate } from "@/utils/dateUtils";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BG = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", backgroundColor: BORDER, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: size * 0.45 }}>🍷</span>}
    </div>
  );
}

function PostDetailVideo({ src }: { src: string }) {
  const [aspect, setAspect] = useState<number | null>(null);
  const isPortrait = aspect !== null && aspect < 1;
  return (
    <div style={{ background: "#000", display: "flex", justifyContent: "center", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <video
        src={src}
        controls
        playsInline
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
        }}
        style={{
          display: "block",
          width: isPortrait ? "auto" : "100%",
          height: isPortrait ? "min(560px, 80vh)" : "auto",
          maxWidth: "100%",
          maxHeight: isPortrait ? "min(560px, 80vh)" : 420,
          objectFit: "contain",
        }}
      />
    </div>
  );
}

function CommentItem({ comment, depth = 0, onReply }: { comment: AppComment; depth?: number; onReply: (id: string, name: string) => void }) {
  return (
    <div style={{ marginLeft: depth * 24, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Avatar url={comment.author?.avatar_url} name={comment.author?.full_name} size={34} />
        <div style={{ flex: 1, backgroundColor: depth === 0 ? BG : "#fff", borderRadius: 10, padding: "10px 14px", border: `1px solid ${BORDER}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: NAVY, marginBottom: 4 }}>
            {comment.author?.full_name ?? "Usuário"}
          </div>
          <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.5 }}>{comment.content}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: MUTED }}>
              {relativeDate(comment.created_at)}
            </span>
            <button
              onClick={() => onReply(comment.id, comment.author?.full_name ?? "Usuário")}
              style={{ fontSize: 11, color: GOLD, fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Responder
            </button>
            <span style={{ fontSize: 11, color: MUTED }}>❤️ {comment.likes_count ?? 0}</span>
          </div>
        </div>
      </div>
      {(comment.replies ?? []).map(r => (
        <CommentItem key={r.id} comment={r} depth={depth + 1} onReply={onReply} />
      ))}
    </div>
  );
}

export default function PostDetalhePage() {
  const [, params] = useRoute("/app/posts/:id");
  const [, setLocation] = useLocation();
  const { profile, activeCompany } = useAuth();
  const postId = params?.id;
  const companyId = activeCompany?.id ?? null;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const [p, c] = await Promise.all([
      fetchPostById(postId, profile?.id, companyId),
      fetchPostComments(postId, profile?.id),
    ]);
    setPost(p);
    setComments(c);
    setLoading(false);
  }, [postId, profile?.id, companyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!postId || !profile?.id) return;
    const ch = supabase
      .channel(`post_comments_${postId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "comments",
        filter: `post_id=eq.${postId}`,
      }, async (payload) => {
        const raw = payload.new as any;
        if (raw.user_id === profile.id) return;
        const { data: authorData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, headline, plan")
          .eq("id", raw.user_id)
          .single();
        const newComment: AppComment = {
          id: raw.id,
          post_id: raw.post_id,
          user_id: raw.user_id,
          content: raw.content,
          created_at: raw.created_at,
          parent_comment_id: raw.parent_comment_id ?? null,
          is_liked: false,
          likes_count: 0,
          replies: [],
          author: authorData ?? undefined,
        };
        setComments(prev => {
          if (raw.parent_comment_id) {
            return prev.map(cm =>
              cm.id === raw.parent_comment_id
                ? { ...cm, replies: [...(cm.replies ?? []), newComment] }
                : cm
            );
          }
          if (prev.some(c => c.id === raw.id)) return prev;
          return [...prev, newComment];
        });
        setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, profile?.id]);

  const handleLike = async () => {
    if (!post || !profile?.id) return;
    const wasLiked = !!post.is_liked;
    // Optimistic update
    setPost(prev => prev ? { ...prev, is_liked: !wasLiked, likes_count: prev.likes_count + (wasLiked ? -1 : 1) } : prev);
    const ok = await toggleLikePost(post.id, profile.id, wasLiked, post.reaction_type ?? undefined, companyId, profile.full_name ?? undefined);
    if (!ok) {
      // Revert optimistic update on failure
      setPost(prev => prev ? { ...prev, is_liked: wasLiked, likes_count: prev.likes_count + (wasLiked ? 1 : -1) } : prev);
    }
  };

  const handleBookmark = async () => {
    if (!post || !profile?.id) return;
    await toggleBookmarkPost(post.id, profile.id, !!post.is_bookmarked);
    setPost(prev => prev ? { ...prev, is_bookmarked: !prev.is_bookmarked } : prev);
  };

  const handleComment = async () => {
    if (!post || !profile?.id || !commentText.trim()) return;
    setSubmitting(true);
    const c = await addPostComment(post.id, profile.id, commentText.trim(), replyTo?.id, profile.full_name ?? undefined);
    if (c) {
      setComments(prev => replyTo
        ? prev.map(cm => cm.id === replyTo.id ? { ...cm, replies: [...(cm.replies ?? []), c] } : cm)
        : [...prev, c]
      );
      setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
      setCommentText("");
      setReplyTo(null);
    }
    setSubmitting(false);
  };

  const handleReply = (id: string, name: string) => {
    setReplyTo({ id, name });
    inputRef.current?.focus();
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: 32, textAlign: "center", color: MUTED }}>Carregando publicação...</div>
      </AppShell>
    );
  }

  if (!post) {
    return (
      <AppShell>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <p style={{ color: MUTED }}>Publicação não encontrada.</p>
          <button onClick={() => setLocation("/app")} style={{ marginTop: 16, padding: "8px 20px", backgroundColor: GOLD, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Voltar ao feed</button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        <button onClick={() => setLocation("/app")} style={{ display: "flex", alignItems: "center", gap: 6, color: GOLD, fontWeight: 700, background: "none", border: "none", cursor: "pointer", marginBottom: 20, fontSize: 14 }}>
          ← Voltar ao feed
        </button>

        <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <Avatar url={post.author?.avatar_url} name={post.author?.full_name} size={46} />
              <div>
                <div
                  onClick={() => post.author && setLocation(`/app/usuario/${post.author.id}`)}
                  style={{ fontWeight: 700, color: NAVY, fontSize: 15, cursor: "pointer" }}
                >
                  {post.author?.full_name ?? "Usuário"}
                </div>
                {post.author?.headline && <div style={{ color: MUTED, fontSize: 12 }}>{post.author.headline}</div>}
                <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                  {relativeDate(post.created_at)}
                </div>
              </div>
            </div>

            <p style={{ fontSize: 16, color: NAVY, lineHeight: 1.65, marginBottom: 16 }}>{post.content}</p>

            {post.image_url && (
              <img src={post.image_url} alt="" style={{ width: "100%", height: "auto", maxHeight: 640, objectFit: "contain", display: "block", backgroundColor: "#f2f3f5", borderRadius: 10, marginBottom: 12 }} />
            )}
            {post.image_urls && post.image_urls.length > 0 && !post.image_url && (
              post.image_urls.length === 1 ? (
                <img src={post.image_urls[0]} alt="" style={{ width: "100%", height: "auto", maxHeight: 640, objectFit: "contain", display: "block", backgroundColor: "#f2f3f5", borderRadius: 10, marginBottom: 12 }} />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 12 }}>
                  {post.image_urls.slice(0, 4).map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 8 }} />
                  ))}
                </div>
              )
            )}
            {post.video_url && <PostDetailVideo src={post.video_url} />}

            <div style={{ display: "flex", gap: 20, paddingTop: 12, borderTop: `1px solid ${BORDER}`, alignItems: "center" }}>
              <button
                onClick={handleLike}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: post.is_liked ? "#e74c3c" : MUTED, fontWeight: 700, fontSize: 14 }}
              >
                {post.is_liked ? "❤️" : "🤍"} {post.likes_count}
              </button>
              <span style={{ color: MUTED, fontSize: 14 }}>💬 {post.comments_count}</span>
              <button
                onClick={handleBookmark}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: post.is_bookmarked ? GOLD : MUTED, fontSize: 18 }}
              >
                {post.is_bookmarked ? "🔖" : "🏷️"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>
            Comentários ({post.comments_count})
          </h3>

          {profile && (
            <div style={{ marginBottom: 16 }}>
              {replyTo && (
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  ↩️ Respondendo a <strong>{replyTo.name}</strong>
                  <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Avatar url={profile.avatar_url} name={profile.full_name} size={36} />
                <div style={{ flex: 1 }}>
                  <textarea
                    ref={inputRef}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Adicione um comentário..."
                    rows={2}
                    style={{ width: "100%", borderRadius: 8, border: `1.5px solid ${BORDER}`, padding: "10px 12px", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button
                      onClick={handleComment}
                      disabled={submitting || !commentText.trim()}
                      style={{ padding: "8px 18px", backgroundColor: commentText.trim() ? GOLD : BORDER, color: commentText.trim() ? "#fff" : MUTED, border: "none", borderRadius: 8, cursor: commentText.trim() ? "pointer" : "default", fontWeight: 700, fontSize: 13 }}
                    >
                      {submitting ? "Enviando..." : "Comentar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {comments.length === 0 ? (
            <p style={{ color: MUTED, textAlign: "center", padding: "20px 0", fontSize: 14 }}>Seja o primeiro a comentar!</p>
          ) : (
            comments.map(c => <CommentItem key={c.id} comment={c} onReply={handleReply} />)
          )}
        </div>
      </div>
    </AppShell>
  );
}
