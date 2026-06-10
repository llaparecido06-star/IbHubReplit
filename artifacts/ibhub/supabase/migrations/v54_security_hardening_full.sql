-- ============================================================
-- v54 — Security Hardening (idempotente, substitui v52/v52c)
-- Corrige todos os warnings restantes do Security Advisor.
-- Execute COMPLETO no SQL Editor do Supabase.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. FUNCTION SEARCH PATH
--    Previne search_path injection em todas as 20 funções.
-- ────────────────────────────────────────────────────────────
ALTER FUNCTION public.is_plan_active(public.profiles)                SET search_path = public, pg_temp;
ALTER FUNCTION public.add_group_owner_as_member()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.get_group_member_count(uuid)                   SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_market_like()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_market_comment()                     SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_comment_like()                       SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_follow()                             SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_market_comment_likes(uuid)           SET search_path = public, pg_temp;
ALTER FUNCTION public.decrement_market_comment_likes(uuid)           SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_profile_privilege_escalation()         SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_connection_accepted()                SET search_path = public, pg_temp;
ALTER FUNCTION public.update_follow_counts()                         SET search_path = public, pg_temp;
ALTER FUNCTION public.update_connections_count()                     SET search_path = public, pg_temp;
ALTER FUNCTION public.set_wine_cellar_updated_at()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.update_opportunity_interests_count()           SET search_path = public, pg_temp;
ALTER FUNCTION public.update_opportunity_applications_count()        SET search_path = public, pg_temp;
ALTER FUNCTION public.update_event_attendees_count()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.update_comment_likes_count()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.update_likes_count()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.update_comments_count()                        SET search_path = public, pg_temp;


-- ────────────────────────────────────────────────────────────
-- 2. REVOKE EXECUTE FROM anon
--    Trigger functions: também revogamos de authenticated
--    (só devem ser chamadas pelo sistema, nunca via REST).
--    RPC functions: revogamos apenas de anon.
-- ────────────────────────────────────────────────────────────

-- Trigger functions — anon + authenticated
REVOKE EXECUTE ON FUNCTION public.add_group_owner_as_member()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_add_group_owner()                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment()                     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_company_follow()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_connection()                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_like()                        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_market_comment()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_market_like()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation()  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow()                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment_like()                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_connection_accepted()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_likes_count()                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_comments_count()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_follow_counts()                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_connections_count()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_comment_likes_count()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_opportunity_interests_count()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_opportunity_applications_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_event_attendees_count()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_wine_cellar_updated_at()            FROM anon, authenticated;

-- RPC functions — somente anon (authenticated mantém acesso)
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_market_comment_likes(uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_post_comments(uuid)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_post_likes(uuid)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_conversation_messages(uuid)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_conversation_other_participant(uuid, uuid)    FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_direct_conversation(uuid, uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_direct_conversation(uuid, uuid, uuid)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_group_member_count(uuid)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_conversations_participants(uuid)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_opportunity_applicants(uuid)                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_post_author(uuid)                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_market_comment_likes(uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_opportunity_views(uuid)                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_post_comments(uuid)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_post_likes(uuid)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_view_count(uuid)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_company_page_admin(uuid)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_plan_active(public.profiles)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_comment_reply(uuid, uuid, uuid)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_company_ownership(uuid, uuid, uuid)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.wine_community_ratings(text)                      FROM anon;


-- ────────────────────────────────────────────────────────────
-- 3. RLS — company_products
--    Substitui cp_all (ALL com true) por policies separadas.
--    SELECT público (true) é permitido pelo advisor;
--    INSERT/UPDATE/DELETE exigem autenticação.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cp_all        ON public.company_products;
DROP POLICY IF EXISTS cp_all_select ON public.company_products;
DROP POLICY IF EXISTS cp_all_insert ON public.company_products;
DROP POLICY IF EXISTS cp_all_update ON public.company_products;
DROP POLICY IF EXISTS cp_all_delete ON public.company_products;

CREATE POLICY cp_all_select ON public.company_products FOR SELECT USING (true);
CREATE POLICY cp_all_insert ON public.company_products FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY cp_all_update ON public.company_products FOR UPDATE
  USING     (auth.uid() IS NOT NULL)
  WITH CHECK(auth.uid() IS NOT NULL);
CREATE POLICY cp_all_delete ON public.company_products FOR DELETE USING (auth.uid() IS NOT NULL);


-- ────────────────────────────────────────────────────────────
-- 4. RLS — market_posts / mp_update_counters
--    As funções de contador são SECURITY DEFINER e ignoram RLS.
--    A policy mp_update_counters com USING(true) é desnecessária
--    e dispara o aviso. Removemos sem substituição.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS mp_update_counters ON public.market_posts;


-- ────────────────────────────────────────────────────────────
-- 5. STORAGE — remove políticas SELECT amplas em buckets públicos
--    Buckets públicos não precisam de política SELECT para acesso
--    por URL. Removemos as políticas que permitem listar todos
--    os arquivos. As que criamos na v52c são amplas demais.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS chat_attachments_select ON storage.objects;
DROP POLICY IF EXISTS post_images_select      ON storage.objects;
DROP POLICY IF EXISTS post_videos_select      ON storage.objects;
DROP POLICY IF EXISTS stories_select          ON storage.objects;
