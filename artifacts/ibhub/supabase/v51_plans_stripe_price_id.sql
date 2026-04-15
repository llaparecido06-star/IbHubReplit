-- v51: Add stripe_price_id column to plans table
-- Run this in Supabase SQL Editor

alter table public.plans
  add column if not exists stripe_price_id text default null;

comment on column public.plans.stripe_price_id is
  'Stripe Price ID (e.g. price_1AbCdEfGhIjKlMnO) for checkout. Leave blank for free plans.';
