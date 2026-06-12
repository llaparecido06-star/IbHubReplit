-- v78: store display prices for annual plan options so the Plan Builder
-- can show them to users without requiring a Stripe API call.
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS price_cents_annual_onetime    integer,
  ADD COLUMN IF NOT EXISTS price_cents_annual_recurring  integer;

COMMENT ON COLUMN plans.price_cents_annual_onetime   IS 'Full annual one-time price in BRL centavos (display/UI use). Set alongside stripe_price_id_annual_onetime.';
COMMENT ON COLUMN plans.price_cents_annual_recurring  IS 'Monthly recurring price (with annual commitment) in BRL centavos (display/UI use). Set alongside stripe_price_id_annual_recurring.';
