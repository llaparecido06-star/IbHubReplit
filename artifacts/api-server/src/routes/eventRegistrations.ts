import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BrevoClient } from "@getbrevo/brevo";
import { logger } from "../lib/logger.js";

const router = Router();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

const registrationSchema = z.object({
  name: z.string().min(2).max(200).transform((s) => s.trim()),
  email: z.string().email().max(320).transform((s) => s.toLowerCase().trim()),
  whatsapp: z.string().min(8).max(30).transform((s) => s.trim()),
  company: z.string().max(200).transform((s) => s.trim()).optional().nullable(),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

router.post("/event-registrations", async (req, res) => {
  try {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      res.status(400).json({ error: "VALIDATION_ERROR", issues });
      return;
    }

    const { name, email, whatsapp, company } = parsed.data;

    const { data, error: dbError } = await supabase
      .from("event_registrations")
      .insert({ name, email, whatsapp, company: company || null })
      .select("id")
      .single();

    if (dbError) {
      if (dbError.code === "23505") {
        res.status(409).json({ error: "ALREADY_REGISTERED", message: "Este e-mail já está inscrito." });
        return;
      }
      logger.error({ dbError }, "Failed to insert event registration");
      res.status(500).json({ error: "DB_ERROR" });
      return;
    }

    try {
      await brevo.transactionalEmails.sendTransacEmail({
        sender: { name: "ibhub | IDEAL.BI", email: "atendimento@idealbi.com.br" },
        to: [{ email, name }],
        subject: "Inscrição confirmada — O Futuro no Mercado de Vinhos",
        htmlContent: buildConfirmationEmail(name),
      });
    } catch (emailErr) {
      const e = emailErr as Record<string, unknown>;
      logger.error({
        brevoStatus:  e.statusCode,
        brevoBody:    e.body,
        brevoMessage: e.message ?? String(emailErr),
      }, "Failed to send confirmation email via Brevo");
    }

    res.status(201).json({ success: true, id: data.id });
  } catch (err) {
    logger.error({ err }, "Unhandled error in event registration");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

function buildConfirmationEmail(rawName: string): string {
  const name = escapeHtml(rawName);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0c0d0f;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 32px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#c9a84c;font-size:24px;font-weight:800;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.04em;">
        Inscrição Confirmada!
      </h1>
      <div style="width:60px;height:3px;background:#c9a84c;margin:0 auto 24px;border-radius:2px;"></div>
    </div>

    <p style="color:#ffffff;font-size:16px;line-height:1.6;margin:0 0 16px;">
      Olá <strong>${name}</strong>,
    </p>
    <p style="color:#9aa0a8;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Sua inscrição para o encontro <strong style="color:#ffffff;">O Futuro no Mercado de Vinhos</strong> foi realizada com sucesso!
    </p>

    <div style="background:#111318;border:1px solid #2a2f3a;border-radius:8px;padding:24px;margin:24px 0;">
      <p style="color:#c9a84c;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">
        Detalhes do Evento
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#5a6270;font-size:13px;padding:4px 0;">Data</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:4px 0;text-align:right;">01 de Junho, Segunda-feira</td>
        </tr>
        <tr>
          <td style="color:#5a6270;font-size:13px;padding:4px 0;">Horário</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:4px 0;text-align:right;">20h00 (60 minutos)</td>
        </tr>
        <tr>
          <td style="color:#5a6270;font-size:13px;padding:4px 0;">Formato</td>
          <td style="color:#ffffff;font-size:14px;font-weight:600;padding:4px 0;text-align:right;">Evento Fechado</td>
        </tr>
      </table>
    </div>

    <p style="color:#9aa0a8;font-size:14px;line-height:1.7;margin:0 0 8px;">
      Em breve você receberá o <strong style="color:#ffffff;">material preparatório (Parte 1 do Raio-X do Mercado de Vinhos 2026)</strong>.
    </p>
    <p style="color:#9aa0a8;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Fique atento ao seu e-mail para mais informações.
    </p>

    <div style="border-top:1px solid #2a2f3a;padding-top:24px;text-align:center;">
      <p style="color:#5a6270;font-size:12px;margin:0;">
        ibhub | IDEAL.BI — Inteligência Estratégica para o Mercado de Vinhos
      </p>
      <p style="color:#5a6270;font-size:12px;margin:4px 0 0;">
        atendimento@idealbi.com.br
      </p>
    </div>
  </div>
</body>
</html>`;
}

export default router;
