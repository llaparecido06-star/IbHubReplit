-- v49: Support user-targeted reports
-- Makes post_id nullable, adds reported_user_id,
-- and adds a CHECK constraint: exactly one target must be set.

-- Drop the NOT NULL constraint on post_id
alter table public.reports
  alter column post_id drop not null;

-- Add reported_user_id (nullable FK to profiles, cascades on profile delete)
alter table public.reports
  add column if not exists reported_user_id uuid references public.profiles(id) on delete cascade;

-- Enforce: exactly one of post_id or reported_user_id must be set
alter table public.reports
  drop constraint if exists reports_target_check;

alter table public.reports
  add constraint reports_target_check check (
    (post_id is not null and reported_user_id is null)
    or
    (post_id is null and reported_user_id is not null)
  );

-- Update the insert policy so users can also submit user reports
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
  for insert with check (
    auth.uid() = reported_by
    and (
      (post_id is not null and reported_user_id is null)
      or
      (post_id is null and reported_user_id is not null)
    )
  );

-- Allow users to read their own submitted reports (required for "Minhas Denúncias")
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reported_by);
