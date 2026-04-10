-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v34: RLS para buckets stories e cvs
-- Cria os buckets públicos e adiciona políticas RLS de SELECT/INSERT/UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Criar bucket "stories" público (se ainda não existir)
insert into storage.buckets (id, name, public)
values ('stories', 'stories', true)
on conflict (id) do nothing;

-- 2. Criar bucket "cvs" público (se ainda não existir)
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', true)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Políticas RLS para o bucket "stories"
-- Upload path: userId/filename → foldername(name)[1] = userId
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "stories_select" on storage.objects;
drop policy if exists "stories_insert" on storage.objects;
drop policy if exists "stories_update" on storage.objects;
drop policy if exists "stories_delete" on storage.objects;

create policy "stories_select"
  on storage.objects for select
  using (bucket_id = 'stories');

create policy "stories_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'stories'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "stories_update"
  on storage.objects for update
  using (
    bucket_id = 'stories'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "stories_delete"
  on storage.objects for delete
  using (
    bucket_id = 'stories'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Políticas RLS para o bucket "cvs"
-- Upload path: cvs/userId/filename → foldername(name)[2] = userId
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "cvs_select" on storage.objects;
drop policy if exists "cvs_insert" on storage.objects;
drop policy if exists "cvs_update" on storage.objects;
drop policy if exists "cvs_delete" on storage.objects;

create policy "cvs_select"
  on storage.objects for select
  using (bucket_id = 'cvs');

create policy "cvs_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy "cvs_update"
  on storage.objects for update
  using (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy "cvs_delete"
  on storage.objects for delete
  using (
    bucket_id = 'cvs'
    and auth.uid()::text = (storage.foldername(name))[2]
  );
