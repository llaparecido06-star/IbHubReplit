-- ============================================================
-- v58_partner_territories.sql
-- Tabela de territórios de parceiros internacionais.
-- Cada parceiro pode ter um ou mais países atribuídos.
-- Cada país pertence a no máximo um parceiro.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_territories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  country_code  text        NOT NULL,   -- ISO 3166-1 alpha-2 (BR, AR, CL, …)
  country_name  text        NOT NULL,   -- nome por extenso (Argentina, Chile, …)
  country_flag  text,                   -- emoji (🇦🇷, 🇨🇱, …)
  notes         text,                   -- observações internas (opcional)
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Um país pode ter apenas um parceiro responsável
  CONSTRAINT partner_territories_country_unique UNIQUE (country_code)
);

COMMENT ON TABLE  public.partner_territories                IS 'Liga um representante/parceiro a um ou mais países. Usuários daquele país são atribuídos automaticamente ao parceiro.';
COMMENT ON COLUMN public.partner_territories.country_code   IS 'ISO 3166-1 alpha-2. Deve coincidir com profiles.country dos usuários do território.';
COMMENT ON COLUMN public.partner_territories.notes          IS 'Observações internas do admin (acordo comercial, contato, etc.)';

-- Índice de busca por parceiro
CREATE INDEX IF NOT EXISTS idx_partner_territories_partner_id
  ON public.partner_territories(partner_id);

-- RLS — somente admins podem gerenciar territórios
ALTER TABLE public.partner_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_territories_admin_all"
  ON public.partner_territories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Salvar país ISO no cadastro:
-- profiles.country já existe (text). Passará a receber o código ISO (ex: "AR").
-- Adicionar índice para tornar a busca por país eficiente.
CREATE INDEX IF NOT EXISTS idx_profiles_country
  ON public.profiles(country)
  WHERE country IS NOT NULL;
