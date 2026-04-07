-- ibhub — Migração v5: solicitações de mensagem + mídia no chat
-- Execute no Supabase Dashboard → SQL Editor.

-- 1. Solicitação de contato: conversa precisa ser aceita pelo destinatário
alter table public.conversation_participants
  add column if not exists accepted boolean not null default true;

-- 2. Suporte a mídia nas mensagens
alter table public.messages
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text', 'image', 'video', 'audio', 'file')),
  add column if not exists media_url text;

-- 3. Política: participantes podem atualizar sua própria linha (para aceitar)
drop policy if exists "Participants can update own row" on public.conversation_participants;
create policy "Participants can update own row"
  on public.conversation_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. Política: participantes podem excluir sua própria linha (para recusar/sair)
drop policy if exists "Participants can delete own row" on public.conversation_participants;
create policy "Participants can delete own row"
  on public.conversation_participants
  for delete
  to authenticated
  using (user_id = auth.uid());
