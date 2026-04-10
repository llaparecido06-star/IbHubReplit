-- Migration v37: Market Permissions table
-- Stores the configurable sections of the Mercado tab that can be
-- granted per plan in the Plan Builder.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.market_permissions (
  id          text PRIMARY KEY,
  title       text        NOT NULL,
  icon        text        NOT NULL DEFAULT 'bar-chart-2',
  sort_order  int         NOT NULL DEFAULT 0
);

ALTER TABLE public.market_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_public_read" ON public.market_permissions
  FOR SELECT USING (true);

CREATE POLICY "mp_admin_all" ON public.market_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

INSERT INTO public.market_permissions (id, title, icon, sort_order) VALUES
  ('kpis',       'KPIs de Mercado',        'activity',    0),
  ('graficos',   'Gráficos',               'bar-chart-2', 1),
  ('tendencias', 'Tendências',             'trending-up', 2),
  ('regioes',    'Regiões Produtoras',     'map-pin',     3),
  ('variedades', 'Variedades em Destaque', 'git-merge',   4)
ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT * FROM public.market_permissions ORDER BY sort_order;
