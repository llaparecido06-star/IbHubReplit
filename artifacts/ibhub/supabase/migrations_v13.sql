-- ibhub — Migração v13: push_notification_logs e feature_flags
-- Execute no Supabase Dashboard → SQL Editor.

-- ─── PUSH NOTIFICATION LOGS ──────────────────────────────────────────────────
create table if not exists public.push_notification_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  titulo      text not null,
  mensagem    text not null,
  segmento    text not null default 'Todos os usuários',
  deep_link   text,
  sent_by     uuid references auth.users(id) on delete set null
);

alter table public.push_notification_logs enable row level security;

-- Admins podem inserir e ler; usuários comuns não têm acesso
drop policy if exists "pnl_select_admin" on public.push_notification_logs;
create policy "pnl_select_admin" on public.push_notification_logs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "pnl_insert_admin" on public.push_notification_logs;
create policy "pnl_insert_admin" on public.push_notification_logs for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ─── FEATURE FLAGS ────────────────────────────────────────────────────────────
create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

alter table public.feature_flags enable row level security;

-- Qualquer usuário autenticado pode ler (app usa para checar modo manutenção, etc.)
drop policy if exists "ff_select_all" on public.feature_flags;
create policy "ff_select_all" on public.feature_flags for select
  using (auth.uid() is not null);

-- Apenas admins podem inserir ou atualizar
drop policy if exists "ff_insert_admin" on public.feature_flags;
create policy "ff_insert_admin" on public.feature_flags for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "ff_update_admin" on public.feature_flags;
create policy "ff_update_admin" on public.feature_flags for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ─── VALORES INICIAIS DOS FEATURE FLAGS ──────────────────────────────────────
insert into public.feature_flags (key, enabled)
values
  ('enquetes',   true),
  ('stories',    true),
  ('manutencao', false)
on conflict (key) do nothing;
