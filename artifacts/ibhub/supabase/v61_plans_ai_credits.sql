-- v61: add ai_search_credits to plans table
alter table plans
  add column if not exists ai_search_credits integer not null default 0;

-- Set sensible defaults for existing plans based on their IDs
update plans set ai_search_credits = 0  where id in ('gratuito', 'free');
update plans set ai_search_credits = 3  where id in ('profissional', 'premium');
update plans set ai_search_credits = 10 where id in ('empresas', 'business');
update plans set ai_search_credits = 25 where id in ('exclusive', 'exclusivo');
