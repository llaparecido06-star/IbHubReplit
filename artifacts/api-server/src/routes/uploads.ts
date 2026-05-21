import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { resolveUserId, requirePlanFeature } from "../lib/planCheck.js";
import multer from "multer";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const supabaseUrl          = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "chat-attachments";
let bucketReady = false;

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm", "video/avi", "video/mov", "video/mpeg",
  "audio/m4a", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/x-m4a",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

/**
 * Reject the generic "application/octet-stream" mime type. It used to be on
 * the allowlist as a fallback, but in practice it lets clients sneak any
 * binary (apk, exe, dmg…) past the filter. The chat client now refuses to
 * send octet-stream and infers a real mime type before uploading.
 */
function rejectGenericMime(res: Response, mime: string): boolean {
  if (mime.toLowerCase() === "application/octet-stream") {
    res.status(415).json({
      error: "Tipo de arquivo desconhecido. Selecione um documento, imagem ou mídia válida.",
    });
    return true;
  }
  return false;
}

async function ensureBucket() {
  if (bucketReady) return;
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = (buckets ?? []).some((b: any) => b.id === BUCKET);

  const bucketConfig = {
    public: true,
    // 75 MB — must match the multer limit on /uploads/chat-form and the
    // MAX_CHAT_FILE_SIZE constant the mobile client checks against. If the
    // bucket cap is lower than multer, files between the two values pass the
    // client + multer checks and then fail at storage upload.
    fileSizeLimit: 75 * 1024 * 1024,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  };

  if (!exists) {
    await supabaseAdmin.storage.createBucket(BUCKET, bucketConfig);
  } else {
    // Always update to ensure MIME restrictions are removed / correct
    await supabaseAdmin.storage.updateBucket(BUCKET, bucketConfig);
  }
  bucketReady = true;
}

// Ensure bucket exists and is configured at startup
ensureBucket().catch(err => logger.warn({ err }, "ensureBucket failed"));

/**
 * POST /api/uploads/chat
 * Body: { fileBase64: string, fileName: string, mimeType: string, userId: string }
 * Returns: { url: string }
 */
