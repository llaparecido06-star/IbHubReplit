-- ============================================================
-- v55_performance_indexes.sql
-- Performance Advisor — INFO suggestions
--
-- Parte 1: Adiciona índices nas colunas de foreign key sem cobertura.
--          Todas usam IF NOT EXISTS — seguro rodar múltiplas vezes.
--
-- Parte 2: Remove índices confirmados como nunca usados que não
--          impactam features ativas (company_page_id extras, slides,
--          wine_price_list, crash_reports de baixo tráfego).
--          Índices de segurança/feature crítica (user_blocks, stripe,
--          push_tokens, wine_cellar) foram mantidos intencionalmente.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE 1 — Foreign Keys sem índice de cobertura
-- ────────────────────────────────────────────────────────────

-- Alta frequência (feed social, curtidas, comentários, mensagens)
CREATE INDEX IF NOT EXISTS idx_fk_posts_user_id                         ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_comments_post_id                      ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_fk_comments_user_id                      ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_likes_user_id                         ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_follows_following_id                  ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_fk_messages_conversation_id              ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_fk_messages_sender_id                    ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_fk_notifications_user_id                 ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_notifications_actor_id                ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_fk_conversation_participants_user_id     ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_stories_user_id                       ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_story_likes_user_id                   ON public.story_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_story_views_user_id                   ON public.story_views(user_id);

-- Mercado (feed Ideal.BI)
CREATE INDEX IF NOT EXISTS idx_fk_market_posts_author_id                ON public.market_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_fk_market_post_comments_author_id        ON public.market_post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_fk_market_post_likes_user_id             ON public.market_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_market_comment_likes_user_id          ON public.market_comment_likes(user_id);

-- Conexões e empresas
CREATE INDEX IF NOT EXISTS idx_fk_connections_receiver_id               ON public.connections(receiver_id);
CREATE INDEX IF NOT EXISTS idx_fk_company_page_admins_user_id           ON public.company_page_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_groups_owner_id                       ON public.groups(owner_id);

-- Oportunidades e eventos
CREATE INDEX IF NOT EXISTS idx_fk_opportunities_created_by              ON public.opportunities(created_by);
CREATE INDEX IF NOT EXISTS idx_fk_opportunity_applications_applicant_id ON public.opportunity_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_fk_opportunity_saves_user_id             ON public.opportunity_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_events_user_id                        ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_event_attendees_user_id               ON public.event_attendees(user_id);

-- Notificações extras
CREATE INDEX IF NOT EXISTS idx_fk_notifications_post_id                 ON public.notifications(post_id);
CREATE INDEX IF NOT EXISTS idx_fk_notifications_actor_company_id        ON public.notifications(actor_company_id);
CREATE INDEX IF NOT EXISTS idx_fk_notifications_comment_id              ON public.notifications(comment_id);
CREATE INDEX IF NOT EXISTS idx_fk_notifications_opportunity_id          ON public.notifications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_fk_notification_broadcasts_sent_by       ON public.notification_broadcasts(sent_by);
CREATE INDEX IF NOT EXISTS idx_fk_push_notification_logs_sent_by        ON public.push_notification_logs(sent_by);

-- Outros
CREATE INDEX IF NOT EXISTS idx_fk_bookmarks_user_id                     ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_bug_reports_user_id                   ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_certification_requests_user_id        ON public.certification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_certification_requests_reviewed_by    ON public.certification_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_fk_comment_likes_user_id                 ON public.comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_feature_flags_updated_by              ON public.feature_flags(updated_by);
CREATE INDEX IF NOT EXISTS idx_fk_post_hidden_post_id                   ON public.post_hidden(post_id);
CREATE INDEX IF NOT EXISTS idx_fk_reports_post_id                       ON public.reports(post_id);
CREATE INDEX IF NOT EXISTS idx_fk_reports_reported_by                   ON public.reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_fk_reports_reported_user_id              ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_fk_support_messages_user_id              ON public.support_messages(user_id);

