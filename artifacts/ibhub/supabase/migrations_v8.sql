-- ── migrations_v8: Completar tabela events + RLS ────────────────────────────
-- Adicionar colunas faltantes e políticas para eventos e presença.
-- Aplicar no Supabase SQL Editor.

-- 1. Adiciona colunas faltantes em events
alter table public.events
  add column if not exists location      text,
  add column if not exists visibility    text not null default 'publico',
  add column if not exists is_active     boolean not null default true,
  add column if not exists pay_link      text;

-- 2. RLS para events (SELECT aberto, INSERT/UPDATE autenticado)
alter table public.events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='events' and policyname='Events public read') then
    create policy "Events public read"
      on public.events for select
      using (is_active = true and (visibility = 'publico' or auth.uid() = user_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='events' and policyname='Events auth insert') then
    create policy "Events auth insert"
      on public.events for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='events' and policyname='Events owner update') then
    create policy "Events owner update"
      on public.events for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 3. RLS para event_attendees
alter table public.event_attendees enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='event_attendees' and policyname='Attendees public read') then
    create policy "Attendees public read"
      on public.event_attendees for select
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='event_attendees' and policyname='Attendees self insert') then
    create policy "Attendees self insert"
      on public.event_attendees for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='event_attendees' and policyname='Attendees self delete') then
    create policy "Attendees self delete"
      on public.event_attendees for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='event_attendees' and policyname='Attendees self update') then
    create policy "Attendees self update"
      on public.event_attendees for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
