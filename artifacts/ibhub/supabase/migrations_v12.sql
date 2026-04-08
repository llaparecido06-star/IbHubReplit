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
