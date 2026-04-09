-- Migration v19: Recreate profile_views explicitly in public schema
-- Fixes "table not found in schema cache" error from v16.
-- Run this in the Supabase SQL Editor.

-- 1. Create with explicit public schema
CREATE TABLE IF NOT EXISTS public.profile_views (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at  date NOT NULL DEFAULT CURRENT_DATE
);

-- 2. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS profile_views_unique_daily
  ON public.profile_views(viewer_id, profile_id, viewed_at);

CREATE INDEX IF NOT EXISTS profile_views_profile_week_idx
  ON public.profile_views(profile_id, viewed_at);

-- 3. RLS
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert views" ON public.profile_views;
CREATE POLICY "Anyone can insert views" ON public.profile_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Profile owners can see their views" ON public.profile_views;
CREATE POLICY "Profile owners can see their views" ON public.profile_views
  FOR SELECT USING (auth.uid() = profile_id);

-- 4. Verify
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'profile_views';
