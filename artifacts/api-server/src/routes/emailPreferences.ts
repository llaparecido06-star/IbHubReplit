import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { verifyUnsubscribeToken } from "../lib/emailUnsubscribe.js";

const router: IRouter = Router();

function getSupabaseAdmin() {
  return createClient(config.EXPO_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0c0d0f;font-family:'Inter',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="max-width:480px;padding:40px 32px;text-align:center;">
    <h1 style="color:#c9a84c;font-size:20px;font-weight:800;margin:0 0 16px;">${title}</h1>
    <p style="color:#9aa0a8;font-size:15px;line-height:1.6;">${message}</p>
    <a href="https://www.ibhub.com.br" style="color:#c9a84c;font-size:14px;">Voltar para a ibhub</a>
  </div>
</body>
</html>`;
}

// Unauthenticated by design: the signed token (not a session) is the proof
// of ownership, so a user can unsubscribe straight from their email client.
router.get("/email/unsubscribe", async (req: Request, res: Response) => {
  const uid = typeof req.query.uid === "string" ? req.query.uid : "";
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!verifyUnsubscribeToken(uid, token)) {
    res.status(400).send(htmlPage("Link inválido", "Este link de descadastro é inválido ou expirou."));
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("profiles").update({ notif_email: false }).eq("id", uid);

  if (error) {
    logger.error({ err: error, uid }, "emailPreferences: failed to unsubscribe user");
    res.status(500).send(htmlPage("Erro", "Não foi possível processar seu pedido agora. Tente novamente mais tarde."));
    return;
  }

  logger.info({ uid }, "emailPreferences: user unsubscribed from weekly digest");
  res.status(200).send(
    htmlPage("Você foi descadastrado", "Você não receberá mais o resumo semanal por e-mail. Você pode reativar a qualquer momento em Minha Conta."),
  );
});

export default router;
