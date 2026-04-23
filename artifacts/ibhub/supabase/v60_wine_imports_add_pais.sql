-- v60: add pais_de_origem to wine_imports (missed in v58)
alter table wine_imports
  add column if not exists pais_de_origem text;
