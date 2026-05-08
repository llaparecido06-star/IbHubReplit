-- ═══════════════════════════════════════════════════════════════════
-- Remove colunas financeiras de bi_exportadores
-- Os dados financeiros agora ficam em bi_exportadores_financeiro
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE bi_exportadores
  DROP COLUMN IF EXISTS fob_usd,
  DROP COLUMN IF EXISTS cx9l,
  DROP COLUMN IF EXISTS usd_por_cx9l;
