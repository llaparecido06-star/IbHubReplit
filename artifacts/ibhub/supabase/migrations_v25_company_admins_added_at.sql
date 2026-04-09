-- v25: Add added_at column to company_page_admins (was missing from v2 schema)
-- Also adds role column update RLS to allow admins to see peer admins

ALTER TABLE public.company_page_admins
  ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now();

-- Allow members to see other members of companies they belong to
DROP POLICY IF EXISTS "cpa_select" ON public.company_page_admins;
CREATE POLICY "cpa_select" ON public.company_page_admins FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.company_pages p
      WHERE p.id = company_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.company_page_admins cpa2
      WHERE cpa2.company_id = company_page_admins.company_id
        AND cpa2.user_id = auth.uid()
    )
  );
