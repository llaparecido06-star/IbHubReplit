-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v43 — Stripe subscription columns on profiles
-- Run in Supabase SQL Editor: dashboard.supabase.com → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Add Stripe columns to profiles (safe: ADD COLUMN IF NOT EXISTS)
alter table public.profiles
  add column if not exists stripe_customer_id      text unique,
  add column if not exists stripe_subscription_id  text,
  add column if not exists stripe_subscription_status text
    check (stripe_subscription_status in ('active','trialing','past_due','canceled','incomplete','incomplete_expired','unpaid') or stripe_subscription_status is null),
  add column if not exists stripe_current_period_end timestamptz;

-- Index for webhook lookups by customer_id
create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Index for admin dashboards filtering by subscription status
create index if not exists profiles_stripe_status_idx
  on public.profiles (stripe_subscription_status)
  where stripe_subscription_status is not null;

-- ─── Helper function: is_plan_active(profile_row) ────────────────────────────
-- Returns true if the user has an active paid plan via Stripe OR a courtesy grant.
create or replace function public.is_plan_active(p public.profiles)
returns boolean
language sql stable
as $$
  select (
    -- Active Stripe subscription
    p.stripe_subscription_status in ('active', 'trialing')
    or
    -- Manual courtesy grant that has not expired
    (p.courtesy_until is not null and p.courtesy_until > now())
  )
$$;
