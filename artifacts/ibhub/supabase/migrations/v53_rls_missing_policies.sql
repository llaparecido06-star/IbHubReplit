-- ============================================================
-- v53 — RLS: Adiciona policies em tabelas sem nenhuma policy
-- Corrige o aviso "RLS Enabled No Policy" do Security Advisor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- crash_reports
--   Inserção feita exclusivamente pelo API server com a chave
--   service_role (que já bypassa o RLS automaticamente).
--   Bloqueia acesso direto via REST (anon / authenticated).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS crash_reports_no_direct_access ON public.crash_reports;
CREATE POLICY crash_reports_no_direct_access ON public.crash_reports
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);


-- ────────────────────────────────────────────────────────────
-- bi_exportadores / bi_importadores / bi_produtores / bi_exportadores_financeiro
--   Tabelas de dados de mercado (estatísticas do setor vitivinícola).
--   Somente leitura para usuários autenticados.
--   Escrita exclusivamente via service_role (dashboard/imports).
-- ────────────────────────────────────────────────────────────
CREATE POLICY bi_exportadores_select ON public.bi_exportadores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY bi_importadores_select ON public.bi_importadores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY bi_produtores_select ON public.bi_produtores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY bi_exportadores_financeiro_select ON public.bi_exportadores_financeiro
  FOR SELECT TO authenticated
  USING (true);
