-- ibhub — Migração v9: Campos adicionais no perfil
-- Execute no SQL Editor do Supabase (dashboard.supabase.com → SQL Editor).

-- ─── 1. Adiciona colunas ao perfil ────────────────────────────────────────────
alter table public.profiles
  add column if not exists website    text,
  add column if not exists linkedin   text,
  add column if not exists instagram  text,
  add column if not exists is_public  boolean not null default true;

-- ─── 2. Garante que a coluna position existe (pode não estar no schema base) ──
alter table public.profiles
  add column if not exists position   text,
  add column if not exists company    text;
