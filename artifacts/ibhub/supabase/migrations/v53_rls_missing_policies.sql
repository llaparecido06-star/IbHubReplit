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
CREATE POLICY crash_reports_no_direct_access ON public.crash_reports
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);


-- ────────────────────────────────────────────────────────────
-- b1_exportadores / b1_importadores / b1_produtores / b1_exportadores_financeiro
--   Tabelas de dados de mercado (estatísticas do setor vitivinícola).
--   Somente leitura para usuários autenticados.
--   Escrita exclusivamente via service_role (dashboard/imports).
-- ────────────────────────────────────────────────────────────
CREATE POLICY b1_exportadores_select ON public.b1_exportadores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY b1_importadores_select ON public.b1_importadores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY b1_produtores_select ON public.b1_produtores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY b1_exportadores_financeiro_select ON public.b1_exportadores_financeiro
  FOR SELECT TO authenticated
  USING (true);
