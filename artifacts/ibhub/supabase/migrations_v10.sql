-- ibhub — Migração v10: likes_count na tabela comments + realtime habilitado

-- 1. Adiciona coluna likes_count na tabela comments (seguro repetir)
alter table public.comments add column if not exists likes_count int not null default 0;

-- 2. Inicializa counts existentes a partir de comment_likes
update public.comments c
set likes_count = (
  select count(*) from public.comment_likes cl where cl.comment_id = c.id
)
where likes_count = 0;

-- 3. Função e trigger para manter likes_count atualizado
create or replace function public.update_comment_likes_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.comments set likes_count = likes_count + 1 where id = NEW.comment_id;
  elsif TG_OP = 'DELETE' then
    update public.comments set likes_count = greatest(0, likes_count - 1) where id = OLD.comment_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comment_likes_count_trigger on public.comment_likes;
create trigger comment_likes_count_trigger
  after insert or delete on public.comment_likes
  for each row execute function public.update_comment_likes_count();

-- 4. Habilita realtime na tabela comments
alter publication supabase_realtime add table public.comments;
