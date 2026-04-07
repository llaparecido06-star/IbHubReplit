-- ═══════════════════════════════════════════════════════════════════════════
-- ibhub — Migração v2: comment_likes, wine_cellar, company_pages, storage
-- Execute no Supabase: Dashboard → SQL Editor → New Query
-- É seguro rodar múltiplas vezes (IF NOT EXISTS / OR REPLACE)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── COMMENT_LIKES ───────────────────────────────────────────────────────────
create table if not exists public.comment_likes (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint comment_likes_unique unique (comment_id, user_id)
);
create index if not exists idx_comment_likes_comment on public.comment_likes (comment_id);
alter table public.comment_likes enable row level security;
create policy "cl_select" on public.comment_likes for select using (true);
create policy "cl_insert" on public.comment_likes for insert with check (auth.uid() = user_id);
create policy "cl_delete" on public.comment_likes for delete using (auth.uid() = user_id);


-- ─── WINE_CELLAR ─────────────────────────────────────────────────────────────
create table if not exists public.wine_cellar (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  producer    text,
  vintage     text,
  region      text,
  country     text,
  grape       text,
  qty         int not null default 1,
  price       numeric(10,2),
  buy_date    date,
  drink_by    date,
  storage     text,
  notes       text,
  rating      int default 0 check (rating >= 0 and rating <= 5),
  status      text not null default 'adega'
              check (status in ('adega','consumido','presenteado','wishlist')),
  is_private  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_wine_cellar_user on public.wine_cellar (user_id);
alter table public.wine_cellar enable row level security;
-- Dono vê tudo; outros só veem entradas públicas
create policy "wc_select_own"    on public.wine_cellar for select using (auth.uid() = user_id);
create policy "wc_select_public" on public.wine_cellar for select using (is_private = false);
create policy "wc_insert"        on public.wine_cellar for insert with check (auth.uid() = user_id);
create policy "wc_update"        on public.wine_cellar for update using (auth.uid() = user_id);
create policy "wc_delete"        on public.wine_cellar for delete using (auth.uid() = user_id);

-- Trigger: updated_at automático
create or replace function public.set_wine_cellar_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end;
$$;
drop trigger if exists wine_cellar_updated_at on public.wine_cellar;
create trigger wine_cellar_updated_at
  before update on public.wine_cellar
  for each row execute function public.set_wine_cellar_updated_at();


-- ─── COMPANY_PAGES ───────────────────────────────────────────────────────────
create table if not exists public.company_pages (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  username    text unique,
  avatar_url  text,
  bio         text,
  website     text,
  industry    text,
  location    text,
  plan        text not null default 'gratuito',
  created_at  timestamptz not null default now()
);
create index if not exists idx_company_pages_owner on public.company_pages (owner_id);
alter table public.company_pages enable row level security;
create policy "cp_select"        on public.company_pages for select using (true);
create policy "cp_insert"        on public.company_pages for insert with check (auth.uid() = owner_id);
create policy "cp_update"        on public.company_pages for update using (auth.uid() = owner_id);
create policy "cp_delete"        on public.company_pages for delete using (auth.uid() = owner_id);

-- Admins adicionais (futuro)
create table if not exists public.company_page_admins (
  company_id  uuid not null references public.company_pages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'admin',
  primary key (company_id, user_id)
);
alter table public.company_page_admins enable row level security;
create policy "cpa_select" on public.company_page_admins for select
  using (auth.uid() = user_id or exists (
    select 1 from public.company_pages p where p.id = company_id and p.owner_id = auth.uid()
  ));
create policy "cpa_insert" on public.company_page_admins for insert
  with check (exists (
    select 1 from public.company_pages p where p.id = company_id and p.owner_id = auth.uid()
  ));
create policy "cpa_delete" on public.company_page_admins for delete
  using (auth.uid() = user_id or exists (
    select 1 from public.company_pages p where p.id = company_id and p.owner_id = auth.uid()
  ));


-- ─── STORAGE: bucket post-images ─────────────────────────────────────────────
-- Cria o bucket público para imagens de posts (seguro rodar múltiplas vezes)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,  -- 5 MB
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Qualquer usuário autenticado pode fazer upload na pasta própria
create policy "post_images_insert" on storage.objects for insert
  with check (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Leitura pública
create policy "post_images_select" on storage.objects for select
  using (bucket_id = 'post-images');

-- Dono pode deletar
create policy "post_images_delete" on storage.objects for delete
  using (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─── CORREÇÃO: profiles — garantir colunas position/company/areas existem ────
alter table public.profiles add column if not exists position      text;
alter table public.profiles add column if not exists company       text;
alter table public.profiles add column if not exists areas         text[] default '{}';
alter table public.profiles add column if not exists profile_type  text default 'pessoa';
alter table public.profiles add column if not exists user_id       uuid references auth.users(id);
-- Garante que followers_count/following_count/connections_count existem
alter table public.profiles add column if not exists followers_count   int not null default 0;
alter table public.profiles add column if not exists following_count   int not null default 0;
alter table public.profiles add column if not exists connections_count int not null default 0;
-- Re-cria triggers de contagem (idempotente)
create or replace function public.update_follow_counts()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set following_count  = following_count  + 1 where id = NEW.follower_id;
    update public.profiles set followers_count  = followers_count  + 1 where id = NEW.following_id;
  elsif TG_OP = 'DELETE' then
    update public.profiles set following_count  = greatest(0, following_count  - 1) where id = OLD.follower_id;
    update public.profiles set followers_count  = greatest(0, followers_count  - 1) where id = OLD.following_id;
  end if;
  return null;
end;
$$;
drop trigger if exists follow_count_trigger on public.follows;
create trigger follow_count_trigger
  after insert or delete on public.follows
  for each row execute function public.update_follow_counts();

create or replace function public.update_connections_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and NEW.status = 'accepted' and OLD.status != 'accepted' then
    update public.profiles set connections_count = connections_count + 1 where id = NEW.requester_id;
    update public.profiles set connections_count = connections_count + 1 where id = NEW.receiver_id;
  elsif TG_OP = 'DELETE' and OLD.status = 'accepted' then
    update public.profiles set connections_count = greatest(0, connections_count - 1) where id = OLD.requester_id;
    update public.profiles set connections_count = greatest(0, connections_count - 1) where id = OLD.receiver_id;
  end if;
  return NEW;
end;
$$;
drop trigger if exists connections_count_trigger on public.connections;
create trigger connections_count_trigger
  after update or delete on public.connections
  for each row execute function public.update_connections_count();
