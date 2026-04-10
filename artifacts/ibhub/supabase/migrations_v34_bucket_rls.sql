-- ============================================================
-- v34 — RLS policies for storage buckets: stories and cvs
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Ensure buckets exist and are configured
-- ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('stories', 'stories', true,  52428800, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime']),
  ('cvs',     'cvs',     false, 10485760, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────
-- 2. stories bucket policies
-- ─────────────────────────────────────────

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "stories_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "stories_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "stories_owner_update"  ON storage.objects;
DROP POLICY IF EXISTS "stories_owner_delete"  ON storage.objects;

-- Anyone can read stories (bucket is public)
CREATE POLICY "stories_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stories');

-- Authenticated users can upload to their own folder (stories/<user_id>/...)
CREATE POLICY "stories_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can update their own story files
CREATE POLICY "stories_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own story files
CREATE POLICY "stories_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────
-- 3. cvs bucket policies
-- ─────────────────────────────────────────

DROP POLICY IF EXISTS "cvs_auth_read"    ON storage.objects;
DROP POLICY IF EXISTS "cvs_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "cvs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "cvs_owner_delete" ON storage.objects;

-- Any authenticated user can read CVs (companies need to download applicant CVs)
CREATE POLICY "cvs_auth_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cvs'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can upload to their own folder (cvs/<user_id>/...)
CREATE POLICY "cvs_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cvs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can replace their own CV
CREATE POLICY "cvs_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cvs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own CV
CREATE POLICY "cvs_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cvs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
