-- Migration: credit_packages table
-- Run this in the Supabase SQL editor (Settings → SQL Editor)
-- to enable one-time (avulso) AI credit purchases.

CREATE TABLE IF NOT EXISTS credit_packages (
  id                text         PRIMARY KEY,
  label             text         NOT NULL,
  ai_credits        integer      NOT NULL DEFAULT 0,
  revelation_credits integer     NOT NULL DEFAULT 0,
  price_brl         integer      NOT NULL,   -- in centavos, e.g. 10000 = R$100,00
  stripe_price_id   text,                    -- optional, for pre-created Stripe Prices
  active            boolean      NOT NULL DEFAULT true,
  sort_order        integer      NOT NULL DEFAULT 0,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

-- Seed the six initial packages
INSERT INTO credit_packages (id, label, ai_credits, revelation_credits, price_brl, sort_order)
VALUES
  ('iniciante',     'Pacote Iniciante',     5,  0,  10000, 1),
  ('basico',        'Pacote Básico',        10, 2,  30000, 2),
  ('intermediario', 'Pacote Intermediário', 20, 4,  57500, 3),
  ('avancado',      'Pacote Avançado',      30, 6,  82500, 4),
  ('profissional',  'Pacote Profissional',  40, 8, 105500, 5),
  ('elite',         'Pacote Elite',         50, 10,120000, 6)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can read active packages (for pricing display)
DROP POLICY IF EXISTS "Public can read active credit packages" ON credit_packages;
CREATE POLICY "Public can read active credit packages"
  ON credit_packages FOR SELECT
  USING (active = true);
