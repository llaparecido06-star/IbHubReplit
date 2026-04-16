-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v54 — Fix group creator membership
-- ───────────────────────────────────────────────────────────────────────────────
-- Problems fixed:
-- 1. Group creator was not being added to `group_members` on creation
--    → member_count showed 0, group didn't appear in "my groups"
-- 2. Group creator not always in `conversation_participants`
--    → messages INSERT RLS policy (v53) rejected their messages (42501)
-- 3. `group_members` had no RLS policies
--    → joinGroup (client-side) failed silently
--
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. RLS policies for group_members ────────────────────────────────────────
alter table if exists public.group_members enable row level security;

-- Users can see all members of any group (for member lists)
drop policy if exists "gm_select" on public.group_members;
create policy "gm_select" on public.group_members
  for select to authenticated using (true);

-- Users can add themselves to a group (join)
drop policy if exists "gm_insert" on public.group_members;
create policy "gm_insert" on public.group_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- Users can remove themselves from a group (leave)
drop policy if exists "gm_delete" on public.group_members;
create policy "gm_delete" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid());

-- Group owners can update member roles
drop policy if exists "gm_update" on public.group_members;
create policy "gm_update" on public.group_members
  for update to authenticated
  using (
    exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_members.group_id
        and gm2.user_id  = auth.uid()
        and gm2.role     = 'owner'
    )
  );


-- ── 2. Auto-add owner trigger on group creation ───────────────────────────────
-- Runs as SECURITY DEFINER so it bypasses RLS; fires AFTER INSERT on groups.
create or replace function public.auto_add_group_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Add owner to group_members
  insert into public.group_members (group_id, user_id, role)
  values (NEW.id, NEW.owner_id, 'owner')
  on conflict (group_id, user_id) do nothing;

  -- Add owner to conversation_participants (needed for messages RLS)
  insert into public.conversation_participants (conversation_id, user_id)
  values (NEW.id, NEW.owner_id)
  on conflict (conversation_id, user_id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_add_group_owner on public.groups;
create trigger trg_auto_add_group_owner
  after insert on public.groups
  for each row
  execute function public.auto_add_group_owner();


-- ── 3. Repair existing groups ─────────────────────────────────────────────────
-- Back-fill group_members for groups whose owner is missing
insert into public.group_members (group_id, user_id, role)
select g.id, g.owner_id, 'owner'
from   public.groups g
where  not exists (
  select 1 from public.group_members gm
  where  gm.group_id = g.id
    and  gm.user_id  = g.owner_id
)
on conflict (group_id, user_id) do nothing;

-- Back-fill conversation_participants for groups whose owner is missing
insert into public.conversation_participants (conversation_id, user_id)
select g.id, g.owner_id
from   public.groups g
where  not exists (
  select 1 from public.conversation_participants cp
  where  cp.conversation_id = g.id
    and  cp.user_id         = g.owner_id
)
on conflict (conversation_id, user_id) do nothing;


-- ── 4. Verify ─────────────────────────────────────────────────────────────────
select
  g.id,
  g.name,
  g.owner_id,
  exists(select 1 from public.group_members gm        where gm.group_id       = g.id and gm.user_id = g.owner_id) as owner_in_members,
  exists(select 1 from public.conversation_participants cp where cp.conversation_id = g.id and cp.user_id = g.owner_id) as owner_in_participants
from public.groups g
order by g.created_at desc
limit 20;
