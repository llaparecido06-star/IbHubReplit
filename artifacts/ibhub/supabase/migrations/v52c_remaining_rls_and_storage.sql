-- ============================================================
-- v52c — RLS restantes + Storage (continuação da v52 após erro)
-- Aplica as seções 3c–3f (RLS) e 4 (Storage) que não foram
-- executadas porque a v52 falhou na section 3b.
-- Todos os DROPs usam IF EXISTS → idempotente.
-- ============================================================

-- ─── 3c. group_members — gm_insert ────────────────────────
DROP POLICY IF EXISTS gm_insert ON public.group_members;
CREATE POLICY gm_insert ON public.group_members
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 3d. groups — groups_insert ───────────────────────────
DROP POLICY IF EXISTS groups_insert ON public.groups;
CREATE POLICY groups_insert ON public.groups
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 3e. market_posts — mp_update_counters ────────────────
DROP POLICY IF EXISTS mp_update_counters ON public.market_posts;
CREATE POLICY mp_update_counters ON public.market_posts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 3f. notifications — notif_insert ─────────────────────
DROP POLICY IF EXISTS notif_insert ON public.notifications;
CREATE POLICY notif_insert ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ─── 4. STORAGE — remove políticas SELECT com USING (true) ─
-- URLs públicas individuais continuam acessíveis (bucket público).
-- Listagem irrestrita de todos os arquivos é bloqueada.

-- avatars
DROP POLICY IF EXISTS avatars_select ON storage.objects;
CREATE POLICY avatars_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- chat-attachments
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_select ON storage.objects;
CREATE POLICY chat_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

-- post-images
DROP POLICY IF EXISTS chat_media_select  ON storage.objects;
DROP POLICY IF EXISTS post_images_select ON storage.objects;
CREATE POLICY post_images_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'post-images');

-- post-videos
DROP POLICY IF EXISTS post_videos_select ON storage.objects;
CREATE POLICY post_videos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'post-videos');

-- stories
DROP POLICY IF EXISTS stories_public_read ON storage.objects;
DROP POLICY IF EXISTS stories_select      ON storage.objects;
CREATE POLICY stories_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stories');
