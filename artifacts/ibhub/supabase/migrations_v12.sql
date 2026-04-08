-- ibhub — Migração v12: Feed Engagement Improvements + Company Products & Follows
-- Execute no Supabase Dashboard → SQL Editor.

-- ─── 1. Novas colunas em posts ────────────────────────────────────────────────

alter table public.posts
  add column if not exists image_urls  text[]    default null,
  add column if not exists view_count  int       not null default 0,
  add column if not exists location    text      default null;

-- ─── 2. Nova coluna em likes (tipo de reação) ─────────────────────────────────

alter table public.likes
  add column if not exists reaction_type text default null;

alter table public.likes
  drop constraint if exists likes_reaction_type_check;

alter table public.likes
  add constraint likes_reaction_type_check
  check (reaction_type is null or reaction_type in ('saude', 'bravo', 'destaque', 'incrivel'));

-- ─── 3. Função RPC: increment_view_count ─────────────────────────────────────

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

revoke all on function public.increment_view_count(uuid) from public;
grant execute on function public.increment_view_count(uuid) to authenticated;

-- ─── 4. Índice em view_count ──────────────────────────────────────────────────
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

drop policy if exists "presentations_select" on public.market_presentations;
create policy "presentations_select" on public.market_presentations
  for select using (
    published = true
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "presentations_insert_admin" on public.market_presentations;
create policy "presentations_insert_admin" on public.market_presentations
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "presentations_update_admin" on public.market_presentations;
create policy "presentations_update_admin" on public.market_presentations
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "presentations_delete_admin" on public.market_presentations;
create policy "presentations_delete_admin" on public.market_presentations
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ─── 7. Tabela company_products (task-19: Perfil e Empresa) ──────────────────

create table if not exists public.company_products (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.company_pages(id) on delete cascade,
  name        text not null,
  description text,
  price       text,
  category    text not null default 'produto',
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists company_products_company_id_idx on public.company_products(company_id);

alter table public.company_products enable row level security;

drop policy if exists "company_products_select" on public.company_products;
create policy "company_products_select" on public.company_products
  for select using (true);

drop policy if exists "company_products_insert" on public.company_products;
create policy "company_products_insert" on public.company_products
  for insert with check (
    exists (
      select 1 from public.company_pages
      where id = company_id and owner_id = auth.uid()
    )
  );

drop policy if exists "company_products_update" on public.company_products;
create policy "company_products_update" on public.company_products
  for update using (
    exists (
      select 1 from public.company_pages
      where id = company_id and owner_id = auth.uid()
    )
  );

drop policy if exists "company_products_delete" on public.company_products;
create policy "company_products_delete" on public.company_products
  for delete using (
    exists (
      select 1 from public.company_pages
      where id = company_id and owner_id = auth.uid()
    )
  );

-- ─── 8. Tabela company_follows (task-19: Perfil e Empresa) ───────────────────

create table if not exists public.company_follows (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.company_pages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_follows_company_id_idx on public.company_follows(company_id);
create index if not exists company_follows_user_id_idx on public.company_follows(user_id);

alter table public.company_follows enable row level security;

drop policy if exists "company_follows_select" on public.company_follows;
create policy "company_follows_select" on public.company_follows
  for select using (true);

drop policy if exists "company_follows_insert" on public.company_follows;
create policy "company_follows_insert" on public.company_follows
  for insert with check (auth.uid() = user_id);

drop policy if exists "company_follows_delete" on public.company_follows;
create policy "company_follows_delete" on public.company_follows
  for delete using (auth.uid() = user_id);

-- Nota: os posts da empresa são identificados pelo user_id do owner da company_page
-- (não é necessário company_id em posts para a funcionalidade atual)
