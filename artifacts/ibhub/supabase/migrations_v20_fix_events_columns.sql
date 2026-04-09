-- ── migrations_v20_fix_events_columns: Corrigir colunas faltantes em events ──
-- Adiciona colunas obrigatórias ausentes na tabela public.events.
-- Causa: erro em runtime "column events.start_date does not exist" que
--        quebrava completamente a tela de listagem de eventos.
-- Como aplicar: Supabase Dashboard → SQL Editor → cole e execute este script.

alter table public.events
  add column if not exists start_date    timestamptz,
  add column if not exists end_date      timestamptz,
  add column if not exists title         text,
  add column if not exists description   text,
  add column if not exists location_type text,
  add column if not exists entry_type    text,
  add column if not exists capacity      int;
