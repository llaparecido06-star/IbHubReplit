-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v55 — Separate personal ↔ company conversations
-- ───────────────────────────────────────────────────────────────────────────────
-- Problem:
--   A single login has two identities (personal + company page). The same
--   conversation thread was shared between both, so messages sent from the
--   personal profile leaked into the company inbox and vice-versa.
--
-- Fix:
--   Add `company_page_id` to `conversations`.
--   - NULL  → personal conversation
--   - uuid  → conversation owned by that company page
--
--   `get_direct_conversation` now accepts a 3rd parameter so the same pair of
--   users can have two completely separate threads (one personal, one as company).
--
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. Add company_page_id column ─────────────────────────────────────────────
alter table public.conversations
  add column if not exists company_page_id uuid references public.company_pages(id) on delete set null;

create index if not exists idx_conversations_company_page_id
  on public.conversations (company_page_id);


-- ── 2. Back-fill existing conversations ───────────────────────────────────────
-- Any conversation that already has a message tagged with from_company_page_id
-- is a company conversation — set the company_page_id on the conversation itself.
-- Uses the MOST FREQUENT from_company_page_id in the conversation as the owner.
update public.conversations c
set    company_page_id = subq.company_page_id
from (
  select   conversation_id,
           from_company_page_id as company_page_id,
           count(*) as msg_count
  from     public.messages
  where    from_company_page_id is not null
  group by conversation_id, from_company_page_id
  order by msg_count desc
) subq
where c.id = subq.conversation_id
  and c.company_page_id is null;


-- ── 3. Update get_direct_conversation RPC ─────────────────────────────────────
-- Now takes an optional p_company_page_id. Personal calls pass NULL.
-- This ensures personal and company threads are never shared.
create or replace function public.get_direct_conversation(
  p_user1            uuid,
  p_user2            uuid,
  p_company_page_id  uuid default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select c.id
  from   public.conversations c
  join   public.conversation_participants cp1
           on cp1.conversation_id = c.id and cp1.user_id = p_user1
  join   public.conversation_participants cp2
           on cp2.conversation_id = c.id and cp2.user_id = p_user2
  where  c.is_group = false
    and  (
           (p_company_page_id is null     and c.company_page_id is null)
           or
           (p_company_page_id is not null and c.company_page_id = p_company_page_id)
         )
  limit 1;
$$;


-- ── 4. Verify ─────────────────────────────────────────────────────────────────
select
  c.id,
  c.company_page_id,
  cp.name as company_name,
  count(m.id) as message_count
from   public.conversations c
left   join public.company_pages cp on cp.id = c.company_page_id
left   join public.messages m on m.conversation_id = c.id
where  c.is_group = false
group  by c.id, c.company_page_id, cp.name
order  by message_count desc
limit  20;