-- ────────────────────────────────────────────────────────────
-- PARTE 2 — Índices nunca usados (seguros para remover)
--
-- Mantidos intencionalmente (features ativas):
--   idx_user_blocks_blocker / _blocked  — bloqueio de usuários
--   push_tokens_user_id_idx             — push notifications
--   idx_post_hidden_user                — ocultar posts
--   profiles_stripe_customer_id_idx     — webhook Stripe
--   profiles_stripe_status_idx          — consulta de planos
--   idx_wine_cellar_ean                 — busca EAN na adega
--   wine_imports_marca_trgm_idx         — full-text search importações
--   message_reactions_user_id_idx       — reações a mensagens
--   idx_profiles_invited_by_id          — referral codes
-- ────────────────────────────────────────────────────────────

-- Índices de company_page extras sem uso confirmado
DROP INDEX IF EXISTS public.idx_messages_from_company;
DROP INDEX IF EXISTS public.idx_conversations_company_page_id;
DROP INDEX IF EXISTS public.idx_market_posts_company_page_id;
DROP INDEX IF EXISTS public.idx_gm_company_page_id;
DROP INDEX IF EXISTS public.idx_cp_company_page_id;
DROP INDEX IF EXISTS public.idx_gm_group_id;
DROP INDEX IF EXISTS public.idx_gm_user_id;
DROP INDEX IF EXISTS public.idx_gm_company_id;

-- Slides (feature pouco usada / beta)
DROP INDEX IF EXISTS public.slides_presentation_id_idx;
DROP INDEX IF EXISTS public.slides_sequence_order_idx;
DROP INDEX IF EXISTS public.user_unlocked_slides_user_idx;
DROP INDEX IF EXISTS public.user_unlocked_slides_slide_idx;

-- Wine price list (tabela estática, sem consultas frequentes)
DROP INDEX IF EXISTS public.wine_price_list_descricao_idx;
DROP INDEX IF EXISTS public.wine_price_list_codigo_idx;
DROP INDEX IF EXISTS public.wine_price_list_marca_idx;

-- Wine imports extras (o índice trgm ativo é suficiente)
DROP INDEX IF EXISTS public.wine_imports_marca_completa_idx;
DROP INDEX IF EXISTS public.wine_imports_marca_relatorio_idx;

-- Crash reports (tabela de log, não consultada em tempo real)
DROP INDEX IF EXISTS public.crash_reports_created_at_idx;
DROP INDEX IF EXISTS public.crash_reports_type_idx;

-- Mercado: duplicatas de índices já cobertos por outros
DROP INDEX IF EXISTS public.market_posts_created_at_idx;
DROP INDEX IF EXISTS public.market_post_likes_post_id_idx;
DROP INDEX IF EXISTS public.market_post_comments_post_id_idx;
DROP INDEX IF EXISTS public.idx_market_post_comments_post;
DROP INDEX IF EXISTS public.idx_market_post_comments_parent;
DROP INDEX IF EXISTS public.idx_market_comment_likes_comment;
DROP INDEX IF EXISTS public.market_post_poll_votes_post_id_idx;
DROP INDEX IF EXISTS public.market_post_poll_votes_user_id_idx;

-- Comments e likes extras (já cobertos pelos índices criados na parte 1)
DROP INDEX IF EXISTS public.idx_comments_company_page_id;
DROP INDEX IF EXISTS public.idx_comments_parent;
DROP INDEX IF EXISTS public.idx_comment_likes_comment;
DROP INDEX IF EXISTS public.idx_likes_company_page_id;

-- Company follows e messages extras
DROP INDEX IF EXISTS public.company_follows_user_id_idx;
DROP INDEX IF EXISTS public.messages_reply_to_id_idx;
DROP INDEX IF EXISTS public.messages_read_at_idx;

-- idx_company_pages_can_post_market — coluna booleana, filtro raro
DROP INDEX IF EXISTS public.idx_company_pages_can_post_market;
