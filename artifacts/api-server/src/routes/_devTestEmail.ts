import { Router, type IRouter, type Request, type Response } from "express";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { getBrevoClient, BREVO_SENDER } from "../lib/brevo.js";
import { buildWelcomeEmailHtml, buildWeeklyDigestHtml } from "../lib/emailTemplates.js";
import { buildUnsubscribeUrl } from "../lib/emailUnsubscribe.js";

// TEMPORARY dev-only route to manually trigger a test send of the welcome
// or weekly digest email templates, without needing real DB data. Not
// mounted in production, and meant to be removed once the feature has been
// visually verified.
const router: IRouter = Router();

router.get("/_dev/test-email", async (req: Request, res: Response) => {
  if (config.NODE_ENV === "production") {
    res.status(404).end();
    return;
  }

  const email = typeof req.query.email === "string" ? req.query.email : "";
  const kind = typeof req.query.kind === "string" ? req.query.kind : "welcome";

  if (!email) {
    res.status(400).json({ error: "missing ?email=" });
    return;
  }

  const brevo = getBrevoClient();
  if (!brevo) {
    res.status(500).json({ error: "Brevo client unavailable (BREVO_API_KEY missing?)" });
    return;
  }

  try {
    if (kind === "digest") {
      const html = buildWeeklyDigestHtml({
        name: "Lucas",
        stats: { newConnections: 3, likesReceived: 12, commentsReceived: 5 },
        newMembersCount: 27,
        trendingPosts: [
          { content: "Degustação incrível de um Malbec argentino ontem à noite! Recomendo muito.", likesCount: 18, commentsCount: 4 },
          { content: "Alguém mais está de olho nos vinhos naturais desta safra?", likesCount: 11, commentsCount: 7 },
        ],
        jobs: [{ title: "Sommelier Sênior", detail: "Vinícola Alto dos Ventos · São Paulo, SP" }],
        events: [{ title: "Feira Internacional de Vinhos 2026", detail: "15 de julho · São Paulo, SP" }],
        unsubscribeUrl: buildUnsubscribeUrl("00000000-0000-0000-0000-000000000000"),
      });
      await brevo.transactionalEmails.sendTransacEmail({
        sender: BREVO_SENDER,
        to: [{ email, name: "Teste" }],
        subject: "[TESTE] Seu resumo semanal na ibhub",
        htmlContent: html,
      });
    } else {
      await brevo.transactionalEmails.sendTransacEmail({
        sender: BREVO_SENDER,
        to: [{ email, name: "Teste" }],
        subject: "[TESTE] Bem-vindo(a) à ibhub!",
        htmlContent: buildWelcomeEmailHtml({ name: "Lucas" }),
      });
    }

    res.json({ success: true, kind, email });
  } catch (err) {
    const e = err as Record<string, unknown>;
    logger.error(
      { brevoStatus: e.statusCode, brevoBody: e.body, brevoMessage: e.message ?? String(err) },
      "_dev/test-email: send failed",
    );
    res.status(500).json({ error: "send_failed", detail: e.body ?? e.message ?? String(err) });
  }
});

export default router;
