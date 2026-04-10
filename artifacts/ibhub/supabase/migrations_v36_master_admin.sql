-- Migration v36: Grant admin access to the master user
-- Sets is_admin = true for lucasla025@gmail.com
-- Run this in the Supabase SQL Editor.

UPDATE public.profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'lucasla025@gmail.com' LIMIT 1
);

-- Verify
SELECT p.id, p.full_name, p.is_admin, u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'lucasla025@gmail.com';
