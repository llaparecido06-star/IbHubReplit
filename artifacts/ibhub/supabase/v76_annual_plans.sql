-- v76: Annual plan support
-- Adds annual Stripe price IDs to plans table and annual entitlement fields to profiles.

-- Plans: annual price IDs (configured by admin via Plan Builder)
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_annual_onetime   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_annual_recurring TEXT;

-- Profiles: annual one-time purchase entitlement tracking
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS annual_plan            TEXT,
  ADD COLUMN IF NOT EXISTS annual_plan_expires_at TIMESTAMPTZ;
