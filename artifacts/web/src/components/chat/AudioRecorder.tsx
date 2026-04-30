import React, { useEffect, useRef, useState } from "react";
import { MAX_AUDIO_DURATION_MS } from "@/constants/chatUploads";

const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const RED    = "#dc2626";

export type AudioRecorderProps = {
  /** Called once the user releases / clicks "send". Receives the recorded Blob. */
  onSend: (blob: Blob, mimeType: string, durationMs: number) => Promise<void> | void;
  /** Called when the user cancels (clicks the X). */
  onCancel?: () => void;
  /** Disable the microphone button (e.g. while another upload is in flight). */
  disabled?: boolean;
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

export function AudioRecorder({ onSend, onCancel, disabled }: AudioRecorderProps) {
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
  // Resolves when the MediaRecorder has fully stopped AND its final
  // `dataavailable` event has been delivered. This eliminates the classic
  // race where `onstop` fires before the last chunk has been pushed,
  // producing a Blob of size 0.
  const stoppedResolveRef = useRef<(() => void) | null>(null);
  // Cached promise for the current stop cycle. Concurrent callers (e.g.
  // user click + max-duration auto-stop firing on the same tick) all share
  // the same promise so we never read `chunksRef` until `onstop` fires.
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  // Single-flight guard for stopAndSendInternal — without this, a double
  // click on the send button (or click + auto-stop) would race and one of
  // them would observe `recorder.state === "inactive"` and assemble the
  // blob before the final `dataavailable` arrived.
  const sendingAudioRef = useRef(false);
  // Tracks whether the component is still mounted so we never call setState
  // after unmount (and don't try to upload from a vanished component).
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
      // Release any in-flight stop awaiter so it doesn't leak.
      const pending = stoppedResolveRef.current;
      stoppedResolveRef.current = null;
      stopPromiseRef.current = null;
      pending?.();
      cleanup();
    };
  }, []);

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
      // Push every chunk we receive, including small ones — codec headers
      // can live in tiny chunks and dropping them produces an unreadable
      // file on the server.
      if (ev.data) chunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      // Just signal: the actual blob assembly + upload happens inside
      // stopAndSend() (or the cancel path), which awaits this promise so
      // we are guaranteed all `dataavailable` events have already fired.
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
    // Use a 1s timeslice so we still accumulate periodic chunks during
    // long recordings (browsers flush per-timeslice, then deliver one
    // final chunk on stop()).
    recorder.start(1000);
    setState("recording");

    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setRecordingMs(elapsed);
      if (elapsed >= MAX_AUDIO_DURATION_MS) {
        // Auto-stop and send when we hit the cap.
        void stopAndSendInternal();
      }
    }, 250);
  };

  const waitForStop = (recorder: MediaRecorder): Promise<void> => {
    // Reuse an in-flight stop promise so concurrent callers all wait for
    // the same `onstop` event instead of racing each other.
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
      // Move to "uploading" immediately so the user sees feedback while
      // the recorder finishes flushing.
      safeSetState("uploading");
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }

      await waitForStop(recorder);

      // If the user cancelled or the component unmounted while we were
      // waiting for the recorder to flush, abort cleanly.
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
        safeSetError("Áudio muito curto. Mantenha pressionado por mais tempo.");
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
    // If a send is mid-flight (waiting for onstop or onSend), just signal
    // cancellation; stopAndSendInternal will pick it up after the await
    // and short-circuit to idle. Resetting state mid-await would corrupt
    // chunksRef before the blob is assembled.
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

  if (state === "idle" || state === "requesting") {
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled || state === "requesting"}
        aria-label="Gravar áudio"
        title="Gravar áudio"
        style={{
          width: 42, height: 42, borderRadius: 21,
          border: `1px solid ${BORDER}`, background: WHITE,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: NAVY, fontSize: 18, flexShrink: 0,
        }}
      >
        🎤
      </button>
    );
  }

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

  if (state === "uploading") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px", borderRadius: 22, backgroundColor: NAVY, color: WHITE,
        fontSize: 13, flex: 1, minWidth: 0,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%", backgroundColor: "#c9a84c",
          animation: "ibhubAudioPulse 1s ease-in-out infinite",
        }} aria-hidden />
        <span>Enviando áudio…</span>
        <style>{`@keyframes ibhubAudioPulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }`}</style>
      </div>
    );
  }

  // recording
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 8px 6px 14px", borderRadius: 22,
      backgroundColor: "#fff5f5", border: `1px solid ${BORDER}`,
      flex: 1, minWidth: 0,
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%", backgroundColor: RED,
        animation: "ibhubAudioPulse 1s ease-in-out infinite", flexShrink: 0,
      }} aria-hidden />
      <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontVariantNumeric: "tabular-nums" }}>
        {formatMs(recordingMs)}
      </span>
      <span style={{ fontSize: 12, color: MUTED, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        Gravando…
      </span>
      <button
        type="button"
        onClick={cancel}
        aria-label="Cancelar gravação"
        title="Cancelar"
        style={{
          width: 32, height: 32, borderRadius: 16, border: "none",
          background: "transparent", color: RED, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}
      >✕</button>
      <button
        type="button"
        onClick={stopAndSend}
        aria-label="Enviar áudio"
        title="Enviar"
        style={{
          width: 36, height: 36, borderRadius: 18, border: "none",
          background: NAVY, color: WHITE, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}
      >➤</button>
      <style>{`@keyframes ibhubAudioPulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }`}</style>
    </div>
  );
}
