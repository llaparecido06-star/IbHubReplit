-- ibhub — Migração v3: market_overview
-- Tabela de inteligência de mercado editável pelo admin via painel Supabase.
-- Cada linha = 1 período ('mes' | 'trimestre' | 'ano').
-- Colunas JSONB permitem ao admin atualizar cada seção independentemente.
-- Execute no Supabase Dashboard → SQL Editor.

-- ─── Tabela ────────────────────────────────────────────────────────────────────

create table if not exists public.market_overview (
  period       text primary key check (period in ('mes', 'trimestre', 'ano')),
  kpis         jsonb not null default '[]'::jsonb,
  chart_area   jsonb not null default '{}'::jsonb,
  chart_bar    jsonb not null default '{}'::jsonb,
  tendencias   jsonb not null default '[]'::jsonb,
  regioes      jsonb not null default '[]'::jsonb,
  variedades   jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.market_overview enable row level security;

-- Leitura pública (usuários autenticados e anon)
create policy "mo_select" on public.market_overview for select using (true);

-- Escrita apenas via service_role (admin Supabase)

-- ─── Dados iniciais ────────────────────────────────────────────────────────────

insert into public.market_overview (period, kpis, chart_area, chart_bar, tendencias, regioes, variedades) values

-- ÚLTIMO MÊS (semanas)
('mes',
  '[
    {"label":"Exportações BR",       "value":"US$ 3.8M",    "period":"Mar/2026","change":9.2, "icon":"globe"},
    {"label":"Importações de Vinho", "value":"R$ 185M",     "period":"Mar/2026","change":6.1, "icon":"trending-up"},
    {"label":"Produção Nacional",    "value":"29M litros",  "period":"Mar/2026","change":3.5, "icon":"bar-chart-2"}
  ]'::jsonb,
  '{
    "exports": [28, 30, 34, 38],
    "imports": [68, 71, 77, 82],
    "labels":  ["Sem 1","Sem 2","Sem 3","Sem 4"],
    "yLabels": ["0","50","100","150","200"]
  }'::jsonb,
  '{
    "values": [78, 75, 83, 81],
    "labels": ["Sem 1","Sem 2","Sem 3","Sem 4"]
  }'::jsonb,
  '[
    {"title":"Espumantes brasileiros em alta",       "desc":"Crescimento de 22% nas vendas de espumantes nacionais, com destaque para a Serra Gaúcha no mês de março.",         "change":22,  "pos":true},
    {"title":"Vinhos naturais ganham espaço",        "desc":"Segmento de vinhos naturais e orgânicos cresce 15% ao mês, impulsionado por consumidores jovens.",                  "change":15,  "pos":true},
    {"title":"Importação de tintos chilenos recua",  "desc":"Queda de 3.2% nas importações de tintos do Chile em relação à mesma semana do mês passado.",                        "change":-3.2,"pos":false}
  ]'::jsonb,
  '[
    {"rank":1,"name":"Serra Gaúcha",         "volume":"15M litros","pct":51},
    {"rank":2,"name":"Campanha Gaúcha",      "volume":"4M litros", "pct":13},
    {"rank":3,"name":"Vale do São Francisco","volume":"3M litros", "pct":11},
    {"rank":4,"name":"Planalto Catarinense", "volume":"2M litros", "pct":6}
  ]'::jsonb,
  '[
    {"name":"Merlot",             "volume":"3.5M litros","change":5.1},
    {"name":"Cabernet Sauvignon", "volume":"3.2M litros","change":3.8},
    {"name":"Chardonnay",         "volume":"2.3M litros","change":9.2},
    {"name":"Pinot Noir",         "volume":"1.5M litros","change":2.1}
  ]'::jsonb
),

