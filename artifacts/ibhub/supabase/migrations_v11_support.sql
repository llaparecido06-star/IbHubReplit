-- Run this in Supabase SQL Editor
-- Migration v11: Support tables for Fale Conosco and Reportar Bug

create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  subject     text not null,
  category    text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);

alter table public.support_messages enable row level security;

create policy "Users can insert their own support messages"
  on public.support_messages for insert
  with check (auth.uid() = user_id);

create policy "Users can read their own support messages"
  on public.support_messages for select
  using (auth.uid() = user_id);

create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  title       text not null,
  description text not null,
  severity    text not null,
  steps       text,
  created_at  timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

create policy "Users can insert their own bug reports"
  on public.bug_reports for insert
  with check (auth.uid() = user_id);

create policy "Users can read their own bug reports"
  on public.bug_reports for select
  using (auth.uid() = user_id);
