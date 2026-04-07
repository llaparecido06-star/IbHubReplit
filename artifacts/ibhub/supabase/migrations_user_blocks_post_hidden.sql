-- ═══════════════════════════════════════════════════════════════════════════
-- ibhub — Tabelas: user_blocks + post_hidden
-- Execute no Supabase: dashboard.supabase.com → SQL Editor → New Query
-- É seguro rodar múltiplas vezes (IF NOT EXISTS + OR REPLACE)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── USER_BLOCKS ─────────────────────────────────────────────────────────────
-- Armazena bloqueios entre usuários.
-- blocker_id = quem bloqueou | blocked_id = quem foi bloqueado

create table if not exists public.user_blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint user_blocks_unique unique (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);

-- Índices para lookups rápidos no feed
create index if not exists idx_user_blocks_blocker on public.user_blocks (blocker_id);
create index if not exists idx_user_blocks_blocked on public.user_blocks (blocked_id);

-- RLS
alter table public.user_blocks enable row level security;

-- Cada usuário só vê seus próprios bloqueios
create policy "user_blocks_select_own"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);

-- Cada usuário só insere bloqueios seus
create policy "user_blocks_insert_own"
  on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

-- Cada usuário só deleta bloqueios seus (desbloquear)
create policy "user_blocks_delete_own"
  on public.user_blocks for delete
  using (auth.uid() = blocker_id);


-- ─── POST_HIDDEN ─────────────────────────────────────────────────────────────
-- Armazena posts marcados como "não tenho interesse" por cada usuário.
-- Usado para filtrar o feed nas próximas sessões.

create table if not exists public.post_hidden (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  post_id   uuid not null references public.posts(id) on delete cascade,
  hidden_at timestamptz not null default now(),

  constraint post_hidden_unique unique (user_id, post_id)
);

-- Índice para filtrar rapidamente no fetchFeedPosts
create index if not exists idx_post_hidden_user on public.post_hidden (user_id);

-- RLS
alter table public.post_hidden enable row level security;

create policy "post_hidden_select_own"
  on public.post_hidden for select
  using (auth.uid() = user_id);

create policy "post_hidden_insert_own"
  on public.post_hidden for insert
  with check (auth.uid() = user_id);

create policy "post_hidden_delete_own"
  on public.post_hidden for delete
  using (auth.uid() = user_id);


-- ─── OPCIONAL: filtrar posts ocultos e de bloqueados no feed ─────────────────
-- Se quiser que o filtro ocorra no banco (mais seguro), você pode adicionar
-- as condições abaixo ao seu SELECT de posts no app. Exemplo:
--
--   .not("id", "in", `(select post_id from post_hidden where user_id = '${currentUserId}')`)
--   .not("user_id", "in", `(select blocked_id from user_blocks where blocker_id = '${currentUserId}')`)
--
-- Por enquanto o app já filtra no cliente (feedPosts) via onHide / onBlock.
