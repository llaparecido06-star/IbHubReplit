-- Migration v83: Email system (welcome email + weekly digest + Brevo contact sync)
--
-- NOTE: supabase/schema.sql has not been kept in sync since v80, so this
-- migration is NOT mirrored there. Apply this file directly against the
-- Supabase database (SQL Editor), the same way v77-v82 were applied.
--
-- Run this once, manually, in the Supabase SQL Editor.

-- Track welcome-email + Brevo contact-sync state per user.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS brevo_contact_synced_at timestamptz;

-- Weekly-digest emails move from opt-in to opt-out: every user is enrolled
-- by default going forward, with a one-click unsubscribe link in every
-- digest email. Existing users who never touched "Notificações por e-mail"
-- in Minha Conta (still at the old opt-in default of false) are switched on
-- as part of this rollout. Anyone can opt back out via the unsubscribe link
-- or the toggle in Minha Conta.
ALTER TABLE public.profiles
  ALTER COLUMN notif_email SET DEFAULT true;

UPDATE public.profiles
  SET notif_email = true
  WHERE notif_email IS DISTINCT FROM true;

-- auth.users is not exposed via PostgREST, so the welcome-email sweep needs
-- a SECURITY DEFINER function to find confirmed users who haven't been
-- welcomed yet. Restricted to service_role only.
CREATE OR REPLACE FUNCTION public.get_welcome_pending(p_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  username text,
  plan text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, u.email, p.full_name, p.username, p.plan, p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email_confirmed_at IS NOT NULL
    AND p.welcome_email_sent_at IS NULL
    AND u.email IS NOT NULL
  ORDER BY u.email_confirmed_at ASC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_welcome_pending(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_welcome_pending(int) TO service_role;

-- Weekly digest recipients: confirmed, opted in (notif_email), not banned.
-- Also surfaces brevo_contact_synced_at so the digest job can piggyback
-- contact-sync for anyone who was never synced (e.g. signed up before this
-- migration).
CREATE OR REPLACE FUNCTION public.get_digest_recipients()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  username text,
  plan text,
  created_at timestamptz,
  brevo_contact_synced_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, u.email, p.full_name, p.username, p.plan, p.created_at, p.brevo_contact_synced_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email_confirmed_at IS NOT NULL
    AND p.notif_email IS TRUE
    AND COALESCE(p.is_banned, false) = false
    AND u.email IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_digest_recipients() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_digest_recipients() TO service_role;
