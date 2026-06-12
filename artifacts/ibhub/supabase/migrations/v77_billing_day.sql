-- v77: store the billing anchor day (day-of-month) per user so that
-- AI and reveal credits reset on the actual subscription anniversary,
-- not hardcoded to the 1st of every month.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS billing_day integer;

COMMENT ON COLUMN profiles.billing_day IS
  'Day-of-month when the Stripe subscription renews (1–31). NULL for free users (resets on the 1st).';
