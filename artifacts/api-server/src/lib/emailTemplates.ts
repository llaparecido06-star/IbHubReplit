export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Shared navy/gold dark email shell used across all ibhub transactional
 * emails (matches the confirmation email in eventRegistrations.ts).
 */
function wrapEmailLayout(opts: { title: string; bodyHtml: string; footerHtml?: string }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0c0d0f;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 32px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#c9a84c;font-size:24px;font-weight:800;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.04em;">
        ${opts.title}
      </h1>
      <div style="width:60px;height:3px;background:#c9a84c;margin:0 auto 24px;border-radius:2px;"></div>
    </div>

    ${opts.bodyHtml}

    <div style="border-top:1px solid #2a2f3a;padding-top:24px;text-align:center;margin-top:24px;">
      ${opts.footerHtml ?? ""}
      <p style="color:#5a6270;font-size:12px;margin:4px 0 0;">
        ibhub — Rede do Vinho
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildWelcomeEmailHtml(opts: { name: string }): string {
  const name = escapeHtml(opts.name);
  const appUrl = "https://www.ibhub.com.br";
  return wrapEmailLayout({
    title: "Bem-vindo(a) à ibhub!",
    bodyHtml: `
      <p style="color:#ffffff;font-size:16px;line-height:1.6;margin:0 0 16px;">
        Olá <strong>${name}</strong>,
      </p>
      <p style="color:#9aa0a8;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Sua conta foi confirmada com sucesso! A ibhub é a rede social do mercado de vinhos —
        conecte-se com sommeliers, produtores, importadores e distribuidores, acompanhe
        oportunidades do setor e participe de eventos exclusivos.
      </p>
      <div style="background:#111318;border:1px solid #2a2f3a;border-radius:8px;padding:24px;margin:24px 0;">
        <p style="color:#c9a84c;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">
          Para começar
        </p>
        <p style="color:#ffffff;font-size:14px;line-height:1.8;margin:0;">
          • Complete seu perfil profissional<br/>
          • Siga conexões do setor<br/>
          • Explore vagas e eventos na aba Oportunidades
        </p>
      </div>
      <div style="text-align:center;margin:32px 0 8px;">
        <a href="${appUrl}" style="display:inline-block;background:#c9a84c;color:#0c0d0f;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">
          Acessar a ibhub
        </a>
      </div>
    `,
  });
}

export interface DigestStats {
  newConnections: number;
  likesReceived: number;
  commentsReceived: number;
}

export interface DigestOpportunity {
  title: string;
  detail: string;
}

export interface DigestPost {
  content: string;
  likesCount: number;
  commentsCount: number;
}

export function buildWeeklyDigestHtml(opts: {
  name: string;
  stats: DigestStats;
  newMembersCount: number;
  trendingPosts: DigestPost[];
  jobs: DigestOpportunity[];
  events: DigestOpportunity[];
  unsubscribeUrl: string;
}): string {
  const name = escapeHtml(opts.name);
  const appUrl = "https://www.ibhub.com.br";

  const statsHtml = `
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="color:#5a6270;font-size:13px;padding:4px 0;">Novas conexões</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:4px 0;text-align:right;">${opts.stats.newConnections}</td>
      </tr>
      <tr>
        <td style="color:#5a6270;font-size:13px;padding:4px 0;">Curtidas recebidas</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:4px 0;text-align:right;">${opts.stats.likesReceived}</td>
      </tr>
      <tr>
        <td style="color:#5a6270;font-size:13px;padding:4px 0;">Comentários recebidos</td>
        <td style="color:#ffffff;font-size:14px;font-weight:600;padding:4px 0;text-align:right;">${opts.stats.commentsReceived}</td>
      </tr>
    </table>
  `;

  const trendingHtml = opts.trendingPosts.length
    ? opts.trendingPosts
        .map(
          (p) => `
      <p style="color:#ffffff;font-size:14px;line-height:1.6;margin:0 0 4px;">
        "${escapeHtml(p.content).slice(0, 140)}${p.content.length > 140 ? "…" : ""}"
      </p>
      <p style="color:#5a6270;font-size:12px;margin:0 0 16px;">
        ${p.likesCount} curtidas · ${p.commentsCount} comentários
      </p>`,
        )
        .join("")
    : `<p style="color:#5a6270;font-size:13px;margin:0 0 16px;">Sem destaques esta semana.</p>`;

  const jobsHtml = opts.jobs.length
    ? opts.jobs.map((j) => `<p style="color:#ffffff;font-size:14px;line-height:1.8;margin:0;">• <strong>${escapeHtml(j.title)}</strong> — ${escapeHtml(j.detail)}</p>`).join("")
    : `<p style="color:#5a6270;font-size:13px;margin:0;">Nenhuma vaga nova esta semana.</p>`;

  const eventsHtml = opts.events.length
    ? opts.events.map((e) => `<p style="color:#ffffff;font-size:14px;line-height:1.8;margin:0;">• <strong>${escapeHtml(e.title)}</strong> — ${escapeHtml(e.detail)}</p>`).join("")
    : `<p style="color:#5a6270;font-size:13px;margin:0;">Nenhum evento próximo esta semana.</p>`;

  return wrapEmailLayout({
    title: "Seu resumo semanal",
    bodyHtml: `
      <p style="color:#ffffff;font-size:16px;line-height:1.6;margin:0 0 16px;">
        Olá <strong>${name}</strong>,
      </p>
      <p style="color:#9aa0a8;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Aqui está o que aconteceu na ibhub nos últimos 7 dias.
      </p>

      <div style="background:#111318;border:1px solid #2a2f3a;border-radius:8px;padding:24px;margin:24px 0;">
        <p style="color:#c9a84c;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">
          Sua atividade
        </p>
        ${statsHtml}
      </div>

      <div style="background:#111318;border:1px solid #2a2f3a;border-radius:8px;padding:24px;margin:24px 0;">
        <p style="color:#c9a84c;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">
          Destaques da plataforma
        </p>
        <p style="color:#5a6270;font-size:12px;margin:0 0 12px;">${opts.newMembersCount} novos membros esta semana</p>
        ${trendingHtml}
      </div>

      <div style="background:#111318;border:1px solid #2a2f3a;border-radius:8px;padding:24px;margin:24px 0;">
        <p style="color:#c9a84c;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">
          Novas vagas
        </p>
        ${jobsHtml}
      </div>

      <div style="background:#111318;border:1px solid #2a2f3a;border-radius:8px;padding:24px;margin:24px 0;">
        <p style="color:#c9a84c;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">
          Próximos eventos
        </p>
        ${eventsHtml}
      </div>

      <div style="text-align:center;margin:32px 0 8px;">
        <a href="${appUrl}" style="display:inline-block;background:#c9a84c;color:#0c0d0f;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">
          Abrir a ibhub
        </a>
      </div>
    `,
    footerHtml: `
      <p style="color:#5a6270;font-size:12px;margin:0 0 8px;">
        Você está recebendo este e-mail porque tem uma conta na ibhub.
        <a href="${opts.unsubscribeUrl}" style="color:#9aa0a8;">Cancelar resumo semanal</a>
      </p>
    `,
  });
}
