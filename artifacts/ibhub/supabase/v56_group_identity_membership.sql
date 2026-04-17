-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v56 — Group identity membership (personal vs. company)
-- ───────────────────────────────────────────────────────────────────────────────
-- Problem:
--   When a user joined a group it counted for BOTH their personal profile and
--   their company page. A single row (user_id) in group_members / 
--   conversation_participants had no concept of "which identity joined".
--
-- Fix:
--   Add  company_page_id  to both tables.
--     NULL  = joined as personal profile
--     uuid  = joined as that specific company page
--
--   A user can now hold two separate memberships in the same group:
--     (group_id, user_id, NULL)              → personal
--     (group_id, user_id, <company_page_id>) → company
--
-- Run in Supabase Dashboard → SQL Editor (after v55)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. group_members: add company_page_id ─────────────────────────────────────

alter table public.group_members
  add column if not exists company_page_id uuid
    references public.company_pages(id) on delete cascade;

-- Drop old unique constraint and create a new one that includes company_page_id
-- NULLS NOT DISTINCT means (group_id, user_id, NULL) is itself unique.
alter table public.group_members
  drop constraint if exists group_members_group_id_user_id_key;

alter table public.group_members
  drop constraint if exists group_members_unique;

alter table public.group_members
  add constraint group_members_unique
  unique nulls not distinct (group_id, user_id, company_page_id);

create index if not exists idx_gm_company_page_id on public.group_members (company_page_id);


-- ── 2. conversation_participants: add company_page_id ─────────────────────────
-- (Only meaningful for group conversations; direct chats are already separated
--  at the conversations.company_page_id level via v55.)

alter table public.conversation_participants
  add column if not exists company_page_id uuid
    references public.company_pages(id) on delete cascade;

-- Drop old unique and create new
alter table public.conversation_participants
  drop constraint if exists conversation_participants_conversation_id_user_id_key;

alter table public.conversation_participants
  drop constraint if exists conversation_participants_unique;

alter table public.conversation_participants
  add constraint conversation_participants_unique
  unique nulls not distinct (conversation_id, user_id, company_page_id);

create index if not exists idx_cp_company_page_id on public.conversation_participants (company_page_id);


-- ── 3. Update is_conversation_participant (v53) to still work ─────────────────
-- The function only checks user_id (ignores company_page_id), so any membership
-- (personal OR company) allows the user to send messages. This is intentional:
-- auth.uid() is the same regardless of which identity they're acting as.
-- We just re-create it to be explicit about this decision.
create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id         uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from   public.conversation_participants cp
    where  cp.conversation_id = p_conversation_id
      and  cp.user_id         = p_user_id
  );
$$;


-- ── 4. Update auto_add_group_owner trigger ────────────────────────────────────
-- Owner always joins with company_page_id = NULL (personal).
-- If the owner wants to add their company they must do so explicitly.
create or replace function public.auto_add_group_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role, company_page_id)
  values (NEW.id, NEW.owner_id, 'owner', null)
  on conflict (group_id, user_id, company_page_id) do nothing;

  insert into public.conversation_participants (conversation_id, user_id, company_page_id)
  values (NEW.id, NEW.owner_id, null)
  on conflict (conversation_id, user_id, company_page_id) do nothing;

  return NEW;
end;
$$;


-- ── 5. Back-fill existing memberships ─────────────────────────────────────────
-- All existing rows had NULL company_page_id by default, which is correct
-- (they were joined without any company context). Nothing to change.
-- The unique constraint add above may fail if there are existing duplicates on
-- the OLD (group_id, user_id) — clean them up first:

-- group_members: keep the oldest row per (group_id, user_id) where company_page_id is null
delete from public.group_members gm1
using public.group_members gm2
where gm1.group_id = gm2.group_id
  and gm1.user_id  = gm2.user_id
  and gm1.company_page_id is null
  and gm2.company_page_id is null
  and gm1.ctid > gm2.ctid;

-- conversation_participants: same
delete from public.conversation_participants cp1
using public.conversation_participants cp2
where cp1.conversation_id = cp2.conversation_id
  and cp1.user_id         = cp2.user_id
  and cp1.company_page_id is null
  and cp2.company_page_id is null
  and cp1.ctid > cp2.ctid;


-- ── 6. Verify ─────────────────────────────────────────────────────────────────
select
  g.name       as group_name,
  gm.user_id,
  gm.role,
  gm.company_page_id,
  case when gm.company_page_id is null then 'personal' else 'empresa' end as identity
from public.group_members gm
join public.groups g on g.id = gm.group_id
order by g.name, gm.user_id
limit 30;
