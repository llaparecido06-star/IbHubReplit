-- v59: AI search credits per user (monthly renewal)
create table if not exists ai_search_credits (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  credits_remaining int  not null default 3,
  credits_total     int  not null default 3,
  period_start      date not null default date_trunc('month', now())::date,
  updated_at        timestamptz not null default now()
);

alter table ai_search_credits enable row level security;

create policy "Service role full access on ai_search_credits"
  on ai_search_credits for all
  to service_role
  using (true)
  with check (true);

create policy "Users can read own credits"
  on ai_search_credits for select
  to authenticated
  using (auth.uid() = user_id);
