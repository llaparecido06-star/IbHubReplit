import { createClient } from "@supabase/supabase-js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { getBrevoClient, BREVO_SENDER, upsertBrevoContact } from "../lib/brevo.js";
import { buildWelcomeEmailHtml } from "../lib/emailTemplates.js";

function getSupabaseAdmin() {
  return createClient(config.EXPO_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface WelcomePendingRow {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  plan: string | null;
  created_at: string | null;
}

/**
 * Sends a one-time branded welcome email (via Brevo) to every user whose
 * account has just been confirmed, without touching Supabase Auth's own
 * confirmation email. Runs as a periodic cron sweep so it works identically
 * regardless of which client (mobile or web) the user confirmed from.
 *
 * Exactly-once delivery: claim the row atomically (`welcome_email_sent_at`
 * set only if still NULL) before sending; if the send fails, the claim is
 * reverted so the next sweep retries.
 */
export async function welcomeEmailSweepJob(): Promise<void> {
  if (!config.BREVO_API_KEY) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: pending, error } = await supabaseAdmin.rpc("get_welcome_pending", { p_limit: 100 });

  if (error) {
    logger.error({ err: error }, "welcomeEmailSweepJob: failed to fetch pending users");
    return;
  }

  const rows = (pending ?? []) as WelcomePendingRow[];
  if (rows.length === 0) return;

  logger.info({ count: rows.length }, "welcomeEmailSweepJob: sending welcome emails");

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.email) continue;

    // Atomic claim: only proceed if we're the one flipping it from NULL.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("welcome_email_sent_at", null)
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) continue;

    try {
      const brevo = getBrevoClient();
      if (!brevo) throw new Error("Brevo client unavailable");

      await brevo.transactionalEmails.sendTransacEmail({
        sender: BREVO_SENDER,
        to: [{ email: row.email, name: row.full_name ?? row.email }],
        subject: "Bem-vindo(a) à ibhub!",
        htmlContent: buildWelcomeEmailHtml({ name: row.full_name ?? row.username ?? "membro da ibhub" }),
      });

      sent++;

      const synced = await upsertBrevoContact({
        email: row.email,
        fullName: row.full_name,
        username: row.username,
        plan: row.plan,
        signupDate: row.created_at,
      });
      if (synced) {
        await supabaseAdmin
          .from("profiles")
          .update({ brevo_contact_synced_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    } catch (sendErr) {
      failed++;
      const e = sendErr as Record<string, unknown>;
      logger.error(
        { userId: row.id, brevoStatus: e.statusCode, brevoBody: e.body, brevoMessage: e.message ?? String(sendErr) },
        "welcomeEmailSweepJob: failed to send welcome email — reverting claim for retry",
      );
      // Revert the claim so a future sweep retries this user.
      await supabaseAdmin.from("profiles").update({ welcome_email_sent_at: null }).eq("id", row.id);
    }
  }

  logger.info({ sent, failed }, "welcomeEmailSweepJob: done");
}
