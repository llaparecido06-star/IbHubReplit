-- ============================================================
-- v57_commission_override.sql
-- Adiciona campo de comissão manual por representante.
-- Quando NULL → usa o tier automático (10/15/20%).
-- Quando preenchido → prevalece sobre o tier.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_override numeric(5, 2)
    CHECK (
      commission_override IS NULL OR
      (commission_override >= 0 AND commission_override <= 100)
    );

COMMENT ON COLUMN public.profiles.commission_override IS
  'Comissão manual em % para representantes. NULL = usar tier automático (10/15/20%). Preenchido = sobrescreve o tier.';
