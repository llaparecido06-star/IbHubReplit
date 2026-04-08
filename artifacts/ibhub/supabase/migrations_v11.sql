-- ibhub — Migração v11: Admin CRM, Financeiro e Plan Builder — Dados Reais
-- Execute no Supabase Dashboard → SQL Editor.

-- ─── 1. Novas colunas em profiles ────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_banned        boolean not null default false,
  add column if not exists is_shadowbanned  boolean not null default false,
  add column if not exists courtesy_until   timestamptz;

-- ─── 1b. Actualizar constraint do plano (suportar todos os IDs de plano) ─────
-- Remove the old narrow check constraint and replace with an open-ended one
-- that allows any non-empty text (plan name validated at application layer).
do $$
declare
  cname text;
begin
  select conname into cname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and conname ilike '%plan%'
    limit 1;
  if cname is not null then
    execute format('alter table public.profiles drop constraint %I', cname);
  end if;
end $$;

alter table public.profiles
  alter column plan set default 'gratuito';

-- ─── 2. Tabela plans ─────────────────────────────────────────────────────────
create table if not exists public.plans (
  id           text primary key,
  name         text not null,
  subtitle     text not null default '',
  price_cents  int not null default 0,
  features     text[] not null default '{}',
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ─── 3. RLS para plans ───────────────────────────────────────────────────────
alter table public.plans enable row level security;

-- Qualquer um pode ler planos
drop policy if exists "plans_select" on public.plans;
create policy "plans_select" on public.plans for select using (true);

-- Apenas admins podem inserir/atualizar/deletar
drop policy if exists "plans_insert_admin" on public.plans;
create policy "plans_insert_admin" on public.plans for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "plans_update_admin" on public.plans;
create policy "plans_update_admin" on public.plans for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "plans_delete_admin" on public.plans;
create policy "plans_delete_admin" on public.plans for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ─── 4. RLS em profiles: admin pode atualizar qualquer perfil ────────────────
-- Drop the existing narrow update policy and replace with one that also allows admins
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- ─── 5. Seed de planos padrão (só insere se a tabela estiver vazia) ──────────
insert into public.plans (id, name, subtitle, price_cents, features, is_active, sort_order)
select * from (values
  ('gratuito',     'Gratuito',     'Acesso básico à plataforma',                          0,       array['Chat ilimitado','Criar Grupos','Ver Visitantes do Perfil','Smart Match B2B','Visão Geral de Mercado','Relatórios Detalhados','Exportar CSV','Criar Página Empresa','Publicar Vagas','Marketplace B2B','Impulsionar Posts','Upload Certificados','Masterclasses'], true,  0),
  ('profissional', 'Profissional', 'Acesso à inteligência de mercado',                    9990,    array[]::text[], true,  1),
  ('basico',       'Básico',       'Recursos profissionais essenciais',                   14900,   array['Chat ilimitado','Criar Grupos','Visão Geral de Mercado','Relatórios Detalhados','Criar Página Empresa','Publicar Vagas','Upload Certificados'], true, 2),
  ('empresa',      'Empresa',      'Painel de gestão e criação de oportunidades',         24700,   array[]::text[], true,  3),
  ('executivo',    'Executivo',    'Acesso completo a todas as funcionalidades',           49900,   array['Chat ilimitado','Criar Grupos','Ver Visitantes do Perfil','Smart Match B2B','Visão Geral de Mercado','Relatórios Detalhados','Exportar CSV','Criar Página Empresa','Publicar Vagas','Marketplace B2B','Impulsionar Posts','Upload Certificados','Masterclasses'], true, 4)
) as v(id, name, subtitle, price_cents, features, is_active, sort_order)
where not exists (select 1 from public.plans limit 1);
