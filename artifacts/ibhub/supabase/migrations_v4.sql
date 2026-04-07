-- ibhub — Migração v4: permissão de escrita admin em market_overview
-- Execute no Supabase Dashboard → SQL Editor.

-- 1. Garante que a coluna is_admin existe em profiles (já deve existir, mas idempotente)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2. Remove a política write=service_role (se existir) para não conflitar
drop policy if exists "Service role can manage market_overview" on public.market_overview;
drop policy if exists "Admins can upsert market_overview"       on public.market_overview;

-- 3. Política: admins autenticados podem inserir/atualizar/excluir market_overview
create policy "Admins can upsert market_overview"
  on public.market_overview
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- 4. Ativar o seu usuário como admin (substitua pelo e-mail real ou user_id)
-- OPÇÃO A — pelo e-mail:
-- update public.profiles
--   set is_admin = true
--   where user_id = (
--     select id from auth.users where email = 'seu@email.com'
--   );

-- OPÇÃO B — direto pelo user_id (UUID):
-- update public.profiles set is_admin = true where user_id = 'SEU_USER_ID_AQUI';
