-- ibhub — Migração v5b
-- Adiciona colunas faltantes no chat.
-- Execute no SQL Editor do Supabase (pode rodar mais de uma vez com segurança).

-- 1. Colunas faltantes em conversations
alter table public.conversations
  add column if not exists is_group boolean not null default false,
  add column if not exists name text;

-- 2. Colunas de mídia em messages
alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_url text;

-- 3. Garante retrocompatibilidade em linhas existentes
update public.messages
  set message_type = 'text'
  where message_type is null;
