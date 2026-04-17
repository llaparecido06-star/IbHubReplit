-- v57: Market comment replies and likes support
-- Adds parent_comment_id for threading and likes_count for comment reactions

ALTER TABLE market_post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES market_post_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

-- Track who liked individual market comments
CREATE TABLE IF NOT EXISTS market_comment_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES market_post_comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_market_post_comments_parent ON market_post_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_post_comments_post   ON market_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_market_comment_likes_comment ON market_comment_likes(comment_id);

-- Enable RLS
ALTER TABLE market_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "comment_likes_public_read"  ON market_comment_likes FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "comment_likes_auth_insert"  ON market_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "comment_likes_auth_delete"  ON market_comment_likes FOR DELETE USING (auth.uid() = user_id);
