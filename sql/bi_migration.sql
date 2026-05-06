-- ═══════════════════════════════════════════════════════════════════
-- MIGRAÇÃO Ideal.BI — estrutura completa baseada na planilha
-- Execute no SQL Editor do Supabase (em ordem)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. bi_exportadores — nova estrutura ────────────────────────────────────
-- Remove colunas antigas (caso existam de versões anteriores)
ALTER TABLE bi_exportadores
  DROP COLUMN IF EXISTS pais_destino,
  DROP COLUMN IF EXISTS produtos,
  DROP COLUMN IF EXISTS caixas_exportadas,
  DROP COLUMN IF EXISTS valor_vendido_cents,
  DROP COLUMN IF EXISTS preco_medio_cents;

-- Adiciona colunas novas
ALTER TABLE bi_exportadores
  ADD COLUMN IF NOT EXISTS origem_exportador TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS distribuidor      TEXT,
  ADD COLUMN IF NOT EXISTS fob_usd           NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS cx9l              NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS usd_por_cx9l      NUMERIC(10,2);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS bi_exportadores_name_idx    ON bi_exportadores (name);
CREATE INDEX IF NOT EXISTS bi_exportadores_origem_idx  ON bi_exportadores (origem_exportador);
CREATE INDEX IF NOT EXISTS bi_exportadores_dist_idx    ON bi_exportadores (distribuidor);

-- ─── 2. bi_importadores — adicionar exportador ──────────────────────────────
ALTER TABLE bi_importadores
  ADD COLUMN IF NOT EXISTS exportador TEXT;

CREATE INDEX IF NOT EXISTS bi_importadores_exp_idx ON bi_importadores (exportador);

-- ─── 3. wine_imports — adicionar exportador + importador ────────────────────
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

-- ─── 4. bi_reveal_credits — saldo mensal de revelações ──────────────────────
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

-- ─── 5. bi_reveal_log — impede cobrança dupla no mesmo mês ──────────────────
-- ATENÇÃO: usa record_key TEXT (nome do exportador) — não UUID —
-- pois o reveal é agrupado por nome, não por linha individual.
CREATE TABLE IF NOT EXISTS bi_reveal_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL DEFAULT 'exportador',
  record_key  TEXT NOT NULL,
  revealed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, record_type, record_key)
);

CREATE INDEX IF NOT EXISTS bi_reveal_log_user_idx ON bi_reveal_log (user_id);
CREATE INDEX IF NOT EXISTS bi_reveal_log_key_idx  ON bi_reveal_log (record_type, record_key);

-- ─── 6. plans — coluna reveal_credits ───────────────────────────────────────
ALTER TABLE plans ADD COLUMN IF NOT EXISTS reveal_credits INTEGER NOT NULL DEFAULT 0;

-- ─── 7. profiles — override manual de créditos via CRM ─────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reveal_credits_override INTEGER;
