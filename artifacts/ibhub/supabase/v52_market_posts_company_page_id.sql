-- v52: market_posts — adiciona company_page_id para gravar qual empresa é autora
-- Todos os posts do feed Ideal.BI pertencem à empresa Ideal.BI, não ao perfil pessoal
-- de quem os publicou.

-- 1. Adiciona coluna (FK opcional para company_pages)
ALTER TABLE public.market_posts
  ADD COLUMN IF NOT EXISTS company_page_id uuid REFERENCES public.company_pages(id) ON DELETE SET NULL;

-- 2. Backfill: atribui todos os posts existentes à página da empresa Ideal.BI
UPDATE public.market_posts
SET company_page_id = (
  SELECT id FROM public.company_pages
  WHERE name ILIKE 'Ideal.BI'
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE company_page_id IS NULL;

-- 3. Índice para consulta eficiente por empresa
CREATE INDEX IF NOT EXISTS idx_market_posts_company_page_id
  ON public.market_posts (company_page_id);
