-- Migration v41: Notification triggers + comment_likes table
-- Run this against your Supabase instance to apply all notification changes

-- 1. Add comment_id column to notifications if it doesn't exist
alter table public.notifications
  add column if not exists comment_id uuid references public.comments(id) on delete set null;

-- 2. Create comment_likes table if it doesn't exist
create table if not exists public.comment_likes (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);

alter table public.comment_likes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'comment_likes_select' and tablename = 'comment_likes') then
    create policy "comment_likes_select" on public.comment_likes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'comment_likes_insert' and tablename = 'comment_likes') then
    create policy "comment_likes_insert" on public.comment_likes for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'comment_likes_delete' and tablename = 'comment_likes') then
    create policy "comment_likes_delete" on public.comment_likes for delete using (auth.uid() = user_id);
  end if;
end $$;

-- 3. Trigger: notify on comment (root comment → 'comment', reply → 'comment_reply')
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  if NEW.parent_comment_id is null then
    select user_id into post_author from public.posts where id = NEW.post_id;
    if post_author is not null and post_author != coalesce(NEW.user_id, NEW.company_page_id::uuid) then
      insert into public.notifications(user_id, actor_id, type, post_id, comment_id, message)
      values (post_author, NEW.user_id, 'comment', NEW.post_id, NEW.id, 'comentou na sua publicação');
    end if;
  else
    select user_id into parent_author from public.comments where id = NEW.parent_comment_id;
    if parent_author is not null and parent_author != coalesce(NEW.user_id, NEW.company_page_id::uuid) then
      insert into public.notifications(user_id, actor_id, type, post_id, comment_id, message)
      values (parent_author, NEW.user_id, 'comment_reply', NEW.post_id, NEW.id, 'respondeu seu comentário');
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists comment_notification_trigger on public.comments;
create trigger comment_notification_trigger
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- 4. Trigger: notify on comment like
create or replace function public.notify_on_comment_like()
returns trigger language plpgsql security definer as $$
declare
  comment_author uuid;
  post_id_val uuid;
begin
  select user_id, post_id into comment_author, post_id_val from public.comments where id = NEW.comment_id;
  if comment_author is not null and comment_author != NEW.user_id then
    insert into public.notifications(user_id, actor_id, type, post_id, comment_id, message)
    values (comment_author, NEW.user_id, 'comment_like', post_id_val, NEW.comment_id, 'curtiu seu comentário');
  end if;
  return NEW;
end;
$$;
drop trigger if exists comment_like_notification_trigger on public.comment_likes;
create trigger comment_like_notification_trigger
  after insert on public.comment_likes
  for each row execute function public.notify_on_comment_like();

-- 5. Trigger: notify on follow
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer as $$
begin
  if NEW.follower_id != NEW.following_id then
    insert into public.notifications(user_id, actor_id, type, message)
    values (NEW.following_id, NEW.follower_id, 'follow', 'começou a seguir você');
  end if;
  return NEW;
end;
$$;
drop trigger if exists follow_notification_trigger on public.follows;
create trigger follow_notification_trigger
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- 6. Trigger: notify on connection accepted
create or replace function public.notify_on_connection_accepted()
returns trigger language plpgsql security definer as $$
begin
  if NEW.status = 'accepted' and (OLD.status is null or OLD.status != 'accepted') then
    insert into public.notifications(user_id, actor_id, type, message)
    values (NEW.requester_id, NEW.receiver_id, 'connection', 'aceitou sua solicitação de conexão');
  end if;
  return NEW;
end;
$$;
drop trigger if exists connection_accepted_notification_trigger on public.connections;
create trigger connection_accepted_notification_trigger
  after update on public.connections
  for each row execute function public.notify_on_connection_accepted();

-- 7. Trigger: notify on market post like (Ideal.BI)
create or replace function public.notify_on_market_like()
returns trigger language plpgsql security definer as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.market_posts where id = NEW.post_id;
  if post_author is not null and post_author != NEW.user_id then
    insert into public.notifications(user_id, actor_id, type, message)
    values (post_author, NEW.user_id, 'like', 'curtiu sua publicação no Ideal.BI');
  end if;
  return NEW;
end;
$$;
drop trigger if exists market_like_notification_trigger on public.market_post_likes;
create trigger market_like_notification_trigger
  after insert on public.market_post_likes
  for each row execute function public.notify_on_market_like();

-- 8. Trigger: notify on market comment (Ideal.BI)
create or replace function public.notify_on_market_comment()
returns trigger language plpgsql security definer as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.market_posts where id = NEW.post_id;
  if post_author is not null and post_author != NEW.author_id then
    insert into public.notifications(user_id, actor_id, type, message)
    values (post_author, NEW.author_id, 'comment', 'comentou na sua publicação no Ideal.BI');
  end if;
  return NEW;
end;
$$;
drop trigger if exists market_comment_notification_trigger on public.market_post_comments;
create trigger market_comment_notification_trigger
  after insert on public.market_post_comments
  for each row execute function public.notify_on_market_comment();
