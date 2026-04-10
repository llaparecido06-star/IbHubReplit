-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v33: Painel de administração da empresa
-- Adiciona company_page_id em opportunities e events para vincular
-- publicações a páginas de empresa.  Adiciona view_count, sold e
-- sold_via_ibhub para rastreamento no marketplace.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Vincular oportunidades a páginas de empresa ───────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS company_page_id uuid REFERENCES public.company_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS view_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sold_via_ibhub  boolean NOT NULL DEFAULT false;

-- ── 2. Vincular eventos a páginas de empresa ─────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS company_page_id uuid REFERENCES public.company_pages(id) ON DELETE SET NULL;

-- ── 3. Índices para queries do painel ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_opportunities_company_page_id ON public.opportunities(company_page_id);
CREATE INDEX IF NOT EXISTS idx_events_company_page_id        ON public.events(company_page_id);

-- ── 4. RPC: incrementar view_count de oportunidade (SECURITY DEFINER) ────────
CREATE OR REPLACE FUNCTION public.increment_opportunity_views(p_opportunity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE opportunities SET view_count = view_count + 1 WHERE id = p_opportunity_id;
END;
$$;

-- ── 5. RPC: candidatos de uma oportunidade (com perfil) ───────────────────────
-- Retorna candidatos + dados de perfil para o painel da empresa.
CREATE OR REPLACE FUNCTION public.get_opportunity_applicants(p_opportunity_id uuid)
RETURNS TABLE (
  id           uuid,
  applicant_id uuid,
  cv_url       text,
  message      text,
  status       text,
  created_at   timestamptz,
  full_name    text,
  avatar_url   text,
  headline     text,
  username     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oa.id,
    oa.applicant_id,
    oa.cv_url,
    oa.message,
    COALESCE(oa.status, 'pending') as status,
    oa.created_at,
    p.full_name::text,
    p.avatar_url::text,
    p.headline::text,
    p.username::text
  FROM opportunity_applications oa
  LEFT JOIN profiles p ON p.id = oa.applicant_id
  WHERE oa.opportunity_id = p_opportunity_id
  ORDER BY oa.created_at DESC;
END;
$$;

-- ── 6. Adicionar coluna status em opportunity_applications (se não existir) ───
ALTER TABLE public.opportunity_applications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- status: 'pending' | 'reviewed' | 'shortlisted' | 'hired' | 'rejected'
