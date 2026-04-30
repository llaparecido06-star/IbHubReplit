import React, { useEffect, useRef, useState } from "react";
import { MAX_AUDIO_DURATION_MS } from "@/constants/chatUploads";

const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const RED    = "#dc2626";
const GOLD   = "#c9a84c";

export type AudioRecorderProps = {
  /** Called once the user releases / clicks "send". Receives the recorded Blob. */
  onSend: (blob: Blob, mimeType: string, durationMs: number) => Promise<void> | void;
  /** Called when the user cancels (clicks the X). */
  onCancel?: () => void;
  /** Disable the microphone button (e.g. while another upload is in flight). */
  disabled?: boolean;
  /**
   * When true and in idle state, renders nothing — the parent shows a send
   * button instead and the mic button should be suppressed. This enables
   * WhatsApp-style: mic when empty, send when text is typed.
   */
  hasText?: boolean;
  /**
   * Called whenever the recording state changes so the parent can show/hide
   * the text input (true = recording, false = idle/done).
   */
  onRecordingChange?: (isRecording: boolean) => void;
};

type State = "idle" | "requesting" | "recording" | "uploading" | "error";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidates) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return "audio/webm";
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecorder({ onSend, onCancel, disabled, hasText, onRecordingChange }: AudioRecorderProps) {
  const [state, setState] = useState<State>("idle");
  const [recordingMs, setRecordingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<BlobPart[]>([]);
  const streamRef   = useRef<MediaStream | null>(null);
  const startedAt   = useRef<number>(0);
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const mimeRef     = useRef<string>("audio/webm");
  const stoppedResolveRef = useRef<(() => void) | null>(null);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const sendingAudioRef = useRef(false);
  const mountedRef = useRef(true);

  const cleanupStreamOnly = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      streamRef.current = null;
    }
    recorderRef.current = null;
  };

  const cleanup = () => {
    cleanupStreamOnly();
    chunksRef.current = [];
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          cancelledRef.current = true;
          recorderRef.current.stop();
        }
      } catch {}
      const pending = stoppedResolveRef.current;
      stoppedResolveRef.current = null;
      stopPromiseRef.current = null;
      pending?.();
      cleanup();
    };
  }, []);

  // Notify parent when recording state changes
  useEffect(() => {
    const isRecording = state === "recording" || state === "uploading";
    onRecordingChange?.(isRecording);
  }, [state, onRecordingChange]);

  const start = async () => {
    if (state !== "idle" || disabled) return;
    setError(null);
    setState("requesting");

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Seu navegador não suporta gravação de áudio.");
      setState("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      const msg = e?.name === "NotAllowedError"
        ? "Permissão de microfone negada. Habilite o microfone nas configurações do navegador."
        : "Não foi possível acessar o microfone.";
      setError(msg);
      setState("error");
      return;
    }

    const mimeType = pickMimeType();
    mimeRef.current = mimeType;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      try { recorder = new MediaRecorder(stream); } catch {
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
        setError("Seu navegador não suporta gravação de áudio.");
        setState("error");
        return;
      }
    }

    chunksRef.current = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data) chunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      const resolve = stoppedResolveRef.current;
      stoppedResolveRef.current = null;
      stopPromiseRef.current = null;
      resolve?.();
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    cancelledRef.current = false;
    startedAt.current = Date.now();
    setRecordingMs(0);
    recorder.start(1000);
    setState("recording");

    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setRecordingMs(elapsed);
      if (elapsed >= MAX_AUDIO_DURATION_MS) {
        void stopAndSendInternal();
      }
    }, 250);
  };

  const waitForStop = (recorder: MediaRecorder): Promise<void> => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    if (recorder.state === "inactive") return Promise.resolve();
    const p = new Promise<void>((resolve) => {
      stoppedResolveRef.current = resolve;
      try { recorder.stop(); }
      catch {
        stoppedResolveRef.current = null;
        stopPromiseRef.current = null;
        resolve();
      }
    });
    stopPromiseRef.current = p;
    return p;
  };

  const safeSetState = (s: State) => { if (mountedRef.current) setState(s); };
  const safeSetError = (e: string | null) => { if (mountedRef.current) setError(e); };
  const safeSetRecordingMs = (v: number) => { if (mountedRef.current) setRecordingMs(v); };

  const stopAndSendInternal = async () => {
    if (sendingAudioRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder) return;
    sendingAudioRef.current = true;
    try {
      safeSetState("uploading");
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }

      await waitForStop(recorder);

      if (cancelledRef.current || !mountedRef.current) {
        cancelledRef.current = false;
        cleanup();
        safeSetRecordingMs(0);
        safeSetState("idle");
        return;
      }

      const durationMs = Date.now() - startedAt.current;
      const mimeType = mimeRef.current;
      const blob = new Blob(chunksRef.current, { type: mimeType });

      cleanup();
      safeSetRecordingMs(0);

      if (durationMs < 400) {
        safeSetError("Áudio muito curto. Mantenha por mais tempo.");
        safeSetState("error");
        return;
      }
      if (blob.size === 0) {
        safeSetError("Não foi possível capturar áudio. Verifique o microfone e tente novamente.");
        safeSetState("error");
        return;
      }

      try {
        await onSend(blob, mimeType, durationMs);
        safeSetState("idle");
      } catch (e: any) {
        safeSetError(e?.message ?? "Não foi possível enviar o áudio.");
        safeSetState("error");
      }
    } finally {
      sendingAudioRef.current = false;
    }
  };

  const stopAndSend = () => {
    if (state !== "recording") return;
    void stopAndSendInternal();
  };

  const cancel = () => {
    if (state !== "recording") {
      if (state === "error") {
        setState("idle"); setError(null);
        if (onCancel) onCancel();
      }
      return;
    }
    cancelledRef.current = true;
    if (sendingAudioRef.current) {
      if (onCancel) onCancel();
      return;
    }
    const recorder = recorderRef.current;
    try { recorder?.stop(); } catch {}
    const pending = stoppedResolveRef.current;
    stoppedResolveRef.current = null;
    stopPromiseRef.current = null;
    pending?.();
    cleanup();
    setRecordingMs(0);
    setState("idle");
    if (onCancel) onCancel();
  };

  // ── Idle: mic button (only shown when no text is typed) ──────────────────
  if (state === "idle" || state === "requesting") {
    // When the parent has text, it shows a send button instead — hide mic
    if (hasText) return null;
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled || state === "requesting"}
        aria-label="Gravar áudio"
        title="Gravar áudio"
        style={{
          width: 42, height: 42, borderRadius: 21,
          border: "none", background: GOLD,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, opacity: disabled ? 0.5 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderRadius: 22, backgroundColor: "#fff5f5",
        border: "1px solid #fecaca", color: RED, fontSize: 12, flex: 1, minWidth: 0,
      }} role="alert">
        <span aria-hidden>⚠️</span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {error ?? "Erro ao gravar áudio."}
        </span>
        <button
          type="button"
          onClick={() => { setState("idle"); setError(null); }}
          aria-label="Fechar erro"
          style={{ background: "none", border: "none", cursor: "pointer", color: RED, padding: 4 }}
        >✕</button>
      </div>
    );
  }

  // ── Uploading ──────────────────────────────────────────────────────────────
  if (state === "uploading") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px", borderRadius: 22, backgroundColor: NAVY, color: WHITE,
        fontSize: 13, flex: 1, minWidth: 0,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%", backgroundColor: GOLD,
          animation: "ibhubAudioPulse 1s ease-in-out infinite",
        }} aria-hidden />
        <span>Enviando áudio…</span>
        <style>{`@keyframes ibhubAudioPulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }`}</style>
      </div>
    );
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      flex: 1, minWidth: 0,
    }}>
      {/* Cancel */}
      <button
        type="button"
        onClick={cancel}
        aria-label="Cancelar gravação"
        title="Cancelar"
        style={{
          width: 42, height: 42, borderRadius: 21, border: `1px solid ${BORDER}`,
          background: WHITE, color: RED, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: 18,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Timer + waveform indicator */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 22,
        backgroundColor: "#fff5f5", border: `1px solid #fecaca`,
        minWidth: 0,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%", backgroundColor: RED,
          animation: "ibhubAudioPulse 1s ease-in-out infinite", flexShrink: 0,
        }} aria-hidden />
        <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {formatMs(recordingMs)}
        </span>
        <span style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Gravando…
        </span>
      </div>

      {/* Send */}
      <button
        type="button"
        onClick={stopAndSend}
        aria-label="Enviar áudio"
        title="Enviar"
        style={{
          width: 42, height: 42, borderRadius: 21, border: "none",
          background: GOLD, color: WHITE, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={WHITE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
      <style>{`@keyframes ibhubAudioPulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }`}</style>
    </div>
  );
}
