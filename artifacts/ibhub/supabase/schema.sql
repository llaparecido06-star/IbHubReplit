-- ═══════════════════════════════════════════════════════════════════════════
-- ibhub — Rede do Vinho
-- Execute este SQL no Supabase SQL Editor (dashboard.supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── PROFILES (extensão do auth.users) ──────────────────────────────────────
-- Se a tabela já existe, ajuste as colunas conforme necessário.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  username      text unique,
  avatar_url    text,
  bio           text,
  headline      text,
  location      text,
  plan          text not null default 'gratuito',
  certifications        text[] default '{}',
  areas_of_expertise    text[] default '{}',
  followers_count       int not null default 0,
  following_count       int not null default 0,
  connections_count     int not null default 0,
  is_admin              boolean not null default false,
  is_banned             boolean not null default false,
  is_shadowbanned       boolean not null default false,
  courtesy_until        timestamptz,
  created_at            timestamptz not null default now()
);

-- ─── PLANS ───────────────────────────────────────────────────────────────────
create table if not exists public.plans (
  id           text primary key,
  name         text not null,
  subtitle     text not null default '',
  price_cents  int not null default 0,
  features     text[] not null default '{}',
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- Auto-criar perfil ao registrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    lower(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]', '', 'g'))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── POSTS ───────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  content         text not null default '',
  image_url       text,
  video_url       text,
  likes_count     int not null default 0,
  comments_count  int not null default 0,
  shares_count    int not null default 0,
  hashtags        text[] default '{}',
  poll            jsonb,
  created_at      timestamptz not null default now()
);

-- Migration: add video_url if posts table already exists
alter table public.posts add column if not exists video_url text;

