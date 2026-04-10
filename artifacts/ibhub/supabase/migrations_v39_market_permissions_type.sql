-- Migration v39: Add section_type to market_permissions
-- Defines how data for each category is entered and stored in market_overview.
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.market_permissions
  ADD COLUMN IF NOT EXISTS section_type text NOT NULL DEFAULT 'lista';

-- Update default categories with their types
UPDATE public.market_permissions SET section_type = 'kpi'     WHERE id = 'kpis';
UPDATE public.market_permissions SET section_type = 'grafico'  WHERE id = 'graficos';
UPDATE public.market_permissions SET section_type = 'lista'    WHERE id = 'tendencias';
UPDATE public.market_permissions SET section_type = 'ranking'  WHERE id = 'regioes';
UPDATE public.market_permissions SET section_type = 'simples'  WHERE id = 'variedades';

-- Verify
SELECT id, title, section_type FROM public.market_permissions ORDER BY sort_order;
