-- ═══════════════════════════════════════════════════════════════════════════
-- ibhub — Migração v48: Campos extras em eventos + RLS de event_attendees
-- Execute no Supabase: Dashboard → SQL Editor → New Query
-- Seguro rodar múltiplas vezes (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Novos campos na tabela events ────────────────────────────────────────

-- Link para eventos Online (Zoom, Meet, etc.) — visível só para confirmados
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS link text;

-- URL da imagem de capa do evento
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS image_url text;

-- Cargos restritos (array de strings) — quando visibility = 'restrito'
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS restricted_positions text[] DEFAULT '{}';

-- ─── 2. RLS para event_attendees ─────────────────────────────────────────────
-- Garante que usuários autenticados possam confirmar presença e ver participantes

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "event_attendees_select" ON public.event_attendees
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "event_attendees_insert" ON public.event_attendees
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "event_attendees_update" ON public.event_attendees
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "event_attendees_delete" ON public.event_attendees
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Storage bucket para capas de eventos ──────────────────────────────────
-- Reusa o bucket post-images (já existente e público). Caminho: events/{userId}/{timestamp}.jpg
-- Se preferir bucket próprio, descomentar:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('event-images', 'event-images', true)
--   ON CONFLICT DO NOTHING;

-- ─── Verify ───────────────────────────────────────────────────────────────────
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'events' AND column_name IN ('link','image_url','restricted_positions')
ORDER BY ordinal_position;
