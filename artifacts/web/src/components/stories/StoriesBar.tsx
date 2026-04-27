import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchWebStories, markStoryViewed, createWebStory, WebStoryGroup, WebStory } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

/* ─── Story Viewer Modal ─── */
function StoryViewer({
  groups,
  startGroup,
  startStory,
  viewerId,
  onClose,
}: {
  groups: WebStoryGroup[];
  startGroup: number;
  startStory: number;
  viewerId?: string;
  onClose: () => void;
}) {
  const [groupIdx, setGroupIdx] = useState(startGroup);
  const [storyIdx, setStoryIdx] = useState(startStory);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 5000;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  const advance = useCallback(() => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(i => i + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(g => g + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [group, groupIdx, groups.length, onClose, storyIdx]);

  const goBack = () => {
    if (storyIdx > 0) { setStoryIdx(i => i - 1); setProgress(0); }
    else if (groupIdx > 0) { setGroupIdx(g => g - 1); setStoryIdx(0); setProgress(0); }
  };

  useEffect(() => {
    if (!story || !viewerId) return;
    markStoryViewed(story.id, viewerId);
  }, [story?.id, viewerId]);

  useEffect(() => {
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { advance(); return 0; }
        return p + (100 / (DURATION / 50));
      });
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [groupIdx, storyIdx, advance]);

  if (!group || !story) return null;

  const bgColor = (story.image_url || story.video_url) ? "transparent" : NAVY;

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: "relative", width: "min(420px, 96vw)", height: "min(750px, 92vh)", borderRadius: 20, overflow: "hidden", backgroundColor: NAVY }}
      >
        {/* Progress bars */}
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 10, display: "flex", gap: 4 }}>
          {group.stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", backgroundColor: "#fff", width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%", transition: "width 50ms linear", borderRadius: 2 }} />
            </div>
          ))}
        </div>

        {/* Author */}
        <div style={{ position: "absolute", top: 28, left: 16, right: 50, zIndex: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.6)", backgroundColor: BORDER }}>
            {group.author.avatar_url
              ? <img src={group.author.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🍷</div>
            }
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{group.author.full_name}</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
              {new Date(story.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 28, right: 14, zIndex: 10, background: "none", border: "none", cursor: "pointer", color: "#fff", fontSize: 22, lineHeight: 1 }}>✕</button>

        {/* Story content */}
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: bgColor }}>
          {story.video_url ? (
            <video
              ref={videoRef}
              key={story.video_url}
              src={story.video_url}
              autoPlay
              playsInline
              onEnded={advance}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : story.image_url ? (
            <img src={story.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 22, color: "#fff", lineHeight: 1.6, fontWeight: 600 }}>{story.text}</div>
            </div>
          )}
          {(story.image_url || story.video_url) && story.text && (
            <div style={{ position: "absolute", bottom: 60, left: 20, right: 20, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ color: "#fff", fontSize: 15, margin: 0, lineHeight: 1.5 }}>{story.text}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ flex: 1, cursor: "pointer" }} onClick={goBack} />
          <div style={{ flex: 1, cursor: "pointer" }} onClick={advance} />
        </div>

        {/* Navigation hints */}
        <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 20px", zIndex: 10, pointerEvents: "none" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{groupIdx + 1} / {groups.length}</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Toque para avançar</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Create Story Modal ─── */
function CreateStoryModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!text.trim() && !imageUrl.trim()) { setError("Adicione um texto ou URL de imagem."); return; }
    setError("");
    setSubmitting(true);
    const story = await createWebStory({ user_id: userId, text: text.trim() || undefined, image_url: imageUrl.trim() || undefined });
    setSubmitting(false);
    if (story) { onCreated(); onClose(); }
    else setError("Erro ao publicar. Tente novamente.");
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "#fff", borderRadius: 18, padding: 28, width: "min(440px, 94vw)" }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 6 }}>📸 Criar Momento</h3>
        <p style={{ color: MUTED, fontSize: 13, marginBottom: 18 }}>Compartilhe um momento com a comunidade do vinho. Fica ativo por 24 horas.</p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>URL da imagem (opcional)</label>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: `1.5px solid ${BORDER}`, fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Texto do momento</label>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="O que você está apreciando? 🍷" rows={4} style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: `1.5px solid ${BORDER}`, fontSize: 14, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
        </div>
        {error && <p style={{ color: "#dc3545", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 9, border: `1.5px solid ${BORDER}`, backgroundColor: "#fff", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleCreate} disabled={submitting} style={{ padding: "10px 24px", borderRadius: 9, border: "none", backgroundColor: GOLD, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            {submitting ? "Publicando..." : "Publicar momento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main StoriesBar ─── */
export default function StoriesBar({ userId }: { userId?: string }) {
  const [groups, setGroups] = useState<WebStoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{ groupIdx: number; storyIdx: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    fetchWebStories(userId).then(g => { setGroups(g); setLoading(false); });
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading || (groups.length === 0 && !userId)) return null;

  return (
    <>
      <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: "14px 16px", marginBottom: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {userId && (
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", flexShrink: 0, width: 58 }}
            >
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: `2px dashed ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: `${GOLD}12` }}>
                <span style={{ fontSize: 22 }}>＋</span>
              </div>
              <span style={{ fontSize: 11, color: MUTED, textAlign: "center", width: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Seu momento</span>
            </button>
          )}

          {groups.map((group, gIdx) => (
            <button
              key={group.userId}
              onClick={() => setViewer({ groupIdx: gIdx, storyIdx: 0 })}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", flexShrink: 0, width: 58 }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: "50%", overflow: "hidden",
                border: `3px solid ${group.hasUnseen ? GOLD : "rgba(201,168,76,0.3)"}`,
                boxSizing: "border-box",
              }}>
                {group.author.avatar_url
                  ? <img src={group.author.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", backgroundColor: BORDER, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🍷</div>
                }
              </div>
              <span style={{ fontSize: 11, color: group.hasUnseen ? NAVY : MUTED, fontWeight: group.hasUnseen ? 700 : 400, textAlign: "center", width: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {group.author.full_name.split(" ")[0]}
              </span>
            </button>
          ))}

          {groups.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: MUTED, fontSize: 13, paddingLeft: 4, paddingTop: 4 }}>
              <span>🍷</span>
              <span>Nenhum momento ativo. Seja o primeiro!</span>
            </div>
          )}
        </div>
      </div>

      {viewer && (
        <StoryViewer
          groups={groups}
          startGroup={viewer.groupIdx}
          startStory={viewer.storyIdx}
          viewerId={userId}
          onClose={() => setViewer(null)}
        />
      )}

      {showCreate && userId && (
        <CreateStoryModal
          userId={userId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { load(); }}
        />
      )}
    </>
  );
}
