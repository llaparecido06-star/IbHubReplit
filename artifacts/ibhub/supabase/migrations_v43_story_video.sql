-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v43: Story Video + Repost Support
-- Adiciona video_url na tabela stories (suporte a vídeos nos Momentos)
-- Execute no Supabase SQL Editor (dashboard.supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS video_url TEXT;
