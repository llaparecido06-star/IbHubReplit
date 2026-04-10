-- Migration v42: Ensure referral columns exist in profiles
-- Safe to run even if columns already exist (uses IF NOT EXISTS / DO NOTHING).
-- Run this in the Supabase SQL Editor.

-- 1. Add referral_code column (unique code assigned to every user, auto-generated on registration)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

-- Unique constraint so we can look up inviters by code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_referral_code_unique'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referral_code_unique UNIQUE (referral_code);
  END IF;
END $$;

-- 2. Add invited_by_id column (set when a new user registers using someone else's referral code)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Back-fill referral codes for any users that don't have one yet
--    Format: "IB" + first 8 chars of UUID (uppercased, no hyphens)
UPDATE public.profiles
SET referral_code = 'IB' || UPPER(REPLACE(id::text, '-', ''))::text
WHERE referral_code IS NULL;

-- 4. RLS — profiles must allow:
--    a) Any authenticated user to SELECT profiles (to look up inviter by referral_code)
--    b) Users to UPDATE their own profile (to set invited_by_id on themselves)
--    Both of these are almost certainly already in your policies.
--    The statements below are safe no-ops if the policies already exist.

DO $$
BEGIN
  -- Allow any authenticated user to read all profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_select_authenticated'
  ) THEN
    CREATE POLICY "profiles_select_authenticated" ON public.profiles
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  -- Allow users to update their own profile row
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;
