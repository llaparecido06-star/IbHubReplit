-- ═══════════════════════════════════════════════════════════════════════════
-- ibhub — Migração v44: EAN na adega + ranking comunitário de vinhos
-- Execute no Supabase: Dashboard → SQL Editor → New Query
-- Seguro rodar múltiplas vezes (IF NOT EXISTS / OR REPLACE)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Adicionar coluna EAN à tabela wine_cellar
alter table public.wine_cellar
  add column if not exists ean text;

-- Índice para buscas por EAN (ranking comunitário)
create index if not exists idx_wine_cellar_ean on public.wine_cellar (ean)
  where ean is not null;

-- 2. RPC: wine_community_ratings
--    Agrega avaliações públicas por EAN, ordenadas por nota média desc.
--    Inclui apenas entradas com is_private = false, rating > 0 e ean preenchido.
create or replace function public.wine_community_ratings(p_ean text default null)
returns table (
  ean           text,
  name          text,
  producer      text,
  vintage       text,
  avg_rating    numeric,
  rating_count  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ean,
    -- Usa o nome mais recente associado ao EAN como representante
    (array_agg(name order by created_at desc))[1]        as name,
    (array_agg(producer order by created_at desc))[1]    as producer,
    (array_agg(vintage order by created_at desc))[1]     as vintage,
    round(avg(rating)::numeric, 1)                       as avg_rating,
    count(*)                                             as rating_count
  from public.wine_cellar
  where
    is_private = false
    and rating > 0
    and ean is not null
    and ean <> ''
    and (p_ean is null or ean = p_ean)
  group by ean
  order by avg_rating desc, rating_count desc;
$$;

-- Permite chamada anônima (leitura pública agregada, sem expor dados individuais)
grant execute on function public.wine_community_ratings(text) to anon, authenticated;
