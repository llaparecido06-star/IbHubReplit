-- v80: Add cover_url to profiles
-- Allows users to set a banner/cover photo on their personal profile page.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text;
