-- ═══════════════════════════════════════════════════════════════════
-- bi_exportadores_financeiro — totais financeiros por exportador
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════

-- Tabela separada de dados financeiros (fonte: planilha Ideal.BI)
-- Uma linha por exportador — valores já consolidados na fonte, sem agregação.
CREATE TABLE IF NOT EXISTS bi_exportadores_financeiro (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  fob_usd       NUMERIC(15,2),
  cx9l          NUMERIC(12,2),
  usd_por_cx9l  NUMERIC(10,2),
  periodo       TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS bi_exp_fin_name_idx ON bi_exportadores_financeiro (name);

-- Habilita RLS (apenas service role e admins leem diretamente)
ALTER TABLE bi_exportadores_financeiro ENABLE ROW LEVEL SECURITY;

-- Permite ao service role fazer tudo (API usa service role key)
CREATE POLICY "service_role_all" ON bi_exportadores_financeiro
  FOR ALL TO service_role USING (true) WITH CHECK (true);
