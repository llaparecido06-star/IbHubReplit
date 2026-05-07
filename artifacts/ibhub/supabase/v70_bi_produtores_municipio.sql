-- ── v70: Adiciona coluna municipio em bi_produtores ──────────────────────────
-- Execute no SQL Editor do Supabase

ALTER TABLE bi_produtores
  ADD COLUMN IF NOT EXISTS municipio TEXT;

CREATE INDEX IF NOT EXISTS bi_produtores_municipio_idx ON bi_produtores (municipio);
