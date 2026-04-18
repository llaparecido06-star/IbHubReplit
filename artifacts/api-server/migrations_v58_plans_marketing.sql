-- v58: Marketing fields for plans table
-- Adds 'description' (long-form marketing copy) and 'original_price_cents' (De: price)
-- to enable crossed-out pricing and discount percentage display on subscription screens.

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS original_price_cents INTEGER;

COMMENT ON COLUMN plans.description IS 'Long-form marketing description shown on subscription/registration screens';
COMMENT ON COLUMN plans.original_price_cents IS 'Original (crossed-out) price in cents for "De: X Por: Y" marketing display. NULL means no discount shown.';
