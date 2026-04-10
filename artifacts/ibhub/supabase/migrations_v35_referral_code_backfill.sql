-- Migration v35: Backfill referral_code for existing users that don't have one
-- Each code is deterministic: 'IB' + first 8 chars of UUID (without hyphens, uppercase)
-- Run this in the Supabase SQL editor.

UPDATE public.profiles
SET referral_code = 'IB' || upper(substring(replace(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- Verify: show count of profiles still missing a code (should be 0)
SELECT COUNT(*) AS profiles_without_referral_code
FROM public.profiles
WHERE referral_code IS NULL;
