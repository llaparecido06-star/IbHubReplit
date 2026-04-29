/**
 * Limits and helpers shared by chat upload flows.
 * Mirror of artifacts/ibhub/constants/chatUploads.ts — keep in sync with
 * artifacts/api-server/src/routes/uploads.ts (ALLOWED_MIME_TYPES + multer limits).
 */

export const MAX_CHAT_FILE_SIZE = 75 * 1024 * 1024; // 75 MB

export const MAX_AUDIO_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const ALLOWED_CHAT_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/avi",
  "video/mov",
  "video/mpeg",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/aac",
  "audio/x-m4a",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export function isAllowedChatMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return ALLOWED_CHAT_MIME_TYPES.includes(mimeType.toLowerCase());
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4a: "audio/m4a",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  aac: "audio/aac",
};

export function inferMimeFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const idx = name.lastIndexOf(".");
  if (idx < 0 || idx === name.length - 1) return null;
  const ext = name.slice(idx + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

export function resolveChatMime(
  pickedMime: string | null | undefined,
  fileName: string | null | undefined,
): string | null {
  const raw = (pickedMime ?? "").toLowerCase();
  if (raw && raw !== "application/octet-stream" && isAllowedChatMime(raw)) {
    return raw;
  }
  const inferred = inferMimeFromName(fileName);
  if (inferred && isAllowedChatMime(inferred)) {
    return inferred;
  }
  return null;
}

export type ChatFileValidation =
  | { ok: true; mimeType: string }
  | { ok: false; reason: string };

/**
 * Validate a picked File against the chat upload allowlist + size cap.
 * Returns either { ok: true, mimeType } or { ok: false, reason }.
 */
export function validateChatFile(file: File): ChatFileValidation {
  if (file.size > MAX_CHAT_FILE_SIZE) {
    return {
      ok: false,
      reason: `Arquivo muito grande (${formatFileSize(file.size)}). O limite é ${formatFileSize(MAX_CHAT_FILE_SIZE)}.`,
    };
  }
  const mime = resolveChatMime(file.type, file.name);
  if (!mime) {
    return {
      ok: false,
      reason: "Tipo de arquivo não suportado. Use imagem, vídeo, áudio ou documento.",
    };
  }
  return { ok: true, mimeType: mime };
}