-- ─── STORAGE: post-videos bucket ─────────────────────────────────────────────
-- Run once in the Supabase dashboard or via API:
-- insert into storage.buckets (id, name, public) values ('post-videos', 'post-videos', true) on conflict do nothing;
-- Storage policies (run in SQL Editor):
-- create policy "post_videos_select" on storage.objects for select using (bucket_id = 'post-videos');
-- create policy "post_videos_insert" on storage.objects for insert with check (bucket_id = 'post-videos' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "post_videos_delete" on storage.objects for delete using (bucket_id = 'post-videos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─── STORAGE: stories bucket ──────────────────────────────────────────────────
-- Run once (migration_v34): bucket already created via API
-- Storage policies (run in SQL Editor or via migrations_v34_storage_rls.sql):
-- drop policy if exists "stories_select" on storage.objects;
-- drop policy if exists "stories_insert" on storage.objects;
-- drop policy if exists "stories_update" on storage.objects;
-- drop policy if exists "stories_delete" on storage.objects;
-- create policy "stories_select" on storage.objects for select using (bucket_id = 'stories');
-- create policy "stories_insert" on storage.objects for insert with check (bucket_id = 'stories' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "stories_update" on storage.objects for update using (bucket_id = 'stories' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "stories_delete" on storage.objects for delete using (bucket_id = 'stories' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─── STORAGE: cvs bucket ──────────────────────────────────────────────────────
-- Run once (migration_v34): bucket already created via API
-- Upload path: cvs/{userId}/{filename} → foldername(name)[2] = userId
-- Storage policies (run in SQL Editor or via migrations_v34_storage_rls.sql):
-- drop policy if exists "cvs_select" on storage.objects;
-- drop policy if exists "cvs_insert" on storage.objects;
-- drop policy if exists "cvs_update" on storage.objects;
-- drop policy if exists "cvs_delete" on storage.objects;
-- create policy "cvs_select" on storage.objects for select using (bucket_id = 'cvs');
-- create policy "cvs_insert" on storage.objects for insert with check (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[2]);
-- create policy "cvs_update" on storage.objects for update using (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[2]);
-- create policy "cvs_delete" on storage.objects for delete using (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[2]);

-- ─── LIKES ───────────────────────────────────────────────────────────────────
create table if not exists public.likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.posts(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

-- Trigger: atualiza likes_count automaticamente
create or replace function public.update_likes_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set likes_count = greatest(0, likes_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$;
drop trigger if exists likes_count_trigger on public.likes;
create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.update_likes_count();

-- ─── BOOKMARKS ───────────────────────────────────────────────────────────────
create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.posts(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

-- ─── COMMENTS ────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.posts(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  content    text not null,
  created_at timestamptz not null default now()
);

-- Trigger: atualiza comments_count automaticamente
create or replace function public.update_comments_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set comments_count = greatest(0, comments_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$;
drop trigger if exists comments_count_trigger on public.comments;
create trigger comments_count_trigger
  after insert or delete on public.comments
  for each row execute function public.update_comments_count();

-- ─── FOLLOWS ─────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at   timestamptz not null default now(),
  unique(follower_id, following_id)
);

-- Trigger: atualiza followers_count e following_count
create or replace function public.update_follow_counts()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = NEW.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = NEW.following_id;
  elsif TG_OP = 'DELETE' then
    update public.profiles set following_count = greatest(0, following_count - 1) where id = OLD.follower_id;
    update public.profiles set followers_count = greatest(0, followers_count - 1) where id = OLD.following_id;
  end if;
  return null;
end;
$$;
drop trigger if exists follow_count_trigger on public.follows;
create trigger follow_count_trigger
  after insert or delete on public.follows
  for each row execute function public.update_follow_counts();

-- ─── CONNECTIONS ─────────────────────────────────────────────────────────────
create table if not exists public.connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid references auth.users(id) on delete cascade not null,
  receiver_id   uuid references auth.users(id) on delete cascade not null,
  status        text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at    timestamptz not null default now(),
  unique(requester_id, receiver_id)
);

-- Trigger: atualiza connections_count quando aceito
create or replace function public.update_connections_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and NEW.status = 'accepted' and OLD.status != 'accepted' then
    update public.profiles set connections_count = connections_count + 1 where id = NEW.requester_id;
    update public.profiles set connections_count = connections_count + 1 where id = NEW.receiver_id;
  end if;
  return NEW;
end;
$$;
drop trigger if exists connections_count_trigger on public.connections;
create trigger connections_count_trigger
  after update on public.connections
  for each row execute function public.update_connections_count();

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  actor_id   uuid references auth.users(id) on delete cascade,
  type       text not null,  -- like, comment, comment_reply, comment_like, follow, connection, mention
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  message    text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
-- Add comment_id column to existing deployments
alter table public.notifications add column if not exists comment_id uuid references public.comments(id) on delete cascade;

-- Trigger: cria notificação ao curtir
create or replace function public.notify_on_like()
returns trigger language plpgsql as $$
declare
  post_author uuid;
begin
  select user_id into post_author from public.posts where id = NEW.post_id;
  if post_author is not null and post_author != NEW.user_id then
    insert into public.notifications(user_id, actor_id, type, post_id, message)
    values (post_author, NEW.user_id, 'like', NEW.post_id, 'curtiu sua publicação');
  end if;
  return NEW;
end;
$$;
drop trigger if exists like_notification_trigger on public.likes;
create trigger like_notification_trigger
  after insert on public.likes
  for each row execute function public.notify_on_like();

-- ─── STORIES (MOMENTOS) ──────────────────────────────────────────────────────
create table if not exists public.stories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  image_url     text,
  text          text,
  tagged_users  uuid[] default '{}',
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '24 hours')
);

-- Adicionar coluna caso a tabela já exista
alter table public.stories add column if not exists tagged_users uuid[] default '{}';

-- ─── STORY VIEWS ─────────────────────────────────────────────────────────────
create table if not exists public.story_views (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid references public.stories(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  viewed_at  timestamptz not null default now(),
  unique(story_id, user_id)
);

-- ─── CONVERSATIONS & MESSAGES ────────────────────────────────────────────────
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  is_group   boolean not null default false,
  name       text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id  uuid references public.conversations(id) on delete cascade not null,
  user_id          uuid references auth.users(id) on delete cascade not null,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references public.conversations(id) on delete cascade not null,
  sender_id        uuid references auth.users(id) on delete cascade not null,
  content          text not null,
  created_at       timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles           enable row level security;
alter table public.posts              enable row level security;
alter table public.likes              enable row level security;
alter table public.bookmarks          enable row level security;
alter table public.comments           enable row level security;
alter table public.follows            enable row level security;
alter table public.connections        enable row level security;
alter table public.notifications      enable row level security;
alter table public.stories            enable row level security;
alter table public.conversations      enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages           enable row level security;

-- Profiles: qualquer um pode ler, o próprio usuário ou admin pode editar
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);

-- Posts: qualquer um pode ler, apenas o autor pode criar/editar/deletar
create policy "posts_select" on public.posts for select using (true);
create policy "posts_insert" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update" on public.posts for update using (auth.uid() = user_id);
create policy "posts_delete" on public.posts for delete using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- Likes: qualquer um lê, usuário autenticado cria/deleta os próprios
create policy "likes_select"  on public.likes for select using (true);
create policy "likes_insert"  on public.likes for insert with check (auth.uid() = user_id);
create policy "likes_delete"  on public.likes for delete using (auth.uid() = user_id);

-- Bookmarks: apenas o próprio usuário vê e gerencia
create policy "bookmarks_select" on public.bookmarks for select using (auth.uid() = user_id);
create policy "bookmarks_insert" on public.bookmarks for insert with check (auth.uid() = user_id);
create policy "bookmarks_delete" on public.bookmarks for delete using (auth.uid() = user_id);

-- Comments: qualquer um lê, usuário autenticado cria/deleta os próprios
create policy "comments_select" on public.comments for select using (true);
create policy "comments_insert" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on public.comments for delete using (auth.uid() = user_id);

-- Follows: qualquer um lê, usuário gerencia os próprios follows
create policy "follows_select" on public.follows for select using (true);
create policy "follows_insert" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete" on public.follows for delete using (auth.uid() = follower_id);

-- Connections: participantes podem ver, admins podem ver todas, requester cria
create policy "connections_select" on public.connections for select
  using (
    auth.uid() = requester_id
    or auth.uid() = receiver_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
create policy "connections_insert" on public.connections for insert with check (auth.uid() = requester_id);
create policy "connections_update" on public.connections for update
  using (auth.uid() = receiver_id or auth.uid() = requester_id);

-- Notifications: apenas o destinatário vê as próprias, sistema insere
create policy "notif_select" on public.notifications for select using (auth.uid() = user_id);
create policy "notif_insert" on public.notifications for insert with check (true);
create policy "notif_update" on public.notifications for update using (auth.uid() = user_id);

-- Stories: qualquer um lê, autor gerencia
create policy "stories_select" on public.stories for select using (true);
create policy "stories_insert" on public.stories for insert with check (auth.uid() = user_id);
create policy "stories_delete" on public.stories for delete using (auth.uid() = user_id);

-- Story views: RLS
-- A user can see their own view records OR view records for stories they authored
alter table public.story_views enable row level security;
create policy "story_views_select" on public.story_views for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id = auth.uid()
    )
  );
create policy "story_views_insert" on public.story_views for insert with check (auth.uid() = user_id);
create policy "story_views_update" on public.story_views for update using (auth.uid() = user_id);

-- Conversations: participantes podem ver
create policy "convos_select" on public.conversations for select
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = id and cp.user_id = auth.uid()
  ));
create policy "convos_insert" on public.conversations for insert with check (true);

-- Conversation participants
create policy "cp_select" on public.conversation_participants for select
  using (user_id = auth.uid() or exists (
    select 1 from public.conversation_participants cp2
    where cp2.conversation_id = conversation_id and cp2.user_id = auth.uid()
  ));
create policy "cp_insert" on public.conversation_participants for insert with check (true);

-- Messages: participantes da conversa podem ler, sender envia
create policy "messages_select" on public.messages for select
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
  ));
