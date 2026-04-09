-- Migration v17: Add invited_by_id to profiles for referral tracking
-- Run this in the Supabase SQL editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_by_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.invited_by_id IS
  'The user who invited this person via a referral code (set at registration).';

-- Optional index to speed up leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_invited_by_id ON public.profiles(invited_by_id);

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profiles'
  AND column_name  = 'invited_by_id';
