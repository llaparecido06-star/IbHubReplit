import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const supabaseUrl          = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "chat-attachments";
let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = (buckets ?? []).some((b: any) => b.id === BUCKET);
  if (!exists) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 52428800 });
  }
  bucketReady = true;
}

// Ensure bucket exists at startup
ensureBucket().catch(err => console.warn("ensureBucket:", err));

/**
 * POST /api/uploads/chat
 * Body: { fileBase64: string, fileName: string, mimeType: string, userId: string }
 * Returns: { url: string }
 */
router.post("/uploads/chat", async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileBase64, fileName, mimeType, userId } = req.body as {
      fileBase64: string;
      fileName: string;
      mimeType: string;
      userId: string;
    };

    if (!fileBase64 || !fileName || !userId) {
      res.status(400).json({ error: "fileBase64, fileName and userId are required" });
      return;
    }

    // Verify the Authorization header (user must be logged in)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing authorization header" });
      return;
    }

    await ensureBucket();

    // Decode base64 to Buffer
    const buffer = Buffer.from(fileBase64, "base64");
    const ext    = fileName.split(".").pop() ?? "bin";
    const path   = `chat/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mimeType || "application/octet-stream", upsert: false });

    if (error) {
      console.error("upload error:", error);
      res.status(500).json({ error: error.message });
      return;
    }

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    res.json({ url: data.publicUrl });
  } catch (err) {
    console.error("uploads/chat:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
