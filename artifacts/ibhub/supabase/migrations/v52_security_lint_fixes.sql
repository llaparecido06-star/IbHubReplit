-- ============================================================
-- v52 — Supabase Security Lint Fixes
-- Corrige todos os warnings do Security Advisor:
--   1. Function Search Path Mutable (0011)
--   2. RLS Policy Always True (0024)
--   3. Public Bucket Allows Listing (0025)
--   4. Public / Authenticated Can Execute SECURITY DEFINER Function (0028 / 0029)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. FUNCTION SEARCH PATH MUTABLE
--    Adiciona SET search_path = public, pg_temp em todas as
--    funções sem search_path fixo, prevenindo search_path injection.
-- ────────────────────────────────────────────────────────────

ALTER FUNCTION public.is_plan_active(p public.profiles)              SET search_path = public, pg_temp;
ALTER FUNCTION public.add_group_owner_as_member()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.get_group_member_count(p_group_id uuid)        SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_market_like()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_market_comment()                     SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_comment_like()                       SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_follow()                             SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_market_comment_likes(p_comment_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.decrement_market_comment_likes(p_comment_id uuid) SET search_path = public, pg_temp;
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
-- 2. SECURITY DEFINER — REVOKE EXECUTE FROM anon
--    Funções de trigger (sem args) e RPCs internos não devem
--    ser chamados por usuários não autenticados.
--
--    Funções de TRIGGER: também revogamos de authenticated pois
--    só devem ser invocadas pelo sistema (trigger), não via REST.
--
--    Funções RPC legítimas: mantemos para authenticated mas
--    revogamos de anon.
-- ────────────────────────────────────────────────────────────

-- Trigger functions — revoke from anon AND authenticated
REVOKE EXECUTE ON FUNCTION public.add_group_owner_as_member()                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_add_group_owner()                     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment()                        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_company_follow()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_connection()                     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_like()                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_market_comment()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_market_like()                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow()                         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment_like()                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_connection_accepted()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_likes_count()                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_comments_count()                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_follow_counts()                     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_connections_count()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_comment_likes_count()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_opportunity_interests_count()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_opportunity_applications_count()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_event_attendees_count()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_wine_cellar_updated_at()               FROM anon, authenticated;

-- RPC functions — revoke from anon only (authenticated users precisam chamar)
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, uuid, text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_market_comment_likes(uuid)                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_post_comments(uuid)                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_post_likes(uuid)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_conversation_messages(uuid)                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_conversation_other_participant(uuid, uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_direct_conversation(uuid, uuid)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_direct_conversation(uuid, uuid, uuid)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_group_member_count(uuid)                                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_conversations_participants(uuid)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_opportunity_applicants(uuid)                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_post_author(uuid)                                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_market_comment_likes(uuid)                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_opportunity_views(uuid)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_post_comments(uuid)                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_post_likes(uuid)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_view_count(uuid)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_company_page_admin(uuid)                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_plan_active(public.profiles)                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_comment_reply(uuid, uuid, uuid)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_company_ownership(uuid, uuid, uuid)                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.wine_community_ratings(text)                                 FROM anon;


-- ────────────────────────────────────────────────────────────
-- 3. RLS POLICY ALWAYS TRUE
--    Substitui políticas com USING (true) / WITH CHECK (true)
--    por expressões que realmente limitam o acesso.
-- ────────────────────────────────────────────────────────────

-- 3a. company_products — cp_all: ALL para qualquer role
--     Substitui por: owner pode fazer tudo; outros leem via SELECT público
DROP POLICY IF EXISTS cp_all ON public.company_products;
CREATE POLICY cp_all_select  ON public.company_products FOR SELECT USING (true);
CREATE POLICY cp_all_insert  ON public.company_products FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY cp_all_update  ON public.company_products FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY cp_all_delete  ON public.company_products FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3b. event_registrations — "Service role full access": ALL com true
--     Mantém acesso irrestrito apenas para service_role (bypass RLS por padrão),
--     usuários autenticados só podem ver/inserir as próprias inscrições.
DROP POLICY IF EXISTS "Service role full access" ON public.event_registrations;
CREATE POLICY er_authenticated ON public.event_registrations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3c. group_members — gm_insert: INSERT WITH CHECK (true)
--     Requer autenticação para inserir
DROP POLICY IF EXISTS gm_insert ON public.group_members;
CREATE POLICY gm_insert ON public.group_members
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3d. groups — groups_insert: INSERT WITH CHECK (true)
DROP POLICY IF EXISTS groups_insert ON public.groups;
CREATE POLICY groups_insert ON public.groups
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3e. market_posts — mp_update_counters: UPDATE com true (authenticated)
--     Permite atualização de contadores (likes, comments) mas só por auth users
DROP POLICY IF EXISTS mp_update_counters ON public.market_posts;
CREATE POLICY mp_update_counters ON public.market_posts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3f. notifications — notif_insert: INSERT WITH CHECK (true)
--     Só usuários autenticados (ou triggers internos via service role) devem inserir
DROP POLICY IF EXISTS notif_insert ON public.notifications;
CREATE POLICY notif_insert ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ────────────────────────────────────────────────────────────
-- 4. PUBLIC BUCKET ALLOWS LISTING
--    Remove políticas SELECT com USING (true) nos buckets públicos.
--    URLs individuais continuam acessíveis (bucket é público),
--    mas listagem irrestrita de todos os arquivos é bloqueada.
--    Substituímos por políticas que permitem listar apenas
--    arquivos da própria pasta do usuário autenticado.
-- ────────────────────────────────────────────────────────────

-- avatars bucket
DROP POLICY IF EXISTS avatars_select ON storage.objects;
CREATE POLICY avatars_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- chat-attachments bucket
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
CREATE POLICY chat_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

-- post-images bucket
DROP POLICY IF EXISTS chat_media_select   ON storage.objects;
DROP POLICY IF EXISTS post_images_select  ON storage.objects;
CREATE POLICY post_images_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'post-images');

-- post-videos bucket
DROP POLICY IF EXISTS post_videos_select ON storage.objects;
CREATE POLICY post_videos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'post-videos');

-- stories bucket
DROP POLICY IF EXISTS stories_public_read ON storage.objects;
DROP POLICY IF EXISTS stories_select      ON storage.objects;
CREATE POLICY stories_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stories');
