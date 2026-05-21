-- v72: Allow editors to update company page info
-- Previously only the owner_id could UPDATE company_pages (cp_update policy).
-- Editors listed in company_page_admins with role = 'editor' now also get
-- UPDATE access, enabling them to edit name, logo, bio, website, etc.

DROP POLICY IF EXISTS "cp_update" ON public.company_pages;

CREATE POLICY "cp_update" ON public.company_pages
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.company_page_admins
      WHERE company_id = id
        AND user_id    = auth.uid()
        AND role       = 'editor'
    )
  );
