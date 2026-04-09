-- ── migrations_v22: Índice único separado para curtidas pessoais vs empresa ──
-- O índice anterior (post_id, user_id) não diferencia identidade pessoal
-- de identidade empresarial. Esta migration adiciona índices parciais
-- para garantir que cada entidade (pessoa ou empresa) só possa curtir
-- um post uma vez, independentemente da outra.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cole e execute.

-- Remove índice antigo (pode não existir com esse nome, ignore se falhar)
drop index if exists public.likes_post_id_user_id_key;
drop index if exists public.likes_pkey; -- nunca remover PK

-- Cria índice parcial para curtidas PESSOAIS (sem empresa ativa)
create unique index if not exists uq_likes_personal
  on public.likes (post_id, user_id)
  where company_page_id is null;

-- Cria índice parcial para curtidas de EMPRESA
create unique index if not exists uq_likes_company
  on public.likes (post_id, company_page_id)
  where company_page_id is not null;
