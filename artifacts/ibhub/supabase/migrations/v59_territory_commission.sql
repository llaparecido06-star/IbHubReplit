-- v59: Add commission_pct to partner_territories
-- Separates the sócio's territory commission from profiles.commission_override
-- (which is now exclusively for national representatives)

ALTER TABLE partner_territories
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2) DEFAULT NULL;

COMMENT ON COLUMN partner_territories.commission_pct IS
  'Commission % for the territory partner (sócio). NULL = auto tier (10/15/20% based on user count). Separate from profiles.commission_override which belongs to national representantes.';
