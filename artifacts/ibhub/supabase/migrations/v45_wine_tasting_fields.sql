-- ═══════════════════════════════════════════════════════════════════════════
-- ibhub — Migração v45: Campos de degustação unificados no wine_cellar
-- Execute no Supabase: Dashboard → SQL Editor → New Query
-- Seguro rodar múltiplas vezes (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Adicionar campos de avaliação sensorial e pontuação 0–100
alter table public.wine_cellar
  add column if not exists aroma         text,
  add column if not exists sabor         text,
  add column if not exists harmonizacao  text,
  add column if not exists score_100     int check (score_100 is null or (score_100 >= 0 and score_100 <= 100));

-- Garantir que a coluna grape existe (migração anterior pode não ter sido executada)
alter table public.wine_cellar
  add column if not exists grape text;

-- Garantir que a coluna ean existe
alter table public.wine_cellar
  add column if not exists ean text;

-- Índice para busca rápida por EAN
create index if not exists idx_wine_cellar_ean on public.wine_cellar (ean)
  where ean is not null;

-- Garantia de unicidade: um mesmo usuário não pode cadastrar o mesmo EAN duas vezes
-- (permite múltiplas entradas de vinos diferentes sem EAN = null)
create unique index if not exists uq_wine_cellar_user_ean
  on public.wine_cellar (user_id, ean)
  where ean is not null and ean <> '';

-- Constraint de check: EAN deve ter pelo menos 8 dígitos quando informado
-- (EAN-8 mínimo; EAN-13 é o padrão de vinhos importados)
alter table public.wine_cellar
  drop constraint if exists chk_wine_cellar_ean_format;

alter table public.wine_cellar
  add constraint chk_wine_cellar_ean_format
    check (ean is null or ean = '' or length(trim(ean)) >= 8);

-- Atualizar a RPC de ranking comunitário para incluir score_100 médio
create or replace function public.wine_community_ratings(p_ean text default null)
returns table (
  ean           text,
  name          text,
  producer      text,
  vintage       text,
  grape         text,
  avg_rating    numeric,
  avg_score     numeric,
  total_ratings bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ean,
    (array_agg(name         order by created_at desc))[1] as name,
    (array_agg(producer      order by created_at desc))[1] as producer,
    (array_agg(vintage       order by created_at desc))[1] as vintage,
    (array_agg(grape         order by created_at desc))[1] as grape,
    round(avg(rating)::numeric, 1)                         as avg_rating,
    round(avg(score_100)::numeric, 1)                      as avg_score,
    count(*)                                               as total_ratings
  from public.wine_cellar
  where
    is_private = false
    and rating > 0
    and ean is not null
    and ean <> ''
    and (p_ean is null or ean = p_ean)
  group by ean
  order by avg_rating desc, total_ratings desc;
$$;

grant execute on function public.wine_community_ratings(text) to anon, authenticated;
