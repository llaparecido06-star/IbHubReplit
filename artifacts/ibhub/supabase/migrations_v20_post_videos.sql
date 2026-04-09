-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v20: Post Videos
-- Adiciona suporte a vídeos nos posts (coluna video_url + bucket post-videos)
-- Execute no Supabase SQL Editor (dashboard.supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Adicionar coluna video_url na tabela posts
alter table public.posts add column if not exists video_url text;

-- 2. Criar bucket post-videos (execute no SQL Editor ou via Supabase Dashboard > Storage)
insert into storage.buckets (id, name, public)
values ('post-videos', 'post-videos', true)
on conflict (id) do nothing;

-- 3. Políticas de acesso ao bucket post-videos
-- Leitura pública
create policy "post_videos_select"
  on storage.objects for select
  using (bucket_id = 'post-videos');

-- Escrita autenticada (apenas o próprio usuário pode escrever em sua pasta)
create policy "post_videos_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'post-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Deleção pelo próprio usuário
create policy "post_videos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'post-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
