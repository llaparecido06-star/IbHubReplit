-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v57 — Fix messages table for full media support (audio/file/etc.)
-- ───────────────────────────────────────────────────────────────────────────────
-- Problems addressed:
-- 1. message_type CHECK constraint may not include 'post_share' / 'wine_card'
--    needed by the client (AppMessage interface).
-- 2. media_url column may have NOT NULL constraint blocking audio inserts when
--    content is an empty string.
-- 3. Ensures messages INSERT policy allows all message types consistently.
-- 4. Adds `file_name` column for file messages if missing.
--
-- Safe to run multiple times (all statements are idempotent).
-- Run in Supabase Dashboard → SQL Editor (after v51–v56)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. Ensure media_url column exists with no NOT NULL constraint ─────────────
alter table public.messages
  add column if not exists media_url text;

-- Remove NOT NULL if it was accidentally set (safe — media messages need text, audio can be URL-only)
alter table public.messages
  alter column media_url drop not null;

-- Ensure content column is nullable / defaults to empty string for media messages
alter table public.messages
  alter column content set default '';

alter table public.messages
  alter column content drop not null;


-- ── 2. Widen message_type CHECK to include ALL types used by the client ────────
-- Drop old named constraint if any (different DBs may have different names)
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages drop constraint if exists chk_message_type;
alter table public.messages drop constraint if exists messages_type_check;

-- Add a new comprehensive constraint
alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'video', 'audio', 'file', 'post_share', 'wine_card'));


-- ── 3. Ensure file_name column exists (used for "file" messages) ──────────────
alter table public.messages
  add column if not exists file_name text;


-- ── 4. Re-apply messages INSERT policy ────────────────────────────────────────
-- Replaces whatever policy is current with a clean, non-recursive version.
-- Uses the is_conversation_participant SECURITY DEFINER function if it exists,
-- falls back to simple sender_id check otherwise (handles both pre/post v53 states).

-- First ensure is_conversation_participant exists (from v53 — safe to re-create)
create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id         uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id         = p_user_id
  );
$$;

-- Re-apply messages policies (idempotent)
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (
    public.is_conversation_participant(conversation_id, auth.uid())
  );

drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages
  for update using (sender_id = auth.uid());

drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages
  for delete using (sender_id = auth.uid());


-- ── 5. Add metadata column to notifications (for group_request type) ─────────
-- Stores extra context like group_id for routing in the notification screen.
alter table public.notifications
  add column if not exists metadata jsonb;


-- ── 6. Verify ─────────────────────────────────────────────────────────────────
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'messages'
order by ordinal_position;
