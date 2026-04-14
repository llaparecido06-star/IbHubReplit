-- ============================================================
-- Ideal.BI Market Feed v2 — vídeo, enquetes e permissão no plan builder
-- Execute no Supabase SQL Editor DEPOIS de migration_market_feed.sql
-- ============================================================

-- 1. Adicionar colunas de mídia e enquete em market_posts
ALTER TABLE market_posts
  ADD COLUMN IF NOT EXISTS video_url     TEXT,
  ADD COLUMN IF NOT EXISTS poll_options  JSONB;
-- poll_options: [{id: string, text: string, votes_count: integer}]

-- 2. Tabela de votos de enquete (1 voto por user por post)
CREATE TABLE IF NOT EXISTS market_post_poll_votes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES market_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE market_post_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poll_votes_select"
  ON market_post_poll_votes FOR SELECT
  USING (true);

CREATE POLICY "poll_votes_insert"
  ON market_post_poll_votes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "poll_votes_delete"
  ON market_post_poll_votes FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS market_post_poll_votes_post_id_idx ON market_post_poll_votes(post_id);
CREATE INDEX IF NOT EXISTS market_post_poll_votes_user_id_idx ON market_post_poll_votes(user_id);

-- 3. Inserir permissão mercado:idealbi no plan builder
-- (idempotente — ignora se já existir)
INSERT INTO market_permissions (id, title, icon, sort_order, section_type)
VALUES ('idealbi', 'Feed Ideal.BI', 'radio', 99, 'feed')
ON CONFLICT (id) DO NOTHING;

-- 4. Liberar acesso ao Ideal.BI para planos pagos (premium, exclusivo, business)
-- Adapte os IDs dos planos conforme os planos criados no Plan Builder
-- Exemplos: premium, exclusivo, business, profissional, empresa, executivo
-- Esta query adiciona mercado:idealbi ao array de features dos planos não-gratuitos
UPDATE plans
SET features = array_append(features, 'mercado:idealbi')
WHERE id != 'gratuito'
  AND NOT (features @> ARRAY['mercado:idealbi']);
