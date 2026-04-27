-- v60: reactions on market post likes + comment likes for market posts

-- 1. Add reaction_type to market_post_likes (default = 'saude' for existing rows)
ALTER TABLE market_post_likes
  ADD COLUMN IF NOT EXISTS reaction_type TEXT DEFAULT 'saude';

-- 2. likes_count on market_post_comments
ALTER TABLE market_post_comments
  ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0 NOT NULL;

-- 3. market_comment_likes table
CREATE TABLE IF NOT EXISTS public.market_comment_likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id  UUID NOT NULL REFERENCES public.market_post_comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id)                  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.market_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcl_select" ON public.market_comment_likes;
CREATE POLICY "mcl_select" ON public.market_comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "mcl_insert" ON public.market_comment_likes;
CREATE POLICY "mcl_insert" ON public.market_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mcl_delete" ON public.market_comment_likes;
CREATE POLICY "mcl_delete" ON public.market_comment_likes FOR DELETE USING (auth.uid() = user_id);

-- 4. Helper RPCs for comment like counts (SECURITY DEFINER bypasses RLS on market_post_comments)
CREATE OR REPLACE FUNCTION increment_market_comment_likes(p_comment_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE public.market_post_comments
     SET likes_count = likes_count + 1
   WHERE id = p_comment_id;
$$;

CREATE OR REPLACE FUNCTION decrement_market_comment_likes(p_comment_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE public.market_post_comments
     SET likes_count = GREATEST(0, likes_count - 1)
   WHERE id = p_comment_id;
$$;
