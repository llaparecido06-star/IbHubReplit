-- ibhub — Migração v14: phone em profiles + bucket avatars

-- 1. Adiciona coluna phone em profiles (seguro repetir)
alter table public.profiles add column if not exists phone text;

-- 2. Cria bucket "avatars" público para fotos de perfil
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 3. RLS: qualquer usuário autenticado pode fazer upload na própria pasta
drop policy if exists "avatars_select"   on storage.objects;
drop policy if exists "avatars_insert"   on storage.objects;
drop policy if exists "avatars_update"   on storage.objects;
drop policy if exists "avatars_delete"   on storage.objects;

create policy "avatars_select"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
