-- ibhub — Migração v6: Oportunidades completas + Notificações corrigidas
-- Execute no SQL Editor do Supabase.

-- ─── 1. Corrige notifications (colunas faltantes) ────────────────────────────
alter table public.notifications
  add column if not exists actor_id      uuid references auth.users(id) on delete set null,
  add column if not exists message       text,
  add column if not exists opportunity_id uuid;

-- ─── 2. Completa a tabela opportunities (pode já existir com poucas colunas) ──
alter table public.opportunities
  add column if not exists created_by    uuid references auth.users(id) on delete cascade,
  add column if not exists type          text default 'vaga'
                             check (type in ('vaga', 'marketplace')),
  add column if not exists title         text,
  add column if not exists description   text,
  add column if not exists category      text,
  add column if not exists location      text,
  add column if not exists price         text,
  add column if not exists company       text,
  add column if not exists contract_type text,
  add column if not exists salary        text,
  add column if not exists contact_email text,
  add column if not exists expires_at    timestamptz,
  add column if not exists is_active     boolean not null default true;

-- NOT NULL retroativo (só funciona em tabelas vazias; em produção ignore se der erro)
-- alter table public.opportunities alter column created_by set not null;
-- alter table public.opportunities alter column type set not null;
-- alter table public.opportunities alter column title set not null;

-- ─── 3. RLS em opportunities ─────────────────────────────────────────────────
alter table public.opportunities enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunities' and policyname = 'Opp select public'
  ) then
    create policy "Opp select public"
      on public.opportunities for select
      using (is_active = true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunities' and policyname = 'Opp insert auth'
  ) then
    create policy "Opp insert auth"
      on public.opportunities for insert
      to authenticated
      with check (auth.uid() = created_by);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunities' and policyname = 'Opp update owner'
  ) then
    create policy "Opp update owner"
      on public.opportunities for update
      to authenticated
      using (auth.uid() = created_by);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunities' and policyname = 'Opp delete owner'
  ) then
    create policy "Opp delete owner"
      on public.opportunities for delete
      to authenticated
      using (auth.uid() = created_by);
  end if;
end $$;

-- ─── 4. Cria tabela opportunity_applications ─────────────────────────────────
create table if not exists public.opportunity_applications (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  applicant_id   uuid not null references auth.users(id) on delete cascade,
  cv_url         text,
  message        text,
  created_at     timestamptz not null default now(),
  unique(opportunity_id, applicant_id)
);

alter table public.opportunity_applications enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunity_applications' and policyname = 'App insert self'
  ) then
    create policy "App insert self"
      on public.opportunity_applications for insert
      to authenticated
      with check (auth.uid() = applicant_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunity_applications' and policyname = 'App select self or creator'
  ) then
    create policy "App select self or creator"
      on public.opportunity_applications for select
      to authenticated
      using (
        auth.uid() = applicant_id or
        auth.uid() = (
          select created_by from public.opportunities
          where id = opportunity_id
        )
      );
  end if;
end $$;

-- ─── 5. Bucket CVs (execute via Dashboard → Storage → New Bucket) ─────────────
-- Nome: cvs | Public: false
