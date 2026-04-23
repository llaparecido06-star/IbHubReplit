-- v58: wine_imports table for Ideal.BI search
create table if not exists wine_imports (
  id              bigserial primary key,
  marca_completa  text not null,
  marca_relatorio text,
  distribuidor    text,
  created_at      timestamptz not null default now()
);

create index if not exists wine_imports_marca_completa_idx
  on wine_imports using gin (to_tsvector('portuguese', marca_completa));

create index if not exists wine_imports_marca_relatorio_idx
  on wine_imports using gin (to_tsvector('portuguese', coalesce(marca_relatorio, '')));

alter table wine_imports enable row level security;

create policy "Service role full access on wine_imports"
  on wine_imports for all
  to service_role
  using (true)
  with check (true);

create policy "Authenticated users can read wine_imports"
  on wine_imports for select
  to authenticated
  using (true);