create policy "messages_insert" on public.messages for insert with check (auth.uid() = sender_id);

-- ─── CERTIFICATION REQUESTS ──────────────────────────────────────────────────
create table if not exists public.certification_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  issuer        text not null,
  cert_number   text,
  date          text,
  status        text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id) on delete set null
);
alter table public.certification_requests enable row level security;

-- Users can see only their own requests; admins can see all
create policy "cert_requests_select_own" on public.certification_requests for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
create policy "cert_requests_insert" on public.certification_requests for insert
  with check (auth.uid() = user_id);
create policy "cert_requests_update_admin" on public.certification_requests for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ─── REPORTS ─────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  reported_by   uuid not null references public.profiles(id) on delete cascade,
  reason        text not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports_insert" on public.reports for insert with check (auth.uid() = reported_by);
create policy "reports_select_admin" on public.reports for select using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);
create policy "reports_update_admin" on public.reports for update using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- ─── PLANS RLS ───────────────────────────────────────────────────────────────
alter table public.plans enable row level security;
create policy "plans_select" on public.plans for select using (true);
create policy "plans_insert_admin" on public.plans for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
create policy "plans_update_admin" on public.plans for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
create policy "plans_delete_admin" on public.plans for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Trigger: cria notificação ao comentar
create or replace function public.notify_on_comment()
returns trigger language plpgsql as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  -- Notify post author about new comment (not a reply)
  if NEW.parent_comment_id is null then
    select user_id into post_author from public.posts where id = NEW.post_id;
    if post_author is not null and post_author != NEW.user_id then
      insert into public.notifications(user_id, actor_id, type, post_id, comment_id, message)
      values (post_author, NEW.user_id, 'comment', NEW.post_id, NEW.id, 'comentou na sua publicação');
    end if;
  else
    -- Reply: notify parent comment author
    select user_id into parent_author from public.comments where id = NEW.parent_comment_id;
    if parent_author is not null and parent_author != NEW.user_id then
      insert into public.notifications(user_id, actor_id, type, post_id, comment_id, message)
      values (parent_author, NEW.user_id, 'comment_reply', NEW.post_id, NEW.id, 'respondeu ao seu comentário');
    end if;
    -- Also notify post author if different from parent author
    select user_id into post_author from public.posts where id = NEW.post_id;
    if post_author is not null and post_author != NEW.user_id and post_author != parent_author then
      insert into public.notifications(user_id, actor_id, type, post_id, comment_id, message)
      values (post_author, NEW.user_id, 'comment_reply', NEW.post_id, NEW.id, 'respondeu a um comentário na sua publicação');
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists comment_notification_trigger on public.comments;
create trigger comment_notification_trigger
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- ─── COMMENT LIKES ────────────────────────────────────────────────────────────
create table if not exists public.comment_likes (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid references public.comments(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(comment_id, user_id)
);
alter table public.comment_likes enable row level security;
create policy "comment_likes_select" on public.comment_likes for select using (true);
create policy "comment_likes_insert" on public.comment_likes for insert with check (auth.uid() = user_id);
create policy "comment_likes_delete" on public.comment_likes for delete using (auth.uid() = user_id);

-- Trigger: cria notificação ao curtir comentário
create or replace function public.notify_on_comment_like()
returns trigger language plpgsql as $$
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

-- Trigger: cria notificação ao seguir
create or replace function public.notify_on_follow()
returns trigger language plpgsql as $$
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

-- Trigger: cria notificação ao aceitar conexão
create or replace function public.notify_on_connection_accepted()
returns trigger language plpgsql as $$
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

-- Trigger: cria notificação ao curtir post do mercado (Ideal.BI)
create or replace function public.notify_on_market_like()
returns trigger language plpgsql as $$
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

-- Trigger: cria notificação ao comentar em post do mercado (Ideal.BI)
create or replace function public.notify_on_market_comment()
returns trigger language plpgsql as $$
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
