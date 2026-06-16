import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    logger.warn("webpush: VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set — web push disabled");
    return false;
  }
  webpush.setVapidDetails("mailto:contato@ibhub.com.br", pub, priv);
  vapidConfigured = true;
  return true;
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface WebSubRow {
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

/**
 * Sends a web push notification to a single user across all their browser
 * subscriptions. Fire-and-forget — does not throw.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload,
): Promise<void> {
  if (!ensureVapidConfigured()) return;

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("web_push_subscriptions")
      .select("endpoint, keys_p256dh, keys_auth")
      .eq("user_id", userId) as { data: WebSubRow[] | null; error: unknown };

    if (error) {
      logger.error({ err: error, userId }, "webpush: failed to fetch subscriptions");
      return;
    }

    if (!rows || rows.length === 0) return;

    const deadEndpoints: string[] = [];

    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.keys_p256dh, auth: row.keys_auth },
            },
            JSON.stringify(payload),
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            deadEndpoints.push(row.endpoint);
          } else {
            logger.warn({ err, userId, endpoint: row.endpoint.slice(-20) }, "webpush: send error");
          }
        }
      }),
    );

    if (deadEndpoints.length > 0) {
      void supabaseAdmin
        .from("web_push_subscriptions")
        .delete()
        .in("endpoint", deadEndpoints)
        .then(({ error: delErr }) => {
          if (delErr) logger.warn({ err: delErr }, "webpush: failed to purge dead endpoints");
          else logger.info({ count: deadEndpoints.length }, "webpush: purged dead endpoints");
        });
    }

    logger.info({ userId, sent: rows.length - deadEndpoints.length }, "webpush: dispatched");
  } catch (err) {
    logger.error({ err, userId }, "webpush: sendWebPushToUser unexpected error");
  }
}
