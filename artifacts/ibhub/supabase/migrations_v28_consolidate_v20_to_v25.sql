-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v28: Consolida colunas faltantes de v20 a v25
-- Seguro para re-executar (usa IF NOT EXISTS em tudo)
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jbvzjjdecwzomucnmzsn/sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── v20: video_url nos posts ──────────────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_url text;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('post-videos', 'post-videos', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "post_videos_select" ON storage.objects;
CREATE POLICY "post_videos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-videos');

DROP POLICY IF EXISTS "post_videos_insert" ON storage.objects;
CREATE POLICY "post_videos_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "post_videos_delete" ON storage.objects;
CREATE POLICY "post_videos_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── v21: company_page_id em posts, likes e comments ─────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS company_page_id uuid
    REFERENCES public.company_pages(id) ON DELETE SET NULL;

ALTER TABLE public.likes
  ADD COLUMN IF NOT EXISTS company_page_id uuid
    REFERENCES public.company_pages(id) ON DELETE SET NULL;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS company_page_id uuid
    REFERENCES public.company_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_company_page_id
  ON public.posts (company_page_id) WHERE company_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_likes_company_page_id
  ON public.likes (company_page_id) WHERE company_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_company_page_id
  ON public.comments (company_page_id) WHERE company_page_id IS NOT NULL;

-- ── v22: Índices únicos separados para curtidas pessoal vs empresa ───────
-- Remove índice/constraint antigo se existir (ignora erro se não existir)
DROP INDEX IF EXISTS public.likes_post_id_user_id_key;
ALTER TABLE public.likes DROP CONSTRAINT IF EXISTS likes_post_id_user_id_key;
ALTER TABLE public.likes DROP CONSTRAINT IF EXISTS likes_user_id_post_id_key;

-- Índice parcial: curtida PESSOAL (company_page_id é null)
CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_personal
  ON public.likes (post_id, user_id)
  WHERE company_page_id IS NULL;

-- Índice parcial: curtida de EMPRESA
CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_company
  ON public.likes (post_id, company_page_id)
  WHERE company_page_id IS NOT NULL;

-- ── v23: from_company_page_id em messages ────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS from_company_page_id uuid
    REFERENCES public.company_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_from_company
  ON public.messages (from_company_page_id)
  WHERE from_company_page_id IS NOT NULL;

-- ── v24: company_page_id em stories ──────────────────────────────────────
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS company_page_id uuid
    REFERENCES public.company_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_stories_company_page
  ON public.stories (company_page_id)
  WHERE company_page_id IS NOT NULL;

-- ── v25: added_at em company_page_admins ─────────────────────────────────
ALTER TABLE public.company_page_admins
  ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now();

DROP POLICY IF EXISTS "cpa_select" ON public.company_page_admins;
CREATE POLICY "cpa_select" ON public.company_page_admins FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.company_pages p
      WHERE p.id = company_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.company_page_admins cpa2
      WHERE cpa2.company_id = company_page_admins.company_id
        AND cpa2.user_id = auth.uid()
    )
  );
