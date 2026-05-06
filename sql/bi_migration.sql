-- ═══════════════════════════════════════════════════════════════════
-- MIGRAÇÃO bi_exportadores — nova estrutura baseada na planilha
-- Execute no SQL Editor do Supabase (em ordem)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Adicionar novas colunas na bi_exportadores
ALTER TABLE bi_exportadores
  ADD COLUMN IF NOT EXISTS origem_exportador TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fob_usd           NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS cx9l              NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS usd_por_cx9l      NUMERIC(10,2);

-- 2. Remover colunas antigas (não correspondem à estrutura da planilha)
ALTER TABLE bi_exportadores
  DROP COLUMN IF EXISTS pais_destino,
  DROP COLUMN IF EXISTS produtos,
  DROP COLUMN IF EXISTS caixas_exportadas,
  DROP COLUMN IF EXISTS valor_vendido_cents,
  DROP COLUMN IF EXISTS preco_medio_cents;

-- 3. Índices para busca rápida
CREATE INDEX IF NOT EXISTS bi_exportadores_name_trgm_idx   ON bi_exportadores USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS bi_exportadores_origem_idx       ON bi_exportadores (origem_exportador);

-- ═══════════════════════════════════════════════════════════════════
-- ATUALIZAÇÃO wine_imports — adicionar exportador + importador
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE wine_imports
  ADD COLUMN IF NOT EXISTS exportador TEXT,
  ADD COLUMN IF NOT EXISTS importador TEXT;

-- Migrar distribuidor → importador onde não preenchido
UPDATE wine_imports
SET importador = distribuidor
WHERE importador IS NULL AND distribuidor IS NOT NULL AND distribuidor <> '';

CREATE INDEX IF NOT EXISTS wine_imports_exportador_idx ON wine_imports (exportador);
CREATE INDEX IF NOT EXISTS wine_imports_importador_idx ON wine_imports (importador);
CREATE INDEX IF NOT EXISTS wine_imports_marca_trgm_idx
  ON wine_imports USING gin(to_tsvector('simple', coalesce(marca_completa, '')));

-- ═══════════════════════════════════════════════════════════════════
-- NOVO: bi_reveal_credits — créditos mensais para revelar dados financeiros
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bi_reveal_credits (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  credits_total     INTEGER NOT NULL DEFAULT 0,
  period_start      DATE    NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS bi_reveal_credits_user_idx ON bi_reveal_credits (user_id);

-- ═══════════════════════════════════════════════════════════════════
-- NOVO: bi_reveal_log — log de revelações (evita cobrar 2x no mês)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bi_reveal_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL DEFAULT 'exportador',
  record_id   UUID NOT NULL,
  revealed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, record_type, record_id)
);

CREATE INDEX IF NOT EXISTS bi_reveal_log_user_idx   ON bi_reveal_log (user_id);
CREATE INDEX IF NOT EXISTS bi_reveal_log_record_idx ON bi_reveal_log (record_type, record_id);

-- ═══════════════════════════════════════════════════════════════════
-- ATUALIZAR plans: coluna reveal_credits (configurável no Plan Builder)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE plans ADD COLUMN IF NOT EXISTS reveal_credits INTEGER NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════
-- ATUALIZAR profiles: override manual de créditos via CRM
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reveal_credits_override INTEGER;
