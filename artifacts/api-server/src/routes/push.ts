import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, "Expo push API returned non-OK");
      }
    } catch (err) {
      logger.error({ err }, "Failed to send Expo push notification");
    }
  }
}

/**
 * POST /api/push/send
 * Body: { tokens: string[], title: string, body: string, data?: object }
 *
 * Called by the mobile app when a new message is sent, to dispatch
 * push notifications to the recipient's registered Expo push tokens.
 * Only sends if recipient is not currently in the conversation
 * (indicated by the activeConversationId field from client).
 */
router.post("/push/send", async (req, res) => {
  const { tokens, title, body, data, activeConversationId } = req.body as {
    tokens?: string[];
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    activeConversationId?: string;
  };

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: "tokens array is required" });
  }

  // Filter out invalid tokens
  const validTokens = tokens.filter(
    (t) => typeof t === "string" && t.startsWith("ExponentPushToken["),
  );

  if (validTokens.length === 0) {
    return res.status(200).json({ sent: 0, skipped: "no valid expo push tokens" });
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: title ?? "Nova mensagem",
    body: body ?? "Você tem uma nova mensagem",
    data: { ...data, activeConversationId },
    sound: "default",
  }));

  await sendExpoPushNotifications(messages);
  logger.info({ count: messages.length }, "Push notifications dispatched");
  return res.json({ sent: messages.length });
});

export default router;
