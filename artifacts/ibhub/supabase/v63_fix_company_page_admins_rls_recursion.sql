-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v63 — Fix infinite recursion in company_page_admins RLS
-- ───────────────────────────────────────────────────────────────────────────────
-- Root cause: PostgreSQL 42P17 "infinite recursion detected in policy for
-- relation company_page_admins".
-- The cpa_select policy (introduced in v25/v28) checks membership by doing
-- SELECT FROM company_page_admins inside the policy itself, which triggers
-- the policy again — creating an infinite loop whenever any code queries
-- the table (including upsert conflict resolution).
--
-- Fix: Create a SECURITY DEFINER helper function that bypasses RLS entirely
-- when checking membership. The cpa_select policy uses this function instead
-- of querying the table directly.
--
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── Step 1: SECURITY DEFINER membership checker ──────────────────────────────
-- Runs as the table owner (bypasses RLS), breaking the recursion loop.
CREATE OR REPLACE FUNCTION public.is_company_page_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_page_admins
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
  );
$$;


-- ── Step 2: Replace the recursive cpa_select policy ──────────────────────────
DROP POLICY IF EXISTS "cpa_select" ON public.company_page_admins;

CREATE POLICY "cpa_select" ON public.company_page_admins
  FOR SELECT USING (
    -- Own row — direct column check, zero recursion
    auth.uid() = user_id
    -- Page owner sees all admins of their page
    OR EXISTS (
      SELECT 1 FROM public.company_pages p
      WHERE p.id = company_id
        AND p.owner_id = auth.uid()
    )
    -- Peer admins of the same company — via SECURITY DEFINER function (no recursion)
    OR public.is_company_page_admin(company_id)
  );


-- ── Step 3: Ensure insert/delete policies also don't recurse ─────────────────
-- The original cpa_insert and cpa_delete from v2 only check company_pages,
-- so they are safe. We recreate them here to be explicit and ensure
-- they are up to date.

DROP POLICY IF EXISTS "cpa_insert" ON public.company_page_admins;
CREATE POLICY "cpa_insert" ON public.company_page_admins
  FOR INSERT WITH CHECK (
    -- Only the page owner or an existing admin may add new admins
    EXISTS (
      SELECT 1 FROM public.company_pages p
      WHERE p.id = company_id
        AND p.owner_id = auth.uid()
    )
    OR public.is_company_page_admin(company_id)
  );

DROP POLICY IF EXISTS "cpa_delete" ON public.company_page_admins;
CREATE POLICY "cpa_delete" ON public.company_page_admins
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.company_pages p
      WHERE p.id = company_id
        AND p.owner_id = auth.uid()
    )
    OR public.is_company_page_admin(company_id)
  );

DROP POLICY IF EXISTS "cpa_update" ON public.company_page_admins;
CREATE POLICY "cpa_update" ON public.company_page_admins
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.company_pages p
      WHERE p.id = company_id
        AND p.owner_id = auth.uid()
    )
    OR public.is_company_page_admin(company_id)
  );


-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'company_page_admins'
ORDER BY policyname;
