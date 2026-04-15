-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v50 — Go-Live RLS Security Audit Fixes
-- Run in Supabase Dashboard → SQL Editor
-- Idempotent: all policies use DROP IF EXISTS + CREATE
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. FIX: notifications INSERT — disable direct client inserts ────────────
-- Previous policy: with check (true) → any user could forge notifications
-- targeting any recipient (arbitrary user_id). Legitimate inserts come ONLY from:
--   a) SECURITY DEFINER triggers (bypass RLS entirely)
--   b) Service-role API calls (bypass RLS entirely)
-- No client code should ever insert directly, so block all authenticated inserts.
drop policy if exists "notif_insert" on public.notifications;
create policy "notif_insert"
  on public.notifications for insert
  to authenticated
  with check (false);


-- ─── 2. FIX: feature_flags SELECT — allow unauthenticated reads ──────────────
-- Needed so the maintenance mode check works before the user signs in.
-- Writes remain admin-only (ff_insert_admin / ff_update_admin already exist).
drop policy if exists "ff_select_all" on public.feature_flags;
create policy "ff_select_all"
  on public.feature_flags for select
  using (true);

-- Add missing DELETE admin policy for feature_flags
drop policy if exists "ff_delete_admin" on public.feature_flags;
create policy "ff_delete_admin"
  on public.feature_flags for delete
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ));


-- ─── 3. FIX: market_posts — add RLS (table exists, no policies defined) ──────
alter table if exists public.market_posts enable row level security;

-- Authenticated users can read posts (plan gate enforced at API server level)
drop policy if exists "mp_select_auth" on public.market_posts;
create policy "mp_select_auth"
  on public.market_posts for select
  to authenticated
  using (true);

-- Only admins can write directly; normal writes go through service-role API
drop policy if exists "mp_insert_admin" on public.market_posts;
create policy "mp_insert_admin"
  on public.market_posts for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ));

drop policy if exists "mp_update_admin" on public.market_posts;
create policy "mp_update_admin"
  on public.market_posts for update
  to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ));

drop policy if exists "mp_delete_admin" on public.market_posts;
create policy "mp_delete_admin"
  on public.market_posts for delete
  to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );


-- ─── 4. FIX: market_post_likes — add RLS ────────────────────────────────────
alter table if exists public.market_post_likes enable row level security;

drop policy if exists "mpl_select" on public.market_post_likes;
create policy "mpl_select"
  on public.market_post_likes for select
  to authenticated
  using (true);

drop policy if exists "mpl_insert" on public.market_post_likes;
create policy "mpl_insert"
  on public.market_post_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "mpl_delete" on public.market_post_likes;
create policy "mpl_delete"
  on public.market_post_likes for delete
  to authenticated
  using (auth.uid() = user_id);


-- ─── 5. FIX: market_post_comments — add RLS ─────────────────────────────────
alter table if exists public.market_post_comments enable row level security;

drop policy if exists "mpc_select" on public.market_post_comments;
create policy "mpc_select"
  on public.market_post_comments for select
  to authenticated
  using (true);

drop policy if exists "mpc_insert" on public.market_post_comments;
create policy "mpc_insert"
  on public.market_post_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "mpc_update" on public.market_post_comments;
create policy "mpc_update"
  on public.market_post_comments for update
  to authenticated
  using (auth.uid() = author_id);

drop policy if exists "mpc_delete" on public.market_post_comments;
create policy "mpc_delete"
  on public.market_post_comments for delete
  to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );


-- ─── 6. FIX: notification_broadcasts — create table + admin-only RLS ─────────
-- This table is written to via service role in admin.ts push route.
-- Direct client access should be admin-only.
create table if not exists public.notification_broadcasts (
  id          uuid primary key default gen_random_uuid(),
  sent_at     timestamptz not null default now(),
  title       text not null,
  body        text not null,
  segment     text not null default 'all',
  deep_link   text,
  sent_by     uuid references auth.users(id) on delete set null,
  sent_count  integer not null default 0
);

alter table public.notification_broadcasts enable row level security;

drop policy if exists "nb_select_admin" on public.notification_broadcasts;
create policy "nb_select_admin"
  on public.notification_broadcasts for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ));

drop policy if exists "nb_insert_admin" on public.notification_broadcasts;
create policy "nb_insert_admin"
  on public.notification_broadcasts for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ));

drop policy if exists "nb_delete_admin" on public.notification_broadcasts;
create policy "nb_delete_admin"
  on public.notification_broadcasts for delete
  to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ));


-- ─── 7. FIX: opportunity_applications — add missing DELETE policy ─────────────
-- Users should be able to withdraw their own applications.
drop policy if exists "App delete self" on public.opportunity_applications;
create policy "App delete self"
  on public.opportunity_applications for delete
  to authenticated
  using (auth.uid() = applicant_id);


-- ─── 8. FIX: support_messages — add admin SELECT policy ──────────────────────
-- Allows admin web panel to read support tickets via authenticated Supabase client.
drop policy if exists "Admins can read all support messages" on public.support_messages;
create policy "Admins can read all support messages"
  on public.support_messages for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Remove the old user-only SELECT policy to avoid conflict
drop policy if exists "Users can read their own support messages" on public.support_messages;


