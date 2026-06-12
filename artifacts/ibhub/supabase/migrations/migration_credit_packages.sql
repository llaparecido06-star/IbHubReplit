-- Migration: credit_packages + credit_purchase_log tables
-- Run this in the Supabase SQL editor (Settings → SQL Editor)
-- to enable one-time (avulso) AI credit purchases.
-- Both tables must be created for the feature to work correctly.

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

-- Enable Row Level Security on credit_packages
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can read active packages (for pricing display)
DROP POLICY IF EXISTS "Public can read active credit packages" ON credit_packages;
CREATE POLICY "Public can read active credit packages"
  ON credit_packages FOR SELECT
  USING (active = true);

-- ─── credit_purchase_log ───────────────────────────────────────────────────────
-- Stores processed Stripe checkout session IDs to prevent double-crediting
-- when Stripe retries webhook delivery.
CREATE TABLE IF NOT EXISTS credit_purchase_log (
  id                   bigserial    PRIMARY KEY,
  checkout_session_id  text         NOT NULL UNIQUE,   -- Stripe cs_xxx id
  user_id              uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credited_at          timestamptz  NOT NULL DEFAULT now()
);

-- Only service role (server) should write; no client access needed
ALTER TABLE credit_purchase_log ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policies: only the service-role key (used in the API server)
-- can access this table — client-side users have no access.
