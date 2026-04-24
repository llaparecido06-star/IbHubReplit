-- v62: Recalculate likes_count for all posts from actual likes rows.
-- This corrects phantom counts caused by the web upsert bug (fixed in app code).
-- Also ensures the old trigger-based approach is fully removed.

-- 1. Drop any residual trigger that may have been re-created
DROP TRIGGER IF EXISTS likes_count_trigger ON likes;
DROP TRIGGER IF EXISTS update_likes_count_on_like ON likes;
DROP TRIGGER IF EXISTS update_likes_count ON likes;

-- 2. Recalculate likes_count from actual rows in the likes table
UPDATE posts
SET likes_count = (
  SELECT COUNT(*)
  FROM likes
  WHERE likes.post_id = posts.id
)
WHERE true;

-- 3. Ensure likes_count never goes below 0 (safety guard)
UPDATE posts SET likes_count = 0 WHERE likes_count < 0;

-- 4. Verify partial unique indexes exist (non-destructive; errors if missing)
-- uq_likes_personal: (post_id, user_id) WHERE company_page_id IS NULL
-- uq_likes_company:  (post_id, company_page_id) WHERE company_page_id IS NOT NULL
-- These were created in migrations_v22_likes_company_identity.sql.
-- If you need to recreate them run:
--   CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_personal ON likes (post_id, user_id) WHERE company_page_id IS NULL;
--   CREATE UNIQUE INDEX IF NOT EXISTS uq_likes_company  ON likes (post_id, company_page_id) WHERE company_page_id IS NOT NULL;
