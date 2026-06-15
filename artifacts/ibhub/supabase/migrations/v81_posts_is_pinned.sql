-- v81: Add is_pinned to posts
-- Allows admins to pin posts to the top of the main feed.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_pinned ON public.posts (is_pinned) WHERE is_pinned = true;
