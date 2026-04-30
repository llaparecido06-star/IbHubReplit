import React, { useEffect, useRef, useState } from "react";

const GOLD = "#c9a84c";

// ── Single-active-video coordinator ──────────────────────────────────────────
// Reels/TikTok-style: only the *most-visible* video on the page plays. Each
// VideoPlayer registers its current intersection ratio and the coordinator
// elects the highest-ratio video as the one that plays; all others pause and
// reset. A user-paused video stays paused even if it would otherwise win.
type RegisteredVideo = {
  el: HTMLVideoElement;
  userPausedRef: React.MutableRefObject<boolean>;
  ratio: number;
};
const registry = new Map<HTMLVideoElement, RegisteredVideo>();
let syncScheduled = false;
let userOverrideEl: HTMLVideoElement | null = null;
const MIN_RATIO = 0.5;

// Pause every registered video immediately (used when the tab goes hidden).
// Does not touch userPausedRef so the coordinator restores the right one on
// visibility restore.
function pauseAll() {
  for (const v of registry.values()) {
    if (!v.el.paused) v.el.pause();
  }
}

// Listen to the browser's Page Visibility API so videos stop consuming
// bandwidth and battery the moment the user switches to another tab, and
// resume according to existing coordinator rules when they come back.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseAll();
    } else {
      scheduleSync();
    }
  });
}

function scheduleSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  requestAnimationFrame(() => {
    syncScheduled = false;
    // If the tab is hidden, leave everything paused — the visibilitychange
    // handler will call scheduleSync again when the tab returns to view.
    if (typeof document !== "undefined" && document.hidden) return;
    let best: RegisteredVideo | null = null;
    // A user-played video stays active as long as it remains at least
    // partially on-screen.
    if (userOverrideEl) {
      const reg = registry.get(userOverrideEl);
      if (reg && reg.ratio > 0) best = reg;
      else userOverrideEl = null;
    }
    if (!best) {
      for (const v of registry.values()) {
        if (v.ratio < MIN_RATIO) continue;
        if (!best || v.ratio > best.ratio) best = v;
      }
    }
    for (const v of registry.values()) {
      if (v === best) {
        if (!v.userPausedRef.current && v.el.paused) {
          v.el.play().catch(() => {/* autoplay may be blocked */});
        }
      } else {
        if (!v.el.paused) v.el.pause();
        try { v.el.currentTime = 0; } catch { /* not yet ready */ }
      }
    }
  });
}

function setUserOverride(el: HTMLVideoElement | null) {
  userOverrideEl = el;
  scheduleSync();
}