router.post("/uploads/chat", async (req: Request, res: Response): Promise<void> => {
  try {
    // Authenticate uploader via Bearer token; never trust a userId from the body.
    const userId = await resolveUserId(req, res);
    if (!userId) return;

    const { fileBase64, fileName, mimeType } = req.body as {
      fileBase64: string;
      fileName: string;
      mimeType: string;
    };

    if (!fileBase64 || !fileName) {
      res.status(400).json({ error: "fileBase64 and fileName are required" });
      return;
    }

    if (mimeType && rejectGenericMime(res, mimeType)) return;
    if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase() as any)) {
      res.status(415).json({ error: `Tipo de arquivo não suportado: ${mimeType}` });
      return;
    }

    await ensureBucket();

    // Decode base64 to Buffer
    const buffer = Buffer.from(fileBase64, "base64");
    const ext    = fileName.split(".").pop() ?? "bin";
    const path   = `chat/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mimeType || "application/pdf", upsert: false });

    if (error) {
      req.log.error({ supabaseError: error.message }, "uploads/chat: storage upload failed");
      res.status(500).json({ error: error.message });
      return;
    }

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    res.json({ url: data.publicUrl });
  } catch (err) {
    req.log.error({ err }, "uploads/chat: unexpected error");
    res.status(500).json({ error: "Upload failed" });
  }
});

/**
 * POST /api/uploads/chat-form  (multipart/form-data)
 * FormData fields: file (binary), userId (string), mimeType (string)
 * Returns: { url: string }
 * Used by mobile clients — avoids base64 encoding of large audio/video files.
 */
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 75 * 1024 * 1024 },
});

router.post(
  "/uploads/chat-form",
  chatUpload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Authenticate the uploader from the Bearer token. We deliberately
      // ignore any `userId` field in the FormData — clients used to pass
      // it, but trusting it would let user A upload files into user B's
      // Storage path. Always derive the userId from the verified token.
      const userId = await resolveUserId(req, res);
      if (!userId) return;

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const { mimeType } = req.body as { mimeType?: string };

      const candidateMime = (mimeType || file.mimetype || "").toLowerCase();
      if (rejectGenericMime(res, candidateMime || "application/octet-stream")) return;
      if (!ALLOWED_MIME_TYPES.includes(candidateMime as any)) {
        res.status(415).json({ error: `Tipo de arquivo não suportado: ${candidateMime || "desconhecido"}` });
        return;
      }
      const safeMime = candidateMime;
      const ext = (safeMime.split("/")[1] ?? "bin")
        .replace("jpeg", "jpg")
        .replace("quicktime", "mov")
        .replace("x-m4a", "m4a");
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `chat/${userId}/${fileName}`;

      await ensureBucket();

      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, file.buffer, { contentType: safeMime, upsert: false });

      if (error) {
        req.log.error({ supabaseError: error.message }, "uploads/chat-form: storage upload failed");
        res.status(500).json({ error: error.message });
        return;
      }

      const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      res.json({ url: data.publicUrl });
    } catch (err) {
      req.log.error({ err }, "uploads/chat-form: unexpected error");
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/**
 * POST /api/uploads/post-video  (multipart/form-data)
 * FormData fields: file (binary), userId (string), mimeType (string)
 * Returns: { url: string }
 * Used by mobile clients — React Native streams the file natively via FormData,
 * avoiding loading the full video into the JS heap (prevents OOM on Android).
 */
const postVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

router.post(
  "/uploads/post-video",
  postVideoUpload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Authenticate uploader from the verified token; never trust a userId
      // sent in the body, otherwise user A could write files into user B's
      // storage path.
      const userId = await resolveUserId(req, res);
      if (!userId) return;

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const { mimeType } = req.body as { mimeType?: string };

      const candidateMime = (mimeType || file.mimetype || "video/mp4").toLowerCase();
      if (rejectGenericMime(res, candidateMime)) return;
      if (!candidateMime.startsWith("video/")) {
        res.status(415).json({ error: `Tipo de arquivo não suportado: ${candidateMime}` });
        return;
      }
      const safeMime = candidateMime;
      const ext = (safeMime.split("/")[1] ?? "mp4")
        .replace("quicktime", "mov");
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabaseAdmin.storage
        .from("post-videos")
        .upload(fileName, file.buffer, { contentType: safeMime, upsert: false });

      if (error) {
        req.log.error({ supabaseError: error.message }, "uploads/post-video: storage upload failed");
        res.status(500).json({ error: error.message });
        return;
      }

      const { data } = supabaseAdmin.storage.from("post-videos").getPublicUrl(fileName);
      res.json({ url: data.publicUrl });
    } catch (err) {
      req.log.error({ err }, "uploads/post-video: unexpected error");
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/**
 * POST /api/uploads/portfolio
 * Body: { fileBase64: string, fileName: string, mimeType: string, userId: string }
 * Returns: { url: string }
 */
router.post("/uploads/portfolio", async (req: Request, res: Response): Promise<void> => {
  try {
    const authUserId = await resolveUserId(req, res);
    if (!authUserId) return;

    const { fileBase64, fileName, mimeType } = req.body as {
      fileBase64: string;
      fileName: string;
      mimeType: string;
      userId?: string;
    };

    if (!fileBase64 || !fileName) {
      res.status(400).json({ error: "fileBase64 and fileName are required" });
      return;
    }

    const userId = authUserId;

    // Gate portfolio/certification uploads behind the plan feature
    const allowed = await requirePlanFeature(req, res, userId, "Upload Certificados");
    if (!allowed) return;

    const PORTFOLIO_BUCKET = "chat-attachments";
    const buffer = Buffer.from(fileBase64, "base64");
    const ext    = fileName.split(".").pop() ?? "jpg";
    const path   = `portfolio/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from(PORTFOLIO_BUCKET)
      .upload(path, buffer, { contentType: mimeType || "image/jpeg", upsert: false });

    if (error) {
      req.log.error({ supabaseError: error.message }, "uploads/portfolio: storage upload failed");
      res.status(500).json({ error: error.message });
      return;
    }

    const { data } = supabaseAdmin.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path);
    res.json({ url: data.publicUrl });
  } catch (err) {
    req.log.error({ err }, "uploads/portfolio: unexpected error");
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
