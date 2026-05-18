-- v70: add periods (per-period visibility) and font_size to market_permissions

ALTER TABLE market_permissions
  ADD COLUMN IF NOT EXISTS periods  text[]  DEFAULT ARRAY['mes','trimestre','ano'],
  ADD COLUMN IF NOT EXISTS font_size integer DEFAULT 14;

UPDATE market_permissions
   SET periods = ARRAY['mes','trimestre','ano']
 WHERE periods IS NULL;

UPDATE market_permissions
   SET font_size = 14
 WHERE font_size IS NULL;
