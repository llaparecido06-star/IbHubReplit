-- Migration v41: push_tokens table + push_notification_logs enhancements
-- Run this in the Supabase SQL Editor

-- 1. Push tokens table (stores Expo push tokens per user/device)
create table if not exists public.push_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  token         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint push_tokens_user_token_unique unique (user_id, token)
);

-- RLS for push_tokens
alter table public.push_tokens enable row level security;

-- Users can manage their own tokens
create policy "push_tokens_own_select" on public.push_tokens
  for select using (auth.uid() = user_id);

create policy "push_tokens_own_insert" on public.push_tokens
  for insert with check (auth.uid() = user_id);

create policy "push_tokens_own_delete" on public.push_tokens
  for delete using (auth.uid() = user_id);

-- Service role can read all tokens (for admin broadcast)
create policy "push_tokens_service_read" on public.push_tokens
  for select using (true);

-- 2. Enhance push_notification_logs table
alter table public.push_notification_logs
  add column if not exists sent_at timestamptz,
  add column if not exists recipients_count integer default 0;

-- 3. push_notification_logs RLS (allow admin to insert/read)
alter table public.push_notification_logs enable row level security;

create policy "push_logs_admin_all" on public.push_notification_logs
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
