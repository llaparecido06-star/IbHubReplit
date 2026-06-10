-- ============================================================
-- v52b — Correção da policy event_registrations
-- A v52 falhou porque a policy er_authenticated referenciava
-- user_id, coluna que não existe nessa tabela.
-- event_registrations é inserida exclusivamente pelo API server
-- via service_role (que bypassa RLS), sem coluna de auth.
-- ============================================================

-- Remove a policy errada que pode ter ficado parcialmente criada
DROP POLICY IF EXISTS "Service role full access" ON public.event_registrations;
DROP POLICY IF EXISTS er_authenticated           ON public.event_registrations;

-- Bloqueia acesso direto via REST (anon / authenticated).
-- O API server usa service_role e bypassa o RLS automaticamente.
CREATE POLICY er_no_direct_access ON public.event_registrations
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
