-- v59: add allow_multiple to market_posts polls
-- and update market_post_poll_votes to support multi-choice

-- 1. Add allow_multiple flag to market_posts
ALTER TABLE market_posts
  ADD COLUMN IF NOT EXISTS poll_allow_multiple BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Drop the (post_id, user_id) unique constraint that limits each user to one vote.
--    Supabase auto-names this constraint; try the standard convention first.
ALTER TABLE market_post_poll_votes
  DROP CONSTRAINT IF EXISTS market_post_poll_votes_post_id_user_id_key;

-- Generic fallback: drop any UNIQUE constraint whose columns are exactly (post_id, user_id)
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT tc.constraint_name INTO cname
  FROM information_schema.table_constraints tc
  JOIN (
    SELECT constraint_name, array_agg(column_name ORDER BY ordinal_position) AS cols
    FROM information_schema.key_column_usage
    WHERE table_name = 'market_post_poll_votes'
    GROUP BY constraint_name
  ) kcu ON kcu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'market_post_poll_votes'
    AND tc.constraint_type = 'UNIQUE'
    AND kcu.cols = ARRAY['post_id','user_id']
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE market_post_poll_votes DROP CONSTRAINT %I', cname);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Each (post, user, option) combination must be unique — allows multi-choice
CREATE UNIQUE INDEX IF NOT EXISTS uidx_mppv_post_user_option
  ON market_post_poll_votes (post_id, user_id, option_id);