-- ─── 9. FIX: bug_reports — add admin SELECT policy ───────────────────────────
drop policy if exists "Admins can read all bug reports" on public.bug_reports;
create policy "Admins can read all bug reports"
  on public.bug_reports for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Remove the old user-only SELECT policy to avoid conflict
drop policy if exists "Users can read their own bug reports" on public.bug_reports;


-- ─── 10. HARDEN: profiles — block direct is_admin escalation via trigger ──────
-- Use a BEFORE UPDATE trigger instead of complex RLS WITH CHECK to prevent
-- non-admins from changing sensitive columns (is_admin, plan, stripe_*).
-- The existing profiles_update policy USING clause (from v11) already restricts
-- which rows can be targeted; this trigger restricts which columns can change.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
as $$
declare
  caller_is_admin boolean;
begin
  -- Service-role and backend calls have no JWT (auth.uid() IS NULL).
  -- These are trusted (Stripe webhooks, admin API routes) — allow all changes.
  if auth.uid() is null then
    return NEW;
  end if;

  -- Determine if the calling user is an admin.
  select is_admin into caller_is_admin
  from public.profiles
  where id = auth.uid();

  if caller_is_admin is not true then
    -- Non-admin users: silently reset all protected columns to their old values.
    NEW.is_admin                    := OLD.is_admin;
    NEW.plan                        := OLD.plan;
    NEW.stripe_customer_id          := OLD.stripe_customer_id;
    NEW.stripe_subscription_id      := OLD.stripe_subscription_id;
    NEW.stripe_subscription_status  := OLD.stripe_subscription_status;
    NEW.stripe_current_period_end   := OLD.stripe_current_period_end;
    NEW.courtesy_until              := OLD.courtesy_until;
    NEW.is_banned                   := OLD.is_banned;
    NEW.is_shadowbanned             := OLD.is_shadowbanned;
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_privilege_escalation_guard on public.profiles;
create trigger profiles_privilege_escalation_guard
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();


-- ─── 11. HARDEN: push_notification_logs — ensure no regular user INSERT ──────
-- Already admin-only in v13, but explicitly re-confirm with service-role access.
-- (No change needed, verifying correctness of existing policy.)
-- pnl_insert_admin: with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true))


-- ─── 12. DOCUMENTED EXCEPTION: plans — intentional public SELECT ──────────────
-- The `plans` table (defined in migrations_v11.sql) has:
--   plans_select:        using (true)              → public read  [INTENTIONAL]
--   plans_insert_admin:  admin only                → protected ✓
--   plans_update_admin:  admin only                → protected ✓
--   plans_delete_admin:  admin only                → protected ✓
--
-- REASON: The pricing/plans page is shown to all visitors (authenticated and
-- anonymous) before they sign up. Public SELECT is a PRODUCT REQUIREMENT and
-- NOT a security risk — the table contains only non-sensitive commercial data
-- (names, prices, feature lists). Write operations remain strictly admin-only.
-- No change to plans policies is required.


-- ─── Summary / Audit Matrix ──────────────────────────────────────────────────
--
-- TABLE                  | SELECT          | INSERT           | UPDATE  | DELETE
-- -----------------------|-----------------|------------------|---------|--------
-- notifications          | own user_id     | FALSE (blocked)  | own     | —
-- feature_flags          | public (true)   | admin only       | admin   | admin
-- market_posts           | authenticated   | admin only       | admin   | owner|admin
-- market_post_likes      | authenticated   | self (user_id)   | —       | self
-- market_post_comments   | authenticated   | self (author_id) | self    | self|admin
-- notification_broadcasts| admin only      | admin only       | —       | admin
-- opportunity_applications| self|creator  | self             | —       | self ← ADDED
-- support_messages       | self|admin ←FIX | self             | —       | —
-- bug_reports            | self|admin ←FIX | self             | —       | —
-- profiles               | public          | self             | self|adm| —  + trigger
-- plans                  | public [INTENT] | admin only       | admin   | admin
-- push_notification_logs | admin only      | admin only (v13) | —       | —
-- push_tokens            | own user_id     | self upsert      | self    | self
--
-- ─── Verification queries (run after migration to confirm) ───────────────────
-- Execute in Supabase SQL Editor to confirm all policies are in place:

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where tablename in (
  'notifications', 'feature_flags', 'market_posts', 'market_post_likes',
  'market_post_comments', 'notification_broadcasts', 'opportunity_applications',
  'support_messages', 'bug_reports', 'profiles', 'plans',
  'push_notification_logs', 'push_tokens'
)
order by tablename, cmd;

-- ─── Related code fixes (not SQL) ────────────────────────────────────────────
-- ✓ api-server/routes/push.ts: JWT auth guard + participant verification +
--     server-side push_tokens lookup via service role + rate limiting (20/min)
-- ✓ ibhub/services/api.ts: dispatchPushToConversation sends conversationId only;
--     server resolves participants and tokens server-side
--
-- ─── Storage buckets verified (no changes needed) ────────────────────────────
-- post-images: auth.uid()::text = foldername(name)[1]  ✓ (migrations_v2.sql)
-- stories:     auth.uid()::text = foldername(name)[1]  ✓ (migrations_v34_storage_rls)
-- cvs:         auth.uid()::text = foldername(name)[2]  ✓ (migrations_v34_storage_rls)
-- pslides:     admin-only INSERT/DELETE                 ✓ (migrations_v40_drip_content)
