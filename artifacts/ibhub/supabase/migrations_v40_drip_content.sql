-- ibhub — Migração v40: Drip Content com slides seguros (task-41)
-- Execute no Supabase Dashboard → SQL Editor.
-- NOTA: O bucket 'presentation-slides' deve ser criado antes desta migração
-- via Dashboard → Storage → New bucket (name: presentation-slides, public: false).

-- ─── 1. Coluna delivery_strategy em plans ────────────────────────────────────
alter table public.plans
  add column if not exists delivery_strategy text not null default 'NONE'
  check (delivery_strategy in ('RANDOM_DAILY', 'SEQUENTIAL_MONTHLY', 'FULL_ACCESS', 'NONE'));

-- ─── 2. Tabela user_unlocked_slides ──────────────────────────────────────────
-- Criada ANTES de slides para que a policy de slides possa referenciar esta tabela.

create table if not exists public.user_unlocked_slides (
  user_id     uuid not null references auth.users(id) on delete cascade,
  slide_id    uuid not null,           -- FK para slides adicionada abaixo via ALTER
  unlocked_at timestamptz not null default now(),
  primary key (user_id, slide_id)
);

create index if not exists user_unlocked_slides_user_idx  on public.user_unlocked_slides(user_id);
create index if not exists user_unlocked_slides_slide_idx on public.user_unlocked_slides(slide_id);

alter table public.user_unlocked_slides enable row level security;

-- Usuários só veem os seus próprios registros de slides desbloqueados
drop policy if exists "user_unlocked_slides_select" on public.user_unlocked_slides;
create policy "user_unlocked_slides_select" on public.user_unlocked_slides for select
  using (auth.uid() = user_id);

-- Somente o service role (via API Server usando chave de service role) pode inserir.
-- O API Server usa supabaseAdmin (service role) que bypassa RLS inteiramente.
-- Nenhuma policy de INSERT é criada para clientes autenticados.

-- ─── 3. Tabela slides ─────────────────────────────────────────────────────────
-- Criada APÓS user_unlocked_slides para que a FK e a policy de select funcionem.

create table if not exists public.slides (
  id              uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.market_presentations(id) on delete cascade,
  storage_path    text not null,
  sequence_order  int  not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists slides_presentation_id_idx on public.slides(presentation_id);
create index if not exists slides_sequence_order_idx  on public.slides(presentation_id, sequence_order);

-- Adicionar FK de user_unlocked_slides.slide_id → slides.id (deferred até após criação)
alter table public.user_unlocked_slides
  drop constraint if exists user_unlocked_slides_slide_id_fkey;
alter table public.user_unlocked_slides
  add constraint user_unlocked_slides_slide_id_fkey
  foreign key (slide_id) references public.slides(id) on delete cascade;

alter table public.slides enable row level security;

-- Admins podem ler todos os slides; usuários autenticados só leem slides que desbloquearam
drop policy if exists "slides_select" on public.slides;
create policy "slides_select" on public.slides for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.user_unlocked_slides uis
      where uis.slide_id = slides.id
        and uis.user_id = auth.uid()
    )
  );

drop policy if exists "slides_insert_admin" on public.slides;
create policy "slides_insert_admin" on public.slides for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "slides_update_admin" on public.slides;
create policy "slides_update_admin" on public.slides for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "slides_delete_admin" on public.slides;
create policy "slides_delete_admin" on public.slides for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ─── 4. Bucket privado presentation-slides + Storage RLS ─────────────────────
-- Cria o bucket como privado (public = false) se ainda não existir.
insert into storage.buckets (id, name, public)
values ('presentation-slides', 'presentation-slides', false)
on conflict (id) do nothing;

-- Storage RLS — apenas admins podem ler/inserir/deletar objetos no bucket.
-- As Signed URLs geradas pelo API Server (service role) permitem acesso temporário
-- sem necessidade de policy de SELECT para o usuário final.

drop policy if exists "pslides_select_admin" on storage.objects;
create policy "pslides_select_admin" on storage.objects for select
  using (
    bucket_id = 'presentation-slides'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "pslides_insert_admin" on storage.objects;
create policy "pslides_insert_admin" on storage.objects for insert
  with check (
    bucket_id = 'presentation-slides'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "pslides_delete_admin" on storage.objects;
create policy "pslides_delete_admin" on storage.objects for delete
  using (
    bucket_id = 'presentation-slides'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
