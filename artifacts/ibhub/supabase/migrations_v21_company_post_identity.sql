-- ── migrations_v21: Identidade de empresa em posts, likes e comentários ──────
-- Permite que posts, likes e comentários sejam atribuídos a uma página
-- empresarial, em vez de apenas ao perfil pessoal do usuário.
-- Como aplicar: Supabase Dashboard → SQL Editor → cole e execute este script.

-- 1. Adiciona company_page_id em posts
alter table public.posts
  add column if not exists company_page_id uuid
    references public.company_pages(id) on delete set null;

-- 2. Adiciona company_page_id em likes
alter table public.likes
  add column if not exists company_page_id uuid
    references public.company_pages(id) on delete set null;

-- 3. Adiciona company_page_id em comments
alter table public.comments
  add column if not exists company_page_id uuid
    references public.company_pages(id) on delete set null;

-- 4. Índices para consultas eficientes
create index if not exists idx_posts_company_page_id
  on public.posts (company_page_id) where company_page_id is not null;

create index if not exists idx_likes_company_page_id
  on public.likes (company_page_id) where company_page_id is not null;

create index if not exists idx_comments_company_page_id
  on public.comments (company_page_id) where company_page_id is not null;
