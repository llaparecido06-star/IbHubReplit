import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../lib/config.js";

const router: IRouter = Router();

function getSupabaseAdmin() {
  return createClient(config.EXPO_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const CrashReportSchema = z.object({
  type: z.enum(["js_error", "render_error", "unhandled_rejection"]),
  message: z.string().max(2000).optional(),
  stack: z.string().max(10000).optional(),
  component_stack: z.string().max(10000).optional(),
  device_info: z.record(z.unknown()).optional(),
  app_version: z.string().max(50).optional(),
  build_version: z.string().max(50).optional(),
});

/**
 * POST /api/crash-reports
 *
 * Receives JS-level crash reports from the mobile app (React render errors,
 * unhandled JS exceptions). No authentication required — crashes can happen
 * before the user is logged in.
 *
 * Always returns 200 so the client never retries on failure.
 */
router.post("/crash-reports", async (req: Request, res: Response) => {
  const parsed = CrashReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_PAYLOAD" });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("crash_reports").insert({
      ...parsed.data,
      ip: req.ip ?? null,
    });

    if (error) {
      req.log.warn({ supabaseError: error.message }, "crash-reports: insert failed");
    } else {
      req.log.info(
        { type: parsed.data.type, appVersion: parsed.data.app_version },
        "crash-reports: recorded",
      );
    }
  } catch (err) {
    req.log.error({ err }, "crash-reports: unexpected error");
  }

  res.status(200).json({ ok: true });
});

export default router;
