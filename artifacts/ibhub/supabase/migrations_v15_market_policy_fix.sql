-- ibhub — Migração v15: corrige policy de escrita admin em market_overview
-- O v4 usava profiles.user_id = auth.uid() (coluna errada).
-- profiles.id é o PK que referencia auth.users.id — é essa a coluna correta.
-- Execute no Supabase Dashboard → SQL Editor.

-- Remove a policy antiga com a coluna errada
drop policy if exists "Admins can upsert market_overview" on public.market_overview;

-- Recria com a coluna correta (profiles.id = auth.uid())
create policy "Admins can upsert market_overview"
  on public.market_overview
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
