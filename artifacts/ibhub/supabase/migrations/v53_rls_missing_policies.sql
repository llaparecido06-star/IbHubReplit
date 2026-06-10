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
-- bt_exportacoes / bt_importacoes / bt_produtores
--   Tabelas de dados de mercado (estatísticas do setor vitivinícola).
--   Somente leitura para usuários autenticados.
--   Escrita exclusivamente via service_role (dashboard/imports).
-- ────────────────────────────────────────────────────────────
CREATE POLICY bt_exportacoes_select ON public.bt_exportacoes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY bt_importacoes_select ON public.bt_importacoes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY bt_produtores_select ON public.bt_produtores
  FOR SELECT TO authenticated
  USING (true);
