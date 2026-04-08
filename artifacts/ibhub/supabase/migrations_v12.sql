-- ibhub — Migração v12: Feed Engagement Improvements
-- Adds: posts.image_urls, posts.view_count, posts.location,
--        likes.reaction_type, increment_view_count RPC
-- Execute no Supabase Dashboard → SQL Editor.

-- ─── 1. Novas colunas em posts ────────────────────────────────────────────────

alter table public.posts
  add column if not exists image_urls  text[]    default null,
  add column if not exists view_count  int       not null default 0,
  add column if not exists location    text      default null;

-- ─── 2. Nova coluna em likes (tipo de reação) ─────────────────────────────────

alter table public.likes
  add column if not exists reaction_type text default null;

-- Restrição opcional: garante que apenas tipos válidos são armazenados
-- (solta se existir para recriá-la corretamente)
alter table public.likes
  drop constraint if exists likes_reaction_type_check;

alter table public.likes
  add constraint likes_reaction_type_check
  check (reaction_type is null or reaction_type in ('saude', 'bravo', 'destaque', 'incrivel'));

-- ─── 3. Função RPC: increment_view_count ─────────────────────────────────────
-- Incrementa view_count de forma segura (sem expor dados do post).
-- Chamada de qualquer usuário autenticado.

create or replace function public.increment_view_count(post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts
  set view_count = view_count + 1
  where id = post_id;
$$;

-- Garante que apenas usuários autenticados chamem a função
revoke all on function public.increment_view_count(uuid) from public;
grant execute on function public.increment_view_count(uuid) to authenticated;

-- ─── 4. Índice em view_count (opcional — melhora queries de ranking) ──────────
create index if not exists posts_view_count_idx on public.posts (view_count desc);

-- ─── 5. Tabela market_presentations (task-20: Mercado — Apresentações) ────────

create table if not exists public.market_presentations (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  cover_url   text,
  content_url text not null,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── 6. RLS para market_presentations ────────────────────────────────────────

alter table public.market_presentations enable row level security;

-- Utilizadores autenticados podem ler apresentações publicadas
drop policy if exists "presentations_select" on public.market_presentations;
create policy "presentations_select" on public.market_presentations
  for select using (
    published = true
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Apenas admins podem inserir
drop policy if exists "presentations_insert_admin" on public.market_presentations;
create policy "presentations_insert_admin" on public.market_presentations
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Apenas admins podem atualizar
drop policy if exists "presentations_update_admin" on public.market_presentations;
create policy "presentations_update_admin" on public.market_presentations
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Apenas admins podem deletar
drop policy if exists "presentations_delete_admin" on public.market_presentations;
create policy "presentations_delete_admin" on public.market_presentations
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