-- TRIMESTRE YTD (meses)
('trimestre',
  '[
    {"label":"Exportações BR",       "value":"US$ 11.2M", "period":"Q1 2026","change":10.8,"icon":"globe"},
    {"label":"Importações de Vinho", "value":"R$ 540M",   "period":"Q1 2026","change":7.4, "icon":"trending-up"},
    {"label":"Produção Nacional",    "value":"88M litros","period":"Q1 2026","change":4.1, "icon":"bar-chart-2"}
  ]'::jsonb,
  '{
    "exports": [30, 34, 38],
    "imports": [70, 76, 84],
    "labels":  ["Jan","Fev","Mar"],
    "yLabels": ["0","150","300","450","600"]
  }'::jsonb,
  '{
    "values": [78, 82, 85],
    "labels": ["Jan","Fev","Mar"]
  }'::jsonb,
  '[
    {"title":"Espumantes brasileiros em alta",      "desc":"Crescimento de 18% nas vendas de espumantes nacionais no Q1 2026, com destaque para a Serra Gaúcha.",       "change":18,  "pos":true},
    {"title":"Vinhos naturais ganham espaço",       "desc":"Segmento de vinhos naturais e orgânicos cresce 12% no trimestre, impulsionado por consumidores jovens.",      "change":12,  "pos":true},
    {"title":"Importação de tintos chilenos recua", "desc":"Queda de 4.1% nas importações de tintos do Chile no Q1 em relação ao mesmo trimestre do ano anterior.",       "change":-4.1,"pos":false}
  ]'::jsonb,
  '[
    {"rank":1,"name":"Serra Gaúcha",         "volume":"45M litros","pct":51},
    {"rank":2,"name":"Campanha Gaúcha",      "volume":"12M litros","pct":13},
    {"rank":3,"name":"Vale do São Francisco","volume":"10M litros","pct":11},
    {"rank":4,"name":"Planalto Catarinense", "volume":"5M litros", "pct":6}
  ]'::jsonb,
  '[
    {"name":"Merlot",             "volume":"10.5M litros","change":4.8},
    {"name":"Cabernet Sauvignon", "volume":"9.5M litros", "change":3.5},
    {"name":"Chardonnay",         "volume":"7M litros",   "change":8.9},
    {"name":"Pinot Noir",         "volume":"4.5M litros", "change":1.9}
  ]'::jsonb
),

-- ÚLTIMO ANO (trimestres)
('ano',
  '[
    {"label":"Exportações BR",       "value":"US$ 42M",     "period":"2025","change":12.5,"icon":"globe"},
    {"label":"Importações de Vinho", "value":"R$ 2.1B",     "period":"2025","change":8.3, "icon":"trending-up"},
    {"label":"Produção Nacional",    "value":"350M litros", "period":"2025","change":4.7, "icon":"bar-chart-2"}
  ]'::jsonb,
  '{
    "exports": [32, 35, 38, 44],
    "imports": [72, 79, 86, 91],
    "labels":  ["Q1","Q2","Q3","Q4"],
    "yLabels": ["0","150","300","450","600"]
  }'::jsonb,
  '{
    "values": [75, 80, 85, 87],
    "labels": ["Q1","Q2","Q3","Q4"]
  }'::jsonb,
  '[
    {"title":"Espumantes brasileiros em alta",      "desc":"Crescimento de 22% nas vendas de espumantes nacionais em 2025, com destaque para a Serra Gaúcha.",            "change":22,  "pos":true},
    {"title":"Vinhos naturais ganham espaço",       "desc":"Segmento de vinhos naturais e orgânicos cresceu 15% ao ano, impulsionado por consumidores jovens.",           "change":15,  "pos":true},
    {"title":"Importação de tintos chilenos recua", "desc":"Queda de 3.2% nas importações de tintos do Chile em 2025 em relação ao ano anterior.",                        "change":-3.2,"pos":false}
  ]'::jsonb,
  '[
    {"rank":1,"name":"Serra Gaúcha",         "volume":"180M litros","pct":51},
    {"rank":2,"name":"Campanha Gaúcha",      "volume":"45M litros", "pct":13},
    {"rank":3,"name":"Vale do São Francisco","volume":"38M litros", "pct":11},
    {"rank":4,"name":"Planalto Catarinense", "volume":"22M litros", "pct":6}
  ]'::jsonb,
  '[
    {"name":"Merlot",             "volume":"42M litros","change":5.1},
    {"name":"Cabernet Sauvignon", "volume":"38M litros","change":3.8},
    {"name":"Chardonnay",         "volume":"28M litros","change":9.2},
    {"name":"Pinot Noir",         "volume":"18M litros","change":2.1}
  ]'::jsonb
)

on conflict (period) do nothing;
