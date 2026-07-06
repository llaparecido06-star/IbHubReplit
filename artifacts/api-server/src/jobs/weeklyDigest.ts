import { createClient } from "@supabase/supabase-js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { getBrevoClient, BREVO_SENDER, upsertBrevoContact } from "../lib/brevo.js";
import { buildWeeklyDigestHtml, type DigestOpportunity, type DigestPost } from "../lib/emailTemplates.js";
import { buildUnsubscribeUrl } from "../lib/emailUnsubscribe.js";

function getSupabaseAdmin() {
  return createClient(config.EXPO_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface DigestRecipientRow {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  plan: string | null;
  created_at: string | null;
  brevo_contact_synced_at: string | null;
}

const SEND_CHUNK = 10;

/**
 * Weekly digest: personal activity summary + platform highlights +
 * opportunities. Sent to every user with notif_email = true (opt-out model),
 * with an unsubscribe link in every email.
 */
export async function weeklyDigestJob(): Promise<void> {
  if (!config.BREVO_API_KEY) {
    logger.warn("weeklyDigestJob: BREVO_API_KEY not set, skipping");
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: recipients, error: recipientsErr } = await supabaseAdmin.rpc("get_digest_recipients");
  if (recipientsErr) {
    logger.error({ err: recipientsErr }, "weeklyDigestJob: failed to fetch recipients");
    return;
  }

  const rows = (recipients ?? []) as DigestRecipientRow[];
  if (rows.length === 0) {
    logger.info("weeklyDigestJob: no opted-in recipients");
    return;
  }

  // ── Platform-wide sections (computed once, reused for every recipient) ──
  const [trendingRes, newMembersRes, jobsRes, eventsRes] = await Promise.all([
    supabaseAdmin
      .from("posts")
      .select("content, likes_count, comments_count")
      .gte("created_at", since)
      .order("likes_count", { ascending: false })
      .limit(3),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabaseAdmin
      .from("opportunities")
      .select("title, company, location")
      .eq("is_active", true)
      .eq("type", "vaga")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("events")
      .select("title, start_date, location")
      .eq("is_active", true)
      .eq("visibility", "publico")
      .gte("start_date", nowIso)
      .order("start_date", { ascending: true })
      .limit(5),
  ]);

  const trendingPosts: DigestPost[] = (trendingRes.data ?? []).map((p) => ({
    content: p.content ?? "",
    likesCount: p.likes_count ?? 0,
    commentsCount: p.comments_count ?? 0,
  }));
  const newMembersCount = newMembersRes.count ?? 0;
  const jobs: DigestOpportunity[] = (jobsRes.data ?? []).map((j) => ({
    title: j.title ?? "Vaga",
    detail: [j.company, j.location].filter(Boolean).join(" · ") || "Detalhes na plataforma",
  }));
  const events: DigestOpportunity[] = (eventsRes.data ?? []).map((e) => ({
    title: e.title ?? "Evento",
    detail: [
      e.start_date ? new Date(e.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : null,
      e.location,
    ]
      .filter(Boolean)
      .join(" · ") || "Detalhes na plataforma",
  }));

  // ── Per-user aggregates (bulk-fetched, no N+1) ──
  const [connectionsRes, likesRes, commentsRes] = await Promise.all([
    supabaseAdmin.from("connections").select("requester_id, receiver_id").eq("status", "accepted").gte("created_at", since),
    supabaseAdmin.from("likes").select("post_id, created_at").gte("created_at", since),
    supabaseAdmin.from("comments").select("post_id, created_at").gte("created_at", since),
  ]);

  const connectionsCountByUser = new Map<string, number>();
  for (const c of connectionsRes.data ?? []) {
    connectionsCountByUser.set(c.requester_id, (connectionsCountByUser.get(c.requester_id) ?? 0) + 1);
    connectionsCountByUser.set(c.receiver_id, (connectionsCountByUser.get(c.receiver_id) ?? 0) + 1);
  }

  const likePostIds = Array.from(new Set((likesRes.data ?? []).map((l) => l.post_id).filter(Boolean)));
  const commentPostIds = Array.from(new Set((commentsRes.data ?? []).map((c) => c.post_id).filter(Boolean)));
  const allPostIds = Array.from(new Set([...likePostIds, ...commentPostIds]));

  const postOwnerById = new Map<string, string>();
  if (allPostIds.length > 0) {
    const { data: postsData } = await supabaseAdmin.from("posts").select("id, user_id").in("id", allPostIds);
    for (const p of postsData ?? []) {
      if (p.id && p.user_id) postOwnerById.set(p.id, p.user_id);
    }
  }

  const likesCountByUser = new Map<string, number>();
  for (const l of likesRes.data ?? []) {
    const owner = l.post_id ? postOwnerById.get(l.post_id) : undefined;
    if (owner) likesCountByUser.set(owner, (likesCountByUser.get(owner) ?? 0) + 1);
  }

  const commentsCountByUser = new Map<string, number>();
  for (const c of commentsRes.data ?? []) {
    const owner = c.post_id ? postOwnerById.get(c.post_id) : undefined;
    if (owner) commentsCountByUser.set(owner, (commentsCountByUser.get(owner) ?? 0) + 1);
  }

  logger.info({ recipients: rows.length }, "weeklyDigestJob: sending weekly digests");

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += SEND_CHUNK) {
    const batch = rows.slice(i, i + SEND_CHUNK);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        if (!row.email) return;

        const brevo = getBrevoClient();
        if (!brevo) throw new Error("Brevo client unavailable");

        const html = buildWeeklyDigestHtml({
          name: row.full_name ?? row.username ?? "membro da ibhub",
          stats: {
            newConnections: connectionsCountByUser.get(row.id) ?? 0,
            likesReceived: likesCountByUser.get(row.id) ?? 0,
            commentsReceived: commentsCountByUser.get(row.id) ?? 0,
          },
          newMembersCount,
          trendingPosts,
          jobs,
          events,
          unsubscribeUrl: buildUnsubscribeUrl(row.id),
        });

        await brevo.transactionalEmails.sendTransacEmail({
          sender: BREVO_SENDER,
          to: [{ email: row.email, name: row.full_name ?? row.email }],
          subject: "Seu resumo semanal na ibhub",
          htmlContent: html,
        });

        if (!row.brevo_contact_synced_at) {
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
        }
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") sent++;
      else {
        failed++;
        logger.error({ err: r.reason }, "weeklyDigestJob: failed to send digest to a recipient");
      }
    }
  }

  logger.info({ sent, failed }, "weeklyDigestJob: done");
}
