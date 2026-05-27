-- Migration v48: add can_post_market flag to company_pages
-- Allows specific companies to publish posts in the Mercado > Feed section.

ALTER TABLE public.company_pages
  ADD COLUMN IF NOT EXISTS can_post_market boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_company_pages_can_post_market
  ON public.company_pages (can_post_market)
  WHERE can_post_market = true;
