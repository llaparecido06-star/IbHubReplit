/**
 * Limits and helpers shared by chat upload flows.
 * Keep in sync with `artifacts/api-server/src/routes/uploads.ts`
 * (ALLOWED_MIME_TYPES + multer fileSize limits).
 */

export const MAX_CHAT_FILE_SIZE = 75 * 1024 * 1024; // 75 MB

export const MAX_AUDIO_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/** Mirrors the server allowlist *minus* application/octet-stream. */
export const ALLOWED_CHAT_MIME_TYPES: readonly string[] = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  // Video
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/avi",
  "video/mov",
  "video/mpeg",
  // Audio
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/aac",
  "audio/x-m4a",
  // Documents
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

/**
 * Map of file extension → mime type. Used to recover a usable mime when the
 * picker hands us nothing or "application/octet-stream", which happens often
 * on Android with Drive-shared files. Keep in sync with ALLOWED_CHAT_MIME_TYPES.
 */
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

/** Try to guess a mime type from a file name's extension. */
export function inferMimeFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const idx = name.lastIndexOf(".");
  if (idx < 0 || idx === name.length - 1) return null;
  const ext = name.slice(idx + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

/**
 * Resolve a usable, allowlisted mime type for a picked file.
 * Returns null when the file's mime is unknown AND can't be inferred from
 * its extension — in which case the caller should refuse the upload.
 */
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