// Reels-style swipe navigation: jump to the next/previous registered video
// in document order, skipping any non-video posts in between. The intersection
// coordinator above handles auto-pause of the previous and auto-play of the
// new active video once it scrolls into view.
function navigateVideo(current: HTMLVideoElement, direction: 1 | -1) {
  const list = Array.from(registry.values()).sort(
    (a, b) => a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top,
  );
  const idx = list.findIndex((v) => v.el === current);
  if (idx < 0) return;
  const target = list[idx + direction];
  if (!target) return;
  // Clear any sticky user-override so the new video becomes active naturally
  // once it scrolls into view.
  userOverrideEl = null;
  // Reels semantics: a swipe to a video always plays it, even if the user had
  // previously paused that specific clip. Ordinary scroll still respects the
  // sticky pause because IntersectionObserver does not touch this flag.
  target.userPausedRef.current = false;
  target.el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface VideoPlayerProps {
  src: string;
}

export default function VideoPlayer({ src }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying]     = useState(false);
  // Auto-play requires the video to start muted to comply with browser
  // autoplay policies. The user can still tap to unmute at any time.
  const [muted, setMuted]         = useState(true);
  const [current, setCurrent]     = useState(0);
  const [duration, setDuration]   = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seeking, setSeeking]     = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(9 / 16); // default vertical (Reels-style)
  // When the user manually pauses, we don't want scroll-driven auto-play to
  // restart playback until they explicitly tap play again.
  const userPausedRef = useRef(false);
  // Track the start of a touch so we can distinguish a swipe from a tap.
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  // Set briefly after a recognized swipe so the synthetic click that fires
  // on touchend doesn't toggle play/pause as a side-effect.
  const suppressNextClickRef = useRef(false);

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  const showAndSchedule = () => {
    setShowControls(true);
    scheduleHide();
  };

  useEffect(() => {
    scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  // Register with the page-level coordinator so only the *most-visible*
  // video on the page plays at any moment. Off-screen and partially-visible
  // siblings pause and reset.
  useEffect(() => {
    const v = videoRef.current;
    const el = containerRef.current;
    if (!v || !el || typeof IntersectionObserver === "undefined") return;
    registry.set(v, { el: v, userPausedRef, ratio: 0 });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const reg = registry.get(v);
          if (reg) reg.ratio = entry.intersectionRatio;
        }
        scheduleSync();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      registry.delete(v);
      scheduleSync();
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Skip the synthetic click that follows a recognized swipe gesture so
    // navigation doesn't also toggle play/pause.
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPausedRef.current = false;
      setUserOverride(v);
      v.play().catch(() => {/* ignore */});
    } else {
      userPausedRef.current = true;
      if (userOverrideEl === v) userOverrideEl = null;
      v.pause();
    }
    showAndSchedule();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    showAndSchedule();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrent(v.currentTime);
    showAndSchedule();
  };

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setSeeking(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seeking) return;
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrent(v.currentTime);
  };

  const handleProgressPointerUp = () => {
    setSeeking(false);
    showAndSchedule();
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      v.requestFullscreen?.();
    }
    showAndSchedule();
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${aspectRatio}`,
        maxHeight: "85vh",
        background: "#000",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        margin: "0 auto",
      }}
      onClick={togglePlay}
      onMouseMove={showAndSchedule}
      onTouchStart={(e) => {
        showAndSchedule();
        const t = e.touches[0];
        if (t) touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      }}
      onTouchEnd={(e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        const v = videoRef.current;
        if (!start || !v) return;
        const end = e.changedTouches[0];
        if (!end) return;
        const dy = end.clientY - start.y;
        const dx = end.clientX - start.x;
        const dt = Date.now() - start.t;
        // Only treat as a Reels-style swipe when the gesture is a clear,
        // mostly-vertical fling. Otherwise let the click-to-toggle behaviour
        // take over (taps have tiny dy and dx).
        if (Math.abs(dy) < 60) return;
        if (Math.abs(dy) < Math.abs(dx) * 1.3) return;
        if (dt > 600) return;
        // Suppress the synthetic click that follows so we don't toggle
        // play/pause as a side-effect of swiping.
        suppressNextClickRef.current = true;
        navigateVideo(v, dy < 0 ? 1 : -1);
      }}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        muted={muted}
        preload="metadata"
        loop
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          if (v.videoWidth > 0 && v.videoHeight > 0) {
            setAspectRatio(v.videoWidth / v.videoHeight);
          }
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setShowControls(true); }}
      />

      {/* Center play/pause overlay — only shown when paused or controls visible */}
      {(!playing || showControls) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {!playing && (
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(2px)",
            }}>
              <svg width="24" height="24" fill="#fff" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Bottom controls bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.72))",
          padding: "18px 12px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.25s",
          pointerEvents: showControls ? "auto" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          style={{
            height: 4, borderRadius: 4,
            background: "rgba(255,255,255,0.3)",
            cursor: "pointer",
            position: "relative",
          }}
          onClick={handleProgressClick}
          onPointerDown={handleProgressPointerDown}
          onPointerMove={handleProgressPointerMove}
          onPointerUp={handleProgressPointerUp}
        >
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: GOLD,
            borderRadius: 4,
            transition: seeking ? "none" : "width 0.1s",
          }} />
          <div style={{
            position: "absolute",
            top: "50%", left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            width: 12, height: 12, borderRadius: "50%",
            background: GOLD,
            boxShadow: "0 0 4px rgba(0,0,0,0.5)",
          }} />
        </div>

        {/* Buttons row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Play/pause */}
          <button
            onClick={togglePlay}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: "2px 4px", display: "flex", lineHeight: 1 }}
            title={playing ? "Pausar" : "Reproduzir"}
          >
            {playing ? (
              <svg width="18" height="18" fill="#fff" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="18" height="18" fill="#fff" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            )}
          </button>

          {/* Mute/unmute */}
          <button
            onClick={toggleMute}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: "2px 4px", display: "flex", lineHeight: 1 }}
            title={muted ? "Ativar som" : "Silenciar"}
          >
            {muted ? (
              <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            )}
          </button>

          {/* Time */}
          <span style={{ color: "#fff", fontSize: 12, fontVariantNumeric: "tabular-nums", flex: 1 }}>
            {fmt(current)} / {fmt(duration)}
          </span>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: "2px 4px", display: "flex", lineHeight: 1 }}
            title="Tela cheia"
          >
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
              <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
              <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
              <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
