-- v51_market_rls_fixes.sql
-- Fix missing RLS policies that prevented non-admin users from:
--   1. Changing reaction type on market_post_likes (UPDATE)
--   2. Reading/writing market_comment_likes (no RLS at all)
-- NOTE: All write paths for likes/comments now go through the API server
--       (service role), so client-side write policies are safety backstops only.

-- ─── 1. market_post_likes: add UPDATE policy ─────────────────────────────────
drop policy if exists "mpl_update" on public.market_post_likes;
create policy "mpl_update"
  on public.market_post_likes for update
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─── 2. market_comment_likes: enable RLS + all required policies ──────────────
alter table if exists public.market_comment_likes enable row level security;

drop policy if exists "mcl_select" on public.market_comment_likes;
create policy "mcl_select"
  on public.market_comment_likes for select
  to authenticated
  using (true);

drop policy if exists "mcl_insert" on public.market_comment_likes;
create policy "mcl_insert"
  on public.market_comment_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "mcl_delete" on public.market_comment_likes;
create policy "mcl_delete"
  on public.market_comment_likes for delete
  to authenticated
  using (auth.uid() = user_id);


-- ─── 3. market_posts counters ─────────────────────────────────────────────────
-- All counter updates (likes_count, comments_count) are now handled by the API
-- server using the service role, which bypasses RLS. No extra client-side policy
-- is needed here. The existing mp_update_admin policy remains for admin edits.
