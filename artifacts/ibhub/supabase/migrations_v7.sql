-- ── migrations_v7: Regra empresa-only para publicar oportunidades ────────────
-- Apenas contas com profile_type = 'empresa' podem inserir oportunidades.
-- Aplicar no Supabase SQL Editor.

-- 1. Remove política de insert anterior (se existir) para substituir
do $$ begin
  if exists (
    select 1 from pg_policies
    where tablename = 'opportunities' and policyname = 'App insert auth'
  ) then
    drop policy "App insert auth" on public.opportunities;
  end if;
end $$;

-- 2. Cria nova política: apenas empresa pode inserir
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunities' and policyname = 'Empresa only insert'
  ) then
    create policy "Empresa only insert"
      on public.opportunities for insert
      to authenticated
      with check (
        auth.uid() = created_by
        and exists (
          select 1 from public.profiles
          where id = auth.uid()
            and profile_type = 'empresa'
        )
      );
  end if;
end $$;

-- 3. Garante que apenas o criador pode atualizar/desativar suas oportunidades
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunities' and policyname = 'Creator update'
  ) then
    create policy "Creator update"
      on public.opportunities for update
      to authenticated
      using (auth.uid() = created_by)
      with check (auth.uid() = created_by);
  end if;
end $$;

-- 4. Candidaturas: empresa pode ler candidaturas das suas oportunidades
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'opportunity_applications' and policyname = 'Creator reads applications'
  ) then
    create policy "Creator reads applications"
      on public.opportunity_applications for select
      to authenticated
      using (
        -- O candidato pode ver sua própria candidatura
        auth.uid() = applicant_id
        or
        -- O criador da oportunidade pode ver todas as candidaturas
        exists (
          select 1 from public.opportunities o
          where o.id = opportunity_id
            and o.created_by = auth.uid()
        )
      );
  end if;
end $$;
