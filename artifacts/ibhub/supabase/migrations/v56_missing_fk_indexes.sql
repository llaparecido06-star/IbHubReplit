-- ============================================================
-- v56_missing_fk_indexes.sql
-- FK indexes que faltaram no v55 (colunas expostas ao dropar
-- os índices extras) + FKs que não tinham sido incluídos.
-- Todos usam IF NOT EXISTS — idempotente.
-- ============================================================

-- Comentários: replies e posts de páginas de empresa
CREATE INDEX IF NOT EXISTS idx_fk_comments_parent_comment_id          ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_fk_comments_company_page_id             ON public.comments(company_page_id);

-- Company follows
CREATE INDEX IF NOT EXISTS idx_fk_company_follows_user_id              ON public.company_follows(user_id);

-- Conversas de páginas de empresa
CREATE INDEX IF NOT EXISTS idx_fk_conversations_company_page_id        ON public.conversations(company_page_id);
CREATE INDEX IF NOT EXISTS idx_fk_conv_participants_company_page_id    ON public.conversation_participants(company_page_id);

-- Group members
CREATE INDEX IF NOT EXISTS idx_fk_group_members_user_id                ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_group_members_company_page_id        ON public.group_members(company_page_id);

-- Likes de páginas de empresa
CREATE INDEX IF NOT EXISTS idx_fk_likes_company_page_id                ON public.likes(company_page_id);

-- Mercado: comentários e polls
CREATE INDEX IF NOT EXISTS idx_fk_mpc_post_id                          ON public.market_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_fk_mpc_parent_comment_id                ON public.market_post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_fk_market_poll_votes_user_id            ON public.market_post_poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_fk_market_posts_company_page_id         ON public.market_posts(company_page_id);

-- Mensagens: empresa remetente e reply
CREATE INDEX IF NOT EXISTS idx_fk_messages_from_company_page_id        ON public.messages(from_company_page_id);
CREATE INDEX IF NOT EXISTS idx_fk_messages_reply_to_id                 ON public.messages(reply_to_id);

-- Profiles: FK para auth.users (coluna user_id separada do id PK)
CREATE INDEX IF NOT EXISTS idx_fk_profiles_user_id                     ON public.profiles(user_id);

-- Slides
CREATE INDEX IF NOT EXISTS idx_fk_slides_presentation_id               ON public.slides(presentation_id);
CREATE INDEX IF NOT EXISTS idx_fk_user_unlocked_slides_slide_id        ON public.user_unlocked_slides(slide_id);
