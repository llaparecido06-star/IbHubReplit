-- v27: Fix ALL FKs that reference auth.users(id) → public.profiles(id)
-- This enables PostgREST to join any table to profiles for author/actor fields.
-- profiles.id = auth.users.id (same UUID), so no data changes — only constraint target changes.
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/jbvzjjdecwzomucnmzsn/sql)

-- ── POSTS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── LIKES ───────────────────────────────────────────────────────────────────
ALTER TABLE public.likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE public.likes
  ADD CONSTRAINT likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── COMMENTS ────────────────────────────────────────────────────────────────
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── BOOKMARKS ───────────────────────────────────────────────────────────────
ALTER TABLE public.bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;
ALTER TABLE public.bookmarks
  ADD CONSTRAINT bookmarks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── FOLLOWS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE public.follows
  ADD CONSTRAINT follows_follower_id_fkey
  FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.follows
  ADD CONSTRAINT follows_following_id_fkey
  FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── CONNECTIONS ─────────────────────────────────────────────────────────────
ALTER TABLE public.connections DROP CONSTRAINT IF EXISTS connections_requester_id_fkey;
ALTER TABLE public.connections DROP CONSTRAINT IF EXISTS connections_receiver_id_fkey;
ALTER TABLE public.connections
  ADD CONSTRAINT connections_requester_id_fkey
  FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.connections
  ADD CONSTRAINT connections_receiver_id_fkey
  FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── NOTIFICATIONS ───────────────────────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── STORIES ─────────────────────────────────────────────────────────────────
ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_user_id_fkey;
ALTER TABLE public.stories
  ADD CONSTRAINT stories_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── STORY VIEWS ─────────────────────────────────────────────────────────────
ALTER TABLE public.story_views DROP CONSTRAINT IF EXISTS story_views_user_id_fkey;
ALTER TABLE public.story_views
  ADD CONSTRAINT story_views_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── MESSAGES / CONVERSATIONS ────────────────────────────────────────────────
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- conversation_participants (may be named differently)
ALTER TABLE public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_user_id_fkey;
ALTER TABLE public.conversation_participants
  ADD CONSTRAINT conversation_participants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── USER BLOCKS ──────────────────────────────────────────────────────────────
ALTER TABLE public.user_blocks DROP CONSTRAINT IF EXISTS user_blocks_blocker_id_fkey;
ALTER TABLE public.user_blocks DROP CONSTRAINT IF EXISTS user_blocks_blocked_id_fkey;
ALTER TABLE public.user_blocks
  ADD CONSTRAINT user_blocks_blocker_id_fkey
  FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_blocks
  ADD CONSTRAINT user_blocks_blocked_id_fkey
  FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── REPORTS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_by_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_user_id_fkey;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── COMPANY PAGE ADMINS ──────────────────────────────────────────────────────
ALTER TABLE public.company_page_admins DROP CONSTRAINT IF EXISTS company_page_admins_user_id_fkey;
ALTER TABLE public.company_page_admins
  ADD CONSTRAINT company_page_admins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── OPPORTUNITIES ────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_created_by_fkey;
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── OPPORTUNITY APPLICATIONS ─────────────────────────────────────────────────
ALTER TABLE public.opportunity_applications DROP CONSTRAINT IF EXISTS opportunity_applications_applicant_id_fkey;
ALTER TABLE public.opportunity_applications
  ADD CONSTRAINT opportunity_applications_applicant_id_fkey
  FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── EVENT ATTENDEES ──────────────────────────────────────────────────────────
ALTER TABLE public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_user_id_fkey;
ALTER TABLE public.event_attendees
  ADD CONSTRAINT event_attendees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── CERTIFICATION REQUESTS ───────────────────────────────────────────────────
ALTER TABLE public.certification_requests DROP CONSTRAINT IF EXISTS certification_requests_user_id_fkey;
ALTER TABLE public.certification_requests
  ADD CONSTRAINT certification_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Reload PostgREST schema cache so it picks up the new FK relationships
NOTIFY pgrst, 'reload schema';
